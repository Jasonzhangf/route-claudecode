/**
 * Provider性能优化工具
 * 
 * 基于实际测试结果优化Provider处理逻辑
 * 提供性能分析和优化建议
 * 
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { IModuleInterface } from '../interfaces/core/module-implementation-interface';

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  responseTime: number;
  throughput: number; // 请求/秒
  errorRate: number; // 0-1
  cpuUsage: number; // 0-100
  memoryUsage: number; // bytes
  concurrency: number;
  timestamp: number;
}

/**
 * 性能阈值配置
 */
export interface PerformanceThresholds {
  responseTime: {
    excellent: number; // <100ms
    good: number; // <500ms  
    acceptable: number; // <1000ms
  };
  throughput: {
    minimum: number; // req/s
    target: number; // req/s
    maximum: number; // req/s
  };
  errorRate: {
    maximum: number; // 5%
  };
  resources: {
    maxMemory: number; // bytes
    maxCpu: number; // percentage
  };
}

/**
 * 优化建议
 */
export interface OptimizationRecommendation {
  type: 'configuration' | 'architecture' | 'resources' | 'code';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  implementation: string;
  estimatedImprovement: string;
}

/**
 * Provider性能分析器
 */
export class ProviderPerformanceAnalyzer extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private thresholds: PerformanceThresholds;
  
  constructor(thresholds?: Partial<PerformanceThresholds>) {
    super();
    
    this.thresholds = {
      responseTime: {
        excellent: 100,
        good: 500,
        acceptable: 1000
      },
      throughput: {
        minimum: 1,
        target: 10,
        maximum: 50
      },
      errorRate: {
        maximum: 0.05 // 5%
      },
      resources: {
        maxMemory: 200 * 1024 * 1024, // 200MB
        maxCpu: 80 // 80%
      },
      ...thresholds
    };
  }
  
  /**
   * 记录性能指标
   */
  recordMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push({
      ...metrics,
      timestamp: Date.now()
    });
    
    // 保留最近1000个指标
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
    
    this.emit('metricsRecorded', metrics);
    
    // 实时分析和告警
    this.analyzeRealtime(metrics);
  }
  
  /**
   * 实时性能分析
   */
  private analyzeRealtime(metrics: PerformanceMetrics): void {
    // 响应时间告警
    if (metrics.responseTime > this.thresholds.responseTime.acceptable) {
      this.emit('performanceAlert', {
        type: 'responseTime',
        severity: 'critical',
        message: `响应时间过长: ${metrics.responseTime}ms`,
        metrics
      });
    }
    
    // 错误率告警
    if (metrics.errorRate > this.thresholds.errorRate.maximum) {
      this.emit('performanceAlert', {
        type: 'errorRate',
        severity: 'critical', 
        message: `错误率过高: ${(metrics.errorRate * 100).toFixed(2)}%`,
        metrics
      });
    }
    
    // 资源使用告警
    if (metrics.memoryUsage > this.thresholds.resources.maxMemory) {
      this.emit('performanceAlert', {
        type: 'memory',
        severity: 'high',
        message: `内存使用过高: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
        metrics
      });
    }
  }
  
  /**
   * 生成性能报告
   */
  generateReport(timeWindow?: number): PerformanceReport {
    const now = Date.now();
    const windowStart = timeWindow ? now - timeWindow : 0;
    
    const relevantMetrics = this.metrics.filter(m => m.timestamp >= windowStart);
    
    if (relevantMetrics.length === 0) {
      return {
        summary: {
          avgResponseTime: 0,
          avgThroughput: 0,
          avgErrorRate: 0,
          totalRequests: 0
        },
        trends: [],
        recommendations: [],
        score: 0
      };
    }
    
    // 计算摘要统计
    const summary = this.calculateSummary(relevantMetrics);
    
    // 分析趋势
    const trends = this.analyzeTrends(relevantMetrics);
    
    // 生成优化建议
    const recommendations = this.generateRecommendations(summary, trends);
    
    // 计算性能评分
    const score = this.calculatePerformanceScore(summary);
    
    return {
      summary,
      trends,
      recommendations,
      score,
      timeWindow: {
        start: windowStart,
        end: now,
        duration: now - windowStart
      }
    };
  }
  
  /**
   * 计算摘要统计
   */
  private calculateSummary(metrics: PerformanceMetrics[]): PerformanceSummary {
    const totalRequests = metrics.reduce((sum, m) => sum + m.throughput, 0);
    
    return {
      avgResponseTime: this.average(metrics.map(m => m.responseTime)),
      p95ResponseTime: this.percentile(metrics.map(m => m.responseTime), 95),
      p99ResponseTime: this.percentile(metrics.map(m => m.responseTime), 99),
      avgThroughput: this.average(metrics.map(m => m.throughput)),
      maxThroughput: Math.max(...metrics.map(m => m.throughput)),
      avgErrorRate: this.average(metrics.map(m => m.errorRate)),
      maxErrorRate: Math.max(...metrics.map(m => m.errorRate)),
      avgMemoryUsage: this.average(metrics.map(m => m.memoryUsage)),
      maxMemoryUsage: Math.max(...metrics.map(m => m.memoryUsage)),
      avgCpuUsage: this.average(metrics.map(m => m.cpuUsage)),
      maxCpuUsage: Math.max(...metrics.map(m => m.cpuUsage)),
      totalRequests,
      dataPoints: metrics.length
    };
  }
  
  /**
   * 分析性能趋势
   */
  private analyzeTrends(metrics: PerformanceMetrics[]): PerformanceTrend[] {
    const trends: PerformanceTrend[] = [];
    
    // 响应时间趋势
    const responseTimeTrend = this.calculateTrend(metrics.map(m => m.responseTime));
    trends.push({
      metric: 'responseTime',
      direction: responseTimeTrend > 0.1 ? 'increasing' : responseTimeTrend < -0.1 ? 'decreasing' : 'stable',
      slope: responseTimeTrend,
      significance: Math.abs(responseTimeTrend) > 0.5 ? 'high' : Math.abs(responseTimeTrend) > 0.2 ? 'medium' : 'low'
    });
    
    // 吞吐量趋势
    const throughputTrend = this.calculateTrend(metrics.map(m => m.throughput));
    trends.push({
      metric: 'throughput',
      direction: throughputTrend > 0.1 ? 'increasing' : throughputTrend < -0.1 ? 'decreasing' : 'stable',
      slope: throughputTrend,
      significance: Math.abs(throughputTrend) > 0.5 ? 'high' : Math.abs(throughputTrend) > 0.2 ? 'medium' : 'low'
    });
    
    // 错误率趋势
    const errorRateTrend = this.calculateTrend(metrics.map(m => m.errorRate));
    trends.push({
      metric: 'errorRate',
      direction: errorRateTrend > 0.01 ? 'increasing' : errorRateTrend < -0.01 ? 'decreasing' : 'stable',
      slope: errorRateTrend,
      significance: Math.abs(errorRateTrend) > 0.05 ? 'high' : Math.abs(errorRateTrend) > 0.02 ? 'medium' : 'low'
    });
    
    return trends;
  }
  
  /**
   * 生成优化建议
   */
  private generateRecommendations(summary: PerformanceSummary, trends: PerformanceTrend[]): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    
    // 响应时间优化
    if (summary.avgResponseTime > this.thresholds.responseTime.good) {
      recommendations.push({
        type: 'configuration',
        priority: 'high',
        title: '优化响应时间',
        description: `平均响应时间 ${summary.avgResponseTime.toFixed(0)}ms 超过良好阈值 ${this.thresholds.responseTime.good}ms`,
        impact: '提升用户体验，降低延迟',
        implementation: '调整超时设置、启用连接池、优化请求处理逻辑',
        estimatedImprovement: '响应时间可改善20-40%'
      });
    }
    
    // 高错误率
    if (summary.avgErrorRate > this.thresholds.errorRate.maximum) {
      recommendations.push({
        type: 'code',
        priority: 'critical',
        title: '改进错误处理',
        description: `错误率 ${(summary.avgErrorRate * 100).toFixed(2)}% 超过阈值 ${(this.thresholds.errorRate.maximum * 100).toFixed(2)}%`,
        impact: '提高系统可靠性和稳定性',
        implementation: '增加重试机制、改进错误恢复、添加熔断器',
        estimatedImprovement: '错误率可降低50-80%'
      });
    }
    
    // 内存使用优化
    if (summary.maxMemoryUsage > this.thresholds.resources.maxMemory) {
      recommendations.push({
        type: 'code',
        priority: 'medium',
        title: '优化内存使用',
        description: `最大内存使用 ${(summary.maxMemoryUsage / 1024 / 1024).toFixed(2)}MB 超过阈值`,
        impact: '降低资源消耗，提高系统稳定性',
        implementation: '优化对象创建、添加缓存清理、改进垃圾回收',
        estimatedImprovement: '内存使用可降低30-50%'
      });
    }
    
    // 并发性能优化
    if (summary.avgThroughput < this.thresholds.throughput.target) {
      recommendations.push({
        type: 'architecture',
        priority: 'medium',
        title: '提升并发性能',
        description: `平均吞吐量 ${summary.avgThroughput.toFixed(2)} req/s 低于目标 ${this.thresholds.throughput.target} req/s`,
        impact: '提高系统处理能力',
        implementation: '增加并发连接数、优化队列管理、实现负载均衡',
        estimatedImprovement: '吞吐量可提升50-100%'
      });
    }
    
    // 趋势分析建议
    const responseTimeTrend = trends.find(t => t.metric === 'responseTime');
    if (responseTimeTrend?.direction === 'increasing' && responseTimeTrend.significance === 'high') {
      recommendations.push({
        type: 'architecture',
        priority: 'high',
        title: '响应时间持续恶化',
        description: '响应时间呈明显上升趋势，需要立即关注',
        impact: '防止系统性能进一步恶化',
        implementation: '分析性能瓶颈、优化热点代码、考虑扩容',
        estimatedImprovement: '阻止性能进一步恶化'
      });
    }
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }
  
  /**
   * 计算性能评分
   */
  private calculatePerformanceScore(summary: PerformanceSummary): number {
    let score = 100;
    
    // 响应时间评分 (30分)
    if (summary.avgResponseTime <= this.thresholds.responseTime.excellent) {
      // 优秀，满分
    } else if (summary.avgResponseTime <= this.thresholds.responseTime.good) {
      score -= 10; // 良好，扣10分
    } else if (summary.avgResponseTime <= this.thresholds.responseTime.acceptable) {
      score -= 20; // 可接受，扣20分
    } else {
      score -= 30; // 不可接受，扣30分
    }
    
    // 错误率评分 (25分)
    if (summary.avgErrorRate <= 0.01) {
      // 1%以下，满分
    } else if (summary.avgErrorRate <= 0.03) {
      score -= 10; // 3%以下，扣10分
    } else if (summary.avgErrorRate <= this.thresholds.errorRate.maximum) {
      score -= 20; // 阈值内，扣20分
    } else {
      score -= 25; // 超出阈值，扣25分
    }
    
    // 吞吐量评分 (25分)
    if (summary.avgThroughput >= this.thresholds.throughput.target) {
      // 达到目标，满分
    } else if (summary.avgThroughput >= this.thresholds.throughput.minimum) {
      score -= 15; // 最低要求以上，扣15分
    } else {
      score -= 25; // 低于最低要求，扣25分
    }
    
    // 资源使用评分 (20分)
    if (summary.maxMemoryUsage <= this.thresholds.resources.maxMemory * 0.8) {
      // 80%以下，满分
    } else if (summary.maxMemoryUsage <= this.thresholds.resources.maxMemory) {
      score -= 10; // 阈值内，扣10分
    } else {
      score -= 20; // 超出阈值，扣20分
    }
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * 计算平均值
   */
  private average(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }
  
  /**
   * 计算百分位数
   */
  private percentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
  
  /**
   * 计算趋势斜率
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }
}

/**
 * 性能报告
 */
export interface PerformanceReport {
  summary: PerformanceSummary;
  trends: PerformanceTrend[];
  recommendations: OptimizationRecommendation[];
  score: number;
  timeWindow?: {
    start: number;
    end: number;
    duration: number;
  };
}

/**
 * 性能摘要
 */
export interface PerformanceSummary {
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  avgThroughput: number;
  maxThroughput: number;
  avgErrorRate: number;
  maxErrorRate: number;
  avgMemoryUsage: number;
  maxMemoryUsage: number;
  avgCpuUsage: number;
  maxCpuUsage: number;
  totalRequests: number;
  dataPoints: number;
}

/**
 * 性能趋势
 */
export interface PerformanceTrend {
  metric: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  slope: number;
  significance: 'high' | 'medium' | 'low';
}