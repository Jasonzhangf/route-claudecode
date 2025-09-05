/**
 * 中间件模块入口文件
 *
 * 严格遵循零接口暴露设计原则
 * 只导出MiddlewareFactory门面和必要类型
 *
 * @version 4.0.0-zero-interface
 * @author Jason Zhang - Zero Interface Refactored
 */

// 主要门面接口 - 零接口暴露设计
export { MiddlewareFactory } from './middleware-factory';

// 只导出必要的类型定义
export type { MiddlewareConfig, MiddlewareOptions } from './middleware-factory';

// 模块版本信息
export const MIDDLEWARE_MODULE_VERSION = '4.0.0-zero-interface';

// 内部模块适配器 - 满足ModuleInterface要求
import { SimpleModuleAdapter, ModuleType } from '../interfaces/module/base-module';
import type { ModuleInterface } from '../interfaces/module/base-module';

// 导出ModuleInterface工厂函数 - 满足架构要求
export function createMiddlewareModuleAdapter(): ModuleInterface {
  return new SimpleModuleAdapter(
    'middleware-module',
    'Middleware Module',
    ModuleType.MIDDLEWARE,
    MIDDLEWARE_MODULE_VERSION
  );
}

// 只导出获取模块信息的函数，而不是实例
export function getMiddlewareModuleInfo() {
  return {
    name: 'middleware-module',
    version: MIDDLEWARE_MODULE_VERSION,
    type: ModuleType.MIDDLEWARE
  };
}
