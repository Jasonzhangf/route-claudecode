/**
 * 流水线模块导出文件
 * 
 * RCC v4.0 架构重构核心组件
 * 遵循零接口暴露设计原则
 * 
 * @author RCC v4.0 Architecture Team
 */

// 核心组件 - 遵循零接口暴露设计
export { UnifiedInitializer } from './unified-initializer';
export { RuntimeScheduler } from './runtime-scheduler';
export { PipelineManager } from './pipeline-manager';
export { PipelineModule } from './pipeline-module';

// 类型定义
export type { UnifiedInitializerConfig, InitializationResult } from './unified-initializer';
export type { RuntimeSchedulerConfig, ScheduleRequest, ScheduleResponse } from './runtime-scheduler';
export type { CompletePipeline, CompletePipelineConfig, PipelineTableData, PipelineTableEntry, DebugPipelineTableData, PipelineHealthCheckResult, PipelineSystemConfig } from './pipeline-manager-types';

// 模块版本信息
export const PIPELINE_MODULE_VERSION = '4.0.0-unified';

// 模块接口
export interface PipelineModuleInterface {
  version: string;
  initialize(config: any): Promise<any>;
  schedule(request: any): Promise<any>;
  getStatus(): any;
  cleanup(): Promise<void>;
}