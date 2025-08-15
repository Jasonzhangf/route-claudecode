/**
 * Route Claude Code (RCC) v4.0 - 主入口文件
 * 
 * 高性能、模块化的多AI提供商路由转换系统
 * 
 * @author Jason Zhang
 * @version 4.0.0-alpha.1
 */

// 核心接口导出
export * from './interfaces';

// CLI模块导出
export { RCCCli, CommandParser, ArgumentValidator, ConfigLoader } from './cli';

// 客户端模块导出
export * from './client';

// 路由器模块导出
export * from './router';

// 流水线模块导出 - 避免与interfaces中的命名冲突
export { 
  PIPELINE_MODULE_VERSION,
  PipelineModuleInterface
} from './pipeline';
export { PipelineManager } from './pipeline/pipeline-manager';
export { StandardPipeline } from './pipeline/standard-pipeline';
export { StandardPipelineFactoryImpl as PipelineFactoryImpl } from './pipeline/pipeline-factory';
export { ModuleRegistry as PipelineModuleRegistry } from './pipeline/module-registry';

// Debug系统导出
export * from './debug';

// 工具函数导出
export * from './utils';

// 版本信息
export const VERSION = '4.0.0-alpha.1';
export const BUILD_DATE = new Date().toISOString();

/**
 * RCC主类 - 统一入口点
 */
export class RouteClaudeCode {
  private static instance: RouteClaudeCode;
  
  private constructor() {
    // 私有构造函数，单例模式
  }
  
  /**
   * 获取RCC实例
   */
  public static getInstance(): RouteClaudeCode {
    if (!RouteClaudeCode.instance) {
      RouteClaudeCode.instance = new RouteClaudeCode();
    }
    return RouteClaudeCode.instance;
  }
  
  /**
   * 获取版本信息
   */
  public getVersion(): string {
    return VERSION;
  }
  
  /**
   * 获取构建日期
   */
  public getBuildDate(): string {
    return BUILD_DATE;
  }
}