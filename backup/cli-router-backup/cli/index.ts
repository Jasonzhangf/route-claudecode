/**
 * CLI模块入口文件
 * 
 * @author Jason Zhang
 */

export * from './rcc-cli';
export * from './command-parser';
export * from './argument-validator';
export * from './config-loader';

// 模块版本信息
export const CLI_MODULE_VERSION = '4.0.0-alpha.2';

// 模块接口
export interface CLIModuleInterface {
  version: string;
  run(args?: string[]): Promise<void>;
}