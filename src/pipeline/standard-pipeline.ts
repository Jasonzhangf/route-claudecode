/**
 * 标准流水线实现
 * 
 * RCC v4.0核心流水线执行引擎
 * 
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { 
  ModuleInterface,
  ModuleType,
  ModuleStatus,
  PipelineSpec,
  PipelineFramework,
  ExecutionRecord,
  ModuleExecutionRecord,
  Pipeline,
  PipelineStatus
} from '../interfaces/pipeline/pipeline-framework';

/**
 * Pipeline配置接口
 */
export interface PipelineConfig {
  id: string;
  name: string;
  provider: string;
  model: string;
  modules: Array<{
    moduleId: string;
    order: number;
    config: any;
  }>;
}

/**
 * 执行上下文
 */
export interface ExecutionContext {
  metadata?: any;
  configuration?: any;
  timeout?: number;
}

/**
 * 标准流水线实现
 */
export class StandardPipeline extends EventEmitter implements PipelineFramework {
  readonly id: string;
  private readonly name: string;
  private readonly config: PipelineConfig;
  private moduleMap: Map<string, ModuleInterface> = new Map();
  private moduleOrder: string[] = [];
  private status: PipelineStatus['status'] = 'stopped';
  private executionHistory: ExecutionRecord[] = [];

  constructor(config: PipelineConfig) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.config = config;
    
    // 初始化模块顺序
    this.moduleOrder = config.modules
      .sort((a, b) => a.order - b.order)
      .map(m => m.moduleId);
  }

  // Pipeline接口实现
  get provider(): string {
    return this.config.provider;
  }

  get model(): string {
    return this.config.model;
  }

  get modules(): ModuleInterface[] {
    return Array.from(this.moduleMap.values());
  }

  get spec(): PipelineSpec {
    return {
      id: this.id,
      name: this.name,
      description: `Pipeline for ${this.config.provider} ${this.config.model}`,
      version: '1.0.0',
      provider: this.config.provider,
      model: this.config.model,
      modules: this.moduleOrder.map(moduleId => ({ id: moduleId })),
      configuration: {
        parallel: false,
        failFast: true,
        retryPolicy: {
          maxRetries: 3,
          backoffMultiplier: 1.5
        }
      },
      metadata: {
        author: 'RCC v4.0',
        created: Date.now(),
        tags: [this.config.provider, this.config.model]
      }
    };
  }

  /**
   * 处理请求
   */
  async process(input: any): Promise<any> {
    const context: ExecutionContext = {
      metadata: { timestamp: new Date() },
      configuration: this.config,
      timeout: 30000
    };
    
    return this.execute(input, context);
  }

  /**
   * 验证流水线
   */
  async validate(): Promise<boolean> {
    try {
      if (this.moduleMap.size === 0) {
        return false;
      }
      
      for (const [, module] of this.moduleMap) {
        const status = module.getStatus();
        if (status.health !== 'healthy') {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取状态
   */
  getStatus(): PipelineStatus {
    const moduleStatuses: Record<string, ModuleStatus> = {};
    for (const [moduleId, module] of this.moduleMap) {
      moduleStatuses[moduleId] = module.getStatus();
    }
    
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      modules: moduleStatuses,
      lastExecution: this.executionHistory.length > 0 ? 
        this.executionHistory[this.executionHistory.length - 1] : undefined,
      uptime: 0,
      performance: {
        requestsProcessed: this.executionHistory.length,
        averageProcessingTime: 0,
        errorRate: 0,
        throughput: 0
      }
    };
  }

  /**
   * 启动流水线
   */
  async start(): Promise<void> {
    if (this.status === 'running') {
      return;
    }
    
    this.status = 'starting';
    this.emit('statusChanged', { status: this.status });
    
    try {
      // 启动所有模块
      for (const [, module] of this.moduleMap) {
        if (typeof module.start === 'function') {
          await module.start();
        }
      }
      
      this.status = 'running';
      this.emit('statusChanged', { status: this.status });
    } catch (error) {
      this.status = 'error';
      this.emit('statusChanged', { status: this.status });
      throw error;
    }
  }

  /**
   * 停止流水线
   */
  async stop(): Promise<void> {
    if (this.status === 'stopped') {
      return;
    }
    
    this.status = 'stopping';
    this.emit('statusChanged', { status: this.status });
    
    try {
      for (const [, module] of this.moduleMap) {
        if (typeof module.stop === 'function') {
          await module.stop();
        }
      }
      
      this.status = 'stopped';
      this.emit('statusChanged', { status: this.status });
      this.emit('stopped', { pipelineId: this.id });
    } catch (error) {
      this.status = 'error';
      this.emit('statusChanged', { status: this.status });
      throw error;
    }
  }

  /**
   * 销毁流水线
   */
  async destroy(): Promise<void> {
    await this.stop();
    
    // 清理模块（如果有destroy方法）
    for (const [, module] of this.moduleMap) {
      if ('destroy' in module && typeof module.destroy === 'function') {
        await (module as any).destroy();
      }
    }
    
    this.moduleMap.clear();
    this.moduleOrder = [];
    this.executionHistory = [];
    this.removeAllListeners();
  }

  // PipelineFramework接口实现

  /**
   * 添加模块
   */
  addModule(module: ModuleInterface): void {
    this.moduleMap.set(module.getId(), module);
    this.setupModuleEventListeners(module);
  }

  /**
   * 移除模块
   */
  removeModule(moduleId: string): void {
    const module = this.moduleMap.get(moduleId);
    if (module) {
      this.moduleMap.delete(moduleId);
      this.moduleOrder = this.moduleOrder.filter(id => id !== moduleId);
    }
  }

  /**
   * 获取模块
   */
  getModule(moduleId: string): ModuleInterface | null {
    return this.moduleMap.get(moduleId) || null;
  }

  /**
   * 获取所有模块
   */
  getAllModules(): ModuleInterface[] {
    return Array.from(this.moduleMap.values());
  }

  /**
   * 设置模块顺序
   */
  setModuleOrder(moduleIds: string[]): void {
    this.moduleOrder = moduleIds;
  }

  /**
   * 执行单个模块
   */
  async executeModule(moduleId: string, input: any): Promise<any> {
    const module = this.moduleMap.get(moduleId);
    if (!module) {
      throw new Error(`Module ${moduleId} not found`);
    }
    
    return await module.process(input);
  }

  /**
   * 执行流水线
   */
  async execute(input: any, context?: ExecutionContext): Promise<any> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const executionRecord: ExecutionRecord = {
      id: executionId,
      pipelineId: this.id,
      requestId: context?.metadata?.requestId || executionId,
      startTime: new Date(),
      status: 'running',
      moduleExecutions: []
    };

    this.executionHistory.push(executionRecord);
    this.emit('executionStarted', { executionRecord });

    try {
      let currentInput = input;
      
      // 按顺序执行所有模块
      for (const moduleId of this.moduleOrder) {
        const module = this.moduleMap.get(moduleId);
        if (!module) {
          throw new Error(`Module ${moduleId} not found`);
        }
        
        const moduleStart = new Date();
        const result = await module.process(currentInput);
        
        const moduleExecution: ModuleExecutionRecord = {
          moduleId,
          moduleName: module.getName(),
          startTime: moduleStart,
          endTime: new Date(),
          status: 'completed',
          input: currentInput,
          output: result,
          processingTime: Date.now() - moduleStart.getTime()
        };
        
        executionRecord.moduleExecutions.push(moduleExecution);
        this.emit('moduleExecutionCompleted', { moduleExecution });
        
        currentInput = result;
      }

      executionRecord.endTime = new Date();
      executionRecord.status = 'completed';
      executionRecord.totalTime = executionRecord.endTime.getTime() - executionRecord.startTime.getTime();

      this.emit('executionCompleted', { executionRecord });
      return currentInput;

    } catch (error) {
      executionRecord.endTime = new Date();
      executionRecord.status = 'failed';
      executionRecord.error = error as Error;
      executionRecord.totalTime = executionRecord.endTime.getTime() - executionRecord.startTime.getTime();

      this.emit('executionFailed', { executionRecord, error });
      throw error;
    }
  }

  /**
   * 获取执行历史
   */
  getExecutionHistory(): ExecutionRecord[] {
    return [...this.executionHistory];
  }

  /**
   * 重置流水线
   */
  async reset(): Promise<void> {
    await this.stop();
    this.executionHistory = [];
    
    for (const [, module] of this.moduleMap) {
      if ('reset' in module && typeof module.reset === 'function') {
        await (module as any).reset();
      }
    }
  }

  /**
   * 设置模块事件监听器
   */
  private setupModuleEventListeners(module: ModuleInterface): void {
    module.on('statusChanged', (data) => {
      this.emit('moduleStatusChanged', { 
        moduleId: module.getId(), 
        ...data 
      });
    });
    
    module.on('error', (data) => {
      this.emit('moduleError', { 
        moduleId: module.getId(), 
        ...data 
      });
    });
  }
}