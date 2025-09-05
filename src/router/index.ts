/**
 * RCC v4.0 Router模块导出
 * 
 * 严格遵循零接口暴露设计原则
 * 只导出RouterPreprocessor门面和必要类型
 * 
 * @version 4.1.0-zero-interface
 * @author Claude - Zero Interface Refactored
 */

// 主要门面接口 - 零接口暴露设计
export { RouterPreprocessor } from './router-preprocessor';

// 只导出必要的类型定义
export type {
  PipelineConfig,
  PipelineLayer,
  RouterPreprocessResult
} from './router-preprocessor';

// 模块版本信息
export const ROUTER_MODULE_VERSION = '4.1.0-zero-interface';

// 内部模块适配器 - 满足ModuleInterface要求
import { SimpleModuleAdapter, ModuleType } from '../interfaces/module/base-module';
import type { ModuleInterface } from '../interfaces/module/base-module';

// 导出ModuleInterface工厂函数 - 满足架构要求
export function createRouterModuleAdapter(): ModuleInterface {
  return new SimpleModuleAdapter(
    'router-module',
    'Router Module',
    ModuleType.ROUTER,
    ROUTER_MODULE_VERSION
  );
}

// 只导出获取模块信息的函数，而不是实例
export function getRouterModuleInfo() {
  return {
    name: 'router-module',
    version: ROUTER_MODULE_VERSION,
    type: ModuleType.ROUTER
  };
}
