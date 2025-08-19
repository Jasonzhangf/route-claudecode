/**
 * 配置管理器接口定义
 *
 * 定义统一的配置管理接口，负责配置加载、验证、更新和监听
 * 与路由器、负载均衡器、健康检查器完全分离
 *
 * @author RCC4 Architecture Team
 * @version 4.0.0-beta.1
 */

import { ValidationSchema } from '../../middleware/data-validator';

// ========================= 配置管理器接口 =========================

/**
 * 配置管理器接口
 *
 * 职责：统一的配置管理
 * - 配置加载和验证
 * - 动态配置更新
 * - 配置版本管理
 */
export interface ConfigManager {
  /**
   * 加载配置
   *
   * @param source 配置源
   * @returns 加载的配置
   */
  loadConfig(source: ConfigSource): Promise<RouterConfig>;

  /**
   * 验证配置
   *
   * @param config 待验证的配置
   * @returns 验证结果
   */
  validateConfig(config: RouterConfig): ValidationResult;

  /**
   * 更新配置
   *
   * @param config 新配置
   * @returns 更新结果
   */
  updateConfig(config: RouterConfig): Promise<ConfigUpdateResult>;

  /**
   * 监听配置变化
   *
   * @param callback 配置变化回调函数
   * @returns 取消监听函数
   */
  watchConfig(callback: ConfigChangeCallback): () => void;

  /**
   * 获取当前配置
   *
   * @returns 当前配置
   */
  getCurrentConfig(): RouterConfig | undefined;

  /**
   * 获取配置历史
   *
   * @param limit 返回记录数限制
   * @returns 配置历史记录
   */
  getConfigHistory(limit?: number): ConfigHistoryRecord[];

  /**
   * 回滚配置
   *
   * @param version 目标版本
   * @returns 回滚结果
   */
  rollbackConfig(version: string): Promise<ConfigUpdateResult>;

  /**
   * 重新加载配置
   *
   * @param force 是否强制重新加载
   * @returns 重新加载结果
   */
  reloadConfig(force?: boolean): Promise<ConfigUpdateResult>;

  /**
   * 获取配置管理器状态
   *
   * @returns 管理器状态信息
   */
  getManagerStatus(): ConfigManagerStatus;
}

/**
 * 配置加载器接口
 *
 * 职责：从不同来源加载配置
 */
export interface ConfigLoader {
  /**
   * 加载配置
   *
   * @param source 配置源
   * @returns 原始配置数据
   */
  load(source: ConfigSource): Promise<any>;

  /**
   * 检查配置源是否可用
   *
   * @param source 配置源
   * @returns 是否可用
   */
  isSourceAvailable(source: ConfigSource): Promise<boolean>;

  /**
   * 获取支持的配置源类型
   *
   * @returns 支持的类型列表
   */
  getSupportedSourceTypes(): ConfigSourceType[];

  /**
   * 设置加载器选项
   *
   * @param options 加载器选项
   */
  setOptions(options: LoaderOptions): void;
}

/**
 * 配置验证器接口
 *
 * 职责：验证配置的正确性和完整性
 */
export interface ConfigValidator {
  /**
   * 验证配置
   *
   * @param config 待验证的配置
   * @param schema 验证Schema（可选）
   * @returns 验证结果
   */
  validate(config: any, schema?: ValidationSchema): ValidationResult;

  /**
   * 添加自定义验证规则
   *
   * @param ruleName 规则名称
   * @param rule 验证规则函数
   */
  addValidationRule(ruleName: string, rule: ValidationRule): void;

  /**
   * 移除验证规则
   *
   * @param ruleName 规则名称
   */
  removeValidationRule(ruleName: string): void;

  /**
   * 获取所有验证规则
   *
   * @returns 验证规则映射
   */
  getValidationRules(): Record<string, ValidationRule>;

  /**
   * 设置验证器选项
   *
   * @param options 验证器选项
   */
  setOptions(options: ValidatorOptions): void;
}

/**
 * 配置监听器接口
 *
 * 职责：监听配置文件变化
 */
export interface ConfigWatcher {
  /**
   * 开始监听
   *
   * @param source 配置源
   * @param callback 变化回调函数
   * @returns 监听句柄
   */
  startWatching(source: ConfigSource, callback: ConfigChangeCallback): WatchHandle;

  /**
   * 停止监听
   *
   * @param handle 监听句柄
   */
  stopWatching(handle: WatchHandle): void;

  /**
   * 停止所有监听
   */
  stopAllWatching(): void;

  /**
   * 获取当前监听的配置源
   *
   * @returns 监听的配置源列表
   */
  getWatchedSources(): ConfigSource[];

  /**
   * 设置监听器选项
   *
   * @param options 监听器选项
   */
  setOptions(options: WatcherOptions): void;
}

/**
 * 配置转换器接口
 *
 * 职责：转换不同格式的配置
 */
export interface ConfigTransformer {
  /**
   * 转换配置格式
   *
   * @param config 原始配置
   * @param fromFormat 源格式
   * @param toFormat 目标格式
   * @returns 转换后的配置
   */
  transform(config: any, fromFormat: ConfigFormat, toFormat: ConfigFormat): any;

  /**
   * 获取支持的格式
   *
   * @returns 支持的格式列表
   */
  getSupportedFormats(): ConfigFormat[];

  /**
   * 添加自定义转换器
   *
   * @param fromFormat 源格式
   * @param toFormat 目标格式
   * @param transformer 转换器函数
   */
  addTransformer(fromFormat: ConfigFormat, toFormat: ConfigFormat, transformer: TransformerFunction): void;

  /**
   * 移除转换器
   *
   * @param fromFormat 源格式
   * @param toFormat 目标格式
   */
  removeTransformer(fromFormat: ConfigFormat, toFormat: ConfigFormat): void;
}

// ========================= 数据结构定义 =========================

/**
 * 路由器配置
 */
export interface RouterConfig {
  /** 配置版本 */
  readonly version: string;

  /** 配置ID */
  readonly id: string;

  /** 配置名称 */
  readonly name: string;

  /** 配置元数据 */
  readonly metadata: ConfigMetadata;

  /** 路由配置 */
  readonly routing: RoutingConfig;

  /** 负载均衡配置 */
  readonly loadBalancing: LoadBalancingConfig;

  /** 健康检查配置 */
  readonly healthCheck: HealthCheckConfig;

  /** Key管理配置 */
  readonly keyManagement: KeyManagementConfig;

  /** 监控配置 */
  readonly monitoring: MonitoringConfig;

  /** Provider配置 */
  readonly providers: Record<string, ProviderConfig>;

  /** 零Fallback策略配置 */
  readonly zeroFallbackPolicy: ZeroFallbackConfig;

  /** 调试配置 */
  readonly debug?: DebugConfig;

  /** 扩展配置 */
  readonly extensions?: Record<string, any>;
}

/**
 * 配置源
 */
export interface ConfigSource {
  /** 配置源类型 */
  readonly type: ConfigSourceType;

  /** 配置源位置 */
  readonly location: string;

  /** 配置格式 */
  readonly format: ConfigFormat;

  /** 访问选项 */
  readonly options?: ConfigSourceOptions;

  /** 认证信息 */
  readonly credentials?: ConfigCredentials;
}

/**
 * 配置更新结果
 */
export interface ConfigUpdateResult {
  /** 是否成功 */
  readonly success: boolean;

  /** 新配置版本 */
  readonly newVersion: string;

  /** 旧配置版本 */
  readonly previousVersion?: string;

  /** 更新时间 */
  readonly updatedAt: Date;

  /** 更新详情 */
  readonly details: ConfigUpdateDetails;

  /** 错误信息 */
  readonly error?: Error;

  /** 验证结果 */
  readonly validationResult?: ValidationResult;
}

/**
 * 配置历史记录
 */
export interface ConfigHistoryRecord {
  /** 记录ID */
  readonly id: string;

  /** 配置版本 */
  readonly version: string;

  /** 配置快照 */
  readonly configSnapshot: RouterConfig;

  /** 变更类型 */
  readonly changeType: ConfigChangeType;

  /** 变更详情 */
  readonly changeDetails: ConfigChangeDetails;

  /** 变更时间 */
  readonly changedAt: Date;

  /** 变更者 */
  readonly changedBy?: string;

  /** 变更原因 */
  readonly changeReason?: string;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  readonly isValid: boolean;

  /** 错误列表 */
  readonly errors: ValidationError[];

  /** 警告列表 */
  readonly warnings: ValidationWarning[];

  /** 验证时间 */
  readonly validatedAt: Date;

  /** 验证器版本 */
  readonly validatorVersion: string;

  /** 使用的Schema */
  readonly usedSchema?: string;
}

/**
 * 验证错误
 */
export interface ValidationError {
  /** 错误代码 */
  readonly code: string;

  /** 错误消息 */
  readonly message: string;

  /** 错误路径 */
  readonly path: string;

  /** 期望值 */
  readonly expectedValue?: any;

  /** 实际值 */
  readonly actualValue?: any;

  /** 错误严重级别 */
  readonly severity: ErrorSeverity;

  /** 修复建议 */
  readonly fixSuggestion?: string;
}

/**
 * 验证警告
 */
export interface ValidationWarning {
  /** 警告代码 */
  readonly code: string;

  /** 警告消息 */
  readonly message: string;

  /** 警告路径 */
  readonly path: string;

  /** 建议值 */
  readonly suggestedValue?: any;

  /** 当前值 */
  readonly currentValue?: any;

  /** 改进建议 */
  readonly improvement?: string;
}

/**
 * 配置元数据
 */
export interface ConfigMetadata {
  /** 创建时间 */
  readonly createdAt: Date;

  /** 创建者 */
  readonly createdBy: string;

  /** 最后修改时间 */
  readonly modifiedAt: Date;

  /** 最后修改者 */
  readonly modifiedBy: string;

  /** 配置描述 */
  readonly description?: string;

  /** 配置标签 */
  readonly tags: string[];

  /** 环境信息 */
  readonly environment: string;

  /** 配置来源 */
  readonly source: string;

  /** 自定义属性 */
  readonly customAttributes: Record<string, any>;
}

/**
 * 路由配置
 */
export interface RoutingConfig {
  /** 默认路由策略 */
  readonly defaultStrategy: string;

  /** 路由规则 */
  readonly rules: RoutingRule[];

  /** 路由类别 */
  readonly categories: Record<string, CategoryConfig>;

  /** 路由优先级 */
  readonly priorities: PriorityConfig[];

  /** 路由约束 */
  readonly constraints: RoutingConstraint[];
}

/**
 * 负载均衡配置
 */
export interface LoadBalancingConfig {
  /** 默认策略 */
  readonly defaultStrategy: string;

  /** 策略配置 */
  readonly strategies: Record<string, StrategyConfig>;

  /** 权重配置 */
  readonly weights: Record<string, number>;

  /** 健康阈值 */
  readonly healthThreshold: number;

  /** 全局设置 */
  readonly globalSettings: GlobalLoadBalanceSettings;
}

/**
 * 健康检查配置
 */
export interface HealthCheckConfig {
  /** 是否启用 */
  readonly enabled: boolean;

  /** 默认检查间隔 */
  readonly defaultInterval: number;

  /** 默认超时时间 */
  readonly defaultTimeout: number;

  /** 默认重试次数 */
  readonly defaultRetries: number;

  /** 检查方法配置 */
  readonly methods: Record<string, HealthCheckMethodConfig>;

  /** 阈值配置 */
  readonly thresholds: HealthThresholdConfig;
}

/**
 * Key管理配置
 */
export interface KeyManagementConfig {
  /** 轮询策略 */
  readonly rotationStrategy: string;

  /** 冷却时间 */
  readonly cooldownDuration: number;

  /** 最大重试次数 */
  readonly maxRetriesPerKey: number;

  /** 速率限制处理 */
  readonly rateLimitHandling: RateLimitConfig;

  /** Key池配置 */
  readonly keyPoolSettings: KeyPoolSettings;
}

/**
 * 监控配置
 */
export interface MonitoringConfig {
  /** 是否启用 */
  readonly enabled: boolean;

  /** 指标收集间隔 */
  readonly metricsInterval: number;

  /** 历史数据保留期 */
  readonly historyRetention: number;

  /** 告警配置 */
  readonly alerting: AlertingConfig;

  /** 导出器配置 */
  readonly exporters: ExporterConfig[];
}

/**
 * Provider配置
 */
export interface ProviderConfig {
  /** Provider类型 */
  readonly type: string;

  /** Provider名称 */
  readonly name: string;

  /** 是否启用 */
  readonly enabled: boolean;

  /** 优先级 */
  readonly priority: number;

  /** 连接配置 */
  readonly connection: ConnectionConfig;

  /** 认证配置 */
  readonly authentication: AuthenticationConfig;

  /** 模型配置 */
  readonly models: ModelConfig[];

  /** 限制配置 */
  readonly limits: LimitConfig;

  /** 特性支持 */
  readonly features: FeatureConfig;
}

/**
 * 零Fallback策略配置
 */
export interface ZeroFallbackConfig {
  /** 是否启用 */
  readonly enabled: true; // 强制启用

  /** 严格模式 */
  readonly strictMode: boolean;

  /** 失败时立即抛出错误 */
  readonly errorOnFailure: boolean;

  /** 最大重试次数（限制在同一Provider内） */
  readonly maxRetries: number;

  /** 错误传播配置 */
  readonly errorPropagation: ErrorPropagationConfig;
}

/**
 * 调试配置
 */
export interface DebugConfig {
  /** 是否启用 */
  readonly enabled: boolean;

  /** 调试级别 */
  readonly level: DebugLevel;

  /** 日志输出目标 */
  readonly logTarget: LogTarget;

  /** 性能监控 */
  readonly performanceMonitoring: boolean;

  /** 调试选项 */
  readonly options: DebugOptions;
}

/**
 * 配置管理器状态
 */
export interface ConfigManagerStatus {
  /** 当前配置版本 */
  readonly currentVersion: string;

  /** 是否正在监听配置变化 */
  readonly isWatching: boolean;

  /** 配置源状态 */
  readonly sourceStatus: ConfigSourceStatus[];

  /** 最后更新时间 */
  readonly lastUpdated: Date;

  /** 配置历史记录数 */
  readonly historyCount: number;

  /** 管理器统计 */
  readonly stats: ConfigManagerStats;

  /** 错误统计 */
  readonly errorStats: ConfigErrorStats;
}

// ========================= 回调和事件类型 =========================

/**
 * 配置变化回调函数
 */
export type ConfigChangeCallback = (
  newConfig: RouterConfig,
  oldConfig?: RouterConfig,
  changeDetails?: ConfigChangeDetails
) => void;

/**
 * 验证规则函数
 */
export type ValidationRule = (value: any, path: string, context: ValidationContext) => ValidationRuleResult;

/**
 * 转换器函数
 */
export type TransformerFunction = (config: any, options?: TransformOptions) => any;

// ========================= 枚举类型定义 =========================

/**
 * 配置源类型
 */
export type ConfigSourceType =
  | 'file' // 文件
  | 'url' // URL
  | 'env' // 环境变量
  | 'consul' // Consul
  | 'etcd' // etcd
  | 'database' // 数据库
  | 'memory' // 内存
  | 'custom'; // 自定义

/**
 * 配置格式
 */
export type ConfigFormat =
  | 'json' // JSON
  | 'yaml' // YAML
  | 'toml' // TOML
  | 'ini' // INI
  | 'env' // 环境变量
  | 'js' // JavaScript
  | 'ts'; // TypeScript

/**
 * 配置变更类型
 */
export type ConfigChangeType =
  | 'create' // 创建
  | 'update' // 更新
  | 'delete' // 删除
  | 'reload' // 重新加载
  | 'rollback' // 回滚
  | 'merge'; // 合并

/**
 * 错误严重级别
 */
export type ErrorSeverity =
  | 'low' // 低
  | 'medium' // 中
  | 'high' // 高
  | 'critical'; // 严重

/**
 * 调试级别
 */
export type DebugLevel =
  | 'none' // 无
  | 'basic' // 基础
  | 'detailed' // 详细
  | 'full'; // 完整

/**
 * 日志输出目标
 */
export type LogTarget =
  | 'console' // 控制台
  | 'file' // 文件
  | 'syslog' // 系统日志
  | 'network' // 网络
  | 'both'; // 多个目标

// ========================= 辅助类型和接口 =========================

/**
 * 配置源选项
 */
export interface ConfigSourceOptions {
  /** 编码格式 */
  readonly encoding?: string;

  /** 轮询间隔 */
  readonly pollInterval?: number;

  /** 超时时间 */
  readonly timeout?: number;

  /** 重试次数 */
  readonly retries?: number;

  /** 缓存选项 */
  readonly cache?: CacheOptions;

  /** 自定义选项 */
  readonly custom?: Record<string, any>;
}

/**
 * 配置凭据
 */
export interface ConfigCredentials {
  /** 用户名 */
  readonly username?: string;

  /** 密码 */
  readonly password?: string;

  /** API密钥 */
  readonly apiKey?: string;

  /** 令牌 */
  readonly token?: string;

  /** 证书 */
  readonly certificate?: string;

  /** 私钥 */
  readonly privateKey?: string;
}

/**
 * 加载器选项
 */
export interface LoaderOptions {
  /** 并发加载数 */
  readonly concurrency?: number;

  /** 缓存选项 */
  readonly cache?: CacheOptions;

  /** 重试选项 */
  readonly retry?: RetryOptions;

  /** 超时选项 */
  readonly timeout?: TimeoutOptions;
}

/**
 * 验证器选项
 */
export interface ValidatorOptions {
  /** 严格模式 */
  readonly strictMode?: boolean;

  /** 允许额外属性 */
  readonly allowAdditionalProperties?: boolean;

  /** 自定义错误消息 */
  readonly customErrorMessages?: Record<string, string>;

  /** 验证级别 */
  readonly validationLevel?: 'basic' | 'full' | 'strict';
}

/**
 * 监听器选项
 */
export interface WatcherOptions {
  /** 轮询间隔 */
  readonly pollInterval?: number;

  /** 防抖延迟 */
  readonly debounceDelay?: number;

  /** 是否监听子目录 */
  readonly recursive?: boolean;

  /** 忽略的文件模式 */
  readonly ignorePatterns?: string[];
}

/**
 * 配置更新详情
 */
export interface ConfigUpdateDetails {
  /** 变更摘要 */
  readonly changeSummary: string;

  /** 变更的字段 */
  readonly changedFields: string[];

  /** 变更前的值 */
  readonly previousValues: Record<string, any>;

  /** 变更后的值 */
  readonly newValues: Record<string, any>;

  /** 影响的组件 */
  readonly affectedComponents: string[];

  /** 更新策略 */
  readonly updateStrategy: string;
}

/**
 * 配置变更详情
 */
export interface ConfigChangeDetails {
  /** 变更类型 */
  readonly type: ConfigChangeType;

  /** 变更路径 */
  readonly path: string[];

  /** 变更前的值 */
  readonly oldValue?: any;

  /** 变更后的值 */
  readonly newValue?: any;

  /** 变更原因 */
  readonly reason?: string;

  /** 影响评估 */
  readonly impact?: ImpactAssessment;
}

/**
 * 验证上下文
 */
export interface ValidationContext {
  /** 当前路径 */
  readonly currentPath: string;

  /** 根配置 */
  readonly rootConfig: any;

  /** 验证选项 */
  readonly validationOptions: ValidatorOptions;

  /** 自定义上下文 */
  readonly customContext?: Record<string, any>;
}

/**
 * 验证规则结果
 */
export interface ValidationRuleResult {
  /** 是否通过 */
  readonly valid: boolean;

  /** 错误消息 */
  readonly errorMessage?: string;

  /** 警告消息 */
  readonly warningMessage?: string;

  /** 修复建议 */
  readonly fixSuggestion?: string;
}

/**
 * 转换选项
 */
export interface TransformOptions {
  /** 保留注释 */
  readonly preserveComments?: boolean;

  /** 格式化选项 */
  readonly formatting?: FormattingOptions;

  /** 自定义转换规则 */
  readonly customRules?: Record<string, any>;
}

/**
 * 监听句柄
 */
export interface WatchHandle {
  /** 句柄ID */
  readonly id: string;

  /** 配置源 */
  readonly source: ConfigSource;

  /** 创建时间 */
  readonly createdAt: Date;

  /** 是否活跃 */
  readonly active: boolean;
}

/**
 * 配置源状态
 */
export interface ConfigSourceStatus {
  /** 配置源 */
  readonly source: ConfigSource;

  /** 是否可用 */
  readonly available: boolean;

  /** 最后检查时间 */
  readonly lastChecked: Date;

  /** 最后成功时间 */
  readonly lastSuccess?: Date;

  /** 错误信息 */
  readonly error?: Error;

  /** 响应时间 */
  readonly responseTime?: number;
}

/**
 * 配置管理器统计
 */
export interface ConfigManagerStats {
  /** 总加载次数 */
  readonly totalLoads: number;

  /** 成功加载次数 */
  readonly successfulLoads: number;

  /** 失败加载次数 */
  readonly failedLoads: number;

  /** 平均加载时间 */
  readonly avgLoadTime: number;

  /** 配置更新次数 */
  readonly updateCount: number;

  /** 回滚次数 */
  readonly rollbackCount: number;
}

/**
 * 配置错误统计
 */
export interface ConfigErrorStats {
  /** 总错误数 */
  readonly totalErrors: number;

  /** 按类型分组的错误 */
  readonly errorsByType: Record<string, number>;

  /** 最近错误 */
  readonly recentErrors: ConfigError[];
}

/**
 * 配置错误
 */
export interface ConfigError {
  /** 错误时间 */
  readonly timestamp: Date;

  /** 错误类型 */
  readonly type: string;

  /** 错误消息 */
  readonly message: string;

  /** 错误源 */
  readonly source?: string;

  /** 错误上下文 */
  readonly context?: Record<string, any>;
}

/**
 * 影响评估
 */
export interface ImpactAssessment {
  /** 影响级别 */
  readonly level: 'low' | 'medium' | 'high' | 'critical';

  /** 影响的组件 */
  readonly affectedComponents: string[];

  /** 需要重启的服务 */
  readonly requiresRestart: boolean;

  /** 预估影响时间 */
  readonly estimatedImpactDuration?: number;

  /** 风险评估 */
  readonly riskAssessment?: string;
}

/**
 * 缓存选项
 */
export interface CacheOptions {
  /** 是否启用缓存 */
  readonly enabled: boolean;

  /** 缓存TTL */
  readonly ttl: number;

  /** 最大缓存大小 */
  readonly maxSize: number;

  /** 缓存策略 */
  readonly strategy: 'lru' | 'lfu' | 'fifo';
}

/**
 * 重试选项
 */
export interface RetryOptions {
  /** 最大重试次数 */
  readonly maxRetries: number;

  /** 重试间隔 */
  readonly retryDelay: number;

  /** 退避策略 */
  readonly backoffStrategy: 'linear' | 'exponential';

  /** 重试条件 */
  readonly retryCondition?: (error: Error) => boolean;
}

/**
 * 超时选项
 */
export interface TimeoutOptions {
  /** 连接超时 */
  readonly connectionTimeout: number;

  /** 读取超时 */
  readonly readTimeout: number;

  /** 写入超时 */
  readonly writeTimeout: number;
}

/**
 * 格式化选项
 */
export interface FormattingOptions {
  /** 缩进大小 */
  readonly indent: number;

  /** 使用制表符 */
  readonly useTabs: boolean;

  /** 行尾字符 */
  readonly lineEnding: 'lf' | 'crlf';

  /** 最大行长度 */
  readonly maxLineLength?: number;
}

// ========================= 具体配置接口 =========================

/**
 * 路由规则
 */
export interface RoutingRule {
  /** 规则ID */
  readonly id: string;

  /** 规则名称 */
  readonly name: string;

  /** 匹配条件 */
  readonly conditions: MatchCondition[];

  /** 目标Provider */
  readonly targetProvider: string;

  /** 权重 */
  readonly weight: number;

  /** 是否启用 */
  readonly enabled: boolean;
}

/**
 * 类别配置
 */
export interface CategoryConfig {
  /** 类别名称 */
  readonly name: string;

  /** 默认Provider */
  readonly defaultProvider: string;

  /** 类别权重 */
  readonly weight: number;

  /** 特殊规则 */
  readonly specialRules: RoutingRule[];
}

/**
 * 优先级配置
 */
export interface PriorityConfig {
  /** 优先级名称 */
  readonly name: string;

  /** 优先级值 */
  readonly value: number;

  /** 超时时间 */
  readonly timeout: number;

  /** 重试次数 */
  readonly retries: number;
}

/**
 * 路由约束
 */
export interface RoutingConstraint {
  /** 约束名称 */
  readonly name: string;

  /** 约束类型 */
  readonly type: string;

  /** 约束值 */
  readonly value: any;

  /** 是否强制 */
  readonly enforced: boolean;
}

/**
 * 匹配条件
 */
export interface MatchCondition {
  /** 匹配字段 */
  readonly field: string;

  /** 匹配操作符 */
  readonly operator: string;

  /** 匹配值 */
  readonly value: any;

  /** 大小写敏感 */
  readonly caseSensitive?: boolean;
}

/**
 * 策略配置
 */
export interface StrategyConfig {
  /** 策略名称 */
  readonly name: string;

  /** 策略参数 */
  readonly parameters: Record<string, any>;

  /** 是否启用 */
  readonly enabled: boolean;
}

/**
 * 全局负载均衡设置
 */
export interface GlobalLoadBalanceSettings {
  /** 选择超时 */
  readonly selectionTimeout: number;

  /** 最大重试次数 */
  readonly maxRetries: number;

  /** 并发限制 */
  readonly concurrencyLimit: number;
}

/**
 * 健康检查方法配置
 */
export interface HealthCheckMethodConfig {
  /** 方法名称 */
  readonly name: string;

  /** 检查间隔 */
  readonly interval: number;

  /** 超时时间 */
  readonly timeout: number;

  /** 重试次数 */
  readonly retries: number;

  /** 方法参数 */
  readonly parameters: Record<string, any>;
}

/**
 * 健康阈值配置
 */
export interface HealthThresholdConfig {
  /** 健康分数阈值 */
  readonly healthScoreThreshold: number;

  /** 响应时间阈值 */
  readonly responseTimeThreshold: number;

  /** 错误率阈值 */
  readonly errorRateThreshold: number;

  /** 可用性阈值 */
  readonly availabilityThreshold: number;
}

/**
 * 速率限制配置
 */
export interface RateLimitConfig {
  /** 冷却时间 */
  readonly cooldownMs: number;

  /** 最大连续失败次数 */
  readonly maxConsecutiveFailures: number;

  /** 退避策略 */
  readonly backoffStrategy: string;

  /** 退避参数 */
  readonly backoffParameters: Record<string, any>;
}

/**
 * Key池设置
 */
export interface KeyPoolSettings {
  /** 最小池大小 */
  readonly minPoolSize: number;

  /** 最大池大小 */
  readonly maxPoolSize: number;

  /** 池预热时间 */
  readonly warmupTime: number;

  /** 空闲超时 */
  readonly idleTimeout: number;
}

/**
 * 告警配置
 */
export interface AlertingConfig {
  /** 是否启用 */
  readonly enabled: boolean;

  /** 告警规则 */
  readonly rules: AlertRule[];

  /** 通知渠道 */
  readonly channels: NotificationChannel[];

  /** 静默期 */
  readonly silencePeriod: number;
}

/**
 * 导出器配置
 */
export interface ExporterConfig {
  /** 导出器类型 */
  readonly type: string;

  /** 导出器名称 */
  readonly name: string;

  /** 是否启用 */
  readonly enabled: boolean;

  /** 导出间隔 */
  readonly interval: number;

  /** 导出器参数 */
  readonly parameters: Record<string, any>;
}

/**
 * 连接配置
 */
export interface ConnectionConfig {
  /** 端点URL */
  readonly endpoint: string;

  /** 超时时间 */
  readonly timeout: number;

  /** 重试次数 */
  readonly retries: number;

  /** 连接池设置 */
  readonly poolSettings: ConnectionPoolSettings;
}

/**
 * 认证配置
 */
export interface AuthenticationConfig {
  /** 认证类型 */
  readonly type: string;

  /** 凭据 */
  readonly credentials: Record<string, any>;

  /** 令牌刷新间隔 */
  readonly tokenRefreshInterval?: number;
}

/**
 * 模型配置
 */
export interface ModelConfig {
  /** 模型名称 */
  readonly name: string;

  /** 模型别名 */
  readonly aliases: string[];

  /** 是否启用 */
  readonly enabled: boolean;

  /** 模型参数 */
  readonly parameters: Record<string, any>;

  /** 限制设置 */
  readonly limits: ModelLimitConfig;
}

/**
 * 限制配置
 */
export interface LimitConfig {
  /** 速率限制 */
  readonly rateLimit: RateLimitSettings;

  /** 并发限制 */
  readonly concurrencyLimit: number;

  /** 配额限制 */
  readonly quotaLimit: QuotaSettings;
}

/**
 * 特性配置
 */
export interface FeatureConfig {
  /** 支持的特性 */
  readonly supportedFeatures: string[];

  /** 特性参数 */
  readonly featureParameters: Record<string, any>;

  /** 实验性特性 */
  readonly experimentalFeatures: string[];
}

/**
 * 错误传播配置
 */
export interface ErrorPropagationConfig {
  /** 传播策略 */
  readonly strategy: string;

  /** 错误映射 */
  readonly errorMapping: Record<string, string>;

  /** 堆栈跟踪 */
  readonly includeStackTrace: boolean;
}

/**
 * 调试选项
 */
export interface DebugOptions {
  /** 详细日志 */
  readonly verboseLogging: boolean;

  /** 性能分析 */
  readonly profiling: boolean;

  /** 内存监控 */
  readonly memoryMonitoring: boolean;

  /** 自定义选项 */
  readonly custom: Record<string, any>;
}

/**
 * 告警规则
 */
export interface AlertRule {
  /** 规则名称 */
  readonly name: string;

  /** 规则条件 */
  readonly condition: string;

  /** 阈值 */
  readonly threshold: number;

  /** 严重级别 */
  readonly severity: string;

  /** 描述 */
  readonly description: string;
}

/**
 * 通知渠道
 */
export interface NotificationChannel {
  /** 渠道类型 */
  readonly type: string;

  /** 渠道名称 */
  readonly name: string;

  /** 渠道配置 */
  readonly config: Record<string, any>;

  /** 是否启用 */
  readonly enabled: boolean;
}

/**
 * 连接池设置
 */
export interface ConnectionPoolSettings {
  /** 最大连接数 */
  readonly maxConnections: number;

  /** 最小连接数 */
  readonly minConnections: number;

  /** 连接超时 */
  readonly connectionTimeout: number;

  /** 空闲超时 */
  readonly idleTimeout: number;
}

/**
 * 模型限制配置
 */
export interface ModelLimitConfig {
  /** 最大令牌数 */
  readonly maxTokens: number;

  /** 请求频率限制 */
  readonly requestRateLimit: number;

  /** 并发请求限制 */
  readonly concurrentRequests: number;
}

/**
 * 速率限制设置
 */
export interface RateLimitSettings {
  /** 请求数限制 */
  readonly requests: number;

  /** 时间窗口 */
  readonly timeWindow: number;

  /** 突发限制 */
  readonly burstLimit: number;
}

/**
 * 配额设置
 */
export interface QuotaSettings {
  /** 每日配额 */
  readonly dailyQuota: number;

  /** 每月配额 */
  readonly monthlyQuota: number;

  /** 配额重置时间 */
  readonly resetTime: string;
}
