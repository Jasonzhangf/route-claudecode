/**
 * 流水线协调器接口定义
 */

export interface PipelineOrchestratorInterface {
  initialize(): Promise<void>;
  start(): Promise<void>;
  processIncomingRequest(request: any): Promise<any>;
  stop(): Promise<void>;
  cleanup(): Promise<void>;
  isSystemInitialized(): boolean;
  isSystemRunning(): boolean;
  getSystemStatus(): any;
}