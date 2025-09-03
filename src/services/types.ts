/**
 * 服务类型定义
 *
 * @author Jason Zhang
 */

export interface ServerManager {
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): any;
}

export interface CacheManager {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface ErrorCoordinationCenter {
  handleError(error: Error, context: any): Promise<any>;
  classifyError(error: Error, context: any): any;
  determineStrategy(error: Error, classification: any, context: any): any;
  executeStrategy(strategy: any, context: any): Promise<any>;
  formatErrorResponse(error: Error, context: any, httpStatusCode?: number): any;
  logError(error: Error, context: any, classification: any): Promise<void>;
  getErrorStats(): any;
  resetStats(): void;
}

export interface GlobalServiceRegistry {
  register(name: string, service: any): void;
  get(name: string): any;
  unregister(name: string): void;
}
