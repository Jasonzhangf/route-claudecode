/**
 * RCC错误类型定义
 *
 * 为Route Claude Code项目提供统一的错误处理类型
 *
 * @author Jason Zhang
 */

/**
 * RCC基础错误类
 */
export class RCCError extends Error {
  public readonly code: string;
  public readonly module: string;
  public readonly timestamp: number;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    module: string = 'unknown',
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'RCCError';
    this.code = code;
    this.module = module;
    this.timestamp = Date.now();
    this.context = context;

    // 确保错误堆栈正确
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RCCError);
    }
  }

  /**
   * 转换为可序列化的对象
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      module: this.module,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack,
    };
  }

  /**
   * 创建带有上下文的错误
   */
  static withContext(message: string, code: string, module: string, context: Record<string, any>): RCCError {
    return new RCCError(message, code, module, context);
  }
}

/**
 * 配置错误
 */
export class ConfigError extends RCCError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'CONFIG_ERROR', 'config', context);
    this.name = 'ConfigError';
  }
}

/**
 * 网络错误
 */
export class NetworkError extends RCCError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'NETWORK_ERROR', 'network', context);
    this.name = 'NetworkError';
  }
}

/**
 * 验证错误
 */
export class ValidationError extends RCCError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 'validation', context);
    this.name = 'ValidationError';
  }
}

/**
 * 管道错误
 */
export class PipelineError extends RCCError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'PIPELINE_ERROR', 'pipeline', context);
    this.name = 'PipelineError';
  }
}

/**
 * 转换错误
 */
export class TransformError extends RCCError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'TRANSFORM_ERROR', 'transformer', context);
    this.name = 'TransformError';
  }
}

/**
 * 认证错误
 */
export class AuthError extends RCCError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'AUTH_ERROR', 'auth', context);
    this.name = 'AuthError';
  }
}

/**
 * 限流错误
 */
export class RateLimitError extends RCCError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'RATE_LIMIT_ERROR', 'rate-limiter', context);
    this.name = 'RateLimitError';
  }
}

/**
 * 超时错误
 */
export class TimeoutError extends RCCError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'TIMEOUT_ERROR', 'timeout', context);
    this.name = 'TimeoutError';
  }
}

/**
 * 错误码常量
 */
export const ERROR_CODES = {
  // 通用错误
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // 配置错误
  CONFIG_MISSING: 'CONFIG_MISSING',
  CONFIG_INVALID: 'CONFIG_INVALID',
  CONFIG_LOAD_FAILED: 'CONFIG_LOAD_FAILED',

  // 网络错误
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  CONNECTION_REFUSED: 'CONNECTION_REFUSED',

  // 验证错误
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_FORMAT: 'INVALID_FORMAT',
  VALIDATION_FAILED: 'VALIDATION_FAILED',

  // 管道错误
  PIPELINE_INIT_FAILED: 'PIPELINE_INIT_FAILED',
  PIPELINE_EXECUTION_FAILED: 'PIPELINE_EXECUTION_FAILED',
  MODULE_NOT_FOUND: 'MODULE_NOT_FOUND',

  // 转换错误
  TRANSFORM_FAILED: 'TRANSFORM_FAILED',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',

  // 认证错误
  AUTH_FAILED: 'AUTH_FAILED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',

  // 限流错误
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // 超时错误
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',
} as const;

/**
 * 错误码类型
 */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
