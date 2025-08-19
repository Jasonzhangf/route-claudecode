/**
 * 中间件模块入口文件
 *
 * @author Jason Zhang
 */

export * from './middleware-factory';
export * from './auth';
export * from './cors';
export * from './logger';
export * from './error-handler';
export * from './rate-limiter';
export * from './validation';
// 其他中间件文件不存在，注释掉
// export * from './security-middleware';
// export * from './compression-middleware';
// export * from './cache-middleware';
// export * from './request-parser-middleware';
// export * from './response-formatter-middleware';
// export * from './monitoring-middleware';
// export * from './tracing-middleware';

// 模块版本信息
export const MIDDLEWARE_MODULE_VERSION = '4.0.0-alpha.2';

// 模块接口
export interface MiddlewareModuleInterface {
  version: string;
  createStandardMiddlewareStack(options: any): any[];
}
