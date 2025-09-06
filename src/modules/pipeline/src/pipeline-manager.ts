/**
 * Pipeline管理器
 * 
 * 管理已组装流水线的生命周期、健康检查和执行调度
 * 
 * @author Claude Code Router v4.0
 */

import { AssembledPipeline } from './assembly-types';
import { ModuleInterface } from './module-interface';
import { secureLogger } from '../../error-handler/src/utils/secure-logger';
import { JQJsonHandler } from '../../error-handler/src/utils/jq-json-handler';
import { RCCError, RCCErrorCode, EnhancedErrorHandler } from '../../error-handler';
import { ModuleDebugIntegration } from '../../logging/src/debug-integration';

/**
 * 流水线管理器配置
 */
export interface PipelineManagerConfig {
  healthCheckInterval?: number;
  cleanupInterval?: number;
  maxInactiveTime?: number;
  enableAutoScaling?: boolean;
  maxPipelines?: number;
}

/**
 * 流水线状态信息
 */
export interface PipelineStatus {
  pipelineId: string;
  status: 'active' | 'inactive' | 'error' | 'stopped';
  health: 'healthy' | 'degraded' | 'unhealthy';
  lastUsed?: Date;
  executionCount: number;
  errorCount: number;
  averageResponseTime: number;
}

/**
 * 流水线管理器统计信息
 */
export interface PipelineManagerStats {
  totalPipelines: number;
  activePipelines: number;
  healthyPipelines: number;
  totalExecutions: number;
  totalErrors: number;
  averageResponseTime: number;
  uptime: number;
}

/**
 * Pipeline管理器
 */
export class PipelineManager {
  private pipelines: Map<string, AssembledPipeline> = new Map();
  private pipelineStatus: Map<string, PipelineStatus> = new Map();
  private config: PipelineManagerConfig;
  private isDestroyed: boolean = false;
  private healthCheckIntervalId: NodeJS.Timeout | null = null;
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  private startTime: Date;
  private totalExecutions: number = 0;
  private totalErrors: number = 0;
  private totalResponseTime: number = 0;
  private errorHandler: EnhancedErrorHandler = new EnhancedErrorHandler();
  private debugIntegration: ModuleDebugIntegration = new ModuleDebugIntegration({
    moduleId: 'pipeline-manager',
    moduleName: 'PipelineManager',
    enabled: true,
    captureLevel: 'full'
  });

  constructor(config?: PipelineManagerConfig) {
    this.config = {
      healthCheckInterval: 60000, // 1分钟
      cleanupInterval: 300000, // 5分钟
      maxInactiveTime: 3600000, // 1小时
      enableAutoScaling: true,
      maxPipelines: 100,
      ...config
    };
    
    this.startTime = new Date();
    
    // 启动健康检查和清理任务
    this.startHealthChecks();
    this.startCleanupTask();
  }

  /**
   * 添加流水线
   */
  addPipeline(pipeline: AssembledPipeline): boolean {
    if (this.isDestroyed) {
      secureLogger.warn('Cannot add pipeline to destroyed manager', { pipelineId: pipeline.pipelineId });
      return false;
    }

    if (this.pipelines.size >= (this.config.maxPipelines || 100)) {
      secureLogger.warn('Pipeline limit reached, cannot add new pipeline', { 
        pipelineId: pipeline.pipelineId,
        currentCount: this.pipelines.size,
        maxCount: this.config.maxPipelines
      });
      return false;
    }

    this.pipelines.set(pipeline.pipelineId, pipeline);
    
    // 初始化状态信息
    this.pipelineStatus.set(pipeline.pipelineId, {
      pipelineId: pipeline.pipelineId,
      status: 'active',
      health: pipeline.health,
      executionCount: 0,
      errorCount: 0,
      averageResponseTime: 0
    });

    secureLogger.info('Pipeline added to manager', { pipelineId: pipeline.pipelineId });
    return true;
  }

  /**
   * 获取流水线
   */
  getPipeline(pipelineId: string): AssembledPipeline | undefined {
    return this.pipelines.get(pipelineId);
  }

  /**
   * 移除流水线
   */
  removePipeline(pipelineId: string): boolean {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      return false;
    }

    // 清理流水线资源
    this.cleanupPipeline(pipeline);
    
    this.pipelines.delete(pipelineId);
    this.pipelineStatus.delete(pipelineId);
    
    secureLogger.info('Pipeline removed from manager', { pipelineId });
    return true;
  }

  /**
   * 销毁流水线
   */
  async destroyPipeline(pipelineId: string): Promise<boolean> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      return false;
    }

    try {
      // 停止流水线中的所有模块
      for (const module of pipeline.modules) {
        if (module.instance && module.isInitialized) {
          try {
            await module.instance.stop();
            await module.instance.cleanup();
          } catch (error) {
            secureLogger.warn('Failed to stop/cleanup module', { 
              moduleName: module.name, 
              error: error.message || 'Unknown error'
            });
          }
        }
      }
      
      // 更新状态
      pipeline.assemblyStatus = 'failed';
      pipeline.isActive = false;
      pipeline.health = 'unhealthy';
      
      // 从管理器中移除
      this.removePipeline(pipelineId);
      
      secureLogger.info('Pipeline destroyed successfully', { pipelineId });
      return true;
    } catch (error) {
      secureLogger.error('Failed to destroy pipeline', { 
        pipelineId, 
        error: error.message || 'Unknown error'
      });
      return false;
    }
  }

  /**
   * 获取所有流水线
   */
  getAllPipelines(): Map<string, AssembledPipeline> {
    return new Map(this.pipelines);
  }

  /**
   * 获取流水线状态
   */
  getPipelineStatus(pipelineId: string): PipelineStatus | undefined {
    return this.pipelineStatus.get(pipelineId);
  }

  /**
   * 获取所有流水线状态
   */
  getAllPipelineStatus(): Record<string, PipelineStatus> {
    const status: Record<string, PipelineStatus> = {};
    for (const [pipelineId, pipelineStatus] of this.pipelineStatus) {
      status[pipelineId] = { ...pipelineStatus };
    }
    return status;
  }

  /**
   * 更新流水线健康状态
   */
  updatePipelineHealth(pipelineId: string, health: 'healthy' | 'degraded' | 'unhealthy'): boolean {
    const status = this.pipelineStatus.get(pipelineId);
    if (!status) {
      return false;
    }

    status.health = health;
    
    // 更新对应的流水线对象
    const pipeline = this.pipelines.get(pipelineId);
    if (pipeline) {
      pipeline.health = health;
    }
    
    secureLogger.debug('Pipeline health updated', { pipelineId, health });
    return true;
  }

  /**
   * 记录流水线执行
   */
  recordPipelineExecution(pipelineId: string, success: boolean, responseTime: number): boolean {
    const status = this.pipelineStatus.get(pipelineId);
    if (!status) {
      return false;
    }

    status.lastUsed = new Date();
    status.executionCount++;
    this.totalExecutions++;

    if (success) {
      // 更新平均响应时间
      const totalTime = status.averageResponseTime * (status.executionCount - 1) + responseTime;
      status.averageResponseTime = totalTime / status.executionCount;
      
      // 更新总平均响应时间
      this.totalResponseTime += responseTime;
    } else {
      status.errorCount++;
      this.totalErrors++;
    }

    return true;
  }

  /**
   * 执行流水线 - 通过所有模块传递数据
   */
  async executePipeline(pipelineId: string, request: any): Promise<any> {
    const requestId = `pipeline-exec-${Date.now()}`;
    
    // 初始化debug系统并开始会话
    await this.debugIntegration.initialize();
    const sessionId = this.debugIntegration.startSession();
    
    // 记录输入
    this.debugIntegration.recordInput(requestId, { 
      pipelineId, 
      requestType: typeof request,
      requestKeys: Object.keys(request || {})
    });
    
    const pipeline = this.pipelines.get(pipelineId);
    
    if (!pipeline) {
      const error = new RCCError(
        `Pipeline not found: ${pipelineId}`,
        RCCErrorCode.PIPELINE_NOT_FOUND,
        'pipeline',
        { pipelineId }
      );
      
      // 记录错误
      this.debugIntegration.recordError(requestId, error);
      
      await this.errorHandler.handleRCCError(error, { requestId, pipelineId });
      await this.debugIntegration.endSession();
      return { error: error.message };
    }

    if (pipeline.assemblyStatus !== 'assembled') {
      const error = new RCCError(
        `Pipeline not assembled: ${pipelineId}`,
        RCCErrorCode.PIPELINE_EXECUTION_FAILED,
        'pipeline',
        { pipelineId, status: pipeline.assemblyStatus }
      );
      
      // 记录错误
      this.debugIntegration.recordError(requestId, error);
      
      await this.errorHandler.handleRCCError(error, { requestId, pipelineId });
      await this.debugIntegration.endSession();
      return { error: error.message };
    }

    const startTime = Date.now();
    let success = false;
    let currentData = request;
    
    try {
      // 验证流水线中是否有模块
      if (!pipeline.modules || pipeline.modules.length === 0) {
        const errorMsg = 'No modules available in pipeline';
        secureLogger.error(errorMsg, { pipelineId });
        return { error: errorMsg };
      }

      // 顺序执行所有模块
      for (let i = 0; i < pipeline.modules.length; i++) {
        const module = pipeline.modules[i];
        
        if (!module || !module.instance) {
          const errorMsg = `Module at index ${i} is not available`;
          secureLogger.error(errorMsg, { pipelineId, moduleIndex: i });
          throw new Error(errorMsg);
        }

        // 执行模块处理
        try {
          secureLogger.debug('Executing module in pipeline', { 
            pipelineId, 
            moduleName: module.name, 
            moduleType: module.type,
            moduleIndex: i 
          });
          
          currentData = await module.instance.process(currentData);
          
          secureLogger.debug('Module execution completed', { 
            pipelineId, 
            moduleName: module.name, 
            moduleIndex: i 
          });
        } catch (moduleError) {
          const errorMsg = `Module ${module.name} failed during execution: ${moduleError.message || 'Unknown error'}`;
          secureLogger.error(errorMsg, { 
            pipelineId, 
            moduleName: module.name, 
            moduleIndex: i,
            error: moduleError.message || 'Unknown error',
            stack: moduleError.stack
          });
          
          // 记录模块错误
          this.debugIntegration.recordError(requestId, moduleError);
          
          throw new RCCError(
            errorMsg,
            RCCErrorCode.PIPELINE_EXECUTION_FAILED,
            'pipeline',
            { 
              pipelineId, 
              moduleName: module.name, 
              moduleIndex: i,
              originalError: moduleError.message || 'Unknown error'
            }
          );
        }
      }

      success = true;
      return currentData;
    } catch (error) {
      // 处理流水线执行错误
      await this.errorHandler.handleRCCError(error, { requestId, pipelineId });
      this.debugIntegration.recordError(requestId, error);
      return { error: error.message || 'Pipeline execution failed' };
    } finally {
      const responseTime = Date.now() - startTime;
      this.recordPipelineExecution(pipelineId, success, responseTime);
      await this.debugIntegration.endSession();
    }
  }

  /**
   * 健康检查所有流水线
   */
  async healthCheckAllPipelines(): Promise<void> {
    if (this.isDestroyed) {
      return;
    }

    const healthChecks = [];
    
    for (const [pipelineId, pipeline] of this.pipelines) {
      try {
        const startTime = Date.now();
        const healthResult = await this.checkPipelineHealth(pipeline);
        const responseTime = Date.now() - startTime;
        
        healthChecks.push({
          pipelineId,
          healthy: healthResult.healthy,
          responseTime
        });
        
        // 更新健康状态
        this.updatePipelineHealth(pipelineId, healthResult.healthy ? 'healthy' : 'unhealthy');
        
      } catch (error) {
        secureLogger.error('Pipeline health check failed', { 
          pipelineId, 
          error: error.message || 'Unknown error'
        });
        
        this.updatePipelineHealth(pipelineId, 'unhealthy');
      }
    }
    
    secureLogger.debug('Health check completed for all pipelines', { 
      total: healthChecks.length,
      healthy: healthChecks.filter(check => check.healthy).length
    });
  }

  /**
   * 检查单个流水线健康状态
   */
  private async checkPipelineHealth(pipeline: AssembledPipeline): Promise<{ healthy: boolean; details?: any }> {
    // 检查流水线状态
    if (pipeline.assemblyStatus !== 'assembled') {
      return { healthy: false, details: `Pipeline not assembled: ${pipeline.assemblyStatus}` };
    }

    // 检查每个模块的健康状态
    for (const module of pipeline.modules) {
      try {
        const healthResult = await module.instance.healthCheck();
        if (!healthResult.healthy) {
          return { 
            healthy: false, 
            details: `Module ${module.name} unhealthy: ${JQJsonHandler.stringifyJson(healthResult.details)}` 
          };
        }
      } catch (error) {
        return { 
          healthy: false, 
          details: `Module ${module.name} health check failed: ${error.message || 'Unknown error'}` 
        };
      }
    }

    return { healthy: true };
  }

  /**
   * 获取管理器统计信息
   */
  getStatistics(): PipelineManagerStats {
    const totalPipelines = this.pipelines.size;
    let activePipelines = 0;
    let healthyPipelines = 0;
    let totalExecutionCount = 0;
    let totalErrorCount = 0;
    let totalAvgResponseTime = 0;
    
    for (const status of this.pipelineStatus.values()) {
      if (status.status === 'active') {
        activePipelines++;
      }
      if (status.health === 'healthy') {
        healthyPipelines++;
      }
      totalExecutionCount += status.executionCount;
      totalErrorCount += status.errorCount;
      totalAvgResponseTime += status.averageResponseTime;
    }
    
    const uptime = Date.now() - this.startTime.getTime();
    const averageResponseTime = totalPipelines > 0 ? totalAvgResponseTime / totalPipelines : 0;
    
    return {
      totalPipelines,
      activePipelines,
      healthyPipelines,
      totalExecutions: this.totalExecutions,
      totalErrors: this.totalErrors,
      averageResponseTime,
      uptime
    };
  }

  /**
   * 启动健康检查任务
   */
  private startHealthChecks(): void {
    if (this.config.healthCheckInterval && this.config.healthCheckInterval > 0) {
      this.healthCheckIntervalId = setInterval(() => {
        this.healthCheckAllPipelines().catch(error => {
          secureLogger.error('Health check task failed', { error: error.message || 'Unknown error' });
        });
      }, this.config.healthCheckInterval);
    }
  }

  /**
   * 启动清理任务
   */
  private startCleanupTask(): void {
    if (this.config.cleanupInterval && this.config.cleanupInterval > 0) {
      this.cleanupIntervalId = setInterval(() => {
        this.cleanupInactivePipelines().catch(error => {
          secureLogger.error('Cleanup task failed', { error: error.message || 'Unknown error' });
        });
      }, this.config.cleanupInterval);
    }
  }

  /**
   * 清理不活跃的流水线
   */
  private async cleanupInactivePipelines(): Promise<void> {
    if (!this.config.maxInactiveTime) {
      return;
    }

    const now = Date.now();
    const cutoffTime = now - this.config.maxInactiveTime;
    const toRemove: string[] = [];
    
    for (const [pipelineId, status] of this.pipelineStatus) {
      if (status.lastUsed && status.lastUsed.getTime() < cutoffTime) {
        toRemove.push(pipelineId);
      }
    }
    
    for (const pipelineId of toRemove) {
      secureLogger.info('Cleaning up inactive pipeline', { pipelineId });
      await this.destroyPipeline(pipelineId);
    }
  }

  /**
   * 清理流水线资源
   */
  private async cleanupPipeline(pipeline: AssembledPipeline): Promise<void> {
    try {
      // 停止并清理所有模块
      for (const module of pipeline.modules) {
        if (module.instance && module.isInitialized) {
          try {
            await module.instance.stop();
            await module.instance.cleanup();
          } catch (error) {
            secureLogger.warn('Failed to cleanup module', { 
              moduleName: module.name, 
              error: error.message || 'Unknown error'
            });
          }
        }
      }
    } catch (error) {
      secureLogger.error('Failed to cleanup pipeline', { 
        pipelineId: pipeline.pipelineId, 
        error: error.message || 'Unknown error'
      });
    }
  }

  /**
   * 销毁管理器
   */
  async destroy(): Promise<void> {
    if (this.isDestroyed) {
      return;
    }

    // 清理定时任务
    if (this.healthCheckIntervalId) {
      clearInterval(this.healthCheckIntervalId);
      this.healthCheckIntervalId = null;
    }
    
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    // 销毁所有流水线
    const pipelineIds = Array.from(this.pipelines.keys());
    for (const pipelineId of pipelineIds) {
      await this.destroyPipeline(pipelineId);
    }

    this.isDestroyed = true;
    secureLogger.info('Pipeline manager destroyed');
  }

  /**
   * 重置管理器状态
   */
  async reset(): Promise<void> {
    await this.destroy();
    this.pipelines.clear();
    this.pipelineStatus.clear();
    this.isDestroyed = false;
    this.totalExecutions = 0;
    this.totalErrors = 0;
    this.totalResponseTime = 0;
    this.startTime = new Date();
    
    // 重新启动任务
    this.startHealthChecks();
    this.startCleanupTask();
    
    secureLogger.info('Pipeline manager reset');
  }
}

// 导出默认实例管理器
export const pipelineManager = new PipelineManager();