/**
 * 模块适配器 - 解决接口不匹配问题
 *
 * @author Jason Zhang
 */

import { ModuleInterface, ModuleStatus, ModuleMetrics } from '../../interfaces/module/base-module';

/**
 * 基础模块适配器
 */
export abstract class BaseModuleAdapter implements ModuleInterface {
  protected abstract readonly id: string;
  protected abstract readonly name: string;
  protected abstract readonly type: any;
  protected abstract readonly version: string;
  protected status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error' = 'stopped';
  protected health: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  getId(): string {
    return this.id;
  }
  getName(): string {
    return this.name;
  }
  getType(): any {
    return this.type;
  }
  getVersion(): string {
    return this.version;
  }

  getStatus(): ModuleStatus {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      status: this.status,
      health: this.health,
    };
  }

  getMetrics(): ModuleMetrics {
    return {
      requestsProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
    };
  }

  async configure(config: any): Promise<void> {}
  async start(): Promise<void> {
    this.status = 'running';
  }
  async stop(): Promise<void> {
    this.status = 'stopped';
  }
  async reset(): Promise<void> {}
  async cleanup(): Promise<void> {}
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return { healthy: true, details: {} };
  }
  async process(input: any): Promise<any> {
    return input;
  }

  on(event: string, listener: (...args: any[]) => void): void {}
  removeAllListeners(): void {}
}
