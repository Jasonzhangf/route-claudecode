/**
 * 中间件接口定义
 * 
 * 定义所有中间件必须实现的标准接口
 * 确保服务器模块可以通过接口使用中间件，而不直接依赖具体实现
 * 
 * @author Jason Zhang
 */

import { IRequestContext, IResponseContext, IMiddlewareFunction } from './server-interface';

/**
 * CORS中间件配置
 */
export interface CorsOptions {
  readonly origin?: boolean | string | string[] | RegExp;
  readonly credentials?: boolean;
  readonly methods?: string[];
  readonly allowedHeaders?: string[];
  readonly exposedHeaders?: string[];
  readonly maxAge?: number;
}

/**
 * 日志中间件配置
 */
export interface LoggerOptions {
  readonly level?: 0 | 1 | 2; // 0=none, 1=basic, 2=detailed
  readonly format?: 'simple' | 'detailed' | 'json';
  readonly includeBody?: boolean;
  readonly includeHeaders?: boolean;
}

/**
 * 认证中间件配置
 */
export interface AuthenticationOptions {
  readonly required?: boolean;
  readonly apiKeyHeader?: string;
  readonly bearerTokenHeader?: string;
  readonly secretKey?: string;
  readonly algorithms?: string[];
}

/**
 * 验证中间件配置
 */
export interface ValidationOptions {
  readonly maxBodySize?: number;
  readonly validateContentType?: boolean;
  readonly allowedContentTypes?: string[];
  readonly requireContentLength?: boolean;
}

/**
 * 速率限制中间件配置
 */
export interface RateLimitOptions {
  readonly maxRequests?: number;
  readonly windowMs?: number;
  readonly message?: string;
  readonly keyGenerator?: (req: IRequestContext) => string;
  readonly skipSuccessfulRequests?: boolean;
}

/**
 * 中间件工厂接口
 * 负责创建各种中间件实例
 */
export interface IMiddlewareFactory {
  /**
   * 创建CORS中间件
   * @param options CORS配置
   * @returns IMiddlewareFunction CORS中间件函数
   */
  createCors(options?: CorsOptions): IMiddlewareFunction;
  
  /**
   * 创建日志中间件
   * @param options 日志配置
   * @returns IMiddlewareFunction 日志中间件函数
   */
  createLogger(options?: LoggerOptions): IMiddlewareFunction;
  
  /**
   * 创建认证中间件
   * @param options 认证配置
   * @returns IMiddlewareFunction 认证中间件函数
   */
  createAuthentication(options?: AuthenticationOptions): IMiddlewareFunction;
  
  /**
   * 创建验证中间件
   * @param options 验证配置
   * @returns IMiddlewareFunction 验证中间件函数
   */
  createValidation(options?: ValidationOptions): IMiddlewareFunction;
  
  /**
   * 创建速率限制中间件
   * @param options 速率限制配置
   * @returns IMiddlewareFunction 速率限制中间件函数
   */
  createRateLimit(options?: RateLimitOptions): IMiddlewareFunction;
  
  /**
   * 创建错误处理中间件
   * @param options 错误处理配置
   * @returns IMiddlewareFunction 错误处理中间件函数
   */
  createErrorHandler(options?: any): IMiddlewareFunction;
  
  /**
   * 创建压缩中间件
   * @param options 压缩配置
   * @returns IMiddlewareFunction 压缩中间件函数
   */
  createCompression(options?: any): IMiddlewareFunction;
}

/**
 * 中间件管理器接口
 * 负责管理中间件的生命周期
 */
export interface IMiddlewareManager {
  /**
   * 注册中间件工厂
   * @param factory 中间件工厂
   */
  setFactory(factory: IMiddlewareFactory): void;
  
  /**
   * 获取中间件工厂
   * @returns IMiddlewareFactory 中间件工厂
   */
  getFactory(): IMiddlewareFactory | null;
  
  /**
   * 创建标准中间件栈
   * @param options 中间件配置选项
   * @returns IMiddlewareFunction[] 中间件函数数组
   */
  createStandardMiddlewareStack(options?: {
    cors?: CorsOptions;
    logger?: LoggerOptions;
    authentication?: AuthenticationOptions;
    validation?: ValidationOptions;
    rateLimit?: RateLimitOptions;
  }): IMiddlewareFunction[];
  
  /**
   * 验证中间件配置
   * @param options 中间件配置
   * @returns boolean 配置是否有效
   */
  validateConfiguration(options: any): boolean;
}

/**
 * 中间件事件接口
 */
export interface MiddlewareEvents {
  'middleware-registered': (name: string, middleware: IMiddlewareFunction) => void;
  'middleware-executed': (name: string, req: IRequestContext, duration: number) => void;
  'middleware-error': (name: string, error: Error, req: IRequestContext) => void;
  'rate-limit-exceeded': (req: IRequestContext, limit: RateLimitOptions) => void;
  'authentication-failed': (req: IRequestContext, reason: string) => void;
  'validation-failed': (req: IRequestContext, errors: any[]) => void;
}