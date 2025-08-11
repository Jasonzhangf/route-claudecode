/**
 * CodeWhisperer 性能监控器
 * 收集实时流式和缓冲式实现的性能指标
 * 项目所有者: Jason Zhang
 */

import { logger } from '@/utils/logger';
import { PerformanceReport, SSEEvent } from '../client-interface';
import { CodeWhispererStreamingConfig } from './streaming-config';

export interface MetricsSnapshot {
  timestamp: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
}

export interface StreamMetrics {
  requestId: string;
  startTime: number;
  endTime?: number;
  eventsCount: number;
  totalLatency: number;
  maxLatency: number;
  minLatency: number;
  memorySnapshots: MetricsSnapshot[];
  implementation: 'buffered' | 'realtime';
  success: boolean;
  error?: string;
}

export class CodeWhispererPerformanceMetrics {
  private metrics: Map<string, StreamMetrics> = new Map();
  private config: CodeWhispererStreamingConfig;
  private metricsInterval?: NodeJS.Timeout;
  private aggregatedMetrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgDuration: number;
    avgLatency: number;
    memoryPeak: number;
    implementationStats: {
      buffered: {
        count: number;
        avgDuration: number;
        successRate: number;
      };
      realtime: {
        count: number;
        avgDuration: number;
        successRate: number;
      };
    };
  };

  constructor(config: CodeWhispererStreamingConfig) {
    this.config = config;
    this.aggregatedMetrics = this.initializeAggregatedMetrics();
    this.startMetricsCollection();
  }

  /**
   * 初始化聚合指标
   */
  private initializeAggregatedMetrics() {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgDuration: 0,
      avgLatency: 0,
      memoryPeak: 0,
      implementationStats: {
        buffered: {
          count: 0,
          avgDuration: 0,
          successRate: 1,
        },
        realtime: {
          count: 0,
          avgDuration: 0,
          successRate: 1,
        },
      },
    };
  }

  /**
   * 开始性能指标收集
   */
  private startMetricsCollection(): void {
    if (this.config.performanceMetrics.enableProfiling) {
      this.metricsInterval = setInterval(() => {
        this.collectSystemMetrics();
        this.cleanupOldMetrics();
      }, this.config.performanceMetrics.metricsIntervalMs);
      
      logger.info('CodeWhisperer性能监控已启动', {
        intervalMs: this.config.performanceMetrics.metricsIntervalMs,
      });
    }
  }

  /**
   * 开始跟踪单个请求的性能
   */
  startTracking(
    requestId: string,
    implementation: 'buffered' | 'realtime'
  ): void {
    if (!this.config.performanceMetrics.enableProfiling) {
      return;
    }

    const startTime = Date.now();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.metrics.set(requestId, {
      requestId,
      startTime,
      eventsCount: 0,
      totalLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      memorySnapshots: [{
        timestamp: startTime,
        memoryUsage,
        cpuUsage,
      }],
      implementation,
      success: false,
    });

    logger.debug('开始跟踪请求性能', {
      requestId,
      implementation,
      startTime,
    });
  }

  /**
   * 记录事件延迟
   */
  recordLatency(requestId: string, event: SSEEvent): void {
    if (!this.config.performanceMetrics.collectLatencyData) {
      return;
    }

    const metric = this.metrics.get(requestId);
    if (!metric) {
      return;
    }

    const currentTime = Date.now();
    const latency = currentTime - metric.startTime;

    metric.eventsCount++;
    metric.totalLatency += latency;
    metric.maxLatency = Math.max(metric.maxLatency, latency);
    metric.minLatency = Math.min(metric.minLatency, latency);

    // 记录内存快照
    if (this.config.performanceMetrics.memoryUsageTracking) {
      metric.memorySnapshots.push({
        timestamp: currentTime,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      });
    }

    logger.debug('记录事件延迟', {
      requestId,
      eventType: event.event,
      latency,
      eventsCount: metric.eventsCount,
    });
  }

  /**
   * 结束跟踪并生成性能报告
   */
  endTracking(
    requestId: string,
    success: boolean = true,
    error?: string
  ): PerformanceReport | null {
    const metric = this.metrics.get(requestId);
    if (!metric) {
      return null;
    }

    const endTime = Date.now();
    const duration = endTime - metric.startTime;
    
    // 更新指标
    metric.endTime = endTime;
    metric.success = success;
    if (error) {
      metric.error = error;
    }

    // 计算内存增量
    const memoryStart = metric.memorySnapshots[0]?.memoryUsage || process.memoryUsage();
    const memoryEnd = process.memoryUsage();
    const memoryDelta = {
      rss: memoryEnd.rss - memoryStart.rss,
      heapUsed: memoryEnd.heapUsed - memoryStart.heapUsed,
    };

    // 生成性能报告
    const report: PerformanceReport = {
      requestId,
      durationMs: duration,
      memoryDelta,
      eventsCount: metric.eventsCount,
      avgLatency: metric.eventsCount > 0 ? metric.totalLatency / metric.eventsCount : 0,
      maxLatency: metric.maxLatency,
      minLatency: metric.minLatency === Infinity ? 0 : metric.minLatency,
    };

    // 更新聚合指标
    this.updateAggregatedMetrics(metric, report);

    // 清理单个指标
    this.metrics.delete(requestId);

    logger.info('请求性能跟踪完成', {
      requestId,
      duration,
      success,
      implementation: metric.implementation,
      report,
    });

    return report;
  }

  /**
   * 更新聚合指标
   */
  private updateAggregatedMetrics(metric: StreamMetrics, report: PerformanceReport): void {
    this.aggregatedMetrics.totalRequests++;
    
    if (metric.success) {
      this.aggregatedMetrics.successfulRequests++;
    } else {
      this.aggregatedMetrics.failedRequests++;
    }

    // 更新平均持续时间
    const totalDuration = this.aggregatedMetrics.avgDuration * (this.aggregatedMetrics.totalRequests - 1);
    this.aggregatedMetrics.avgDuration = (totalDuration + report.durationMs) / this.aggregatedMetrics.totalRequests;

    // 更新平均延迟
    const totalLatency = this.aggregatedMetrics.avgLatency * (this.aggregatedMetrics.totalRequests - 1);
    this.aggregatedMetrics.avgLatency = (totalLatency + report.avgLatency) / this.aggregatedMetrics.totalRequests;

    // 更新内存峰值
    const currentMemoryPeak = Math.max(
      this.aggregatedMetrics.memoryPeak,
      report.memoryDelta.heapUsed
    );
    this.aggregatedMetrics.memoryPeak = currentMemoryPeak;

    // 更新实现特定指标
    const implStats = this.aggregatedMetrics.implementationStats[metric.implementation];
    implStats.count++;
    
    const implTotalDuration = implStats.avgDuration * (implStats.count - 1);
    implStats.avgDuration = (implTotalDuration + report.durationMs) / implStats.count;
    
    const successCount = implStats.successRate * (implStats.count - 1);
    implStats.successRate = (successCount + (metric.success ? 1 : 0)) / implStats.count;
  }

  /**
   * 收集系统指标
   */
  private collectSystemMetrics(): void {
    if (!this.config.performanceMetrics.memoryUsageTracking) {
      return;
    }

    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // 记录当前内存使用情况
    if (memoryUsage.heapUsed > this.aggregatedMetrics.memoryPeak) {
      this.aggregatedMetrics.memoryPeak = memoryUsage.heapUsed;
    }

    logger.debug('系统性能指标收集', {
      memoryUsage: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
      },
      activeRequests: this.metrics.size,
    });
  }

  /**
   * 清理旧指标
   */
  private cleanupOldMetrics(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5分钟

    for (const [requestId, metric] of this.metrics) {
      if (now - metric.startTime > maxAge) {
        logger.warn('清理过期的性能指标', { requestId, age: now - metric.startTime });
        this.metrics.delete(requestId);
      }
    }
  }

  /**
   * 获取聚合性能报告
   */
  getAggregatedReport() {
    return {
      ...this.aggregatedMetrics,
      currentActiveRequests: this.metrics.size,
      timestamp: Date.now(),
    };
  }

  /**
   * 获取当前活跃请求指标
   */
  getActiveRequestsMetrics() {
    const activeMetrics: StreamMetrics[] = [];
    for (const metric of this.metrics.values()) {
      activeMetrics.push(metric);
    }
    return activeMetrics;
  }

  /**
   * 比较两个实现的性能
   */
  compareImplementations(): {
    buffered: any;
    realtime: any;
    comparison: {
      durationImprovement: number; // 百分比
      successRateImprovement: number; // 百分比
      recommendation: 'realtime' | 'buffered' | 'mixed';
    };
  } {
    const buffered = this.aggregatedMetrics.implementationStats.buffered;
    const realtime = this.aggregatedMetrics.implementationStats.realtime;

    // 计算改进百分比
    const durationImprovement = buffered.count > 0 && realtime.count > 0
      ? ((buffered.avgDuration - realtime.avgDuration) / buffered.avgDuration) * 100
      : 0;

    const successRateImprovement = buffered.count > 0 && realtime.count > 0
      ? ((realtime.successRate - buffered.successRate) / buffered.successRate) * 100
      : 0;

    // 生成建议
    let recommendation: 'realtime' | 'buffered' | 'mixed' = 'mixed';
    if (durationImprovement > 20 && successRateImprovement >= 0) {
      recommendation = 'realtime';
    } else if (durationImprovement < -10 || successRateImprovement < -5) {
      recommendation = 'buffered';
    }

    return {
      buffered,
      realtime,
      comparison: {
        durationImprovement: Math.round(durationImprovement * 100) / 100,
        successRateImprovement: Math.round(successRateImprovement * 100) / 100,
        recommendation,
      },
    };
  }

  /**
   * 重置聚合指标
   */
  resetAggregatedMetrics(): void {
    this.aggregatedMetrics = this.initializeAggregatedMetrics();
    logger.info('聚合性能指标已重置');
  }

  /**
   * 销毁性能监控器
   */
  destroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
    this.metrics.clear();
    logger.info('CodeWhisperer性能监控器已销毁');
  }
}
