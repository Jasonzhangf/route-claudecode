/**
 * 生命周期管理器接口定义
 */

export interface LifecycleManagerInterface {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  cleanup(): Promise<void>;
  isInitialized(): boolean;
  isRunning(): boolean;
}