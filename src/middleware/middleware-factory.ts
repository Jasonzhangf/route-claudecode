/**
 * 中间件工厂实现
 *
 * 实现中间件接口，创建各种中间件实例
 * 这是具体实现，应该通过接口被其他模块使用
 *
 * @author Jason Zhang
 */

import {
  IMiddlewareFactory,
  IMiddlewareManager,
  CorsOptions,
  LoggerOptions,
  AuthenticationOptions,
  ValidationOptions,
  RateLimitOptions,
} from '../interfaces/core/middleware-interface';

import { IMiddlewareFunction } from '../interfaces/core/server-interface';

// 中间件配置类型
export interface MiddlewareConfig {
  cors?: CorsOptions;
  logger?: LoggerOptions;
  auth?: AuthenticationOptions;
  validation?: ValidationOptions;
  rateLimit?: RateLimitOptions;
}

// 中间件选项类型
export interface MiddlewareOptions {
  enabled: boolean;
  order?: number;
  config?: any;
}

// 导入具体的中间件实现
import { cors } from './cors';
import { logger } from './logger';
import { authentication } from './auth';
import { validation } from './validation';
import { rateLimit } from './rate-limiter';

/**
 * 标准中间件工厂实现
 */
export class StandardMiddlewareFactory implements IMiddlewareFactory {
  /**
   * 创建CORS中间件
   */
  createCors(options?: CorsOptions): IMiddlewareFunction {
    return cors({
      origin: (options?.origin as any) ?? true,
      credentials: options?.credentials ?? true,
      methods: options?.methods ?? ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: options?.allowedHeaders ?? ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: options?.exposedHeaders,
      maxAge: options?.maxAge,
    });
  }

  /**
   * 创建日志中间件
   */
  createLogger(options?: LoggerOptions): IMiddlewareFunction {
    return logger({
      level: options?.level ?? 1,
      format: options?.format ?? 'detailed',
      includeBody: options?.includeBody ?? false,
      includeHeaders: options?.includeHeaders ?? false,
    });
  }

  /**
   * 创建认证中间件
   */
  createAuthentication(options?: AuthenticationOptions): IMiddlewareFunction {
    return authentication({
      required: options?.required ?? false,
      apiKeyHeader: options?.apiKeyHeader ?? 'Authorization',
      bearerHeader: options?.bearerTokenHeader,
    });
  }

  /**
   * 创建验证中间件
   */
  createValidation(options?: ValidationOptions): IMiddlewareFunction {
    return validation({
      maxBodySize: options?.maxBodySize ?? 10 * 1024 * 1024,
      validateContentType: options?.validateContentType ?? true,
      allowedContentTypes: options?.allowedContentTypes,
      // requireContentLength: options?.requireContentLength ?? false
    });
  }

  /**
   * 创建速率限制中间件
   */
  createRateLimit(options?: RateLimitOptions): IMiddlewareFunction {
    return rateLimit({
      maxRequests: options?.maxRequests ?? 1000,
      windowMs: options?.windowMs ?? 60000,
      message: options?.message ?? 'Too many requests from this IP',
      keyGenerator: options?.keyGenerator,
      skipSuccessfulRequests: options?.skipSuccessfulRequests ?? false,
    });
  }

  /**
   * 创建错误处理中间件
   */
  createErrorHandler(options?: any): IMiddlewareFunction {
    // 简单的错误处理中间件实现
    return (req, res, next) => {
      try {
        next();
      } catch (error) {
        console.error('Middleware error:', error);
        res.statusCode = 500;
        res.body = { error: 'Internal Server Error' };
      }
    };
  }

  /**
   * 创建压缩中间件
   */
  createCompression(options?: any): IMiddlewareFunction {
    // TODO: 实现压缩中间件
    return (req, res, next) => next();
  }
}

/**
 * 中间件管理器实现
 */
export class MiddlewareManager implements IMiddlewareManager {
  private factory: IMiddlewareFactory | null = null;

  /**
   * 注册中间件工厂
   */
  setFactory(factory: IMiddlewareFactory): void {
    this.factory = factory;
  }

  /**
   * 获取中间件工厂
   */
  getFactory(): IMiddlewareFactory | null {
    return this.factory;
  }

  /**
   * 创建标准中间件栈
   */
  createStandardMiddlewareStack(options?: {
    cors?: CorsOptions;
    logger?: LoggerOptions;
    authentication?: AuthenticationOptions;
    validation?: ValidationOptions;
    rateLimit?: RateLimitOptions;
  }): IMiddlewareFunction[] {
    if (!this.factory) {
      throw new Error('Middleware factory not registered');
    }

    const middlewares: IMiddlewareFunction[] = [];

    // CORS中间件 (最先执行)
    if (options?.cors !== undefined) {
      middlewares.push(this.factory.createCors(options.cors));
    }

    // 日志中间件
    if (options?.logger !== undefined) {
      middlewares.push(this.factory.createLogger(options.logger));
    }

    // 认证中间件
    if (options?.authentication !== undefined) {
      middlewares.push(this.factory.createAuthentication(options.authentication));
    }

    // 验证中间件
    if (options?.validation !== undefined) {
      middlewares.push(this.factory.createValidation(options.validation));
    }

    // 速率限制中间件 (最后执行)
    if (options?.rateLimit !== undefined) {
      middlewares.push(this.factory.createRateLimit(options.rateLimit));
    }

    return middlewares;
  }

  /**
   * 验证中间件配置
   */
  validateConfiguration(options: any): boolean {
    // TODO: 实现配置验证逻辑
    return true;
  }

  createCors(options: any): any {
    return cors(options);
  }

  createLogger(options: any): any {
    return logger(options);
  }

  createRateLimit(options: any): any {
    return rateLimit(options);
  }

  createAuth(options: any): any {
    return authentication(options);
  }
}

/**
 * 默认中间件管理器实例
 */
export const defaultMiddlewareManager = new MiddlewareManager();

// 设置默认工厂
defaultMiddlewareManager.setFactory(new StandardMiddlewareFactory());

// 导出别名以保持兼容性
export const MiddlewareFactory = StandardMiddlewareFactory;
