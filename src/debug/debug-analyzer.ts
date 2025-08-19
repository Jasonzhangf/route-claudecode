/**
 * Debug性能分析器
 *
 * 负责性能数据分析、统计和报告生成
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { DebugRecord, ModuleRecord, DebugSession, DebugStatistics } from './types/debug-types';

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  averageResponseTime: number;
  medianResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number; // 请求/秒
  errorRate: number; // 0-1之间
  successRate: number; // 0-1之间
}

/**
 * 模块性能统计
 */
export interface ModulePerformanceStats {
  moduleName: string;
  callCount: number;
  totalDuration: number;
  averageDuration: number;
  medianDuration: number;
  maxDuration: number;
  minDuration: number;
  errorCount: number;
  errorRate: number;
  percentile95: number;
  percentile99: number;
}

/**
 * 时间序列数据点
 */
export interface TimeSeriesDataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

/**
 * 性能趋势分析
 */
export interface PerformanceTrend {
  metric: string;
  timeSeries: TimeSeriesDataPoint[];
  trend: 'improving' | 'degrading' | 'stable';
  changeRate: number; // 变化率 (-1 到 1)
  prediction?: TimeSeriesDataPoint[];
}

/**
 * 异常检测结果
 */
export interface AnomalyDetectionResult {
  timestamp: number;
  anomalyType: 'spike' | 'dip' | 'outlier';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedModules: string[];
  suggestedActions: string[];
}

/**
 * Debug性能分析器接口
 */
export interface DebugAnalyzer {
  analyzeSession(session: DebugSession, records: DebugRecord[]): Promise<PerformanceMetrics>;
  analyzeModulePerformance(moduleName: string, records: ModuleRecord[]): ModulePerformanceStats;
  generateTimeSeries(records: DebugRecord[], metric: string, interval: number): TimeSeriesDataPoint[];
  detectAnomalies(records: DebugRecord[]): AnomalyDetectionResult[];
  analyzeTrends(records: DebugRecord[], timeWindow: number): PerformanceTrend[];
  generateReport(sessions: DebugSession[], records: DebugRecord[]): Promise<AnalysisReport>;
  calculateStatistics(records: DebugRecord[]): DebugStatistics;
}

/**
 * 分析报告
 */
export interface AnalysisReport {
  summary: {
    totalRequests: number;
    totalSessions: number;
    timeRange: { start: number; end: number };
    overallPerformance: PerformanceMetrics;
  };
  moduleAnalysis: ModulePerformanceStats[];
  trends: PerformanceTrend[];
  anomalies: AnomalyDetectionResult[];
  recommendations: string[];
  generatedAt: number;
}

/**
 * Debug性能分析器实现
 */
export class DebugAnalyzerImpl extends EventEmitter implements DebugAnalyzer {
  private anomalyThresholds: {
    responseTimeMultiplier: number;
    errorRateThreshold: number;
    throughputChangeThreshold: number;
  };

  constructor() {
    super();
    this.anomalyThresholds = {
      responseTimeMultiplier: 3.0, // 超过平均值3倍算异常
      errorRateThreshold: 0.1, // 错误率超过10%算异常
      throughputChangeThreshold: 0.5, // 吞吐量变化超过50%算异常
    };
  }

  /**
   * 分析会话性能
   */
  async analyzeSession(session: DebugSession, records: DebugRecord[]): Promise<PerformanceMetrics> {
    if (records.length === 0) {
      return this.getEmptyMetrics();
    }

    // 提取响应时间数据
    const responseTimes = records.map(r => r.response?.duration || 0).filter(duration => duration > 0);

    if (responseTimes.length === 0) {
      return this.getEmptyMetrics();
    }

    // 排序以计算百分位数
    responseTimes.sort((a, b) => a - b);

    const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const medianResponseTime = this.calculatePercentile(responseTimes, 50);
    const p95ResponseTime = this.calculatePercentile(responseTimes, 95);
    const p99ResponseTime = this.calculatePercentile(responseTimes, 99);

    // 计算吞吐量
    const timeSpan = (session.endTime || Date.now()) - session.startTime;
    const throughput = timeSpan > 0 ? (records.length * 1000) / timeSpan : 0;

    // 计算错误率
    const errorCount = records.filter(r => r.error).length;
    const errorRate = records.length > 0 ? errorCount / records.length : 0;
    const successRate = 1 - errorRate;

    return {
      averageResponseTime,
      medianResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      throughput,
      errorRate,
      successRate,
    };
  }

  /**
   * 分析模块性能
   */
  analyzeModulePerformance(moduleName: string, records: ModuleRecord[]): ModulePerformanceStats {
    if (records.length === 0) {
      return this.getEmptyModuleStats(moduleName);
    }

    const durations = records.map(r => r.duration).filter(d => d && d > 0);
    durations.sort((a, b) => a - b);

    const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
    const averageDuration = durations.length > 0 ? totalDuration / durations.length : 0;
    const medianDuration = this.calculatePercentile(durations, 50);
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    const percentile95 = this.calculatePercentile(durations, 95);
    const percentile99 = this.calculatePercentile(durations, 99);

    const errorCount = records.filter(r => r.error).length;
    const errorRate = records.length > 0 ? errorCount / records.length : 0;

    return {
      moduleName,
      callCount: records.length,
      totalDuration,
      averageDuration,
      medianDuration,
      maxDuration,
      minDuration,
      errorCount,
      errorRate,
      percentile95,
      percentile99,
    };
  }

  /**
   * 生成时间序列数据
   */
  generateTimeSeries(records: DebugRecord[], metric: string, interval: number): TimeSeriesDataPoint[] {
    if (records.length === 0) return [];

    // 按时间排序
    const sortedRecords = records.sort((a, b) => a.timestamp - b.timestamp);

    const startTime = sortedRecords[0].timestamp;
    const endTime = sortedRecords[sortedRecords.length - 1].timestamp;

    const dataPoints: TimeSeriesDataPoint[] = [];

    for (let time = startTime; time <= endTime; time += interval) {
      const windowEnd = time + interval;
      const windowRecords = sortedRecords.filter(r => r.timestamp >= time && r.timestamp < windowEnd);

      let value = 0;

      switch (metric) {
        case 'responseTime':
          if (windowRecords.length > 0) {
            const avgResponseTime =
              windowRecords.map(r => r.response?.duration || 0).reduce((sum, duration) => sum + duration, 0) /
              windowRecords.length;
            value = avgResponseTime;
          }
          break;

        case 'throughput':
          value = windowRecords.length / (interval / 1000); // 请求/秒
          break;

        case 'errorRate':
          if (windowRecords.length > 0) {
            const errors = windowRecords.filter(r => r.error).length;
            value = errors / windowRecords.length;
          }
          break;

        default:
          value = windowRecords.length;
      }

      dataPoints.push({
        timestamp: time,
        value,
        label: new Date(time).toISOString(),
      });
    }

    return dataPoints;
  }

  /**
   * 检测异常
   */
  detectAnomalies(records: DebugRecord[]): AnomalyDetectionResult[] {
    const anomalies: AnomalyDetectionResult[] = [];

    if (records.length < 10) return anomalies; // 数据太少无法检测异常

    // 响应时间异常检测
    const responseTimeAnomalies = this.detectResponseTimeAnomalies(records);
    anomalies.push(...responseTimeAnomalies);

    // 错误率异常检测
    const errorRateAnomalies = this.detectErrorRateAnomalies(records);
    anomalies.push(...errorRateAnomalies);

    // 吞吐量异常检测
    const throughputAnomalies = this.detectThroughputAnomalies(records);
    anomalies.push(...throughputAnomalies);

    return anomalies.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 分析性能趋势
   */
  analyzeTrends(records: DebugRecord[], timeWindow: number): PerformanceTrend[] {
    const trends: PerformanceTrend[] = [];

    // 响应时间趋势
    const responseTimeTrend = this.analyzeMetricTrend(records, 'responseTime', timeWindow);
    trends.push(responseTimeTrend);

    // 吞吐量趋势
    const throughputTrend = this.analyzeMetricTrend(records, 'throughput', timeWindow);
    trends.push(throughputTrend);

    // 错误率趋势
    const errorRateTrend = this.analyzeMetricTrend(records, 'errorRate', timeWindow);
    trends.push(errorRateTrend);

    return trends;
  }

  /**
   * 生成分析报告
   */
  async generateReport(sessions: DebugSession[], records: DebugRecord[]): Promise<AnalysisReport> {
    if (records.length === 0) {
      return this.getEmptyReport();
    }

    // 计算总体性能指标
    const overallPerformance = await this.analyzeSession(
      sessions[0] || {
        sessionId: 'combined',
        port: 0,
        startTime: 0,
        startTimeReadable: '2024-08-16 00:00:00 CST',
        requestCount: 0,
        errorCount: 0,
        activePipelines: [],
        metadata: { version: '4.0.0', config: {}, timezone: 'CST' },
      },
      records
    );

    // 分析各模块性能
    const moduleRecords = this.groupRecordsByModule(records);
    const moduleAnalysis = Object.entries(moduleRecords).map(([moduleName, records]) => {
      const moduleRecordData = records.flatMap(r => r.pipeline?.modules || []).filter(m => m.moduleName === moduleName);
      return this.analyzeModulePerformance(moduleName, moduleRecordData);
    });

    // 分析趋势
    const trends = this.analyzeTrends(records, 60000); // 1分钟时间窗口

    // 检测异常
    const anomalies = this.detectAnomalies(records);

    // 生成建议
    const recommendations = this.generateRecommendations(overallPerformance, moduleAnalysis, anomalies);

    const timeRange = {
      start: Math.min(...records.map(r => r.timestamp)),
      end: Math.max(...records.map(r => r.timestamp)),
    };

    return {
      summary: {
        totalRequests: records.length,
        totalSessions: sessions.length,
        timeRange,
        overallPerformance,
      },
      moduleAnalysis,
      trends,
      anomalies,
      recommendations,
      generatedAt: Date.now(),
    };
  }

  /**
   * 计算统计信息
   */
  calculateStatistics(records: DebugRecord[]): DebugStatistics {
    const moduleStats = new Map<string, { recordCount: number; errorCount: number; averageDuration: number }>();

    let totalErrors = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const record of records) {
      if (record.error) {
        totalErrors++;
      }

      if (record.response?.duration) {
        totalResponseTime += record.response.duration;
        responseTimeCount++;
      }

      // 统计模块信息
      if (record.pipeline?.modules) {
        for (const module of record.pipeline.modules) {
          const existing = moduleStats.get(module.moduleName) || { recordCount: 0, errorCount: 0, averageDuration: 0 };
          existing.recordCount++;
          if (module.error) {
            existing.errorCount++;
          }
          if (module.duration) {
            existing.averageDuration =
              (existing.averageDuration * (existing.recordCount - 1) + module.duration) / existing.recordCount;
          }
          moduleStats.set(module.moduleName, existing);
        }
      }
    }

    const averageResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;

    return {
      totalSessions: 0, // 需要从外部传入
      activeSessions: 0, // 需要从外部传入
      totalRecords: records.length,
      totalErrors,
      averageResponseTime,
      diskUsage: 0, // 需要从存储管理器获取
      moduleStatistics: moduleStats,
    };
  }

  // ===== Private Helper Methods =====

  private getEmptyMetrics(): PerformanceMetrics {
    return {
      averageResponseTime: 0,
      medianResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      throughput: 0,
      errorRate: 0,
      successRate: 0,
    };
  }

  private getEmptyModuleStats(moduleName: string): ModulePerformanceStats {
    return {
      moduleName,
      callCount: 0,
      totalDuration: 0,
      averageDuration: 0,
      medianDuration: 0,
      maxDuration: 0,
      minDuration: 0,
      errorCount: 0,
      errorRate: 0,
      percentile95: 0,
      percentile99: 0,
    };
  }

  private getEmptyReport(): AnalysisReport {
    return {
      summary: {
        totalRequests: 0,
        totalSessions: 0,
        timeRange: { start: 0, end: 0 },
        overallPerformance: this.getEmptyMetrics(),
      },
      moduleAnalysis: [],
      trends: [],
      anomalies: [],
      recommendations: [],
      generatedAt: Date.now(),
    };
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;

    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedArray[lower];
    }

    return sortedArray[lower] + (sortedArray[upper] - sortedArray[lower]) * (index - lower);
  }

  private detectResponseTimeAnomalies(records: DebugRecord[]): AnomalyDetectionResult[] {
    const anomalies: AnomalyDetectionResult[] = [];
    const responseTimes = records.map(r => ({ timestamp: r.timestamp, duration: r.response?.duration || 0 }));

    const averageResponseTime = responseTimes.reduce((sum, r) => sum + r.duration, 0) / responseTimes.length;
    const threshold = averageResponseTime * this.anomalyThresholds.responseTimeMultiplier;

    for (const record of responseTimes) {
      if (record.duration > threshold) {
        anomalies.push({
          timestamp: record.timestamp,
          anomalyType: 'spike',
          severity: record.duration > threshold * 2 ? 'high' : 'medium',
          description: `响应时间异常高: ${record.duration}ms (平均值: ${averageResponseTime.toFixed(2)}ms)`,
          affectedModules: [],
          suggestedActions: ['检查系统资源使用情况', '分析慢查询', '优化代码性能'],
        });
      }
    }

    return anomalies;
  }

  private detectErrorRateAnomalies(records: DebugRecord[]): AnomalyDetectionResult[] {
    const anomalies: AnomalyDetectionResult[] = [];
    const windowSize = 10; // 10个请求为一个窗口

    for (let i = 0; i <= records.length - windowSize; i++) {
      const window = records.slice(i, i + windowSize);
      const errorCount = window.filter(r => r.error).length;
      const errorRate = errorCount / windowSize;

      if (errorRate > this.anomalyThresholds.errorRateThreshold) {
        anomalies.push({
          timestamp: window[windowSize - 1].timestamp,
          anomalyType: 'spike',
          severity: errorRate > 0.5 ? 'high' : 'medium',
          description: `错误率异常高: ${(errorRate * 100).toFixed(1)}%`,
          affectedModules: [],
          suggestedActions: ['检查错误日志', '验证输入数据', '检查依赖服务状态'],
        });
      }
    }

    return anomalies;
  }

  private detectThroughputAnomalies(records: DebugRecord[]): AnomalyDetectionResult[] {
    const anomalies: AnomalyDetectionResult[] = [];
    // 简化实现：检测吞吐量突然下降
    const interval = 60000; // 1分钟窗口
    const timeSeries = this.generateTimeSeries(records, 'throughput', interval);

    for (let i = 1; i < timeSeries.length; i++) {
      const current = timeSeries[i].value;
      const previous = timeSeries[i - 1].value;

      if (previous > 0 && current < previous * (1 - this.anomalyThresholds.throughputChangeThreshold)) {
        anomalies.push({
          timestamp: timeSeries[i].timestamp,
          anomalyType: 'dip',
          severity: current < previous * 0.2 ? 'high' : 'medium',
          description: `吞吐量显著下降: ${current.toFixed(2)} req/s (之前: ${previous.toFixed(2)} req/s)`,
          affectedModules: [],
          suggestedActions: ['检查系统负载', '验证网络连接', '检查资源瓶颈'],
        });
      }
    }

    return anomalies;
  }

  private analyzeMetricTrend(records: DebugRecord[], metric: string, timeWindow: number): PerformanceTrend {
    const timeSeries = this.generateTimeSeries(records, metric, timeWindow);

    // 简单的线性趋势分析
    const n = timeSeries.length;
    if (n < 2) {
      return {
        metric,
        timeSeries,
        trend: 'stable',
        changeRate: 0,
      };
    }

    const firstValue = timeSeries[0].value;
    const lastValue = timeSeries[n - 1].value;
    const changeRate = firstValue !== 0 ? (lastValue - firstValue) / firstValue : 0;

    let trend: 'improving' | 'degrading' | 'stable';
    if (Math.abs(changeRate) < 0.1) {
      trend = 'stable';
    } else if (metric === 'responseTime' || metric === 'errorRate') {
      trend = changeRate < 0 ? 'improving' : 'degrading';
    } else {
      trend = changeRate > 0 ? 'improving' : 'degrading';
    }

    return {
      metric,
      timeSeries,
      trend,
      changeRate,
    };
  }

  private groupRecordsByModule(records: DebugRecord[]): Record<string, DebugRecord[]> {
    const grouped: Record<string, DebugRecord[]> = {};

    for (const record of records) {
      if (record.pipeline?.modules) {
        for (const module of record.pipeline.modules) {
          if (!grouped[module.moduleName]) {
            grouped[module.moduleName] = [];
          }
          grouped[module.moduleName].push(record);
        }
      }
    }

    return grouped;
  }

  private generateRecommendations(
    performance: PerformanceMetrics,
    moduleAnalysis: ModulePerformanceStats[],
    anomalies: AnomalyDetectionResult[]
  ): string[] {
    const recommendations: string[] = [];

    // 基于性能指标的建议
    if (performance.averageResponseTime > 1000) {
      recommendations.push('平均响应时间过长，建议优化性能瓶颈模块');
    }

    if (performance.errorRate > 0.05) {
      recommendations.push('错误率较高，建议检查错误处理逻辑和输入验证');
    }

    if (performance.throughput < 10) {
      recommendations.push('吞吐量较低，建议检查并发处理能力和资源配置');
    }

    // 基于模块分析的建议
    const slowModules = moduleAnalysis.filter(m => m.averageDuration > 500);
    if (slowModules.length > 0) {
      recommendations.push(`以下模块执行较慢，建议优化: ${slowModules.map(m => m.moduleName).join(', ')}`);
    }

    // 基于异常的建议
    if (anomalies.length > 0) {
      recommendations.push('检测到性能异常，建议关注系统监控并及时处理');
    }

    return recommendations;
  }
}
