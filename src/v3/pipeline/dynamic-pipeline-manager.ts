/**
 * 动态流水线管理器 v3.1.0
 * 
 * 根据配置在启动时创建隔离的provider流水线
 * 每个provider.model组合创建独立的线程和流水线
 * 
 * @author Jason Zhang
 * @version v3.1.0
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { EventEmitter } from 'events';
import { StandardRouterConfig, ProviderConfig, RoutingTarget, PipelineInstance } from '../config/standard-config-schema.js';
import { getLogger } from '../logging/index.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * 流水线任务类型
 */
export interface PipelineTask {
  id: string;
  type: 'request' | 'health-check' | 'shutdown';
  providerId: string;
  model: string;
  data: any;
  timestamp: number;
}

/**
 * 流水线响应
 */
export interface PipelineResponse {
  taskId: string;
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    provider: string;
    model: string;
    processingTime: number;
    threadId?: string;
  };
}

/**
 * 流水线状态
 */
export type PipelineStatus = 'initializing' | 'healthy' | 'degraded' | 'failed' | 'shutdown';

/**
 * 单个Provider流水线实例
 */
export class ProviderPipeline extends EventEmitter {
  private worker?: Worker;
  private status: PipelineStatus = 'initializing';
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgResponseTime: 0,
    lastHealthCheck: new Date().toISOString()
  };
  
  constructor(
    public readonly instance: PipelineInstance,
    private readonly providerConfig: ProviderConfig,
    private readonly logger: any
  ) {
    super();
    this.initialize();
  }
  
  /**
   * 初始化流水线Worker
   */
  private async initialize(): Promise<void> {
    try {
      this.logger.info(`Initializing pipeline for ${this.instance.id}`, {
        provider: this.instance.providerId,
        model: this.instance.model
      });
      
      // 创建独立的Worker线程
      this.worker = new Worker(__filename, {
        workerData: {
          pipelineId: this.instance.id,
          providerId: this.instance.providerId,
          model: this.instance.model,
          providerConfig: this.providerConfig
        }
      });
      
      // 设置Worker消息处理
      this.worker.on('message', this.handleWorkerMessage.bind(this));
      this.worker.on('error', this.handleWorkerError.bind(this));
      this.worker.on('exit', this.handleWorkerExit.bind(this));
      
      // 执行初始化任务
      await this.sendInitializationTask();
      
      this.status = 'healthy';
      this.instance.status = 'healthy';
      this.instance.thread = this.worker.threadId?.toString();
      
      this.logger.info(`Pipeline ${this.instance.id} initialized successfully`, {
        threadId: this.worker.threadId,
        status: this.status
      });
      
    } catch (error) {
      this.status = 'failed';
      this.instance.status = 'failed';
      this.logger.error(`Failed to initialize pipeline ${this.instance.id}`, error);
      throw error;
    }
  }
  
  /**
   * 发送初始化任务
   */
  private async sendInitializationTask(): Promise<void> {
    return new Promise((resolve, reject) => {
      const initTask: PipelineTask = {
        id: uuidv4(),
        type: 'health-check',
        providerId: this.instance.providerId,
        model: this.instance.model,
        data: { type: 'initialization' },
        timestamp: Date.now()
      };
      
      const timeout = setTimeout(() => {
        reject(new Error(`Pipeline initialization timeout for ${this.instance.id}`));
      }, 30000);
      
      const responseHandler = (response: PipelineResponse) => {
        if (response.taskId === initTask.id) {
          clearTimeout(timeout);
          this.off('response', responseHandler);
          
          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error || 'Initialization failed'));
          }
        }
      };
      
      this.on('response', responseHandler);
      this.worker?.postMessage(initTask);
    });
  }
  
  /**
   * 处理Worker消息
   */
  private handleWorkerMessage(response: PipelineResponse): void {
    // 更新统计信息
    this.updateStats(response);
    
    // 触发响应事件
    this.emit('response', response);
    
    this.logger.debug(`Pipeline ${this.instance.id} response`, {
      taskId: response.taskId,
      success: response.success,
      processingTime: response.metadata?.processingTime
    });
  }
  
  /**
   * 处理Worker错误
   */
  private handleWorkerError(error: Error): void {
    this.status = 'failed';
    this.instance.status = 'failed';
    
    this.logger.error(`Pipeline ${this.instance.id} worker error`, error);
    this.emit('error', error);
  }
  
  /**
   * 处理Worker退出
   */
  private handleWorkerExit(code: number): void {
    if (code !== 0) {
      this.status = 'failed';
      this.instance.status = 'failed';
      
      this.logger.error(`Pipeline ${this.instance.id} worker exited with code ${code}`);
      this.emit('exit', code);
    }
  }
  
  /**
   * 发送任务到流水线
   */
  public async sendTask(task: PipelineTask): Promise<PipelineResponse> {
    if (!this.worker || this.status !== 'healthy') {
      throw new Error(`Pipeline ${this.instance.id} is not ready (status: ${this.status})`);
    }
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Task timeout for pipeline ${this.instance.id}`));
      }, this.providerConfig.timeout);
      
      const responseHandler = (response: PipelineResponse) => {
        if (response.taskId === task.id) {
          clearTimeout(timeout);
          this.off('response', responseHandler);
          resolve(response);
        }
      };
      
      this.on('response', responseHandler);
      this.worker!.postMessage(task);
    });
  }
  
  /**
   * 执行健康检查
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const healthTask: PipelineTask = {
        id: uuidv4(),
        type: 'health-check',
        providerId: this.instance.providerId,
        model: this.instance.model,
        data: { type: 'routine' },
        timestamp: Date.now()
      };
      
      const response = await this.sendTask(healthTask);
      const isHealthy = response.success;
      
      this.status = isHealthy ? 'healthy' : 'degraded';
      this.instance.status = this.status;
      this.stats.lastHealthCheck = new Date().toISOString();
      
      return isHealthy;
    } catch (error) {
      this.status = 'degraded';
      this.instance.status = 'degraded';
      this.logger.warn(`Health check failed for pipeline ${this.instance.id}`, error);
      return false;
    }
  }
  
  /**
   * 获取流水线统计信息
   */
  public getStats(): typeof this.stats {
    return { ...this.stats };
  }
  
  /**
   * 获取流水线状态
   */
  public getStatus(): PipelineStatus {
    return this.status;
  }
  
  /**
   * 更新统计信息
   */
  private updateStats(response: PipelineResponse): void {
    this.stats.totalRequests++;
    
    if (response.success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }
    
    // 更新平均响应时间
    if (response.metadata?.processingTime) {
      const currentAvg = this.stats.avgResponseTime;
      const newTime = response.metadata.processingTime;
      this.stats.avgResponseTime = Math.round(
        (currentAvg * (this.stats.totalRequests - 1) + newTime) / this.stats.totalRequests
      );
    }
    
    // 更新实例统计
    this.instance.stats = { ...this.stats };
  }
  
  /**
   * 关闭流水线
   */
  public async shutdown(): Promise<void> {
    this.logger.info(`Shutting down pipeline ${this.instance.id}`);
    
    if (this.worker) {
      // 发送关闭任务
      const shutdownTask: PipelineTask = {
        id: uuidv4(),
        type: 'shutdown',
        providerId: this.instance.providerId,
        model: this.instance.model,
        data: {},
        timestamp: Date.now()
      };
      
      try {
        this.worker.postMessage(shutdownTask);
        await this.worker.terminate();
      } catch (error) {
        this.logger.warn(`Error during pipeline shutdown ${this.instance.id}`, error);
      }
    }
    
    this.status = 'shutdown';
    this.instance.status = 'shutdown';
    this.removeAllListeners();
  }
}

/**
 * 动态流水线管理器
 */
export class DynamicPipelineManager extends EventEmitter {
  private pipelines = new Map<string, ProviderPipeline>();
  private instances = new Map<string, PipelineInstance>();
  private logger: any;
  private healthCheckInterval?: NodeJS.Timeout;
  
  constructor(private config: StandardRouterConfig) {
    super();
    this.logger = getLogger(config.server.port);
  }
  
  /**
   * 初始化所有流水线
   */
  public async initialize(): Promise<void> {
    this.logger.info('Initializing dynamic pipeline manager');
    
    // 分析配置，确定需要的流水线
    const requiredPipelines = this.analyzeRequiredPipelines();
    
    this.logger.info(`Creating ${requiredPipelines.length} pipeline instances`, {
      pipelines: requiredPipelines.map(p => `${p.providerId}.${p.model}`)
    });
    
    // 并行创建所有流水线
    const initPromises = requiredPipelines.map(instance => this.createPipeline(instance));
    await Promise.allSettled(initPromises);
    
    // 统计初始化结果
    const successful = Array.from(this.pipelines.values()).filter(p => p.getStatus() === 'healthy').length;
    const failed = requiredPipelines.length - successful;
    
    this.logger.info(`Pipeline initialization completed`, {
      total: requiredPipelines.length,
      successful,
      failed,
      pipelines: Array.from(this.pipelines.keys())
    });
    
    // 启动健康检查
    this.startHealthChecks();
    
    if (failed > 0) {
      this.logger.warn(`${failed} pipelines failed to initialize`);
    }
  }
  
  /**
   * 分析配置，确定需要的流水线
   */
  private analyzeRequiredPipelines(): PipelineInstance[] {
    const requiredPipelines = new Set<string>();
    const instances: PipelineInstance[] = [];
    
    // 遍历路由表，收集所有需要的 provider.model 组合
    for (const [category, categoryConfig] of Object.entries(this.config.routing.categories)) {
      // 添加主要路由目标
      const primaryKey = `${categoryConfig.primary.provider}.${categoryConfig.primary.model}`;
      requiredPipelines.add(primaryKey);
      
      // 添加备份路由目标
      if (categoryConfig.backups) {
        for (const backup of categoryConfig.backups) {
          const backupKey = `${backup.provider}.${backup.model}`;
          requiredPipelines.add(backupKey);
        }
      }
    }
    
    // 为每个唯一的组合创建流水线实例
    for (const pipelineKey of requiredPipelines) {
      const [providerId, model] = pipelineKey.split('.');
      
      // 验证provider存在
      if (!this.config.providers[providerId]) {
        this.logger.warn(`Skipping pipeline for non-existent provider: ${providerId}`);
        continue;
      }
      
      // 验证模型存在
      const provider = this.config.providers[providerId];
      if (!provider.models.includes(model)) {
        this.logger.warn(`Skipping pipeline for non-existent model: ${model} in provider ${providerId}`);
        continue;
      }
      
      const instance: PipelineInstance = {
        id: `pipeline-${providerId}-${model}-${Date.now()}`,
        providerId,
        model,
        status: 'initializing',
        stats: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          avgResponseTime: 0,
          lastHealthCheck: new Date().toISOString()
        }
      };
      
      instances.push(instance);
      this.instances.set(instance.id, instance);
    }
    
    return instances;
  }
  
  /**
   * 创建单个流水线
   */
  private async createPipeline(instance: PipelineInstance): Promise<void> {
    try {
      const providerConfig = this.config.providers[instance.providerId];
      const pipeline = new ProviderPipeline(instance, providerConfig, this.logger);
      
      // 等待流水线初始化完成
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Pipeline creation timeout for ${instance.id}`));
        }, 60000);
        
        pipeline.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
        
        // 检查初始化状态
        const checkInitialization = () => {
          if (pipeline.getStatus() === 'healthy') {
            clearTimeout(timeout);
            resolve();
          } else if (pipeline.getStatus() === 'failed') {
            clearTimeout(timeout);
            reject(new Error(`Pipeline initialization failed for ${instance.id}`));
          } else {
            setTimeout(checkInitialization, 100);
          }
        };
        
        checkInitialization();
      });
      
      this.pipelines.set(instance.id, pipeline);
      this.logger.info(`Pipeline created successfully: ${instance.id}`);
      
    } catch (error) {
      this.logger.error(`Failed to create pipeline ${instance.id}`, error);
      instance.status = 'failed';
    }
  }
  
  /**
   * 根据provider和model查找流水线
   */
  public findPipeline(providerId: string, model: string): ProviderPipeline | null {
    for (const [instanceId, instance] of this.instances) {
      if (instance.providerId === providerId && instance.model === model) {
        const pipeline = this.pipelines.get(instanceId);
        if (pipeline && pipeline.getStatus() === 'healthy') {
          return pipeline;
        }
      }
    }
    return null;
  }
  
  /**
   * 发送请求到指定流水线
   */
  public async sendRequest(providerId: string, model: string, requestData: any): Promise<any> {
    const pipeline = this.findPipeline(providerId, model);
    if (!pipeline) {
      throw new Error(`No healthy pipeline found for ${providerId}.${model}`);
    }
    
    const task: PipelineTask = {
      id: uuidv4(),
      type: 'request',
      providerId,
      model,
      data: requestData,
      timestamp: Date.now()
    };
    
    const response = await pipeline.sendTask(task);
    
    if (!response.success) {
      throw new Error(response.error || 'Pipeline request failed');
    }
    
    return response.data;
  }
  
  /**
   * 获取所有流水线状态
   */
  public getPipelineStatuses(): Record<string, any> {
    const statuses: Record<string, any> = {};
    
    for (const [instanceId, instance] of this.instances) {
      const pipeline = this.pipelines.get(instanceId);
      statuses[instanceId] = {
        providerId: instance.providerId,
        model: instance.model,
        status: instance.status,
        threadId: instance.thread,
        stats: instance.stats,
        pipelineStatus: pipeline?.getStatus() || 'unknown'
      };
    }
    
    return statuses;
  }
  
  /**
   * 启动健康检查 (DISABLED)
   */
  private startHealthChecks(): void {
    // 🚫 Health checks disabled to eliminate continuous polling
    this.logger.info('Health checks disabled - no continuous polling');
    
    // Remove any existing health check intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }
  
  /**
   * 关闭所有流水线
   */
  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down pipeline manager');
    
    // 停止健康检查
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // 关闭所有流水线
    const shutdownPromises = Array.from(this.pipelines.values()).map(pipeline => 
      pipeline.shutdown().catch(error => 
        this.logger.warn(`Error shutting down pipeline ${pipeline.instance.id}`, error)
      )
    );
    
    await Promise.allSettled(shutdownPromises);
    
    this.pipelines.clear();
    this.instances.clear();
    this.removeAllListeners();
    
    this.logger.info('Pipeline manager shutdown completed');
  }
}

// Worker线程代码
if (!isMainThread && parentPort) {
  // 这里将包含实际的Provider处理逻辑
  // 在Worker线程中运行，完全隔离
  
  const { pipelineId, providerId, model, providerConfig } = workerData;
  const logger = getLogger(0); // Worker thread logger
  
  // 初始化Provider客户端
  let providerClient: any = null;
  
  parentPort.on('message', async (task: PipelineTask) => {
    const startTime = Date.now();
    
    try {
      let result: any = null;
      
      switch (task.type) {
        case 'health-check':
          // 执行健康检查
          result = await performHealthCheck();
          break;
          
        case 'request':
          // 处理实际请求
          result = await processRequest(task.data);
          break;
          
        case 'shutdown':
          // 处理关闭请求
          result = { shutdown: true };
          break;
          
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
      
      const response: PipelineResponse = {
        taskId: task.id,
        success: true,
        data: result,
        metadata: {
          provider: providerId,
          model: model,
          processingTime: Date.now() - startTime,
          threadId: process.pid.toString()
        }
      };
      
      parentPort!.postMessage(response);
      
    } catch (error) {
      const response: PipelineResponse = {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          provider: providerId,
          model: model,
          processingTime: Date.now() - startTime,
          threadId: process.pid.toString()
        }
      };
      
      parentPort!.postMessage(response);
    }
  });
  
  async function performHealthCheck(): Promise<{ healthy: boolean; timestamp: string }> {
    // 实现健康检查逻辑
    // 这里应该包含实际的Provider健康检查
    return {
      healthy: true,
      timestamp: new Date().toISOString()
    };
  }
  
  async function processRequest(requestData: any): Promise<any> {
    // 实现实际的请求处理逻辑
    // 这里应该包含完整的Provider请求处理流水线
    return {
      processed: true,
      timestamp: new Date().toISOString(),
      data: requestData
    };
  }
  
  logger.info(`Pipeline worker started for ${providerId}.${model}`, {
    pipelineId,
    threadId: process.pid
  });
}