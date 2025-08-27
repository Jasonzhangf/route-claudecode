/**
 * Third-Party Service Error Handler
 *
 * 统一的第三方服务错误处理机制
 * 简单逻辑：本地错误都是500+模块+细节，服务器错误原样回报+头一百字错误内容
 *
 * 根据用户澄清要求：
 * "本地错误都是500，加上错误模块和自细节，服务器错误原样回报，加上头一百字错误内容"
 *
 * @author Claude Code v4.0
 * @version 1.0.1
 */

import { ZeroFallbackErrorType, ZeroFallbackError } from '../interfaces/core/zero-fallback-errors';
import { AppError } from './error-handler';
import { secureLogger } from '../utils/secure-logger';

/**
 * 第三方服务错误类型枚举
 */
export enum ThirdPartyServiceErrorType {
  // OpenAI/LM Studio/ModelScope等AI服务错误
  AI_SERVICE_UNAVAILABLE = 'AI_SERVICE_UNAVAILABLE',
  AI_SERVICE_AUTHENTICATION_FAILED = 'AI_SERVICE_AUTHENTICATION_FAILED',
  AI_SERVICE_RATE_LIMITED = 'AI_SERVICE_RATE_LIMITED',
  AI_SERVICE_MODEL_UNAVAILABLE = 'AI_SERVICE_MODEL_UNAVAILABLE',
  AI_SERVICE_TIMEOUT = 'AI_SERVICE_TIMEOUT',
  AI_SERVICE_INTERNAL_ERROR = 'AI_SERVICE_INTERNAL_ERROR',
  AI_SERVICE_BAD_REQUEST = 'AI_SERVICE_BAD_REQUEST',
  AI_SERVICE_QUOTA_EXCEEDED = 'AI_SERVICE_QUOTA_EXCEEDED',
  AI_SERVICE_NETWORK_ERROR = 'AI_SERVICE_NETWORK_ERROR',
  AI_SERVICE_UNKNOWN_ERROR = 'AI_SERVICE_UNKNOWN_ERROR',

  // 其他第三方服务错误
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  DEPENDENCY_SERVICE_ERROR = 'DEPENDENCY_SERVICE_ERROR',
}

/**
 * 第三方服务错误接口
 */
export interface ThirdPartyServiceError extends Error {
  readonly errorType: ThirdPartyServiceErrorType;
  readonly serviceName: string;
  readonly serviceEndpoint?: string;
  readonly originalStatusCode?: number;
  readonly originalErrorCode?: string;
  readonly originalErrorMessage?: string;
  readonly requestId: string;
  readonly timestamp: string;
  readonly retryable: boolean;
  readonly context?: Record<string, any>;
}

/**
 * 第三方服务错误基类
 */
export class BaseThirdPartyServiceError extends Error implements ThirdPartyServiceError {
  public readonly timestamp: string;
  public readonly requestId: string;
  public readonly retryable: boolean = false; // 遵循zero-fallback策略

  constructor(
    public readonly errorType: ThirdPartyServiceErrorType,
    public readonly serviceName: string,
    message: string,
    public readonly serviceEndpoint?: string,
    public readonly originalStatusCode?: number,
    public readonly originalErrorCode?: string,
    public readonly originalErrorMessage?: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'ThirdPartyServiceError';
    this.timestamp = new Date().toISOString();
    this.requestId = context?.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * AI服务特定错误类
 */
export class AIServiceError extends BaseThirdPartyServiceError {
  constructor(
    errorType: ThirdPartyServiceErrorType,
    serviceName: string,
    model: string,
    originalError: any,
    serviceEndpoint?: string,
    context?: Record<string, any>
  ) {
    const detailedMessage = AIServiceError.buildDetailedMessage(errorType, serviceName, model, originalError);

    super(
      errorType,
      serviceName,
      detailedMessage,
      serviceEndpoint,
      originalError?.status || originalError?.statusCode,
      originalError?.code || originalError?.error?.code,
      originalError?.message || originalError?.error?.message,
      { ...context, model }
    );

    this.name = 'AIServiceError';
  }

  private static buildDetailedMessage(
    errorType: ThirdPartyServiceErrorType,
    serviceName: string,
    model: string,
    originalError: any
  ): string {
    const baseMessage = `${serviceName} service error for model ${model}`;
    const originalMessage = originalError?.message || 'Unknown error';
    // 🔧 FIXED: 移除错误消息截断 - 保留完整错误信息
    const fullContent = originalMessage; // 保留完整的错误消息

    switch (errorType) {
      case ThirdPartyServiceErrorType.AI_SERVICE_AUTHENTICATION_FAILED:
        return `${baseMessage}: Authentication failed - API key invalid or expired. Content: ${fullContent}`;

      case ThirdPartyServiceErrorType.AI_SERVICE_RATE_LIMITED:
        return `${baseMessage}: Rate limit exceeded. Retry after: ${originalError?.headers?.['retry-after'] || 'unknown'}. Content: ${fullContent}`;

      case ThirdPartyServiceErrorType.AI_SERVICE_MODEL_UNAVAILABLE:
        return `${baseMessage}: Model not available or not supported. Content: ${fullContent}`;

      case ThirdPartyServiceErrorType.AI_SERVICE_TIMEOUT:
        return `${baseMessage}: Request timeout after ${originalError?.timeout || 'unknown'}ms. Content: ${fullContent}`;

      case ThirdPartyServiceErrorType.AI_SERVICE_INTERNAL_ERROR:
        return `${baseMessage}: Internal server error occurred. Status: ${originalError?.status || 'unknown'}. Content: ${fullContent}`;

      case ThirdPartyServiceErrorType.AI_SERVICE_BAD_REQUEST:
        return `${baseMessage}: Bad request - invalid parameters or format. Status: ${originalError?.status || 'unknown'}. Content: ${fullContent}`;

      case ThirdPartyServiceErrorType.AI_SERVICE_QUOTA_EXCEEDED:
        return `${baseMessage}: API quota exceeded. Content: ${fullContent}`;

      case ThirdPartyServiceErrorType.AI_SERVICE_NETWORK_ERROR:
        return `${baseMessage}: Network connection error. Content: ${fullContent}`;

      case ThirdPartyServiceErrorType.AI_SERVICE_UNAVAILABLE:
        return `${baseMessage}: Service temporarily unavailable. Status: ${originalError?.status || 'unknown'}. Content: ${fullContent}`;

      default:
        return `${baseMessage}: Unknown error occurred. Status: ${originalError?.status || 'unknown'}. Content: ${fullContent}`;
    }
  }
}

/**
 * 统一的第三方服务错误处理器
 */
export class ThirdPartyServiceErrorHandler {
  private static readonly LOCAL_ERROR_STATUS_CODE = 500; // 本地错误统一返回500
  private static readonly ERROR_MESSAGE_MAX_CHARS = 100; // 服务器错误内容截取前100字

  /**
   * 检测并分类OpenAI SDK错误
   */
  static classifyOpenAIError(error: any, serviceName: string = 'OpenAI'): ThirdPartyServiceErrorType {
    const errorName = error?.name || error?.constructor?.name || '';
    const statusCode = error?.status || error?.statusCode || 0;
    const message = error?.message || '';

    // 基于OpenAI SDK错误名称分类
    if (errorName === 'AuthenticationError' || statusCode === 401) {
      return ThirdPartyServiceErrorType.AI_SERVICE_AUTHENTICATION_FAILED;
    }

    if (errorName === 'RateLimitError' || statusCode === 429) {
      return ThirdPartyServiceErrorType.AI_SERVICE_RATE_LIMITED;
    }

    if (errorName === 'BadRequestError' || statusCode === 400) {
      return ThirdPartyServiceErrorType.AI_SERVICE_BAD_REQUEST;
    }

    if (errorName === 'InternalServerError' || statusCode === 500) {
      return ThirdPartyServiceErrorType.AI_SERVICE_INTERNAL_ERROR;
    }

    if (errorName === 'APIConnectionError' || message.includes('connection') || message.includes('network')) {
      return ThirdPartyServiceErrorType.AI_SERVICE_NETWORK_ERROR;
    }

    if (message.includes('timeout') || errorName.includes('Timeout')) {
      return ThirdPartyServiceErrorType.AI_SERVICE_TIMEOUT;
    }

    if (statusCode === 503 || message.includes('unavailable') || message.includes('service')) {
      return ThirdPartyServiceErrorType.AI_SERVICE_UNAVAILABLE;
    }

    if (message.includes('model') && (message.includes('not found') || message.includes('unavailable'))) {
      return ThirdPartyServiceErrorType.AI_SERVICE_MODEL_UNAVAILABLE;
    }

    if (message.includes('quota') || message.includes('limit exceeded')) {
      return ThirdPartyServiceErrorType.AI_SERVICE_QUOTA_EXCEEDED;
    }

    return ThirdPartyServiceErrorType.AI_SERVICE_UNKNOWN_ERROR;
  }

  /**
   * 将原始错误转换为标准化的第三方服务错误
   */
  static standardizeError(
    originalError: any,
    serviceName: string,
    model?: string,
    serviceEndpoint?: string,
    context?: Record<string, any>
  ): AIServiceError {
    const errorType = this.classifyOpenAIError(originalError, serviceName);

    return new AIServiceError(errorType, serviceName, model || 'unknown', originalError, serviceEndpoint, context);
  }

  /**
   * 创建标准的HTTP错误响应
   * 简单逻辑：本地错误500，服务器错误原样回报+截取前100字
   */
  static createHttpErrorResponse(
    error: ThirdPartyServiceError,
    isLocalError: boolean = false
  ): {
    statusCode: number;
    body: any;
    headers?: Record<string, string>;
  } {
    // 记录详细错误信息用于调试
    secureLogger.error('Third-party service error occurred', {
      errorType: error.errorType,
      serviceName: error.serviceName,
      serviceEndpoint: error.serviceEndpoint,
      originalStatusCode: error.originalStatusCode,
      originalErrorCode: error.originalErrorCode,
      originalErrorMessage: error.originalErrorMessage,
      requestId: error.requestId,
      timestamp: error.timestamp,
      message: error.message,
      context: error.context,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-ID': error.requestId,
      'X-Error-Type': error.errorType,
      'X-Service-Name': error.serviceName,
    };

    // 如果是速率限制错误，添加Retry-After头
    if (error.errorType === ThirdPartyServiceErrorType.AI_SERVICE_RATE_LIMITED && error.context?.retryAfter) {
      headers['Retry-After'] = error.context.retryAfter.toString();
    }

    const body = {
      error: {
        code: 'THIRD_PARTY_SERVICE_ERROR',
        type: error.errorType,
        message: error.message,
        service: {
          name: error.serviceName,
          endpoint: error.serviceEndpoint,
        },
        original_error: {
          status_code: error.originalStatusCode,
          error_code: error.originalErrorCode,
          message: error.originalErrorMessage,
        },
        request_id: error.requestId,
        timestamp: error.timestamp,
        retryable: error.retryable,
        details: error.context,
      },
    };

    // 简单逻辑：本地错误500，服务器错误原样回报
    const statusCode = isLocalError
      ? this.LOCAL_ERROR_STATUS_CODE
      : error.originalStatusCode || this.LOCAL_ERROR_STATUS_CODE;

    return {
      statusCode,
      body,
      headers,
    };
  }

  /**
   * 处理并转换错误的便捷方法
   * isLocalError: true=本地错误(500), false=服务器错误(原样回报)
   */
  static handleError(
    originalError: any,
    serviceName: string,
    model?: string,
    serviceEndpoint?: string,
    context?: Record<string, any>,
    isLocalError: boolean = false
  ): {
    standardizedError: AIServiceError;
    httpResponse: ReturnType<typeof ThirdPartyServiceErrorHandler.createHttpErrorResponse>;
  } {
    const standardizedError = this.standardizeError(originalError, serviceName, model, serviceEndpoint, context);

    const httpResponse = this.createHttpErrorResponse(standardizedError, isLocalError);

    return {
      standardizedError,
      httpResponse,
    };
  }

  /**
   * 检查错误是否为第三方服务错误
   */
  static isThirdPartyServiceError(error: any): error is ThirdPartyServiceError {
    return (
      error &&
      typeof error === 'object' &&
      'errorType' in error &&
      'serviceName' in error &&
      Object.values(ThirdPartyServiceErrorType).includes(error.errorType)
    );
  }

  /**
   * 将零Fallback错误转换为第三方服务错误
   */
  static fromZeroFallbackError(zeroFallbackError: ZeroFallbackError): AIServiceError {
    let errorType: ThirdPartyServiceErrorType;

    switch (zeroFallbackError.type) {
      case ZeroFallbackErrorType.PROVIDER_FAILURE:
        errorType = ThirdPartyServiceErrorType.AI_SERVICE_INTERNAL_ERROR;
        break;
      case ZeroFallbackErrorType.PROVIDER_UNAVAILABLE:
        errorType = ThirdPartyServiceErrorType.AI_SERVICE_UNAVAILABLE;
        break;
      case ZeroFallbackErrorType.MODEL_UNAVAILABLE:
        errorType = ThirdPartyServiceErrorType.AI_SERVICE_MODEL_UNAVAILABLE;
        break;
      case ZeroFallbackErrorType.AUTHENTICATION_ERROR:
        errorType = ThirdPartyServiceErrorType.AI_SERVICE_AUTHENTICATION_FAILED;
        break;
      case ZeroFallbackErrorType.RATE_LIMIT_ERROR:
        errorType = ThirdPartyServiceErrorType.AI_SERVICE_RATE_LIMITED;
        break;
      case ZeroFallbackErrorType.TIMEOUT_ERROR:
        errorType = ThirdPartyServiceErrorType.AI_SERVICE_TIMEOUT;
        break;
      case ZeroFallbackErrorType.NETWORK_ERROR:
        errorType = ThirdPartyServiceErrorType.AI_SERVICE_NETWORK_ERROR;
        break;
      default:
        errorType = ThirdPartyServiceErrorType.AI_SERVICE_UNKNOWN_ERROR;
    }

    return new AIServiceError(
      errorType,
      zeroFallbackError.provider,
      zeroFallbackError.model,
      {
        message: zeroFallbackError.originalError || zeroFallbackError.message,
        type: zeroFallbackError.type,
      },
      undefined,
      {
        ...zeroFallbackError.context,
        requestId: zeroFallbackError.requestId,
        originalTimestamp: zeroFallbackError.timestamp,
      }
    );
  }
}

/**
 * 便捷函数：OpenAI服务错误处理
 * isLocalError: true=本地错误(500), false=服务器错误(原样回报)
 */
export function handleOpenAIError(
  error: any,
  model: string,
  serviceEndpoint?: string,
  context?: Record<string, any>,
  isLocalError: boolean = false
): ReturnType<typeof ThirdPartyServiceErrorHandler.handleError> {
  return ThirdPartyServiceErrorHandler.handleError(error, 'OpenAI', model, serviceEndpoint, context, isLocalError);
}

/**
 * 便捷函数：ModelScope服务错误处理
 * isLocalError: true=本地错误(500), false=服务器错误(原样回报)
 */
export function handleModelScopeError(
  error: any,
  model: string,
  serviceEndpoint?: string,
  context?: Record<string, any>,
  isLocalError: boolean = false
): ReturnType<typeof ThirdPartyServiceErrorHandler.handleError> {
  return ThirdPartyServiceErrorHandler.handleError(error, 'ModelScope', model, serviceEndpoint, context, isLocalError);
}

/**
 * 便捷函数：LM Studio服务错误处理
 * isLocalError: true=本地错误(500), false=服务器错误(原样回报)
 */
export function handleLMStudioError(
  error: any,
  model: string,
  serviceEndpoint?: string,
  context?: Record<string, any>,
  isLocalError: boolean = false
): ReturnType<typeof ThirdPartyServiceErrorHandler.handleError> {
  return ThirdPartyServiceErrorHandler.handleError(error, 'LM Studio', model, serviceEndpoint, context, isLocalError);
}
