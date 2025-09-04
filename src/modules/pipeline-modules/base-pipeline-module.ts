/**
 * Base Pipeline Module
 *
 * 流水线模块的基础实现，简化具体模块的开发
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { ModuleInterface, ModuleStatus, ModuleMetrics, ModuleType } from '../../interfaces/module/base-module';

/**
 * 基础流水线模块抽象类
 */
export abstract class BasePipelineModule extends EventEmitter implements ModuleInterface {
  protected readonly moduleId: string;
  protected readonly moduleName: string;
  protected readonly moduleType: ModuleType;
  protected readonly moduleVersion: string;
  protected status: ModuleStatus['status'] = 'stopped';
  protected health: ModuleStatus['health'] = 'healthy';
  protected metrics: ModuleMetrics = {
    requestsProcessed: 0,
    averageProcessingTime: 0,
    errorRate: 0,
    memoryUsage: 0,
    cpuUsage: 0,
  };
  protected lastActivity?: Date;
  protected error?: Error;
  protected connections: Map<string, ModuleInterface> = new Map();

  constructor(id: string, name: string, type: ModuleType, version: string = '1.0.0') {
    super();
    this.moduleId = id;
    this.moduleName = name;
    this.moduleType = type;
    this.moduleVersion = version;
  }

  // ModuleInterface实现

  getId(): string {
    return this.moduleId;
  }

  getName(): string {
    return this.moduleName;
  }

  getType(): ModuleType {
    return this.moduleType;
  }

  getVersion(): string {
    return this.moduleVersion;
  }

  getStatus(): ModuleStatus {
    return {
      id: this.moduleId,
      name: this.moduleName,
      type: this.moduleType,
      status: this.status,
      health: this.health,
      lastActivity: this.lastActivity,
      error: this.error,
    };
  }

  getMetrics(): ModuleMetrics {
    return { ...this.metrics };
  }

  async configure(config: any): Promise<void> {
    // 基础配置实现，子类可以覆盖
    console.log(`🔧 配置模块 ${this.moduleName}:`, config);
  }

  async start(): Promise<void> {
    if (this.status === 'running') {
      return;
    }

    this.status = 'starting';
    this.emit('statusChanged', { status: this.status });

    try {
      await this.doStart();
      this.status = 'running';
      this.health = 'healthy';
      this.emit('statusChanged', { status: this.status });
      console.log(`▶️ ${this.moduleName} 已启动`);
    } catch (error) {
      this.status = 'error';
      this.health = 'unhealthy';
      this.error = error as Error;
      this.emit('statusChanged', { status: this.status });
      this.emit('error', { error: this.error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.status === 'stopped') {
      return;
    }

    this.status = 'stopping';
    this.emit('statusChanged', { status: this.status });

    try {
      await this.doStop();
      this.status = 'stopped';
      this.health = 'healthy';
      this.emit('statusChanged', { status: this.status });
      console.log(`⏹️ ${this.moduleName} 已停止`);
    } catch (error) {
      this.status = 'error';
      this.health = 'unhealthy';
      this.error = error as Error;
      this.emit('statusChanged', { status: this.status });
      this.emit('error', { error: this.error });
      throw error;
    }
  }

  async process(input: any): Promise<any> {
    const startTime = Date.now();
    this.lastActivity = new Date();

    try {
      const result = await this.doProcess(input);

      // 更新指标
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, true);

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, false);
      this.error = error as Error;
      this.health = 'degraded';
      throw error;
    }
  }

  async reset(): Promise<void> {
    this.metrics = {
      requestsProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
    };
    this.error = undefined;
    this.health = 'healthy';
    await this.doReset();
    console.log(`🔄 ${this.moduleName} 已重置`);
  }

  async cleanup(): Promise<void> {
    await this.stop();
    await this.doCleanup();
    this.removeAllListeners();
    console.log(`🧹 ${this.moduleName} 已清理`);
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const details = await this.doHealthCheck();
      this.health = 'healthy';
      return { healthy: true, details };
    } catch (error) {
      this.health = 'unhealthy';
      this.error = error as Error;
      return {
        healthy: false,
        details: {
          error: error.message,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // ModuleInterface连接管理方法
  addConnection(module: ModuleInterface): void {
    this.connections.set(module.getId(), module);
  }

  removeConnection(moduleId: string): void {
    this.connections.delete(moduleId);
  }

  getConnection(moduleId: string): ModuleInterface | undefined {
    return this.connections.get(moduleId);
  }

  getConnections(): ModuleInterface[] {
    return Array.from(this.connections.values());
  }

  hasConnection(moduleId: string): boolean {
    return this.connections.has(moduleId);
  }

  clearConnections(): void {
    this.connections.clear();
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  // 模块间通信方法
  async sendToModule(targetModuleId: string, message: any, type?: string): Promise<any> {
    const targetModule = this.connections.get(targetModuleId);
    if (targetModule) {
      // 发送消息到目标模块
      targetModule.onModuleMessage((sourceModuleId: string, msg: any, msgType: string) => {
        this.emit('moduleMessage', { fromModuleId: sourceModuleId, message: msg, type: msgType, timestamp: new Date() });
      });
      return Promise.resolve({ success: true, targetModuleId, message, type });
    }
    return Promise.resolve({ success: false, targetModuleId, message, type });
  }

  async broadcastToModules(message: any, type?: string): Promise<void> {
    const promises: Promise<any>[] = [];
    this.connections.forEach(module => {
      promises.push(this.sendToModule(module.getId(), message, type));
    });
    await Promise.allSettled(promises);
  }

  onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void): void {
    this.on('moduleMessage', (data: any) => {
      listener(data.fromModuleId, data.message, data.type);
    });
  }

  // 受保护的方法，子类需要实现

  /**
   * 子类实现具体的启动逻辑
   */
  protected async doStart(): Promise<void> {
    // 默认空实现
  }

  /**
   * 子类实现具体的停止逻辑
   */
  protected async doStop(): Promise<void> {
    // 默认空实现
  }

  /**
   * 子类实现具体的处理逻辑
   */
  protected abstract doProcess(input: any): Promise<any>;

  /**
   * 子类实现具体的重置逻辑
   */
  protected async doReset(): Promise<void> {
    // 默认空实现
  }

  /**
   * 子类实现具体的清理逻辑
   */
  protected async doCleanup(): Promise<void> {
    // 默认空实现
  }

  /**
   * 子类实现具体的健康检查逻辑
   */
  protected async doHealthCheck(): Promise<any> {
    return {
      status: this.status,
      health: this.health,
      uptime: this.lastActivity ? Date.now() - this.lastActivity.getTime() : 0,
    };
  }

  // 私有辅助方法

  /**
   * 更新性能指标
   */
  private updateMetrics(processingTime: number, success: boolean): void {
    this.metrics.requestsProcessed += 1;

    // 计算平均处理时间
    const totalTime = this.metrics.averageProcessingTime * (this.metrics.requestsProcessed - 1) + processingTime;
    this.metrics.averageProcessingTime = totalTime / this.metrics.requestsProcessed;

    // 计算错误率
    if (!success) {
      const errorCount = Math.floor((this.metrics.errorRate * this.metrics.requestsProcessed) / 100) + 1;
      this.metrics.errorRate = (errorCount / this.metrics.requestsProcessed) * 100;
    } else {
      const errorCount = Math.floor((this.metrics.errorRate * this.metrics.requestsProcessed) / 100);
      this.metrics.errorRate = (errorCount / this.metrics.requestsProcessed) * 100;
    }

    // 更新内存和CPU使用情况（简化版）
    this.metrics.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    this.metrics.cpuUsage = process.cpuUsage().user / 1000000; // 简化的CPU使用率
    this.metrics.lastProcessedAt = new Date();
  }
}
