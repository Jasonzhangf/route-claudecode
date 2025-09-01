// 性能监控和度量收集
import { testLogger } from './test-logger';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  context?: Record<string, any>;
  tags?: string[];
}

export interface PerformanceSummary {
  testName: string;
  duration: number; // milliseconds
  memoryUsage: {
    start: number; // bytes
    end: number;   // bytes
    peak: number;  // bytes
  };
  cpuUsage?: {
    start: NodeJS.CpuUsage;
    end: NodeJS.CpuUsage;
  };
  customMetrics: PerformanceMetric[];
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private summaries: PerformanceSummary[] = [];
  
  // 记录自定义性能指标
  recordMetric(name: string, value: number, unit: string, context?: Record<string, any>, tags?: string[]): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      context,
      tags
    };
    
    this.metrics.push(metric);
    testLogger.debug(`Recorded metric: ${name} = ${value} ${unit}`, context);
  }
  
  // 开始性能监控
  startMonitoring(testName: string): PerformanceContext {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    const startCpu = process.cpuUsage();
    
    let peakMemory = startMemory.rss;
    
    // 定期检查内存使用情况
    const memoryCheckInterval = setInterval(() => {
      const currentMemory = process.memoryUsage().rss;
      if (currentMemory > peakMemory) {
        peakMemory = currentMemory;
      }
    }, 10); // 每10ms检查一次
    
    return {
      testName,
      startTime,
      startMemory,
      startCpu,
      peakMemory,
      memoryCheckInterval,
      monitor: this
    };
  }
  
  // 结束性能监控并生成摘要
  endMonitoring(context: PerformanceContext): PerformanceSummary {
    // 停止内存检查
    clearInterval(context.memoryCheckInterval);
    
    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    const endCpu = process.cpuUsage(context.startCpu);
    
    const summary: PerformanceSummary = {
      testName: context.testName,
      duration: endTime - context.startTime,
      memoryUsage: {
        start: context.startMemory.rss,
        end: endMemory.rss,
        peak: context.peakMemory
      },
      cpuUsage: {
        start: context.startCpu,
        end
      },
      customMetrics: this.getMetricsForTest(context.testName)
    };
    
    this.summaries.push(summary);
    
    // 记录性能摘要到日志
    testLogger.info(`Performance summary for ${context.testName}`, {
      duration: `${summary.duration}ms`,
      memory: {
        start: `${(summary.memoryUsage.start / 1024 / 1024).toFixed(2)}MB`,
        end: `${(summary.memoryUsage.end / 1024 / 1024).toFixed(2)}MB`,
        peak: `${(summary.memoryUsage.peak / 1024 / 1024).toFixed(2)}MB`
      }
    });
    
    return summary;
  }
  
  // 获取特定测试的指标
  private getMetricsForTest(testName: string): PerformanceMetric[] {
    return this.metrics.filter(metric => 
      metric.context?.testName === testName || 
      metric.tags?.includes(testName)
    );
  }
  
  // 获取所有性能摘要
  getSummaries(): PerformanceSummary[] {
    return [...this.summaries];
  }
  
  // 获取所有指标
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }
  
  // 清空数据
  clear(): void {
    this.metrics = [];
    this.summaries = [];
  }
  
  // 检查性能回归
  checkPerformanceRegression(currentSummary: PerformanceSummary, threshold: number = 0.1): PerformanceRegression[] {
    const regressions: PerformanceRegression[] = [];
    
    // 查找历史数据进行比较
    const historicalSummaries = this.summaries.filter(s => s.testName === currentSummary.testName);
    
    if (historicalSummaries.length > 0) {
      // 使用最近的5次执行的平均值作为基准
      const recentSummaries = historicalSummaries.slice(-5);
      const avgDuration = recentSummaries.reduce((sum, s) => sum + s.duration, 0) / recentSummaries.length;
      
      // 检查持续时间是否超出阈值
      if (currentSummary.duration > avgDuration * (1 + threshold)) {
        regressions.push({
          metric: 'duration',
          currentValue: currentSummary.duration,
          baselineValue: avgDuration,
          percentageChange: ((currentSummary.duration - avgDuration) / avgDuration) * 100,
          severity: 'high'
        });
      }
      
      // 检查内存使用是否超出阈值
      const avgMemory = recentSummaries.reduce((sum, s) => sum + s.memoryUsage.peak, 0) / recentSummaries.length;
      if (currentSummary.memoryUsage.peak > avgMemory * (1 + threshold)) {
        regressions.push({
          metric: 'memory',
          currentValue: currentSummary.memoryUsage.peak,
          baselineValue: avgMemory,
          percentageChange: ((currentSummary.memoryUsage.peak - avgMemory) / avgMemory) * 100,
          severity: 'medium'
        });
      }
    }
    
    return regressions;
  }
}

// 性能监控上下文
export interface PerformanceContext {
  testName: string;
  startTime: number;
  startMemory: NodeJS.MemoryUsage;
  startCpu: NodeJS.CpuUsage;
  peakMemory: number;
  memoryCheckInterval: NodeJS.Timeout;
  monitor: PerformanceMonitor;
}

// 性能回归
export interface PerformanceRegression {
  metric: string;
  currentValue: number;
  baselineValue: number;
  percentageChange: number;
  severity: 'low' | 'medium' | 'high';
}

// 全局性能监控实例
export const performanceMonitor = new PerformanceMonitor();

// 性能监控装饰器
export function monitorPerformance(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;
  
  descriptor.value = function (...args: any[]) {
    const context = performanceMonitor.startMonitoring(propertyName);
    
    try {
      const result = method.apply(this, args);
      
      if (result instanceof Promise) {
        return result.then((res) => {
          performanceMonitor.endMonitoring(context);
          return res;
        }).catch((error) => {
          performanceMonitor.endMonitoring(context);
          throw error;
        });
      } else {
        performanceMonitor.endMonitoring(context);
        return result;
      }
    } catch (error) {
      performanceMonitor.endMonitoring(context);
      throw error;
    }
  };
}