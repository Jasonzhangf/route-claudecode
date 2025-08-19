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
export declare const MIDDLEWARE_MODULE_VERSION = "4.0.0-alpha.2";
export interface MiddlewareModuleInterface {
    version: string;
    createStandardMiddlewareStack(options: any): any[];
}
//# sourceMappingURL=index.d.ts.map