/**
 * 负载均衡器模块导出
 *
 * 统一导出所有负载均衡器相关的类型和实现
 *
 * @author Jason Zhang
 */

// 主要实现
export { ProviderLoadBalancer } from './load-balancer';

// 类型定义
export {
  LoadBalancingStrategy,
  ProviderHealthStatus,
  ProviderInstance,
  ProviderMetrics,
  LoadBalancingContext,
  LoadBalancingResult,
  LoadBalancerConfig,
  LoadBalancerStatistics,
  CircuitBreakerState,
  ILoadBalancingStrategy,
  IHealthChecker,
  ICircuitBreaker,
  IMetricsCollector,
} from './types';

// 策略实现
export {
  StrategyFactory,
  RoundRobinStrategy,
  WeightedRoundRobinStrategy,
  LeastConnectionsStrategy,
  LeastResponseTimeStrategy,
  WeightedLeastConnectionsStrategy,
  RandomStrategy,
  WeightedRandomStrategy,
  HashStrategy,
  AdaptiveStrategy,
} from './strategies';

// 子模块
export { HealthChecker, HealthStatistics } from './health-checker';
export { CircuitBreaker, CircuitBreakerStatistics } from './circuit-breaker';
export { MetricsCollector, ProviderPerformanceRanking, MetricsTrend, MetricsAnomaly } from './metrics-collector';
export { SessionManager, SessionInfo, SessionStatistics } from './session-manager';
