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

export interface GlobalServiceRegistry {
  register(name: string, service: any): void;
  get(name: string): any;
  unregister(name: string): void;
}
