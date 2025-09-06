/**
 * RCC v4.0 API Module Exports
 *
 * 严格遵循零接口暴露设计原则
 * 只导出API管理函数和必要类型
 *
 * @version 4.1.0-zero-interface
 * @author Claude - Zero Interface Refactored
 */

// 导出模块管理API函数
export {
  createModule,
  startModule,
  stopModule,
  processWithModule,
  getModuleStatus,
  destroyModule
} from './modules/module-management-api';

// 导出必要的类型定义
export type {
  CreateModuleRequest,
  CreateModuleResponse,
  StartModuleRequest,
  StartModuleResponse,
  StopModuleRequest,
  StopModuleResponse,
  ProcessModuleRequest,
  ProcessModuleResponse,
  GetModuleStatusResponse
} from './modules/module-management-api';

export { ModuleType } from './modules/module-management-api';

// 模块版本信息
export const API_MODULE_VERSION = '4.1.0-zero-interface';