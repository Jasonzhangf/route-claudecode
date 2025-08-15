/**
 * Pipeline管理器核心实现
 * 
 * 负责Pipeline的创建、执行、监控和销毁
 * 
 * @author Jason Zhang
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

/**
 * Pipeline管理器
 */
export class PipelineManager extends EventEmitter {
  private pipelines: Map<string, StandardPipeline> = new Map();
  private activeExecutions: Map<string, ExecutionRecord> = new Map();
  private factory: StandardPipelineFactory;
  
  constructor(factory: StandardPipelineFactory) {
    super();
    this.factory = factory;
  }
  
  /**
   * 创建Pipeline
   */
  async createPipeline(config: PipelineConfig): Promise<string> {
    try {
      const pipeline = await this.factory.createStandardPipeline(config) as StandardPipeline;
      this.pipelines.set(config.id, pipeline);
      
      // 设置Pipeline事件监听
      this.setupPipelineEventListeners(pipeline, config.id);
      
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
  getPipeline(pipelineId: string): StandardPipeline | null {
    return this.pipelines.get(pipelineId) || null;
  }
  
  /**
   * 获取所有Pipeline
   */
  getAllPipelines(): Map<string, StandardPipeline> {
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
      
      const result = await pipeline.execute(input, context);
      
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
    
    return pipeline.getExecutionHistory();
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
    pipeline.on('moduleExecutionStarted', (data) => {
      this.emit('moduleExecutionStarted', { pipelineId, ...data });
    });
    
    pipeline.on('moduleExecutionCompleted', (data) => {
      this.emit('moduleExecutionCompleted', { pipelineId, ...data });
    });
    
    pipeline.on('moduleExecutionFailed', (data) => {
      this.emit('moduleExecutionFailed', { pipelineId, ...data });
    });
    
    pipeline.on('statusChanged', (data) => {
      this.emit('pipelineStatusChanged', { pipelineId, ...data });
    });
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
        peak: 0, // TODO: 实现CPU使用率监控
        average: 0
      },
      throughput: totalTime > 0 ? 1000 / totalTime : 0,
      errorCount
    };
  }
}