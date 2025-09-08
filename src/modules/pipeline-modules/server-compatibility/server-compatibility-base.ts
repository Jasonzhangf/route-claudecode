/**
 * Server Compatibility模块基类
 * 支持双向兼容性处理：请求和响应
 */

import { ModuleInterface, ModuleStatus, ModuleType, ModuleMetrics } from '../../pipeline/src/module-interface';
import { EventEmitter } from 'events';
import { secureLogger } from '../../error-handler/src/utils/secure-logger';

/**
 * 双向兼容性处理接口
 */
export interface BidirectionalCompatibility {
  processRequest(request: any, routingDecision: any, context: any): Promise<any>;
  processResponse(response: any, routingDecision: any, context: any): Promise<any>;
}

/**
 * 模块处理上下文接口
 */
export interface ModuleProcessingContext {
  readonly requestId: string;
  readonly providerName?: string;
  readonly protocol?: string;
  readonly config?: {
    readonly endpoint?: string;
    readonly apiKey?: string;
    readonly timeout?: number;
    readonly maxRetries?: number;
    readonly actualModel?: string;
    readonly originalModel?: string;
    readonly serverCompatibility?: string;
  };
  readonly debug?: {
    readonly enabled: boolean;
    readonly level: number;
    readonly outputPath?: string;
  };
  metadata?: {
    architecture?: string;
    layer?: string;
    protocolConfig?: {
      endpoint?: string;
      apiKey?: string;
      protocol?: string;
      timeout?: number;
      maxRetries?: number;
      customHeaders?: Record<string, string>;
    };
    [key: string]: any;
  };
}

/**
 * Server兼容性模块基类
 * 实现ModuleInterface接口，支持API化管理
 * 支持双向兼容性处理：请求和响应
 */
export abstract class ServerCompatibilityModule extends EventEmitter implements ModuleInterface, BidirectionalCompatibility {
  protected id: string;
  protected name: string;
  protected type: ModuleType;
  protected version: string;
  protected status: ModuleStatus;
  protected metrics: ModuleMetrics;
  protected connections: Map<string, ModuleInterface> = new Map();

  constructor(id: string, name: string, version: string = '1.0.0') {
    super();
    
    this.id = id;
    this.name = name;
    this.type = ModuleType.SERVER_COMPATIBILITY;
    this.version = version;
    
    this.status = {
      id: this.id,
      name: this.name,
      type: this.type,
      status: 'stopped',
      health: 'healthy'
    };
    
    this.metrics = {
      requestsProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };
  }

  // ModuleInterface 实现
  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getType(): ModuleType {
    return this.type;
  }

  getVersion(): string {
    return this.version;
  }

  getStatus(): ModuleStatus {
    return { ...this.status };
  }

  getMetrics(): ModuleMetrics {
    return { ...this.metrics };
  }

  async configure(config: any): Promise<void> {
    this.status.lastActivity = new Date();
  }

  async start(): Promise<void> {
    if (this.status.status === 'running') {
      return;
    }
    
    this.status.status = 'starting';
    this.status.lastActivity = new Date();
    
    try {
      await this.initialize();
      
      this.status.status = 'running';
      this.status.health = 'healthy';
      this.status.lastActivity = new Date();
      
      this.emit('started', { id: this.id, timestamp: new Date() });
    } catch (error) {
      this.status.status = 'error';
      this.status.health = 'unhealthy';
      this.status.error = error as Error;
      this.status.lastActivity = new Date();
      
      this.emit('error', { id: this.id, error, timestamp: new Date() });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.status.status === 'stopped') {
      return;
    }
    
    this.status.status = 'stopping';
    this.status.lastActivity = new Date();
    
    try {
      await this.cleanup();
      
      this.status.status = 'stopped';
      this.status.health = 'healthy';
      this.status.lastActivity = new Date();
      
      this.emit('stopped', { id: this.id, timestamp: new Date() });
    } catch (error) {
      this.status.status = 'error';
      this.status.health = 'unhealthy';
      this.status.error = error as Error;
      this.status.lastActivity = new Date();
      
      this.emit('error', { id: this.id, error, timestamp: new Date() });
      throw error;
    }
  }

  async reset(): Promise<void> {
    this.metrics = {
      requestsProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };
    
    this.status.lastActivity = new Date();
  }

  async cleanup(): Promise<void> {
    this.removeAllListeners();
    this.status.lastActivity = new Date();
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return {
      healthy: this.status.health === 'healthy' || this.status.health === 'degraded',
      details: {
        status: this.status.status,
        health: this.status.health,
        metrics: this.metrics
      }
    };
  }

  /**
   * 初始化方法 - 子类可以重写
   */
  protected async initialize(): Promise<void> {
    // 默认实现为空
  }

  /**
   * 处理数据 - 兼容旧接口，自动检测是请求还是响应
   */
  async process(input: any): Promise<any> {
    if (this.status.status !== 'running') {
      throw new Error('Module is not running');
    }
    
    const startTime = Date.now();
    this.status.status = 'running';
    this.status.lastActivity = new Date();
    
    try {
      // 创建默认上下文
      const context: ModuleProcessingContext = {
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      
      // 自动检测是请求还是响应
      if (this.isRequest(input)) {
        const output = await this.processRequest(input, null, context);
        
        // 更新指标
        this.metrics.requestsProcessed++;
        const processingTime = Date.now() - startTime;
        this.metrics.averageProcessingTime = 
          (this.metrics.averageProcessingTime * (this.metrics.requestsProcessed - 1) + processingTime) / 
          this.metrics.requestsProcessed;
        
        this.status.status = 'running';
        this.status.lastActivity = new Date();
        
        this.emit('processed', { 
          id: this.id, 
          input, 
          output, 
          processingTime,
          timestamp: new Date() 
        });
        
        return output;
      } else if (this.isResponse(input)) {
        const output = await this.processResponse(input, null, context);
        
        // 更新指标
        this.metrics.requestsProcessed++;
        const processingTime = Date.now() - startTime;
        this.metrics.averageProcessingTime = 
          (this.metrics.averageProcessingTime * (this.metrics.requestsProcessed - 1) + processingTime) / 
          this.metrics.requestsProcessed;
        
        this.status.status = 'running';
        this.status.lastActivity = new Date();
        
        this.emit('processed', { 
          id: this.id, 
          input, 
          output, 
          processingTime,
          timestamp: new Date() 
        });
        
        return output;
      } else {
        throw new Error('Unsupported input format');
      }
    } catch (error) {
      this.metrics.errorRate = 
        (this.metrics.errorRate * this.metrics.requestsProcessed + 1) / 
        (this.metrics.requestsProcessed + 1);
      
      this.status.status = 'running'; // 恢复到运行状态
      this.status.health = 'degraded';
      this.status.lastActivity = new Date();
      
      this.emit('error', { id: this.id, error, timestamp: new Date() });
      throw error;
    }
  }

  /**
   * 判断是否为请求
   */
  protected isRequest(input: any): boolean {
    return input && (
      input.messages !== undefined || 
      input.model !== undefined || 
      input.tools !== undefined
    );
  }

  /**
   * 判断是否为响应
   */
  protected isResponse(input: any): boolean {
    return input && (
      input.choices !== undefined || 
      input.id !== undefined || 
      input.object !== undefined ||
      input.usage !== undefined
    );
  }

  // BidirectionalCompatibility 接口方法 - 抽象方法，子类必须实现
  abstract processRequest(request: any, routingDecision: any, context: ModuleProcessingContext): Promise<any>;
  abstract processResponse(response: any, routingDecision: any, context: ModuleProcessingContext): Promise<any>;

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

  getConnectionStatus(targetModuleId: string): 'connected' | 'disconnected' | 'connecting' | 'error' {
    const connection = this.connections.get(targetModuleId);
    if (!connection) {
      return 'disconnected';
    }
    const status = connection.getStatus();
    return status.status === 'running' ? 'connected' : (status.status as any);
  }

  validateConnection(targetModule: ModuleInterface): boolean {
    try {
      const status = targetModule.getStatus();
      const metrics = targetModule.getMetrics();
      return status.status === 'running' && status.health === 'healthy';
    } catch (error) {
      return false;
    }
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
}