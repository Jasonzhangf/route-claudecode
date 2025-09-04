/**
 * RCC v4.0 模块API网关类型声明
 * 
 * ⚠️ 此文件为编译生成，请勿手动修改
 */

// 导入各模块类型
import * as ConfigModule from './config';
import * as RouterModule from './router';

// 导出统一接口
export const config: typeof ConfigModule;
export const router: typeof RouterModule;

// 模块信息接口
export interface ModuleInfo {
  version: string;
  buildTime: string;
  isolationLevel: string;
  availableModules: string[];
}

export const __moduleInfo: ModuleInfo;
