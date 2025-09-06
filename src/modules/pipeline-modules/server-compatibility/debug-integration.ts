/**
 * Debug Integration - Server Compatibility 调试集成
 *
 * 提供服务器兼容性模块的综合调试和监控功能
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { DebugRecorder } from './types/compatibility-types';
import {
  DebugEvent,
  CompatibilityMetrics,
  CompatibilityStats,
  ServerCompatibilityConfig,
} from './types/compatibility-types';
import JQJsonHandler from '../../error-handler/src/utils/jq-json-handler';

/**
 * 调试集成管理器
 */
export class DebugIntegrationManager extends EventEmitter {
  private debugRecorder: DebugRecorder;
  private metrics: CompatibilityMetrics;
  private stats: CompatibilityStats;
  private config: ServerCompatibilityConfig;

  constructor(debugRecorder: DebugRecorder, config: ServerCompatibilityConfig) {
    super();
    this.debugRecorder = debugRecorder;
    this.config = config;

    // 初始化指标
    this.metrics = this.initializeMetrics();
    this.stats = this.initializeStats();

    console.log('🔧 Debug集成管理器初始化完成');
  }

  /**
   * 记录服务器兼容性事件
   */
  recordCompatibilityEvent(event: DebugEvent): void {
    // 更新指标
    this.updateMetrics(event);

    // 记录到调试系统
    this.debugRecorder.record('compatibility_event', {
      timestamp: event.timestamp,
      level: event.level,
      category: event.category,
      serverType: event.serverType,
      requestId: event.requestId,
      message: event.message,
      data: this.sanitizeEventData(event.data),
      performance_impact: this.calculatePerformanceImpact(event),
    });

    // 发出事件供其他系统监听
    this.emit('compatibilityEvent', event);

    // 检查是否需要告警
    this.checkAlertConditions(event);
  }

  /**
   * 记录请求适配过程
   */
  recordRequestAdaptation(
    serverType: string,
    requestId: string,
    originalRequest: any,
    adaptedRequest: any,
    processingTimeMs: number
  ): void {
    const adaptationEvent: DebugEvent = {
      timestamp: Date.now(),
      level: 'info',
      category: 'adaptation',
      serverType,
      requestId,
      message: `Request adapted for ${serverType}`,
      data: {
        original_request: originalRequest,
        adapted_request: adaptedRequest,
        processing_time_ms: processingTimeMs,
        adaptations: this.identifyAdaptations(originalRequest, adaptedRequest),
        size_change: {
          original_size: JQJsonHandler.stringifyJson(originalRequest).length,
          adapted_size: JQJsonHandler.stringifyJson(adaptedRequest).length,
        },
      },
    };

    this.recordCompatibilityEvent(adaptationEvent);
  }

  /**
   * 记录响应修复过程
   */
  recordResponseFix(
    serverType: string,
    requestId: string,
    originalResponse: any,
    fixedResponse: any,
    processingTimeMs: number
  ): void {
    const fixEvent: DebugEvent = {
      timestamp: Date.now(),
      level: 'info',
      category: 'fix',
      serverType,
      requestId,
      message: `Response fixed for ${serverType}`,
      data: {
        original_response: originalResponse,
        fixed_response: fixedResponse,
        processing_time_ms: processingTimeMs,
        fixes_applied: this.identifyFixes(originalResponse, fixedResponse),
        quality_improvement: this.assessQualityImprovement(originalResponse, fixedResponse),
      },
    };

    this.recordCompatibilityEvent(fixEvent);
  }

  /**
   * 记录错误标准化过程
   */
  recordErrorNormalization(
    serverType: string,
    requestId: string,
    originalError: any,
    normalizedError: any,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): void {
    const errorEvent: DebugEvent = {
      timestamp: Date.now(),
      level: severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'info',
      category: 'error',
      serverType,
      requestId,
      message: `Error normalized for ${serverType} (severity: ${severity})`,
      data: {
        original_error: this.sanitizeErrorData(originalError),
        normalized_error: normalizedError,
        severity,
        error_classification: this.classifyError(originalError),
        recovery_suggestions: this.generateRecoverySuggestions(originalError, serverType),
      },
    };

    this.recordCompatibilityEvent(errorEvent);
  }

  /**
   * 获取实时指标
   */
  getMetrics(): CompatibilityMetrics {
    return { ...this.metrics };
  }

  /**
   * 获取统计信息
   */
  getStats(): CompatibilityStats {
    return { ...this.stats };
  }

  /**
   * 获取性能报告
   */
  generatePerformanceReport(): {
    overall_health: 'excellent' | 'good' | 'fair' | 'poor';
    bottlenecks: string[];
    recommendations: string[];
    metrics_summary: CompatibilityMetrics;
  } {
    const health = this.assessOverallHealth();
    const bottlenecks = this.identifyBottlenecks();
    const recommendations = this.generateRecommendations();

    return {
      overall_health: health,
      bottlenecks,
      recommendations,
      metrics_summary: this.metrics,
    };
  }

  /**
   * 重置指标
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.stats = this.initializeStats();

    this.debugRecorder.record('metrics_reset', {
      timestamp: Date.now(),
      reset_reason: 'manual_reset',
    });
  }

  // 私有辅助方法

  private initializeMetrics(): CompatibilityMetrics {
    return {
      requestsProcessed: 0,
      adaptationsPerformed: 0,
      fixesApplied: 0,
      errorsNormalized: 0,
      averageProcessingTime: 0,
      successRate: 1.0,
      errorRate: 0,
      serverTypeBreakdown: {},
    };
  }

  private initializeStats(): CompatibilityStats {
    return {
      totalRequests: 0,
      adaptedRequests: 0,
      fixedResponses: 0,
      normalizedErrors: 0,
      adaptationRate: 0,
      fixRate: 0,
      errorNormalizationRate: 0,
      processingTimeStats: {
        min: Infinity,
        max: 0,
        average: 0,
        median: 0,
      },
      serverTypeStats: {},
    };
  }

  private updateMetrics(event: DebugEvent): void {
    this.metrics.requestsProcessed++;

    // 更新服务器类型统计
    if (!this.metrics.serverTypeBreakdown[event.serverType]) {
      this.metrics.serverTypeBreakdown[event.serverType] = {
        requests: 0,
        adaptations: 0,
        fixes: 0,
        averageTime: 0,
      };
    }

    const serverStats = this.metrics.serverTypeBreakdown[event.serverType];
    serverStats.requests++;

    // 更新处理时间
    if (event.data?.processing_time_ms) {
      const newTime = event.data.processing_time_ms;
      const totalTime = this.metrics.averageProcessingTime * (this.metrics.requestsProcessed - 1);
      this.metrics.averageProcessingTime = (totalTime + newTime) / this.metrics.requestsProcessed;

      serverStats.averageTime = (serverStats.averageTime * (serverStats.requests - 1) + newTime) / serverStats.requests;
    }

    // 根据事件类别更新特定指标
    switch (event.category) {
      case 'adaptation':
        this.metrics.adaptationsPerformed++;
        serverStats.adaptations++;
        break;
      case 'fix':
        this.metrics.fixesApplied++;
        serverStats.fixes++;
        break;
      case 'error':
        this.metrics.errorsNormalized++;
        break;
    }

    // 更新成功率和错误率
    this.updateSuccessRates(event);
  }

  private updateSuccessRates(event: DebugEvent): void {
    const isError = event.level === 'error' || event.category === 'error';
    const totalProcessed = this.metrics.requestsProcessed;

    if (isError) {
      this.metrics.errorRate = (this.metrics.errorRate * (totalProcessed - 1) + 1) / totalProcessed;
      this.metrics.successRate = 1 - this.metrics.errorRate;
    } else {
      this.metrics.errorRate = (this.metrics.errorRate * (totalProcessed - 1)) / totalProcessed;
      this.metrics.successRate = 1 - this.metrics.errorRate;
    }
  }

  private sanitizeEventData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // 深度复制并清理敏感数据
    const sanitized = JQJsonHandler.parseJsonString(JQJsonHandler.stringifyJson(data));

    const sensitiveFields = ['api_key', 'token', 'authorization', 'password', 'secret'];

    const cleanObject = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;

      if (Array.isArray(obj)) {
        return obj.map(cleanObject);
      }

      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '***REDACTED***';
        } else if (typeof value === 'object') {
          obj[key] = cleanObject(value);
        }
      }

      return obj;
    };

    return cleanObject(sanitized);
  }

  private sanitizeErrorData(error: any): any {
    return {
      name: error.name,
      message: error.message,
      status: error.status || error.statusCode,
      code: error.code,
      // 不包含stack trace以避免暴露系统信息
    };
  }

  private calculatePerformanceImpact(event: DebugEvent): 'low' | 'medium' | 'high' {
    const processingTime = event.data?.processing_time_ms || 0;

    if (processingTime < 10) return 'low';
    if (processingTime < 50) return 'medium';
    return 'high';
  }

  private checkAlertConditions(event: DebugEvent): void {
    // 检查是否需要发出告警
    const shouldAlert =
      event.level === 'error' ||
      (event.data?.processing_time_ms && event.data.processing_time_ms > 1000) ||
      this.metrics.errorRate > 0.1; // 错误率超过10%

    if (shouldAlert) {
      this.emit('alert', {
        severity: event.level === 'error' ? 'high' : 'medium',
        message: `Server compatibility alert: ${event.message}`,
        serverType: event.serverType,
        metrics: this.metrics,
        event: event,
      });
    }
  }

  private identifyAdaptations(original: any, adapted: any): string[] {
    const adaptations = [];

    // 简化的差异检测
    if (JQJsonHandler.stringifyJson(original) !== JQJsonHandler.stringifyJson(adapted)) {
      adaptations.push('request_modified');
    }

    return adaptations;
  }

  private identifyFixes(original: any, fixed: any): string[] {
    const fixes = [];

    if (!original.id && fixed.id) fixes.push('added_id');
    if (!original.created && fixed.created) fixes.push('added_created');
    if (!original.usage && fixed.usage) fixes.push('added_usage');

    return fixes;
  }

  private assessQualityImprovement(
    original: any,
    fixed: any
  ): {
    completeness_score: number;
    standard_compliance_score: number;
    overall_improvement: number;
  } {
    let completenessScore = 0;
    let complianceScore = 0;

    // 检查完整性改进
    const requiredFields = ['id', 'object', 'created', 'choices', 'usage'];
    requiredFields.forEach(field => {
      if (!original[field] && fixed[field]) {
        completenessScore += 20; // 每个字段20分
      }
    });

    // 检查标准兼容性
    if (fixed.object === 'chat.completion') complianceScore += 50;
    if (Array.isArray(fixed.choices)) complianceScore += 50;

    const overall = (completenessScore + complianceScore) / 200; // 标准化到0-1

    return {
      completeness_score: completenessScore / 100,
      standard_compliance_score: complianceScore / 100,
      overall_improvement: overall,
    };
  }

  private classifyError(error: any): string {
    if (error.status >= 400 && error.status < 500) return 'client_error';
    if (error.status >= 500) return 'server_error';
    if (error.code === 'ECONNREFUSED') return 'connection_error';
    if (error.code === 'ETIMEDOUT') return 'timeout_error';
    return 'unknown_error';
  }

  private generateRecoverySuggestions(error: any, serverType: string): string[] {
    const suggestions = [];

    if (error.status === 401) {
      suggestions.push('Check API key configuration');
    }

    if (error.code === 'ECONNREFUSED') {
      suggestions.push(`Ensure ${serverType} server is running and accessible`);
    }

    if (error.status === 429) {
      suggestions.push('Implement rate limiting and retry logic');
    }

    return suggestions;
  }

  private assessOverallHealth(): 'excellent' | 'good' | 'fair' | 'poor' {
    const { successRate, averageProcessingTime, errorRate } = this.metrics;

    if (successRate > 0.95 && averageProcessingTime < 100 && errorRate < 0.05) {
      return 'excellent';
    }

    if (successRate > 0.9 && averageProcessingTime < 200 && errorRate < 0.1) {
      return 'good';
    }

    if (successRate > 0.8 && averageProcessingTime < 500 && errorRate < 0.2) {
      return 'fair';
    }

    return 'poor';
  }

  private identifyBottlenecks(): string[] {
    const bottlenecks = [];

    if (this.metrics.averageProcessingTime > 200) {
      bottlenecks.push('High average processing time');
    }

    if (this.metrics.errorRate > 0.1) {
      bottlenecks.push('High error rate');
    }

    // 检查特定服务器类型的瓶颈
    Object.entries(this.metrics.serverTypeBreakdown).forEach(([serverType, stats]) => {
      if (stats.averageTime > 300) {
        bottlenecks.push(`Slow processing for ${serverType}`);
      }
    });

    return bottlenecks;
  }

  private generateRecommendations(): string[] {
    const recommendations = [];

    if (this.metrics.averageProcessingTime > 100) {
      recommendations.push('Consider optimizing response parsing logic');
    }

    if (this.metrics.adaptationsPerformed / this.metrics.requestsProcessed > 0.8) {
      recommendations.push('High adaptation rate - review server configurations');
    }

    if (this.metrics.errorRate > 0.05) {
      recommendations.push('Implement better error handling and recovery mechanisms');
    }

    return recommendations;
  }
}

/**
 * 调试工具函数
 */
export class DebugUtils {
  /**
   * 格式化调试输出
   */
  static formatDebugOutput(event: DebugEvent): string {
    const timestamp = new Date(event.timestamp).toISOString();
    const level = event.level.toUpperCase().padEnd(5);
    const category = event.category.padEnd(10);

    return `[${timestamp}] ${level} [${category}] [${event.serverType}] ${event.message}`;
  }

  /**
   * 创建性能分析报告
   */
  static createPerformanceAnalysis(metrics: CompatibilityMetrics): {
    summary: string;
    details: any;
    suggestions: string[];
  } {
    const summary = `Processed ${metrics.requestsProcessed} requests with ${(metrics.successRate * 100).toFixed(1)}% success rate`;

    const details = {
      total_requests: metrics.requestsProcessed,
      success_rate: `${(metrics.successRate * 100).toFixed(2)}%`,
      error_rate: `${(metrics.errorRate * 100).toFixed(2)}%`,
      average_processing_time: `${metrics.averageProcessingTime.toFixed(2)}ms`,
      adaptations_performed: metrics.adaptationsPerformed,
      fixes_applied: metrics.fixesApplied,
      errors_normalized: metrics.errorsNormalized,
    };

    const suggestions = [];
    if (metrics.successRate < 0.9) {
      suggestions.push('Investigate causes of request failures');
    }
    if (metrics.averageProcessingTime > 100) {
      suggestions.push('Optimize processing pipeline for better performance');
    }

    return { summary, details, suggestions };
  }

  /**
   * 验证调试数据完整性
   */
  static validateDebugData(data: any): { valid: boolean; issues: string[] } {
    const issues = [];

    if (!data.timestamp) {
      issues.push('Missing timestamp');
    }

    if (!data.serverType) {
      issues.push('Missing serverType');
    }

    if (!data.category) {
      issues.push('Missing category');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}
