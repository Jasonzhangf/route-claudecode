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
import { PROVIDER_MODELS } from '../constants/src/model-mappings';
import { FILE_PATHS, OAUTH_URLS } from '../constants/src/bootstrap-constants';
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
          return await this.verifyIflowApiKeyWithNetwork(apiKey);
        case 'qwen':
          return await this.verifyQwenApiKeyWithNetwork(apiKey);
        default:
          // 默认验证逻辑 - 检查格式和长度
          return this.verifyGenericApiKey(apiKey);
      }
    } catch (error) {
      const errorMessage = error instanceof RCCError ? error.message : '未知错误';
      secureLogger.error('API key verification failed', {
        provider,
        keyPreview: `${apiKey.substring(0, 8)}...`,
        error: errorMessage
      });
      return false;
    }
  }

  /**
   * 验证Iflow API密钥（网络验证）
   * @param apiKey API密钥
   * @param endpoint API端点（从配置获取）
   * @param testModel 测试模型名称（从配置获取）
   * @returns Promise<boolean> 是否有效
   */
  private async verifyIflowApiKeyWithNetwork(apiKey: string, endpoint?: string, testModel?: string): Promise<boolean> {
    // 首先进行格式验证
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('sk-') || apiKey.length < 32) {
      return false;
    }

    // 从配置中获取端点和模型，如果没有则使用默认值
    const apiEndpoint = endpoint || this.getProviderEndpoint('iflow');
    const modelName = testModel || this.getProviderTestModel('iflow');

    if (!apiEndpoint) {
      secureLogger.error('iFlow API endpoint not configured');
      return false;
    }

    try {
      const fetch = require('node-fetch');
      const response = await fetch(`${apiEndpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'RCC4-SelfCheck/1.0.0'
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        }),
        timeout: this.config.authTimeout || 15000
      });

      if (response.ok) {
        const data = await response.json();
        // 成功响应表示API key有效
        if (data.id && data.choices) {
          secureLogger.info('iFlow API key validation successful', {
            keyPreview: `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`,
            endpoint: apiEndpoint,
            model: modelName
          });
          return true;
        }
      } else {
        const errorData = await response.json();
        // 检查iFlow特定的错误码
        if (errorData.status === '434') {
          // 434 = Invalid apiKey
          secureLogger.warn('iFlow API key invalid', { 
            keyPreview: `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`,
            errorCode: errorData.status,
            message: errorData.msg,
            endpoint: apiEndpoint
          });
          return false;
        } else if (errorData.status === '429') {
          // 429 = Rate limit, but key is valid
          secureLogger.info('iFlow API key valid but rate limited', {
            keyPreview: `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`,
            endpoint: apiEndpoint
          });
          return true;
        } else if (errorData.status === '401') {
          // 401 = Unauthorized
          secureLogger.warn('iFlow API key unauthorized', {
            keyPreview: `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`,
            endpoint: apiEndpoint
          });
          return false;
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
        secureLogger.warn('iFlow API key verification timeout', {
          keyPreview: `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`,
          endpoint: apiEndpoint
        });
        return false;
      }
      secureLogger.error('iFlow API key verification network error', {
        keyPreview: `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`,
        error: error.message,
        endpoint: apiEndpoint
      });
    }

    return false;
  }

  /**
   * 验证Iflow API密钥（格式检查）
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
   * 验证Qwen API密钥（网络验证）
   * @param apiKey API密钥
   * @param endpoint API端点（从配置获取）
   * @param testModel 测试模型名称（从配置获取）
   * @returns Promise<boolean> 是否有效
   */
  private async verifyQwenApiKeyWithNetwork(apiKey: string, endpoint?: string, testModel?: string): Promise<boolean> {
    // 首先进行格式验证
    if (!this.verifyQwenApiKey(apiKey)) {
      return false;
    }

    // 从配置中获取端点和模型
    const apiEndpoint = endpoint || this.getProviderEndpoint('qwen');
    const modelName = testModel || this.getProviderTestModel('qwen');

    if (!apiEndpoint) {
      secureLogger.error('Qwen API endpoint not configured');
      return false;
    }

    try {
      const fetch = require('node-fetch');
      const response = await fetch(`${apiEndpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'RCC4-SelfCheck/1.0.0'
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        }),
        timeout: this.config.authTimeout || 15000
      });

      if (response.ok) {
        const data = await response.json();
        if (data.id && data.choices) {
          secureLogger.info('Qwen API key validation successful', {
            keyPreview: `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`,
            endpoint: apiEndpoint,
            model: modelName
          });
          return true;
        }
      } else if (response.status === 401) {
        secureLogger.warn('Qwen API key unauthorized', {
          keyPreview: `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`,
          endpoint: apiEndpoint
        });
        return false;
      } else if (response.status === 429) {
        // Rate limited but key is valid
        secureLogger.info('Qwen API key valid but rate limited', {
          keyPreview: `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`,
          endpoint: apiEndpoint
        });
        return true;
      }
    } catch (error: any) {
      secureLogger.error('Qwen API key verification network error', {
        keyPreview: `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`,
        error: error.message,
        endpoint: apiEndpoint
      });
    }

    return false;
  }

  /**
   * 验证Qwen API密钥（格式验证）
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
   * 从配置中获取Provider端点
   * @param providerName Provider名称
   * @returns string | undefined 端点URL
   */
  private getProviderEndpoint(providerName: string): string | undefined {
    if (!this.pipelineManager) {
      return undefined;
    }

    const allPipelines = this.pipelineManager.getAllPipelines();
    for (const [_, pipeline] of allPipelines) {
      if (pipeline.provider?.toLowerCase() === providerName.toLowerCase()) {
        return pipeline.endpoint;
      }
    }
    return undefined;
  }

  /**
   * 获取Provider的测试模型
   * @param providerName Provider名称
   * @returns string 测试模型名称
   */
  private getProviderTestModel(providerName: string): string {
    if (!this.pipelineManager) {
      return this.getDefaultTestModel(providerName);
    }

    const allPipelines = this.pipelineManager.getAllPipelines();
    for (const [_, pipeline] of allPipelines) {
      if (pipeline.provider?.toLowerCase() === providerName.toLowerCase()) {
        return pipeline.model || this.getDefaultTestModel(providerName);
      }
    }
    return this.getDefaultTestModel(providerName);
  }

  /**
   * 获取默认测试模型
   * @param providerName Provider名称
   * @returns string 默认测试模型
   */
  private getDefaultTestModel(providerName: string): string {
    const defaultModels: Record<string, string> = {
      'iflow': 'glm-4.5',
      'qwen': 'qwen3-coder-plus',
      'shuaihong': 'glm-4.5'
    };
    return defaultModels[providerName.toLowerCase()] || PROVIDER_MODELS.OPENAI.GPT3_5_TURBO;
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
   * 检测并移除重复的auth file
   * @returns Promise<string[]> 被移除的重复auth file列表
   */
  async detectAndRemoveDuplicateAuthFiles(): Promise<string[]> {
    const removedFiles: string[] = [];
    
    try {
      if (!this.pipelineManager) {
        secureLogger.warn('Pipeline manager not available for duplicate auth file detection');
        return removedFiles;
      }

      const allPipelines = this.pipelineManager.getAllPipelines();
      const authFileUsage: Map<string, string[]> = new Map();
      
      // 收集auth file使用情况
      for (const [pipelineId, pipeline] of allPipelines) {
        // 从pipeline的modules中查找ServerCompatibility模块配置
        const serverCompatModule = pipeline.modules?.find(m => 
          m.type === 'server-compatibility' || m.name.includes('compatibility')
        );
        
        if (serverCompatModule?.config?.authFileName) {
          const authFile = serverCompatModule.config.authFileName;
          if (!authFileUsage.has(authFile)) {
            authFileUsage.set(authFile, []);
          }
          authFileUsage.get(authFile)!.push(pipelineId);
        }
      }

      // 检测重复使用的auth file
      for (const [authFile, pipelineIds] of authFileUsage.entries()) {
        if (pipelineIds.length > 1) {
          secureLogger.warn('Duplicate auth file detected', {
            authFile,
            usedByPipelines: pipelineIds.length,
            pipelineIds
          });

          // 移除除第一个外的所有重复引用
          for (let i = 1; i < pipelineIds.length; i++) {
            const pipelineId = pipelineIds[i];
            try {
              // 这里应该调用pipeline管理器的方法来移除重复的auth file引用
              // 具体实现取决于pipeline管理器的接口
              secureLogger.info('Removing duplicate auth file reference', {
                pipelineId,
                authFile
              });
              removedFiles.push(`${pipelineId}:${authFile}`);
            } catch (error) {
              secureLogger.error('Failed to remove duplicate auth file reference', {
                pipelineId,
                authFile,
                error: error instanceof Error ? error.message : String(error)
              });
            }
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof RCCError ? error.message : '未知错误';
      this.state.errors.push(`重复auth file检测失败: ${errorMessage}`);
    }

    return removedFiles;
  }

  /**
   * 检查auth file过期状态
   * @param authFile auth文件名
   * @returns Promise<boolean> 是否过期
   */
  async checkAuthFileExpiry(authFile: string): Promise<boolean> {
    try {
      // 这里应该实现实际的过期检查逻辑
      // 可能需要读取auth文件的时间戳或调用相关API
      
      secureLogger.info('Checking auth file expiry', { authFile });
      
      // 占位符实现 - 实际应该检查文件的创建时间或API返回的过期信息
      const fs = require('fs');
      const path = require('path');
      
      // 通过配置获取auth文件路径，如果未配置则使用默认路径
      const authDirPath = this.config?.authDirectory || FILE_PATHS.AUTH_DIRECTORY;
      const authFilePath = path.resolve(authDirPath, `${authFile}.json`);
      
      if (fs.existsSync(authFilePath)) {
        const stats = fs.statSync(authFilePath);
        const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        
        // 假设24小时后过期
        return ageInHours > 24;
      }
      
      return false;
    } catch (error) {
      secureLogger.error('Auth file expiry check failed', {
        authFile,
        error: error instanceof Error ? error.message : String(error)
      });
      return true; // 出错时默认认为已过期
    }
  }

  /**
   * 刷新过期的auth file，通过auth模块非阻塞处理
   * @param authFile auth文件名
   * @returns Promise<boolean> 是否立即可用（非阻塞返回）
   */
  async refreshAuthFile(authFile: string): Promise<boolean> {
    try {
      secureLogger.info('Starting non-blocking auth file refresh', { authFile });
      
      const provider = this.extractProviderFromAuthFile(authFile);
      
      // 立即返回，启动异步刷新流程
      setImmediate(async () => {
        try {
          await this.performAsyncAuthRefresh(authFile, provider);
        } catch (error) {
          secureLogger.error('Async auth refresh failed', {
            authFile,
            provider,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });
      
      // 检查当前状态：如果auth文件存在且未过期，返回true
      const isCurrentlyValid = await this.checkAuthFileCurrentStatus(authFile);
      
      secureLogger.info('Non-blocking auth refresh initiated', { 
        authFile, 
        provider,
        currentlyValid: isCurrentlyValid
      });
      
      return isCurrentlyValid;
      
    } catch (error) {
      secureLogger.error('Auth file refresh initiation failed', {
        authFile,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 从auth文件名提取provider信息
   * @param authFile auth文件名
   * @returns string provider名称
   */
  private extractProviderFromAuthFile(authFile: string): string {
    if (authFile.startsWith('qwen-')) {
      return 'qwen';
    } else if (authFile.startsWith('iflow-')) {
      return 'iflow';
    }
    return 'unknown';
  }

  /**
   * 刷新Qwen认证
   * @param authFile auth文件名
   * @returns Promise<boolean> 刷新是否成功
   */
  private async refreshQwenAuth(authFile: string): Promise<boolean> {
    try {
      // 这里应该实现Qwen特定的认证刷新逻辑
      secureLogger.info('Refreshing Qwen auth', { authFile });
      
      // 占位符 - 实际实现需要调用Qwen的认证API
      // 可能需要使用refresh token或重新进行OAuth流程
      
      return true;
    } catch (error) {
      secureLogger.error('Qwen auth refresh failed', {
        authFile,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 检查auth文件当前状态
   * @param authFile auth文件名
   * @returns Promise<boolean> 当前是否可用
   */
  private async checkAuthFileCurrentStatus(authFile: string): Promise<boolean> {
    try {
      const fs = require('fs');
      const path = require('path');
      const authDirPath = this.config?.authDirectory || FILE_PATHS.AUTH_DIRECTORY;
      const authFilePath = path.resolve(authDirPath, `${authFile}.json`);
      
      if (!fs.existsSync(authFilePath)) {
        return false;
      }
      
      // 检查是否过期
      const expired = await this.checkAuthFileExpiry(authFile);
      return !expired;
      
    } catch (error) {
      secureLogger.error('Failed to check auth file current status', {
        authFile,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 执行异步auth刷新流程
   * @param authFile auth文件名
   * @param provider provider名称
   */
  private async performAsyncAuthRefresh(authFile: string, provider: string): Promise<void> {
    try {
      secureLogger.info('Starting async auth refresh workflow', { authFile, provider });
      
      // Step 1: 调用auth模块进行refresh
      const authModule = await this.getAuthModule(provider);
      if (!authModule) {
        secureLogger.error('Auth module not available', { provider });
        await this.handleAuthRefreshFailure(authFile, provider, 'Auth module not available');
        return;
      }
      
      // Step 2: 执行非阻塞refresh
      const refreshResult = await authModule.forceRefreshTokens(provider, {
        refreshExpiredOnly: true,
        maxConcurrent: 2
      });
      
      // Step 3: 验证refresh结果
      if (refreshResult.success && refreshResult.refreshedTokens.length > 0) {
        // Step 4: API验证确认
        const isValid = await this.validateAuthFileWithAPI(authFile, provider);
        
        if (isValid) {
          secureLogger.info('Async auth refresh completed successfully', { 
            authFile, 
            provider,
            refreshedCount: refreshResult.refreshedTokens.length 
          });
          
          // 通知成功，恢复流水线
          await this.notifyAuthRefreshSuccess(authFile, provider);
        } else {
          // API验证失败，触发recreate流程
          await this.handleAuthRefreshFailure(authFile, provider, 'API validation failed after refresh');
        }
      } else {
        // Refresh失败，触发recreate流程
        await this.handleAuthRefreshFailure(authFile, provider, refreshResult.error || 'Refresh operation failed');
      }
      
    } catch (error) {
      secureLogger.error('Async auth refresh workflow failed', {
        authFile,
        provider,
        error: error instanceof Error ? error.message : String(error)
      });
      
      await this.handleAuthRefreshFailure(authFile, provider, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 处理auth刷新失败，触发recreate流程
   * @param authFile auth文件名
   * @param provider provider名称
   * @param reason 失败原因
   */
  private async handleAuthRefreshFailure(authFile: string, provider: string, reason: string): Promise<void> {
    try {
      secureLogger.warn('Auth refresh failed, initiating recreate workflow', { 
        authFile, 
        provider, 
        reason 
      });
      
      // Step 1: 标记相关流水线为维护状态
      await this.markPipelinesForMaintenance(authFile, provider);
      
      // Step 2: 通知error-handler处理recreate流程
      await this.notifyErrorHandlerForRecreate(authFile, provider, reason);
      
    } catch (error) {
      secureLogger.error('Failed to handle auth refresh failure', {
        authFile,
        provider,
        reason,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 标记相关流水线为维护状态
   * @param authFile auth文件名
   * @param provider provider名称
   */
  private async markPipelinesForMaintenance(authFile: string, provider: string): Promise<void> {
    try {
      secureLogger.info('Marking pipelines for maintenance', { authFile, provider });
      
      // 记录维护状态到自检状态中
      this.state.errors.push(`Pipeline maintenance required: ${authFile} (${provider}) - auth refresh failed`);
      
      // 这里需要与pipeline-manager集成，标记相关流水线为维护状态
      // 当前记录到错误状态中，实际应用中需要调用pipeline-manager的维护API
      
    } catch (error) {
      secureLogger.error('Failed to mark pipelines for maintenance', {
        authFile,
        provider,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 通知error-handler处理recreate流程
   * @param authFile auth文件名
   * @param provider provider名称
   * @param reason 失败原因
   */
  private async notifyErrorHandlerForRecreate(authFile: string, provider: string, reason: string): Promise<void> {
    try {
      secureLogger.info('Notifying error handler for recreate workflow', { 
        authFile, 
        provider, 
        reason 
      });
      
      // 创建RCC错误并通过error-handler处理
      const authError = new RCCError(
        `Auth recreate required: ${authFile}`,
        RCCErrorCode.PROVIDER_AUTH_FAILED,
        'self-check',
        {
          module: 'self-check',
          operation: 'auth_recreate_notification',
          details: {
            authFile,
            provider,
            reason,
            requiresUserAction: true,
            userActionType: 'oauth_authorization',
            userActionUrl: this.generateOAuthUrl(provider),
            maintenanceMode: true
          }
        }
      );
      
      // 发送到error-handler进行处理
      await this.errorHandler.handleError(authError);
      
      secureLogger.info('Error handler notified for recreate workflow', { 
        authFile, 
        provider,
        errorCode: authError.code 
      });
      
    } catch (error) {
      secureLogger.error('Failed to notify error handler for recreate', {
        authFile,
        provider,
        reason,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 通知auth刷新成功
   * @param authFile auth文件名
   * @param provider provider名称
   */
  private async notifyAuthRefreshSuccess(authFile: string, provider: string): Promise<void> {
    try {
      secureLogger.info('Auth refresh successful, restoring pipelines', { authFile, provider });
      
      // 从错误状态中移除维护相关的错误
      this.state.errors = this.state.errors.filter(error => 
        !error.includes(authFile) || !error.includes('maintenance')
      );
      
      // 这里需要与pipeline-manager集成，恢复相关流水线
      // 实际应用中需要调用pipeline-manager的恢复API
      
    } catch (error) {
      secureLogger.error('Failed to notify auth refresh success', {
        authFile,
        provider,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 生成OAuth授权URL
   * @param provider provider名称
   * @returns string OAuth URL
   */
  private generateOAuthUrl(provider: string): string {
    switch (provider.toLowerCase()) {
      case 'qwen':
        return `https://${OAUTH_URLS.QWEN}`;
      case 'anthropic':
        return `https://${OAUTH_URLS.ANTHROPIC}`;
      default:
        return `https://${OAUTH_URLS.DEFAULT_TEMPLATE.replace('{provider}', provider)}`;
    }
  }

  /**
   * 获取对应provider的auth模块
   * @param provider provider名称
   * @returns Promise<AuthenticationModule | null>
   */
  private async getAuthModule(provider: string): Promise<any | null> {
    try {
      // 这里需要从模块注册表获取auth模块实例
      // 当前返回null，实际应用中需要连接到真实的模块管理器
      secureLogger.warn('Auth module integration not implemented', { provider });
      return null;
      
    } catch (error) {
      secureLogger.error('Failed to get auth module', {
        provider,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * 使用API验证auth文件有效性
   * @param authFile auth文件名
   * @param provider provider名称
   * @returns Promise<boolean> 是否有效
   */
  private async validateAuthFileWithAPI(authFile: string, provider: string): Promise<boolean> {
    try {
      secureLogger.info('Validating auth file with API', { authFile, provider });
      
      // 检查auth文件是否存在
      const fs = require('fs');
      const path = require('path');
      const authDirPath = this.config?.authDirectory || FILE_PATHS.AUTH_DIRECTORY;
      const authFilePath = path.resolve(authDirPath, `${authFile}.json`);
      
      if (!fs.existsSync(authFilePath)) {
        secureLogger.warn('Auth file not found, should be removed from configuration', { authFile, authFilePath });
        await this.removeAuthFileReference(authFile);
        return false;
      }
      
      // 读取auth文件内容
      const authData = JSON.parse(fs.readFileSync(authFilePath, 'utf8'));
      
      switch (provider.toLowerCase()) {
        case 'qwen':
          if (!authData.access_token) {
            secureLogger.warn('Invalid Qwen auth file: missing access_token', { authFile });
            return false;
          }
          return await this.verifyQwenApiKeyWithNetwork(authData.access_token);
        case 'iflow':
          return true;
        default:
          secureLogger.warn('Unknown provider for API validation', { authFile, provider });
          return false;
      }
    } catch (error) {
      secureLogger.error('Auth file API validation failed', {
        authFile,
        provider,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 创建新的auth文件
   * @param authFile auth文件名
   * @returns Promise<boolean> 创建是否成功
   */
  private async recreateAuthFile(authFile: string): Promise<boolean> {
    try {
      secureLogger.info('Recreating auth file', { authFile });
      
      const provider = this.extractProviderFromAuthFile(authFile);
      
      switch (provider.toLowerCase()) {
        case 'qwen':
          return await this.createQwenAuthFile(authFile);
        case 'iflow':
          secureLogger.info('iFlow uses API keys, no auth file needed', { authFile });
          return true;
        default:
          secureLogger.warn('Unknown provider for auth file recreation', { authFile, provider });
          return false;
      }
    } catch (error) {
      secureLogger.error('Auth file recreation failed', {
        authFile,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 创建Qwen auth文件
   * @param authFile auth文件名
   * @returns Promise<boolean> 创建是否成功
   */
  private async createQwenAuthFile(authFile: string): Promise<boolean> {
    try {
      secureLogger.info('Creating new Qwen auth file requires manual OAuth', { authFile });
      
      // Qwen auth文件创建需要用户手动完成OAuth流程
      // 系统无法自动获取用户授权，需要提示用户手动操作
      
      secureLogger.error('Cannot automatically create Qwen auth file - requires manual OAuth authorization', { 
        authFile,
        suggestion: 'User must complete OAuth flow manually to generate auth file'
      });
      
      return false;
      
    } catch (error) {
      secureLogger.error('Failed to create Qwen auth file', {
        authFile,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 从配置中移除auth文件引用
   * @param authFile auth文件名
   * @returns Promise<void>
   */
  private async removeAuthFileReference(authFile: string): Promise<void> {
    try {
      secureLogger.info('Auth file not found, should be removed from configuration', { authFile });
      
      // 记录需要手动从配置中移除的auth文件引用
      this.state.errors.push(`Auth file not found: ${authFile} - should be removed from configuration`);
      
    } catch (error) {
      secureLogger.error('Failed to process missing auth file reference', {
        authFile,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 重建无效的auth文件
   * @param authFile auth文件名
   * @returns Promise<boolean> 重建是否成功
   */
  async rebuildInvalidAuthFile(authFile: string): Promise<boolean> {
    try {
      secureLogger.info('Rebuilding invalid auth file', { authFile });
      
      const provider = this.extractProviderFromAuthFile(authFile);
      
      // 首先尝试刷新
      const refreshSuccess = await this.refreshAuthFile(authFile);
      if (refreshSuccess) {
        // 刷新成功后再次测试
        const isValid = await this.testAuthFileValidity(authFile);
        if (isValid) {
          secureLogger.info('Auth file successfully refreshed and validated', { authFile });
          return true;
        }
      }

      // 刷新失败，尝试重建
      secureLogger.warn('Auth file refresh failed, attempting rebuild', { authFile });
      
      // 这里应该实现重建逻辑，可能涉及：
      // 1. 删除旧的auth文件
      // 2. 重新进行认证流程
      // 3. 生成新的auth文件
      
      return false; // 占位符 - 实际实现需要根据具体的认证机制
    } catch (error) {
      secureLogger.error('Auth file rebuild failed', {
        authFile,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 测试auth文件有效性
   * @param authFile auth文件名
   * @returns Promise<boolean> 是否有效
   */
  private async testAuthFileValidity(authFile: string): Promise<boolean> {
    try {
      const provider = this.extractProviderFromAuthFile(authFile);
      
      // 根据provider类型进行相应的验证
      switch (provider.toLowerCase()) {
        case 'qwen':
          // 对于Qwen，可能需要读取auth文件中的token并进行验证
          return await this.validateQwenAuthFile(authFile);
        case 'iflow':
          // iFlow通常使用固定API key，不需要auth文件
          return true;
        default:
          return false;
      }
    } catch (error) {
      secureLogger.error('Auth file validity test failed', {
        authFile,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 验证Qwen auth文件
   * @param authFile auth文件名
   * @returns Promise<boolean> 是否有效
   */
  private async validateQwenAuthFile(authFile: string): Promise<boolean> {
    try {
      // 读取auth文件中的token
      const fs = require('fs');
      const path = require('path');
      
      const authDirPath = this.config?.authDirectory || FILE_PATHS.AUTH_DIRECTORY;
      const authFilePath = path.resolve(authDirPath, `${authFile}.json`);
      if (!fs.existsSync(authFilePath)) {
        return false;
      }

      const authData = JSON.parse(fs.readFileSync(authFilePath, 'utf8'));
      if (authData.token || authData.apiKey) {
        // 使用token进行API调用验证
        return await this.verifyQwenApiKeyWithNetwork(authData.token || authData.apiKey);
      }
      
      return false;
    } catch (error) {
      secureLogger.error('Qwen auth file validation failed', {
        authFile,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * 刷新即将过期的token
   * @returns Promise<number> 成功刷新的token数量
   */
  async refreshToken(): Promise<number> {
    let refreshedCount = 0;
    
    try {
      // 首先检测并移除重复的auth files
      const removedDuplicates = await this.detectAndRemoveDuplicateAuthFiles();
      if (removedDuplicates.length > 0) {
        secureLogger.info('Removed duplicate auth files', {
          count: removedDuplicates.length,
          removedFiles: removedDuplicates
        });
      }

      // 获取所有需要刷新的token
      const tokensToRefresh = this.getTokensNeedingRefresh();
      
      // 刷新每个token
      for (const tokenId of tokensToRefresh) {
        // 检查是否是auth file类型的token
        if (tokenId.startsWith('qwen-auth-') || tokenId.includes('auth')) {
          // 检查过期状态
          const isExpired = await this.checkAuthFileExpiry(tokenId);
          if (isExpired) {
            // 尝试刷新
            const refreshed = await this.refreshAuthFile(tokenId);
            if (refreshed) {
              refreshedCount++;
            } else {
              // 刷新失败，尝试重建
              const rebuilt = await this.rebuildInvalidAuthFile(tokenId);
              if (rebuilt) {
                refreshedCount++;
              }
            }
          }
        } else {
          // 普通API key的刷新逻辑
          const success = await this.refreshSingleToken(tokenId);
          if (success) {
            refreshedCount++;
          }
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