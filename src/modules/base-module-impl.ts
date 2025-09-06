/**
 * 基础模块实现
 *
 * 提供ModuleInterface的标准实现基类
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { ModuleInterface, ModuleType, ModuleStatus, ModuleMetrics, ModuleConnection } from './interfaces/module/base-module';

/**
 * 基础模块抽象类
 */
export abstract class BaseModule extends EventEmitter implements ModuleInterface {
  protected readonly id: string;
  protected readonly name: string;
  protected readonly type: ModuleType;
  protected readonly version: string;
  protected status: ModuleStatus['status'] = 'stopped';
  protected config: any = {};
  protected metrics: ModuleMetrics = {
    requestsProcessed: 0,
    averageProcessingTime: 0,
    errorRate: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    lastProcessedAt: undefined,
  };
  protected processingTimes: number[] = [];
  protected connections: Map<string, ModuleInterface> = new Map();
  protected errors: Error[] = [];
  protected messageHandlers: Array<(sourceModuleId: string, message: any, type: string) => void> = [];

  constructor(id: string, name: string, type: ModuleType, version: string = '1.0.0') {
    super();
    this.id = id;
    this.name = name;
    this.type = type;
    this.version = version;
  }

  /**
   * 获取模块ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * 获取模块名称
   */
  getName(): string {
    return this.name;
  }

  /**
   * 获取模块类型
   */
  getType(): ModuleType {
    return this.type;
  }

  /**
   * 获取模块版本
   */
  getVersion(): string {
    return this.version;
  }

  /**
   * 获取模块状态
   */
  getStatus(): ModuleStatus {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      status: this.status,
      health: this.calculateHealthStatus(),
      lastActivity: this.metrics.lastProcessedAt,
      error: this.errors.length > 0 ? this.errors[this.errors.length - 1] : undefined,
    };
  }

  /**
   * 获取模块指标
   */
  getMetrics(): ModuleMetrics {
    return { ...this.metrics };
  }

  /**
   * 配置模块
   */
  async configure(config: any): Promise<void> {
    this.config = { ...this.config, ...config };
    await this.onConfigure(config);
    this.emit('configured', { config });
  }

  /**
   * 启动模块
   */
  async start(): Promise<void> {
    if (this.status === 'running') {
      return;
    }

    try {
      this.status = 'starting';
      this.emit('statusChanged', { status: this.status });

      await this.onStart();

      this.status = 'running';
      this.emit('statusChanged', { status: this.status });
      this.emit('started');
    } catch (error) {
      this.status = 'error';
      this.recordError(error as Error);
      this.emit('statusChanged', { status: this.status });
      throw error;
    }
  }

  /**
   * 停止模块
   */
  async stop(): Promise<void> {
    if (this.status === 'stopped') {
      return;
    }

    try {
      this.status = 'stopping';
      this.emit('statusChanged', { status: this.status });

      await this.onStop();

      this.status = 'stopped';
      this.emit('statusChanged', { status: this.status });
      this.emit('stopped');
    } catch (error) {
      this.status = 'error';
      this.recordError(error as Error);
      this.emit('statusChanged', { status: this.status });
      throw error;
    }
  }

  /**
   * 处理输入
   */
  async process(input: any): Promise<any> {
    if (this.status !== 'running') {
      throw new Error(`Module ${this.id} is not running (status: ${this.status})`);
    }

    const startTime = Date.now();

    try {
      this.emit('processingStarted', { input });

      const result = await this.onProcess(input);

      const processingTime = Date.now() - startTime;
      this.recordProcessingTime(processingTime);

      this.emit('processingCompleted', { input, result, processingTime });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.recordError(error as Error);
      this.recordProcessingTime(processingTime);

      this.emit('processingFailed', { input, error, processingTime });
      throw error;
    }
  }

  /**
   * 重置模块
   */
  async reset(): Promise<void> {
    try {
      await this.onReset();

      // 重置指标
      this.metrics = {
        requestsProcessed: 0,
        averageProcessingTime: 0,
        errorRate: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        lastProcessedAt: undefined,
      };

      this.processingTimes = [];
      this.errors = [];

      this.emit('reset');
    } catch (error) {
      this.recordError(error as Error);
      throw error;
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    try {
      await this.onCleanup();
      this.removeAllListeners();
      this.emit('cleanedUp');
    } catch (error) {
      this.recordError(error as Error);
      throw error;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const details = await this.onHealthCheck();
      const healthy = this.status === 'running' && this.calculateHealthStatus() === 'healthy';

      return { healthy, details };
    } catch (error) {
      this.recordError(error as Error);
      return {
        healthy: false,
        details: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  // 抽象方法 - 子类必须实现

  /**
   * 配置处理 - 子类可重写
   */
  protected async onConfigure(config: any): Promise<void> {
    // 默认实现：无操作
  }

  /**
   * 启动处理 - 子类可重写
   */
  protected async onStart(): Promise<void> {
    // 默认实现：无操作
  }

  /**
   * 停止处理 - 子类可重写
   */
  protected async onStop(): Promise<void> {
    // 默认实现：无操作
  }

  /**
   * 处理逻辑 - 子类必须实现
   */
  protected abstract onProcess(input: any): Promise<any>;

  /**
   * 重置处理 - 子类可重写
   */
  protected async onReset(): Promise<void> {
    // 默认实现：无操作
  }

  /**
   * 清理处理 - 子类可重写
   */
  protected async onCleanup(): Promise<void> {
    // 默认实现：无操作
  }

  /**
   * 健康检查处理 - 子类可重写
   */
  protected async onHealthCheck(): Promise<any> {
    return {
      status: this.status,
      metrics: this.metrics,
      config: this.config,
    };
  }

  // 私有方法

  /**
   * 记录处理时间
   */
  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time);
    this.metrics.requestsProcessed++;
    this.metrics.lastProcessedAt = new Date();

    // 保持最近100次的处理时间
    if (this.processingTimes.length > 100) {
      this.processingTimes = this.processingTimes.slice(-100);
    }

    // 更新平均处理时间
    this.metrics.averageProcessingTime =
      this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;

    // 更新错误率
    this.updateErrorRate();
  }

  /**
   * 记录错误
   */
  private recordError(error: Error): void {
    this.errors.push(error);

    // 保持最近50个错误
    if (this.errors.length > 50) {
      this.errors = this.errors.slice(-50);
    }

    this.updateErrorRate();
    this.emit('error', { error });
  }

  /**
   * 更新错误率
   */
  private updateErrorRate(): void {
    if (this.metrics.requestsProcessed === 0) {
      this.metrics.errorRate = 0;
    } else {
      // 计算最近请求的错误率
      const recentRequests = Math.min(100, this.metrics.requestsProcessed);
      const recentErrors = Math.min(this.errors.length, recentRequests);
      this.metrics.errorRate = recentErrors / recentRequests;
    }
  }

  /**
   * 计算健康状态
   */
  private calculateHealthStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    if (this.status === 'error') {
      return 'unhealthy';
    }

    if (this.status !== 'running') {
      return 'degraded';
    }

    // 基于错误率判断健康状态
    if (this.metrics.errorRate > 0.1) {
      // 错误率超过10%
      return 'unhealthy';
    } else if (this.metrics.errorRate > 0.05) {
      // 错误率超过5%
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * 处理模块间消息
   */
  private async handleInterModuleMessage(input: any): Promise<any> {
    const message = input.message;
    
    // 调用所有消息处理器
    for (const handler of this.messageHandlers) {
      try {
        handler(message.sourceModuleId, message.content, message.type);
      } catch (error) {
        this.recordError(error as Error);
      }
    }
    
    // 发出事件
    this.emit('interModuleMessageReceived', { message });
    
    // 返回确认响应
    return {
      success: true,
      messageId: message.id,
      processedAt: Date.now(),
      processedBy: this.id,
      sourceModuleId: message.sourceModuleId
    };
  }

  /**
   * 添加模块连接
   */
  addConnection(module: ModuleInterface): void {
    this.connections.set(module.getId(), module);
  }

  /**
   * 移除模块连接
   */
  removeConnection(moduleId: string): void {
    this.connections.delete(moduleId);
  }

  /**
   * 获取指定模块连接
   */
  getConnection(moduleId: string): ModuleInterface | undefined {
    return this.connections.get(moduleId);
  }

  /**
   * 获取所有连接
   */
  getConnections(): ModuleInterface[] {
    return Array.from(this.connections.values());
  }

  /**
   * 向连接的模块广播消息
   */
  async broadcastToConnected(message: any): Promise<void> {
    const promises = Array.from(this.connections.values()).map(async (module) => {
      try {
        await module.process({ type: 'broadcast', data: message, source: this.id });
      } catch (error) {
        console.warn(`Failed to broadcast to module ${module.getId()}:`, error);
      }
    });
    await Promise.allSettled(promises);
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(targetModuleId: string): 'connected' | 'disconnected' | 'connecting' | 'error' {
    return this.connections.has(targetModuleId) ? 'connected' : 'disconnected';
  }

  /**
   * 发送消息到目标模块
   */
  async sendToModule(targetModuleId: string, message: any, type?: string): Promise<any> {
    const targetModule = this.connections.get(targetModuleId);
    if (!targetModule) {
      throw new Error(`Target module ${targetModuleId} not found`);
    }
    
    const messageWrapper = {
      id: `${this.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sourceModuleId: this.id,
      targetModuleId,
      type: type || 'default',
      content: message,
      timestamp: Date.now()
    };
    
    return await targetModule.process({ 
      type: 'interModuleMessage', 
      message: messageWrapper 
    });
  }

  /**
   * 广播消息到所有连接的模块
   */
  async broadcastToModules(message: any, type?: string): Promise<void> {
    const broadcastPromises = Array.from(this.connections.values()).map(async (module) => {
      try {
        const messageWrapper = {
          id: `${this.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sourceModuleId: this.id,
          targetModuleId: module.getId(),
          type: type || 'broadcast',
          content: message,
          timestamp: Date.now()
        };
        
        await module.process({ 
          type: 'interModuleMessage', 
          message: messageWrapper 
        });
      } catch (error) {
        console.warn(`Failed to broadcast to module ${module.getId()}:`, error);
      }
    });
    
    await Promise.allSettled(broadcastPromises);
  }

  /**
   * 监听来自其他模块的消息
   */
  onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void): void {
    this.messageHandlers.push(listener);
  }

  /**
   * 验证连接
   */
  validateConnection(targetModule: ModuleInterface): boolean {
    try {
      return targetModule && typeof targetModule.getId === 'function' && targetModule.getId().length > 0;
    } catch {
      return false;
    }
  }
}
