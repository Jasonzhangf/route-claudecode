/**
 * 补丁管理器
 * 负责补丁的注册、应用和监控
 */

import { getLogger } from '../logging';
import { 
  BasePatch, 
  PatchContext, 
  PatchResult, 
  PatchStats, 
  PatchManagerConfig,
  Provider,
  PatchType
} from './types';

export class PatchManager {
  private patches: Map<string, BasePatch> = new Map();
  private stats: Map<string, PatchStats> = new Map();
  private logger: ReturnType<typeof getLogger>;
  private config: PatchManagerConfig;

  constructor(config?: Partial<PatchManagerConfig>, port?: number) {
    this.config = {
      enabled: process.env.RCC_PATCHES_ENABLED !== 'false', // 默认启用
      debugMode: process.env.RCC_PATCHES_DEBUG === 'true',
      maxRetries: 3,
      timeoutMs: 5000,
      enableStats: true,
      logLevel: 'info',
      ...config
    };

    // 使用传递的端口或默认端口
    this.logger = getLogger(port);

    // console.log('🔧 PatchManager config:', this.config);

    if (this.config.debugMode) {
      this.logger.info('PatchManager initialized in debug mode', { config: this.config });
    }
  }

  /**
   * 注册补丁
   */
  registerPatch(patch: BasePatch): void {
    if (this.patches.has(patch.name)) {
      this.logger.warn(`Patch ${patch.name} already registered, overwriting`);
    }

    this.patches.set(patch.name, patch);
    
    // 初始化统计
    if (this.config.enableStats) {
      this.stats.set(patch.name, {
        patchName: patch.name,
        appliedCount: 0,
        successCount: 0,
        failureCount: 0,
        averageDuration: 0,
        lastApplied: 0,
        errorRate: 0
      });
    }

    this.logger.debug(`Registered patch: ${patch.name}`, {
      type: patch.type,
      priority: patch.priority,
      condition: patch.condition
    });
  }

  /**
   * 应用指定类型的补丁
   */
  async applyPatches<T>(
    type: PatchType,
    context: PatchContext,
    data: T
  ): Promise<T> {
    if (!this.config.enabled) {
      return data;
    }

    // 获取匹配的补丁并按优先级排序
    const applicablePatches = Array.from(this.patches.values())
      .filter(patch => patch.type === type)
      .filter(patch => this.shouldApplyPatch(patch, context, data))
      .sort((a, b) => a.priority - b.priority);

    if (applicablePatches.length === 0) {
      return data;
    }

    let result = data;
    const appliedPatches: string[] = [];

    for (const patch of applicablePatches) {
      try {
        const startTime = Date.now();
        const patchResult = await this.applyPatch(patch, context, result);
        
        if (patchResult.applied) {
          result = patchResult.data;
          appliedPatches.push(patch.name);
          
          // 更新统计
          this.updateStats(patch.name, true, Date.now() - startTime);
          
          if (this.config.debugMode) {
            this.logger.debug(`Applied patch: ${patch.name}`, {
              requestId: context.requestId,
              duration: patchResult.duration,
              metadata: patchResult.metadata
            });
          }
        }
      } catch (error) {
        this.updateStats(patch.name, false, 0);
        this.logger.error(`Patch ${patch.name} failed`, {
          error: error instanceof Error ? error.message : String(error),
          requestId: context.requestId
        });
        
        // 继续应用其他补丁，不因单个补丁失败而中断
      }
    }

    if (appliedPatches.length > 0) {
      this.logger.info(`Applied ${appliedPatches.length} patches`, {
        requestId: context.requestId,
        patches: appliedPatches,
        provider: context.provider,
        model: context.model
      });
    }

    return result;
  }

  /**
   * 应用请求补丁
   */
  async applyRequestPatches(request: any, provider: Provider, model: string): Promise<any> {
    const context: PatchContext = {
      provider,
      model,
      requestId: request.requestId || 'unknown',
      timestamp: Date.now()
    };

    return this.applyPatches('request', context, request);
  }

  /**
   * 应用响应补丁
   */
  async applyResponsePatches(response: any, provider: Provider, model: string, requestId?: string): Promise<any> {
    const context: PatchContext = {
      provider,
      model,
      requestId: requestId || 'unknown',
      timestamp: Date.now()
    };

    return this.applyPatches('response', context, response);
  }

  /**
   * 应用流式补丁
   */
  async applyStreamingPatches(chunk: any, provider: Provider, model: string, requestId?: string): Promise<any> {
    const context: PatchContext = {
      provider,
      model,
      requestId: requestId || 'unknown',
      timestamp: Date.now()
    };

    return this.applyPatches('streaming', context, chunk);
  }

  /**
   * 检查是否应该应用补丁
   */
  private shouldApplyPatch(patch: BasePatch, context: PatchContext, data: any): boolean {
    const condition = patch.condition;

    // 检查启用状态
    if (typeof condition.enabled === 'boolean' && !condition.enabled) {
      return false;
    }
    if (typeof condition.enabled === 'function' && !condition.enabled()) {
      return false;
    }

    // 检查提供商
    if (condition.provider) {
      const providers = Array.isArray(condition.provider) ? condition.provider : [condition.provider];
      if (!providers.includes(context.provider)) {
        return false;
      }
    }

    // 检查模型
    if (condition.model) {
      if (typeof condition.model === 'string') {
        if (context.model !== condition.model) {
          return false;
        }
      } else if (condition.model instanceof RegExp) {
        if (!condition.model.test(context.model)) {
          return false;
        }
      } else if (typeof condition.model === 'function') {
        if (!condition.model(context.model)) {
          return false;
        }
      }
    }

    // 调用补丁自身的检查逻辑
    return patch.shouldApply(context, data);
  }

  /**
   * 应用单个补丁
   */
  private async applyPatch(patch: BasePatch, context: PatchContext, data: any): Promise<PatchResult> {
    const startTime = Date.now();
    
    try {
      const result = await Promise.race([
        patch.apply(context, data),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Patch timeout')), this.config.timeoutMs)
        )
      ]);

      return {
        ...result,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        data,
        applied: false,
        patchName: patch.name,
        duration: Date.now() - startTime,
        metadata: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  /**
   * 更新补丁统计
   */
  private updateStats(patchName: string, success: boolean, duration: number): void {
    if (!this.config.enableStats) return;

    const stats = this.stats.get(patchName);
    if (!stats) return;

    stats.appliedCount++;
    stats.lastApplied = Date.now();

    if (success) {
      stats.successCount++;
      // 更新平均持续时间
      stats.averageDuration = (stats.averageDuration * (stats.successCount - 1) + duration) / stats.successCount;
    } else {
      stats.failureCount++;
    }

    stats.errorRate = stats.failureCount / stats.appliedCount;
  }

  /**
   * 获取补丁统计
   */
  getStats(): PatchStats[] {
    return Array.from(this.stats.values());
  }

  /**
   * 获取已注册的补丁列表
   */
  getRegisteredPatches(): string[] {
    return Array.from(this.patches.keys());
  }

  /**
   * 启用/禁用补丁系统
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.logger.info(`Patch system ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.patches.clear();
    this.stats.clear();
    this.logger.info('PatchManager cleaned up');
  }
}