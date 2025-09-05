/**
 * 服务器模块入口文件
 *
 * 严格遵循零接口暴露设计原则
 * 只导出ServerFactory门面和必要类型
 *
 * @version 4.0.0-zero-interface
 * @author Jason Zhang - Zero Interface Refactored
 */

// 主要门面接口 - 零接口暴露设计
export { ServerFactory } from './server-factory';
export { HealthChecker } from './health-checker';

// 只导出必要的类型定义
export type { ServerConfig } from './http-server';
export type { HealthCheckResult } from './health-checker';

// 模块版本信息
export const SERVER_MODULE_VERSION = '4.0.0-zero-interface';

// 内部模块适配器 - 满足ModuleInterface要求
import { SimpleModuleAdapter, ModuleType } from '../interfaces/module/base-module';
import type { ModuleInterface } from '../interfaces/module/base-module';

// 导出ModuleInterface工厂函数 - 满足架构要求
export function createServerModuleAdapter(): ModuleInterface {
  return new SimpleModuleAdapter(
    'server-module',
    'Server Module',
    ModuleType.SERVER,
    SERVER_MODULE_VERSION
  );
}

// 只导出获取模块信息的函数，而不是实例
export function getServerModuleInfo() {
  return {
    name: 'server-module',
    version: SERVER_MODULE_VERSION,
    type: ModuleType.SERVER
  };
}
