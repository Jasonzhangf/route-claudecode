/**
 * Zero Fallback Error Types and Handlers
 *
 * 符合RCC v4.0零Fallback策略的统一错误类型定义
 * 确保所有错误都立即抛出，不进行任何形式的fallback处理
 *
 * @see .claude/rules/zero-fallback-error-types.md
 * @author Jason Zhang
 * @version 4.0.0-alpha.3
 */

import { secureLogger } from '../../utils/secure-logger';

// 错误类型枚举
export enum ZeroFallbackErrorType {
  PROVIDER_FAILURE = 'PROVIDER_FAILURE',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  MODEL_UNAVAILABLE = 'MODEL_UNAVAILABLE',
  HEALTH_CHECK_FAILED = 'HEALTH_CHECK_FAILED',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  ROUTING_RULE_NOT_FOUND = 'ROUTING_RULE_NOT_FOUND',
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

// 基础错误接口
export interface ZeroFallbackError extends Error {
  readonly type: ZeroFallbackErrorType;
  readonly provider: string;
  readonly model: string;
  readonly timestamp: string;
  readonly requestId: string;
  readonly retryable: boolean; // 零Fallback策略下始终为false
  readonly originalError?: string;
  readonly context?: Record<string, any>;
}

// 生成请求ID的工具函数
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Provider失败错误
export class ProviderFailureError extends Error implements ZeroFallbackError {
  readonly type = ZeroFallbackErrorType.PROVIDER_FAILURE;
  readonly timestamp: string;
  readonly requestId: string;
  readonly retryable = false; // 零Fallback策略下不允许重试

  constructor(
    public readonly provider: string,
    public readonly model: string,
    public readonly originalError?: string,
    public readonly context?: Record<string, any>
  ) {
    super(`Provider ${provider} failed for model ${model}: ${originalError || 'Unknown error'}`);
    this.name = 'ProviderFailureError';
    this.timestamp = new Date().toISOString();
    this.requestId = context?.requestId || generateRequestId();
  }
}

// Provider不可用错误
export class ProviderUnavailableError extends Error implements ZeroFallbackError {
  readonly type = ZeroFallbackErrorType.PROVIDER_UNAVAILABLE;
  readonly timestamp: string;
  readonly requestId: string;
  readonly retryable = false;

  constructor(
    public readonly provider: string,
    public readonly model: string,
    public readonly originalError?: string,
    public readonly context?: Record<string, any>
  ) {
    super(`Provider ${provider} is unavailable (Zero Fallback Policy - no alternatives allowed)`);
    this.name = 'ProviderUnavailableError';
    this.timestamp = new Date().toISOString();
    this.requestId = context?.requestId || generateRequestId();
  }
}

// 健康检查失败错误
export class HealthCheckFailedError extends Error implements ZeroFallbackError {
  readonly type = ZeroFallbackErrorType.HEALTH_CHECK_FAILED;
  readonly timestamp: string;
  readonly requestId: string;
  readonly retryable = false;

  constructor(
    public readonly provider: string,
    public readonly model: string,
    public readonly healthScore: number,
    public readonly context?: Record<string, any>
  ) {
    super(`Provider ${provider} health check failed (score: ${healthScore}, threshold: 80)`);
    this.name = 'HealthCheckFailedError';
    this.timestamp = new Date().toISOString();
    this.requestId = context?.requestId || generateRequestId();
  }
}

// 模型不可用错误
export class ModelUnavailableError extends Error implements ZeroFallbackError {
  readonly type = ZeroFallbackErrorType.MODEL_UNAVAILABLE;
  readonly timestamp: string;
  readonly requestId: string;
  readonly retryable = false;

  constructor(
    public readonly provider: string,
    public readonly model: string,
    public readonly originalError?: string,
    public readonly context?: Record<string, any>
  ) {
    super(`Model ${model} is unavailable on provider ${provider}`);
    this.name = 'ModelUnavailableError';
    this.timestamp = new Date().toISOString();
    this.requestId = context?.requestId || generateRequestId();
  }
}

// 配置错误
export class ConfigurationError extends Error implements ZeroFallbackError {
  readonly type = ZeroFallbackErrorType.CONFIGURATION_ERROR;
  readonly timestamp: string;
  readonly requestId: string;
  readonly retryable = false;

  constructor(
    public readonly provider: string,
    public readonly model: string,
    public readonly originalError?: string,
    public readonly context?: Record<string, any>
  ) {
    super(`Configuration error for provider ${provider}: ${originalError}`);
    this.name = 'ConfigurationError';
    this.timestamp = new Date().toISOString();
    this.requestId = context?.requestId || generateRequestId();
  }
}

// 路由规则未找到错误
export class RoutingRuleNotFoundError extends Error implements ZeroFallbackError {
  readonly type = ZeroFallbackErrorType.ROUTING_RULE_NOT_FOUND;
  readonly timestamp: string;
  readonly requestId: string;
  readonly retryable = false;

  constructor(
    public readonly provider: string,
    public readonly model: string,
    public readonly originalError?: string,
    public readonly context?: Record<string, any>
  ) {
    super(`No routing rule found for model ${model} in category ${provider}: ${originalError || 'No matching rules'}`);
    this.name = 'RoutingRuleNotFoundError';
    this.timestamp = new Date().toISOString();
    this.requestId = context?.requestId || generateRequestId();
  }
}

// 统一错误工厂
export class ZeroFallbackErrorFactory {
  static createProviderFailure(
    provider: string,
    model: string,
    originalError?: string,
    context?: Record<string, any>
  ): ProviderFailureError {
    return new ProviderFailureError(provider, model, originalError, context);
  }

  static createProviderUnavailable(
    provider: string,
    model: string,
    reason?: string,
    context?: Record<string, any>
  ): ProviderUnavailableError {
    return new ProviderUnavailableError(provider, model, reason, context);
  }

  static createHealthCheckFailed(
    provider: string,
    model: string,
    healthScore: number,
    context?: Record<string, any>
  ): HealthCheckFailedError {
    return new HealthCheckFailedError(provider, model, healthScore, context);
  }

  static createModelUnavailable(
    provider: string,
    model: string,
    reason?: string,
    context?: Record<string, any>
  ): ModelUnavailableError {
    return new ModelUnavailableError(provider, model, reason, context);
  }

  static createConfigurationError(
    provider: string,
    model: string,
    configError: string,
    context?: Record<string, any>
  ): ConfigurationError {
    return new ConfigurationError(provider, model, configError, context);
  }

  static createRoutingRuleNotFound(
    model: string,
    category: string,
    reason?: string,
    context?: Record<string, any>
  ): RoutingRuleNotFoundError {
    return new RoutingRuleNotFoundError(category, model, reason, context);
  }
}

// 错误处理器接口
export interface ZeroFallbackErrorHandler {
  handleError(error: ZeroFallbackError): void;
  shouldRetry(error: ZeroFallbackError): boolean; // 在零Fallback策略下始终返回false
  formatErrorResponse(error: ZeroFallbackError): any;
}

// 标准错误处理器实现
export class StandardZeroFallbackErrorHandler implements ZeroFallbackErrorHandler {
  constructor(private logger: typeof secureLogger = secureLogger) {}

  handleError(error: ZeroFallbackError): void {
    // 记录错误但不进行任何fallback处理
    this.logger.error('Zero Fallback Error', {
      type: error.type,
      provider: error.provider,
      model: error.model,
      message: error.message,
      timestamp: error.timestamp,
      requestId: error.requestId,
      zeroFallbackPolicy: true,
    });
  }

  shouldRetry(error: ZeroFallbackError): boolean {
    // 零Fallback策略下禁止重试
    return false;
  }

  formatErrorResponse(error: ZeroFallbackError): any {
    return {
      error: {
        type: error.type,
        message: error.message,
        provider: error.provider,
        model: error.model,
        timestamp: error.timestamp,
        requestId: error.requestId,
        retryable: error.retryable,
        zeroFallbackPolicy: true,
      },
    };
  }
}

// HTTP状态码映射函数
export function getHttpStatusCode(errorType: ZeroFallbackErrorType): number {
  switch (errorType) {
    case ZeroFallbackErrorType.PROVIDER_UNAVAILABLE:
    case ZeroFallbackErrorType.MODEL_UNAVAILABLE:
    case ZeroFallbackErrorType.HEALTH_CHECK_FAILED:
      return 503; // Service Unavailable
    case ZeroFallbackErrorType.AUTHENTICATION_ERROR:
      return 401; // Unauthorized
    case ZeroFallbackErrorType.RATE_LIMIT_ERROR:
      return 429; // Too Many Requests
    case ZeroFallbackErrorType.VALIDATION_ERROR:
    case ZeroFallbackErrorType.CONFIGURATION_ERROR:
    case ZeroFallbackErrorType.ROUTING_RULE_NOT_FOUND:
      return 400; // Bad Request
    case ZeroFallbackErrorType.TIMEOUT_ERROR:
      return 408; // Request Timeout
    case ZeroFallbackErrorType.NETWORK_ERROR:
    case ZeroFallbackErrorType.PROVIDER_FAILURE:
    default:
      return 500; // Internal Server Error
  }
}

// 错误类型检查函数
export function isZeroFallbackError(error: any): error is ZeroFallbackError {
  return (
    error &&
    typeof error === 'object' &&
    'type' in error &&
    'provider' in error &&
    'model' in error &&
    'timestamp' in error &&
    'requestId' in error &&
    'retryable' in error
  );
}

// 错误验证函数
export function validateZeroFallbackError(error: ZeroFallbackError): boolean {
  return (
    Object.values(ZeroFallbackErrorType).includes(error.type) &&
    typeof error.provider === 'string' &&
    typeof error.model === 'string' &&
    typeof error.timestamp === 'string' &&
    typeof error.requestId === 'string' &&
    error.retryable === false // 零Fallback策略下必须为false
  );
}
