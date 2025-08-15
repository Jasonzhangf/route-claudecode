/**
 * Worker Manager
 * Worker管理器 - 管理多个Worker实例
 * 
 * @author Jason Zhang
 * @version 3.1.0
 */

import { EventEmitter } from 'events';
import { WorkerContainer, WorkerConfig, WorkerStatus, WorkerMetrics } from './worker-container.js';
import { ProcessingContext } from './interfaces/pipeline-module.js';

/**
 * Worker管理器状态
 */
export enum WorkerManagerStatus {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  READY = 'ready',
  DEGRADED = 'degraded',
  SHUTDOWN = 'shutdown'
}

/**
 * Worker池配置
 */
export interface WorkerPoolConfig {
  providerId: string;
  model: string;
  providerConfig: any;
  poolSize: number;
  debugEnabled: boolean;
}

/**
 * Worker管理器统计信息
 */
export interface WorkerManagerMetrics {
  totalWorkers: number;
  healthyWorkers: number;
  processingWorkers: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgProcessingTime: number;
  workerMetrics: Record<string, WorkerMetrics>;
}

/**
 * 负载均衡策略
 */
export type LoadBalancingStrategy = 'round-robin' | 'least-connections' | 'random' | 'weighted';

/**
 * Worker Manager - 管理多个Worker实例
 */
export class WorkerManager extends EventEmitter {
  private status: WorkerManagerStatus = WorkerManagerStatus.UNINITIALIZED;
  private workers = new Map<string, WorkerContainer>();
  private workersByProvider = new Map<string, WorkerContainer[]>();
  private loadBalancingStrategy: LoadBalancingStrategy = 'round-robin';
  private roundRobinCounters = new Map<string, number>();

  // 统计信息
  private metrics: WorkerManagerMetrics = {
    totalWorkers: 0,
    healthyWorkers: 0,
    processingWorkers: 0,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgProcessingTime: 0,
    workerMetrics: {}
  };

  constructor(loadBalancingStrategy: LoadBalancingStrategy = 'round-robin') {
    super();
    this.loadBalancingStrategy = loadBalancingStrategy;
  }

  // ==================== 初始化和配置 ====================

  /**
   * 初始化Worker管理器
   */
  public async initialize(workerPoolConfigs: WorkerPoolConfig[]): Promise<void> {
    try {
      this.log('info', 'Initializing Worker Manager', {
        poolCount: workerPoolConfigs.length,
        strategy: this.loadBalancingStrategy
      });

      this.status = WorkerManagerStatus.INITIALIZING;

      // 为每个Provider.Model组合创建Worker池
      for (const poolConfig of workerPoolConfigs) {
        await this.createWorkerPool(poolConfig);
      }

      // 连接所有Worker
      await this.connectAllWorkers();

      this.updateMetrics();
      this.status = this.metrics.healthyWorkers > 0 ? WorkerManagerStatus.READY : WorkerManagerStatus.DEGRADED;

      this.log('info', 'Worker Manager initialized successfully', {
        totalWorkers: this.metrics.totalWorkers,
        healthyWorkers: this.metrics.healthyWorkers,
        status: this.status
      });

    } catch (error) {
      this.status = WorkerManagerStatus.DEGRADED;
      this.log('error', 'Worker Manager initialization failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 创建Worker池
   */
  private async createWorkerPool(poolConfig: WorkerPoolConfig): Promise<void> {
    const providerKey = `${poolConfig.providerId}.${poolConfig.model}`;
    const workers: WorkerContainer[] = [];

    this.log('info', `Creating worker pool for ${providerKey}`, {
      poolSize: poolConfig.poolSize
    });

    for (let i = 0; i < poolConfig.poolSize; i++) {
      const workerConfig: WorkerConfig = {
        workerId: `${providerKey}-worker-${i}`,
        providerId: poolConfig.providerId,
        model: poolConfig.model,
        providerConfig: poolConfig.providerConfig,
        debugEnabled: poolConfig.debugEnabled
      };

      const worker = new WorkerContainer(workerConfig);

      // 设置Worker事件监听
      this.setupWorkerEventListeners(worker);

      // 初始化Worker
      const initialized = await worker.init();
      if (!initialized) {
        this.log('warn', `Failed to initialize worker ${worker.workerId}`);
        continue;
      }

      workers.push(worker);
      this.workers.set(worker.workerId, worker);
    }

    if (workers.length > 0) {
      this.workersByProvider.set(providerKey, workers);
      this.roundRobinCounters.set(providerKey, 0);

      this.log('info', `Worker pool created for ${providerKey}`, {
        requestedSize: poolConfig.poolSize,
        actualSize: workers.length
      });
    } else {
      this.log('error', `Failed to create any workers for ${providerKey}`);
    }
  }

  /**
   * 连接所有Worker
   */
  private async connectAllWorkers(): Promise<void> {
    const connectPromises = Array.from(this.workers.values()).map(async (worker) => {
      try {
        const connected = await worker.connect();
        if (!connected) {
          this.log('warn', `Failed to connect worker ${worker.workerId}`);
        }
        return connected;
      } catch (error) {
        this.log('error', `Error connecting worker ${worker.workerId}`, {
          error: error instanceof Error ? error.message : String(error)
        });
        return false;
      }
    });

    const results = await Promise.allSettled(connectPromises);
    const connectedCount = results.filter(result => 
      result.status === 'fulfilled' && result.value === true
    ).length;

    this.log('info', `Connected workers: ${connectedCount}/${this.workers.size}`);
  }

  // ==================== 请求处理 ====================

  /**
   * 处理输入请求
   */
  public async processInput(providerId: string, model: string, input: any, context?: ProcessingContext): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.metrics.totalRequests++;

      // 选择Worker
      const worker = this.selectWorker(providerId, model);
      if (!worker) {
        throw new Error(`No healthy worker available for ${providerId}.${model}`);
      }

      this.log('debug', 'Processing input request', {
        workerId: worker.workerId,
        providerId,
        model,
        requestId: context?.requestId
      });

      // 处理请求
      const result = await worker.processInput(input, context);

      const processingTime = Date.now() - startTime;
      this.updateRequestMetrics(true, processingTime);

      this.log('debug', 'Input request processed successfully', {
        workerId: worker.workerId,
        processingTime,
        requestId: context?.requestId
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateRequestMetrics(false, processingTime);

      this.log('error', 'Input request processing failed', {
        providerId,
        model,
        error: error instanceof Error ? error.message : String(error),
        processingTime,
        requestId: context?.requestId
      });

      throw error;
    }
  }

  /**
   * 处理输出响应
   */
  public async processOutput(providerId: string, model: string, output: any, context?: ProcessingContext): Promise<any> {
    const startTime = Date.now();
    
    try {
      // 选择Worker
      const worker = this.selectWorker(providerId, model);
      if (!worker) {
        throw new Error(`No healthy worker available for ${providerId}.${model}`);
      }

      this.log('debug', 'Processing output response', {
        workerId: worker.workerId,
        providerId,
        model,
        requestId: context?.requestId
      });

      // 处理响应
      const result = await worker.processOutput(output, context);

      const processingTime = Date.now() - startTime;
      this.updateRequestMetrics(true, processingTime);

      this.log('debug', 'Output response processed successfully', {
        workerId: worker.workerId,
        processingTime,
        requestId: context?.requestId
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateRequestMetrics(false, processingTime);

      this.log('error', 'Output response processing failed', {
        providerId,
        model,
        error: error instanceof Error ? error.message : String(error),
        processingTime,
        requestId: context?.requestId
      });

      throw error;
    }
  }

  // ==================== Worker选择策略 ====================

  /**
   * 选择Worker
   */
  private selectWorker(providerId: string, model: string): WorkerContainer | null {
    const providerKey = `${providerId}.${model}`;
    const workers = this.workersByProvider.get(providerKey);

    if (!workers || workers.length === 0) {
      return null;
    }

    // 过滤健康的Worker
    const healthyWorkers = workers.filter(worker => worker.isHealthy());
    if (healthyWorkers.length === 0) {
      return null;
    }

    switch (this.loadBalancingStrategy) {
      case 'round-robin':
        return this.selectWorkerRoundRobin(providerKey, healthyWorkers);
      case 'least-connections':
        return this.selectWorkerLeastConnections(healthyWorkers);
      case 'random':
        return this.selectWorkerRandom(healthyWorkers);
      case 'weighted':
        return this.selectWorkerWeighted(healthyWorkers);
      default:
        return healthyWorkers[0];
    }
  }

  /**
   * 轮询选择
   */
  private selectWorkerRoundRobin(providerKey: string, workers: WorkerContainer[]): WorkerContainer {
    const counter = this.roundRobinCounters.get(providerKey) || 0;
    const selectedWorker = workers[counter % workers.length];
    this.roundRobinCounters.set(providerKey, counter + 1);
    return selectedWorker;
  }

  /**
   * 最少连接选择
   */
  private selectWorkerLeastConnections(workers: WorkerContainer[]): WorkerContainer {
    return workers.reduce((least, current) => {
      const leastConnections = least.getActiveRequests().length;
      const currentConnections = current.getActiveRequests().length;
      return currentConnections < leastConnections ? current : least;
    });
  }

  /**
   * 随机选择
   */
  private selectWorkerRandom(workers: WorkerContainer[]): WorkerContainer {
    const randomIndex = Math.floor(Math.random() * workers.length);
    return workers[randomIndex];
  }

  /**
   * 加权选择 (基于性能指标)
   */
  private selectWorkerWeighted(workers: WorkerContainer[]): WorkerContainer {
    // 简单的基于成功率的加权选择
    const workerWeights = workers.map(worker => {
      const metrics = worker.getMetrics();
      const successRate = metrics.totalRequests > 0 
        ? metrics.successfulRequests / metrics.totalRequests 
        : 1.0;
      const avgTime = metrics.avgProcessingTime || 1000;
      
      // 权重 = 成功率 / 平均处理时间 (越高越好)
      return { worker, weight: successRate / (avgTime / 1000) };
    });

    // 选择权重最高的Worker
    const bestWorker = workerWeights.reduce((best, current) => 
      current.weight > best.weight ? current : best
    );

    return bestWorker.worker;
  }

  // ==================== 状态管理 ====================

  /**
   * 获取管理器状态
   */
  public getStatus(): WorkerManagerStatus {
    return this.status;
  }

  /**
   * 获取统计信息
   */
  public getMetrics(): WorkerManagerMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * 更新统计信息
   */
  private updateMetrics(): void {
    const workers = Array.from(this.workers.values());
    
    this.metrics.totalWorkers = workers.length;
    this.metrics.healthyWorkers = workers.filter(w => w.isHealthy()).length;
    this.metrics.processingWorkers = workers.filter(w => w.getStatus() === WorkerStatus.PROCESSING).length;

    // 收集Worker统计信息
    this.metrics.workerMetrics = {};
    for (const worker of workers) {
      this.metrics.workerMetrics[worker.workerId] = worker.getMetrics();
    }
  }

  /**
   * 更新请求统计信息
   */
  private updateRequestMetrics(success: boolean, processingTime: number): void {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // 更新平均处理时间
    const totalRequests = this.metrics.successfulRequests + this.metrics.failedRequests;
    if (totalRequests > 0) {
      this.metrics.avgProcessingTime = Math.round(
        (this.metrics.avgProcessingTime * (totalRequests - 1) + processingTime) / totalRequests
      );
    }
  }

  // ==================== 生命周期管理 ====================

  /**
   * 关闭所有Worker
   */
  public async shutdown(): Promise<void> {
    try {
      this.log('info', 'Shutting down Worker Manager');
      this.status = WorkerManagerStatus.SHUTDOWN;

      // 关闭所有Worker
      const shutdownPromises = Array.from(this.workers.values()).map(async (worker) => {
        try {
          await worker.end();
        } catch (error) {
          this.log('warn', `Error shutting down worker ${worker.workerId}`, {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });

      await Promise.allSettled(shutdownPromises);

      // 清理资源
      this.workers.clear();
      this.workersByProvider.clear();
      this.roundRobinCounters.clear();

      this.log('info', 'Worker Manager shutdown completed');
      this.removeAllListeners();
    } catch (error) {
      this.log('error', 'Worker Manager shutdown failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // ==================== 事件处理 ====================

  /**
   * 设置Worker事件监听
   */
  private setupWorkerEventListeners(worker: WorkerContainer): void {
    worker.on('log', (logEntry) => {
      this.emit('workerLog', { workerId: worker.workerId, ...logEntry });
    });

    worker.on('error', (error) => {
      this.log('warn', `Worker ${worker.workerId} error`, { error });
      this.emit('workerError', { workerId: worker.workerId, error });
    });
  }

  // ==================== 辅助方法 ====================

  /**
   * 日志记录
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: 'WorkerManager',
      message,
      data
    };

    // 发出日志事件
    this.emit('log', logEntry);

    // 简单的控制台输出
    if (level === 'error') {
      console.error(`[WorkerManager] ${message}`, data || '');
    } else if (level === 'warn') {
      console.warn(`[WorkerManager] ${message}`, data || '');
    } else if (level === 'info') {
      console.info(`[WorkerManager] ${message}`, data || '');
    } else {
      console.debug(`[WorkerManager] ${message}`, data || '');
    }
  }

  /**
   * 获取Provider的Worker列表
   */
  public getWorkersByProvider(providerId: string, model: string): WorkerContainer[] {
    const providerKey = `${providerId}.${model}`;
    return this.workersByProvider.get(providerKey) || [];
  }

  /**
   * 获取特定Worker
   */
  public getWorker(workerId: string): WorkerContainer | null {
    return this.workers.get(workerId) || null;
  }

  /**
   * 获取所有Worker列表
   */
  public getAllWorkers(): WorkerContainer[] {
    return Array.from(this.workers.values());
  }
}