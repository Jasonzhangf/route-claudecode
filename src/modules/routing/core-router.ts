/**
 * 核心路由器模块
 *
 * 实现基础的路由功能和请求分发
 *
 * @author RCC v4.0
 */

import { ModuleInterface, ModuleType, ModuleStatus, ModuleMetrics } from '../../interfaces/module/base-module';
import { SimpleRouter, RoutingConfig, RouteResult } from '../../router/simple-router';
import { secureLogger } from '../../utils/secure-logger';

/**
 * 核心路由器模块实现
 */
export class CoreRouter implements ModuleInterface {
  private id: string;
  private name: string;
  private version: string;
  private router: SimpleRouter | null = null;
  private status: ModuleStatus;
  private metrics: ModuleMetrics;
  private eventListeners: Map<string, Function[]> = new Map();
  private logger = secureLogger;

  constructor(id: string = 'core-router') {
    this.id = id;
    this.name = 'Core Router';
    this.version = '4.0.0';
    
    this.status = {
      id: this.id,
      name: this.name,
      type: ModuleType.VALIDATOR,
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

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getType(): ModuleType {
    return ModuleType.VALIDATOR;
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
    try {
      this.logger.info('Configuring core router', { config });
      
      if (config.routing) {
        this.router = new SimpleRouter(config.routing);
      }
      
      this.logger.info('Core router configured successfully');
    } catch (error) {
      this.logger.error('Failed to configure core router', { error });
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      this.status.status = 'starting';
      this.logger.info('Starting core router');
      
      if (!this.router) {
        throw new Error('Router not configured');
      }
      
      this.status.status = 'running';
      this.status.lastActivity = new Date();
      
      this.logger.info('Core router started successfully');
    } catch (error) {
      this.status.status = 'error';
      this.status.error = error as Error;
      this.logger.error('Failed to start core router', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.status.status = 'stopping';
      this.logger.info('Stopping core router');
      
      this.status.status = 'stopped';
      this.logger.info('Core router stopped successfully');
    } catch (error) {
      this.status.status = 'error';
      this.status.error = error as Error;
      this.logger.error('Failed to stop core router', { error });
      throw error;
    }
  }

  async process(input: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.status.status = 'busy';
      this.logger.info('Processing routing request', { input });
      
      if (!this.router) {
        throw new Error('Router not initialized');
      }

      const result = await this.router.route(input);
      
      this.metrics.requestsProcessed++;
      this.status.lastActivity = new Date();
      this.status.status = 'running';
      
      const processingTime = Date.now() - startTime;
      this.updateProcessingTime(processingTime);
      
      this.logger.info('Routing request processed successfully', { 
        result,
        processingTime 
      });
      
      return result;
      
    } catch (error) {
      this.status.status = 'error';
      this.status.error = error as Error;
      this.metrics.errorRate = this.calculateErrorRate();
      
      this.logger.error('Failed to process routing request', { error });
      throw error;
    }
  }

  async reset(): Promise<void> {
    this.logger.info('Resetting core router');
    
    this.metrics = {
      requestsProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };
    
    this.status.error = undefined;
    this.status.health = 'healthy';
    
    this.logger.info('Core router reset successfully');
  }

  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up core router');
    
    this.router = null;
    this.eventListeners.clear();
    
    this.logger.info('Core router cleanup completed');
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const routerHealth = this.router ? await this.router.healthCheck() : { healthy: false, details: {} };
      
      const healthy = this.status.health === 'healthy' && 
                     this.status.status !== 'error' &&
                     routerHealth.healthy;
      
      return {
        healthy,
        details: {
          status: this.status.status,
          health: this.status.health,
          router: routerHealth.details,
          metrics: this.metrics
        }
      };
    } catch (error) {
      this.logger.error('Health check failed', { error });
      return {
        healthy: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  removeAllListeners(): void {
    this.eventListeners.clear();
  }

  /**
   * 更新处理时间指标
   */
  private updateProcessingTime(newTime: number): void {
    const currentAvg = this.metrics.averageProcessingTime;
    const count = this.metrics.requestsProcessed;
    
    this.metrics.averageProcessingTime = 
      (currentAvg * (count - 1) + newTime) / count;
  }

  /**
   * 计算错误率
   */
  private calculateErrorRate(): number {
    // 简化的错误率计算
    return this.metrics.requestsProcessed > 0 ? 
      (this.status.error ? 1 / this.metrics.requestsProcessed : 0) : 0;
  }

  /**
   * 获取路由器实例
   */
  getRouter(): SimpleRouter | null {
    return this.router;
  }

  /**
   * 获取路由配置
   */
  getRoutingConfig(): RoutingConfig | null {
    return this.router ? this.router.getConfig() : null;
  }

  /**
   * 更新路由配置
   */
  updateRoutingConfig(config: RoutingConfig): void {
    if (this.router) {
      this.router.updateConfig(config);
      this.logger.info('Routing configuration updated');
    }
  }
}

/**
 * 创建核心路由器实例
 */
export function createCoreRouter(id?: string): CoreRouter {
  return new CoreRouter(id);
}