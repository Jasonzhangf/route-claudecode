/**
 * 工具模块入口文件
 *
 * @author Jason Zhang
 */

export * from './secure-logger';
export * from './config-encryption';
export * from './data-validator';

// 模块版本信息
export const UTILS_MODULE_VERSION = '4.0.0-alpha.2';

// 模块接口
export interface UtilsModuleInterface {
  version: string;
}
