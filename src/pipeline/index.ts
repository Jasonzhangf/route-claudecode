/**
 * RCC v4.0 流水线模块
 * 
 * 处理11模块流水线的动态管理和执行
 * 
 * @author Jason Zhang
 */

// 版本信息
export const PIPELINE_MODULE_VERSION = '4.0.0-alpha.1';

// 核心Pipeline组件
export { PipelineManager } from './pipeline-manager';
export { StandardPipeline } from './standard-pipeline';
export { StandardPipelineFactoryImpl } from './pipeline-factory';
export { ModuleRegistry } from './module-registry';

// 类型导出
export type { ModuleRegistration, ModuleFactoryFunction } from './module-registry';

// 接口导出
export interface PipelineModuleInterface {
  version: string;
}