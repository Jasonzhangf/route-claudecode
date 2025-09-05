/**
 * RCC v4.0 CLI模块导出
 * 
 * 零接口暴露设计 - 只导出必要的公共接口
 * 
 * @version 4.0.0-beta.1
 * @author RCC v4.0 Team
 */

// 核心CLI组件
export { RCCCli } from './rcc-cli';

// 模块版本信息
export const CLI_MODULE_VERSION = '4.0.0-beta.1';

// ModuleInterface implementation for architecture compliance
import { SimpleModuleAdapter, ModuleType } from '../interfaces/module/base-module';
export const cliModuleAdapter = new SimpleModuleAdapter(
  'cli-module',
  'CLI Module',
  ModuleType.VALIDATOR,
  CLI_MODULE_VERSION
);