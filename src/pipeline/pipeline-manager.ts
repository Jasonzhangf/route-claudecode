/**
 * Pipeline管理器核心实现
 * 
 * 负责Pipeline的创建、执行、监控和销毁
 * 
 * RCC v4.0 架构更新:
 * - 初始化时创建所有流水线 (Provider.Model.APIKey组合)
 * - 每条流水线在初始化时完成握手连接
 * - Runtime状态管理和零Fallback策略
 * 
 * @author Jason Zhang
 * @author RCC v4.0
 */

import { EventEmitter } from 'events';
import { 
  PipelineFramework, 
  PipelineConfig, 
  ExecutionContext, 
  ExecutionResult,
  ExecutionRecord,
  ModuleExecutionRecord,
  PerformanceMetrics,
  StandardPipelineFactory
} from '../interfaces/pipeline/pipeline-framework';
import { ModuleInterface, ModuleType, ModuleStatus, PipelineSpec } from '../interfaces/module/base-module';
import { StandardPipeline } from './standard-pipeline';
import { Pipeline, PipelineStatus } from '../interfaces/module/pipeline-module';
import { RoutingTable, PipelineRoute } from '../interfaces/router/request-router';
import { secureLogger } from '../utils/secure-logger';

/**
 * 完整流水线定义 (RCC v4.0)
 */
export interface CompletePipeline {
  readonly pipelineId: string;
  readonly virtualModel: string;
  readonly provider: string;
  readonly targetModel: string;
  readonly apiKey: string;
  
  // 4层架构组件（初始化时已创建并连接）
  readonly transformer: ModuleInterface;
  readonly protocol: ModuleInterface;
  readonly serverCompatibility: ModuleInterface;
  readonly server: ModuleInterface;
  
  status: 'initializing' | 'runtime' | 'error' | 'stopped';
  lastHandshakeTime: Date;
  
  execute(request: any): Promise<any>;
  handshake(): Promise<void>;
  healthCheck(): Promise<boolean>;
  getStatus(): PipelineStatus;
  stop(): Promise<void>;
}

/**
 * 流水线创建配置 (RCC v4.0)
 */
export interface CompletePipelineConfig {
  pipelineId: string;
  virtualModel: string;
  provider: string;
  targetModel: string;
  apiKey: string;
  endpoint: string;
  transformer: string;
  protocol: string;
  serverCompatibility: string;
}

/**
 * Pipeline管理器
 */
export class PipelineManager extends EventEmitter {
  private pipelines: Map<string, CompletePipeline> = new Map();
  private activeExecutions: Map<string, ExecutionRecord> = new Map();
  private factory: StandardPipelineFactory;
  private systemConfig: {
    providerTypes: Record<string, {
      endpoint: string;
      protocol: string;
      transformer: string;
      serverCompatibility: string;
      timeout?: number;
      maxRetries?: number;
    }>;
    transformers?: Record<string, any>;
    serverCompatibilityModules?: Record<string, any>;
  };
  private isInitialized: boolean = false;
  
  constructor(factory: StandardPipelineFactory, systemConfig?: any) {
    super();
    this.factory = factory;
    this.systemConfig = systemConfig;
  }

  /**
   * 初始化流水线系统 - 从Routing Table创建所有流水线 (RCC v4.0)
   */
  async initializeFromRoutingTable(routingTable: RoutingTable): Promise<void> {
    secureLogger.info('🔧 Initializing all pipelines from routing table...');
    
    if (this.isInitialized) {
      secureLogger.warn('⚠️  Pipeline Manager already initialized');
      return;
    }

    const createdPipelines: string[] = [];
    const seenProviderModels = new Set<string>();

    try {
      for (const [virtualModel, routes] of Object.entries(routingTable.routes)) {
        for (const route of routes) {
          const providerModel = `${route.provider}-${route.targetModel}`;
          
          // 避免重复创建相同的Provider.Model流水线
          if (seenProviderModels.has(providerModel)) {
            continue;
          }
          seenProviderModels.add(providerModel);

          if (!this.systemConfig?.providerTypes?.[route.provider]) {
            throw new Error(`Provider type '${route.provider}' not found in system config`);
          }

          const providerType = this.systemConfig.providerTypes[route.provider];

          // 为每个APIKey创建一条独立流水线
          for (let keyIndex = 0; keyIndex < route.apiKeys.length; keyIndex++) {
            const pipelineId = `${route.provider}-${route.targetModel}-key${keyIndex}`;

            secureLogger.info(`  🔨 Creating pipeline: ${pipelineId}`);
            secureLogger.info(`     - Virtual Model: ${virtualModel}`);
            secureLogger.info(`     - Provider: ${route.provider}`);
            secureLogger.info(`     - Target Model: ${route.targetModel}`);
            secureLogger.info(`     - API Key Index: ${keyIndex}`);

            // 创建完整的4层流水线
            const completePipeline = await this.createCompletePipeline({
              pipelineId,
              virtualModel,
              provider: route.provider,
              targetModel: route.targetModel,
              apiKey: route.apiKeys[keyIndex],
              endpoint: providerType.endpoint,
              transformer: providerType.transformer,
              protocol: providerType.protocol,
              serverCompatibility: providerType.serverCompatibility
            });

            // 执行握手连接
            secureLogger.info(`  🤝 Handshaking pipeline: ${pipelineId}`);
            await completePipeline.handshake();

            // 标记为runtime状态
            completePipeline.status = 'runtime';
            this.pipelines.set(pipelineId, completePipeline);
            createdPipelines.push(pipelineId);

            secureLogger.info(`  ✅ Pipeline ready: ${pipelineId}`);
          }
        }
      }

      this.isInitialized = true;
      secureLogger.info(`🎉 All ${this.pipelines.size} pipelines initialized and ready`);
      this.emit('pipelineSystemInitialized', { 
        totalPipelines: this.pipelines.size,
        createdPipelines,
        timestamp: new Date()
      });

    } catch (error) {
      secureLogger.error('❌ Pipeline system initialization failed:', { error: error.message });
      
      // 清理已创建的流水线
      for (const pipelineId of createdPipelines) {
        await this.destroyPipeline(pipelineId).catch(() => {}); // 忽略清理错误
      }
      
      this.emit('pipelineSystemInitializationFailed', { error: error.message, timestamp: new Date() });
      throw error;
    }
  }

  /**
   * 创建完整流水线 (Provider.Model.APIKey组合)
   */
  private async createCompletePipeline(config: CompletePipelineConfig): Promise<CompletePipeline> {
    secureLogger.info(`🏗️  Creating complete pipeline: ${config.pipelineId}`);

    // 根据Provider类型创建对应的流水线
    let standardPipeline: StandardPipeline;
    
    if (config.provider === 'lmstudio') {
      standardPipeline = await this.factory.createLMStudioPipeline(config.targetModel) as StandardPipeline;
    } else if (config.provider === 'openai') {
      standardPipeline = await this.factory.createOpenAIPipeline(config.targetModel) as StandardPipeline;
    } else if (config.provider === 'anthropic') {
      standardPipeline = await this.factory.createAnthropicPipeline(config.targetModel) as StandardPipeline;
    } else {
      // 使用通用方法创建
      const pipelineConfig: PipelineConfig = {
        id: config.pipelineId,
        name: `${config.provider} Pipeline - ${config.targetModel}`,
        description: `Complete pipeline for ${config.provider}.${config.targetModel}`,
        provider: config.provider,
        model: config.targetModel,
        modules: [], // 模块将由factory根据provider类型填充
        settings: {
          parallel: false,
          failFast: true,
          timeout: 60000,
          retryPolicy: {
            enabled: true,
            maxRetries: 3,
            backoffMultiplier: 2,
            initialDelay: 1000,
            maxDelay: 10000,
            retryableErrors: ['TIMEOUT', 'CONNECTION_ERROR', 'RATE_LIMIT']
          },
          errorHandling: {
            stopOnFirstError: true,
            allowPartialSuccess: false,
            errorRecovery: false,
            fallbackStrategies: []
          },
          logging: {
            enabled: true,
            level: 'info',
            includeInput: false,
            includeOutput: false,
            maskSensitiveData: true,
            maxLogSize: 1024 * 1024
          },
          monitoring: {
            enabled: true,
            collectMetrics: true,
            performanceTracking: true,
            alerting: {
              enabled: false,
              thresholds: {
                errorRate: 0.1,
                responseTime: 5000,
                throughput: 10
              },
              channels: []
            }
          }
        }
      };
      
      standardPipeline = await this.factory.createStandardPipeline(pipelineConfig) as StandardPipeline;
    }

    // 包装成CompletePipeline接口
    const completePipeline: CompletePipeline = {
      pipelineId: config.pipelineId,
      virtualModel: config.virtualModel,
      provider: config.provider,
      targetModel: config.targetModel,
      apiKey: config.apiKey,
      transformer: standardPipeline.getModule('transformer') || standardPipeline.getAllModules()[0],
      protocol: standardPipeline.getModule('protocol') || standardPipeline.getAllModules()[1],
      serverCompatibility: standardPipeline.getModule('serverCompatibility') || standardPipeline.getAllModules()[2],
      server: standardPipeline.getModule('server') || standardPipeline.getAllModules()[3],
      status: 'initializing',
      lastHandshakeTime: new Date(),

      async execute(request: any): Promise<any> {
        secureLogger.info(`🔄 Pipeline ${this.pipelineId} executing request`);
        
        try {
          // 使用StandardPipeline的execute方法，它已经实现了完整的4层处理
          const response = await standardPipeline.execute(request, { 
            requestId: `req_${Date.now()}`,
            priority: 'normal' as const,
            metadata: {
              pipelineId: this.pipelineId,
              provider: this.provider,
              model: this.targetModel
            }
          });

          secureLogger.info(`  ✅ Pipeline ${this.pipelineId} execution completed`);
          return response;

        } catch (error) {
          secureLogger.error(`  ❌ Pipeline ${this.pipelineId} execution failed:`, { error: error.message });
          throw error;
        }
      },

      async handshake(): Promise<void> {
        secureLogger.info(`🤝 Handshaking pipeline ${this.pipelineId}`);

        try {
          // 启动StandardPipeline，这会初始化所有模块
          await standardPipeline.start();

          // 验证连接
          const healthCheck = await this.healthCheck();
          if (!healthCheck) {
            throw new Error(`Pipeline ${this.pipelineId} handshake failed`);
          }

          this.lastHandshakeTime = new Date();
          secureLogger.info(`✅ Pipeline ${this.pipelineId} handshake completed`);

        } catch (error) {
          secureLogger.error(`❌ Pipeline ${this.pipelineId} handshake failed:`, { error: error.message });
          this.status = 'error';
          throw error;
        }
      },

      async healthCheck(): Promise<boolean> {
        try {
          // 使用StandardPipeline的状态检查
          const status = standardPipeline.getStatus();
          return status.status === 'running';
        } catch (error) {
          secureLogger.error(`Health check failed for pipeline ${this.pipelineId}:`, { error: error.message });
          return false;
        }
      },

      getStatus(): PipelineStatus {
        // 使用StandardPipeline的状态，转换为CompletePipeline需要的格式
        const baseStatus = standardPipeline.getStatus();
        return {
          id: this.pipelineId,
          name: this.pipelineId,
          status: baseStatus.status,
          modules: {},  // 简化模块状态
          uptime: Date.now() - this.lastHandshakeTime.getTime(),
          performance: {
            requestsProcessed: baseStatus.totalRequests,
            averageProcessingTime: baseStatus.averageResponseTime,
            errorRate: baseStatus.totalRequests > 0 ? baseStatus.errorRequests / baseStatus.totalRequests : 0,
            throughput: baseStatus.totalRequests
          }
        };
      },

      async stop(): Promise<void> {
        secureLogger.info(`🛑 Stopping pipeline ${this.pipelineId}`);
        
        try {
          await standardPipeline.stop();
          this.status = 'stopped';
          secureLogger.info(`✅ Pipeline ${this.pipelineId} stopped`);
          
        } catch (error) {
          secureLogger.error(`❌ Pipeline ${this.pipelineId} stop failed:`, { error: error.message });
          this.status = 'error';
          throw error;
        }
      }
    };

    return completePipeline;
  }

  /**
   * 检查系统是否已初始化
   */
  isSystemInitialized(): boolean {
    return this.isInitialized;
  }
  
  /**
   * 创建Pipeline (传统方法，保留向后兼容)
   */
  async createPipeline(config: PipelineConfig): Promise<string> {
    try {
      const pipeline = await this.factory.createStandardPipeline(config) as StandardPipeline;
      
      // 创建一个临时的CompletePipeline包装器以保持类型一致性
      const completePipelineWrapper: CompletePipeline = {
        pipelineId: config.id,
        virtualModel: 'legacy',
        provider: config.provider,
        targetModel: config.model,
        apiKey: 'legacy-key',
        transformer: pipeline.getAllModules()[0],
        protocol: pipeline.getAllModules()[1] || pipeline.getAllModules()[0],
        serverCompatibility: pipeline.getAllModules()[2] || pipeline.getAllModules()[0],
        server: pipeline.getAllModules()[3] || pipeline.getAllModules()[0],
        status: 'runtime',
        lastHandshakeTime: new Date(),
        async execute(request: any): Promise<any> {
          return await pipeline.execute(request);
        },
        async handshake(): Promise<void> {
          await pipeline.start();
        },
        async healthCheck(): Promise<boolean> {
          const status = pipeline.getStatus();
          return status.status === 'running';
        },
        getStatus(): PipelineStatus {
          const baseStatus = pipeline.getStatus();
          return {
            id: config.id,
            name: config.name,
            status: baseStatus.status,
            modules: {},
            uptime: 0,
            performance: {
              requestsProcessed: baseStatus.totalRequests,
              averageProcessingTime: baseStatus.averageResponseTime,
              errorRate: 0,
              throughput: 0
            }
          };
        },
        async stop(): Promise<void> {
          await pipeline.stop();
        }
      };
      
      this.pipelines.set(config.id, completePipelineWrapper);
      
      this.emit('pipelineCreated', { pipelineId: config.id, config });
      return config.id;
    } catch (error) {
      this.emit('pipelineCreationFailed', { config, error });
      throw error;
    }
  }
  
  /**
   * 销毁Pipeline
   */
  async destroyPipeline(pipelineId: string): Promise<boolean> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      return false;
    }
    
    try {
      // 取消所有活跃的执行
      const activeExecutions = Array.from(this.activeExecutions.values())
        .filter(execution => execution.pipelineId === pipelineId);
      
      for (const execution of activeExecutions) {
        await this.cancelExecution(execution.id);
      }
      
      // 停止Pipeline
      await pipeline.stop();
      
      // 清理资源
      this.pipelines.delete(pipelineId);
      
      this.emit('pipelineDestroyed', { pipelineId });
      return true;
    } catch (error) {
      this.emit('pipelineDestructionFailed', { pipelineId, error });
      throw error;
    }
  }
  
  /**
   * 获取Pipeline
   */
  getPipeline(pipelineId: string): CompletePipeline | null {
    return this.pipelines.get(pipelineId) || null;
  }
  
  /**
   * 获取所有Pipeline
   */
  getAllPipelines(): Map<string, CompletePipeline> {
    return new Map(this.pipelines);
  }
  
  /**
   * 执行Pipeline
   */
  async executePipeline(
    pipelineId: string, 
    input: any, 
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }
    
    const executionId = this.generateExecutionId();
    const executionRecord: ExecutionRecord = {
      id: executionId,
      pipelineId,
      requestId: context.requestId,
      startTime: new Date(),
      status: 'running',
      moduleExecutions: []
    };
    
    this.activeExecutions.set(executionId, executionRecord);
    
    try {
      this.emit('executionStarted', { executionId, pipelineId, context });
      
      const result = await pipeline.execute(input);
      
      executionRecord.endTime = new Date();
      executionRecord.status = 'completed';
      executionRecord.totalTime = executionRecord.endTime.getTime() - executionRecord.startTime.getTime();
      
      const executionResult: ExecutionResult = {
        executionId,
        status: 'success',
        result,
        executionRecord,
        performance: this.calculatePerformanceMetrics(executionRecord)
      };
      
      this.emit('executionCompleted', { executionResult });
      this.activeExecutions.delete(executionId);
      
      return executionResult;
      
    } catch (error) {
      executionRecord.endTime = new Date();
      executionRecord.status = 'failed';
      executionRecord.error = error as Error;
      executionRecord.totalTime = executionRecord.endTime.getTime() - executionRecord.startTime.getTime();
      
      const executionResult: ExecutionResult = {
        executionId,
        status: 'failure',
        error: error as Error,
        executionRecord,
        performance: this.calculatePerformanceMetrics(executionRecord)
      };
      
      this.emit('executionFailed', { executionResult });
      this.activeExecutions.delete(executionId);
      
      throw error;
    }
  }
  
  /**
   * 取消执行
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return false;
    }
    
    const pipeline = this.pipelines.get(execution.pipelineId);
    if (!pipeline) {
      return false;
    }
    
    try {
      execution.status = 'cancelled';
      execution.endTime = new Date();
      execution.totalTime = execution.endTime.getTime() - execution.startTime.getTime();
      
      this.emit('executionCancelled', { executionId });
      this.activeExecutions.delete(executionId);
      
      return true;
    } catch (error) {
      this.emit('executionCancellationFailed', { executionId, error });
      return false;
    }
  }
  
  /**
   * 获取Pipeline状态
   */
  getPipelineStatus(pipelineId: string): PipelineStatus | null {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      return null;
    }
    
    return pipeline.getStatus();
  }
  
  /**
   * 获取所有Pipeline状态
   */
  getAllPipelineStatus(): Record<string, PipelineStatus> {
    const status: Record<string, PipelineStatus> = {};
    
    for (const [pipelineId, pipeline] of this.pipelines) {
      status[pipelineId] = pipeline.getStatus();
    }
    
    return status;
  }
  
  /**
   * 获取活跃执行
   */
  getActiveExecutions(): ExecutionRecord[] {
    return Array.from(this.activeExecutions.values());
  }
  
  /**
   * 获取Pipeline执行历史
   */
  getExecutionHistory(pipelineId: string): ExecutionRecord[] {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      return [];
    }
    
    // CompletePipeline接口没有getExecutionHistory方法，返回空数组
    // 实际的执行历史记录由PipelineManager在activeExecutions中维护
    return [];
  }
  
  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    pipelines: number;
    activeExecutions: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    let healthyPipelines = 0;
    
    for (const [pipelineId, pipeline] of this.pipelines) {
      try {
        const status = pipeline.getStatus();
        if (status.status === 'running') {
          healthyPipelines++;
        } else {
          issues.push(`Pipeline ${pipelineId} is in ${status.status} status`);
        }
      } catch (error) {
        issues.push(`Pipeline ${pipelineId} health check failed: ${error}`);
      }
    }
    
    return {
      healthy: issues.length === 0,
      pipelines: this.pipelines.size,
      activeExecutions: this.activeExecutions.size,
      issues
    };
  }
  
  /**
   * 设置Pipeline事件监听器
   */
  private setupPipelineEventListeners(pipeline: StandardPipeline, pipelineId: string): void {
    // CompletePipeline wrapper不需要事件监听器设置
    // 事件将由StandardPipeline内部处理
  }
  
  /**
   * 生成执行ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 计算性能指标
   */
  private calculatePerformanceMetrics(execution: ExecutionRecord): PerformanceMetrics {
    const modulesTiming: Record<string, number> = {};
    let totalTime = execution.totalTime || 0;
    let errorCount = 0;
    
    for (const moduleExecution of execution.moduleExecutions) {
      if (moduleExecution.processingTime) {
        modulesTiming[moduleExecution.moduleId] = moduleExecution.processingTime;
      }
      
      if (moduleExecution.status === 'failed') {
        errorCount++;
      }
    }
    
    return {
      totalTime,
      modulesTiming,
      memoryUsage: {
        peak: process.memoryUsage().heapUsed,
        average: process.memoryUsage().heapUsed
      },
      cpuUsage: {
        peak: process.cpuUsage().system / 1000000, // 转换为毫秒
        average: process.cpuUsage().user / 1000000 // 转换为毫秒
      },
      throughput: totalTime > 0 ? 1000 / totalTime : 0,
      errorCount
    };
  }
}