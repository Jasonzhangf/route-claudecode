/**
 * RCC v4.0 流水线模块
 *
 * 处理11模块流水线的动态管理和执行
 *
 * @author Jason Zhang
 */
export declare const PIPELINE_MODULE_VERSION = "4.0.0-alpha.1";
export { PipelineManager } from './pipeline-manager';
export { StandardPipeline } from './standard-pipeline';
export { StandardPipelineFactoryImpl } from './pipeline-factory';
export { ModuleRegistry } from './module-registry';
export type { ModuleRegistration, ModuleFactoryFunction } from './module-registry';
export interface PipelineModuleInterface {
    version: string;
}
//# sourceMappingURL=index.d.ts.map