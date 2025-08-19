/**
 * Provider指标收集器
 *
 * 负责收集、存储和分析Provider性能指标
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import {
  IMetricsCollector,
  ProviderInstance,
  ProviderMetrics,
  LoadBalancerStatistics,
  ProviderHealthStatus,
} from './types';

/**
 * 指标收集器实现
 */
export class MetricsCollector extends EventEmitter implements IMetricsCollector {
  private providers: Map<string, ProviderInstance>;
  private metricsHistory: Map<string, ProviderMetrics[]> = new Map();
  private readonly maxHistorySize: number = 100;

  constructor(providers: Map<string, ProviderInstance>) {
    super();
    this.providers = providers;
  }

  /**
   * 更新Provider指标
   */
  updateMetrics(providerId: string, metrics: Partial<ProviderMetrics>): void {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return;
    }

    // 更新指标
    provider.metrics = {
      ...provider.metrics,
      ...metrics,
    };

    provider.lastUpdated = Date.now();

    // 保存历史指标
    this.saveMetricsHistory(providerId, provider.metrics);

    this.emit('metricsUpdated', { providerId, metrics: provider.metrics });
  }

  /**
   * 获取Provider指标历史
   */
  getMetricsHistory(providerId: string): ProviderMetrics[] {
    return this.metricsHistory.get(providerId) || [];
  }

  /**
   * 计算统计信息
   */
  calculateStatistics(providers: ProviderInstance[]): LoadBalancerStatistics {
    if (providers.length === 0) {
      return this.getEmptyStatistics();
    }

    const totalConnections = providers.reduce((sum, p) => sum + p.currentConnections, 0);
    const avgResponseTime = providers.reduce((sum, p) => sum + p.metrics.avgResponseTime, 0) / providers.length;
    const avgSuccessRate = providers.reduce((sum, p) => sum + p.metrics.successRate, 0) / providers.length;

    return {
      totalProviders: providers.length,
      healthyProviders: providers.filter(p => p.healthStatus === ProviderHealthStatus.HEALTHY).length,
      degradedProviders: providers.filter(p => p.healthStatus === ProviderHealthStatus.DEGRADED).length,
      unhealthyProviders: providers.filter(p => p.healthStatus === ProviderHealthStatus.UNHEALTHY).length,
      totalConnections,
      avgResponseTime: Number.isNaN(avgResponseTime) ? 0 : avgResponseTime,
      avgSuccessRate: Number.isNaN(avgSuccessRate) ? 0 : avgSuccessRate,
      activeSessions: 0, // 需要从外部传入
      circuitBreakersOpen: 0, // 需要从熔断器获取
    };
  }

  /**
   * 获取Provider性能排名
   */
  getPerformanceRanking(): ProviderPerformanceRanking[] {
    const providers = Array.from(this.providers.values());

    return providers
      .map(provider => ({
        providerId: provider.id,
        name: provider.name,
        type: provider.type,
        score: this.calculatePerformanceScore(provider),
        metrics: provider.metrics,
        healthStatus: provider.healthStatus,
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * 获取时间范围内的指标趋势
   */
  getMetricsTrend(providerId: string, metric: keyof ProviderMetrics): MetricsTrend {
    const history = this.getMetricsHistory(providerId);
    if (history.length === 0) {
      return { values: [], trend: 'stable', change: 0 };
    }

    const values = history.map(h => h[metric] as number).filter(v => typeof v === 'number');
    if (values.length < 2) {
      return { values, trend: 'stable', change: 0 };
    }

    const first = values[0];
    const last = values[values.length - 1];
    const change = ((last - first) / first) * 100;

    let trend: 'improving' | 'degrading' | 'stable' = 'stable';
    if (Math.abs(change) > 5) {
      // 5%阈值
      trend = change > 0 ? 'degrading' : 'improving';
      // 对于某些指标，增长实际上是改善（如successRate）
      if (metric === 'successRate' || metric === 'throughput') {
        trend = change > 0 ? 'improving' : 'degrading';
      }
    }

    return { values, trend, change };
  }

  /**
   * 检测异常指标
   */
  detectAnomalies(providerId: string): MetricsAnomaly[] {
    const provider = this.providers.get(providerId);
    const history = this.getMetricsHistory(providerId);

    if (!provider || history.length < 10) {
      return [];
    }

    const anomalies: MetricsAnomaly[] = [];
    const current = provider.metrics;

    // 检测响应时间异常
    const avgResponseTimes = history.map(h => h.avgResponseTime);
    const responseTimeStats = this.calculateStatistics2(avgResponseTimes);
    if (current.avgResponseTime > responseTimeStats.mean + 2 * responseTimeStats.stdDev) {
      anomalies.push({
        metric: 'avgResponseTime',
        severity: 'high',
        message: `Response time (${current.avgResponseTime}ms) is significantly higher than average (${responseTimeStats.mean.toFixed(2)}ms)`,
        threshold: responseTimeStats.mean + 2 * responseTimeStats.stdDev,
        currentValue: current.avgResponseTime,
      });
    }

    // 检测成功率异常
    const successRates = history.map(h => h.successRate);
    const successRateStats = this.calculateStatistics2(successRates);
    if (current.successRate < successRateStats.mean - 2 * successRateStats.stdDev) {
      anomalies.push({
        metric: 'successRate',
        severity: 'critical',
        message: `Success rate (${(current.successRate * 100).toFixed(2)}%) is significantly lower than average (${(successRateStats.mean * 100).toFixed(2)}%)`,
        threshold: successRateStats.mean - 2 * successRateStats.stdDev,
        currentValue: current.successRate,
      });
    }

    return anomalies;
  }

  /**
   * 保存指标历史
   */
  private saveMetricsHistory(providerId: string, metrics: ProviderMetrics): void {
    const history = this.metricsHistory.get(providerId) || [];
    history.push({ ...metrics });

    // 保持最近N个指标
    if (history.length > this.maxHistorySize) {
      history.shift();
    }

    this.metricsHistory.set(providerId, history);
  }

  /**
   * 计算Provider性能分数
   */
  private calculatePerformanceScore(provider: ProviderInstance): number {
    const metrics = provider.metrics;
    let score = 0;

    // 成功率权重 40%
    score += metrics.successRate * 40;

    // 响应时间权重 30% (反向计算，越小越好)
    const responseTimeScore = Math.max(0, 30 - (metrics.avgResponseTime / 1000) * 5);
    score += responseTimeScore;

    // 吞吐量权重 20%
    const throughputScore = Math.min(20, (metrics.throughput / 100) * 20);
    score += throughputScore;

    // 健康状态权重 10%
    const healthScore =
      provider.healthStatus === ProviderHealthStatus.HEALTHY
        ? 10
        : provider.healthStatus === ProviderHealthStatus.DEGRADED
          ? 5
          : 0;
    score += healthScore;

    return Math.round(score);
  }

  /**
   * 获取空的统计信息
   */
  private getEmptyStatistics(): LoadBalancerStatistics {
    return {
      totalProviders: 0,
      healthyProviders: 0,
      degradedProviders: 0,
      unhealthyProviders: 0,
      totalConnections: 0,
      avgResponseTime: 0,
      avgSuccessRate: 0,
      activeSessions: 0,
      circuitBreakersOpen: 0,
    };
  }

  /**
   * 计算数值统计信息
   */
  private calculateStatistics2(values: number[]): { mean: number; stdDev: number } {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return { mean, stdDev };
  }

  /**
   * 清理指标历史
   */
  cleanup(): void {
    this.metricsHistory.clear();
  }
}

/**
 * Provider性能排名
 */
export interface ProviderPerformanceRanking {
  providerId: string;
  name: string;
  type: string;
  score: number;
  metrics: ProviderMetrics;
  healthStatus: ProviderHealthStatus;
}

/**
 * 指标趋势
 */
export interface MetricsTrend {
  values: number[];
  trend: 'improving' | 'degrading' | 'stable';
  change: number; // 百分比变化
}

/**
 * 指标异常
 */
export interface MetricsAnomaly {
  metric: keyof ProviderMetrics;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold: number;
  currentValue: number;
}
