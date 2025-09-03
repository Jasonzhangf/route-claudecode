/**
 * 统一错误响应格式化器
 * 
 * 负责将各种错误格式化为统一的响应格式
 * 
 * @author RCC v4.0
 */

import { ErrorContext } from '../interfaces/core/error-coordination-center';
import { ErrorType } from '../debug/error-log-manager';
import { RCCError } from '../types/error';

/**
 * 错误响应格式化器配置
 */
export interface ErrorResponseFormatterConfig {
  includeStackTrace?: boolean;
  includeDetailedErrorInfo?: boolean;
  enableClientFriendlyMessages?: boolean;
  defaultHttpStatusCode?: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ErrorResponseFormatterConfig = {
  includeStackTrace: false,
  includeDetailedErrorInfo: true,
  enableClientFriendlyMessages: true,
  defaultHttpStatusCode: 500
};

/**
 * 统一错误响应格式
 */
export interface UnifiedErrorResponse {
  error: {
    message: string;
    code?: string;
    module?: string;
    type?: ErrorType;
    requestId?: string;
    timestamp: string;
    pipelineId?: string;
    layerName?: string;
    provider?: string;
    model?: string;
    httpStatusCode: number;
    clientMessage?: string;
    suggestions?: string[];
    retryInfo?: {
      canRetry: boolean;
      retryAfterSeconds?: number;
    };
    details?: any;
    stack?: string;
  };
}

/**
 * 统一错误响应格式化器
 */
export class ErrorResponseFormatter {
  private config: ErrorResponseFormatterConfig;

  constructor(config?: ErrorResponseFormatterConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 格式化错误响应
   * 
   * @param error 错误对象
   * @param context 错误上下文
   * @param httpStatusCode HTTP状态码
   * @returns 统一格式的错误响应
   */
  formatErrorResponse(error: Error, context: ErrorContext, httpStatusCode?: number): UnifiedErrorResponse {
    const statusCode = httpStatusCode || this.config.defaultHttpStatusCode || 500;
    
    const response: UnifiedErrorResponse = {
      error: {
        message: error.message,
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
        pipelineId: context.pipelineId,
        layerName: context.layerName,
        provider: context.provider,
        model: context.model,
        httpStatusCode: statusCode
      }
    };

    // 添加RCCError特定信息
    if (error instanceof RCCError) {
      response.error.code = error.code;
      response.error.module = error.module;
      response.error.details = error.context;
    }

    // 添加客户端友好的错误信息
    if (this.config.enableClientFriendlyMessages) {
      response.error.clientMessage = this.getClientFriendlyMessage(statusCode);
      response.error.suggestions = this.getErrorSuggestions(statusCode);
      response.error.retryInfo = {
        canRetry: this.isErrorRetryable(statusCode),
        retryAfterSeconds: this.getRetryDelay(statusCode)
      };
    }

    // 添加详细错误信息
    if (this.config.includeDetailedErrorInfo) {
      response.error.details = {
        attemptNumber: context.attemptNumber,
        maxAttempts: context.maxAttempts,
        isLastAttempt: context.isLastAttempt,
        ...context.metadata
      };
    }

    // 添加堆栈跟踪
    if (this.config.includeStackTrace && error.stack) {
      response.error.stack = error.stack;
    }

    return response;
  }

  /**
   * 格式化内部错误响应
   * 
   * @param error 错误对象
   * @param context 错误上下文
   * @returns 统一格式的内部错误响应
   */
  formatInternalErrorResponse(error: Error, context: ErrorContext): UnifiedErrorResponse {
    return this.formatErrorResponse(error, context, 500);
  }

  /**
   * 格式化网络错误响应
   * 
   * @param error 错误对象
   * @param context 错误上下文
   * @returns 统一格式的网络错误响应
   */
  formatNetworkErrorResponse(error: Error, context: ErrorContext): UnifiedErrorResponse {
    return this.formatErrorResponse(error, context, 503);
  }

  /**
   * 格式化超时错误响应
   * 
   * @param error 错误对象
   * @param context 错误上下文
   * @returns 统一格式的超时错误响应
   */
  formatTimeoutErrorResponse(error: Error, context: ErrorContext): UnifiedErrorResponse {
    return this.formatErrorResponse(error, context, 408);
  }

  /**
   * 格式化验证错误响应
   * 
   * @param error 错误对象
   * @param context 错误上下文
   * @returns 统一格式的验证错误响应
   */
  formatValidationErrorResponse(error: Error, context: ErrorContext): UnifiedErrorResponse {
    return this.formatErrorResponse(error, context, 400);
  }

  /**
   * 格式化认证错误响应
   * 
   * @param error 错误对象
   * @param context 错误上下文
   * @returns 统一格式的认证错误响应
   */
  formatAuthErrorResponse(error: Error, context: ErrorContext): UnifiedErrorResponse {
    return this.formatErrorResponse(error, context, 401);
  }

  /**
   * 格式化限流错误响应
   * 
   * @param error 错误对象
   * @param context 错误上下文
   * @returns 统一格式的限流错误响应
   */
  formatRateLimitErrorResponse(error: Error, context: ErrorContext): UnifiedErrorResponse {
    return this.formatErrorResponse(error, context, 429);
  }

  /**
   * 获取客户端友好的错误消息
   */
  private getClientFriendlyMessage(httpStatusCode: number): string {
    switch (httpStatusCode) {
      case 400:
        return 'Invalid request data provided';
      case 401:
        return 'Authentication required';
      case 403:
        return 'Access denied';
      case 404:
        return 'Resource not found';
      case 408:
        return 'Request timeout';
      case 429:
        return 'Too many requests, please try again later';
      case 500:
        return 'Service temporarily unavailable';
      case 502:
        return 'Bad gateway';
      case 503:
        return 'Service unavailable';
      case 504:
        return 'Gateway timeout';
      default:
        return 'An error occurred while processing your request';
    }
  }

  /**
   * 获取错误建议
   */
  private getErrorSuggestions(httpStatusCode: number): string[] {
    switch (httpStatusCode) {
      case 400:
        return [
          'Check your request data format',
          'Verify all required fields are provided',
          'Ensure data types are correct'
        ];
      case 401:
        return [
          'Check your authentication credentials',
          'Verify your API key or token',
          'Ensure your credentials have not expired'
        ];
      case 429:
        return [
          'Wait before making another request',
          'Implement exponential backoff in your client',
          'Consider batching multiple operations together'
        ];
      case 500:
      case 503:
        return [
          'Please try again in a few moments',
          'If the problem persists, contact technical support',
          'Check service status page for any ongoing issues'
        ];
      case 504:
        return [
          'This is a temporary connectivity issue, please retry',
          'Check your network connection',
          'Service may be under maintenance'
        ];
      default:
        return [
          'Please try again in a few moments',
          'If the problem persists, contact technical support'
        ];
    }
  }

  /**
   * 判断错误是否可重试
   */
  private isErrorRetryable(httpStatusCode: number): boolean {
    return [408, 429, 500, 502, 503, 504].includes(httpStatusCode);
  }

  /**
   * 获取重试延迟时间
   */
  private getRetryDelay(httpStatusCode: number): number {
    switch (httpStatusCode) {
      case 429:
        return 60; // 限流错误等待60秒
      case 500:
      case 502:
      case 503:
      case 504:
        return 30; // 服务器错误等待30秒
      case 408:
        return 10; // 超时错误等待10秒
      default:
        return 30;
    }
  }
}