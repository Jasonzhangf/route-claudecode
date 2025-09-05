/**
 * 工具模块入口文件
 *
 * 严格遵循零接口暴露设计原则
 * 只导出必要的工具函数
 *
 * @version 4.0.0-zero-interface
 * @author Jason Zhang - Zero Interface Refactored
 */

// 主要工具函数 - 精简导出
export { secureLogger } from './secure-logger';
export { DataValidator } from './data-validator';

// 只导出必要的类型定义
export type { LogLevel, LogEntry } from './secure-logger';
export type { ValidationResult, ValidationRule } from './data-validator';

// 模块版本信息
export const UTILS_MODULE_VERSION = '4.0.0-zero-interface';

// 内部模块适配器 - 不暴露实现细节
import { SimpleModuleAdapter, ModuleType } from '../interfaces/module/base-module';

// 私有模块适配器工厂函数
function createUtilsModuleAdapter() {
  return new SimpleModuleAdapter(
    'utils-module',
    'Utils Module',
    ModuleType.UTILITY,
    UTILS_MODULE_VERSION
  );
}

// 只导出获取模块信息的函数，而不是实例
export function getUtilsModuleInfo() {
  return {
    name: 'utils-module',
    version: UTILS_MODULE_VERSION,
    type: ModuleType.UTILITY
  };
}
