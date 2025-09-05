/**
 * RCC v4.0 Configuration Module Exports
 *
 * 严格遵循零接口暴露设计原则
 * 只导出ConfigPreprocessor门面和必要类型
 *
 * @version 4.1.0-zero-interface
 * @author Claude - Zero Interface Refactored
 */

// 主要门面接口 - 零接口暴露设计
export { ConfigPreprocessor } from './config-preprocessor';

// 只导出必要的类型定义
export type {
  RoutingTable,
  ProviderInfo,
  RouteMapping,
  ServerInfo as ServerConfig,
  ConfigPreprocessResult
} from './routing-table-types';

// 模块版本信息
export const CONFIG_MODULE_VERSION = '4.1.0-zero-interface';

// 内部模块适配器 - 满足ModuleInterface要求
import { SimpleModuleAdapter, ModuleType } from '../interfaces/module/base-module';
import type { ModuleInterface } from '../interfaces/module/base-module';

// 导出ModuleInterface工厂函数 - 满足架构要求
export function createConfigModuleAdapter(): ModuleInterface {
  return new SimpleModuleAdapter(
    'config-module',
    'Configuration Module',
    ModuleType.CONFIG,
    CONFIG_MODULE_VERSION
  );
}

// 只导出获取模块信息的函数，而不是实例
export function getConfigModuleInfo() {
  return {
    name: 'config-module',
    version: CONFIG_MODULE_VERSION,
    type: ModuleType.CONFIG
  };
}
