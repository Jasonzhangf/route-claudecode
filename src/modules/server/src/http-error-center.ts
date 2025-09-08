/**
 * HTTP错误中心接口
 * 
 * 负责接收错误处理中心无法处理的错误，并生成合适的HTTP响应
 * 
 * - 500错误：本地系统错误
 * - 其他错误码：原样返回给客户端
 * - 详细错误信息：由错误处理中心标记并返回给HTTP服务器
 * 
 * @author RCC v4.0
 */

import { RCCError, RCCErrorCode } from '../../types/src/index';
import { EnhancedErrorHandler } from '../../error-handler/src/enhanced-error-handler';

/**
 * HTTP错误响应接口
 */
export interface HTTPErrorResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: {
    error: {
      message: string;
      type: string;
      code: string;
      details?: any;
      requestId: string;
      timestamp: string;
    };
  };
}

/**
 * 错误处理结果接口
 */
export interface ErrorHandlingResult {
  shouldHandle: boolean;
  statusCode?: number;
  errorType?: string;
  errorCode?: string;
  errorMessage?: string;
  errorDetails?: any;
}

/**
 * HTTP错误中心
 * 
 * 负责错误处理中心无法处理的错误到HTTP响应的转换
 */
export class HTTPErrorCenter {
  private errorHandler: EnhancedErrorHandler;
  private debugMode: boolean;
  private errorStatistics: Map<string, number> = new Map();

  constructor(errorHandler: EnhancedErrorHandler, debugMode: boolean = false) {
    this.errorHandler = errorHandler;
    this.debugMode = debugMode;
    this.initializeStatistics();
  }

  /**
   * 处理来自错误处理中心的未处理错误
   * 
   * @param rccError RCC错误对象
   * @param context 请求上下文
   * @returns HTTP错误响应
   */
  async handleUnprocessedError(
    rccError: RCCError,
    context: {
      requestId: string;
      endpoint: string;
      method: string;
      pipelineId?: string;
      originalError?: any;
    }
  ): Promise<HTTPErrorResponse> {
    // 1. 首先让错误处理中心尝试处理
    const handlingResult = await this.tryHandleWithErrorCenter(rccError, context);

    // 2. 根据处理结果生成HTTP响应
    return this.generateHTTPResponse(handlingResult, context);
  }

  /**
   * 尝试让错误处理中心处理错误
   * 
   * @param rccError RCC错误对象
   * @param context 请求上下文
   * @returns 错误处理结果
   */
  private async tryHandleWithErrorCenter(
    rccError: RCCError,
    context: {
      requestId: string;
      endpoint: string;
      method: string;
      pipelineId?: string;
      originalError?: any;
    }
  ): Promise<ErrorHandlingResult> {
    try {
      // 记录错误到错误处理中心
      await this.errorHandler.handleRCCError(rccError, {
        requestId: context.requestId,
        endpoint: context.endpoint,
        method: context.method,
        pipelineId: context.pipelineId,
        statusCode: this.mapRCCErrorToStatusCode(rccError.code)
      });

      // 分析错误类型，判断是否可以被错误处理中心处理
      const canBeHandledByCenter = this.canErrorBeHandledByCenter(rccError);

      if (canBeHandledByCenter) {
        // 错误处理中心可以处理，返回处理结果
        this.updateStatistics('handled_by_center');
        return {
          shouldHandle: false, // 不需要HTTP错误中心处理
          statusCode: this.mapRCCErrorToStatusCode(rccError.code),
          errorType: this.getErrorType(rccError.code),
          errorCode: rccError.code,
          errorMessage: this.getSafeErrorMessage(rccError),
          errorDetails: rccError.context?.details
        };
      } else {
        // 错误处理中心无法处理，需要HTTP错误中心处理
        this.updateStatistics('handled_by_http');
        return {
          shouldHandle: true, // 需要HTTP错误中心处理
          statusCode: this.determineHTTPStatusCode(rccError),
          errorType: this.getErrorType(rccError.code),
          errorCode: rccError.code,
          errorMessage: this.getSafeErrorMessage(rccError),
          errorDetails: rccError.context?.details
        };
      }
    } catch (error) {
      // 错误处理中心本身失败，使用HTTP错误中心处理
      this.updateStatistics('error_center_failed');
      return {
        shouldHandle: true,
        statusCode: 500, // 本地系统错误
        errorType: 'internal_server_error',
        errorCode: 'error_center_failed',
        errorMessage: 'Error processing center failed',
        errorDetails: {
          originalError: rccError.message,
          centerError: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * 生成HTTP错误响应
   * 
   * @param handlingResult 错误处理结果
   * @param context 请求上下文
   * @returns HTTP错误响应
   */
  private generateHTTPResponse(
    handlingResult: ErrorHandlingResult,
    context: {
      requestId: string;
      endpoint: string;
      method: string;
      pipelineId?: string;
      originalError?: any;
    }
  ): HTTPErrorResponse {
    const statusCode = handlingResult.statusCode || 500;

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': context.requestId,
        'X-Error-Type': handlingResult.errorType || 'unknown_error',
        'X-Error-Code': handlingResult.errorCode || 'unknown_code',
        'Timestamp': new Date().toISOString()
      },
      body: {
        error: {
          message: this.getPublicMessage(statusCode, handlingResult.errorMessage || 'Internal Server Error'),
          type: handlingResult.errorType || 'internal_server_error',
          code: handlingResult.errorCode || 'unknown_error',
          details: this.debugMode ? handlingResult.errorDetails : undefined,
          requestId: context.requestId,
          timestamp: new Date().toISOString()
        }
      }
    };
  }

  /**
   * 判断错误是否可以被错误处理中心处理
   * 
   * @param rccError RCC错误对象
   * @returns 是否可以被处理
   */
  private canErrorBeHandledByCenter(rccError: RCCError): boolean {
    // 错误处理中心主要处理以下类型的错误：
    const centerHandledErrors = [
      RCCErrorCode.PROVIDER_AUTH_FAILED,    // 鉴权错误 - 可自动恢复
      RCCErrorCode.NETWORK_ERROR,          // 网络错误 - 可重试
      RCCErrorCode.TIMEOUT_ERROR,          // 超时错误 - 可重试
      RCCErrorCode.RATE_LIMIT_ERROR,       // 限流错误 - 可等待
      RCCErrorCode.RESOURCE_UNAVAILABLE,   // 资源不可用 - 可等待恢复
      RCCErrorCode.SERVICE_UNAVAILABLE,     // 服务不可用 - 可等待恢复
    ];

    // 检查错误类型是否在处理范围内
    const shouldHandleByCenter = centerHandledErrors.includes(rccError.code);

    // 如果是鉴权相关的模块（如oauth-error-detector），优先由处理中心处理
    const isAuthRelated = rccError.module === 'oauth-error-detector' ||
                         rccError.module === 'auth';

    return shouldHandleByCenter || isAuthRelated;
  }

  /**
   * 确定HTTP状态码
   * 
   * @param rccError RCC错误对象
   * @returns HTTP状态码
   */
  private determineHTTPStatusCode(rccError: RCCError): number {
    // 根据错误类型确定状态码
    switch (rccError.code) {
      case RCCErrorCode.VALIDATION_ERROR:
        return 400; // Bad Request
      case RCCErrorCode.PROVIDER_AUTH_FAILED:
        return 401; // Unauthorized
      case RCCErrorCode.PERMISSION_DENIED:
        return 403; // Forbidden
      case RCCErrorCode.RESOURCE_NOT_FOUND:
        return 404; // Not Found
      case RCCErrorCode.RATE_LIMIT_ERROR:
        return 429; // Too Many Requests
      case RCCErrorCode.SERVICE_UNAVAILABLE:
        return 503; // Service Unavailable
      case RCCErrorCode.NETWORK_ERROR:
      case RCCErrorCode.TIMEOUT_ERROR:
        return 504; // Gateway Timeout
      case RCCErrorCode.PIPELINE_EXECUTION_FAILED:
        return 500; // Internal Server Error - 流水线执行失败是本地错误
      default:
        return 500; // Internal Server Error - 其他错误都视为本地系统错误
    }
  }

  /**
   * 映射RCC错误到HTTP状态码
   * 
   * @param errorCode RCC错误码
   * @returns HTTP状态码
   */
  private mapRCCErrorToStatusCode(errorCode: RCCErrorCode): number {
    return this.determineHTTPStatusCode(new RCCError('', errorCode, 'temp'));
  }

  /**
   * 获取错误类型
   * 
   * @param errorCode RCC错误码
   * @returns 错误类型字符串
   */
  private getErrorType(errorCode: RCCErrorCode): string {
    switch (errorCode) {
      case RCCErrorCode.VALIDATION_ERROR:
        return 'validation_error';
      case RCCErrorCode.PROVIDER_AUTH_FAILED:
        return 'authentication_error';
      case RCCErrorCode.PERMISSION_DENIED:
        return 'permission_error';
      case RCCErrorCode.RESOURCE_NOT_FOUND:
        return 'not_found_error';
      case RCCErrorCode.RATE_LIMIT_ERROR:
        return 'rate_limit_error';
      case RCCErrorCode.SERVICE_UNAVAILABLE:
        return 'service_unavailable';
      case RCCErrorCode.NETWORK_ERROR:
        return 'network_error';
      case RCCErrorCode.TIMEOUT_ERROR:
        return 'timeout_error';
      case RCCErrorCode.PIPELINE_EXECUTION_FAILED:
        return 'pipeline_error';
      default:
        return 'internal_server_error';
    }
  }

  /**
   * 获取安全的错误消息（不暴露敏感信息）
   * 
   * @param rccError RCC错误对象
   * @returns 安全的错误消息
   */
  private getSafeErrorMessage(rccError: RCCError): string {
    // 在调试模式下返回完整错误信息
    if (this.debugMode) {
      return rccError.message;
    }

    // 生产模式下返回通用错误消息
    switch (rccError.code) {
      case RCCErrorCode.VALIDATION_ERROR:
        return 'Request validation failed';
      case RCCErrorCode.PROVIDER_AUTH_FAILED:
        return 'Authentication failed';
      case RCCErrorCode.PERMISSION_DENIED:
        return 'Permission denied';
      case RCCErrorCode.RESOURCE_NOT_FOUND:
        return 'Resource not found';
      case RCCErrorCode.RATE_LIMIT_ERROR:
        return 'Rate limit exceeded';
      case RCCErrorCode.SERVICE_UNAVAILABLE:
        return 'Service temporarily unavailable';
      case RCCErrorCode.NETWORK_ERROR:
        return 'Network connectivity issue';
      case RCCErrorCode.TIMEOUT_ERROR:
        return 'Request timed out';
      default:
        return 'An unexpected error occurred';
    }
  }

  /**
   * 获取公开的错误消息
   * 
   * @param statusCode HTTP状态码
   * @param errorMessage 内部错误消息
   * @returns 公开的错误消息
   */
  private getPublicMessage(statusCode: number, errorMessage: string): string {
    // 在调试模式下返回完整消息
    if (this.debugMode) {
      return errorMessage;
    }

    // 根据状态码返回安全的公开消息
    switch (statusCode) {
      case 400:
        return 'Bad Request - The request could not be processed due to invalid syntax or content.';
      case 401:
        return 'Unauthorized - Authentication is required or has failed.';
      case 403:
        return 'Forbidden - You do not have permission to access this resource.';
      case 404:
        return 'Not Found - The requested resource could not be found.';
      case 429:
        return 'Too Many Requests - You have exceeded the rate limit.';
      case 500:
        return 'Internal Server Error - An unexpected error occurred while processing the request.';
      case 503:
        return 'Service Unavailable - The service is temporarily unavailable.';
      case 504:
        return 'Gateway Timeout - The server did not receive a timely response.';
      default:
        return 'An error occurred while processing the request.';
    }
  }

  /**
   * 初始化统计信息
   */
  private initializeStatistics(): void {
    this.errorStatistics.set('handled_by_center', 0);
    this.errorStatistics.set('handled_by_http', 0);
    this.errorStatistics.set('error_center_failed', 0);
  }

  /**
   * 更新统计信息
   * 
   * @param type 统计类型
   */
  private updateStatistics(type: string): void {
    const current = this.errorStatistics.get(type) || 0;
    this.errorStatistics.set(type, current + 1);
  }

  /**
   * 设置调试模式
   * 
   * @param debugMode 是否启用调试模式
   */
  setDebugMode(debugMode: boolean): void {
    this.debugMode = debugMode;
  }

  /**
   * 获取当前调试模式状态
   * 
   * @returns 调试模式状态
   */
  getDebugMode(): boolean {
    return this.debugMode;
  }

  /**
   * 获取错误处理统计信息
   * 
   * @returns 统计信息
   */
  getStatistics(): {
    handledByCenter: number;
    handledByHTTP: number;
    errorCenterFailed: number;
    totalErrors: number;
  } {
    const handledByCenter = this.errorStatistics.get('handled_by_center') || 0;
    const handledByHTTP = this.errorStatistics.get('handled_by_http') || 0;
    const errorCenterFailed = this.errorStatistics.get('error_center_failed') || 0;

    return {
      handledByCenter,
      handledByHTTP,
      errorCenterFailed,
      totalErrors: handledByCenter + handledByHTTP + errorCenterFailed
    };
  }

  /**
   * 重置统计信息
   */
  resetStatistics(): void {
    this.initializeStatistics();
  }
}