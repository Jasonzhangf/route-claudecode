/**
 * 请求处理器接口定义
 */

export interface RequestProcessorInterface {
  processRequest(pipeline: any, request: any): Promise<any>;
  validateRequest(request: any): boolean;
  handlePipelineExecution(pipelineId: string, request: any): Promise<any>;
}