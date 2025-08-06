/**
 * 统一预处理补丁系统
 * 将原本分散的补丁检测和应用统一到预处理阶段
 * 确保所有输入都经过统一的补丁检测和处理，避免遗漏
 */

import { PatchManager, createPatchManager } from '../patches';
import { getLogger } from '../logging';
import { 
  BasePatch, 
  PatchContext, 
  PatchResult, 
  Provider 
} from '../patches/types';

interface PreprocessingContext {
  requestId: string;
  provider: Provider;
  model: string;
  stage: 'input' | 'response' | 'streaming';
  timestamp: number;
  metadata?: any;
}

interface UnifiedPatchPreprocessorConfig {
  enabled: boolean;
  debugMode: boolean;
  forceAllInputs: boolean; // 强制所有输入都进入预处理
  bypassConditions: string[]; // 可以绕过的特殊条件
  performanceTracking: boolean;
  cacheResults: boolean;
}

export class UnifiedPatchPreprocessor {
  private patchManager: PatchManager;
  private logger: ReturnType<typeof getLogger>;
  private config: UnifiedPatchPreprocessorConfig;
  private processedCache: Map<string, any> = new Map();
  private performanceMetrics = {
    totalProcessed: 0,
    totalDuration: 0,
    byStage: {
      input: { count: 0, duration: 0 },
      response: { count: 0, duration: 0 },
      streaming: { count: 0, duration: 0 }
    }
  };

  constructor(port?: number, config?: Partial<UnifiedPatchPreprocessorConfig>) {
    this.config = {
      enabled: process.env.RCC_UNIFIED_PREPROCESSING !== 'false',
      debugMode: process.env.RCC_PREPROCESSING_DEBUG === 'true',
      forceAllInputs: process.env.RCC_FORCE_ALL_INPUTS === 'true',
      bypassConditions: [],
      performanceTracking: true,
      cacheResults: process.env.RCC_CACHE_PREPROCESSING === 'true',
      ...config
    };

    this.logger = getLogger(port);
    this.patchManager = createPatchManager(port);

    if (this.config.debugMode) {
      this.logger.info('UnifiedPatchPreprocessor initialized', {
        config: this.config,
        port
      });
    }
  }

  /**
   * 统一预处理入口：处理输入阶段数据
   * 所有API请求都必须经过此处理
   */
  async preprocessInput(
    inputData: any,
    provider: Provider,
    model: string,
    requestId: string
  ): Promise<any> {
    const context: PreprocessingContext = {
      requestId,
      provider,
      model,
      stage: 'input',
      timestamp: Date.now(),
      metadata: inputData.metadata
    };

    return this.processWithUnifiedPipeline(inputData, context);
  }

  /**
   * 统一预处理入口：处理响应阶段数据
   * 所有Provider响应都必须经过此处理
   */
  async preprocessResponse(
    responseData: any,
    provider: Provider,
    model: string,
    requestId: string
  ): Promise<any> {
    const context: PreprocessingContext = {
      requestId,
      provider,
      model,
      stage: 'response',
      timestamp: Date.now()
    };

    return this.processWithUnifiedPipeline(responseData, context);
  }

  /**
   * 统一预处理入口：处理流式数据块
   * 所有流式响应都必须经过此处理
   */
  async preprocessStreaming(
    chunkData: any,
    provider: Provider,
    model: string,
    requestId: string
  ): Promise<any> {
    const context: PreprocessingContext = {
      requestId,
      provider,
      model,
      stage: 'streaming',
      timestamp: Date.now()
    };

    return this.processWithUnifiedPipeline(chunkData, context);
  }

  /**
   * 核心统一处理流水线
   * 集成所有补丁检测和应用逻辑
   */
  private async processWithUnifiedPipeline(
    data: any,
    context: PreprocessingContext
  ): Promise<any> {
    const startTime = Date.now();

    try {
      // 性能跟踪开始
      if (this.config.performanceTracking) {
        this.performanceMetrics.totalProcessed++;
        this.performanceMetrics.byStage[context.stage].count++;
      }

      // 1. 预处理检查：是否启用
      if (!this.config.enabled) {
        if (this.config.debugMode) {
          this.logger.debug('UnifiedPatchPreprocessor disabled, skipping', {
            requestId: context.requestId
          });
        }
        return data;
      }

      // 2. 缓存检查（可选优化）
      if (this.config.cacheResults) {
        const cacheKey = this.generateCacheKey(data, context);
        const cached = this.processedCache.get(cacheKey);
        if (cached) {
          this.logger.debug('[TRACE] Cache hit for preprocessing', {
            requestId: context.requestId,
            cacheKey
          });
          return cached;
        }
      }

      // 3. 强制所有输入进入检查
      if (this.config.forceAllInputs || this.shouldProcess(data, context)) {
        // 构建补丁上下文
        const patchContext: PatchContext = {
          provider: context.provider,
          model: context.model,
          requestId: context.requestId,
          timestamp: context.timestamp
        };

        // 应用对应类型的补丁
        let processedData = data;
        
        if (context.stage === 'input') {
          processedData = await this.patchManager.applyRequestPatches(
            data, 
            context.provider, 
            context.model
          );
        } else if (context.stage === 'response') {
          processedData = await this.patchManager.applyResponsePatches(
            data, 
            context.provider, 
            context.model, 
            context.requestId
          );
        } else if (context.stage === 'streaming') {
          processedData = await this.patchManager.applyStreamingPatches(
            data, 
            context.provider, 
            context.model, 
            context.requestId
          );
        }

        // 4. 缓存结果（如果启用）
        if (this.config.cacheResults && processedData !== data) {
          const cacheKey = this.generateCacheKey(data, context);
          this.processedCache.set(cacheKey, processedData);
          
          // 限制缓存大小
          if (this.processedCache.size > 1000) {
            const firstKey = this.processedCache.keys().next().value;
            if (firstKey !== undefined) {
              this.processedCache.delete(firstKey);
            }
          }
        }

        // 5. 性能跟踪和调试日志
        const duration = Date.now() - startTime;
        if (this.config.performanceTracking) {
          this.performanceMetrics.totalDuration += duration;
          this.performanceMetrics.byStage[context.stage].duration += duration;
        }

        if (this.config.debugMode && processedData !== data) {
          this.logger.debug('UnifiedPatchPreprocessor applied changes', {
            requestId: context.requestId,
            stage: context.stage,
            provider: context.provider,
            model: context.model,
            duration: `${duration}ms`,
            dataChanged: true
          });
        }

        return processedData;
      }

      // 6. 数据未处理的情况
      if (this.config.debugMode) {
        this.logger.debug('[TRACE] Data bypassed UnifiedPatchPreprocessor', {
          requestId: context.requestId,
          stage: context.stage,
          reason: 'No matching conditions'
        });
      }

      return data;

    } catch (error) {
      // 统一错误处理：补丁失败不应该阻断主流程
      this.logger.error('UnifiedPatchPreprocessor error', {
        error: error instanceof Error ? error.message : String(error),
        requestId: context.requestId,
        stage: context.stage,
        provider: context.provider,
        model: context.model
      });

      // 返回原始数据，确保系统继续运行
      return data;
    }
  }

  /**
   * 智能检测：判断数据是否需要处理
   */
  private shouldProcess(data: any, context: PreprocessingContext): boolean {
    // 如果强制处理所有输入，直接返回true
    if (this.config.forceAllInputs) {
      return true;
    }

    // 检查绕过条件
    for (const bypass of this.config.bypassConditions) {
      if (this.matchesCondition(data, context, bypass)) {
        return false;
      }
    }

    // 基本检测规则：
    // 1. 输入阶段：检查是否包含需要处理的格式
    // 2. 响应阶段：检查是否包含工具调用或特殊格式
    // 3. 流式阶段：检查是否包含需要修复的数据块

    switch (context.stage) {
      case 'input':
        return this.detectInputProcessingNeeded(data, context);
      case 'response':
        return this.detectResponseProcessingNeeded(data, context);
      case 'streaming':
        return this.detectStreamingProcessingNeeded(data, context);
      default:
        return false;
    }
  }

  /**
   * 检测输入是否需要预处理
   */
  private detectInputProcessingNeeded(data: any, context: PreprocessingContext): boolean {
    // 检查是否包含工具调用相关的内容
    if (data && typeof data === 'object') {
      // 检查 tools 字段
      if (data.tools && Array.isArray(data.tools)) {
        return true;
      }

      // 检查消息中是否包含工具调用内容
      if (data.messages && Array.isArray(data.messages)) {
        return data.messages.some((msg: any) => {
          if (typeof msg.content === 'string') {
            return /tool_use|Tool call|function/i.test(msg.content);
          }
          return false;
        });
      }
    }

    return false;
  }

  /**
   * 检测响应是否需要预处理
   */
  private detectResponseProcessingNeeded(data: any, context: PreprocessingContext): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // 检查是否包含文本格式的工具调用
    if (data.content && Array.isArray(data.content)) {
      return data.content.some((block: any) => {
        if (block.type === 'text' && typeof block.text === 'string') {
          return /Tool call:|tool_use|function_call/i.test(block.text);
        }
        return false;
      });
    }

    // 检查OpenAI格式的工具调用
    if (data.choices && Array.isArray(data.choices)) {
      return data.choices.some((choice: any) => {
        return choice.message && (choice.message.tool_calls || choice.message.function_call);
      });
    }

    // 检查Gemini格式
    if (data.candidates && Array.isArray(data.candidates)) {
      return true; // Gemini响应都需要格式修复
    }

    return false;
  }

  /**
   * 检测流式数据是否需要预处理
   */
  private detectStreamingProcessingNeeded(data: any, context: PreprocessingContext): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // 检查流式事件中的工具调用
    if (data.event && data.data) {
      const eventType = data.event;
      const eventData = data.data;

      if (eventType === 'content_block_start' && eventData.content_block?.type === 'tool_use') {
        return true;
      }

      if (eventType === 'content_block_delta' && eventData.delta?.text) {
        return /Tool call:|tool_use/i.test(eventData.delta.text);
      }
    }

    return false;
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(data: any, context: PreprocessingContext): string {
    const dataHash = JSON.stringify(data).substring(0, 100);
    return `${context.stage}-${context.provider}-${context.model}-${dataHash}`;
  }

  /**
   * 检查是否匹配特定条件
   */
  private matchesCondition(data: any, context: PreprocessingContext, condition: string): boolean {
    // 简单的条件匹配逻辑，可以根据需要扩展
    if (condition === 'no-tools' && !data.tools) {
      return true;
    }

    if (condition.startsWith('provider:')) {
      const providerName = condition.split(':')[1];
      return context.provider === providerName;
    }

    if (condition.startsWith('model:')) {
      const modelName = condition.split(':')[1];
      return context.model.includes(modelName);
    }

    return false;
  }

  /**
   * 获取性能统计
   */
  getPerformanceMetrics() {
    const avgDuration = this.performanceMetrics.totalProcessed > 0 
      ? this.performanceMetrics.totalDuration / this.performanceMetrics.totalProcessed 
      : 0;

    return {
      ...this.performanceMetrics,
      averageDuration: Math.round(avgDuration * 100) / 100,
      cacheSize: this.processedCache.size,
      config: this.config
    };
  }

  /**
   * 获取补丁管理器统计
   */
  getPatchManagerStats() {
    return this.patchManager.getStats();
  }

  /**
   * 清理缓存
   */
  clearCache() {
    this.processedCache.clear();
    this.logger.info('UnifiedPatchPreprocessor cache cleared');
  }

  /**
   * 重置性能指标
   */
  resetMetrics() {
    this.performanceMetrics = {
      totalProcessed: 0,
      totalDuration: 0,
      byStage: {
        input: { count: 0, duration: 0 },
        response: { count: 0, duration: 0 },
        streaming: { count: 0, duration: 0 }
      }
    };
    this.logger.info('UnifiedPatchPreprocessor metrics reset');
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<UnifiedPatchPreprocessorConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('UnifiedPatchPreprocessor config updated', { newConfig });
  }
}

// 单例模式：全局统一预处理器实例
const preprocessorInstances = new Map<number | string, UnifiedPatchPreprocessor>();

/**
 * 获取或创建统一预处理器实例
 */
export function getUnifiedPatchPreprocessor(port?: number): UnifiedPatchPreprocessor {
  const key = port || 'default';
  
  if (!preprocessorInstances.has(key)) {
    preprocessorInstances.set(key, new UnifiedPatchPreprocessor(port));
  }

  return preprocessorInstances.get(key)!;
}

/**
 * 创建新的统一预处理器实例
 */
export function createUnifiedPatchPreprocessor(
  port?: number,
  config?: Partial<UnifiedPatchPreprocessorConfig>
): UnifiedPatchPreprocessor {
  const key = port || 'default';
  const instance = new UnifiedPatchPreprocessor(port, config);
  preprocessorInstances.set(key, instance);
  return instance;
}

/**
 * 重置统一预处理器实例
 */
export function resetUnifiedPatchPreprocessor(port?: number) {
  const key = port || 'default';
  if (preprocessorInstances.has(key)) {
    preprocessorInstances.delete(key);
  }
}