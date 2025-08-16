/**
 * RCC v4.0 Configuration Loader
 * 
 * 加载和管理RCC v4.0配置系统
 * 支持加密配置、环境变量替换和配置验证
 * 
 * @author Jason Zhang
 */

import * as fs from 'fs';
import * as path from 'path';
import { SecureConfigManager } from '../utils/config-encryption';
import { secureLogger } from '../utils/secure-logger';

/**
 * v4配置结构
 */
export interface RCCv4Config {
  version: string;
  serverCompatibilityProviders: Record<string, ServerCompatibilityProvider>;
  standardProviders: Record<string, StandardProvider>;
  routing: PipelineRouting;
  security: SecurityConfig;
  validation: ValidationConfig;
}

/**
 * Server-Compatibility Provider配置
 */
export interface ServerCompatibilityProvider {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: 'server-compatibility';
  protocol: string;
  connection: ProviderConnection;
  models: ModelConfig;
  features: FeatureConfig;
  healthCheck?: HealthCheckConfig;
}

/**
 * 标准Provider配置
 */
export interface StandardProvider {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: 'server';
  protocol: string;
  connection: ProviderConnection;
  models: ModelConfig;
  features: FeatureConfig;
}

/**
 * Provider连接配置
 */
export interface ProviderConnection {
  baseUrl: string;
  apiKey?: string;
  organization?: string;
  project?: string;
  timeout: number;
  maxRetries: number;
  retryDelay?: number;
  keepAlive?: boolean;
  maxConnections?: number;
}

/**
 * 模型配置
 */
export interface ModelConfig {
  supportedModels: string[];
  defaultModel: string;
  modelMapping?: Record<string, string>;
  dynamicModelDiscovery?: boolean;
}

/**
 * 功能配置
 */
export interface FeatureConfig {
  chat: boolean;
  tools?: boolean;
  streaming: boolean;
  embedding?: boolean;
  vision?: boolean;
}

/**
 * 健康检查配置
 */
export interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  endpoint: string;
}

/**
 * 流水线路由配置
 */
export interface PipelineRouting {
  pipelineArchitecture: PipelineArchitecture;
  routingStrategies: Record<string, RoutingStrategy>;
  routes: RouteConfig[];
  routingRules: RoutingRules;
  configuration: RoutingConfiguration;
  validation: RoutingValidation;
}

/**
 * 流水线架构
 */
export interface PipelineArchitecture {
  layers: LayerConfig[];
  strictLayerEnforcement: boolean;
  allowCrossLayerCalls: boolean;
}

/**
 * 层配置
 */
export interface LayerConfig {
  order: number;
  name: string;
  description: string;
  required: boolean;
}

/**
 * 路由策略
 */
export interface RoutingStrategy {
  id: string;
  name: string;
  description: string;
  algorithm: string;
  fallbackEnabled: boolean;
  strictErrorReporting: boolean;
}

/**
 * 路由配置
 */
export interface RouteConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  weight: number;
  conditions: RouteConditions;
  pipeline: PipelineConfig;
  healthCheck?: HealthCheckConfig;
}

/**
 * 路由条件
 */
export interface RouteConditions {
  models: string[];
  requestTypes: string[];
  features: string[];
}

/**
 * 流水线配置
 */
export interface PipelineConfig {
  layers: PipelineLayerConfig[];
}

/**
 * 流水线层配置
 */
export interface PipelineLayerConfig {
  layer: string;
  moduleId: string;
  config: Record<string, any>;
}

/**
 * 路由规则
 */
export interface RoutingRules {
  modelMapping: Record<string, ModelMappingRule>;
  defaultRoute: string;
  routeSelectionCriteria: RouteSelectionCriteria;
}

/**
 * 模型映射规则
 */
export interface ModelMappingRule {
  preferredRoutes: string[];
  modelOverrides: Record<string, string>;
}

/**
 * 路由选择标准
 */
export interface RouteSelectionCriteria {
  primary: string;
  secondary: string;
  tertiary: string;
}

/**
 * 路由配置
 */
export interface RoutingConfiguration {
  strictErrorReporting: boolean;
  zeroFallbackPolicy: boolean;
  maxRetries: number;
  requestTimeout: number;
  healthCheckInterval: number;
  debug: boolean;
  monitoring: MonitoringConfig;
}

/**
 * 监控配置
 */
export interface MonitoringConfig {
  enabled: boolean;
  metricsCollection: boolean;
  performanceTracking: boolean;
}

/**
 * 路由验证
 */
export interface RoutingValidation {
  enforceLayerOrder: boolean;
  validateModuleCompatibility: boolean;
  requireHealthyProviders: boolean;
  preventCrossLayerCalls: boolean;
}

/**
 * 安全配置
 */
export interface SecurityConfig {
  encryption: EncryptionConfig;
  keyManagement: KeyManagementConfig;
  authentication: AuthenticationConfig;
  authorization: AuthorizationConfig;
  rateLimit: RateLimitConfig;
  inputValidation: InputValidationConfig;
  logging: LoggingConfig;
  headers: HeadersConfig;
  errorHandling: ErrorHandlingConfig;
  monitoring: SecurityMonitoringConfig;
  compliance: ComplianceConfig;
  development: DevelopmentConfig;
}

/**
 * 加密配置
 */
export interface EncryptionConfig {
  enabled: boolean;
  algorithm: string;
  keyDerivation: KeyDerivationConfig;
  encryptedFields: string[];
}

/**
 * 密钥派生配置
 */
export interface KeyDerivationConfig {
  algorithm: string;
  iterations: number;
  saltLength: number;
  keyLength: number;
}

/**
 * 密钥管理配置
 */
export interface KeyManagementConfig {
  provider: string;
  masterKeyEnvVar: string;
  keyRotation: KeyRotationConfig;
  backup: BackupConfig;
}

/**
 * 密钥轮换配置
 */
export interface KeyRotationConfig {
  enabled: boolean;
  intervalDays: number;
}

/**
 * 备份配置
 */
export interface BackupConfig {
  enabled: boolean;
  location: string;
}

/**
 * 认证配置
 */
export interface AuthenticationConfig {
  apiKey: APIKeyConfig;
  jwt: JWTConfig;
}

/**
 * API密钥配置
 */
export interface APIKeyConfig {
  enabled: boolean;
  header: string;
  prefix: string;
  validation: APIKeyValidation;
}

/**
 * API密钥验证
 */
export interface APIKeyValidation {
  minLength: number;
  pattern: string;
}

/**
 * JWT配置
 */
export interface JWTConfig {
  enabled: boolean;
  secret: string;
  expiresIn: string;
  algorithm: string;
}

/**
 * 授权配置
 */
export interface AuthorizationConfig {
  rbac: RBACConfig;
}

/**
 * RBAC配置
 */
export interface RBACConfig {
  enabled: boolean;
  roles: Record<string, RoleConfig>;
}

/**
 * 角色配置
 */
export interface RoleConfig {
  permissions: string[];
}

/**
 * 速率限制配置
 */
export interface RateLimitConfig {
  enabled: boolean;
  global: RateLimitRule;
  perProvider: RateLimitRule;
  perIP: RateLimitRule;
}

/**
 * 速率限制规则
 */
export interface RateLimitRule {
  windowMs: number;
  maxRequests: number;
}

/**
 * 输入验证配置
 */
export interface InputValidationConfig {
  enabled: boolean;
  maxRequestSize: string;
  allowedContentTypes: string[];
  sanitization: SanitizationConfig;
  requestValidation: RequestValidationConfig;
}

/**
 * 消毒配置
 */
export interface SanitizationConfig {
  enabled: boolean;
  removeScripts: boolean;
  trimWhitespace: boolean;
}

/**
 * 请求验证配置
 */
export interface RequestValidationConfig {
  maxMessageLength: number;
  maxMessagesCount: number;
  allowedRoles: string[];
}

/**
 * 日志配置
 */
export interface LoggingConfig {
  level: string;
  sensitiveFieldFiltering: SensitiveFieldFilteringConfig;
  auditLog: AuditLogConfig;
}

/**
 * 敏感字段过滤配置
 */
export interface SensitiveFieldFilteringConfig {
  enabled: boolean;
  fields: string[];
  replacement: string;
}

/**
 * 审计日志配置
 */
export interface AuditLogConfig {
  enabled: boolean;
  events: string[];
}

/**
 * 头部配置
 */
export interface HeadersConfig {
  security: SecurityHeadersConfig;
  cors: CORSConfig;
}

/**
 * 安全头部配置
 */
export interface SecurityHeadersConfig {
  contentSecurityPolicy: string;
  xFrameOptions: string;
  xContentTypeOptions: string;
  referrerPolicy: string;
  permissionsPolicy: string;
}

/**
 * CORS配置
 */
export interface CORSConfig {
  enabled: boolean;
  origins: string[];
  methods: string[];
  allowedHeaders: string[];
  credentials: boolean;
}

/**
 * 错误处理配置
 */
export interface ErrorHandlingConfig {
  hideInternalErrors: boolean;
  sanitizeErrorMessages: boolean;
  logFullErrors: boolean;
  genericErrorMessage: string;
}

/**
 * 安全监控配置
 */
export interface SecurityMonitoringConfig {
  securityEvents: SecurityEventsConfig;
  metricsCollection: SecurityMetricsConfig;
}

/**
 * 安全事件配置
 */
export interface SecurityEventsConfig {
  enabled: boolean;
  alerting: AlertingConfig;
}

/**
 * 告警配置
 */
export interface AlertingConfig {
  enabled: boolean;
  webhook: string;
}

/**
 * 安全指标配置
 */
export interface SecurityMetricsConfig {
  includeSecurityMetrics: boolean;
  anonymizeData: boolean;
}

/**
 * 合规配置
 */
export interface ComplianceConfig {
  dataRetention: DataRetentionConfig;
  privacy: PrivacyConfig;
}

/**
 * 数据保留配置
 */
export interface DataRetentionConfig {
  logRetentionDays: number;
  configBackupRetentionDays: number;
}

/**
 * 隐私配置
 */
export interface PrivacyConfig {
  anonymizeIPs: boolean;
  dataMinimization: boolean;
}

/**
 * 开发配置
 */
export interface DevelopmentConfig {
  allowInsecureConnections: boolean;
  debugMode: boolean;
  testDataGeneration: boolean;
}

/**
 * 验证配置
 */
export interface ValidationConfig {
  required: string[];
  environmentVariables: EnvironmentVariableConfig;
}

/**
 * 环境变量配置
 */
export interface EnvironmentVariableConfig {
  required: string[];
  optional: string[];
}

/**
 * RCC v4.0配置加载器
 */
export class RCCv4ConfigLoader {
  private secureConfigManager: SecureConfigManager;
  private configCache: Map<string, any> = new Map();

  constructor() {
    this.secureConfigManager = new SecureConfigManager();
  }

  /**
   * 初始化配置加载器
   */
  async initialize(): Promise<void> {
    await this.secureConfigManager.initialize();
    secureLogger.info('🔧 RCC v4.0配置加载器已初始化');
  }

  /**
   * 加载完整的v4配置
   */
  async loadConfig(configDir: string = 'config/v4'): Promise<RCCv4Config> {
    secureLogger.info(`📂 加载RCC v4.0配置: ${configDir}`);

    try {
      // 加载各个配置文件
      const [providers, routing, security] = await Promise.all([
        this.loadProviderConfig(path.join(configDir, 'providers/server-compatibility-providers.json')),
        this.loadRoutingConfig(path.join(configDir, 'routing/pipeline-routing.json')),
        this.loadSecurityConfig(path.join(configDir, 'security/security-config.json'))
      ]);

      // 合并配置
      const config: RCCv4Config = {
        version: '4.0.0',
        serverCompatibilityProviders: providers.serverCompatibilityProviders,
        standardProviders: providers.standardProviders,
        routing: routing,
        security: security,
        validation: providers.validation
      };

      // 处理环境变量替换
      const processedConfig = this.processEnvironmentVariables(config);

      // 验证配置
      this.validateConfig(processedConfig);

      secureLogger.info('✅ RCC v4.0配置加载成功');
      return processedConfig;

    } catch (error) {
      secureLogger.error('❌ RCC v4.0配置加载失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 加载Provider配置
   */
  private async loadProviderConfig(filePath: string): Promise<any> {
    return await this.loadConfigFile(filePath, 'providers');
  }

  /**
   * 加载路由配置
   */
  private async loadRoutingConfig(filePath: string): Promise<PipelineRouting> {
    return await this.loadConfigFile(filePath, 'routing');
  }

  /**
   * 加载安全配置
   */
  private async loadSecurityConfig(filePath: string): Promise<SecurityConfig> {
    return await this.loadConfigFile(filePath, 'security');
  }

  /**
   * 加载配置文件
   */
  private async loadConfigFile(filePath: string, type: string): Promise<any> {
    const cacheKey = `${type}:${filePath}`;
    
    if (this.configCache.has(cacheKey)) {
      secureLogger.debug(`📄 使用缓存的${type}配置: ${filePath}`);
      return this.configCache.get(cacheKey);
    }

    try {
      const config = await this.secureConfigManager.loadSecureConfig(filePath);
      this.configCache.set(cacheKey, config);
      secureLogger.debug(`📄 已加载${type}配置: ${filePath}`);
      return config;
    } catch (error) {
      secureLogger.error(`❌ 加载${type}配置失败: ${filePath}`, { error: error.message });
      throw new Error(`Failed to load ${type} config from ${filePath}: ${error.message}`);
    }
  }

  /**
   * 处理环境变量替换
   */
  private processEnvironmentVariables(config: any): any {
    return this.deepProcessEnvVars(config);
  }

  /**
   * 深度处理环境变量
   */
  private deepProcessEnvVars(obj: any): any {
    if (typeof obj === 'string') {
      return this.replaceEnvVars(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepProcessEnvVars(item));
    }

    if (typeof obj === 'object' && obj !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.deepProcessEnvVars(value);
      }
      return result;
    }

    return obj;
  }

  /**
   * 替换环境变量
   */
  private replaceEnvVars(str: string): any {
    // 支持格式: ${VAR_NAME} 和 ${VAR_NAME:default_value}
    return str.replace(/\$\{([^}]+)\}/g, (match, varExpr) => {
      const [varName, defaultValue] = varExpr.split(':');
      const envValue = process.env[varName];
      
      if (envValue !== undefined) {
        // 尝试解析为数字或布尔值
        if (/^\d+$/.test(envValue)) {
          return parseInt(envValue, 10);
        }
        if (/^\d+\.\d+$/.test(envValue)) {
          return parseFloat(envValue);
        }
        if (envValue.toLowerCase() === 'true') {
          return true;
        }
        if (envValue.toLowerCase() === 'false') {
          return false;
        }
        return envValue;
      }
      
      if (defaultValue !== undefined) {
        // 处理默认值的类型转换
        if (/^\d+$/.test(defaultValue)) {
          return parseInt(defaultValue, 10);
        }
        if (/^\d+\.\d+$/.test(defaultValue)) {
          return parseFloat(defaultValue);
        }
        if (defaultValue.toLowerCase() === 'true') {
          return true;
        }
        if (defaultValue.toLowerCase() === 'false') {
          return false;
        }
        return defaultValue;
      }
      
      throw new Error(`Required environment variable ${varName} is not set`);
    });
  }

  /**
   * 验证配置
   */
  private validateConfig(config: RCCv4Config): void {
    // 验证版本
    if (config.version !== '4.0.0') {
      throw new Error(`Unsupported config version: ${config.version}`);
    }

    // 验证必需的Provider - 查找LM Studio类型的provider
    const hasLMStudioProvider = Object.values(config.serverCompatibilityProviders)
      .some(p => p.id.includes('lmstudio') || p.name.toLowerCase().includes('lmstudio'));
    
    if (!hasLMStudioProvider) {
      console.warn('⚠️ 警告: 未找到LM Studio provider，但继续加载配置');
    }

    // 验证启用的Provider至少有一个
    const enabledCompatibilityProviders = Object.values(config.serverCompatibilityProviders).filter(p => p.enabled);
    const enabledStandardProviders = Object.values(config.standardProviders).filter(p => p.enabled);
    const enabledProviders = [...enabledCompatibilityProviders, ...enabledStandardProviders];

    if (enabledProviders.length === 0) {
      throw new Error('At least one provider must be enabled');
    }

    // 验证路由配置
    if (!config.routing.routes || config.routing.routes.length === 0) {
      throw new Error('At least one route must be configured');
    }

    // 验证四层架构
    const layers = config.routing.pipelineArchitecture.layers;
    const expectedLayers = ['transformer', 'protocol', 'server-compatibility', 'server'];
    for (const expectedLayer of expectedLayers) {
      if (!layers.some(l => l.name === expectedLayer)) {
        throw new Error(`Required pipeline layer missing: ${expectedLayer}`);
      }
    }

    // 验证零fallback策略
    if (!config.routing.configuration.zeroFallbackPolicy) {
      throw new Error('Zero fallback policy must be enabled');
    }

    secureLogger.info('✅ 配置验证通过');
  }

  /**
   * 获取Provider配置
   */
  getProviderConfig(config: RCCv4Config, providerId: string): ServerCompatibilityProvider | StandardProvider | null {
    return config.serverCompatibilityProviders[providerId] || 
           config.standardProviders[providerId] || 
           null;
  }

  /**
   * 获取启用的Provider列表
   */
  getEnabledProviders(config: RCCv4Config): (ServerCompatibilityProvider | StandardProvider)[] {
    const providers: (ServerCompatibilityProvider | StandardProvider)[] = [];
    
    for (const provider of Object.values(config.serverCompatibilityProviders)) {
      if (provider.enabled) {
        providers.push(provider);
      }
    }
    
    for (const provider of Object.values(config.standardProviders)) {
      if (provider.enabled) {
        providers.push(provider as StandardProvider);
      }
    }
    
    return providers;
  }

  /**
   * 获取路由配置
   */
  getRouteConfig(config: RCCv4Config, routeId: string): RouteConfig | null {
    return config.routing.routes.find(r => r.id === routeId) || null;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.configCache.clear();
    this.secureConfigManager.cleanup();
    secureLogger.info('🧹 配置加载器已清理');
  }
}