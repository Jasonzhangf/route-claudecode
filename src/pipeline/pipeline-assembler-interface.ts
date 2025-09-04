/**
 * 流水线组装器接口定义
 */

export interface PipelineAssemblerInterface {
  assembleAllPipelines(pipelineDefinitions: any[]): Promise<void>;
  getPipelinesByModelCategory(modelCategory: string): any[];
  getAllPipelines(): Map<string, any>;
  getPipelineById(pipelineId: string): any | null;
  destroyPipeline(pipelineId: string): Promise<boolean>;
  isSystemInitialized(): boolean;
}