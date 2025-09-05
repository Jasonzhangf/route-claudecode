/**
 * Route Claude Code (RCC) v4.0 - 主入口文件
 *
 * 高性能、模块化的多AI提供商路由转换系统
 *
 * @author Jason Zhang
 * @version 4.0.0-alpha.2
 */
export { ModuleInterface, StandardRequest, StandardResponse } from './interfaces';
export type { ClientSession, HttpClient } from './client';
export { CLIENT_MODULE_VERSION } from './client';
export { ServerFactory, HealthChecker } from './server';
export { PipelineRouter } from './router/pipeline-router';
export { SimpleRouter } from './router/simple-router';
export { PipelineManager } from './pipeline/pipeline-manager';
export { StandardPipeline } from './pipeline/standard-pipeline';
export { StandardPipelineFactoryImpl as PipelineFactoryImpl } from './pipeline/pipeline-factory';
export { ModuleRegistry as PipelineModuleRegistry } from './pipeline/module-registry';
export * from './debug';
export { ConfigPreprocessor } from './config';
export type { RoutingTable, ConfigPreprocessResult } from './config';
export { secureLogger, DataValidator } from './utils';
export { MiddlewareFactory } from './middleware';
export { ROUTES_MODULE_VERSION } from './routes';
export { StandardRequest as RCCRequest, StandardResponse as RCCResponse } from './types';
export { interfacesModuleAdapter } from './interfaces';
export declare const VERSION = "4.0.0-alpha.2";
export declare const BUILD_DATE: string;
/**
 * RCC主类 - 统一入口点
 */
export declare class RouteClaudeCode {
    private static instance;
    private constructor();
    /**
     * 获取RCC实例
     */
    static getInstance(): RouteClaudeCode;
    /**
     * 获取版本信息
     */
    getVersion(): string;
    /**
     * 获取构建日期
     */
    getBuildDate(): string;
}
import { SimpleModuleAdapter } from './interfaces/module/base-module';
export declare const mainModuleAdapter: SimpleModuleAdapter;
//# sourceMappingURL=index.d.ts.map