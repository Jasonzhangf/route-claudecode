/**
 * 标准化路由系统配置格式 v3.1.0
 * 
 * 完全分离Provider List和Routing Table
 * 支持动态流水线管理和多密钥扩展
 * 
 * @author Jason Zhang
 * @version v3.1.0
 */

/**
 * Provider认证配置
 */
export interface ProviderAuthentication {
  type: 'bearer' | 'api-key' | 'oauth' | 'none';
  credentials: {
    apiKeys?: string[];        // 支持多密钥列表
    apiKey?: string;          // 单密钥格式（会自动转换为数组）
    tokens?: string[];        // OAuth令牌列表
    token?: string;          // 单令牌格式
    clientId?: string;       // OAuth客户端ID
    clientSecret?: string;   // OAuth客户端密钥
  };
}

/**
 * Provider健康检查配置
 */
export interface ProviderHealthCheck {
  enabled: boolean;
  model: string;             // 用于健康检查的模型
  timeout: number;           // 健康检查超时时间(ms)
  interval?: number;         // 健康检查间隔(ms)
  retryCount?: number;       // 失败重试次数
}

/**
 * Provider重试配置
 */
export interface ProviderRetryConfig {
  maxRetries: number;
  delayMs: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
}

/**
 * Provider配置 - Provider List中的单个Provider
 */
export interface ProviderConfig {
  // 🎯 核心身份信息
  type: 'openai' | 'anthropic' | 'gemini' | 'codewhisperer';  // 强制要求，无默认值
  endpoint: string;
  
  // 🔐 认证配置
  authentication: ProviderAuthentication;
  
  // 📋 模型列表和配置
  models: string[];                                          // 该Provider支持的所有模型
  defaultModel?: string;                                     // 默认模型
  maxTokens: Record<string, number>;                        // 每个模型的token限制
  
  // ⚙️ 运行时配置
  timeout: number;
  retry: ProviderRetryConfig;
  healthCheck: ProviderHealthCheck;
  
  // 📊 元数据
  description?: string;
  priority?: number;                                         // Provider优先级
  tags?: string[];                                          // Provider标签
  lastFetched?: string;                                     // 最后获取模型时间
  fetchStats?: ProviderFetchStats;                          // Fetch统计信息
  
  // 🚫 黑名单配置
  blacklist?: string[];                                     // 被禁用的模型列表
}

/**
 * Provider Fetch统计信息
 */
export interface ProviderFetchStats {
  totalModels: number;
  blacklistFiltered: number;
  autoFilteredByTokens: number;
  testedModels: number;
  lastTest: {
    tokenSize: string;
    timestamp: string;
  };
}

/**
 * 路由类别定义
 */
export type RoutingCategory = 'default' | 'background' | 'thinking' | 'longcontext' | 'search';

/**
 * 单个路由目标 - provider.model 格式
 */
export interface RoutingTarget {
  provider: string;        // Provider ID
  model: string;          // 该Provider内的模型名
  weight?: number;        // 负载均衡权重
}

/**
 * 单类别路由配置
 */
export interface CategoryRouting {
  // 🎯 主要路由目标
  primary: RoutingTarget;
  
  // 🔄 备份路由列表（可选）
  backups?: RoutingTarget[];
  
  // ⚖️ 负载均衡配置
  loadBalancing?: {
    strategy: 'round-robin' | 'weighted' | 'health-based';
    enableFailover: boolean;
    maxFailures: number;
    failoverCooldownMs: number;
  };
}

/**
 * Routing Table - 路由表配置
 */
export interface RoutingTable {
  strategy: 'category-driven' | 'model-based' | 'user-defined';
  categories: Record<RoutingCategory, CategoryRouting>;
  
  // 🔄 全局路由配置
  globalSettings?: {
    enableMultiKeyExpansion: boolean;
    defaultCategory: RoutingCategory;
    fallbackProvider?: string;
    rateLimiting?: {
      enabled: boolean;
      requestsPerMinute: number;
      burstLimit: number;
    };
  };
}

/**
 * 流水线实例配置
 */
export interface PipelineInstance {
  id: string;                                              // 流水线唯一ID
  providerId: string;                                      // 关联的Provider ID
  model: string;                                          // 模型名称
  status: 'initializing' | 'healthy' | 'degraded' | 'failed' | 'shutdown';
  thread?: string;                                        // 线程ID（如果适用）
  
  // 📊 运行时统计
  stats: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTime: number;
    lastHealthCheck: string;
  };
}

/**
 * 标准化配置文件格式 v3.1.0
 */
export interface StandardRouterConfig {
  // 📋 配置元数据
  configVersion: 'v3.1.0';
  architecture: 'v3.1-dynamic-pipeline';
  
  // 🌐 服务器配置
  server: {
    port: number;
    host: string;
    name: string;
  };
  
  // 🏗️ 核心配置：Provider List + Routing Table 完全分离
  providers: Record<string, ProviderConfig>;              // Provider List
  routing: RoutingTable;                                  // Routing Table
  
  // 🔧 六层架构配置
  sixLayerArchitecture: {
    client: {
      acceptAnthropicFormat: boolean;
      supportStreaming: boolean;
    };
    router: {
      strategy: string;
      multiInstance: {
        enabled: boolean;
        maxInstancesPerProvider: number;
        keyRotation: {
          strategy: string;
          cooldownMs: number;
          maxRetriesPerKey: number;
          rateLimitCooldownMs: number;
        };
      };
      failoverThreshold: number;
      healthCheckInterval: number;
    };
    postProcessor: {
      type: string;
      streamingSupport: boolean;
    };
    transformer: {
      type: string;
      bidirectional: boolean;
      features: string[];
    };
    providerProtocol: {
      type: string;
      [key: string]: any;
    };
    preprocessor: {
      type: string;
      mode: string;
      features: string[];
    };
  };
  
  // 🔍 调试和监控配置
  debug: {
    enabled: boolean;
    logLevel: string;
    traceRequests: boolean;
    saveRequests: boolean;
    enableRecording: boolean;
    enableAuditTrail: boolean;
    enableReplay: boolean;
    enablePerformanceMetrics: boolean;
    logDir: string;
  };
  
  // 📊 回放系统配置
  replaySystem: {
    enabled: boolean;
    captureAllLayers: boolean;
    databasePath: string;
    dataRetentionDays: number;
  };
  
  // 📝 元数据
  metadata: {
    version: string;
    createdAt: string;
    createdBy: string;
    description: string;
    architecture: string;
  };
  
  // 🪝 钩子配置
  hooks: any[];
  
  // 🔧 预处理配置
  preprocessing?: {
    enabled: boolean;
    autoDetection: {
      enabled: boolean;
      geminiSpecific: boolean;
      openaiCompatible: boolean;
    };
  };
}

/**
 * 配置验证错误
 */
export class ConfigValidationError extends Error {
  constructor(message: string, public field?: string, public value?: any) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * 配置验证器
 */
export class StandardConfigValidator {
  /**
   * 验证完整配置
   */
  static validate(config: any): StandardRouterConfig {
    // 1. 基本结构验证
    if (!config.configVersion || config.configVersion !== 'v3.1.0') {
      throw new ConfigValidationError('Invalid or missing configVersion. Expected: v3.1.0');
    }
    
    if (!config.providers || typeof config.providers !== 'object') {
      throw new ConfigValidationError('Invalid or missing providers configuration');
    }
    
    if (!config.routing || typeof config.routing !== 'object') {
      throw new ConfigValidationError('Invalid or missing routing configuration');
    }
    
    // 2. 验证Provider List
    this.validateProviderList(config.providers);
    
    // 3. 验证Routing Table
    this.validateRoutingTable(config.routing, config.providers);
    
    // 4. 自动补充默认maxTokens
    this.applyDefaultMaxTokens(config.providers);
    
    // 5. 扩展多密钥Provider
    this.expandMultiKeyProviders(config);
    
    return config as StandardRouterConfig;
  }
  
  /**
   * 验证Provider List
   */
  private static validateProviderList(providers: Record<string, any>): void {
    for (const [providerId, provider] of Object.entries(providers)) {
      // 验证必需字段
      if (!provider.type) {
        throw new ConfigValidationError(`Provider ${providerId} missing required 'type' field`);
      }
      
      if (!['openai', 'anthropic', 'gemini', 'codewhisperer'].includes(provider.type)) {
        throw new ConfigValidationError(`Provider ${providerId} has invalid type: ${provider.type}`);
      }
      
      if (!provider.endpoint) {
        throw new ConfigValidationError(`Provider ${providerId} missing required 'endpoint' field`);
      }
      
      if (!provider.models || !Array.isArray(provider.models) || provider.models.length === 0) {
        throw new ConfigValidationError(`Provider ${providerId} missing or empty 'models' array`);
      }
      
      if (!provider.authentication || !provider.authentication.credentials) {
        throw new ConfigValidationError(`Provider ${providerId} missing authentication configuration`);
      }
    }
  }
  
  /**
   * 验证Routing Table
   */
  private static validateRoutingTable(routing: any, providers: Record<string, any>): void {
    if (!routing.categories || typeof routing.categories !== 'object') {
      throw new ConfigValidationError('Routing table missing categories configuration');
    }
    
    for (const [category, categoryConfig] of Object.entries(routing.categories)) {
      const config = categoryConfig as any;
      
      // 验证primary路由
      if (!config.primary || !config.primary.provider || !config.primary.model) {
        throw new ConfigValidationError(`Category ${category} missing or invalid primary routing target`);
      }
      
      // 验证provider存在性
      if (!providers[config.primary.provider]) {
        throw new ConfigValidationError(`Category ${category} references non-existent provider: ${config.primary.provider}`);
      }
      
      // 验证模型存在性
      const provider = providers[config.primary.provider];
      if (!provider.models.includes(config.primary.model)) {
        throw new ConfigValidationError(`Category ${category} references non-existent model ${config.primary.model} in provider ${config.primary.provider}`);
      }
      
      // 验证backup路由（如果存在）
      if (config.backups && Array.isArray(config.backups)) {
        for (const backup of config.backups) {
          if (!backup.provider || !backup.model) {
            throw new ConfigValidationError(`Category ${category} has invalid backup routing target`);
          }
          
          if (!providers[backup.provider]) {
            throw new ConfigValidationError(`Category ${category} backup references non-existent provider: ${backup.provider}`);
          }
          
          const backupProvider = providers[backup.provider];
          if (!backupProvider.models.includes(backup.model)) {
            throw new ConfigValidationError(`Category ${category} backup references non-existent model ${backup.model} in provider ${backup.provider}`);
          }
        }
      }
    }
  }
  
  /**
   * 自动补充默认maxTokens配置
   */
  private static applyDefaultMaxTokens(providers: Record<string, any>): void {
    for (const [providerId, provider] of Object.entries(providers)) {
      if (!provider.maxTokens) {
        provider.maxTokens = {};
      }
      
      // 为每个模型补充默认的128K token限制
      for (const model of provider.models) {
        if (!provider.maxTokens[model]) {
          provider.maxTokens[model] = 131072; // 128K tokens
        }
      }
    }
  }
  
  /**
   * 扩展多密钥Provider
   */
  private static expandMultiKeyProviders(config: any): void {
    const originalProviders = { ...config.providers };
    
    for (const [providerId, provider] of Object.entries(originalProviders)) {
      const providerConfig = provider as any;
      const credentials = providerConfig.authentication?.credentials;
      
      // 检查是否有多个API密钥
      let apiKeys: string[] = [];
      
      if (credentials.apiKeys && Array.isArray(credentials.apiKeys)) {
        apiKeys = credentials.apiKeys;
      } else if (credentials.apiKey) {
        apiKeys = [credentials.apiKey];
      } else if (credentials.tokens && Array.isArray(credentials.tokens)) {
        apiKeys = credentials.tokens;
      } else if (credentials.token) {
        apiKeys = [credentials.token];
      }
      
      // 如果有多个密钥，创建多个Provider实例
      if (apiKeys.length > 1) {
        // 删除原始Provider
        delete config.providers[providerId];
        
        // 为每个密钥创建独立的Provider实例
        apiKeys.forEach((key, index) => {
          const expandedProviderId = `${providerId}-key${index + 1}`;
          const expandedProvider = {
            ...providerConfig,
            authentication: {
              ...providerConfig.authentication,
              credentials: {
                ...credentials,
                apiKeys: [key],
                apiKey: key // 保持兼容性
              }
            }
          };
          
          config.providers[expandedProviderId] = expandedProvider;
        });
        
        // 更新路由表以使用第一个扩展的Provider
        this.updateRoutingForExpandedProvider(config.routing, providerId, `${providerId}-key1`);
      }
    }
  }
  
  /**
   * 更新路由表以使用扩展的Provider
   */
  private static updateRoutingForExpandedProvider(routing: any, originalProviderId: string, newProviderId: string): void {
    if (!routing.categories) return;
    
    for (const category of Object.values(routing.categories)) {
      const categoryConfig = category as any;
      
      // 更新primary路由
      if (categoryConfig.primary?.provider === originalProviderId) {
        categoryConfig.primary.provider = newProviderId;
      }
      
      // 更新backup路由
      if (categoryConfig.backups && Array.isArray(categoryConfig.backups)) {
        for (const backup of categoryConfig.backups) {
          if (backup.provider === originalProviderId) {
            backup.provider = newProviderId;
          }
        }
      }
    }
  }
}

/**
 * 配置转换器 - 将旧格式转换为新格式
 */
export class ConfigurationMigrator {
  /**
   * 从v3.0.x迁移到v3.1.0
   */
  static migrateFromV3_0(oldConfig: any): StandardRouterConfig {
    const newConfig: any = {
      configVersion: 'v3.1.0',
      architecture: 'v3.1-dynamic-pipeline',
      server: oldConfig.server,
      providers: {},
      routing: {
        strategy: 'category-driven',
        categories: {},
        globalSettings: {
          enableMultiKeyExpansion: true,
          defaultCategory: 'default' as RoutingCategory
        }
      },
      sixLayerArchitecture: oldConfig.sixLayerArchitecture,
      debug: oldConfig.debug,
      replaySystem: oldConfig.replaySystem,
      metadata: {
        ...oldConfig.metadata,
        version: 'v3.1.0',
        architecture: 'v3.1-dynamic-pipeline'
      },
      hooks: oldConfig.hooks || [],
      preprocessing: oldConfig.preprocessing
    };
    
    // 迁移Provider List
    for (const [providerId, provider] of Object.entries(oldConfig.providers)) {
      newConfig.providers[providerId] = this.migrateProviderConfig(provider as any);
    }
    
    // 迁移Routing Table
    if (oldConfig.routing && oldConfig.routing.categories) {
      for (const [category, categoryConfig] of Object.entries(oldConfig.routing.categories)) {
        newConfig.routing.categories[category] = this.migrateCategoryRouting(categoryConfig as any);
      }
    }
    
    return StandardConfigValidator.validate(newConfig);
  }
  
  /**
   * 迁移单个Provider配置
   */
  private static migrateProviderConfig(oldProvider: any): ProviderConfig {
    return {
      type: oldProvider.type,
      endpoint: oldProvider.endpoint,
      authentication: oldProvider.authentication,
      models: oldProvider.models || [],
      defaultModel: oldProvider.defaultModel,
      maxTokens: oldProvider.maxTokens || {},
      timeout: oldProvider.timeout || 120000,
      retry: oldProvider.retry || {
        maxRetries: 3,
        delayMs: 2000
      },
      healthCheck: {
        enabled: true,
        model: oldProvider.healthCheck?.model || oldProvider.defaultModel || oldProvider.models[0],
        timeout: oldProvider.healthCheck?.timeout || 15000
      },
      description: oldProvider.description,
      priority: oldProvider.priority || 1,
      blacklist: oldProvider.blacklist || [],
      lastFetched: oldProvider.lastFetched,
      fetchStats: oldProvider.fetchStats
    };
  }
  
  /**
   * 迁移单个类别路由配置
   */
  private static migrateCategoryRouting(oldCategory: any): CategoryRouting {
    const result: CategoryRouting = {
      primary: {
        provider: oldCategory.provider,
        model: oldCategory.model
      }
    };
    
    // 迁移备份路由
    if (oldCategory.backups && Array.isArray(oldCategory.backups)) {
      result.backups = oldCategory.backups.map((backup: any) => ({
        provider: backup.provider,
        model: backup.model,
        weight: backup.weight
      }));
    }
    
    // 添加默认负载均衡配置
    result.loadBalancing = {
      strategy: 'round-robin',
      enableFailover: true,
      maxFailures: 3,
      failoverCooldownMs: 60000
    };
    
    return result;
  }
}