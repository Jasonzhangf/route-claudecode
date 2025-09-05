/**
 * 流水线模块导出文件
 * 
 * 严格遵循零接口暴露设计原则
 * 只导出PipelineManager门面和必要类型
 * 
 * @version 4.0.0-zero-interface
 * @author RCC v4.0 Architecture Team - Zero Interface Refactored
 */

// 主要门面接口 - 零接口暴露设计
export { PipelineManager } from './pipeline-manager';

// 只导出必要的类型定义
export type { 
  CompletePipelineConfig, 
  PipelineHealthCheckResult 
} from './pipeline-manager-types';

// 模块版本信息
export const PIPELINE_MODULE_VERSION = '4.0.0-zero-interface';

// 内部模块适配器 - 满足ModuleInterface要求
import { SimpleModuleAdapter, ModuleType } from '../interfaces/module/base-module';
import type { ModuleInterface } from '../interfaces/module/base-module';

// 导出ModuleInterface工厂函数 - 满足架构要求
export function createPipelineModuleAdapter(): ModuleInterface {
  return new SimpleModuleAdapter(
    'pipeline-module',
    'Pipeline Module',
    ModuleType.PIPELINE,
    PIPELINE_MODULE_VERSION
  );
}

// 只导出获取模块信息的函数，而不是实例
export function getPipelineModuleInfo() {
  return {
    name: 'pipeline-module',
    version: PIPELINE_MODULE_VERSION,
    type: ModuleType.PIPELINE
  };
}