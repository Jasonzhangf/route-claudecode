/**
 * RCC v4.0 Configuration Types
 *
 * 定义所有配置相关的TypeScript接口和类型
 *
 * @author Jason Zhang
 */

/**
 * CLI配置接口 - 从cli-config-manager.ts迁移
 */
export interface CLIConfig {
  configVersion?: string;
  version?: string;
  server?: {
    port?: number;
    host?: string;
  };
  routing?: any; // 简化的路由配置
  standardProviders?: Record<string, any>;
  serverCompatibilityProviders?: Record<string, any>;
}

/**
 * 配置加载结果 - 从cli-config-manager.ts迁移
 */
export interface ConfigLoadResult {
  config: CLIConfig;
  configPath: string;
  source: 'specified' | 'auto-detected';
}

/**
 * 配置搜索位置 - 从cli-config-manager.ts迁移
 */
export interface ConfigSearchLocation {
  path: string;
  desc: string;
}

/**
 * v4配置结构
 */
export interface RCCv4Config {
  version: string;
  serverCompatibilityProviders?: Record<string, ServerCompatibilityProvider>;
  standardProviders?: Record<string, StandardProvider>;
  routing?: PipelineRouting;
  security?: SecurityConfig;
  validation?: ValidationConfig;
  debug?: DebugConfig;
  server?: ServerConfig;
  metadata?: ConfigMetadata;
  providers?: Record<string, any>; // 兼容旧版本
  pipelines?: any[]; // 兼容旧版本
  router?: Record<string, string>; // 支持简化的demo1风格路由配置
}

/**
 * Debug配置
 */
export interface DebugConfig {
  enabled: boolean;
  logLevel: string;
  modules: Record<string, ModuleDebugConfig>;
  traceRequests: boolean;
  saveRequests: boolean;
  enableRecording: boolean;
  enableAuditTrail: boolean;
  enableReplay: boolean;
  enablePerformanceMetrics: boolean;
}

/**
 * 模块Debug配置
 */
export interface ModuleDebugConfig {
  enabled: boolean;
  logLevel: 'error' | 'warn' | 'debug' | 'info';
}

/**
 * 服务器配置
 */
export interface ServerConfig {
  port: number;
  host: string;
  name: string;
  environment: string;
  debug?: boolean;
}

/**
 * 配置元数据
 */
export interface ConfigMetadata {
  configVersion: string;
  architecture: string;
  migrationSource: string;
  createdAt: string;
  createdBy: string;
  description: string;
  features: string[];
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
  endpoint?: string; // 兼容属性
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
  endpoint?: string; // 兼容属性
}

/**
 * Provider连接配置
 */
export interface ProviderConnection {
  baseUrl?: string; // 兼容旧版本
  endpoint?: string; // 新版本使用endpoint
  apiKey?: string;
  organization?: string;
  project?: string;
  timeout: number;
  maxRetries: number;
  retryDelay?: number;
  keepAlive?: boolean;
  maxConnections?: number;
  authentication?: {
    type?: string;
    apiKeys?: string[];
    credentials?: {
      apiKey?: string;
    };
    keyRotation?: {
      enabled: boolean;
      onFailure: boolean;
      onRateLimit: boolean;
    };
  };
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
  defaultStrategy?: string;
  healthCheckInterval?: number;
  maxRetries?: number;
  strictErrorReporting?: boolean;
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
  // DEPRECATED: fallbackEnabled removed per Zero Fallback Policy Rule ZF-003
  // fallbackEnabled: boolean;
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
  // DEPRECATED: emergency fallback removed per Zero Fallback Policy Rule ZF-003
  // allowEmergencyFallback?: boolean;
  // emergencyThresholds?: {
  //   consecutiveFailures: number;
  //   errorRateThreshold: number;
  //   criticalLatencyMs: number;
  // };
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
  cors: CORSConfig;
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
  // DEPRECATED: backup removed per Zero Fallback Policy Rule ZF-003
  // backup: BackupConfig;
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
  enabled: boolean;
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
  enforceLayerOrder: boolean;
  validateModuleCompatibility: boolean;
  requireHealthyProviders: boolean;
  preventCrossLayerCalls: boolean;
}

/**
 * 环境变量配置
 */
export interface EnvironmentVariableConfig {
  required: string[];
  optional: string[];
}

/**
 * 配置加载选项
 */
export interface ConfigLoadOptions {
  configDir?: string;
  useCache?: boolean;
  validateConfig?: boolean;
  processEnvVars?: boolean;
}

/**
 * 配置验证结果
 */
export interface ConfigValidationResult {
  isValid: boolean;
  valid: boolean; // 兼容属性
  errors: string[];
  warnings: string[];
}

/**
 * 配置缓存项
 */
export interface ConfigCacheItem {
  data: any;
  timestamp: number;
  filePath: string;
}
