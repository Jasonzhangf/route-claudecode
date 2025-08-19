/**
 * 连接池性能监控器模块
 *
 * 负责收集、分析和报告连接池的性能指标和统计数据
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { PoolStatistics, PoolMetrics, ConnectionInfo, ConnectionState } from './connection-types';

/**
 * 性能监控配置
 */
export interface PerformanceMonitorConfig {
  enabled: boolean;
  metricsInterval: number; // 指标收集间隔 (毫秒)
  historySize: number; // 历史数据保留条数
  alertThresholds: {
    poolUtilization: number; // 池利用率告警阈值
    averageLatency: number; // 平均延迟告警阈值
    errorRate: number; // 错误率告警阈值
    queueSize: number; // 队列大小告警阈值
  };
}

/**
 * 性能快照
 */
export interface PerformanceSnapshot {
  timestamp: number;
  poolSize: number;
  activeConnections: number;
  idleConnections: number;
  queueSize: number;
  throughput: number; // 每秒请求数
  averageLatency: number; // 平均延迟
  errorRate: number; // 错误率
  poolUtilization: number; // 池利用率
  hitRate: number; // 缓存命中率
}

/**
 * 性能趋势分析
 */
export interface PerformanceTrend {
  metric: string;
  current: number;
  average: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number; // 变化率百分比
}

/**
 * 性能监控器接口
 */
export interface IPoolPerformanceMonitor extends EventEmitter {
  start(): void;
  stop(): void;
  recordRequest(duration: number, success: boolean): void;
  recordConnectionOperation(operation: string, duration: number): void;
  getCurrentMetrics(): PoolMetrics;
  getPerformanceSnapshot(): PerformanceSnapshot;
  getPerformanceTrends(): PerformanceTrend[];
  getHistoricalData(minutes: number): PerformanceSnapshot[];
}

/**
 * 连接池性能监控器
 */
export class PoolPerformanceMonitor extends EventEmitter implements IPoolPerformanceMonitor {
  private config: PerformanceMonitorConfig;
  private connections: Map<string, ConnectionInfo>;
  private getQueueSize: () => number;

  // 性能指标
  private metrics: PoolMetrics;
  private performanceHistory: PerformanceSnapshot[] = [];
  private requestTimes: number[] = [];
  private connectionOperationTimes: Map<string, number[]> = new Map();

  // 计时器和状态
  private metricsTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastSnapshotTime = 0;
  private requestCount = 0;
  private lastRequestCount = 0;

  constructor(config: PerformanceMonitorConfig, connections: Map<string, ConnectionInfo>, getQueueSize: () => number) {
    super();
    this.config = config;
    this.connections = connections;
    this.getQueueSize = getQueueSize;

    this.initializeMetrics();
  }

  /**
   * 启动性能监控
   */
  start(): void {
    if (this.isRunning || !this.config.enabled) {
      return;
    }

    this.isRunning = true;
    this.lastSnapshotTime = Date.now();
    this.startMetricsCollection();

    this.emit('performance-monitor-started', {
      config: this.config,
      timestamp: Date.now(),
    });

    console.log(`📊 连接池性能监控已启动 (间隔: ${this.config.metricsInterval}ms)`);
  }

  /**
   * 停止性能监控
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }

    this.emit('performance-monitor-stopped', {
      timestamp: Date.now(),
    });

    console.log('📊 连接池性能监控已停止');
  }

  /**
   * 记录请求性能
   */
  recordRequest(duration: number, success: boolean): void {
    this.requestCount++;
    this.requestTimes.push(duration);

    // 保持最近1000个请求的记录
    if (this.requestTimes.length > 1000) {
      this.requestTimes.shift();
    }

    // 更新指标
    this.metrics.totalRequests++;
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // 更新平均请求时间
    this.updateAverageRequestTime();
  }

  /**
   * 记录连接操作性能
   */
  recordConnectionOperation(operation: string, duration: number): void {
    if (!this.connectionOperationTimes.has(operation)) {
      this.connectionOperationTimes.set(operation, []);
    }

    const times = this.connectionOperationTimes.get(operation)!;
    times.push(duration);

    // 保持最近100个操作的记录
    if (times.length > 100) {
      times.shift();
    }

    // 更新连接时间（如果是连接操作）
    if (operation === 'connection') {
      this.updateAverageConnectionTime(duration);
    }
  }

  /**
   * 获取当前性能指标
   */
  getCurrentMetrics(): PoolMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * 获取性能快照
   */
  getPerformanceSnapshot(): PerformanceSnapshot {
    const now = Date.now();
    const timeDiff = (now - this.lastSnapshotTime) / 1000; // 秒
    const requestDiff = this.requestCount - this.lastRequestCount;

    const throughput = timeDiff > 0 ? requestDiff / timeDiff : 0;

    const snapshot: PerformanceSnapshot = {
      timestamp: now,
      poolSize: this.connections.size,
      activeConnections: this.getActiveConnectionCount(),
      idleConnections: this.getIdleConnectionCount(),
      queueSize: this.getQueueSize(),
      throughput,
      averageLatency: this.metrics.averageRequestTime,
      errorRate: this.calculateErrorRate(),
      poolUtilization: this.metrics.poolUtilization,
      hitRate: this.metrics.hitRate,
    };

    return snapshot;
  }

  /**
   * 获取性能趋势分析
   */
  getPerformanceTrends(): PerformanceTrend[] {
    if (this.performanceHistory.length < 3) {
      return [];
    }

    const trends: PerformanceTrend[] = [];
    const recent = this.performanceHistory.slice(-5); // 最近5个数据点
    const older = this.performanceHistory.slice(-10, -5); // 之前5个数据点

    if (older.length === 0) {
      return trends;
    }

    // 分析各项指标的趋势
    const metrics = ['throughput', 'averageLatency', 'errorRate', 'poolUtilization', 'queueSize'];

    for (const metric of metrics) {
      const recentAvg = this.calculateAverage(recent, metric);
      const olderAvg = this.calculateAverage(older, metric);

      if (olderAvg > 0) {
        const changeRate = ((recentAvg - olderAvg) / olderAvg) * 100;
        let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';

        if (Math.abs(changeRate) > 5) {
          // 5%以上变化才认为是趋势
          trend = changeRate > 0 ? 'increasing' : 'decreasing';
        }

        trends.push({
          metric,
          current: recentAvg,
          average: olderAvg,
          trend,
          changeRate,
        });
      }
    }

    return trends;
  }

  /**
   * 获取历史性能数据
   */
  getHistoricalData(minutes: number): PerformanceSnapshot[] {
    const cutoffTime = Date.now() - minutes * 60 * 1000;
    return this.performanceHistory.filter(snapshot => snapshot.timestamp >= cutoffTime);
  }

  /**
   * 重置性能统计
   */
  resetMetrics(): void {
    this.initializeMetrics();
    this.performanceHistory = [];
    this.requestTimes = [];
    this.connectionOperationTimes.clear();
    this.requestCount = 0;
    this.lastRequestCount = 0;

    this.emit('metrics-reset', {
      timestamp: Date.now(),
    });
  }

  /**
   * 生成性能报告
   */
  generatePerformanceReport(): any {
    const currentSnapshot = this.getPerformanceSnapshot();
    const trends = this.getPerformanceTrends();
    const recentHistory = this.getHistoricalData(60); // 最近1小时

    return {
      timestamp: Date.now(),
      current: currentSnapshot,
      trends,
      statistics: {
        uptime: this.isRunning ? Date.now() - this.lastSnapshotTime : 0,
        totalRequests: this.metrics.totalRequests,
        totalSuccessful: this.metrics.successfulRequests,
        totalFailed: this.metrics.failedRequests,
        averagePoolSize: this.calculateAveragePoolSize(recentHistory),
        peakThroughput: this.calculatePeakThroughput(recentHistory),
        peakLatency: this.calculatePeakLatency(recentHistory),
      },
      alerts: this.checkAlerts(currentSnapshot),
    };
  }

  // ===== Private Methods =====

  private initializeMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageConnectionTime: 0,
      averageRequestTime: 0,
      poolUtilization: 0,
      hitRate: 0,
    };
  }

  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsInterval);
  }

  private collectMetrics(): void {
    const snapshot = this.getPerformanceSnapshot();

    // 添加到历史记录
    this.performanceHistory.push(snapshot);

    // 保持历史记录在配置限制内
    if (this.performanceHistory.length > this.config.historySize) {
      this.performanceHistory.shift();
    }

    // 更新状态
    this.lastSnapshotTime = snapshot.timestamp;
    this.lastRequestCount = this.requestCount;

    // 发出指标更新事件
    this.emit('metrics-collected', {
      snapshot,
      historySize: this.performanceHistory.length,
    });

    // 检查告警
    const alerts = this.checkAlerts(snapshot);
    if (alerts.length > 0) {
      this.emit('performance-alerts', {
        alerts,
        snapshot,
      });
    }

    // 输出性能摘要
    this.logPerformanceSummary(snapshot);
  }

  private updateMetrics(): void {
    this.metrics.poolUtilization = this.calculatePoolUtilization();
    this.metrics.hitRate = this.calculateHitRate();
  }

  private updateAverageRequestTime(): void {
    if (this.requestTimes.length > 0) {
      const sum = this.requestTimes.reduce((a, b) => a + b, 0);
      this.metrics.averageRequestTime = sum / this.requestTimes.length;
    }
  }

  private updateAverageConnectionTime(newTime: number): void {
    // 使用滑动平均
    this.metrics.averageConnectionTime = this.metrics.averageConnectionTime * 0.9 + newTime * 0.1;
  }

  private getActiveConnectionCount(): number {
    return Array.from(this.connections.values()).filter(conn => conn.state === ConnectionState.BUSY).length;
  }

  private getIdleConnectionCount(): number {
    return Array.from(this.connections.values()).filter(conn => conn.state === ConnectionState.IDLE).length;
  }

  private calculateErrorRate(): number {
    const total = this.metrics.totalRequests;
    return total > 0 ? (this.metrics.failedRequests / total) * 100 : 0;
  }

  private calculatePoolUtilization(): number {
    // 这个值应该从外部传入，这里使用默认计算
    const maxConnections = 100; // 应该从配置获取
    return maxConnections > 0 ? (this.connections.size / maxConnections) * 100 : 0;
  }

  private calculateHitRate(): number {
    // 简化计算，实际应该基于连接复用统计
    const recentRequests = Math.min(this.requestTimes.length, 100);
    const reusedConnections = Math.max(0, recentRequests - this.connections.size);
    return recentRequests > 0 ? (reusedConnections / recentRequests) * 100 : 0;
  }

  private calculateAverage(snapshots: PerformanceSnapshot[], metric: string): number {
    if (snapshots.length === 0) return 0;

    const sum = snapshots.reduce((total, snapshot) => {
      return total + (snapshot as any)[metric];
    }, 0);

    return sum / snapshots.length;
  }

  private calculateAveragePoolSize(history: PerformanceSnapshot[]): number {
    return this.calculateAverage(history, 'poolSize');
  }

  private calculatePeakThroughput(history: PerformanceSnapshot[]): number {
    return history.length > 0 ? Math.max(...history.map(h => h.throughput)) : 0;
  }

  private calculatePeakLatency(history: PerformanceSnapshot[]): number {
    return history.length > 0 ? Math.max(...history.map(h => h.averageLatency)) : 0;
  }

  private checkAlerts(snapshot: PerformanceSnapshot): string[] {
    const alerts: string[] = [];
    const thresholds = this.config.alertThresholds;

    if (snapshot.poolUtilization > thresholds.poolUtilization) {
      alerts.push(`Pool utilization high: ${snapshot.poolUtilization.toFixed(1)}%`);
    }

    if (snapshot.averageLatency > thresholds.averageLatency) {
      alerts.push(`Average latency high: ${snapshot.averageLatency.toFixed(1)}ms`);
    }

    if (snapshot.errorRate > thresholds.errorRate) {
      alerts.push(`Error rate high: ${snapshot.errorRate.toFixed(1)}%`);
    }

    if (snapshot.queueSize > thresholds.queueSize) {
      alerts.push(`Queue size high: ${snapshot.queueSize}`);
    }

    return alerts;
  }

  private logPerformanceSummary(snapshot: PerformanceSnapshot): void {
    if (snapshot.poolSize > 0) {
      console.log(
        `📊 性能摘要: 连接=${snapshot.poolSize}, 活跃=${snapshot.activeConnections}, ` +
          `队列=${snapshot.queueSize}, 吞吐=${snapshot.throughput.toFixed(1)}/s, ` +
          `延迟=${snapshot.averageLatency.toFixed(1)}ms, 错误率=${snapshot.errorRate.toFixed(1)}%`
      );
    }
  }
}

/**
 * 默认性能监控配置
 */
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceMonitorConfig = {
  enabled: true,
  metricsInterval: 30000, // 30秒
  historySize: 200, // 保留200个数据点
  alertThresholds: {
    poolUtilization: 80, // 80%
    averageLatency: 1000, // 1秒
    errorRate: 5, // 5%
    queueSize: 50, // 50个等待请求
  },
};
