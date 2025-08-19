/**
 * 负载均衡器接口定义
 *
 * 定义独立的负载均衡接口，与路由器完全分离
 * 专注于流量分发和负载均衡策略实现
 *
 * @author RCC4 Architecture Team
 * @version 4.0.0-beta.1
 */

// ========================= 负载均衡器接口 =========================

/**
 * 负载均衡器接口
 *
 * 职责：独立的负载均衡策略实现
 * - 轮询、加权、最少连接等策略
 * - 动态权重调整
 * - 流量分发优化
 */
export interface LoadBalancer {
  /**
   * 选择Provider
   *
   * @param candidates 候选Provider列表
   * @param strategy 负载均衡策略
   * @param context 选择上下文
   * @returns 选中的Provider
   */
  select(candidates: ProviderCandidate[], strategy: LoadBalanceStrategy, context?: SelectionContext): ProviderCandidate;

  /**
   * 更新权重
   *
   * @param weights Provider权重映射
   */
  updateWeights(weights: Map<string, number>): void;

  /**
   * 获取负载均衡指标
   *
   * @returns 负载均衡指标
   */
  getMetrics(): LoadBalanceMetrics;

  /**
   * 重置负载均衡状态
   */
  reset(): void;

  /**
   * 获取当前策略
   *
   * @returns 当前使用的负载均衡策略
   */
  getCurrentStrategy(): LoadBalanceStrategy;

  /**
   * 设置负载均衡策略
   *
   * @param strategy 新的负载均衡策略
   */
  setStrategy(strategy: LoadBalanceStrategy): void;
}

/**
 * 负载均衡策略基础接口
 */
export interface LoadBalanceStrategy {
  /** 策略名称 */
  readonly name: string;

  /** 策略类型 */
  readonly type: StrategyType;

  /**
   * 选择Provider
   *
   * @param candidates 候选Provider列表
   * @param context 选择上下文
   * @returns 选中的Provider
   */
  select(candidates: ProviderCandidate[], context?: SelectionContext): ProviderCandidate;

  /**
   * 更新策略配置
   *
   * @param config 策略配置
   */
  updateConfig(config: StrategyConfig): void;

  /**
   * 获取策略状态
   *
   * @returns 策略状态信息
   */
  getState(): StrategyState;

  /**
   * 重置策略状态
   */
  reset(): void;
}

/**
 * 轮询负载均衡策略
 */
export interface RoundRobinStrategy extends LoadBalanceStrategy {
  readonly name: 'round-robin';
  readonly type: 'deterministic';

  /**
   * 获取当前索引
   *
   * @returns 当前轮询索引
   */
  getCurrentIndex(): number;

  /**
   * 重置索引
   */
  resetIndex(): void;
}

/**
 * 加权负载均衡策略
 */
export interface WeightedStrategy extends LoadBalanceStrategy {
  readonly name: 'weighted';
  readonly type: 'weighted';

  /**
   * 获取权重配置
   *
   * @returns Provider权重映射
   */
  getWeights(): Record<string, number>;

  /**
   * 设置单个Provider权重
   *
   * @param providerId Provider ID
   * @param weight 权重值
   */
  setWeight(providerId: string, weight: number): void;

  /**
   * 批量更新权重
   *
   * @param weights 权重映射
   */
  updateWeights(weights: Record<string, number>): void;
}

/**
 * 最少连接负载均衡策略
 */
export interface LeastConnectionsStrategy extends LoadBalanceStrategy {
  readonly name: 'least-connections';
  readonly type: 'dynamic';

  /**
   * 获取连接数统计
   *
   * @returns Provider连接数映射
   */
  getConnectionCounts(): Record<string, number>;

  /**
   * 更新连接数
   *
   * @param providerId Provider ID
   * @param delta 连接数变化量
   */
  updateConnectionCount(providerId: string, delta: number): void;

  /**
   * 重置连接数统计
   */
  resetConnectionCounts(): void;
}

/**
 * 健康感知负载均衡策略
 */
export interface HealthAwareStrategy extends LoadBalanceStrategy {
  readonly name: 'health-aware';
  readonly type: 'adaptive';

  /**
   * 更新健康状态
   *
   * @param healthStates Provider健康状态映射
   */
  updateHealthStates(healthStates: Record<string, HealthScore>): void;

  /**
   * 获取健康阈值
   *
   * @returns 健康状态阈值配置
   */
  getHealthThresholds(): HealthThresholds;

  /**
   * 设置健康阈值
   *
   * @param thresholds 新的健康阈值配置
   */
  setHealthThresholds(thresholds: HealthThresholds): void;
}

/**
 * 自适应负载均衡策略
 */
export interface AdaptiveStrategy extends LoadBalanceStrategy {
  readonly name: 'adaptive';
  readonly type: 'adaptive';

  /**
   * 更新性能指标
   *
   * @param metrics Provider性能指标
   */
  updateMetrics(metrics: Record<string, PerformanceMetrics>): void;

  /**
   * 获取自适应配置
   *
   * @returns 自适应策略配置
   */
  getAdaptiveConfig(): AdaptiveConfig;

  /**
   * 设置自适应配置
   *
   * @param config 新的自适应配置
   */
  setAdaptiveConfig(config: AdaptiveConfig): void;
}

// ========================= 数据结构定义 =========================

/**
 * Provider候选者信息
 */
export interface ProviderCandidate {
  /** Provider ID */
  readonly id: string;

  /** Provider类型 */
  readonly type: string;

  /** 当前权重 */
  readonly weight: number;

  /** 是否可用 */
  readonly available: boolean;

  /** 健康分数 (0-100) */
  readonly healthScore: number;

  /** 当前负载 */
  readonly currentLoad: number;

  /** 最大负载容量 */
  readonly maxCapacity: number;

  /** 响应时间 (毫秒) */
  readonly responseTime: number;

  /** 错误率 (0-1) */
  readonly errorRate: number;

  /** Provider标签 */
  readonly tags: string[];

  /** 扩展元数据 */
  readonly metadata: Record<string, any>;
}

/**
 * 选择上下文
 */
export interface SelectionContext {
  /** 请求优先级 */
  readonly priority?: 'high' | 'normal' | 'low';

  /** 请求类型 */
  readonly requestType?: string;

  /** 会话信息 */
  readonly sessionInfo?: SessionInfo;

  /** 地理位置信息 */
  readonly geoInfo?: GeoInfo;

  /** 性能要求 */
  readonly performanceRequirements?: PerformanceRequirements;

  /** 自定义属性 */
  readonly customAttributes?: Record<string, any>;
}

/**
 * 负载均衡指标
 */
export interface LoadBalanceMetrics {
  /** 总选择次数 */
  readonly totalSelections: number;

  /** 每个Provider的选择次数 */
  readonly selectionsByProvider: Record<string, number>;

  /** 平均选择时间 */
  readonly avgSelectionTime: number;

  /** 负载分布情况 */
  readonly loadDistribution: LoadDistribution;

  /** 策略效率指标 */
  readonly strategyEfficiency: StrategyEfficiency;

  /** 最后更新时间 */
  readonly lastUpdated: Date;
}

/**
 * 策略配置
 */
export interface StrategyConfig {
  /** 配置名称 */
  readonly name: string;

  /** 配置参数 */
  readonly parameters: Record<string, any>;

  /** 是否启用 */
  readonly enabled: boolean;

  /** 配置版本 */
  readonly version: string;
}

/**
 * 策略状态
 */
export interface StrategyState {
  /** 当前状态 */
  readonly status: 'active' | 'inactive' | 'error';

  /** 状态更新时间 */
  readonly lastUpdated: Date;

  /** 内部状态数据 */
  readonly internalState: Record<string, any>;

  /** 错误信息 */
  readonly error?: Error;
}

/**
 * 健康分数
 */
export interface HealthScore {
  /** 整体健康分数 (0-100) */
  readonly overall: number;

  /** 响应时间分数 */
  readonly responseTime: number;

  /** 错误率分数 */
  readonly errorRate: number;

  /** 可用性分数 */
  readonly availability: number;

  /** 最后更新时间 */
  readonly lastUpdated: Date;
}

/**
 * 健康阈值配置
 */
export interface HealthThresholds {
  /** 最低健康分数阈值 */
  readonly minHealthScore: number;

  /** 最大响应时间阈值 (毫秒) */
  readonly maxResponseTime: number;

  /** 最大错误率阈值 (0-1) */
  readonly maxErrorRate: number;

  /** 最低可用性阈值 (0-1) */
  readonly minAvailability: number;
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  /** 平均响应时间 */
  readonly avgResponseTime: number;

  /** P95 响应时间 */
  readonly p95ResponseTime: number;

  /** P99 响应时间 */
  readonly p99ResponseTime: number;

  /** 吞吐量 (请求/秒) */
  readonly throughput: number;

  /** 错误率 */
  readonly errorRate: number;

  /** CPU 使用率 */
  readonly cpuUsage?: number;

  /** 内存使用率 */
  readonly memoryUsage?: number;
}

/**
 * 自适应配置
 */
export interface AdaptiveConfig {
  /** 学习率 */
  readonly learningRate: number;

  /** 适应窗口大小 */
  readonly adaptationWindow: number;

  /** 最小样本数 */
  readonly minSampleSize: number;

  /** 权重调整因子 */
  readonly weightAdjustmentFactor: number;

  /** 是否启用预测 */
  readonly enablePrediction: boolean;

  /** 预测模型配置 */
  readonly predictionModel?: PredictionModelConfig;
}

/**
 * 会话信息
 */
export interface SessionInfo {
  /** 会话ID */
  readonly sessionId: string;

  /** 用户ID */
  readonly userId?: string;

  /** 会话持续时间 */
  readonly duration: number;

  /** 会话类型 */
  readonly type: string;
}

/**
 * 地理信息
 */
export interface GeoInfo {
  /** 地区代码 */
  readonly region: string;

  /** 国家代码 */
  readonly country: string;

  /** 时区 */
  readonly timezone: string;

  /** 延迟敏感性 */
  readonly latencySensitive: boolean;
}

/**
 * 性能要求
 */
export interface PerformanceRequirements {
  /** 最大可接受延迟 */
  readonly maxLatency: number;

  /** 最小吞吐量要求 */
  readonly minThroughput: number;

  /** 最大错误率 */
  readonly maxErrorRate: number;

  /** 可用性要求 */
  readonly availabilityRequirement: number;
}

/**
 * 负载分布
 */
export interface LoadDistribution {
  /** 分布方差 */
  readonly variance: number;

  /** 分布标准差 */
  readonly standardDeviation: number;

  /** 分布均匀性 (0-1) */
  readonly uniformity: number;

  /** 负载平衡指数 */
  readonly balanceIndex: number;
}

/**
 * 策略效率
 */
export interface StrategyEfficiency {
  /** 选择效率 (0-1) */
  readonly selectionEfficiency: number;

  /** 负载均衡效果 (0-1) */
  readonly loadBalanceEffectiveness: number;

  /** 资源利用率 (0-1) */
  readonly resourceUtilization: number;

  /** 响应时间优化效果 (0-1) */
  readonly responseTimeOptimization: number;
}

/**
 * 预测模型配置
 */
export interface PredictionModelConfig {
  /** 模型类型 */
  readonly modelType: 'linear' | 'exponential' | 'neural' | 'custom';

  /** 预测窗口 */
  readonly predictionWindow: number;

  /** 特征权重 */
  readonly featureWeights: Record<string, number>;

  /** 模型参数 */
  readonly modelParameters: Record<string, any>;
}

// ========================= 枚举类型定义 =========================

/**
 * 策略类型
 */
export type StrategyType =
  | 'deterministic' // 确定性策略（如轮询）
  | 'weighted' // 权重策略
  | 'dynamic' // 动态策略（如最少连接）
  | 'adaptive'; // 自适应策略

/**
 * 负载均衡模式
 */
export type LoadBalanceMode =
  | 'round-robin' // 轮询
  | 'weighted' // 加权
  | 'least-connections' // 最少连接
  | 'health-aware' // 健康感知
  | 'adaptive' // 自适应
  | 'custom'; // 自定义

/**
 * 选择算法
 */
export type SelectionAlgorithm =
  | 'simple' // 简单选择
  | 'weighted-random' // 加权随机
  | 'consistent-hash' // 一致性哈希
  | 'power-of-two' // 二选一
  | 'lottery' // 抽签算法
  | 'reservoir'; // 蓄水池算法

// ========================= 负载均衡管理器 =========================

/**
 * 负载均衡管理器接口
 *
 * 职责：管理多个负载均衡策略，提供策略切换和配置管理
 */
export interface LoadBalanceManager {
  /**
   * 注册负载均衡策略
   *
   * @param strategy 负载均衡策略实例
   */
  registerStrategy(strategy: LoadBalanceStrategy): void;

  /**
   * 移除负载均衡策略
   *
   * @param strategyName 策略名称
   */
  removeStrategy(strategyName: string): void;

  /**
   * 获取策略实例
   *
   * @param strategyName 策略名称
   * @returns 策略实例
   */
  getStrategy(strategyName: string): LoadBalanceStrategy | undefined;

  /**
   * 列出所有可用策略
   *
   * @returns 策略名称列表
   */
  listStrategies(): string[];

  /**
   * 创建负载均衡器实例
   *
   * @param config 负载均衡配置
   * @returns 负载均衡器实例
   */
  createLoadBalancer(config: LoadBalancerConfig): LoadBalancer;

  /**
   * 获取管理器状态
   *
   * @returns 管理器状态信息
   */
  getManagerStatus(): ManagerStatus;
}

/**
 * 负载均衡器配置
 */
export interface LoadBalancerConfig {
  /** 配置ID */
  readonly id: string;

  /** 默认策略 */
  readonly defaultStrategy: LoadBalanceMode;

  /** 策略配置映射 */
  readonly strategyConfigs: Record<string, StrategyConfig>;

  /** 全局配置 */
  readonly globalConfig: GlobalLoadBalanceConfig;

  /** 监控配置 */
  readonly monitoring: MonitoringConfig;
}

/**
 * 全局负载均衡配置
 */
export interface GlobalLoadBalanceConfig {
  /** 选择超时时间 */
  readonly selectionTimeout: number;

  /** 最大重试次数 */
  readonly maxRetries: number;

  /** 是否启用缓存 */
  readonly enableCaching: boolean;

  /** 缓存TTL */
  readonly cacheTTL: number;

  /** 并发限制 */
  readonly concurrencyLimit: number;
}

/**
 * 监控配置
 */
export interface MonitoringConfig {
  /** 是否启用监控 */
  readonly enabled: boolean;

  /** 指标收集间隔 */
  readonly metricsInterval: number;

  /** 历史数据保留期 */
  readonly historyRetention: number;

  /** 告警阈值 */
  readonly alertThresholds: AlertThresholds;
}

/**
 * 告警阈值
 */
export interface AlertThresholds {
  /** 选择超时告警阈值 */
  readonly selectionTimeoutThreshold: number;

  /** 负载不均衡告警阈值 */
  readonly loadImbalanceThreshold: number;

  /** 错误率告警阈值 */
  readonly errorRateThreshold: number;
}

/**
 * 管理器状态
 */
export interface ManagerStatus {
  /** 注册的策略数量 */
  readonly registeredStrategies: number;

  /** 活跃的负载均衡器数量 */
  readonly activeLoadBalancers: number;

  /** 管理器运行时间 */
  readonly uptime: number;

  /** 总处理请求数 */
  readonly totalRequests: number;

  /** 最后活动时间 */
  readonly lastActivity: Date;

  /** 错误统计 */
  readonly errorStats: ErrorStats;
}

/**
 * 错误统计
 */
export interface ErrorStats {
  /** 总错误数 */
  readonly totalErrors: number;

  /** 按类型分组的错误统计 */
  readonly errorsByType: Record<string, number>;

  /** 最近错误 */
  readonly recentErrors: ErrorRecord[];
}

/**
 * 错误记录
 */
export interface ErrorRecord {
  /** 错误时间 */
  readonly timestamp: Date;

  /** 错误类型 */
  readonly type: string;

  /** 错误消息 */
  readonly message: string;

  /** 错误上下文 */
  readonly context?: Record<string, any>;
}
