/**
 * 流水线执行上下文
 *
 * @author Jason Zhang
 */

export interface ExecutionContext {
  id: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export class PipelineExecutionContext implements ExecutionContext {
  public readonly id: string;
  public readonly timestamp: Date;
  public metadata: Record<string, any> = {};

  constructor(id: string) {
    this.id = id;
    this.timestamp = new Date();
  }
}
