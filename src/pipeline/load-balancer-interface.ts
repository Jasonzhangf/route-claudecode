/**
 * 负载均衡器接口定义
 */

export interface LoadBalancerInterface {
  selectPipeline(availablePipelines: string[]): string;
  selectPipelineFromCategory(modelCategory: string, excludePipelines?: string[]): string;
  temporarilyBlockPipeline(pipelineId: string, durationMs?: number): void;
  blacklistPipeline(pipelineId: string, reason: string): void;
  unblacklistPipeline(pipelineId: string): void;
  getLoadBalancingStats(): any;
}