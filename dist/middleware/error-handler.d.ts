/**
 * 错误处理中间件
 *
 * 统一处理应用程序错误
 *
 * @author Jason Zhang
 */
/**
 * 应用程序错误类
 */
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly code: string;
    readonly isOperational: boolean;
    constructor(message: string, statusCode?: number, code?: string, isOperational?: boolean);
}
/**
 * 验证错误类
 */
export declare class ValidationError extends AppError {
    readonly fields: string[];
    constructor(message: string, fields?: string[]);
}
/**
 * 认证错误类
 */
export declare class AuthenticationError extends AppError {
    constructor(message?: string);
}
/**
 * 授权错误类
 */
export declare class AuthorizationError extends AppError {
    constructor(message?: string);
}
/**
 * 资源未找到错误类
 */
export declare class NotFoundError extends AppError {
    constructor(resource?: string);
}
/**
 * 速率限制错误类
 */
export declare class RateLimitError extends AppError {
    readonly retryAfter: number;
    constructor(retryAfter?: number);
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
export declare function errorHandler(options?: ErrorHandlerOptions): any;
/**
 * 静态错误处理器 - 用于非中间件上下文
 */
export declare class ErrorHandler {
    static handle(error: any, context?: any): void;
    handleError(error: any, context?: any): void;
    static createError(message: string, code?: string, statusCode?: number): AppError;
}
/**
 * 异步错误包装器
 */
export declare function asyncHandler(fn: Function): any;
/**
 * 创建404处理中间件
 */
export declare function notFoundHandler(): any;
//# sourceMappingURL=error-handler.d.ts.map