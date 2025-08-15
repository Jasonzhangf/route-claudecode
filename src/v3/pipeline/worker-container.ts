/**
 * Worker Container
 * Worker容器 - 管理三层流水线模块
 * 
 * @author Jason Zhang
 * @version 3.1.0
 */

import { EventEmitter } from 'events';
import {
  PipelineModule,
  ModuleType,
  ModuleConfig,
  ModuleStatus,
  ProcessingContext,
  StandardRequest,
  StandardResponse,
  HotSwappable
} from './interfaces/pipeline-module.js';
import { TransformerModule } from './modules/transformer-module.js';
import { ProviderProtocolModule } from './modules/provider-protocol-module.js';
import { ServerProcessorModule } from './modules/server-processor-module.js';

/**
 * Worker状态枚举
 */
export enum WorkerStatus {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  PROCESSING = 'processing',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected',
  DESTROYED = 'destroyed',
  ERROR = 'error'
}

/**
 * Worker配置接口
 */
export interface WorkerConfig {
  workerId: string;
  providerId: string;
  model: string;
  providerConfig: any;
  debugEnabled: boolean;
}

/**
 * Worker统计信息
 */
export interface WorkerMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgProcessingTime: number;
  uptime: number;
  moduleMetrics: {
    transformer: any;
    providerProtocol: any;
    serverProcessor: any;
  };
}

/**
 * Pipeline流向类型
 */
export type PipelineDirection = 'input' | 'output';

/**
 * Worker Container - 三层流水线管理器
 */
export class WorkerContainer extends EventEmitter implements HotSwappable {
  public readonly workerId: string;
  public readonly providerId: string;
  public readonly model: string;

  private status: WorkerStatus = WorkerStatus.UNINITIALIZED;
  private config: WorkerConfig | null = null;
  private startTime: number = Date.now();

  // 三层流水线模块
  private transformerModule: TransformerModule | null = null;
  private providerProtocolModule: ProviderProtocolModule | null = null;
  private serverProcessorModule: ServerProcessorModule | null = null;

  // 活跃请求跟踪
  private activeRequests = new Set<string>();
  
  // 统计信息
  private metrics: WorkerMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgProcessingTime: 0,
    uptime: 0,
    moduleMetrics: {
      transformer: {},
      providerProtocol: {},
      serverProcessor: {}
    }
  };

  constructor(config: WorkerConfig) {
    super();
    this.workerId = config.workerId;
    this.providerId = config.providerId;
    this.model = config.model;
    this.config = config;
  }

  // ==================== 生命周期管理 ====================

  /**
   * 初始化Worker和所有模块
   */
  public async init(): Promise<boolean> {
    try {
      this.log('info', 'Starting worker initialization', {
        workerId: this.workerId,
        providerId: this.providerId,
        model: this.model
      });

      this.status = WorkerStatus.INITIALIZING;

      // 创建三层流水线模块
      await this.createModules();

      // 初始化所有模块
      await this.initializeModules();

      this.status = WorkerStatus.INITIALIZED;
      this.log('info', 'Worker initialized successfully');

      return true;
    } catch (error) {
      this.status = WorkerStatus.ERROR;
      this.log('error', 'Worker initialization failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  /**
   * 连接所有模块
   */
  public async connect(): Promise<boolean> {
    try {
      if (this.status !== WorkerStatus.INITIALIZED) {
        throw new Error(`Cannot connect from status: ${this.status}`);
      }

      this.log('info', 'Connecting worker modules');
      this.status = WorkerStatus.CONNECTING;

      // 按顺序连接所有模块
      const modules = [
        this.serverProcessorModule,
        this.providerProtocolModule, 
        this.transformerModule
      ];

      for (const module of modules) {
        if (module) {
          const connected = await module.connect();
          if (!connected) {
            throw new Error(`Failed to connect module: ${module.moduleType}`);
          }
        }
      }

      this.status = WorkerStatus.CONNECTED;
      this.log('info', 'Worker connected successfully');

      return true;
    } catch (error) {
      this.status = WorkerStatus.ERROR;
      this.log('error', 'Worker connection failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  /**
   * 断开所有模块连接
   */
  public async disconnect(): Promise<void> {
    try {
      this.log('info', 'Disconnecting worker modules');
      this.status = WorkerStatus.DISCONNECTING;

      // 等待活跃请求完成
      await this.waitForCompletion(5000);

      // 按逆序断开所有模块
      const modules = [
        this.transformerModule,
        this.providerProtocolModule,
        this.serverProcessorModule
      ];

      for (const module of modules) {
        if (module) {
          await module.disconnect();
        }
      }

      this.status = WorkerStatus.DISCONNECTED;
      this.log('info', 'Worker disconnected successfully');
    } catch (error) {
      this.status = WorkerStatus.ERROR;
      this.log('error', 'Worker disconnection failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * 销毁Worker和所有模块
   */
  public async end(): Promise<void> {
    try {
      this.log('info', 'Destroying worker');

      if (this.status === WorkerStatus.CONNECTED) {
        await this.disconnect();
      }

      // 销毁所有模块
      const modules = [
        this.transformerModule,
        this.providerProtocolModule,
        this.serverProcessorModule
      ];

      for (const module of modules) {
        if (module) {
          await module.end();
        }
      }

      // 清理引用
      this.transformerModule = null;
      this.providerProtocolModule = null;
      this.serverProcessorModule = null;

      this.status = WorkerStatus.DESTROYED;
      this.log('info', 'Worker destroyed successfully');
      this.removeAllListeners();
    } catch (error) {
      this.log('error', 'Worker destruction failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  // ==================== 核心处理方法 ====================

  /**
   * 处理输入请求 (Anthropic → Provider)
   */
  public async processInput(input: any, context?: ProcessingContext): Promise<any> {
    const requestId = context?.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      if (this.status !== WorkerStatus.CONNECTED) {
        throw new Error(`Worker not ready (status: ${this.status})`);
      }

      this.activeRequests.add(requestId);
      this.status = WorkerStatus.PROCESSING;
      this.metrics.totalRequests++;

      this.log('debug', 'Processing input request', { 
        requestId, 
        inputType: typeof input 
      });

      // 输入流水线: Server-Processor → Provider-Protocol → Transformer
      let result = input;
      const processingContext = { ...context, requestId, timestamp: startTime };

      // 1. Server-Layer-Processor (预处理)
      if (this.serverProcessorModule) {
        this.log('debug', 'Step 1: Server-Layer-Processor preprocessing', { requestId });
        result = await this.serverProcessorModule.process(result, processingContext);
        result = result.data; // 提取数据部分
      }

      // 2. Provider-Protocol (发送到Provider)
      if (this.providerProtocolModule) {
        this.log('debug', 'Step 2: Provider-Protocol communication', { requestId });
        result = await this.providerProtocolModule.process(result, processingContext);
        result = result.data; // 提取数据部分
      }

      // 注意：输入流水线到这里结束，Transformer在输出流水线中处理

      const processingTime = Date.now() - startTime;
      this.updateMetrics(true, processingTime);
      this.status = WorkerStatus.CONNECTED;

      this.log('debug', 'Input request processed successfully', { 
        requestId, 
        processingTime 
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(false, processingTime);
      this.status = WorkerStatus.CONNECTED;

      this.log('error', 'Input request processing failed', { 
        requestId, 
        error: error instanceof Error ? error.message : String(error),
        processingTime 
      });

      throw error;
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * 处理输出响应 (Provider → Anthropic)
   */
  public async processOutput(output: any, context?: ProcessingContext): Promise<any> {
    const requestId = context?.requestId || `resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      if (this.status !== WorkerStatus.CONNECTED) {
        throw new Error(`Worker not ready (status: ${this.status})`);
      }

      this.activeRequests.add(requestId);
      this.status = WorkerStatus.PROCESSING;

      this.log('debug', 'Processing output response', { 
        requestId, 
        outputType: typeof output 
      });

      // 输出流水线: Provider-Protocol → Transformer → Server-Processor
      let result = output;
      const processingContext = { ...context, requestId, timestamp: startTime };

      // 1. Provider-Protocol (处理Provider响应)
      if (this.providerProtocolModule) {
        this.log('debug', 'Step 1: Provider-Protocol response processing', { requestId });
        result = await this.providerProtocolModule.process(result, processingContext);
        result = result.data; // 提取数据部分
      }

      // 2. Transformer (格式转换)
      if (this.transformerModule) {
        this.log('debug', 'Step 2: Transformer format conversion', { requestId });
        result = await this.transformerModule.process(result, processingContext);
        result = result.data; // 提取数据部分
      }

      // 3. Server-Layer-Processor (后处理)
      if (this.serverProcessorModule) {
        this.log('debug', 'Step 3: Server-Layer-Processor postprocessing', { requestId });
        result = await this.serverProcessorModule.process(result, processingContext);
        result = result.data; // 提取数据部分
      }

      const processingTime = Date.now() - startTime;
      this.updateMetrics(true, processingTime);
      this.status = WorkerStatus.CONNECTED;

      this.log('debug', 'Output response processed successfully', { 
        requestId, 
        processingTime 
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(false, processingTime);
      this.status = WorkerStatus.CONNECTED;

      this.log('error', 'Output response processing failed', { 
        requestId, 
        error: error instanceof Error ? error.message : String(error),
        processingTime 
      });

      throw error;
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  // ==================== 状态和监控 ====================

  /**
   * 获取Worker状态
   */
  public getStatus(): WorkerStatus {
    return this.status;
  }

  /**
   * 检查Worker是否健康
   */
  public isHealthy(): boolean {
    if (this.status !== WorkerStatus.CONNECTED && this.status !== WorkerStatus.PROCESSING) {
      return false;
    }

    // 检查所有模块是否健康
    const modules = [this.transformerModule, this.providerProtocolModule, this.serverProcessorModule];
    return modules.every(module => module === null || module.isHealthy());
  }

  /**
   * 获取Worker统计信息
   */
  public getMetrics(): WorkerMetrics {
    // 更新模块统计信息
    this.metrics.moduleMetrics = {
      transformer: this.transformerModule?.getMetrics() || {},
      providerProtocol: this.providerProtocolModule?.getMetrics() || {},
      serverProcessor: this.serverProcessorModule?.getMetrics() || {}
    };

    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime
    };
  }

  // ==================== 热插拔支持 ====================

  public async prepareForSwap(): Promise<boolean> {
    try {
      this.log('info', 'Preparing worker for hot swap');
      // 停止接受新请求，但不影响正在处理的请求
      return true;
    } catch (error) {
      this.log('error', 'Failed to prepare for swap', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  public canSwapNow(): boolean {
    return this.activeRequests.size === 0;
  }

  public getActiveRequests(): string[] {
    return Array.from(this.activeRequests);
  }

  public async waitForCompletion(timeout: number = 10000): Promise<boolean> {
    const startTime = Date.now();
    
    while (this.activeRequests.size > 0 && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return this.activeRequests.size === 0;
  }

  // ==================== 私有方法 ====================

  /**
   * 创建所有模块实例
   */
  private async createModules(): Promise<void> {
    if (!this.config) {
      throw new Error('Worker config not available');
    }

    // 创建Transformer模块
    this.transformerModule = new TransformerModule(`${this.workerId}-transformer`);

    // 创建Provider-Protocol模块
    this.providerProtocolModule = new ProviderProtocolModule(`${this.workerId}-provider-protocol`);

    // 创建Server-Processor模块
    this.serverProcessorModule = new ServerProcessorModule(`${this.workerId}-server-processor`);

    this.log('info', 'Modules created successfully');
  }

  /**
   * 初始化所有模块
   */
  private async initializeModules(): Promise<void> {
    if (!this.config) {
      throw new Error('Worker config not available');
    }

    const moduleConfig: ModuleConfig = {
      moduleId: `${this.workerId}`,
      moduleType: ModuleType.TRANSFORMER, // 会被每个模块覆盖
      providerId: this.providerId,
      model: this.model,
      config: this.config.providerConfig,
      debugEnabled: this.config.debugEnabled
    };

    // 初始化所有模块
    const modules = [
      this.serverProcessorModule,
      this.providerProtocolModule,
      this.transformerModule
    ];

    for (const module of modules) {
      if (module) {
        const result = await module.init(moduleConfig);
        if (!result.success) {
          throw new Error(`Failed to initialize module ${module.moduleType}: ${result.error}`);
        }
      }
    }

    this.log('info', 'All modules initialized successfully');
  }

  /**
   * 更新统计信息
   */
  private updateMetrics(success: boolean, processingTime: number): void {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // 更新平均处理时间
    const totalRequests = this.metrics.successfulRequests + this.metrics.failedRequests;
    this.metrics.avgProcessingTime = Math.round(
      (this.metrics.avgProcessingTime * (totalRequests - 1) + processingTime) / totalRequests
    );
  }

  /**
   * 日志记录
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      workerId: this.workerId,
      providerId: this.providerId,
      model: this.model,
      message,
      data
    };

    // 发出日志事件
    this.emit('log', logEntry);

    // 简单的控制台输出 (在实际实现中应该使用proper logger)
    if (level === 'error') {
      console.error(`[${this.workerId}] ${message}`, data || '');
    } else if (level === 'warn') {
      console.warn(`[${this.workerId}] ${message}`, data || '');
    } else if (level === 'info') {
      console.info(`[${this.workerId}] ${message}`, data || '');
    } else {
      console.debug(`[${this.workerId}] ${message}`, data || '');
    }
  }
}