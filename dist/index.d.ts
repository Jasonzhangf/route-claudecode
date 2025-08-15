/**
 * Route Claude Code (RCC) v4.0 - 主入口文件
 *
 * 高性能、模块化的多AI提供商路由转换系统
 *
 * @author Jason Zhang
 * @version 4.0.0-alpha.1
 */
export * from './interfaces';
export { RCCCli, CommandParser, ArgumentValidator, ConfigLoader } from './cli';
export * from './client';
export * from './router';
export { PIPELINE_MODULE_VERSION, PipelineModuleInterface } from './pipeline';
export { PipelineManager } from './pipeline/pipeline-manager';
export { StandardPipeline } from './pipeline/standard-pipeline';
export { StandardPipelineFactoryImpl as PipelineFactoryImpl } from './pipeline/pipeline-factory';
export { ModuleRegistry as PipelineModuleRegistry } from './pipeline/module-registry';
export * from './debug';
export * from './utils';
export declare const VERSION = "4.0.0-alpha.1";
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
//# sourceMappingURL=index.d.ts.map