/**
 * RCC v4.0 Configuration Module Exports
 *
 * 统一导出所有配置相关的模块和类型
 *
 * @author Jason Zhang
 */

// 核心模块 (推荐使用)
export { ConfigManager, getConfigManager, setConfigManager, cleanupGlobalConfigManager } from './config-manager';
export { ConfigLoader } from './config-loader';
export { ConfigParser } from './config-parser';
export { ConfigValidator } from './config-validator';
export { ConfigTransformer } from './config-transformer';

// 类型定义
export * from './config-types';

// 向后兼容模块 (已弃用)
export { RCCv4ConfigLoader } from './v4-config-loader';
export * from './user-config-loader';

// 默认导出配置管理器
export { getConfigManager as default } from './config-manager';

// 模块版本信息
export const CONFIG_MODULE_VERSION = '4.0.0-refactored';

// 新的模块接口
export interface ConfigModuleInterface {
  version: string;
  loadConfig(): Promise<any>;
  validateConfig(config: any): boolean;
}

// 旧接口兼容 (已弃用)
/**
 * @deprecated 请使用 ConfigModuleInterface 替代
 */
export interface LegacyConfigInterface extends ConfigModuleInterface {
  reloadConfig?(): Promise<any>;
  clearCache?(): void;
}
