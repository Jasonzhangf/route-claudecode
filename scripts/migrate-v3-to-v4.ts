#!/usr/bin/env node

/**
 * RCC v3 to v4 Configuration Migration Script
 * 
 * 将RCC v3配置迁移到v4架构
 * 
 * @author Jason Zhang
 */

import * as fs from 'fs';
import * as path from 'path';
import { SecureConfigManager } from '../src/utils/config-encryption';
import { secureLogger } from '../src/utils/secure-logger';

/**
 * v3配置结构（实际格式）
 */
interface RCCv3Config {
  server: {
    port: number;
    host: string;
    architecture: string;
    environment: string;
  };
  providers: Record<string, v3Provider>;
  routing: v3Routing;
  debug?: {
    enabled: boolean;
    logLevel: string;
    traceRequests: boolean;
    saveRequests: boolean;
  };
}

interface v3Provider {
  type: string;
  endpoint: string;
  authentication?: {
    type: string;
    apiKey?: string;
  };
  models: string[];
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  capabilities: {
    chat: boolean;
    completions: boolean;
    streaming: boolean;
    toolCalling: boolean;
    embeddings: boolean;
    multimodal: boolean;
  };
  maxTokens: Record<string, number>;
  blacklist?: string[];
  lastFetched?: string;
  fetchStats?: any;
}

interface v3Routing {
  strategy: string;
  categories: Record<string, {
    provider: string;
    model: string;
  }>;
}

/**
 * v4配置结构（基础）
 */
interface RCCv4Config {
  version: string;
  serverCompatibilityProviders: Record<string, any>;
  standardProviders: Record<string, any>;
  routing: any;
  security: any;
  validation: any;
}

/**
 * 配置迁移器
 */
class ConfigMigrator {
  private secureConfigManager: SecureConfigManager;

  constructor() {
    this.secureConfigManager = new SecureConfigManager();
  }

  /**
   * 初始化迁移器
   */
  async initialize(): Promise<void> {
    await this.secureConfigManager.initialize();
    secureLogger.info('🔧 配置迁移器已初始化');
  }

  /**
   * 执行v3到v4的迁移
   */
  async migrateV3ToV4(v3ConfigPath: string, v4OutputDir: string): Promise<void> {
    secureLogger.info(`🔄 开始迁移配置: ${v3ConfigPath} → ${v4OutputDir}`);

    try {
      // 读取v3配置
      const v3Config = await this.loadV3Config(v3ConfigPath);
      
      // 验证v3配置
      this.validateV3Config(v3Config);
      
      // 转换为v4配置
      const v4Config = this.convertToV4(v3Config);
      
      // 保存v4配置
      await this.saveV4Config(v4Config, v4OutputDir);
      
      secureLogger.info('✅ 配置迁移完成');
      
    } catch (error) {
      secureLogger.error('❌ 配置迁移失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 加载v3配置
   */
  private async loadV3Config(configPath: string): Promise<RCCv3Config> {
    if (!fs.existsSync(configPath)) {
      throw new Error(`v3配置文件不存在: ${configPath}`);
    }

    const content = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(content);
    
    secureLogger.info(`📄 已加载v3配置: ${configPath}`);
    return config;
  }

  /**
   * 验证v3配置
   */
  private validateV3Config(config: RCCv3Config): void {
    if (!config.server || !config.server.architecture) {
      throw new Error('无效的v3配置：缺少server.architecture字段');
    }

    if (!config.server.architecture.includes('v3')) {
      throw new Error('无效的v3配置版本');
    }

    if (!config.providers || Object.keys(config.providers).length === 0) {
      throw new Error('v3配置缺少Provider配置');
    }

    secureLogger.info('✅ v3配置验证通过');
  }

  /**
   * 转换为v4配置格式
   */
  private convertToV4(v3Config: RCCv3Config): {
    providers: any,
    routing: any,
    security: any
  } {
    secureLogger.info('🔄 转换配置格式 v3 → v4');

    // 转换Provider配置
    const providers = this.convertProviders(v3Config.providers);
    
    // 转换路由配置
    const routing = this.convertRouting(v3Config.routing, v3Config.providers);
    
    // 创建默认安全配置
    const security = this.createDefaultSecurityConfig();

    return { providers, routing, security };
  }

  /**
   * 转换Provider配置
   */
  private convertProviders(v3Providers: Record<string, v3Provider>): any {
    const serverCompatibilityProviders: Record<string, any> = {};
    const standardProviders: Record<string, any> = {};

    for (const [providerName, v3Provider] of Object.entries(v3Providers)) {
      const provider = this.convertSingleProvider(providerName, v3Provider);
      
      if (this.isServerCompatibilityProvider(v3Provider)) {
        serverCompatibilityProviders[provider.id] = provider;
      } else {
        standardProviders[provider.id] = provider;
      }
    }

    return {
      $schema: "http://json-schema.org/draft-07/schema#",
      version: "4.0.0",
      description: "从v3迁移的Provider配置",
      lastUpdated: new Date().toISOString(),
      serverCompatibilityProviders,
      standardProviders,
      validation: {
        required: Object.keys(serverCompatibilityProviders).concat(Object.keys(standardProviders)),
        environmentVariables: {
          required: [],
          optional: this.extractEnvironmentVariables(v3Providers)
        }
      }
    };
  }

  /**
   * 转换单个Provider
   */
  private convertSingleProvider(providerName: string, v3Provider: v3Provider): any {
    const providerId = this.generateProviderId(providerName, v3Provider);
    
    const baseConfig = {
      id: providerId,
      name: this.generateProviderName(providerName, v3Provider),
      description: `从v3迁移的${v3Provider.type} Provider - ${providerName}`,
      enabled: true, // v3配置中的provider如果存在就是启用的
      type: this.isServerCompatibilityProvider(v3Provider) ? 'server-compatibility' : 'server',
      protocol: this.mapProtocol(v3Provider.type),
      connection: {
        baseUrl: v3Provider.endpoint,
        apiKey: v3Provider.authentication?.apiKey ? `\${${this.generateEnvVarName(providerName, v3Provider)}}` : undefined,
        timeout: v3Provider.timeout || 30000,
        maxRetries: v3Provider.maxRetries || 3,
        retryDelay: v3Provider.retryDelay || 1000
      },
      models: {
        supportedModels: v3Provider.models || this.getDefaultModels(v3Provider.type),
        defaultModel: this.getDefaultModel(v3Provider.type, v3Provider.models),
        dynamicModelDiscovery: this.supportsModelDiscovery(v3Provider.type)
      },
      features: this.convertV3Capabilities(v3Provider.capabilities),
      healthCheck: {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        endpoint: "/v1/models"
      }
    };

    return baseConfig;
  }

  /**
   * 判断是否为Server-Compatibility Provider
   */
  private isServerCompatibilityProvider(provider: v3Provider): boolean {
    const compatibilityTypes = ['lmstudio', 'ollama', 'localai', 'textgen', 'vllm'];
    return compatibilityTypes.includes(provider.type.toLowerCase()) || 
           provider.endpoint.includes('localhost') || 
           provider.endpoint.includes('127.0.0.1');
  }

  /**
   * 生成Provider ID
   */
  private generateProviderId(providerName: string, provider: v3Provider): string {
    return `${provider.type.toLowerCase()}-${providerName.toLowerCase().replace(/\s+/g, '-')}`;
  }

  /**
   * 生成Provider名称
   */
  private generateProviderName(providerName: string, provider: v3Provider): string {
    return `${providerName} ${provider.type} Provider`;
  }

  /**
   * 生成环境变量名
   */
  private generateEnvVarName(providerName: string, provider: v3Provider): string {
    return `RCC_${providerName.toUpperCase()}_API_KEY`;
  }

  /**
   * 转换v3的capabilities到v4的features
   */
  private convertV3Capabilities(capabilities: any): any {
    return {
      chat: capabilities.chat || false,
      tools: capabilities.toolCalling || false,
      streaming: capabilities.streaming || false,
      embedding: capabilities.embeddings || false,
      vision: capabilities.multimodal || false
    };
  }

  /**
   * 映射协议类型
   */
  private mapProtocol(type: string): string {
    const protocolMap: Record<string, string> = {
      'lmstudio': 'openai-compatible',
      'ollama': 'openai-compatible', 
      'localai': 'openai-compatible',
      'textgen': 'openai-compatible',
      'vllm': 'openai-compatible',
      'openai': 'openai',
      'anthropic': 'anthropic',
      'gemini': 'gemini'
    };
    
    return protocolMap[type.toLowerCase()] || 'openai-compatible';
  }

  /**
   * 获取默认模型
   */
  private getDefaultModels(type: string): string[] {
    const modelMap: Record<string, string[]> = {
      'lmstudio': ['llama-3.1-8b-instruct', 'llama-3.1-70b-instruct'],
      'ollama': ['llama3.1:8b', 'llama3.1:70b'],
      'openai': ['gpt-4', 'gpt-3.5-turbo'],
      'anthropic': ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307']
    };
    
    return modelMap[type.toLowerCase()] || [];
  }

  /**
   * 获取默认模型
   */
  private getDefaultModel(type: string, models?: string[]): string {
    if (models && models.length > 0) {
      return models[0];
    }
    const defaultModels = this.getDefaultModels(type);
    return defaultModels[0] || '';
  }

  /**
   * 检查是否支持模型发现
   */
  private supportsModelDiscovery(type: string): boolean {
    const discoverySupported = ['localai', 'vllm', 'ollama'];
    return discoverySupported.includes(type.toLowerCase());
  }

  /**
   * 获取Provider功能
   */
  private getProviderFeatures(type: string): any {
    const featureMap: Record<string, any> = {
      'lmstudio': { chat: true, tools: true, streaming: true, embedding: false, vision: false },
      'ollama': { chat: true, tools: false, streaming: true, embedding: true, vision: false },
      'localai': { chat: true, tools: true, streaming: true, embedding: true, vision: true },
      'textgen': { chat: true, tools: false, streaming: true, embedding: false, vision: false },
      'vllm': { chat: true, tools: false, streaming: true, embedding: false, vision: false },
      'openai': { chat: true, tools: true, streaming: true, embedding: false, vision: true },
      'anthropic': { chat: true, tools: true, streaming: true, embedding: false, vision: true }
    };
    
    return featureMap[type.toLowerCase()] || { chat: true, streaming: false };
  }

  /**
   * 提取环境变量
   */
  private extractEnvironmentVariables(providers: Record<string, v3Provider>): string[] {
    const envVars: string[] = [];
    
    for (const [providerName, provider] of Object.entries(providers)) {
      if (provider.authentication?.apiKey) {
        envVars.push(this.generateEnvVarName(providerName, provider));
      }
    }
    
    return envVars;
  }

  /**
   * 转换路由配置
   */
  private convertRouting(v3Routing: v3Routing, v3Providers: Record<string, v3Provider>): any {
    const routes = this.generateV4Routes(v3Providers);
    
    return {
      $schema: "http://json-schema.org/draft-07/schema#",
      version: "4.0.0",
      description: "从v3迁移的路由配置",
      lastUpdated: new Date().toISOString(),
      
      pipelineArchitecture: {
        layers: [
          { order: 1, name: "transformer", description: "Anthropic ↔ Protocol转换层", required: true },
          { order: 2, name: "protocol", description: "协议控制转换层", required: true },
          { order: 3, name: "server-compatibility", description: "第三方服务器兼容处理层", required: true },
          { order: 4, name: "server", description: "标准服务器协议处理层", required: true }
        ],
        strictLayerEnforcement: true,
        allowCrossLayerCalls: false
      },
      
      routingStrategies: {
        default: {
          id: "migrated-default-strategy",
          name: "迁移的默认策略",
          description: `从v3 ${v3Routing.strategy} 策略迁移`,
          algorithm: this.mapRoutingAlgorithm(v3Routing.strategy),
          fallbackEnabled: false, // v4强制禁用fallback
          strictErrorReporting: true
        }
      },
      
      routes,
      
      routingRules: {
        modelMapping: this.generateModelMapping(v3Providers),
        defaultRoute: this.findDefaultRoute(routes, Object.keys(v3Providers)[0]),
        routeSelectionCriteria: {
          primary: "priority",
          secondary: "health", 
          tertiary: "weight"
        }
      },
      
      configuration: {
        strictErrorReporting: true,
        zeroFallbackPolicy: true, // v4强制启用
        maxRetries: 3,
        requestTimeout: 30000,
        healthCheckInterval: 30000,
        debug: false,
        monitoring: {
          enabled: true,
          metricsCollection: true,
          performanceTracking: true
        }
      },
      
      validation: {
        enforceLayerOrder: true,
        validateModuleCompatibility: true,
        requireHealthyProviders: true,
        preventCrossLayerCalls: true
      }
    };
  }

  /**
   * 生成v4路由
   */
  private generateV4Routes(v3Providers: Record<string, v3Provider>): any[] {
    const routes: any[] = [];
    
    for (const [providerName, provider] of Object.entries(v3Providers)) {
      const route = {
        id: `${provider.type.toLowerCase()}-${providerName.toLowerCase()}-route`,
        name: `${providerName} ${provider.type} 路由`,
        description: `从v3迁移的${provider.type}路由 - ${providerName}`,
        enabled: true,
        priority: this.calculatePriority(provider, providerName),
        weight: 0.8,
        conditions: {
          models: ["*"],
          requestTypes: ["chat", "completion"],
          features: this.getRequiredFeatures(provider)
        },
        pipeline: this.generatePipeline(providerName, provider),
        healthCheck: {
          enabled: true,
          interval: 30000,
          timeoutMs: 5000
        }
      };
      
      routes.push(route);
    }
    
    return routes;
  }

  /**
   * 计算优先级
   */
  private calculatePriority(provider: v3Provider, providerName: string): number {
    // LM Studio优先级最高
    if (provider.type.toLowerCase() === 'lmstudio' || providerName.toLowerCase().includes('lmstudio')) return 100;
    if (provider.type.toLowerCase() === 'ollama' || providerName.toLowerCase().includes('ollama')) return 90;
    if (provider.type.toLowerCase() === 'openai') return 80;
    if (provider.type.toLowerCase() === 'anthropic') return 85;
    return 70;
  }

  /**
   * 获取必需功能
   */
  private getRequiredFeatures(provider: v3Provider): string[] {
    const features = ["streaming"];
    
    if (provider.capabilities.toolCalling) features.push("tools");
    if (provider.capabilities.multimodal) features.push("vision");
    if (provider.capabilities.embeddings) features.push("embedding");
    
    return features;
  }

  /**
   * 生成流水线配置
   */
  private generatePipeline(providerName: string, provider: v3Provider): any {
    const isCompatibilityProvider = this.isServerCompatibilityProvider(provider);
    
    return {
      layers: [
        {
          layer: "transformer",
          moduleId: "anthropic-to-openai-transformer",
          config: { targetProtocol: "openai" }
        },
        {
          layer: "protocol",
          moduleId: "openai-protocol-module",
          config: { streamingSupport: provider.capabilities.streaming }
        },
        {
          layer: "server-compatibility",
          moduleId: isCompatibilityProvider ? `${provider.type.toLowerCase()}-compatibility` : "passthrough-compatibility",
          config: isCompatibilityProvider ? { providerId: this.generateProviderId(providerName, provider) } : { mode: "passthrough" }
        },
        {
          layer: "server",
          moduleId: `${this.mapProtocol(provider.type).replace('-compatible', '')}-server-module`,
          config: { providerId: this.generateProviderId(providerName, provider) }
        }
      ]
    };
  }

  /**
   * 映射路由算法
   */
  private mapRoutingAlgorithm(v3Strategy: string): string {
    const algorithmMap: Record<string, string> = {
      'round-robin': 'round-robin',
      'least-loaded': 'least-loaded', 
      'priority': 'priority-weight',
      'random': 'random'
    };
    
    return algorithmMap[v3Strategy.toLowerCase()] || 'priority-weight';
  }

  /**
   * 生成模型映射
   */
  private generateModelMapping(v3Providers: Record<string, v3Provider>): any {
    const mapping: any = {};
    
    // 默认模型映射
    mapping['claude-3-5-sonnet-20241022'] = {
      preferredRoutes: ["lmstudio-route"],
      modelOverrides: { "lmstudio-route": "llama-3.1-70b-instruct" }
    };
    
    mapping['claude-3-haiku-20240307'] = {
      preferredRoutes: ["lmstudio-route"],
      modelOverrides: { "lmstudio-route": "llama-3.1-8b-instruct" }
    };
    
    return mapping;
  }

  /**
   * 查找默认路由
   */
  private findDefaultRoute(routes: any[], defaultProvider?: string): string {
    if (defaultProvider) {
      const route = routes.find(r => r.id.includes(defaultProvider.toLowerCase()));
      if (route) return route.id;
    }
    
    // 默认使用LM Studio
    const lmstudioRoute = routes.find(r => r.id.includes('lmstudio'));
    return lmstudioRoute ? lmstudioRoute.id : routes[0]?.id || 'default-route';
  }

  /**
   * 创建默认安全配置
   */
  private createDefaultSecurityConfig(): any {
    return {
      $schema: "http://json-schema.org/draft-07/schema#",
      version: "4.0.0",
      description: "默认安全配置",
      lastUpdated: new Date().toISOString(),
      
      encryption: {
        enabled: true,
        algorithm: "aes-256-gcm",
        keyDerivation: {
          algorithm: "pbkdf2",
          iterations: 100000,
          saltLength: 32,
          keyLength: 32
        },
        encryptedFields: ["apiKey", "secret", "token", "password", "privateKey"]
      },
      
      keyManagement: {
        provider: "environment",
        masterKeyEnvVar: "RCC_MASTER_KEY",
        keyRotation: { enabled: false, intervalDays: 90 },
        backup: { enabled: false, location: "${RCC_KEY_BACKUP_PATH}" }
      },
      
      authentication: {
        apiKey: {
          enabled: true,
          header: "Authorization",
          prefix: "Bearer",
          validation: { minLength: 32, pattern: "^[A-Za-z0-9_-]+$" }
        },
        jwt: { enabled: false }
      },
      
      rateLimit: {
        enabled: true,
        global: { windowMs: 60000, maxRequests: 100 },
        perProvider: { windowMs: 60000, maxRequests: 50 },
        perIP: { windowMs: 60000, maxRequests: 30 }
      },
      
      inputValidation: {
        enabled: true,
        maxRequestSize: "10MB",
        allowedContentTypes: ["application/json", "text/plain"],
        sanitization: { enabled: true, removeScripts: true, trimWhitespace: true },
        requestValidation: {
          maxMessageLength: 100000,
          maxMessagesCount: 50,
          allowedRoles: ["user", "assistant", "system", "tool"]
        }
      },
      
      logging: {
        level: "info",
        sensitiveFieldFiltering: {
          enabled: true,
          fields: ["apiKey", "authorization", "password", "secret", "token"],
          replacement: "[REDACTED]"
        },
        auditLog: {
          enabled: true,
          events: ["authentication_failure", "authorization_failure", "configuration_change", "provider_error", "security_violation"]
        }
      },
      
      errorHandling: {
        hideInternalErrors: true,
        sanitizeErrorMessages: true,
        logFullErrors: true,
        genericErrorMessage: "An error occurred while processing your request"
      }
    };
  }

  /**
   * 保存v4配置
   */
  private async saveV4Config(v4Config: any, outputDir: string): Promise<void> {
    // 确保输出目录存在
    const providersDir = path.join(outputDir, 'providers');
    const routingDir = path.join(outputDir, 'routing');
    const securityDir = path.join(outputDir, 'security');
    
    for (const dir of [providersDir, routingDir, securityDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    
    // 保存各个配置文件
    const files = [
      { path: path.join(providersDir, 'server-compatibility-providers.json'), data: v4Config.providers },
      { path: path.join(routingDir, 'pipeline-routing.json'), data: v4Config.routing },
      { path: path.join(securityDir, 'security-config.json'), data: v4Config.security }
    ];
    
    for (const file of files) {
      await this.secureConfigManager.saveSecureConfig(file.path, file.data);
      secureLogger.info(`💾 已保存v4配置: ${file.path}`);
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.secureConfigManager.cleanup();
  }
}

/**
 * 主函数
 */
async function main() {
  const migrator = new ConfigMigrator();
  
  try {
    await migrator.initialize();
    
    const v3ConfigPath = process.argv[2];
    const v4OutputDir = process.argv[3] || 'config/v4';
    
    if (!v3ConfigPath) {
      console.error('用法: node migrate-v3-to-v4.ts <v3-config-path> [v4-output-dir]');
      process.exit(1);
    }
    
    await migrator.migrateV3ToV4(v3ConfigPath, v4OutputDir);
    
    console.log('✅ 配置迁移完成！');
    console.log(`📂 v4配置已保存到: ${v4OutputDir}`);
    console.log('📋 请检查生成的配置文件并设置相应的环境变量');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    process.exit(1);
  } finally {
    migrator.cleanup();
  }
}

// 运行迁移
if (require.main === module) {
  main();
}