/**
 * 健康检查器接口定义
 *
 * 定义独立的健康监控接口，与路由器和负载均衡器分离
 * 专注于Provider健康状态监控和评估
 *
 * @author RCC4 Architecture Team
 * @version 4.0.0-beta.1
 */

// ========================= 健康检查器接口 =========================

/**
 * 健康检查器接口
 *
 * 职责：独立的健康监控服务
 * - 定期检查Provider可用性
 * - 健康状态评估和报告
 * - 故障检测和恢复监控
 */
export interface HealthChecker {
  /**
   * 检查单个Provider健康状态
   *
   * @param providerId Provider ID
   * @returns 健康状态
   */
  checkHealth(providerId: string): Promise<HealthStatus>;

  /**
   * 检查所有Provider健康状态
   *
   * @returns Provider健康状态映射
   */
  checkAllProviders(): Promise<Record<string, HealthStatus>>;

  /**
   * 启动健康监控
   */
  startMonitoring(): void;

  /**
   * 停止健康监控
   */
  stopMonitoring(): void;

  /**
   * 获取Provider健康状态
   *
   * @param providerId Provider ID
   * @returns 当前健康状态
   */
  getHealthStatus(providerId: string): HealthStatus | undefined;

  /**
   * 订阅健康状态变化事件
   *
   * @param callback 状态变化回调函数
   * @returns 取消订阅函数
   */
  subscribeToHealthChanges(callback: HealthChangeCallback): () => void;

  /**
   * 设置健康检查间隔
   *
   * @param interval 检查间隔（毫秒）
   */
  setCheckInterval(interval: number): void;

  /**
   * 获取健康检查历史
   *
   * @param providerId Provider ID
   * @param limit 返回记录数限制
   * @returns 健康检查历史记录
   */
  getHealthHistory(providerId: string, limit?: number): HealthCheckRecord[];

  /**
   * 手动触发健康检查
   *
   * @param providerId Provider ID（可选，不指定则检查所有）
   * @returns 检查结果
   */
  triggerHealthCheck(providerId?: string): Promise<Record<string, HealthStatus>>;

  /**
   * 获取健康检查器状态
   *
   * @returns 检查器状态信息
   */
  getCheckerStatus(): HealthCheckerStatus;
}

/**
 * Provider健康监控器接口
 *
 * 职责：监控单个Provider的健康状态
 */
export interface ProviderHealthMonitor {
  /**
   * 开始监控
   *
   * @param providerId Provider ID
   * @param config 监控配置
   */
  startMonitoring(providerId: string, config: MonitoringConfig): void;

  /**
   * 停止监控
   *
   * @param providerId Provider ID
   */
  stopMonitoring(providerId: string): void;

  /**
   * 执行健康检查
   *
   * @param providerId Provider ID
   * @returns 健康检查结果
   */
  performHealthCheck(providerId: string): Promise<HealthCheckResult>;

  /**
   * 更新监控配置
   *
   * @param providerId Provider ID
   * @param config 新的监控配置
   */
  updateConfig(providerId: string, config: MonitoringConfig): void;

  /**
   * 获取监控统计
   *
   * @param providerId Provider ID
   * @returns 监控统计信息
   */
  getMonitoringStats(providerId: string): MonitoringStats;
}

/**
 * 健康状态管理器接口
 *
 * 职责：管理和存储健康状态信息
 */
export interface HealthStatusManager {
  /**
   * 更新健康状态
   *
   * @param providerId Provider ID
   * @param status 新的健康状态
   */
  updateHealthStatus(providerId: string, status: HealthStatus): void;

  /**
   * 获取健康状态
   *
   * @param providerId Provider ID
   * @returns 健康状态
   */
  getHealthStatus(providerId: string): HealthStatus | undefined;

  /**
   * 获取所有健康状态
   *
   * @returns 所有Provider的健康状态
   */
  getAllHealthStatus(): Record<string, HealthStatus>;

  /**
   * 删除健康状态记录
   *
   * @param providerId Provider ID
   */
  removeHealthStatus(providerId: string): void;

  /**
   * 清空所有健康状态
   */
  clearAllHealthStatus(): void;

  /**
   * 获取健康状态历史
   *
   * @param providerId Provider ID
   * @param timeRange 时间范围
   * @returns 健康状态历史
   */
  getHealthStatusHistory(providerId: string, timeRange: TimeRange): HealthStatus[];

  /**
   * 订阅状态变化
   *
   * @param providerId Provider ID（可选，不指定则订阅所有）
   * @param callback 变化回调函数
   * @returns 取消订阅函数
   */
  subscribe(providerId: string | undefined, callback: HealthChangeCallback): () => void;
}

/**
 * 恢复管理器接口
 *
 * 职责：管理Provider故障恢复
 */
export interface RecoveryManager {
  /**
   * 启动恢复检查
   *
   * @param providerId Provider ID
   * @param config 恢复配置
   */
  startRecoveryCheck(providerId: string, config: RecoveryConfig): void;

  /**
   * 停止恢复检查
   *
   * @param providerId Provider ID
   */
  stopRecoveryCheck(providerId: string): void;

  /**
   * 手动触发恢复检查
   *
   * @param providerId Provider ID
   * @returns 恢复检查结果
   */
  triggerRecoveryCheck(providerId: string): Promise<RecoveryResult>;

  /**
   * 标记Provider为恢复中
   *
   * @param providerId Provider ID
   * @param reason 恢复原因
   */
  markAsRecovering(providerId: string, reason: string): void;

  /**
   * 标记Provider恢复完成
   *
   * @param providerId Provider ID
   */
  markAsRecovered(providerId: string): void;

  /**
   * 获取恢复状态
   *
   * @param providerId Provider ID
   * @returns 恢复状态信息
   */
  getRecoveryStatus(providerId: string): RecoveryStatus | undefined;

  /**
   * 获取所有恢复状态
   *
   * @returns 所有Provider的恢复状态
   */
  getAllRecoveryStatus(): Record<string, RecoveryStatus>;
}

/**
 * 健康评估器接口
 *
 * 职责：评估和计算健康分数
 */
export interface HealthEvaluator {
  /**
   * 评估健康状态
   *
   * @param checkResult 健康检查结果
   * @param history 历史健康数据
   * @returns 评估后的健康状态
   */
  evaluateHealth(checkResult: HealthCheckResult, history: HealthCheckRecord[]): HealthStatus;

  /**
   * 计算健康分数
   *
   * @param metrics 健康指标
   * @param weights 指标权重
   * @returns 健康分数 (0-100)
   */
  calculateHealthScore(metrics: HealthMetrics, weights?: HealthWeights): number;

  /**
   * 评估趋势
   *
   * @param history 历史健康数据
   * @param timeWindow 时间窗口
   * @returns 健康趋势分析
   */
  evaluateTrend(history: HealthCheckRecord[], timeWindow: number): HealthTrend;

  /**
   * 预测健康状态
   *
   * @param history 历史健康数据
   * @param predictionWindow 预测窗口
   * @returns 健康状态预测
   */
  predictHealth(history: HealthCheckRecord[], predictionWindow: number): HealthPrediction;

  /**
   * 设置评估策略
   *
   * @param strategy 评估策略
   */
  setEvaluationStrategy(strategy: EvaluationStrategy): void;

  /**
   * 获取当前评估策略
   *
   * @returns 当前评估策略
   */
  getEvaluationStrategy(): EvaluationStrategy;
}

// ========================= 数据结构定义 =========================

/**
 * 健康状态
 */
export interface HealthStatus {
  /** Provider ID */
  readonly providerId: string;

  /** 是否健康 */
  readonly isHealthy: boolean;

  /** 健康分数 (0-100) */
  readonly healthScore: number;

  /** 状态级别 */
  readonly statusLevel: HealthLevel;

  /** 响应时间 (毫秒) */
  readonly responseTime: number;

  /** 错误率 (0-1) */
  readonly errorRate: number;

  /** 可用性 (0-1) */
  readonly availability: number;

  /** 最后检查时间 */
  readonly lastChecked: Date;

  /** 连续失败次数 */
  readonly consecutiveFailures: number;

  /** 连续成功次数 */
  readonly consecutiveSuccesses: number;

  /** 状态变化时间 */
  readonly statusChangedAt: Date;

  /** 详细信息 */
  readonly details: HealthDetails;

  /** 健康指标 */
  readonly metrics: HealthMetrics;

  /** 错误信息 */
  readonly error?: Error;
}

/**
 * 健康检查结果
 */
export interface HealthCheckResult {
  /** Provider ID */
  readonly providerId: string;

  /** 检查是否成功 */
  readonly success: boolean;

  /** 响应时间 */
  readonly responseTime: number;

  /** 检查时间 */
  readonly checkTime: Date;

  /** 检查方法 */
  readonly checkMethod: HealthCheckMethod;

  /** 原始响应数据 */
  readonly rawResponse?: any;

  /** 错误信息 */
  readonly error?: Error;

  /** 检查详情 */
  readonly checkDetails: HealthCheckDetails;

  /** 网络信息 */
  readonly networkInfo?: NetworkInfo;
}

/**
 * 健康检查记录
 */
export interface HealthCheckRecord {
  /** 记录ID */
  readonly id: string;

  /** Provider ID */
  readonly providerId: string;

  /** 检查结果 */
  readonly result: HealthCheckResult;

  /** 评估后的健康状态 */
  readonly healthStatus: HealthStatus;

  /** 记录创建时间 */
  readonly createdAt: Date;

  /** 记录版本 */
  readonly version: number;
}

/**
 * 健康详情
 */
export interface HealthDetails {
  /** 状态消息 */
  readonly statusMessage: string;

  /** 检查方法详情 */
  readonly checkMethodDetails: Record<string, any>;

  /** 性能指标 */
  readonly performanceMetrics: PerformanceMetrics;

  /** 依赖服务状态 */
  readonly dependencyStatus: DependencyStatus[];

  /** 诊断信息 */
  readonly diagnostics: DiagnosticInfo[];

  /** 元数据 */
  readonly metadata: Record<string, any>;
}

/**
 * 健康指标
 */
export interface HealthMetrics {
  /** CPU 使用率 */
  readonly cpuUsage?: number;

  /** 内存使用率 */
  readonly memoryUsage?: number;

  /** 磁盘使用率 */
  readonly diskUsage?: number;

  /** 网络延迟 */
  readonly networkLatency: number;

  /** 吞吐量 */
  readonly throughput: number;

  /** 并发连接数 */
  readonly concurrentConnections: number;

  /** 队列长度 */
  readonly queueLength: number;

  /** 自定义指标 */
  readonly customMetrics: Record<string, number>;
}

/**
 * 健康检查详情
 */
export interface HealthCheckDetails {
  /** 检查步骤 */
  readonly checkSteps: CheckStep[];

  /** 超时设置 */
  readonly timeout: number;

  /** 重试次数 */
  readonly retries: number;

  /** 检查配置 */
  readonly checkConfig: HealthCheckConfig;

  /** 执行上下文 */
  readonly executionContext: ExecutionContext;
}

/**
 * 监控配置
 */
export interface MonitoringConfig {
  /** 检查间隔 (毫秒) */
  readonly interval: number;

  /** 检查超时 (毫秒) */
  readonly timeout: number;

  /** 最大重试次数 */
  readonly maxRetries: number;

  /** 健康检查方法 */
  readonly checkMethods: HealthCheckMethod[];

  /** 失败阈值 */
  readonly failureThreshold: number;

  /** 成功阈值 */
  readonly successThreshold: number;

  /** 健康权重配置 */
  readonly healthWeights: HealthWeights;

  /** 是否启用预测 */
  readonly enablePrediction: boolean;

  /** 历史数据保留期 */
  readonly historyRetention: number;
}

/**
 * 恢复配置
 */
export interface RecoveryConfig {
  /** 恢复检查间隔 */
  readonly recoveryInterval: number;

  /** 最大恢复时间 */
  readonly maxRecoveryTime: number;

  /** 恢复策略 */
  readonly recoveryStrategy: RecoveryStrategy;

  /** 退避策略 */
  readonly backoffStrategy: BackoffStrategy;

  /** 自动恢复开关 */
  readonly autoRecovery: boolean;

  /** 恢复回调 */
  readonly recoveryCallbacks: RecoveryCallback[];
}

/**
 * 恢复结果
 */
export interface RecoveryResult {
  /** Provider ID */
  readonly providerId: string;

  /** 恢复是否成功 */
  readonly success: boolean;

  /** 恢复时间 */
  readonly recoveryTime: number;

  /** 恢复尝试次数 */
  readonly attempts: number;

  /** 恢复策略 */
  readonly usedStrategy: RecoveryStrategy;

  /** 恢复详情 */
  readonly details: RecoveryDetails;

  /** 错误信息 */
  readonly error?: Error;
}

/**
 * 恢复状态
 */
export interface RecoveryStatus {
  /** Provider ID */
  readonly providerId: string;

  /** 恢复状态 */
  readonly status: RecoveryState;

  /** 开始恢复时间 */
  readonly startTime: Date;

  /** 预估恢复时间 */
  readonly estimatedRecoveryTime?: Date;

  /** 已尝试次数 */
  readonly attempts: number;

  /** 最大尝试次数 */
  readonly maxAttempts: number;

  /** 当前策略 */
  readonly currentStrategy: RecoveryStrategy;

  /** 下次尝试时间 */
  readonly nextAttemptTime?: Date;

  /** 恢复原因 */
  readonly reason: string;
}

/**
 * 健康趋势
 */
export interface HealthTrend {
  /** Provider ID */
  readonly providerId: string;

  /** 趋势方向 */
  readonly direction: TrendDirection;

  /** 趋势强度 */
  readonly strength: number;

  /** 置信度 */
  readonly confidence: number;

  /** 分析时间窗口 */
  readonly timeWindow: number;

  /** 趋势指标 */
  readonly trendMetrics: TrendMetrics;

  /** 分析时间 */
  readonly analyzedAt: Date;
}

/**
 * 健康预测
 */
export interface HealthPrediction {
  /** Provider ID */
  readonly providerId: string;

  /** 预测健康分数 */
  readonly predictedScore: number;

  /** 预测时间 */
  readonly predictedAt: Date;

  /** 预测窗口 */
  readonly predictionWindow: number;

  /** 预测置信度 */
  readonly confidence: number;

  /** 预测模型 */
  readonly model: PredictionModel;

  /** 影响因素 */
  readonly influencingFactors: InfluencingFactor[];
}

/**
 * 监控统计
 */
export interface MonitoringStats {
  /** Provider ID */
  readonly providerId: string;

  /** 总检查次数 */
  readonly totalChecks: number;

  /** 成功检查次数 */
  readonly successfulChecks: number;

  /** 失败检查次数 */
  readonly failedChecks: number;

  /** 平均响应时间 */
  readonly avgResponseTime: number;

  /** 最快响应时间 */
  readonly minResponseTime: number;

  /** 最慢响应时间 */
  readonly maxResponseTime: number;

  /** 可用性百分比 */
  readonly availabilityPercentage: number;

  /** 平均健康分数 */
  readonly avgHealthScore: number;

  /** 最后检查时间 */
  readonly lastCheckTime: Date;

  /** 统计时间范围 */
  readonly timeRange: TimeRange;
}

/**
 * 健康检查器状态
 */
export interface HealthCheckerStatus {
  /** 是否正在监控 */
  readonly isMonitoring: boolean;

  /** 监控的Provider数量 */
  readonly monitoredProviders: number;

  /** 健康的Provider数量 */
  readonly healthyProviders: number;

  /** 不健康的Provider数量 */
  readonly unhealthyProviders: number;

  /** 总检查次数 */
  readonly totalChecks: number;

  /** 检查器启动时间 */
  readonly startTime: Date;

  /** 最后活动时间 */
  readonly lastActivity: Date;

  /** 检查器配置 */
  readonly config: HealthCheckerConfig;

  /** 性能统计 */
  readonly performanceStats: CheckerPerformanceStats;
}

// ========================= 回调和事件类型 =========================

/**
 * 健康状态变化回调函数
 */
export type HealthChangeCallback = (providerId: string, newStatus: HealthStatus, oldStatus?: HealthStatus) => void;

/**
 * 恢复回调函数
 */
export type RecoveryCallback = (providerId: string, result: RecoveryResult) => void;

// ========================= 枚举类型定义 =========================

/**
 * 健康级别
 */
export type HealthLevel =
  | 'excellent' // 优秀 (90-100)
  | 'good' // 良好 (70-89)
  | 'fair' // 一般 (50-69)
  | 'poor' // 较差 (30-49)
  | 'critical'; // 严重 (0-29)

/**
 * 健康检查方法
 */
export type HealthCheckMethod =
  | 'ping' // Ping检查
  | 'http' // HTTP请求检查
  | 'tcp' // TCP连接检查
  | 'api' // API调用检查
  | 'custom' // 自定义检查
  | 'composite'; // 复合检查

/**
 * 恢复状态
 */
export type RecoveryState =
  | 'not_needed' // 无需恢复
  | 'pending' // 等待恢复
  | 'in_progress' // 恢复中
  | 'success' // 恢复成功
  | 'failed' // 恢复失败
  | 'timeout'; // 恢复超时

/**
 * 趋势方向
 */
export type TrendDirection =
  | 'improving' // 改善
  | 'stable' // 稳定
  | 'degrading' // 恶化
  | 'unknown'; // 未知

/**
 * 恢复策略
 */
export type RecoveryStrategy =
  | 'immediate' // 立即重试
  | 'exponential' // 指数退避
  | 'linear' // 线性退避
  | 'custom'; // 自定义策略

/**
 * 退避策略
 */
export type BackoffStrategy =
  | 'constant' // 固定间隔
  | 'linear' // 线性增长
  | 'exponential' // 指数增长
  | 'fibonacci'; // 斐波那契数列

/**
 * 评估策略
 */
export type EvaluationStrategy =
  | 'weighted' // 加权评估
  | 'threshold' // 阈值评估
  | 'trend' // 趋势评估
  | 'ml' // 机器学习评估
  | 'composite'; // 复合评估

// ========================= 辅助类型和接口 =========================

/**
 * 时间范围
 */
export interface TimeRange {
  /** 开始时间 */
  readonly start: Date;

  /** 结束时间 */
  readonly end: Date;
}

/**
 * 检查步骤
 */
export interface CheckStep {
  /** 步骤名称 */
  readonly name: string;

  /** 步骤结果 */
  readonly success: boolean;

  /** 执行时间 */
  readonly duration: number;

  /** 错误信息 */
  readonly error?: Error;

  /** 步骤详情 */
  readonly details?: Record<string, any>;
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  /** 响应时间 */
  readonly responseTime: number;

  /** 吞吐量 */
  readonly throughput: number;

  /** 并发数 */
  readonly concurrency: number;

  /** 错误率 */
  readonly errorRate: number;
}

/**
 * 依赖服务状态
 */
export interface DependencyStatus {
  /** 服务名称 */
  readonly serviceName: string;

  /** 是否可用 */
  readonly available: boolean;

  /** 响应时间 */
  readonly responseTime: number;

  /** 版本信息 */
  readonly version?: string;
}

/**
 * 诊断信息
 */
export interface DiagnosticInfo {
  /** 诊断项名称 */
  readonly name: string;

  /** 诊断结果 */
  readonly result: string;

  /** 诊断级别 */
  readonly level: 'info' | 'warning' | 'error';

  /** 诊断详情 */
  readonly details?: Record<string, any>;
}

/**
 * 网络信息
 */
export interface NetworkInfo {
  /** 本地IP */
  readonly localIP: string;

  /** 远程IP */
  readonly remoteIP: string;

  /** 连接时间 */
  readonly connectionTime: number;

  /** 网络延迟 */
  readonly latency: number;

  /** 丢包率 */
  readonly packetLoss: number;
}

/**
 * 执行上下文
 */
export interface ExecutionContext {
  /** 执行ID */
  readonly executionId: string;

  /** 执行时间 */
  readonly executionTime: Date;

  /** 执行器信息 */
  readonly executor: string;

  /** 执行环境 */
  readonly environment: Record<string, any>;
}

/**
 * 健康权重
 */
export interface HealthWeights {
  /** 响应时间权重 */
  readonly responseTime: number;

  /** 错误率权重 */
  readonly errorRate: number;

  /** 可用性权重 */
  readonly availability: number;

  /** 吞吐量权重 */
  readonly throughput: number;

  /** 自定义指标权重 */
  readonly customMetrics: Record<string, number>;
}

/**
 * 健康检查配置
 */
export interface HealthCheckConfig {
  /** 检查URL */
  readonly url?: string;

  /** 检查端口 */
  readonly port?: number;

  /** 检查路径 */
  readonly path?: string;

  /** 请求头 */
  readonly headers?: Record<string, string>;

  /** 期望状态码 */
  readonly expectedStatusCode?: number;

  /** 期望响应内容 */
  readonly expectedContent?: string;
}

/**
 * 恢复详情
 */
export interface RecoveryDetails {
  /** 恢复步骤 */
  readonly steps: RecoveryStep[];

  /** 使用的策略 */
  readonly usedStrategy: RecoveryStrategy;

  /** 总耗时 */
  readonly totalDuration: number;

  /** 额外信息 */
  readonly additionalInfo: Record<string, any>;
}

/**
 * 恢复步骤
 */
export interface RecoveryStep {
  /** 步骤名称 */
  readonly name: string;

  /** 步骤结果 */
  readonly success: boolean;

  /** 执行时间 */
  readonly duration: number;

  /** 错误信息 */
  readonly error?: Error;
}

/**
 * 趋势指标
 */
export interface TrendMetrics {
  /** 斜率 */
  readonly slope: number;

  /** 相关系数 */
  readonly correlation: number;

  /** 方差 */
  readonly variance: number;

  /** 标准差 */
  readonly standardDeviation: number;
}

/**
 * 预测模型
 */
export interface PredictionModel {
  /** 模型名称 */
  readonly name: string;

  /** 模型类型 */
  readonly type: 'linear' | 'exponential' | 'neural' | 'arima';

  /** 模型参数 */
  readonly parameters: Record<string, any>;

  /** 模型准确性 */
  readonly accuracy: number;
}

/**
 * 影响因素
 */
export interface InfluencingFactor {
  /** 因素名称 */
  readonly name: string;

  /** 影响权重 */
  readonly weight: number;

  /** 影响方向 */
  readonly direction: 'positive' | 'negative';

  /** 置信度 */
  readonly confidence: number;
}

/**
 * 健康检查器配置
 */
export interface HealthCheckerConfig {
  /** 默认检查间隔 */
  readonly defaultInterval: number;

  /** 默认超时时间 */
  readonly defaultTimeout: number;

  /** 默认重试次数 */
  readonly defaultRetries: number;

  /** 并发检查数 */
  readonly concurrentChecks: number;

  /** 是否启用预测 */
  readonly enablePrediction: boolean;

  /** 历史数据保留期 */
  readonly historyRetention: number;
}

/**
 * 检查器性能统计
 */
export interface CheckerPerformanceStats {
  /** 平均检查时间 */
  readonly avgCheckTime: number;

  /** 检查吞吐量 */
  readonly checkThroughput: number;

  /** 内存使用量 */
  readonly memoryUsage: number;

  /** CPU 使用率 */
  readonly cpuUsage: number;

  /** 错误率 */
  readonly errorRate: number;
}
