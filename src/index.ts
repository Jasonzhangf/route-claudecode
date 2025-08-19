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

// CLI模块导出 - 选择存在的导出
// export { CommandExecutor } from './cli';

// 客户端模块导出 - 选择性导出避免冲突
export { ClientModule, createClientModule, createClient, SessionManager, HttpClient } from './client';

// 服务器模块导出
export { HTTPServer, PipelineServer } from './server';

// 路由器模块导出 - 使用新的核心路由器
export { CoreRouter } from './modules/routing';
export { RouterConfig, RoutingRequest, RoutingDecision, RouteInfo } from './interfaces/router/core-router-interfaces';

// DEPRECATED: 旧路由器模块导出已移除
// export * from './router'; // DEPRECATED: Use CoreRouter instead

// 流水线模块导出 - 避免与interfaces中的命名冲突
export { PIPELINE_MODULE_VERSION, PipelineModuleInterface } from './pipeline';
export { PipelineManager } from './pipeline/pipeline-manager';
export { StandardPipeline } from './pipeline/standard-pipeline';
export { StandardPipelineFactoryImpl as PipelineFactoryImpl } from './pipeline/pipeline-factory';
export { ModuleRegistry as PipelineModuleRegistry } from './pipeline/module-registry';

// Debug系统导出
export * from './debug';

// 配置模块导出 - 选择性导出避免冲突
export { ConfigManager, RCCv4Config, ServerCompatibilityProvider, StandardProvider } from './config';

// 工具函数导出 - 选择性导出避免冲突
export { secureLogger, DataValidator } from './utils';

// 中间件模块导出 - 选择性导出避免冲突
export { ErrorHandler } from './middleware';

// 路由模块导出 - 选择性导出避免冲突
export { ROUTES_MODULE_VERSION } from './routes';

// 模块系统导出 - 移除以避免冲突
// export * from './modules';

// 类型定义导出 - 选择性导出避免冲突
export { StandardRequest as RCCRequest, StandardResponse as RCCResponse } from './types';

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
