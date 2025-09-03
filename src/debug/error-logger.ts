/**
 * 错误日志记录器
 * 
 * 负责记录错误信息到日志系统
 * 
 * @author RCC v4.0
 */

import { secureLogger } from '../utils/secure-logger';
import { ErrorContext } from '../interfaces/core/error-coordination-center';
import { ErrorClassification } from '../interfaces/core/error-coordination-center';
import { ErrorType } from '../debug/error-log-manager';

/**
 * 错误日志记录器配置
 */
export interface ErrorLoggerConfig {
  enableAuditLogging: boolean;
  enableErrorChaining: boolean;
  maxErrorChainLength: number;
  enablePerformanceMetrics: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ErrorLoggerConfig = {
  enableAuditLogging: true,
  enableErrorChaining: true,
  maxErrorChainLength: 10,
  enablePerformanceMetrics: true
};

/**
 * 错误日志条目
 */
export interface ErrorLogEntry {
  timestamp: string;
  requestId: string;
  errorType: ErrorType;
  errorMessage: string;
  errorStack?: string;
  pipelineId?: string;
  layerName?: string;
  provider?: string;
  model?: string;
  attemptNumber: number;
  isRetryable: boolean;
  isFatal: boolean;
  httpStatusCode?: number;
  performanceMetrics?: {
    executionTime?: number;
    memoryUsage?: number;
    cpuUsage?: number;
  };
  errorChain?: ErrorLogEntry[];
  metadata?: Record<string, any>;
}

/**
 * 错误日志记录器
 */
export class ErrorLogger {
  private config: ErrorLoggerConfig;
  private errorChainMap: Map<string, ErrorLogEntry[]> = new Map();

  constructor(config?: Partial<ErrorLoggerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 记录错误日志
   * 
   * @param error 错误对象
   * @param context 错误上下文
   * @param classification 错误分类
   */
  async logError(error: Error, context: ErrorContext, classification: ErrorClassification): Promise<void> {
    try {
      // 创建错误日志条目
      const logEntry: ErrorLogEntry = {
        timestamp: new Date().toISOString(),
        requestId: context.requestId,
        errorType: classification.type,
        errorMessage: error.message,
        errorStack: error.stack,
        pipelineId: context.pipelineId,
        layerName: context.layerName,
        provider: context.provider,
        model: context.model,
        attemptNumber: context.attemptNumber,
        isRetryable: classification.isRetryable,
        isFatal: classification.isFatal,
        httpStatusCode: this.getHttpStatusCodeForErrorType(classification.type),
        metadata: context.metadata
      };

      // 添加性能指标
      if (this.config.enablePerformanceMetrics && context.metadata) {
        logEntry.performanceMetrics = {
          executionTime: context.metadata.executionTime,
          memoryUsage: context.metadata.memoryUsage,
          cpuUsage: context.metadata.cpuUsage
        };
      }

      // 处理错误链
      if (this.config.enableErrorChaining) {
        const errorChain = this.getErrorChain(context.requestId);
        errorChain.push(logEntry);
        
        // 限制错误链长度
        if (errorChain.length > this.config.maxErrorChainLength) {
          errorChain.shift();
        }
        
        this.errorChainMap.set(context.requestId, errorChain);
        logEntry.errorChain = errorChain;
      }

      // 记录错误日志
      secureLogger.error('Error occurred during request processing', {
        error: logEntry,
        classification,
        context
      });

      // 记录审计日志
      if (this.config.enableAuditLogging) {
        secureLogger.audit('ERROR_OCCURRED', {
          requestId: context.requestId,
          errorType: classification.type,
          errorMessage: error.message,
          pipelineId: context.pipelineId,
          isRetryable: classification.isRetryable,
          isFatal: classification.isFatal,
          attemptNumber: context.attemptNumber,
          maxAttempts: context.maxAttempts
        });
      }
    } catch (loggingError) {
      // 如果日志记录失败，至少在控制台输出错误信息
      console.error('Failed to log error:', loggingError);
      console.error('Original error:', error);
    }
  }

  /**
   * 记录错误处理结果
   * 
   * @param result 处理结果
   * @param context 错误上下文
   */
  logHandlingResult(result: any, context: ErrorContext): void {
    try {
      secureLogger.info('Error handling completed', {
        requestId: context.requestId,
        actionTaken: result.actionTaken,
        success: result.success,
        pipelineId: context.pipelineId,
        attemptNumber: context.attemptNumber
      });

      if (!result.success) {
        secureLogger.warn('Error handling failed', {
          requestId: context.requestId,
          actionTaken: result.actionTaken,
          error: result.error?.message || 'Unknown error',
          pipelineId: context.pipelineId
        });
      }
    } catch (loggingError) {
      console.error('Failed to log handling result:', loggingError);
    }
  }

  /**
   * 获取错误链
   * 
   * @param requestId 请求ID
   * @returns 错误链
   */
  private getErrorChain(requestId: string): ErrorLogEntry[] {
    return this.errorChainMap.get(requestId) || [];
  }

  /**
   * 清理错误链
   * 
   * @param requestId 请求ID
   */
  clearErrorChain(requestId: string): void {
    this.errorChainMap.delete(requestId);
  }

  /**
 * 获取错误对应的HTTP状态码
 */
  private getHttpStatusCodeForErrorType(errorType: ErrorType): number {
    switch (errorType) {
      case ErrorType.AUTH_ERROR:
        return 401; // Unauthorized
      case ErrorType.VALIDATION_ERROR:
        return 400; // Bad Request
      case ErrorType.RATE_LIMIT_ERROR:
        return 429; // Too Many Requests
      case ErrorType.TIMEOUT_ERROR:
        return 408; // Request Timeout
      case ErrorType.CONNECTION_ERROR:
        return 503; // Service Unavailable
      default:
        return 500; // Internal Server Error
    }
  }

  /**
   * 重置日志记录器状态
   */
  reset(): void {
    this.errorChainMap.clear();
  }
}