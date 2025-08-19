/**
 * 流水线性能监控
 *
 * @author Jason Zhang
 */

export interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
}

export class PipelinePerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];

  recordMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);
  }

  getAverageMetrics(): PerformanceMetrics {
    if (this.metrics.length === 0) {
      return { executionTime: 0, memoryUsage: 0, cpuUsage: 0 };
    }

    const sum = this.metrics.reduce(
      (acc, metric) => ({
        executionTime: acc.executionTime + metric.executionTime,
        memoryUsage: acc.memoryUsage + metric.memoryUsage,
        cpuUsage: acc.cpuUsage + metric.cpuUsage,
      }),
      { executionTime: 0, memoryUsage: 0, cpuUsage: 0 }
    );

    return {
      executionTime: sum.executionTime / this.metrics.length,
      memoryUsage: sum.memoryUsage / this.metrics.length,
      cpuUsage: sum.cpuUsage / this.metrics.length,
    };
  }
}
