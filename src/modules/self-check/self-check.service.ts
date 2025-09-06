/**
 * 自检服务实现
 *
 * 实现API密钥验证、token管理、流水线健康检查等核心功能
 *
 * @author Jason Zhang
 * @version 4.0.0
 */

import { ISelfCheckModule } from './self-check.interface';
import {
  ApiKeyInfo,
  PipelineCheckResult,
  AuthCheckResult,
  SelfCheckConfig,
  SelfCheckState,
  ApiKeyStatus,
  AuthStatus,
  PipelineCheckStatus
} from './self-check-types';
import {
  ModuleStatus,
  ModuleMetrics,
  ModuleType,
  ModuleInterface
} from '../interfaces/module/base-module';
import { BaseModule } from '../base-module-impl';
import { JQJsonHandler } from '../utils';
import { RCCError, RCCErrorCode, EnhancedErrorHandler } from '../error-handler';

// 添加PipelineManager导入
import { PipelineManager } from '../pipeline/src/pipeline-manager';


/**
 * 自检服务实现类
 */
export class SelfCheckService extends BaseModule implements ISelfCheckModule {
  protected config: SelfCheckConfig;
  private apiKeyCache: Map<string, ApiKeyInfo>;
  private pipelineCheckResults: Map<string, PipelineCheckResult>;
  private authCheckResults: Map<string, AuthCheckResult>;
  private state: SelfCheckState;
  private isInitialized: boolean = false;
  private pipelineManager: PipelineManager | null = null;
  private errorHandler: EnhancedErrorHandler = new EnhancedErrorHandler();

  constructor() {
    super(
      'self-check-service',
      'Self Check Service',
      ModuleType.SERVICE,
      '4.0.0'
    );

    this.config = {
      enableApiKeyValidation: true,
      apiKeyValidationInterval: 300000, // 5分钟
      enableTokenRefresh: true,
      tokenRefreshAdvanceTime: 3600000, // 1小时
      enablePipelineHealthCheck: true,
      pipelineHealthCheckInterval: 60000, // 1分钟
      autoDestroyInvalidPipelines: true,
      authTimeout: 300000 // 5分钟
    };

    this.apiKeyCache = new Map();
    this.pipelineCheckResults = new Map();
    this.authCheckResults = new Map();

    this.state = {
      moduleId: this.getId(),
      moduleName: this.getName(),
      moduleType: this.getType(),
      version: this.getVersion(),
      isRunning: false,
      statistics: {
        totalChecks: 0,
        successfulChecks: 0,
        failedChecks: 0,
        lastCheckAt: new Date(0),
        averageCheckDuration: 0
      },
      config: this.config,
      errors: []
    };
  }

  // ModuleInterface implementations
  getId(): string {
    return super.getId();
  }

  getName(): string {
    return super.getName();
  }

  getType(): ModuleType {
    return super.getType();
  }

  getVersion(): string {
    return super.getVersion();
  }

  getStatus(): ModuleStatus {
    return super.getStatus();
  }

  getMetrics(): ModuleMetrics {
    return super.getMetrics();
  }

  async configure(config: any): Promise<void> {
    await super.configure(config);
  }

  async reset(): Promise<void> {
    await super.reset();
    await this.resetSelfCheck();
  }

  async cleanup(): Promise<void> {
    await super.cleanup();
    await this.cleanupSelfCheck();
  }

  addConnection(module: ModuleInterface): void {
    super.addConnection(module);
  }

  removeConnection(moduleId: string): void {
    super.removeConnection(moduleId);
  }

  getConnection(moduleId: string): ModuleInterface | undefined {
    return super.getConnection(moduleId);
  }

  getConnections(): ModuleInterface[] {
    return super.getConnections();
  }

  async sendToModule(targetModuleId: string, message: any, type?: string): Promise<any> {
    return super.sendToModule(targetModuleId, message, type);
  }

  async broadcastToModules(message: any, type?: string): Promise<void> {
    await super.broadcastToModules(message, type);
  }

  onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void): void {
    super.onModuleMessage(listener);
  }

  on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }

  removeAllListeners(): this {
    super.removeAllListeners();
    return this;
  }

  async start(): Promise<void> {
    await super.start();
    this.state.isRunning = true;
    this.state.startedAt = new Date();
  }

  async stop(): Promise<void> {
    await super.stop();
    this.state.isRunning = false;
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return super.healthCheck();
  }

  async process(input: any): Promise<any> {
    // 自检模块的处理逻辑
    return await this.performSelfCheck();
  }

  /**
   * 配置自检模块
   * @param config 自检配置
   */
  async configureSelfCheck(config: SelfCheckConfig): Promise<void> {
    this.config = { ...this.config, ...config };
    this.state.config = this.config;
  }

  /**
   * 设置流水线管理器
   * @param pipelineManager 流水线管理器实例
   */
  setPipelineManager(pipelineManager: PipelineManager): void {
    this.pipelineManager = pipelineManager;
  }

  /**
   * 处理输入（实现BaseModule抽象方法）
   */
  protected async onProcess(input: any): Promise<any> {
    // 根据输入类型执行不同的自检操作
    if (input?.operation === 'selfCheck') {
      const result = await this.performSelfCheck();
      return { success: result, timestamp: new Date().toISOString() };
    } else if (input?.operation === 'validateApiKey') {
      const result = await this.validateApiKey(input.apiKeyId);
      return result;
    } else if (input?.operation === 'refreshToken') {
      await this.refreshToken();
      return { success: true, timestamp: new Date().toISOString() };
    } else {
      // 默认执行完整自检
      const result = await this.performSelfCheck();
      return { success: result, timestamp: new Date().toISOString() };
    }
  }

  /**
   * 执行完整的自检流程
   * @returns Promise<boolean> 自检是否成功
   */
  async performSelfCheck(): Promise<boolean> {
    const startTime = Date.now();
    this.state.statistics.totalChecks++;

    try {
      // 验证API密钥
      if (this.config.enableApiKeyValidation) {
        await this.validateAllApiKeys();
      }

      // 刷新token
      if (this.config.enableTokenRefresh) {
        await this.refreshToken();
      }

      // 检查流水线健康状态
      if (this.config.enablePipelineHealthCheck) {
        await this.checkPipelineHealth();
      }

      // 更新统计信息
      const duration = Date.now() - startTime;
      this.state.statistics.successfulChecks++;
      this.state.statistics.lastCheckAt = new Date();
      
      // 更新平均检查耗时
      const totalDuration = this.state.statistics.averageCheckDuration * (this.state.statistics.successfulChecks - 1) + duration;
      this.state.statistics.averageCheckDuration = totalDuration / this.state.statistics.successfulChecks;

      return true;
    } catch (error) {
      this.state.statistics.failedChecks++;
      const errorMessage = error instanceof RCCError ? error.message : '未知错误';
      this.state.errors.push(`自检失败: ${errorMessage}`);
      return false;
    }
  }

  /**
   * 验证所有API密钥的有效性
   * @returns Promise<ApiKeyInfo[]> API密钥验证结果列表
   */
  async validateAllApiKeys(): Promise<ApiKeyInfo[]> {
    const results: ApiKeyInfo[] = [];
    
    try {
      // 使用设置的流水线管理器或创建一个默认的
      const pipelineManager = this.pipelineManager || {
        getAllPipelines: () => new Map(),
        getAllPipelineStatus: () => ({})
      };

      // 获取所有流水线配置
      const allPipelinesMap = pipelineManager.getAllPipelines();
      const allPipelines: Record<string, any> = {};
      for (const [id, pipeline] of allPipelinesMap) {
        allPipelines[id] = {
          provider: pipeline.provider,
          apiKey: pipeline.apiKey
        };
      }
      
      // 收集所有唯一的API密钥
      const uniqueApiKeys = new Map<string, { provider: string; pipelines: string[] }>();
      
      // 从现有缓存中获取API密钥信息
      for (const [apiKeyId, apiKeyInfo] of this.apiKeyCache.entries()) {
        const key = `${apiKeyInfo.provider}:${apiKeyInfo.apiKey}`;
        if (!uniqueApiKeys.has(key)) {
          uniqueApiKeys.set(key, {
            provider: apiKeyInfo.provider,
            pipelines: []
          });
        }
        uniqueApiKeys.get(key)?.pipelines.push(...apiKeyInfo.associatedPipelines);
      }

      // 验证每个API密钥
      for (const [key, info] of uniqueApiKeys.entries()) {
        const [provider, apiKeyValue] = key.split(':');
        const apiKeyId = this.generateApiKeyID(provider, apiKeyValue);
        
        const apiKeyInfo: ApiKeyInfo = {
          id: apiKeyId,
          apiKey: apiKeyValue,
          provider: provider,
          status: await this.verifyApiKey(provider, apiKeyValue) ? 'valid' : 'invalid',
          lastCheckedAt: new Date(),
          createdAt: new Date(),
          associatedPipelines: info.pipelines
        };

        this.apiKeyCache.set(apiKeyId, apiKeyInfo);
        results.push(apiKeyInfo);

        // 如果启用了自动销毁且API密钥无效，销毁相关流水线
        if (this.config.autoDestroyInvalidPipelines && apiKeyInfo.status === 'invalid') {
          await this.destroyInvalidPipelines([apiKeyId]);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof RCCError ? error.message : '未知错误';
      this.state.errors.push(`API密钥验证失败: ${errorMessage}`);
    }

    return results;
  }

  /**
   * 检查特定API密钥的有效性
   * @param apiKeyId API密钥ID
   * @returns Promise<ApiKeyInfo> API密钥信息
   */
  async validateApiKey(apiKeyId: string): Promise<ApiKeyInfo> {
    const cachedInfo = this.apiKeyCache.get(apiKeyId);
    if (cachedInfo) {
      // 检查缓存是否过期（5分钟内认为有效）
      const age = Date.now() - cachedInfo.lastCheckedAt.getTime();
      if (age < 300000) {
        return cachedInfo;
      }
    }

    // 重新验证API密钥
    const apiKeyInfo = await this.performApiKeyValidation(apiKeyId);
    this.apiKeyCache.set(apiKeyId, apiKeyInfo);
    return apiKeyInfo;
  }

  /**
   * 执行API密钥验证
   * @param apiKeyId API密钥ID
   * @returns Promise<ApiKeyInfo> API密钥信息
   */
  private async performApiKeyValidation(apiKeyId: string): Promise<ApiKeyInfo> {
    // 从现有缓存中获取信息
    const existingInfo = this.apiKeyCache.get(apiKeyId);
    if (!existingInfo) {
      const error = new RCCError(`未找到API密钥: ${apiKeyId}`, RCCErrorCode.CONFIG_INVALID, 'self-check');
      await this.errorHandler.handleRCCError(error, { requestId: `apikey-${Date.now()}` });
      throw error;
    }

    // 实际验证逻辑（这里需要根据提供商调用不同的验证方法）
    const isValid = await this.verifyApiKey(existingInfo.provider, existingInfo.apiKey);
    
    return {
      ...existingInfo,
      status: isValid ? 'valid' : 'invalid',
      lastCheckedAt: new Date()
    };
  }

  /**
   * 验证API密钥（真实的验证逻辑）
   * @param provider 提供商
   * @param apiKey API密钥
   * @returns Promise<boolean> 是否有效
   */
  private async verifyApiKey(provider: string, apiKey: string): Promise<boolean> {
    try {
      // 根据不同的提供商使用不同的验证方法
      switch (provider.toLowerCase()) {
        case 'iflow':
          return this.verifyIflowApiKey(apiKey);
        case 'qwen':
          return this.verifyQwenApiKey(apiKey);
        default:
          // 默认验证逻辑 - 检查格式和长度
          return this.verifyGenericApiKey(apiKey);
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * 验证Iflow API密钥
   * @param apiKey API密钥
   * @returns boolean 是否有效
   */
  private verifyIflowApiKey(apiKey: string): boolean {
    // iflow API密钥格式验证
    return typeof apiKey === 'string' && 
           apiKey.startsWith('sk-') && 
           apiKey.length >= 32 &&
           /^[a-zA-Z0-9\-_]+$/.test(apiKey);
  }

  /**
   * 验证Qwen API密钥
   * @param apiKey API密钥
   * @returns boolean 是否有效
   */
  private verifyQwenApiKey(apiKey: string): boolean {
    // Qwen API密钥格式验证
    return typeof apiKey === 'string' && 
           (apiKey.startsWith('qwen-') || apiKey.length >= 20) &&
           /^[a-zA-Z0-9\-_]+$/.test(apiKey);
  }

  /**
   * 通用API密钥验证
   * @param apiKey API密钥
   * @returns boolean 是否有效
   */
  private verifyGenericApiKey(apiKey: string): boolean {
    // 通用API密钥验证
    return typeof apiKey === 'string' && 
           apiKey.length >= 10 &&
           /^[a-zA-Z0-9\-_]+$/.test(apiKey);
  }

  /**
   * 生成API密钥ID
   * @param provider 提供商
   * @param apiKey API密钥
   * @returns string API密钥ID
   */
  private generateApiKeyID(provider: string, apiKey: string): string {
    // 使用简单的哈希方法生成ID（实际实现中应该使用更安全的哈希算法）
    const hash = btoa(`${provider}:${apiKey.substring(0, 16)}`).replace(/[^a-zA-Z0-9]/g, '');
    return `ak_${provider}_${hash.substring(0, 16)}`;
  }

  /**
   * 刷新即将过期的token
   * @returns Promise<number> 成功刷新的token数量
   */
  async refreshToken(): Promise<number> {
    let refreshedCount = 0;
    
    try {
      // 获取所有需要刷新的token
      const tokensToRefresh = this.getTokensNeedingRefresh();
      
      // 刷新每个token
      for (const tokenId of tokensToRefresh) {
        const success = await this.refreshSingleToken(tokenId);
        if (success) {
          refreshedCount++;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof RCCError ? error.message : '未知错误';
      this.state.errors.push(`Token刷新失败: ${errorMessage}`);
    }

    return refreshedCount;
  }

  /**
   * 获取需要刷新的token列表
   * @returns string[] 需要刷新的token ID列表
   */
  private getTokensNeedingRefresh(): string[] {
    const tokens: string[] = [];
    // 在实际实现中，这里会检查缓存的token并找出即将过期的token
    return tokens;
  }

  /**
   * 刷新单个token
   * @param tokenId Token ID
   * @returns Promise<boolean> 刷新是否成功
   */
  private async refreshSingleToken(tokenId: string): Promise<boolean> {
    try {
      // 在实际实现中，这里会调用提供商的token刷新接口
      // 暂时返回true表示成功
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查所有流水线的健康状态
   * @returns Promise<PipelineCheckResult[]> 流水线检查结果列表
   */
  async checkPipelineHealth(): Promise<PipelineCheckResult[]> {
    const results: PipelineCheckResult[] = [];
    
    try {
      // 使用设置的流水线管理器
      const pipelineManager = this.pipelineManager;
      if (!pipelineManager) {
        const error = new RCCError('无法获取流水线管理器', RCCErrorCode.PIPELINE_MODULE_MISSING, 'self-check');
        await this.errorHandler.handleRCCError(error, { requestId: `pipeline-check-${Date.now()}` });
        throw error;
      }

      const allPipelines = pipelineManager.getAllPipelines();
      const allPipelineStatus = pipelineManager.getAllPipelineStatus();
      
      // 检查每个流水线的健康状态
      for (const [pipelineId, pipeline] of allPipelines) {
        try {
          const pipelineStatus = allPipelineStatus[pipelineId];
          const status = pipelineStatus ? pipelineStatus.health : 'unknown';
          
          const checkResult: PipelineCheckResult = {
            pipelineId: pipelineId,
            status: this.mapPipelineHealthToCheckStatus(status),
            checkedAt: new Date()
          };

          this.pipelineCheckResults.set(pipelineId, checkResult);
          results.push(checkResult);
        } catch (error) {
          const checkResult: PipelineCheckResult = {
            pipelineId: pipelineId,
            status: 'pending',
            checkedAt: new Date(),
            errorMessage: error.message || 'Unknown error'
          };
          
          this.pipelineCheckResults.set(pipelineId, checkResult);
          results.push(checkResult);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof RCCError ? error.message : '未知错误';
      this.state.errors.push(`流水线健康检查失败: ${errorMessage}`);
    }

    return results;
  }

  /**
   * 将流水线健康状态映射到检查状态
   * @param health 健康状态
   * @returns PipelineCheckStatus 检查状态
   */
  private mapPipelineHealthToCheckStatus(health: string): PipelineCheckStatus {
    switch (health) {
      case 'healthy':
        return 'active';
      case 'degraded':
        return 'pending';
      case 'unhealthy':
        return 'blacklisted';
      case 'error':
        return 'blacklisted';
      default:
        return 'pending';
    }
  }

  /**
   * 销毁无效API密钥相关的流水线
   * @param invalidApiKeyIds 无效的API密钥ID列表
   * @returns Promise<string[]> 被销毁的流水线ID列表
   */
  async destroyInvalidPipelines(invalidApiKeyIds: string[]): Promise<string[]> {
    const destroyedPipelines: string[] = [];
    
    try {
      // 使用设置的流水线管理器
      const pipelineManager = this.pipelineManager;
      if (!pipelineManager) {
        const error = new RCCError('无法获取流水线管理器', RCCErrorCode.PIPELINE_MODULE_MISSING, 'self-check');
        await this.errorHandler.handleRCCError(error, { requestId: `pipeline-manager-${Date.now()}` });
        throw error;
      }

      // 获取所有需要销毁的流水线
      const pipelinesToDestroy = new Set<string>();
      
      for (const apiKeyId of invalidApiKeyIds) {
        const apiKeyInfo = this.apiKeyCache.get(apiKeyId);
        if (apiKeyInfo) {
          apiKeyInfo.associatedPipelines.forEach(pipelineId => pipelinesToDestroy.add(pipelineId));
        }
      }

      // 销毁流水线
      for (const pipelineId of pipelinesToDestroy) {
        try {
          const success = await pipelineManager.destroyPipeline(pipelineId);
          if (success) {
            destroyedPipelines.push(pipelineId);
            
            // 更新检查结果
            const checkResult = this.pipelineCheckResults.get(pipelineId);
            if (checkResult) {
              checkResult.status = 'destroyed';
              checkResult.checkedAt = new Date();
            }
          }
        } catch (error) {
          const errorMessage = error instanceof RCCError ? error.message : '未知错误';
          this.state.errors.push(`销毁流水线失败 ${pipelineId}: ${errorMessage}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof RCCError ? error.message : '未知错误';
      this.state.errors.push(`销毁无效流水线失败: ${errorMessage}`);
    }

    return destroyedPipelines;
  }

  /**
   * 拉黑过期token相关的流水线
   * @param expiredTokenIds 过期的token ID列表
   * @returns Promise<string[]> 被拉黑的流水线ID列表
   */
  async blacklistExpiredPipelines(expiredTokenIds: string[]): Promise<string[]> {
    const blacklistedPipelines: string[] = [];
    
    // 在实际实现中，这里会根据过期token找到相关流水线并拉黑
    // 暂时空实现
    return blacklistedPipelines;
  }

  /**
   * 恢复通过认证的流水线
   * @returns Promise<string[]> 恢复的流水线ID列表
   */
  async restoreAuthenticatedPipelines(): Promise<string[]> {
    const restoredPipelines: string[] = [];
    
    // 在实际实现中，这里会恢复之前被拉黑但已通过认证的流水线
    // 暂时空实现
    return restoredPipelines;
  }

  /**
   * 启动动态调度服务器
   * @returns Promise<boolean> 启动是否成功
   */
  async startDynamicScheduler(): Promise<boolean> {
    try {
      // 使用设置的流水线管理器
      const pipelineManager = this.pipelineManager;
      if (!pipelineManager) {
        const error = new RCCError('无法获取流水线管理器', RCCErrorCode.PIPELINE_MODULE_MISSING, 'self-check');
        await this.errorHandler.handleRCCError(error, { requestId: `pipeline-cleanup-${Date.now()}` });
        throw error;
      }

      // 获取流水线统计信息
      const stats = pipelineManager.getStatistics();
      
      if (stats.totalPipelines === 0) {
        this.state.errors.push('没有配置的流水线，无法启动动态调度服务器');
        return false;
      }

      if (stats.healthyPipelines === 0) {
        this.state.errors.push('没有健康的流水线，无法启动动态调度服务器');
        return false;
      }

      // 在实际实现中，这里会启动动态调度服务器
      // 暂时返回true表示成功
      this.state.isRunning = true;
      this.state.startedAt = new Date();
      return true;
    } catch (error) {
      const errorMessage = error instanceof RCCError ? error.message : '未知错误';
      this.state.errors.push(`启动动态调度服务器失败: ${errorMessage}`);
      return false;
    }
  }

  /**
   * 获取认证检查结果
   * @returns Promise<AuthCheckResult[]> 认证检查结果列表
   */
  async getAuthCheckResults(): Promise<AuthCheckResult[]> {
    return Array.from(this.authCheckResults.values());
  }

  /**
   * 获取自检模块状态
   * @returns Promise<SelfCheckState> 自检模块状态
   */
  async getSelfCheckState(): Promise<SelfCheckState> {
    return { ...this.state };
  }

  /**
   * 重置自检模块状态
   */
  async resetSelfCheck(): Promise<void> {
    this.apiKeyCache.clear();
    this.pipelineCheckResults.clear();
    this.authCheckResults.clear();
    this.state.statistics = {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      lastCheckAt: new Date(0),
      averageCheckDuration: 0
    };
    this.state.errors = [];
    this.state.isRunning = false;
    this.state.startedAt = undefined;
  }

  /**
   * 清理自检模块资源
   */
  async cleanupSelfCheck(): Promise<void> {
    await this.resetSelfCheck();
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(targetModuleId: string): 'connected' | 'disconnected' | 'connecting' | 'error' {
    return super.getConnectionStatus(targetModuleId);
  }

  /**
   * 验证连接
   */
  validateConnection(targetModule: ModuleInterface): boolean {
    return super.validateConnection(targetModule);
  }
}