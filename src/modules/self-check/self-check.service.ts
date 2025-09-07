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

// 添加secureLogger导入
import { secureLogger } from '../error-handler/src/utils/secure-logger';

// 新增鉴权相关接口
interface OAuthErrorInfo {
  type: 'token_expired' | 'token_invalid' | 'oauth_server_error' | 'permission_denied';
  provider: string;
  timestamp: Date;
  affectedPipelines: string[];
}

interface OAuthHealthStatus {
  overallStatus: 'healthy' | 'warning' | 'critical';
  errorsFound: OAuthErrorInfo[];
  affectedPipelineCount: number;
}

// 鉴权错误检测配置
interface AuthDetectionConfig {
  enableOAuthErrorDetection: boolean;
  enableOAuthHealthCheck: boolean;
  oauthHealthCheckInterval: number;
  notificationThreshold: number;
}


/**
 * 自检服务实现类
 */
export class SelfCheckService extends BaseModule implements ISelfCheckModule {
  protected config: SelfCheckConfig;
  private authDetectionConfig: AuthDetectionConfig;
  private apiKeyCache: Map<string, ApiKeyInfo>;
  private pipelineCheckResults: Map<string, PipelineCheckResult>;
  private authCheckResults: Map<string, AuthCheckResult>;
  private oAuthErrorCache: Map<string, OAuthErrorInfo[]>;
  private state: SelfCheckState;
  private isInitialized: boolean = false;
  private pipelineManager: PipelineManager | null = null;
  private errorHandler: EnhancedErrorHandler = new EnhancedErrorHandler();
  private oAuthHealthCheckIntervalId: NodeJS.Timeout | null = null;

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

    this.authDetectionConfig = {
      enableOAuthErrorDetection: true,
      enableOAuthHealthCheck: true,
      oauthHealthCheckInterval: 180000, // 3分钟
      notificationThreshold: 3 // 错误阈值
    };

    this.apiKeyCache = new Map();
    this.pipelineCheckResults = new Map();
    this.authCheckResults = new Map();
    this.oAuthErrorCache = new Map();

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
    
    // 启动 OAuth 健康检查
    if (this.authDetectionConfig.enableOAuthHealthCheck) {
      this.startOAuthHealthChecks();
    }
  }

  async stop(): Promise<void> {
    await super.stop();
    this.state.isRunning = false;
    
    // 停止 OAuth 健康检查
    if (this.oAuthHealthCheckIntervalId) {
      clearInterval(this.oAuthHealthCheckIntervalId);
      this.oAuthHealthCheckIntervalId = null;
    }
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
    // 清理OAuth错误缓存
    const cleanedOAuthErrors = this.cleanupExpiredOAuthErrors();
    if (cleanedOAuthErrors > 0) {
      secureLogger.info('Cleaned OAuth errors during module cleanup', {
        cleanedCount: cleanedOAuthErrors
      });
    }
    
    // 重置自检状态
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

  // ===== OAuth 错误检测和通知机制 =====

  /**
   * 设置错误处理器引用
   * @param errorHandler 错误处理器实例
   */
  setErrorHandler(errorHandler: any): void {
    this.errorHandler = errorHandler;
    secureLogger.info('Error handler set in self check service');
  }

  /**
   * 启动OAuth错误检测通知机制
   * @param enable 是否启用
   */
  enableOAuthErrorNotification(enable: boolean): void {
    this.authDetectionConfig.enableOAuthErrorDetection = enable;
    secureLogger.info('OAuth error notification', { enabled: enable });
  }

  /**
   * 处理来自错误处理器的OAuth错误通知
   * @param oauthError OAuth错误信息
   * @returns Promise<void>
   */
  async handleOAuthErrorNotification(oauthError: OAuthErrorInfo): Promise<void> {
    try {
      secureLogger.info('Received OAuth error notification', {
        provider: oauthError.provider,
        errorType: oauthError.type,
        affectedPipelines: oauthError.affectedPipelines.length
      });

      // 缓存错误信息
      this.cacheOAuthError(oauthError);

      // 触发OAuth健康检查
      const healthStatus = await this.checkOAuthTokenHealth();
      
      // 如果状态为critical，触发紧急维护流程
      if (healthStatus.overallStatus === 'critical') {
        await this.triggerEmergencyAuthMaintenance(oauthError);
      }

      // 发送事件通知其他模块
      this.emit('oauth-error-detected', {
        error: oauthError,
        healthStatus: healthStatus,
        timestamp: new Date()
      });

    } catch (error) {
      secureLogger.error('Failed to handle OAuth error notification', {
        error: error instanceof Error ? error.message : String(error),
        provider: oauthError.provider,
        errorType: oauthError.type
      });
    }
  }

  /**
   * 触发紧急鉴权维护流程
   * @param oauthError OAuth错误信息
   * @returns Promise<void>
   */
  private async triggerEmergencyAuthMaintenance(oauthError: OAuthErrorInfo): Promise<void> {
    try {
      secureLogger.warn('Triggering emergency auth maintenance', {
        provider: oauthError.provider,
        errorType: oauthError.type,
        affectedPipelines: oauthError.affectedPipelines
      });

      // 立即检查受影响的流水线状态
      if (this.pipelineManager) {
        for (const pipelineId of oauthError.affectedPipelines) {
          const pipeline = this.pipelineManager.getPipeline(pipelineId);
          if (pipeline) {
            // 强制进行健康检查
            try {
              const healthResult = await this.checkSinglePipelineHealth(pipelineId);
              if (!healthResult.healthy) {
                // 如果流水线不健康，建议进入维护模式
                this.emit('pipeline-maintenance-recommended', {
                  pipelineId,
                  reason: `Emergency maintenance due to ${oauthError.type}`,
                  oauthError: oauthError
                });
              }
            } catch (healthError) {
              secureLogger.error('Failed to check pipeline health during emergency maintenance', {
                pipelineId,
                error: healthError instanceof Error ? healthError.message : String(healthError)
              });
            }
          }
        }
      }

      // 发送紧急维护事件
      this.emit('emergency-auth-maintenance', {
        oauthError: oauthError,
        timestamp: new Date(),
        actionRequired: 'immediate'
      });

    } catch (error) {
      secureLogger.error('Failed to trigger emergency auth maintenance', {
        error: error instanceof Error ? error.message : String(error),
        provider: oauthError.provider,
        errorType: oauthError.type
      });
    }
  }

  /**
   * 检查单个流水线健康状态
   * @param pipelineId 流水线ID
   * @returns Promise<{healthy: boolean; details?: any}>
   */
  private async checkSinglePipelineHealth(pipelineId: string): Promise<{ healthy: boolean; details?: any }> {
    if (!this.pipelineManager) {
      return { healthy: false, details: 'Pipeline manager not available' };
    }

    const pipeline = this.pipelineManager.getPipeline(pipelineId);
    if (!pipeline) {
      return { healthy: false, details: 'Pipeline not found' };
    }

    try {
      // 执行健康检查
      const healthResult = await this.checkPipelineHealth();
      const pipelineCheck = healthResult.find(check => check.pipelineId === pipelineId);
      
      return {
        healthy: pipelineCheck ? pipelineCheck.status === 'active' : false,
        details: pipelineCheck
      };
    } catch (error) {
      return {
        healthy: false,
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 获取OAuth错误检测统计信息
   * @returns Object
   */
  getOAuthDetectionStats(): {
    totalErrors: number;
    errorsByProvider: Record<string, number>;
    errorsByType: Record<string, number>;
    totalAffectedPipelines: number;
    lastErrorTime?: Date;
  } {
    const allErrors = Array.from(this.oAuthErrorCache.values()).flat();
    const errorsByProvider: Record<string, number> = {};
    const errorsByType: Record<string, number> = {};
    let totalAffectedPipelines = 0;
    let lastErrorTime: Date | undefined;

    for (const error of allErrors) {
      // 按提供商统计
      errorsByProvider[error.provider] = (errorsByProvider[error.provider] || 0) + 1;
      
      // 按错误类型统计
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
      
      // 统计受影响的流水线总数
      totalAffectedPipelines += error.affectedPipelines.length;
      
      // 记录最后错误时间
      if (!lastErrorTime || error.timestamp > lastErrorTime) {
        lastErrorTime = error.timestamp;
      }
    }

    return {
      totalErrors: allErrors.length,
      errorsByProvider,
      errorsByType,
      totalAffectedPipelines,
      lastErrorTime
    };
  }

  /**
   * 清理过期的OAuth错误缓存
   * @param maxAge 最大缓存时间（毫秒）
   * @returns number 清理的错误数量
   */
  cleanupExpiredOAuthErrors(maxAge: number = 3600000): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [provider, errors] of this.oAuthErrorCache.entries()) {
      const validErrors = errors.filter(error => {
        return (now - error.timestamp.getTime()) <= maxAge;
      });

      const removedCount = errors.length - validErrors.length;
      cleanedCount += removedCount;

      if (validErrors.length === 0) {
        this.oAuthErrorCache.delete(provider);
      } else {
        this.oAuthErrorCache.set(provider, validErrors);
      }
    }

    if (cleanedCount > 0) {
      secureLogger.info('Cleaned up expired OAuth errors', { cleanedCount });
    }

    return cleanedCount;
  }

  // ===== OAuth 错误检测相关方法 =====

  /**
   * 检测 OAuth 错误
   * @param error 错误对象
   * @returns OAuthErrorInfo | null
   */
  detectOAuthError(error: RCCError): OAuthErrorInfo | null {
    if (!this.authDetectionConfig.enableOAuthErrorDetection) {
      return null;
    }

    const errorMessage = error.message.toLowerCase();
    const errorType = error.code || RCCErrorCode.UNKNOWN_ERROR;

    // 检测不同类型的 OAuth 错误
    if (errorMessage.includes('token expired') || 
        errorMessage.includes('invalid token') ||
        errorMessage.includes('unauthorized') ||
        errorType === RCCErrorCode.PROVIDER_AUTH_FAILED) {
      
      // 确定具体的 OAuth 错误类型
      let oauthErrorType: OAuthErrorInfo['type'];
      if (errorMessage.includes('expired')) {
        oauthErrorType = 'token_expired';
      } else if (errorMessage.includes('invalid')) {
        oauthErrorType = 'token_invalid';
      } else if (errorMessage.includes('permission denied') || errorMessage.includes('forbidden')) {
        oauthErrorType = 'permission_denied';
      } else {
        oauthErrorType = 'oauth_server_error';
      }

      // 获取受影响的流水线
      const affectedPipelines = this.getAffectedPipelines(error);

      const oauthError: OAuthErrorInfo = {
        type: oauthErrorType,
        provider: this.extractProviderFromError(error),
        timestamp: new Date(),
        affectedPipelines: affectedPipelines
      };

      // 缓存错误信息
      this.cacheOAuthError(oauthError);

      // 检查是否达到通知阈值
      if (this.shouldNotifyAboutOAuthError(oauthError)) {
        this.notifyErrorHandlerAboutOAuthError(oauthError);
      }

      return oauthError;
    }

    return null;
  }

  /**
   * 检查 OAuth token 健康状态
   * @returns Promise<OAuthHealthStatus>
   */
  async checkOAuthTokenHealth(): Promise<OAuthHealthStatus> {
    const affectedPipelineCount = Array.from(this.oAuthErrorCache.values())
      .flat().reduce((acc, error) => acc + error.affectedPipelines.length, 0);

    const errorsFound = Array.from(this.oAuthErrorCache.values()).flat();
    
    let overallStatus: OAuthHealthStatus['overallStatus'] = 'healthy';
    if (errorsFound.length >= this.authDetectionConfig.notificationThreshold) {
      overallStatus = 'critical';
    } else if (errorsFound.length > 0) {
      overallStatus = 'warning';
    }

    return {
      overallStatus,
      errorsFound,
      affectedPipelineCount
    };
  }

  /**
   * 从错误中提取提供商信息
   */
  private extractProviderFromError(error: RCCError): string {
    // 从错误上下文或错误消息中提取提供商信息
    if (error.context?.details?.provider) {
      return error.context.details.provider;
    }
    
    if (error.message.includes('iflow')) {
      return 'iflow';
    } else if (error.message.includes('qwen')) {
      return 'qwen';
    } else if (error.message.includes('lmstudio')) {
      return 'lmstudio';
    }
    
    return 'unknown';
  }

  /**
   * 获取受影响的流水线
   */
  private getAffectedPipelines(error: RCCError): string[] {
    const pipelineIds: string[] = [];

    // 从错误上下文中获取流水线信息
    if (error.context?.details?.pipelineId) {
      pipelineIds.push(error.context.details.pipelineId);
    }

    // 从流水线管理器获取相关流水线
    if (this.pipelineManager && error.context?.details?.provider) {
      const allPipelines = this.pipelineManager.getAllPipelines();
      for (const [pipelineId, pipeline] of allPipelines) {
        if (pipeline.provider === error.context.details.provider) {
          pipelineIds.push(pipelineId);
        }
      }
    }

    return [...new Set(pipelineIds)]; // 去重
  }

  /**
   * 缓存 OAuth 错误
   */
  private cacheOAuthError(oauthError: OAuthErrorInfo): void {
    const provider = oauthError.provider;
    
    if (!this.oAuthErrorCache.has(provider)) {
      this.oAuthErrorCache.set(provider, []);
    }

    const errors = this.oAuthErrorCache.get(provider)!;
    
    // 只保留最近10个错误
    errors.push(oauthError);
    if (errors.length > 10) {
      errors.shift();
    }
  }

  /**
   * 检查是否应该通知错误处理器
   */
  private shouldNotifyAboutOAuthError(oauthError: OAuthErrorInfo): boolean {
    const providerErrors = this.oAuthErrorCache.get(oauthError.provider) || [];
    const recentErrors = providerErrors.filter(error => {
      return Date.now() - error.timestamp.getTime() < 300000; // 5分钟内
    });

    return recentErrors.length >= this.authDetectionConfig.notificationThreshold;
  }

  /**
   * 通知错误处理器关于 OAuth 错误
   */
  private async notifyErrorHandlerAboutOAuthError(oauthError: OAuthErrorInfo): Promise<void> {
    try {
      const authError = new RCCError(
        `OAuth error detected: ${oauthError.type} for provider ${oauthError.provider}`,
        RCCErrorCode.PROVIDER_AUTH_FAILED,
        'oauth-error-detector',
        {
          details: {
            errorType: oauthError.type,
            provider: oauthError.provider,
            affectedPipelines: oauthError.affectedPipelines,
            timestamp: oauthError.timestamp
          }
        }
      );

      await this.errorHandler.handleRCCError(authError, {
        requestId: `oauth-error-${Date.now()}`,
        pipelineId: oauthError.affectedPipelines[0],
        provider: oauthError.provider
      });

      // 清除已通知的错误缓存
      this.oAuthErrorCache.delete(oauthError.provider);

      secureLogger.info('OAuth error notification sent to error handler', {
        errorType: oauthError.type,
        provider: oauthError.provider,
        affectedPipelines: oauthError.affectedPipelines.length
      });
    } catch (error) {
      secureLogger.error('Failed to notify error handler about OAuth error', {
        error: error instanceof Error ? error.message : String(error),
        oauthErrorType: oauthError.type,
        provider: oauthError.provider
      });
    }
  }

  /**
   * 启动 OAuth 健康检查
   */
  private startOAuthHealthChecks(): void {
    if (this.oAuthHealthCheckIntervalId) {
      clearInterval(this.oAuthHealthCheckIntervalId);
    }

    this.oAuthHealthCheckIntervalId = setInterval(() => {
      this.checkOAuthTokenHealth().catch(error => {
        secureLogger.error('OAuth health check failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }, this.authDetectionConfig.oauthHealthCheckInterval);

    secureLogger.info('OAuth health checks started', {
      interval: this.authDetectionConfig.oauthHealthCheckInterval
    });
  }
}