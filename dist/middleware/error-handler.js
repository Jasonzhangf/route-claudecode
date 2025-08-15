"use strict";
/**
 * 错误处理中间件
 *
 * 统一处理应用程序错误
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.AppError = void 0;
exports.errorHandler = errorHandler;
exports.asyncHandler = asyncHandler;
exports.notFoundHandler = notFoundHandler;
/**
 * 应用程序错误类
 */
class AppError extends Error {
    statusCode;
    code;
    isOperational;
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
/**
 * 验证错误类
 */
class ValidationError extends AppError {
    fields;
    constructor(message, fields = []) {
        super(message, 400, 'VALIDATION_ERROR');
        this.fields = fields;
    }
}
exports.ValidationError = ValidationError;
/**
 * 认证错误类
 */
class AuthenticationError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}
exports.AuthenticationError = AuthenticationError;
/**
 * 授权错误类
 */
class AuthorizationError extends AppError {
    constructor(message = 'Insufficient permissions') {
        super(message, 403, 'AUTHORIZATION_ERROR');
    }
}
exports.AuthorizationError = AuthorizationError;
/**
 * 资源未找到错误类
 */
class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND');
    }
}
exports.NotFoundError = NotFoundError;
/**
 * 速率限制错误类
 */
class RateLimitError extends AppError {
    retryAfter;
    constructor(retryAfter = 60) {
        super('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED');
        this.retryAfter = retryAfter;
    }
}
exports.RateLimitError = RateLimitError;
/**
 * 创建错误处理中间件
 */
function errorHandler(options = {}) {
    const { includeStack = process.env.NODE_ENV === 'development', logErrors = true, customErrorMap = new Map() } = options;
    return (req, res, next) => {
        // 这个中间件应该在错误发生时被调用
        // 在实际使用中，通常会通过try-catch或Promise.catch来调用
        const originalNext = next;
        const errorNext = (error) => {
            if (error) {
                handleError(error, req, res);
            }
            else {
                originalNext();
            }
        };
        // 调用errorNext而不是返回它
        errorNext();
    };
    function handleError(error, req, res) {
        // 记录错误
        if (logErrors) {
            console.error('Error occurred:', {
                requestId: req.id,
                method: req.method,
                url: req.url,
                error: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                }
            });
        }
        // 确定错误响应
        let statusCode = 500;
        let errorCode = 'INTERNAL_ERROR';
        let message = 'Internal Server Error';
        let details = {};
        if (error instanceof AppError) {
            statusCode = error.statusCode;
            errorCode = error.code;
            message = error.message;
            if (error instanceof ValidationError) {
                details.fields = error.fields;
            }
            else if (error instanceof RateLimitError) {
                res.headers['Retry-After'] = error.retryAfter.toString();
            }
        }
        else {
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
        const errorResponse = {
            error: errorCode,
            message,
            requestId: req.id,
            timestamp: new Date().toISOString()
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
 * 异步错误包装器
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
/**
 * 创建404处理中间件
 */
function notFoundHandler() {
    return (req, res, next) => {
        const error = new NotFoundError(`Route ${req.method} ${req.url}`);
        next(error);
    };
}
//# sourceMappingURL=error-handler.js.map