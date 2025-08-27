/**
 * RCC v4.0 Configuration Manager
 *
 * 统一的配置管理接口，整合解析、验证、加载和转换功能
 *
 * @author Jason Zhang
 */

import { secureLogger } from '../utils/secure-logger';
import { JQJsonHandler } from '../utils/jq-json-handler';
import { ConfigReader, MergedConfig } from './config-reader';
import { ConfigValidator, ValidationRules } from './config-validator';
import { ConfigTransformer, EnvTransformOptions } from './config-transformer';
import { getServerPort, getServerHost } from '../constants/server-defaults';
import {
  RCCv4Config,
  ServerCompatibilityProvider,
  StandardProvider,
  RouteConfig,
  ConfigValidationResult,
  ConfigLoadOptions,
} from './config-types';
import { LoaderOptions } from '../interfaces/router/config-manager-interfaces';

// Simple type for backward compatibility
interface LoadResult {
  config?: any;
  loadTime?: number;
  success?: boolean;
  fromCache?: boolean;
}

/**
 * 配置管理器选项
 */
export interface ConfigManagerOptions {
  defaultConfigDir?: string;
  loaderOptions?: LoaderOptions;
  validationRules?: Partial<ValidationRules>;
  envTransformOptions?: EnvTransformOptions;
  autoReload?: boolean;
  enableMetrics?: boolean;
}

/**
 * 配置管理器统计信息
 */
export interface ConfigManagerStats {
  loadCount: number;
  reloadCount: number;
  cacheHitCount: number;
  cacheMissCount: number;
  validationFailureCount: number;
  lastLoadTime: Date | null;
  lastReloadTime: Date | null;
  currentConfigDir: string | null;
  cacheStats: { size: number; items: string[] };
}

/**
 * 配置更改事件
 */
export interface ConfigChangeEvent {
  type: 'loaded' | 'reloaded' | 'validated' | 'error';
  configDir: string;
  timestamp: Date;
  data?: any;
  error?: Error;
}

/**
 * 配置管理器
 */
export class ConfigManager {
  private configReader: ConfigReader;
  private validator: ConfigValidator;
  private transformer: ConfigTransformer;
  private currentConfig: RCCv4Config | null = null;
  private currentConfigDir: string | null = null;
  private options: ConfigManagerOptions;
  private stats: ConfigManagerStats;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(options: ConfigManagerOptions = {}) {
    this.options = {
      defaultConfigDir: 'config/v4',
      autoReload: false,
      enableMetrics: true,
      ...options,
    };

    this.configReader = new ConfigReader();
    this.validator = new ConfigValidator(this.options.validationRules);
    this.transformer = new ConfigTransformer();

    this.stats = {
      loadCount: 0,
      reloadCount: 0,
      cacheHitCount: 0,
      cacheMissCount: 0,
      validationFailureCount: 0,
      lastLoadTime: null,
      lastReloadTime: null,
      currentConfigDir: null,
      cacheStats: { size: 0, items: [] },
    };
  }

  /**
   * 初始化配置管理器
   */
  async initialize(): Promise<void> {
    // ConfigReader doesn't need initialization
    secureLogger.info('🔧 配置管理器已初始化');
  }

  /**
   * 加载配置
   */
  async loadConfig(configDir?: string, options?: ConfigLoadOptions): Promise<RCCv4Config> {
    const targetDir = configDir || this.options.defaultConfigDir!;
    secureLogger.info(`📂 加载配置: ${targetDir}`);

    try {
      const startTime = Date.now();
      const result = ConfigReader.loadConfig(targetDir, 'config/system-config.json');

      // 更新当前配置
      this.currentConfig = result as any; // Type assertion for now
      this.currentConfigDir = targetDir;

      // 更新统计信息
      if (this.options.enableMetrics) {
        this.updateLoadStats(result as any, startTime);
      }

      // 触发事件
      this.emitEvent('loaded', {
        type: 'loaded',
        configDir: targetDir,
        timestamp: new Date(),
        data: result,
      });

      secureLogger.info('✅ 配置加载成功', {
        configDir: targetDir,
        loadTime: Date.now() - startTime,
        fromCache: false, // ConfigReader doesn't use cache
      });

      return result as any; // MergedConfig is the result directly
    } catch (error) {
      secureLogger.error('❌ 配置加载失败', {
        configDir: targetDir,
        error: error.message,
      });

      // 触发错误事件
      this.emitEvent('error', {
        type: 'error',
        configDir: targetDir,
        timestamp: new Date(),
        error: error as Error,
      });

      throw error;
    }
  }

  /**
   * 重新加载配置
   */
  async reloadConfig(configDir?: string): Promise<RCCv4Config> {
    const targetDir = configDir || this.currentConfigDir || this.options.defaultConfigDir!;
    secureLogger.info(`🔄 重新加载配置: ${targetDir}`);

    try {
      const result = ConfigReader.loadConfig(targetDir, 'config/system-config.json');

      // 更新当前配置
      this.currentConfig = result as any;
      this.currentConfigDir = targetDir;

      // 更新统计信息
      if (this.options.enableMetrics) {
        this.stats.reloadCount++;
        this.stats.lastReloadTime = new Date();
        this.updateCacheStats();
      }

      // 触发事件
      this.emitEvent('reloaded', {
        type: 'reloaded',
        configDir: targetDir,
        timestamp: new Date(),
        data: result,
      });

      secureLogger.info('✅ 配置重新加载成功', {
        configDir: targetDir,
        loadTime: 'N/A', // ConfigReader doesn't track load time
      });

      return result as any;
    } catch (error) {
      secureLogger.error('❌ 配置重新加载失败', {
        configDir: targetDir,
        error: error.message,
      });

      // 触发错误事件
      this.emitEvent('error', {
        type: 'error',
        configDir: targetDir,
        timestamp: new Date(),
        error: error as Error,
      });

      throw error;
    }
  }

  /**
   * 获取当前配置
   */
  getCurrentConfig(): RCCv4Config | null {
    return this.currentConfig;
  }

  /**
   * 验证配置
   */
  async validateConfig(config?: RCCv4Config): Promise<ConfigValidationResult> {
    const targetConfig = config || this.currentConfig;

    if (!targetConfig) {
      throw new Error('No configuration available for validation');
    }

    secureLogger.debug('🔍 验证配置');

    try {
      const result = await this.validator.validate(targetConfig);

      // 更新统计信息
      if (this.options.enableMetrics) {
        if (!result.isValid) {
          this.stats.validationFailureCount++;
        }
      }

      // 触发事件
      this.emitEvent('validated', {
        type: 'validated',
        configDir: this.currentConfigDir || 'unknown',
        timestamp: new Date(),
        data: result,
      });

      return result;
    } catch (error) {
      secureLogger.error('❌ 配置验证失败', { error: error.message });

      if (this.options.enableMetrics) {
        this.stats.validationFailureCount++;
      }

      throw error;
    }
  }

  /**
   * 获取Provider配置
   */
  getProviderConfig(providerId: string): ServerCompatibilityProvider | StandardProvider | null {
    if (!this.currentConfig) {
      return null;
    }

    return (
      this.currentConfig.serverCompatibilityProviders[providerId] ||
      this.currentConfig.standardProviders[providerId] ||
      null
    );
  }

  /**
   * 获取启用的Provider列表
   */
  getEnabledProviders(): (ServerCompatibilityProvider | StandardProvider)[] {
    if (!this.currentConfig) {
      return [];
    }

    const providers: (ServerCompatibilityProvider | StandardProvider)[] = [];

    // 添加启用的Server-Compatibility Providers
    for (const provider of Object.values(this.currentConfig.serverCompatibilityProviders)) {
      if (provider.enabled) {
        providers.push(provider);
      }
    }

    // 添加启用的Standard Providers
    for (const provider of Object.values(this.currentConfig.standardProviders)) {
      if (provider.enabled) {
        providers.push(provider as StandardProvider);
      }
    }

    return providers;
  }

  /**
   * 获取路由配置
   */
  getRouteConfig(routeId: string): RouteConfig | null {
    if (!this.currentConfig) {
      return null;
    }

    return this.currentConfig.routing.routes.find(r => r.id === routeId) || null;
  }

  /**
   * 获取启用的路由列表
   */
  getEnabledRoutes(): RouteConfig[] {
    if (!this.currentConfig || !this.currentConfig.routing || !this.currentConfig.routing.routes) {
      return [];
    }

    return this.currentConfig.routing.routes.filter(r => r.enabled);
  }

  /**
   * 检查配置是否已加载
   */
  isConfigLoaded(): boolean {
    return this.currentConfig !== null;
  }

  /**
   * 获取配置版本
   */
  getConfigVersion(): string | null {
    return this.currentConfig?.version || null;
  }

  /**
   * 处理环境变量替换
   */
  async processEnvironmentVariables(config?: any): Promise<any> {
    const targetConfig = config || this.currentConfig;

    if (!targetConfig) {
      throw new Error('No configuration available for environment variable processing');
    }

    const result = await this.transformer.processEnvironmentVariables(targetConfig, this.options.envTransformOptions);

    if (result.errors.length > 0) {
      secureLogger.error('❌ 环境变量处理失败', { errors: result.errors });
      throw new Error(`Environment variable processing failed: ${result.errors.join(', ')}`);
    }

    if (result.warnings.length > 0) {
      secureLogger.warn('⚠️ 环境变量处理警告', { warnings: result.warnings });
    }

    return result.data;
  }

  /**
   * 清理敏感信息
   */
  sanitizeConfig(config?: RCCv4Config, sensitiveFields?: string[]): any {
    const targetConfig = config || this.currentConfig;

    if (!targetConfig) {
      throw new Error('No configuration available for sanitization');
    }

    return this.transformer.sanitizeConfig(targetConfig, sensitiveFields);
  }

  /**
   * 预加载配置
   */
  async preloadConfig(configDirs: string[]): Promise<void> {
    secureLogger.info(`📋 预加载 ${configDirs.length} 个配置目录`);

    // Simplified: ConfigReader doesn't need preloading
    const promises = configDirs.map(dir => Promise.resolve());
    await Promise.allSettled(promises);

    secureLogger.info('✅ 配置预加载完成');
  }

  /**
   * 验证配置目录结构
   */
  async validateConfigStructure(
    configDir?: string
  ): Promise<{ isValid: boolean; missing: string[]; issues: string[] }> {
    const targetDir = configDir || this.currentConfigDir || this.options.defaultConfigDir!;
    // Simplified validation - just check if config can be loaded
    try {
      ConfigReader.loadConfig(targetDir, 'config/system-config.json');
      return { isValid: true, missing: [], issues: [] };
    } catch (error) {
      return { isValid: false, missing: [], issues: [error.message] };
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): ConfigManagerStats {
    if (this.options.enableMetrics) {
      this.updateCacheStats();
    }

    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      loadCount: 0,
      reloadCount: 0,
      cacheHitCount: 0,
      cacheMissCount: 0,
      validationFailureCount: 0,
      lastLoadTime: null,
      lastReloadTime: null,
      currentConfigDir: this.currentConfigDir,
      cacheStats: { size: 0, items: [] },
    };

    secureLogger.debug('📊 统计信息已重置');
  }

  /**
   * 清除缓存
   */
  clearCache(configDir?: string): void {
    // ConfigReader doesn't use cache currently

    if (this.options.enableMetrics) {
      this.updateCacheStats();
    }

    secureLogger.debug('🧹 缓存已清除');
  }

  /**
   * 添加事件监听器
   */
  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }

    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * 移除事件监听器
   */
  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 触发事件
   */
  private emitEvent(event: string, data: ConfigChangeEvent): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          secureLogger.error('❌ 事件监听器执行失败', { event, error: error.message });
        }
      });
    }
  }

  /**
   * 更新加载统计信息
   */
  private updateLoadStats(result: LoadResult, startTime: number): void {
    this.stats.loadCount++;
    this.stats.lastLoadTime = new Date();
    this.stats.currentConfigDir = this.currentConfigDir;

    if (result.fromCache) {
      this.stats.cacheHitCount++;
    } else {
      this.stats.cacheMissCount++;
    }

    this.updateCacheStats();
  }

  /**
   * 更新缓存统计信息
   */
  private updateCacheStats(): void {
    // ConfigReader doesn't provide cache stats currently
    this.stats.cacheStats = { size: 0, items: [] };
  }

  /**
   * 获取流控制配置
   */
  async getFlowControlConfig(): Promise<any> {
    const config = this.getCurrentConfig();
    if (!config) {
      throw new Error('No configuration loaded');
    }

    // 返回默认的流控制配置
    return {
      maxSessionsPerClient: 100,
      maxConversationsPerSession: 50,
      maxRequestsPerConversation: 20,
      sessionTimeout: 30 * 60 * 1000, // 30分钟
      conversationTimeout: 10 * 60 * 1000, // 10分钟
      requestTimeout: 60 * 1000, // 60秒
      priorityWeights: {
        high: 100,
        medium: 50,
        low: 10,
      },
      cleanupInterval: 5 * 60 * 1000, // 5分钟清理一次
    };
  }

  /**
   * 获取客户端配置
   */
  async getClientConfig(): Promise<any> {
    const config = this.getCurrentConfig();
    if (!config) {
      throw new Error('No configuration loaded');
    }

    // 返回默认的客户端配置
    return {
      serverUrl: 'http://localhost:3456',
      timeout: 60000, // 增加默认超时至60秒
      retryAttempts: 3,
      retryDelay: 1000,
    };
  }

  /**
   * 获取Provider配置列表
   */
  async getProviderConfigs(): Promise<any[]> {
    const config = this.getCurrentConfig();
    if (!config) {
      return [];
    }

    const providers = [];

    // 添加Server-Compatibility Providers
    for (const [name, provider] of Object.entries(config.serverCompatibilityProviders || {})) {
      if (provider.enabled) {
        providers.push({
          name,
          type: 'server-compatibility',
          baseUrl: provider.endpoint,
          ...provider,
        });
      }
    }

    // 添加Standard Providers
    for (const [name, provider] of Object.entries(config.standardProviders || {})) {
      if (provider.enabled) {
        providers.push({
          name,
          type: 'standard',
          baseUrl: provider.endpoint,
          ...provider,
        });
      }
    }

    return providers;
  }

  /**
   * 更新配置
   */
  async updateConfig(configDir: string, updates: Partial<RCCv4Config>): Promise<void> {
    const currentConfig = await this.loadConfig(configDir);
    const mergedConfig = { ...currentConfig, ...updates };

    // 验证更新后的配置
    const validationResult = await this.validator.validate(mergedConfig);
    if (!validationResult.isValid) {
      throw new Error(`Configuration update validation failed: ${validationResult.errors.join(', ')}`);
    }

    // 这里应该保存配置到文件，但现在只更新内存中的配置
    this.currentConfig = mergedConfig;

    secureLogger.info('🔄 配置已更新', { configDir });
    this.emitEvent('updated', {
      type: 'loaded',
      configDir,
      timestamp: new Date(),
      data: mergedConfig,
    });
  }

  /**
   * 导出配置
   */
  async exportConfig(format: 'json' | 'yaml' = 'json'): Promise<string> {
    const config = this.getCurrentConfig();
    if (!config) {
      throw new Error('No configuration loaded to export');
    }

    if (format === 'json') {
      return JQJsonHandler.stringifyJson(config, false);
    } else {
      // 简单的YAML导出，实际应该使用yaml库
      return `# RCC v4.0 Configuration Export\n# Generated at: ${new Date().toISOString()}\n\n${JQJsonHandler.stringifyJson(config, false)}`;
    }
  }

  /**
   * 列出可用配置
   */
  async listConfigurations(): Promise<string[]> {
    // 返回默认配置目录列表
    return [
      'config/v4/single-provider/lmstudio-v4-5506.json',
      'config/v4/multi-provider/hybrid-v4-5507.json',
      'config/v4/examples/basic-setup.json',
    ];
  }

  /**
   * 重置为默认配置
   */
  async resetToDefaults(): Promise<void> {
    const defaultConfig: RCCv4Config = {
      version: '4.0',
      serverCompatibilityProviders: {},
      standardProviders: {},
      routing: {
        pipelineArchitecture: {
          layers: [],
          strictLayerEnforcement: true,
          allowCrossLayerCalls: false,
        },
        routingStrategies: {},
        routes: [],
        routingRules: {
          modelMapping: {},
          defaultRoute: 'lmstudio',
          routeSelectionCriteria: {
            primary: 'performance',
            secondary: 'availability',
            tertiary: 'cost',
          },
        },
        configuration: {
          strictErrorReporting: true,
          zeroFallbackPolicy: true,
          maxRetries: 3,
          requestTimeout: 300000, // 5分钟，支持长上下文处理
          healthCheckInterval: 60000,
          debug: false,
          monitoring: {
            enabled: false,
            metricsCollection: false,
            performanceTracking: false,
          },
        },
        validation: {
          enforceLayerOrder: true,
          validateModuleCompatibility: true,
          requireHealthyProviders: true,
          preventCrossLayerCalls: true,
        },
      },
      security: {
        encryption: {
          enabled: false,
          algorithm: 'aes-256-gcm',
          keyDerivation: {
            algorithm: 'pbkdf2',
            iterations: 100000,
            saltLength: 32,
            keyLength: 32,
          },
          encryptedFields: [],
        },
        keyManagement: {
          provider: 'env',
          masterKeyEnvVar: 'RCC_MASTER_KEY',
          keyRotation: {
            enabled: false,
            intervalDays: 30,
          },
        },
        authentication: {
          enabled: false,
          apiKey: {
            enabled: false,
            header: 'X-API-Key',
            prefix: 'rcc_',
            validation: {
              minLength: 32,
              pattern: '^rcc_[a-zA-Z0-9]{32}$',
            },
          },
          jwt: {
            enabled: false,
            secret: '',
            expiresIn: '1h',
            algorithm: 'HS256',
          },
        },
        authorization: {
          rbac: {
            enabled: false,
            roles: {},
          },
        },
        rateLimit: {
          enabled: false,
          global: {
            windowMs: 60000,
            maxRequests: 100,
          },
          perProvider: {
            windowMs: 60000,
            maxRequests: 50,
          },
          perIP: {
            windowMs: 60000,
            maxRequests: 20,
          },
        },
        inputValidation: {
          enabled: true,
          maxRequestSize: '10MB',
          allowedContentTypes: ['application/json'],
          sanitization: {
            enabled: true,
            removeScripts: true,
            trimWhitespace: true,
          },
          requestValidation: {
            maxMessageLength: 100000,
            maxMessagesCount: 100,
            allowedRoles: ['user', 'admin'],
          },
        },
        logging: {
          level: 'info',
          sensitiveFieldFiltering: {
            enabled: true,
            fields: ['password', 'apiKey', 'token'],
            replacement: '[REDACTED]',
          },
          auditLog: {
            enabled: false,
            events: ['login', 'logout', 'api-access'],
          },
        },
        headers: {
          security: {
            contentSecurityPolicy: "default-src 'self'",
            xFrameOptions: 'DENY',
            xContentTypeOptions: 'nosniff',
            referrerPolicy: 'no-referrer',
            permissionsPolicy: 'none',
          },
          cors: {
            enabled: true,
            origins: ['*'],
            methods: ['GET', 'POST'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: false,
          },
        },
        errorHandling: {
          hideInternalErrors: true,
          sanitizeErrorMessages: true,
          logFullErrors: false,
          genericErrorMessage: 'An error occurred while processing your request',
        },
        monitoring: {
          securityEvents: {
            enabled: false,
            alerting: {
              enabled: false,
              webhook: '',
            },
          },
          metricsCollection: {
            includeSecurityMetrics: false,
            anonymizeData: true,
          },
        },
        compliance: {
          dataRetention: {
            logRetentionDays: 365,
            configBackupRetentionDays: 90,
          },
          privacy: {
            anonymizeIPs: true,
            dataMinimization: true,
          },
        },
        development: {
          debugMode: false,
          allowInsecureConnections: false,
          testDataGeneration: false,
        },
        cors: {
          enabled: true,
          origins: ['*'],
          methods: ['GET', 'POST'],
          allowedHeaders: ['Content-Type', 'Authorization'],
          credentials: false,
        },
      },
      validation: {
        required: ['version', 'routing', 'security'],
        environmentVariables: {
          required: ['RCC_MASTER_KEY'],
          optional: ['RCC_DEBUG_MODE'],
        },
        enforceLayerOrder: true,
        validateModuleCompatibility: true,
        requireHealthyProviders: true,
        preventCrossLayerCalls: true,
      },
      server: {
        port: getServerPort(),
        host: getServerHost(),
        name: 'RCC-Server',
        environment: 'development',
      },
      debug: {
        enabled: false,
        logLevel: 'info',
        modules: {},
        traceRequests: false,
        saveRequests: false,
        enableRecording: false,
        enableAuditTrail: false,
        enableReplay: false,
        enablePerformanceMetrics: false,
      },
    };

    this.currentConfig = defaultConfig;
    secureLogger.info('🔄 配置已重置为默认值');

    this.emitEvent('reset', {
      type: 'loaded',
      configDir: 'defaults',
      timestamp: new Date(),
      data: defaultConfig,
    });
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    // ConfigReader doesn't need cleanup

    // 清除事件监听器
    this.eventListeners.clear();

    // 重置状态
    this.currentConfig = null;
    this.currentConfigDir = null;

    secureLogger.info('🧹 配置管理器已清理');
  }
}

/**
 * 全局配置管理器实例
 */
let globalConfigManager: ConfigManager | null = null;

/**
 * 获取全局配置管理器实例
 */
export function getConfigManager(options?: ConfigManagerOptions): ConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager(options);
  }
  return globalConfigManager;
}

/**
 * 设置全局配置管理器实例
 */
export function setConfigManager(manager: ConfigManager): void {
  globalConfigManager = manager;
}

/**
 * 清理全局配置管理器
 */
export function cleanupGlobalConfigManager(): void {
  if (globalConfigManager) {
    globalConfigManager.cleanup();
    globalConfigManager = null;
  }
}
