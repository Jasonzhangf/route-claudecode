/**
 * Pipeline健康监控器
 * 
 * 负责监控所有Pipeline的健康状态
 * 提供健康检查、性能监控和问题诊断功能
 * 
 * @author RCC v4.0
 */

import { EventEmitter } from 'events';
import { secureLogger } from '../utils/secure-logger';
import {
  CompletePipeline,
  PipelineHealthCheckResult
} from './pipeline-manager-types';
import { PerformanceMetrics, ExecutionRecord, ModuleExecutionRecord } from '../interfaces/pipeline/pipeline-framework';

export class PipelineHealthMonitor extends EventEmitter {
  private healthCheckInterval?: NodeJS.Timeout;
  private performanceHistory: Map<string, PerformanceMetrics[]> = new Map();
  private maxHistorySize: number = 100;

  constructor() {
    super();
  }

  /**
   * 启动健康监控
   */
  startHealthMonitoring(pipelines: Map<string, CompletePipeline>, intervalMs: number = 30000): void {
    if (this.healthCheckInterval) {
      this.stopHealthMonitoring();
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        const healthResult = await this.performHealthCheck(pipelines);
        this.emit('healthCheckCompleted', healthResult);

        if (!healthResult.healthy) {
          secureLogger.warn('Pipeline health check failed', {
            issues: healthResult.issues,
            totalPipelines: healthResult.pipelines,
            activeExecutions: healthResult.activeExecutions
          });
          this.emit('healthCheckFailed', healthResult);
        }
      } catch (error) {
        secureLogger.error('Health monitoring error:', { error: error.message });
        this.emit('healthMonitoringError', error);
      }
    }, intervalMs);

    secureLogger.info('Pipeline health monitoring started', { intervalMs });
  }

  /**
   * 停止健康监控
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      secureLogger.info('Pipeline health monitoring stopped');
    }
  }

  /**
   * 执行完整的健康检查
   */
  async performHealthCheck(pipelines: Map<string, CompletePipeline>): Promise<PipelineHealthCheckResult> {
    const issues: string[] = [];
    let healthyPipelines = 0;

    for (const [pipelineId, pipeline] of pipelines) {
      try {
        const status = pipeline.getStatus();
        if (status.status === 'running') {
          healthyPipelines++;
        } else {
          issues.push(`Pipeline ${pipelineId} is in ${status.status} status`);
        }

        // 额外的健康检查
        const isHealthy = await pipeline.healthCheck();
        if (!isHealthy) {
          issues.push(`Pipeline ${pipelineId} failed health check`);
        }

      } catch (error) {
        issues.push(`Pipeline ${pipelineId} health check failed: ${error}`);
      }
    }

    const result: PipelineHealthCheckResult = {
      healthy: issues.length === 0,
      pipelines: pipelines.size,
      activeExecutions: 0, // 需要从PipelineManager获取
      issues
    };

    return result;
  }

  /**
   * 获取单个Pipeline的详细健康状态
   */
  async getPipelineHealthDetails(pipeline: CompletePipeline): Promise<{
    pipelineId: string;
    healthy: boolean;
    status: string;
    uptime: number;
    performance: any;
    lastHealthCheck: Date;
    issues: string[];
  }> {
    const issues: string[] = [];
    const healthCheckTime = new Date();

    try {
      const status = pipeline.getStatus();
      const isHealthy = await pipeline.healthCheck();

      if (!isHealthy) {
        issues.push('Pipeline health check returned false');
      }

      if (status.status !== 'running') {
        issues.push(`Pipeline status is ${status.status}`);
      }

      return {
        pipelineId: pipeline.pipelineId,
        healthy: issues.length === 0,
        status: status.status,
        uptime: status.uptime,
        performance: status.performance,
        lastHealthCheck: healthCheckTime,
        issues
      };

    } catch (error) {
      issues.push(`Health check error: ${error.message}`);
      return {
        pipelineId: pipeline.pipelineId,
        healthy: false,
        status: 'error',
        uptime: 0,
        performance: {},
        lastHealthCheck: healthCheckTime,
        issues
      };
    }
  }

  /**
   * 记录性能指标
   */
  recordPerformanceMetrics(pipelineId: string, metrics: PerformanceMetrics): void {
    if (!this.performanceHistory.has(pipelineId)) {
      this.performanceHistory.set(pipelineId, []);
    }

    const history = this.performanceHistory.get(pipelineId)!;
    history.push(metrics);

    // 限制历史记录大小
    if (history.length > this.maxHistorySize) {
      history.shift();
    }

    // 检查性能异常
    this.checkPerformanceAnomalies(pipelineId, metrics);
  }

  /**
   * 获取性能历史
   */
  getPerformanceHistory(pipelineId: string): PerformanceMetrics[] {
    return this.performanceHistory.get(pipelineId) || [];
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(pipelineId: string): {
    averageResponseTime: number;
    totalRequests: number;
    errorRate: number;
    throughput: number;
    memoryUsageAvg: number;
    cpuUsageAvg: number;
  } | null {
    const history = this.performanceHistory.get(pipelineId);
    if (!history || history.length === 0) {
      return null;
    }

    const totalTime = history.reduce((sum, metric) => sum + metric.totalTime, 0);
    const totalErrors = history.reduce((sum, metric) => sum + metric.errorCount, 0);
    const totalMemory = history.reduce((sum, metric) => sum + metric.memoryUsage.average, 0);
    const totalCpu = history.reduce((sum, metric) => sum + metric.cpuUsage.average, 0);

    return {
      averageResponseTime: totalTime / history.length,
      totalRequests: history.length,
      errorRate: totalErrors / history.length,
      throughput: history.reduce((sum, metric) => sum + metric.throughput, 0) / history.length,
      memoryUsageAvg: totalMemory / history.length,
      cpuUsageAvg: totalCpu / history.length
    };
  }

  /**
   * 检查性能异常
   */
  private checkPerformanceAnomalies(pipelineId: string, metrics: PerformanceMetrics): void {
    const thresholds = {
      maxResponseTime: 10000, // 10秒
      maxMemoryUsage: 1024 * 1024 * 500, // 500MB
      maxCpuUsage: 80, // 80%
      maxErrorRate: 0.1 // 10%
    };

    const anomalies: string[] = [];

    if (metrics.totalTime > thresholds.maxResponseTime) {
      anomalies.push(`High response time: ${metrics.totalTime}ms`);
    }

    if (metrics.memoryUsage.peak > thresholds.maxMemoryUsage) {
      anomalies.push(`High memory usage: ${Math.round(metrics.memoryUsage.peak / 1024 / 1024)}MB`);
    }

    if (metrics.cpuUsage.peak > thresholds.maxCpuUsage) {
      anomalies.push(`High CPU usage: ${Math.round(metrics.cpuUsage.peak)}%`);
    }

    if (metrics.errorCount > 0) {
      anomalies.push(`Errors detected: ${metrics.errorCount}`);
    }

    if (anomalies.length > 0) {
      secureLogger.warn('Performance anomalies detected', {
        pipelineId,
        anomalies,
        metrics
      });

      this.emit('performanceAnomaly', {
        pipelineId,
        anomalies,
        metrics,
        timestamp: new Date()
      });
    }
  }

  /**
   * 计算执行记录的性能指标
   */
  calculatePerformanceMetrics(execution: ExecutionRecord): PerformanceMetrics {
    const modulesTiming: Record<string, number> = {};
    let totalTime = execution.totalTime || 0;
    let errorCount = 0;

    for (const moduleExecution of execution.moduleExecutions) {
      if (moduleExecution.processingTime) {
        modulesTiming[moduleExecution.moduleId] = moduleExecution.processingTime;
      }

      if (moduleExecution.status === 'failed') {
        errorCount++;
      }
    }

    return {
      totalTime,
      modulesTiming,
      memoryUsage: {
        peak: process.memoryUsage().heapUsed,
        average: process.memoryUsage().heapUsed
      },
      cpuUsage: {
        peak: process.cpuUsage().system / 1000000, // 转换为毫秒
        average: process.cpuUsage().user / 1000000 // 转换为毫秒
      },
      throughput: totalTime > 0 ? 1000 / totalTime : 0,
      errorCount
    };
  }

  /**
   * 清理性能历史记录
   */
  clearPerformanceHistory(pipelineId?: string): void {
    if (pipelineId) {
      this.performanceHistory.delete(pipelineId);
      secureLogger.info('Performance history cleared for pipeline', { pipelineId });
    } else {
      this.performanceHistory.clear();
      secureLogger.info('All performance history cleared');
    }
  }

  /**
   * 获取健康监控统计
   */
  getMonitoringStats(): {
    isMonitoring: boolean;
    monitoredPipelines: number;
    performanceRecords: number;
    totalAnomalies: number;
  } {
    let totalRecords = 0;
    for (const history of this.performanceHistory.values()) {
      totalRecords += history.length;
    }

    return {
      isMonitoring: !!this.healthCheckInterval,
      monitoredPipelines: this.performanceHistory.size,
      performanceRecords: totalRecords,
      totalAnomalies: this.listenerCount('performanceAnomaly')
    };
  }
}