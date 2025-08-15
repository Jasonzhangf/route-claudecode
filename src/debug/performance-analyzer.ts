/**
 * 性能分析器实现
 * 
 * 提供系统性能分析、监控和报告功能
 * 
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import {
  IPerformanceAnalyzer,
  PerformanceTrace,
  DebugConfig
} from '../interfaces/core/debug-interface';

/**
 * 性能统计数据
 */
interface PerformanceStats {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  totalRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number; // requests per second
  errorRate: number;
  memoryStats: {
    averageHeapUsed: number;
    maxHeapUsed: number;
    averageHeapTotal: number;
    maxHeapTotal: number;
  };
  cpuStats: {
    averageUserTime: number;
    averageSystemTime: number;
    totalUserTime: number;
    totalSystemTime: number;
  };
}

/**
 * 性能分析结果
 */
interface PerformanceAnalysis {
  sessionId: string;
  period: {
    start: Date;
    end: Date;
    duration: number;
  };
  requests: {
    total: number;
    successful: number;
    failed: number;
    throughput: number;
  };
  responseTime: {
    average: number;
    min: number;
    max: number;
    percentiles: {
      p50: number;
      p75: number;
      p90: number;
      p95: number;
      p99: number;
    };
    distribution: Array<{ range: string; count: number; percentage: number }>;
  };
  resources: {
    memory: {
      average: number;
      peak: number;
      trend: 'increasing' | 'stable' | 'decreasing';
    };
    cpu: {
      averageUser: number;
      averageSystem: number;
      total: number;
    };
  };
  bottlenecks: Array<{
    type: 'memory' | 'cpu' | 'response_time' | 'throughput';
    severity: 'low' | 'medium' | 'high';
    description: string;
    recommendation: string;
  }>;
  trends: Array<{
    metric: string;
    direction: 'increasing' | 'decreasing' | 'stable';
    change: number;
    significance: 'low' | 'medium' | 'high';
  }>;
}

/**
 * 性能分析器实现类
 */
export class PerformanceAnalyzer extends EventEmitter implements IPerformanceAnalyzer {
  private config: DebugConfig;
  private activeProfiles: Map<string, {
    sessionId: string;
    startTime: Date;
    traces: PerformanceTrace[];
    intervalId?: any;
  }> = new Map();

  constructor(config: DebugConfig) {
    super();
    this.config = config;
  }

  /**
   * 开始性能分析
   */
  async startProfiling(sessionId: string): Promise<void> {
    if (this.activeProfiles.has(sessionId)) {
      throw new Error(`Performance profiling for session ${sessionId} is already active`);
    }

    const profile = {
      sessionId,
      startTime: new Date(),
      traces: []
    };

    // 设置定期采样
    if (this.config.enablePerformanceTracking) {
      (profile as any).intervalId = setInterval(() => {
        this.collectSystemMetrics(sessionId);
      }, 1000); // 每秒采样一次
    }

    this.activeProfiles.set(sessionId, profile);
    this.emit('profiling-started', sessionId);
  }

  /**
   * 停止性能分析
   */
  async stopProfiling(sessionId: string): Promise<PerformanceTrace[]> {
    const profile = this.activeProfiles.get(sessionId);
    if (!profile) {
      throw new Error(`No active profiling found for session ${sessionId}`);
    }

    // 清除定期采样
    if ((profile as any).intervalId) {
      clearInterval((profile as any).intervalId);
    }

    const traces = [...profile.traces];
    this.activeProfiles.delete(sessionId);
    
    this.emit('profiling-stopped', sessionId, traces.length);
    return traces;
  }

  /**
   * 添加性能追踪数据
   */
  async addPerformanceTrace(sessionId: string, trace: PerformanceTrace): Promise<void> {
    const profile = this.activeProfiles.get(sessionId);
    if (profile) {
      profile.traces.push(trace);
    }
  }

  /**
   * 分析性能数据
   */
  async analyzePerformance(traces: PerformanceTrace[]): Promise<PerformanceAnalysis> {
    if (traces.length === 0) {
      throw new Error('No performance traces provided for analysis');
    }

    const sessionId = `analysis_${Date.now()}`;
    const startTime = new Date(Math.min(...traces.map(t => 
      new Date().getTime() - t.totalTime
    )));
    const endTime = new Date();

    // 计算基础统计
    const stats = this.calculateBasicStats(traces);
    
    // 计算百分位数
    const percentiles = this.calculatePercentiles(traces.map(t => t.totalTime));
    
    // 分析响应时间分布
    const distribution = this.calculateResponseTimeDistribution(traces);
    
    // 分析资源使用情况
    const resourceAnalysis = this.analyzeResourceUsage(traces);
    
    // 识别瓶颈
    const bottlenecks = this.identifyBottlenecks(traces, stats);
    
    // 分析趋势
    const trends = this.analyzeTrends(traces);

    const analysis: PerformanceAnalysis = {
      sessionId,
      period: {
        start: startTime,
        end: endTime,
        duration: endTime.getTime() - startTime.getTime()
      },
      requests: {
        total: traces.length,
        successful: traces.length, // 简化：假设所有请求都成功
        failed: 0,
        throughput: this.calculateThroughput(traces, startTime, endTime)
      },
      responseTime: {
        average: stats.averageResponseTime,
        min: stats.minResponseTime,
        max: stats.maxResponseTime,
        percentiles: {
          p50: percentiles.p50,
          p75: percentiles.p75,
          p90: percentiles.p90,
          p95: percentiles.p95,
          p99: percentiles.p99
        },
        distribution
      },
      resources: resourceAnalysis,
      bottlenecks,
      trends
    };

    this.emit('analysis-completed', analysis);
    return analysis;
  }

  /**
   * 生成性能报告
   */
  async generatePerformanceReport(analysis: PerformanceAnalysis, format: 'json' | 'html' | 'csv'): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFileName = `performance-report-${analysis.sessionId}-${timestamp}`;

    switch (format) {
      case 'json':
        return this.generateJsonReport(analysis, baseFileName);
      case 'html':
        return this.generateHtmlReport(analysis, baseFileName);
      case 'csv':
        return this.generateCsvReport(analysis, baseFileName);
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }
  }

  /**
   * 收集系统指标
   */
  private collectSystemMetrics(sessionId: string): void {
    const profile = this.activeProfiles.get(sessionId);
    if (!profile) {
      return;
    }

    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const trace: PerformanceTrace = {
      totalTime: 0, // 系统采样，非请求追踪
      routingTime: 0,
      pipelineTime: 0,
      networkTime: 0,
      transformTime: 0,
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system
      }
    };

    profile.traces.push(trace);
  }

  /**
   * 计算基础统计
   */
  private calculateBasicStats(traces: PerformanceTrace[]): PerformanceStats {
    const responseTimes = traces.map(t => t.totalTime);
    const memoryUsages = traces.map(t => t.memoryUsage.heapUsed);

    return {
      sessionId: 'analysis',
      startTime: new Date(),
      totalRequests: traces.length,
      averageResponseTime: this.average(responseTimes),
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      p50ResponseTime: this.percentile(responseTimes, 0.5),
      p95ResponseTime: this.percentile(responseTimes, 0.95),
      p99ResponseTime: this.percentile(responseTimes, 0.99),
      throughput: 0, // 需要时间信息计算
      errorRate: 0,
      memoryStats: {
        averageHeapUsed: this.average(memoryUsages),
        maxHeapUsed: Math.max(...memoryUsages),
        averageHeapTotal: this.average(traces.map(t => t.memoryUsage.heapTotal)),
        maxHeapTotal: Math.max(...traces.map(t => t.memoryUsage.heapTotal))
      },
      cpuStats: {
        averageUserTime: this.average(traces.map(t => t.cpuUsage.user)),
        averageSystemTime: this.average(traces.map(t => t.cpuUsage.system)),
        totalUserTime: traces.reduce((sum, t) => sum + t.cpuUsage.user, 0),
        totalSystemTime: traces.reduce((sum, t) => sum + t.cpuUsage.system, 0)
      }
    };
  }

  /**
   * 计算百分位数
   */
  private calculatePercentiles(values: number[]): {
    p50: number; p75: number; p90: number; p95: number; p99: number;
  } {
    return {
      p50: this.percentile(values, 0.5),
      p75: this.percentile(values, 0.75),
      p90: this.percentile(values, 0.90),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99)
    };
  }

  /**
   * 计算响应时间分布
   */
  private calculateResponseTimeDistribution(traces: PerformanceTrace[]): Array<{
    range: string; count: number; percentage: number;
  }> {
    const responseTimes = traces.map(t => t.totalTime);
    const total = responseTimes.length;
    
    const ranges = [
      { min: 0, max: 50, label: '0-50ms' },
      { min: 50, max: 100, label: '50-100ms' },
      { min: 100, max: 200, label: '100-200ms' },
      { min: 200, max: 500, label: '200-500ms' },
      { min: 500, max: 1000, label: '500ms-1s' },
      { min: 1000, max: Infinity, label: '>1s' }
    ];

    return ranges.map(range => {
      const count = responseTimes.filter(time => 
        time >= range.min && time < range.max
      ).length;
      
      return {
        range: range.label,
        count,
        percentage: Math.round((count / total) * 100 * 100) / 100
      };
    });
  }

  /**
   * 分析资源使用情况
   */
  private analyzeResourceUsage(traces: PerformanceTrace[]): PerformanceAnalysis['resources'] {
    const memoryUsages = traces.map(t => t.memoryUsage.heapUsed);
    const userCpuUsages = traces.map(t => t.cpuUsage.user);
    const systemCpuUsages = traces.map(t => t.cpuUsage.system);

    // 简单的趋势分析
    const memoryTrend = this.calculateTrend(memoryUsages);

    return {
      memory: {
        average: this.average(memoryUsages),
        peak: Math.max(...memoryUsages),
        trend: memoryTrend
      },
      cpu: {
        averageUser: this.average(userCpuUsages),
        averageSystem: this.average(systemCpuUsages),
        total: this.average(userCpuUsages) + this.average(systemCpuUsages)
      }
    };
  }

  /**
   * 识别瓶颈
   */
  private identifyBottlenecks(traces: PerformanceTrace[], stats: PerformanceStats): PerformanceAnalysis['bottlenecks'] {
    const bottlenecks: PerformanceAnalysis['bottlenecks'] = [];

    // 响应时间瓶颈
    if (stats.p95ResponseTime > 1000) {
      bottlenecks.push({
        type: 'response_time',
        severity: 'high',
        description: `95th percentile response time is ${stats.p95ResponseTime}ms`,
        recommendation: 'Consider optimizing slow operations and implementing caching'
      });
    }

    // 内存瓶颈
    const memoryUsageGB = stats.memoryStats.maxHeapUsed / (1024 * 1024 * 1024);
    if (memoryUsageGB > 1) {
      bottlenecks.push({
        type: 'memory',
        severity: 'medium',
        description: `Peak memory usage is ${memoryUsageGB.toFixed(2)}GB`,
        recommendation: 'Monitor memory usage and consider implementing memory optimization'
      });
    }

    return bottlenecks;
  }

  /**
   * 分析趋势
   */
  private analyzeTrends(traces: PerformanceTrace[]): PerformanceAnalysis['trends'] {
    const trends: PerformanceAnalysis['trends'] = [];

    // 响应时间趋势
    const responseTimes = traces.map(t => t.totalTime);
    const responseTimeTrend = this.calculateTrendDirection(responseTimes);
    
    trends.push({
      metric: 'Response Time',
      direction: responseTimeTrend.direction,
      change: responseTimeTrend.change,
      significance: responseTimeTrend.significance
    });

    // 内存使用趋势
    const memoryUsages = traces.map(t => t.memoryUsage.heapUsed);
    const memoryTrend = this.calculateTrendDirection(memoryUsages);
    
    trends.push({
      metric: 'Memory Usage',
      direction: memoryTrend.direction,
      change: memoryTrend.change,
      significance: memoryTrend.significance
    });

    return trends;
  }

  /**
   * 计算吞吐量
   */
  private calculateThroughput(traces: PerformanceTrace[], startTime: Date, endTime: Date): number {
    const durationSeconds = (endTime.getTime() - startTime.getTime()) / 1000;
    return durationSeconds > 0 ? traces.length / durationSeconds : 0;
  }

  /**
   * 生成JSON报告
   */
  private async generateJsonReport(analysis: PerformanceAnalysis, baseFileName: string): Promise<string> {
    const fileName = `${baseFileName}.json`;
    const content = JSON.stringify(analysis, null, 2);
    
    await fs.writeFile(fileName, content);
    return fileName;
  }

  /**
   * 生成HTML报告
   */
  private async generateHtmlReport(analysis: PerformanceAnalysis, baseFileName: string): Promise<string> {
    const fileName = `${baseFileName}.html`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .metric-card { background: white; border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .trend-up { color: #28a745; }
        .trend-down { color: #dc3545; }
        .trend-stable { color: #6c757d; }
        .bottleneck-high { color: #dc3545; }
        .bottleneck-medium { color: #ffc107; }
        .bottleneck-low { color: #28a745; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Performance Analysis Report</h1>
        <p><strong>Session:</strong> ${analysis.sessionId}</p>
        <p><strong>Period:</strong> ${analysis.period.start.toISOString()} - ${analysis.period.end.toISOString()}</p>
        <p><strong>Duration:</strong> ${Math.round(analysis.period.duration / 1000)}s</p>
    </div>

    <div class="metric-card">
        <h2>Request Metrics</h2>
        <p>Total Requests: <span class="metric-value">${analysis.requests.total}</span></p>
        <p>Throughput: <span class="metric-value">${analysis.requests.throughput.toFixed(2)} req/s</span></p>
        <p>Success Rate: <span class="metric-value">${((analysis.requests.successful / analysis.requests.total) * 100).toFixed(1)}%</span></p>
    </div>

    <div class="metric-card">
        <h2>Response Time Analysis</h2>
        <p>Average: <span class="metric-value">${analysis.responseTime.average.toFixed(2)}ms</span></p>
        <p>95th Percentile: <span class="metric-value">${analysis.responseTime.percentiles.p95.toFixed(2)}ms</span></p>
        <p>99th Percentile: <span class="metric-value">${analysis.responseTime.percentiles.p99.toFixed(2)}ms</span></p>
        
        <h3>Distribution</h3>
        <table>
            <tr><th>Range</th><th>Count</th><th>Percentage</th></tr>
            ${analysis.responseTime.distribution.map(d => `
            <tr>
                <td>${d.range}</td>
                <td>${d.count}</td>
                <td>${d.percentage}%</td>
            </tr>
            `).join('')}
        </table>
    </div>

    <div class="metric-card">
        <h2>Resource Usage</h2>
        <p>Memory Peak: <span class="metric-value">${(analysis.resources.memory.peak / (1024 * 1024)).toFixed(2)}MB</span></p>
        <p>Memory Trend: <span class="trend-${analysis.resources.memory.trend}">${analysis.resources.memory.trend}</span></p>
        <p>CPU Average: <span class="metric-value">${analysis.resources.cpu.total.toFixed(2)}μs</span></p>
    </div>

    <div class="metric-card">
        <h2>Bottlenecks</h2>
        ${analysis.bottlenecks.map(b => `
        <div class="bottleneck-${b.severity}">
            <h4>${b.type.toUpperCase()} - ${b.severity.toUpperCase()}</h4>
            <p><strong>Issue:</strong> ${b.description}</p>
            <p><strong>Recommendation:</strong> ${b.recommendation}</p>
        </div>
        `).join('')}
    </div>

    <div class="metric-card">
        <h2>Trends</h2>
        <table>
            <tr><th>Metric</th><th>Direction</th><th>Change</th><th>Significance</th></tr>
            ${analysis.trends.map(t => `
            <tr>
                <td>${t.metric}</td>
                <td class="trend-${t.direction === 'stable' ? 'stable' : t.direction === 'increasing' ? 'up' : 'down'}">${t.direction}</td>
                <td>${t.change.toFixed(2)}%</td>
                <td>${t.significance}</td>
            </tr>
            `).join('')}
        </table>
    </div>
</body>
</html>
    `;

    await fs.writeFile(fileName, html);
    return fileName;
  }

  /**
   * 生成CSV报告
   */
  private async generateCsvReport(analysis: PerformanceAnalysis, baseFileName: string): Promise<string> {
    const fileName = `${baseFileName}.csv`;
    
    const csvContent = [
      'Metric,Value',
      `Session ID,${analysis.sessionId}`,
      `Total Requests,${analysis.requests.total}`,
      `Throughput,${analysis.requests.throughput}`,
      `Average Response Time,${analysis.responseTime.average}`,
      `P95 Response Time,${analysis.responseTime.percentiles.p95}`,
      `P99 Response Time,${analysis.responseTime.percentiles.p99}`,
      `Memory Peak,${analysis.resources.memory.peak}`,
      `CPU Average,${analysis.resources.cpu.total}`,
    ].join('\n');

    await fs.writeFile(fileName, csvContent);
    return fileName;
  }

  // Utility methods
  private average(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const index = (p * (sorted.length - 1));
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private calculateTrend(values: number[]): 'increasing' | 'stable' | 'decreasing' {
    if (values.length < 2) return 'stable';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = this.average(firstHalf);
    const secondAvg = this.average(secondHalf);
    
    const change = (secondAvg - firstAvg) / firstAvg;
    
    if (Math.abs(change) < 0.05) return 'stable';
    return change > 0 ? 'increasing' : 'decreasing';
  }

  private calculateTrendDirection(values: number[]): {
    direction: 'increasing' | 'decreasing' | 'stable';
    change: number;
    significance: 'low' | 'medium' | 'high';
  } {
    if (values.length < 2) {
      return { direction: 'stable', change: 0, significance: 'low' };
    }

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = this.average(firstHalf);
    const secondAvg = this.average(secondHalf);
    
    const change = firstAvg !== 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
    const absChange = Math.abs(change);

    let direction: 'increasing' | 'decreasing' | 'stable';
    let significance: 'low' | 'medium' | 'high';

    if (absChange < 5) {
      direction = 'stable';
      significance = 'low';
    } else {
      direction = change > 0 ? 'increasing' : 'decreasing';
      if (absChange < 15) {
        significance = 'low';
      } else if (absChange < 30) {
        significance = 'medium';
      } else {
        significance = 'high';
      }
    }

    return { direction, change, significance };
  }
}