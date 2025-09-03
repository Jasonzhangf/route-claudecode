/**
 * 统一配置管理器 - 基于Architecture Engineer设计
 * 
 * 核心特性：
 * 1. 统一配置大表设计 - 一张大表包含所有模块配置
 * 2. 各数据段不冲突的合并策略 - 智能分类和默认值处理
 * 3. 模块级访问控制 - 每个模块只访问自己的配置段
 * 4. Context传递配置 - 避免污染API数据
 * 
 * @author RCC v4.0 - 移植自Architecture Engineer
 * @version 4.0.0
 */

import { JQJsonHandler } from '../utils/jq-json-handler';
import { secureLogger } from '../utils/secure-logger';
import { getServerPort, getServerHost } from '../constants/server-defaults';

/**
 * 统一配置输出接口 - 配置大表
 */
export interface UnifiedConfigOutputs {
  readonly client: {
    readonly serverUrl: string;
    readonly timeout: number;
    readonly retryAttempts: number;
    readonly retryDelay: number;
    readonly maxConcurrency: number;
    readonly authentication: {
      readonly enabled: boolean;
      readonly type: string;
      readonly credentials: Record<string, any>;
    };
  };
  
  readonly router: {
    readonly routingStrategies: Record<string, string>;
    readonly routes: readonly any[];
    readonly routingRules: {
      readonly modelMapping: Record<string, string>;
      readonly defaultRoute: string;
    };
    readonly defaultStrategy: string;
    readonly healthCheckInterval: number;
    readonly maxRetries: number;
  };
  
  readonly pipeline: {
    readonly layers: readonly any[];
    readonly transformers: Record<string, any>;
    readonly processors: Record<string, any>;
    readonly middleware: readonly any[];
    readonly concurrency: number;
    readonly bufferSize: number;
  };
  
  readonly provider: {
    readonly providers: readonly any[];
    readonly serverCompatibilityProviders: Record<string, any>;
    readonly standardProviders: Record<string, any>;
    readonly models: Record<string, any>;
    readonly endpoints: Record<string, string>;
    readonly apiKeys: Record<string, string | string[]>;
    readonly protocolMappings: Record<string, string>;
  };
  
  readonly protocol: {
    readonly adapters: Record<string, any>;
    readonly mappings: Record<string, string>;
    readonly modelMappings: Record<string, string>;
    readonly timeouts: Record<string, number>;
    readonly maxRetries: Record<string, number>;
  };
  
  readonly serverCompatibility: {
    readonly providers: Record<string, any>;
    readonly configurations: Record<string, any>;
    readonly parameterLimits: Record<string, any>;
    readonly responseFixes: Record<string, any>;
  };
  
  readonly server: {
    readonly port: number;
    readonly host: string;
    readonly debug: boolean;
    readonly cors: Record<string, any>;
    readonly middleware: readonly any[];
  };
  
  readonly debug: {
    readonly enabled: boolean;
    readonly logLevel: string;
    readonly modules: Record<string, any>;
    readonly traceRequests: boolean;
    readonly saveRequests: boolean;
  };
  
  readonly errorHandler: {
    readonly hideInternalErrors: boolean;
    readonly sanitizeErrorMessages: boolean;
    readonly logFullErrors: boolean;
    readonly retryPolicy: Record<string, any>;
  };
}

/**
 * 原始配置输入结构（兼容现有格式）
 */
interface RawConfigInput {
  readonly providers?: readonly {
    readonly name: string;
    readonly api_base_url?: string;
    readonly api_key?: string | readonly string[];
    readonly baseURL?: string;
    readonly apiKey?: string | readonly string[];
    readonly models: readonly (string | { name: string; max_token: number })[];
    readonly weight?: number;
    readonly serverCompatibility?: string;
    readonly protocol?: string;
  }[];
  readonly router?: Record<string, string>;
  readonly server?: {
    readonly port?: number;
    readonly host?: string;
    readonly debug?: boolean;
  };
  readonly debug?: {
    readonly enabled?: boolean;
    readonly logLevel?: string;
  };
}

/**
 * 模块处理上下文 - 用于传递配置信息
 */
export interface ModuleProcessingContext {
  readonly requestId: string;
  readonly providerName?: string;
  readonly protocol?: string;
  readonly config?: {
    readonly endpoint?: string;
    readonly apiKey?: string;
    readonly timeout?: number;
    readonly maxRetries?: number;
    readonly actualModel?: string;
    readonly originalModel?: string;
    readonly serverCompatibility?: string;
  };
  readonly metadata?: Record<string, any>;
}

/**
 * 配置加载错误类
 */
class ConfigurationLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationLoadError';
  }
}

/**
 * 统一配置管理器
 */
export class UnifiedConfigManager {
  private readonly jqHandler: JQJsonHandler;
  private cachedConfig: UnifiedConfigOutputs | null = null;

  constructor() {
    this.jqHandler = new JQJsonHandler();
  }

  /**
   * 加载配置并生成统一配置大表
   */
  async loadConfiguration(configPath: string): Promise<UnifiedConfigOutputs> {
    secureLogger.info('🔧 开始加载统一配置', { configPath });

    try {
      // 1. 读取原始配置
      const rawConfig = JQJsonHandler.parseJsonFile<RawConfigInput>(configPath);
      
      // 2. 验证原始配置格式
      this.validateRawConfiguration(rawConfig);
      
      // 3. 转换为统一配置大表
      const unifiedConfig = this.transformToUnifiedConfiguration(rawConfig);
      
      // 4. 缓存配置
      this.cachedConfig = unifiedConfig;
      
      secureLogger.info('✅ 统一配置加载成功', {
        providersCount: unifiedConfig.provider.providers.length,
        routingRulesCount: Object.keys(unifiedConfig.router.routingRules.modelMapping).length,
        serverPort: unifiedConfig.server.port
      });
      
      return unifiedConfig;
      
    } catch (error) {
      secureLogger.error('❌ 统一配置加载失败', { 
        configPath,
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      throw new ConfigurationLoadError(`配置加载失败: ${(error as Error).message}`);
    }
  }

  /**
   * 获取特定模块的配置
   */
  getModuleConfiguration<K extends keyof UnifiedConfigOutputs>(
    moduleName: K
  ): UnifiedConfigOutputs[K] | null {
    if (!this.cachedConfig) {
      secureLogger.warn('⚠️ 尝试获取配置但缓存为空', { moduleName });
      return null;
    }
    
    return this.cachedConfig[moduleName];
  }

  /**
   * 生成模块处理上下文
   */
  createModuleContext(
    requestId: string, 
    providerName?: string,
    originalModel?: string
  ): ModuleProcessingContext {
    if (!this.cachedConfig) {
      throw new ConfigurationLoadError('配置未加载，无法创建模块上下文');
    }

    const provider = this.cachedConfig.provider.providers.find(p => p.name === providerName);
    const protocolConfig = this.cachedConfig.protocol;
    
    let actualModel = originalModel;
    if (originalModel && protocolConfig.modelMappings[originalModel]) {
      const mapping = protocolConfig.modelMappings[originalModel];
      if (mapping.includes(',')) {
        actualModel = mapping.split(',')[1]?.trim();
      }
    }

    return {
      requestId,
      providerName,
      protocol: provider?.protocol || protocolConfig.mappings[providerName || 'default'] || 'openai',
      config: {
        endpoint: provider?.api_base_url,
        apiKey: Array.isArray(provider?.api_key) ? provider.api_key[0] : provider?.api_key,
        timeout: protocolConfig.timeouts[providerName || 'default'] || 60000, // 增加默认超时至60秒
        maxRetries: protocolConfig.maxRetries[providerName || 'default'] || 3,
        actualModel,
        originalModel,
        serverCompatibility: provider?.serverCompatibility
      },
      metadata: {
        configVersion: '4.0.0',
        architecture: 'six-layer-enterprise'
      }
    };
  }

  /**
   * 验证原始配置格式
   */
  private validateRawConfiguration(config: RawConfigInput): void {
    if (!config.providers || !Array.isArray(config.providers)) {
      throw new ConfigurationLoadError('配置验证失败: providers 必须是数组');
    }
    
    for (const provider of config.providers) {
      // 支持多种字段命名方式（向后兼容）
      const apiKey = provider.apiKey || provider.api_key;
      const baseUrl = provider.baseURL || provider.api_base_url;
      
      if (!provider.name || !apiKey || !provider.models) {
        throw new ConfigurationLoadError(`Provider配置不完整: ${JQJsonHandler.stringifyJson(provider)}`);
      }
    }
  }

  /**
   * 转换为统一配置大表
   */
  private transformToUnifiedConfiguration(rawConfig: RawConfigInput): UnifiedConfigOutputs {
    const providers = rawConfig.providers || [];
    const routingRules = rawConfig.router || {};

    return {
      client: {
        serverUrl: 'http://localhost',
        timeout: 60000, // 增加超时至60秒
        retryAttempts: 3,
        retryDelay: 1000,
        maxConcurrency: 10,
        authentication: {
          enabled: true,
          type: 'apikey',
          credentials: {}
        }
      },
      
      router: {
        routingStrategies: routingRules,
        routes: Object.entries(routingRules).map(([type, route]) => ({
          id: type,
          pattern: route,
          enabled: true
        })),
        routingRules: {
          modelMapping: routingRules,
          defaultRoute: Object.values(routingRules)[0] || 'default,gpt-3.5-turbo'
        },
        defaultStrategy: 'direct',
        healthCheckInterval: 60000,
        maxRetries: 3
      },
      
      pipeline: {
        layers: [
          { name: 'router', order: 1 },
          { name: 'transformer', order: 2 },
          { name: 'protocol', order: 3 },
          { name: 'server-compatibility', order: 4 },
          { name: 'server', order: 5 },
          { name: 'response-transformer', order: 6 }
        ],
        transformers: this.extractTransformersConfig(providers),
        processors: this.extractProcessorsConfig(providers),
        middleware: [],
        concurrency: 5,
        bufferSize: 1024
      },
      
      provider: {
        providers: providers.map(p => ({
          ...p,
          // 标准化字段名
          api_base_url: p.api_base_url || p.baseURL,
          api_key: p.api_key || p.apiKey
        })),
        serverCompatibilityProviders: providers
          .filter(p => p.serverCompatibility)
          .reduce((acc, p) => ({ 
            ...acc, 
            [p.name]: {
              ...p,
              // 标准化字段名
              api_base_url: p.api_base_url || p.baseURL,
              api_key: p.api_key || p.apiKey
            }
          }), {}),
        standardProviders: providers
          .filter(p => !p.serverCompatibility)
          .reduce((acc, p) => ({ 
            ...acc, 
            [p.name]: {
              ...p,
              // 标准化字段名
              api_base_url: p.api_base_url || p.baseURL,
              api_key: p.api_key || p.apiKey
            }
          }), {}),
        models: providers.reduce((acc, p) => ({ 
          ...acc, 
          [p.name]: p.models.map(model => 
            typeof model === 'string' 
              ? { name: model, max_token: 131072 }
              : model
          )
        }), {}),
        endpoints: providers.reduce((acc, p) => ({ ...acc, [p.name]: p.api_base_url || p.baseURL }), {}),
        apiKeys: providers.reduce((acc, p) => ({ ...acc, [p.name]: p.api_key || p.apiKey }), {}),
        protocolMappings: providers.reduce((acc, p) => ({ ...acc, [p.name]: p.protocol || 'openai' }), {})
      },
      
      protocol: {
        adapters: providers.reduce((acc, p) => ({ 
          ...acc, 
          [p.name]: {
            type: p.protocol || 'openai',
            endpoint: p.api_base_url || p.baseURL,
            authentication: p.api_key || p.apiKey
          }
        }), {}),
        mappings: providers.reduce((acc, p) => ({ ...acc, [p.name]: p.protocol || 'openai' }), {}),
        modelMappings: routingRules,
        timeouts: providers.reduce((acc, p) => ({ ...acc, [p.name]: 60000 }), {}), // 默认超时增加至60秒
        maxRetries: providers.reduce((acc, p) => ({ ...acc, [p.name]: 3 }), {})
      },
      
      serverCompatibility: {
        providers: providers
          .filter(p => p.serverCompatibility)
          .reduce((acc, p) => ({ 
            ...acc, 
            [p.name]: {
              type: p.serverCompatibility,
              configuration: p
            }
          }), {}),
        configurations: {},
        parameterLimits: {},
        responseFixes: {}
      },
      
      server: {
        port: rawConfig.server?.port || getServerPort(),
        host: rawConfig.server?.host || getServerHost(),
        debug: rawConfig.server?.debug || false,
        cors: { enabled: true, origins: ['*'] },
        middleware: []
      },
      
      debug: {
        enabled: rawConfig.debug?.enabled || rawConfig.server?.debug || false,
        logLevel: rawConfig.debug?.logLevel || 'info',
        modules: {},
        traceRequests: false,
        saveRequests: false
      },
      
      errorHandler: {
        hideInternalErrors: true,
        sanitizeErrorMessages: true,
        logFullErrors: false,
        retryPolicy: { maxRetries: 3, retryDelay: 1000 }
      }
    };
  }

  /**
   * 提取transformers配置
   */
  private extractTransformersConfig(providers: readonly any[]): Record<string, any> {
    return providers.reduce((acc, p) => ({ 
      ...acc, 
      [p.name]: {
        type: p.protocol === 'anthropic' ? 'anthropic-to-openai' : 'passthrough',
        enabled: true
      }
    }), {});
  }

  /**
   * 提取processors配置
   */
  private extractProcessorsConfig(providers: readonly any[]): Record<string, any> {
    return providers.reduce((acc, p) => ({ 
      ...acc, 
      [p.name]: {
        serverCompatibility: p.serverCompatibility || 'passthrough',
        enabled: true
      }
    }), {});
  }

  /**
   * 获取完整配置
   */
  getFullConfiguration(): UnifiedConfigOutputs | null {
    return this.cachedConfig;
  }
}

/**
 * 默认统一配置管理器实例
 */
export const unifiedConfigManager = new UnifiedConfigManager();