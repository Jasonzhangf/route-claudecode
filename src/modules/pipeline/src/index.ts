/**
 * Pipeline Module Exports
 * 
 * Pipeline组装器模块的统一导出
 * 
 * @author Claude Code Router v4.0
 */

// 核心类导出
export { PipelineAssembler } from './pipeline-assembler';
export { ModuleRegistry } from './module-registry';
export { PipelineManager } from './pipeline-manager';

// 接口和类型导出
export {
  ModuleInterface,
  ModuleType,
  ModuleStatus,
  ModuleMetrics,
  ModuleRegistration,
  ModuleFactory
} from './module-interface';

export {
  AssembledPipeline,
  AssembledModule,
  PipelineAssemblyResult,
  PipelinesByRouteModel,
  AssemblyStats,
  ModuleSelectionStrategy,
  ModuleHealthCheck,
  ModuleConnectionValidation,
  AssemblyEvent
} from './assembly-types';

// 版本信息
export const PIPELINE_ASSEMBLER_VERSION = '4.1.0';

// 导入PipelineAssembler类用于工厂函数
import { PipelineAssembler } from './pipeline-assembler';

/**
 * 创建Pipeline组装器实例
 */
export function createPipelineAssembler(): PipelineAssembler {
  return new PipelineAssembler();
}