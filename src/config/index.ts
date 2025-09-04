/**
 * RCC v4.0 Configuration Module Exports
 *
 * 重构后的配置模块 - 零接口暴露设计
 * 只导出ConfigPreprocessor和相关类型
 *
 * @author Claude - Refactored
 */

// 唯一的配置处理接口
export { ConfigPreprocessor } from './config-preprocessor';

// 路由表类型定义
export * from './routing-table-types';

// 模块版本信息
export const CONFIG_MODULE_VERSION = '4.1.0-preprocessor';

// 保留ConfigReader用于向后兼容（临时）
export { ConfigReader } from './config-reader';
