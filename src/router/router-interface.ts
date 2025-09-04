/**
 * 路由器接口定义
 */

export interface RouterInterface {
  route(inputModel: string): any;
  mapToModelCategory(inputModel: string, request?: any): string;
  getRoutingTableStatus(): any;
  markPipelineUnhealthy(pipelineId: string, reason: string): void;
  markPipelineHealthy(pipelineId: string): void;
}