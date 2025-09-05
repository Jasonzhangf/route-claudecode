/**
 * 流水线模块导出文件
 *
 * 严格遵循零接口暴露设计原则
 * 只导出PipelineManager门面和必要类型
 *
 * @version 4.0.0-zero-interface
 * @author RCC v4.0 Architecture Team - Zero Interface Refactored
 */
export { PipelineManager } from './pipeline-manager';
export type { CompletePipelineConfig, PipelineHealthCheckResult } from './pipeline-manager-types';
export declare const PIPELINE_MODULE_VERSION = "4.0.0-zero-interface";
import { ModuleType } from '../interfaces/module/base-module';
export declare function getPipelineModuleInfo(): {
    name: string;
    version: string;
    type: ModuleType;
};
//# sourceMappingURL=index.d.ts.map