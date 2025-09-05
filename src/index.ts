/**
 * Route Claude Code (RCC) v4.0 - 主入口文件
 *
 * 高性能、模块化的多AI提供商路由转换系统
 *
 * @author Jason Zhang
 * @version 4.0.0-alpha.2
 */

// 核心接口导出 - 选择性导出避免冲突
export { ModuleInterface, StandardRequest, StandardResponse } from './interfaces';

// CLI模块导出 - 简化导出避免运行时错误
// export type { RCCCliInterface } from './cli/rcc-cli';

// 客户端模块导出 - 通过类型导出避免实例化问题
export type { ClientSession, HttpClient } from './client';
export { CLIENT_MODULE_VERSION } from './client';

// 服务器模块导出 - 使用门面模式
export { ServerFactory, HealthChecker } from './server';

// 路由器模块导出 - 使用统一的路由器
export { PipelineRouter } from './router/pipeline-router';
export { SimpleRouter } from './router/simple-router';
// export { routerModuleAdapter } from './router'; // 暂时注释，避免导入错误

// DEPRECATED: 旧路由器模块导出已移除
// export * from './router'; // DEPRECATED: Use CoreRouter instead

// 流水线模块导出 - 避免与interfaces中的命名冲突
export { PipelineManager } from './pipeline/pipeline-manager';
export { StandardPipeline } from './pipeline/standard-pipeline';
export { StandardPipelineFactoryImpl as PipelineFactoryImpl } from './pipeline/pipeline-factory';
export { ModuleRegistry as PipelineModuleRegistry } from './pipeline/module-registry';

// Debug系统导出
export * from './debug';

// 配置模块导出 - 零接口暴露设计
export { ConfigPreprocessor } from './config';
export type { RoutingTable, ConfigPreprocessResult } from './config';
// export { configModuleAdapter } from './config'; // 暂时注释，避免导入错误

// 工具函数导出 - 选择性导出避免冲突
export { secureLogger, DataValidator } from './utils';

// 中间件模块导出 - 选择性导出避免冲突  
export { MiddlewareFactory } from './middleware';

// 路由模块导出 - 选择性导出避免冲突
export { ROUTES_MODULE_VERSION } from './routes';

// 模块系统导出 - 移除以避免冲突
// export * from './modules';

// 类型定义导出 - 选择性导出避免冲突
export { StandardRequest as RCCRequest, StandardResponse as RCCResponse } from './types';

// 模块适配器导出
export { interfacesModuleAdapter } from './interfaces';

// 版本信息
export const VERSION = '4.0.0-alpha.2';
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

// ModuleInterface implementation for main entry point architecture compliance
import { SimpleModuleAdapter, ModuleType } from './interfaces/module/base-module';
export const mainModuleAdapter = new SimpleModuleAdapter(
  'main-module',
  'RCC v4.0 Main Entry Point',
  ModuleType.CLIENT,
  VERSION
);
