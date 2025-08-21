/**
 * CLI模块入口文件
 *
 * @author Jason Zhang
 */

export * from './rcc-cli';
export * from './command-parser';
export * from './argument-validator';
// export * from './config-loader';  // Removed - using ConfigReader instead

// 模块版本信息
export const CLI_MODULE_VERSION = '4.0.0-alpha.2';

// 模块接口
export interface CLModuleInterface {
  version: string;
  run(args?: string[]): Promise<void>;
}
