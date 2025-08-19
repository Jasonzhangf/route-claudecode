/**
 * 错误处理中间件
 *
 * 统一处理应用程序错误
 *
 * @author Jason Zhang
 */

import { IMiddlewareFactory } from '../interfaces/core/middleware-interface';

/**
 * 应用程序错误类
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 验证错误类
 */
export class ValidationError extends AppError {
  public readonly fields: string[];

  constructor(message: string, fields: string[] = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.fields = fields;
  }
}

/**
 * 认证错误类
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

/**
 * 授权错误类
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

/**
 * 资源未找到错误类
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

/**
 * 速率限制错误类
 */
export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter: number = 60) {
    super('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED');
    this.retryAfter = retryAfter;
  }
}

/**
 * 错误处理选项
 */
export interface ErrorHandlerOptions {
  includeStack?: boolean;
  logErrors?: boolean;
  customErrorMap?: Map<string, (error: Error) => any>;
}

/**
 * 创建错误处理中间件
 */
export function errorHandler(options: ErrorHandlerOptions = {}): any {
  const {
    includeStack = process.env.NODE_ENV === 'development',
    logErrors = true,
    customErrorMap = new Map(),
  } = options;

  return (req, res, next) => {
    // 这个中间件应该在错误发生时被调用
    // 在实际使用中，通常会通过try-catch或Promise.catch来调用
    const originalNext = next;

    const errorNext = (error?: Error): void => {
      if (error) {
        handleError(error, req, res);
      } else {
        originalNext();
      }
    };

    // 调用errorNext而不是返回它
    errorNext();
  };

  function handleError(error: Error, req: any, res: any): void {
    // 记录错误
    if (logErrors) {
      console.error('Error occurred:', {
        requestId: req.id,
        method: req.method,
        url: req.url,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      });
    }

    // 确定错误响应
    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';
    let message = 'Internal Server Error';
    let details: any = {};

    if (error instanceof AppError) {
      statusCode = error.statusCode;
      errorCode = error.code;
      message = error.message;

      if (error instanceof ValidationError) {
        details.fields = error.fields;
      } else if (error instanceof RateLimitError) {
        res.headers['Retry-After'] = error.retryAfter.toString();
      }
    } else {
      // 检查自定义错误映射
      for (const [errorType, mapper] of customErrorMap.entries()) {
        if (error.name === errorType || error.constructor.name === errorType) {
          const mapped = mapper(error);
          statusCode = mapped.statusCode || statusCode;
          errorCode = mapped.code || errorCode;
          message = mapped.message || message;
          details = mapped.details || details;
          break;
        }
      }
    }

    // 构建错误响应
    const errorResponse: any = {
      error: errorCode,
      message,
      requestId: req.id,
      timestamp: new Date().toISOString(),
    };

    // 添加详细信息
    if (Object.keys(details).length > 0) {
      errorResponse.details = details;
    }

    // 在开发环境中包含堆栈跟踪
    if (includeStack && error.stack) {
      errorResponse.stack = error.stack.split('\\n');
    }

    // 发送错误响应
    res.statusCode = statusCode;
    res.headers['Content-Type'] = 'application/json';
    res.body = errorResponse;
  }
}

/**
 * 静态错误处理器 - 用于非中间件上下文
 */
export class ErrorHandler {
  static handle(error: any, context?: any): void {
    // 记录错误
    console.error('ErrorHandler: Error occurred:', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
    });

    // 在实际应用中，这里可以发送到日志服务、监控系统等
  }

  // 实例方法
  handleError(error: any, context?: any): void {
    ErrorHandler.handle(error, context);
  }

  static createError(message: string, code?: string, statusCode?: number): AppError {
    return new AppError(message, statusCode, code);
  }
}

/**
 * 异步错误包装器
 */
export function asyncHandler(fn: Function): any {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 创建404处理中间件
 */
export function notFoundHandler(): any {
  return (req: any, res: any, next: any) => {
    const error = new NotFoundError(`Route ${req.method} ${req.url}`);
    next(error);
  };
}
