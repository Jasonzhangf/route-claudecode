/**
 * 流控模块导出
 *
 * @author Jason Zhang
 */

export interface FlowControlConfig {
  maxConcurrentRequests: number;
  queueSize: number;
  timeout: number;
}

export class FlowController {
  constructor(private config: FlowControlConfig) {}

  async control(request: any): Promise<any> {
    // 基础流控实现
    return request;
  }
}
