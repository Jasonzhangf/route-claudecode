/**
 * Constants模块 - 零接口暴露门面
 * 
 * 严格遵循零接口暴露设计原则，只导出最核心的常量集合
 * 
 * @module Constants
 * @version 4.0.0-zero-interface
 * @lastUpdated 2024-12-25
 */

// 主要常量 - 精简导出，避免命名空间污染
export { API_DEFAULTS } from './api-defaults';
export { SERVER_DEFAULTS } from './server-defaults';
export { TIMEOUT_DEFAULTS } from './timeout-defaults';
export { ERROR_MESSAGES } from './error-messages';
export { SUPPORTED_MODELS, VIRTUAL_MODELS } from './model-mappings';
export { ROUTER_DEFAULTS } from './router-defaults';
export { CLI_DEFAULTS } from './cli-defaults';

// 工具函数 - 只导出必要的实用函数
export { getProviderRequestTimeout, getHttpRequestTimeout } from './timeout-defaults';

// 模块版本信息
export const CONSTANTS_MODULE_VERSION = '4.0.0-zero-interface';

// 模块适配器信息（不暴露实现）
export function getConstantsModuleInfo() {
  return {
    name: 'constants-module',
    version: CONSTANTS_MODULE_VERSION,
    description: 'Core Constants with Zero Interface Exposure'
  };
}
