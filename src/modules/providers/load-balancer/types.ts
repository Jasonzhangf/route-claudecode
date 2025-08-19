/**
 * 负载均衡器类型定义和接口
 *
 * 集中管理所有负载均衡相关的类型定义
 *
 * @author Jason Zhang
 */

/**
 * 负载均衡策略枚举
 */
export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'round_robin',
  WEIGHTED_ROUND_ROBIN = 'weighted_round_robin',
  LEAST_CONNECTIONS = 'least_connections',
  LEAST_RESPONSE_TIME = 'least_response_time',
  WEIGHTED_LEAST_CONNECTIONS = 'weighted_least_connections',
  RANDOM = 'random',
  WEIGHTED_RANDOM = 'weighted_random',
  HASH = 'hash',
  GEOGRAPHIC = 'geographic',
  ADAPTIVE = 'adaptive',
}

/**
 * Provider健康状态
 */
export enum ProviderHealthStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  DEGRADED = 'degraded',
  UNKNOWN = 'unknown',
  MAINTENANCE = 'maintenance',
}

/**
 * Provider性能指标
 */
export interface ProviderMetrics {
  avgResponseTime: number; // 平均响应时间(ms)
  successRate: number; // 成功率 (0-1)
  requestCount: number; // 请求总数
  errorCount: number; // 错误总数
  lastResponseTime: number; // 最后响应时间
  throughput: number; // 吞吐量 (req/min)
  cpuUsage?: number; // CPU使用率
  memoryUsage?: number; // 内存使用率
}

/**
 * Provider实例信息
 */
export interface ProviderInstance {
  id: string;
  name: string;
  type: string; // 'anthropic', 'openai', 'gemini', 'lmstudio'
  endpoint: string;
  region?: string;
  weight: number; // 权重 (1-100)
  maxConnections: number;
  currentConnections: number;
  healthStatus: ProviderHealthStatus;
  metrics: ProviderMetrics;
  config: any;
  lastUpdated: number;
}

/**
 * 负载均衡请求上下文
 */
export interface LoadBalancingContext {
  requestId: string;
  clientIp?: string;
  userAgent?: string;
  sessionId?: string;
  preferredProvider?: string;
  requiredCapabilities?: string[];
  priority: 'low' | 'normal' | 'high' | 'critical';
  timeout: number;
  retryCount: number;
  metadata?: Record<string, any>;
}

/**
 * 负载均衡结果
 */
export interface LoadBalancingResult {
  selectedProvider: ProviderInstance;
  strategy: LoadBalancingStrategy;
  selectionReason: string;
  alternatives: ProviderInstance[];
  confidence: number; // 选择信心 (0-1)
  estimatedResponseTime: number;
  timestamp: number;
}

/**
 * 负载均衡器配置
 */
export interface LoadBalancerConfig {
  strategy: LoadBalancingStrategy;
  enableHealthCheck: boolean;
  healthCheckInterval: number;
  enableAdaptive: boolean;
  adaptiveThreshold: number;
  stickySessions: boolean;
  sessionTtl: number;
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    recoveryTimeout: number;
    halfOpenMaxCalls: number;
  };
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffTime: number;
  };
  logging: {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    logSelections: boolean;
  };
}

/**
 * 熔断器状态
 */
export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  halfOpenCallCount: number;
}

/**
 * 负载均衡器统计信息
 */
export interface LoadBalancerStatistics {
  totalProviders: number;
  healthyProviders: number;
  degradedProviders: number;
  unhealthyProviders: number;
  totalConnections: number;
  avgResponseTime: number;
  avgSuccessRate: number;
  activeSessions: number;
  circuitBreakersOpen: number;
}

/**
 * 负载均衡策略接口
 */
export interface ILoadBalancingStrategy {
  /**
   * 选择Provider
   */
  selectProvider(providers: ProviderInstance[], context: LoadBalancingContext): ProviderInstance;

  /**
   * 策略名称
   */
  readonly strategyName: LoadBalancingStrategy;
}

/**
 * 健康检查器接口
 */
export interface IHealthChecker {
  /**
   * 检查Provider健康状态
   */
  checkHealth(provider: ProviderInstance): Promise<boolean>;

  /**
   * 更新Provider健康状态
   */
  updateHealthStatus(providerId: string): void;

  /**
   * 启动健康检查
   */
  startHealthCheck(): void;

  /**
   * 停止健康检查
   */
  stopHealthCheck(): void;
}

/**
 * 熔断器接口
 */
export interface ICircuitBreaker {
  /**
   * 检查熔断器是否关闭（可用）
   */
  isClosed(providerId: string): boolean;

  /**
   * 记录请求结果
   */
  recordResult(providerId: string, success: boolean): void;

  /**
   * 重置熔断器
   */
  reset(providerId: string): void;
}

/**
 * 指标收集器接口
 */
export interface IMetricsCollector {
  /**
   * 更新Provider指标
   */
  updateMetrics(providerId: string, metrics: Partial<ProviderMetrics>): void;

  /**
   * 获取Provider指标历史
   */
  getMetricsHistory(providerId: string): ProviderMetrics[];

  /**
   * 计算统计信息
   */
  calculateStatistics(providers: ProviderInstance[]): LoadBalancerStatistics;
}
