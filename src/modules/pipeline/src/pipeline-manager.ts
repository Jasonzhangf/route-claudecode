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
import { RCCError, RCCErrorCode } from '../../types/src/index';
import { EnhancedErrorHandler } from '../../error-handler/src/enhanced-error-handler';
import { ModuleDebugIntegration } from '../../logging/src/debug-integration';
import { EventEmitter } from 'events';

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
 * 维护模式信息
 */
export interface MaintenanceInfo {
  underMaintenance: boolean;
  reason: string;
  setAt: Date;
  estimatedDuration?: number;
}

/**
 * Pipeline管理器
 */
export class PipelineManager extends EventEmitter {
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
    captureLevel: 'full',
    serverPort: undefined // 将在启动时设置
  });
  
  // 鉴权维护模式相关属性
  private maintenanceMode: Map<string, MaintenanceInfo> = new Map();
  private maintenanceLocks: Map<string, boolean> = new Map();
  
  // 外部依赖引用
  private externalErrorHandler: any = null;

  constructor(config?: PipelineManagerConfig) {
    super();
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
   * 设置Debug系统端口
   */
  setDebugPort(port: number): void {
    console.log(`🔧 [PIPELINE-MANAGER] 设置Debug端口: ${port}`);
    // 更新Debug集成配置中的端口
    (this.debugIntegration as any).config.serverPort = port;
    secureLogger.info('Pipeline manager debug port updated', { port });
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

    // 🔧 启动流水线中的所有模块
    this.startPipelineModules(pipeline).catch(error => {
      secureLogger.error('Failed to start pipeline modules', { 
        pipelineId: pipeline.pipelineId, 
        error: error.message 
      });
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
    const startTime = Date.now();
    
    console.log(`🚀 [${requestId}] 开始执行流水线: ${pipelineId}`);
    console.log(`📋 [${requestId}] 请求数据:`, {
      pipelineId,
      requestType: typeof request,
      requestKeys: Object.keys(request || {})
    });
    
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
      console.error(`❌ [${requestId}] 流水线未找到: ${pipelineId}`);
      const error = new RCCError(
        `Pipeline not found: ${pipelineId}`,
        RCCErrorCode.PIPELINE_MODULE_MISSING,
        'pipeline',
        { pipelineId }
      );
      
      // 记录错误
      this.debugIntegration.recordError(requestId, error);
      
      await this.errorHandler.handleRCCError(error, { requestId, pipelineId });
      await this.debugIntegration.endSession();
      return { error: error.message };
    }
    
    console.log(`✅ [${requestId}] 流水线已找到: ${pipelineId}`);

    if (pipeline.assemblyStatus !== 'assembled') {
      const error = new RCCError(
        `Pipeline not assembled: ${pipelineId}`,
        RCCErrorCode.PIPELINE_EXECUTION_FAILED,
        'pipeline',
        { pipelineId, details: { status: pipeline.assemblyStatus } }
      );
      
      // 记录错误
      this.debugIntegration.recordError(requestId, error);
      
      await this.errorHandler.handleRCCError(error, { requestId, pipelineId });
      await this.debugIntegration.endSession();
      return { error: error.message };
    }

    // 检查流水线是否处于维护模式
    if (this.isPipelineUnderMaintenance(pipelineId)) {
      const maintenanceInfo = this.maintenanceMode.get(pipelineId);
      const error = new RCCError(
        `Pipeline is under maintenance: ${pipelineId}`,
        RCCErrorCode.PIPELINE_EXECUTION_FAILED,
        'pipeline',
        { 
          pipelineId, 
          details: { 
            maintenanceMode: true,
            maintenanceReason: maintenanceInfo?.reason || 'Authentication maintenance'
          }
        }
      );
      
      // 记录错误
      this.debugIntegration.recordError(requestId, error);
      
      await this.errorHandler.handleRCCError(error, { requestId, pipelineId });
      await this.debugIntegration.endSession();
      return { error: error.message, maintenanceMode: true };
    }

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
      console.log(`🔧 [${requestId}] 开始执行流水线模块，总模块数: ${pipeline.modules.length}`);
      
      for (let i = 0; i < pipeline.modules.length; i++) {
        const module = pipeline.modules[i];
        
        if (!module || !module.instance) {
          const errorMsg = `Module at index ${i} is not available`;
          console.error(`❌ [${requestId}] 模块不可用: 索引${i}`);
          secureLogger.error(errorMsg, { pipelineId, moduleIndex: i });
          throw new Error(errorMsg);
        }

        // 执行模块处理
        try {
          console.log(`⚡ [${requestId}] 执行模块 ${i+1}/${pipeline.modules.length}: ${module.name} (${module.type})`);
          secureLogger.debug('Executing module in pipeline', { 
            pipelineId, 
            moduleName: module.name, 
            moduleType: module.type,
            moduleIndex: i 
          });
          
          currentData = await module.instance.process(currentData);
          
          console.log(`✅ [${requestId}] 模块执行完成: ${module.name}`);
          console.log(`📊 [${requestId}] 模块输出数据类型: ${typeof currentData}`);
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
              moduleId: module.instance.getId(),
              details: {
                moduleName: module.name, 
                moduleIndex: i,
                originalError: moduleError.message || 'Unknown error'
              }
            }
          );
        }
      }

      success = true;
      const responseTime = Date.now() - startTime;
      
      console.log(`🎉 [${requestId}] 流水线执行成功完成!`);
      console.log(`⏱️ [${requestId}] 总耗时: ${responseTime}ms`);
      console.log(`📤 [${requestId}] 最终响应数据类型: ${typeof currentData}`);
      console.log(`📋 [${requestId}] 流程统计:`, {
        pipelineId,
        success,
        responseTime,
        moduleCount: pipeline.modules.length
      });
      
      return currentData;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error(`💥 [${requestId}] 流水线执行失败! 耗时: ${responseTime}ms`);
      console.error(`🔥 [${requestId}] 错误详情:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        pipelineId,
        responseTime
      });
      
      // 处理流水线执行错误
      await this.errorHandler.handleRCCError(error, { requestId, pipelineId });
      this.debugIntegration.recordError(requestId, error);
      return { error: error.message || 'Pipeline execution failed' };
    } finally {
      const responseTime = Date.now() - startTime;
      this.recordPipelineExecution(pipelineId, success, responseTime);
      
      console.log(`🏁 [${requestId}] 流水线执行结束，状态: ${success ? '成功' : '失败'}, 耗时: ${responseTime}ms`);
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
   * 启动流水线中的所有模块
   */
  private async startPipelineModules(pipeline: AssembledPipeline): Promise<void> {
    if (!pipeline.modules || pipeline.modules.length === 0) {
      secureLogger.warn('No modules to start in pipeline', { pipelineId: pipeline.pipelineId });
      return;
    }

    console.log(`🔧 [PIPELINE-MANAGER] 启动流水线模块: ${pipeline.pipelineId}, 模块数量: ${pipeline.modules.length}`);

    const startPromises = pipeline.modules.map(async (module, index) => {
      if (!module || !module.instance) {
        secureLogger.error('Module instance not available for startup', { 
          pipelineId: pipeline.pipelineId, 
          moduleIndex: index,
          moduleName: module?.name || 'unknown'
        });
        return false;
      }

      try {
        console.log(`🚀 [PIPELINE-MANAGER] 启动模块 ${index + 1}/${pipeline.modules.length}: ${module.name} (${module.type})`);
        
        // 检查模块状态
        const status = module.instance.getStatus();
        if (status.status === 'running') {
          console.log(`✅ [PIPELINE-MANAGER] 模块已在运行: ${module.name}`);
          return true;
        }

        // 启动模块
        await module.instance.start();
        
        // 验证启动结果
        const newStatus = module.instance.getStatus();
        if (newStatus.status === 'running') {
          console.log(`✅ [PIPELINE-MANAGER] 模块启动成功: ${module.name}, 状态: ${newStatus.status}`);
          return true;
        } else {
          console.error(`❌ [PIPELINE-MANAGER] 模块启动后状态异常: ${module.name}, 状态: ${newStatus.status}`);
          return false;
        }
      } catch (error) {
        secureLogger.error('Failed to start module', { 
          pipelineId: pipeline.pipelineId,
          moduleName: module.name,
          moduleIndex: index,
          error: error.message || 'Unknown error'
        });
        console.error(`❌ [PIPELINE-MANAGER] 模块启动失败: ${module.name}, 错误: ${error.message}`);
        return false;
      }
    });

    const results = await Promise.all(startPromises);
    const successCount = results.filter(Boolean).length;
    const totalCount = pipeline.modules.length;

    if (successCount === totalCount) {
      console.log(`🎉 [PIPELINE-MANAGER] 流水线所有模块启动成功: ${pipeline.pipelineId} (${successCount}/${totalCount})`);
      secureLogger.info('All pipeline modules started successfully', {
        pipelineId: pipeline.pipelineId,
        moduleCount: totalCount
      });
    } else {
      console.error(`💥 [PIPELINE-MANAGER] 流水线模块启动不完整: ${pipeline.pipelineId} (${successCount}/${totalCount})`);
      secureLogger.error('Some pipeline modules failed to start', {
        pipelineId: pipeline.pipelineId,
        successCount,
        totalCount,
        failedCount: totalCount - successCount
      });
    }
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
      this.cleanupIntervalId = setInterval(async () => {
        try {
          // 清理不活跃的流水线
          await this.cleanupInactivePipelines();
          
          // 检查维护模式超时并自动恢复
          const { recovered, stillInMaintenance } = await this.checkAndRecoverFromMaintenance();
          
          if (recovered.length > 0) {
            secureLogger.info('Automatic maintenance recovery completed', {
              recoveredPipelines: recovered.length,
              stillInMaintenance: stillInMaintenance.length
            });
            
            // 发送自动恢复事件
            this.emit('maintenance-auto-recovery', {
              recoveredPipelines: recovered,
              stillInMaintenance,
              timestamp: new Date()
            });
          }
          
          // 检查维护队列状态（如果有外部错误处理器连接）
          if (this.externalErrorHandler) {
            try {
              const queueStatus = this.externalErrorHandler.getAuthMaintenanceQueueStatus();
              if (queueStatus.queueSize > 0) {
                secureLogger.debug('Auth maintenance queue status', {
                  queueSize: queueStatus.queueSize,
                  isProcessing: queueStatus.isProcessing,
                  eventsByType: queueStatus.eventsByType
                });
              }
            } catch (queueCheckError) {
              // 静默处理队列检查错误
            }
          }
          
        } catch (error) {
          secureLogger.error('Cleanup task failed', { 
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }, this.config.cleanupInterval);
    }
  }

  /**
   * 设置外部错误处理器引用（鉴权维护流程协调）
   * @param errorHandler 错误处理器实例
   */
  setErrorHandler(errorHandler: any): void {
    this.externalErrorHandler = errorHandler;
    secureLogger.info('External error handler set in pipeline manager');
  }

  /**
   * 获取流水线维护状态和统计信息
   * @returns Object 完整的维护状态信息
   */
  getFullMaintenanceStatus(): {
    maintenanceStats: any;
    maintenancePipelines: string[];
    maintenanceInfos: Record<string, MaintenanceInfo>;
    authMaintenanceQueueStatus?: any;
  } {
    const maintenanceStats = this.getMaintenanceStatusStats();
    const maintenancePipelines = this.getMaintenancePipelines();
    const maintenanceInfos = this.getMaintenanceStatus();
    
    let authMaintenanceQueueStatus;
    if (this.externalErrorHandler) {
      try {
        authMaintenanceQueueStatus = this.externalErrorHandler.getAuthMaintenanceQueueStatus();
      } catch (error) {
        // 静默处理错误
      }
    }
    
    return {
      maintenanceStats,
      maintenancePipelines,
      maintenanceInfos,
      authMaintenanceQueueStatus
    };
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
    this.maintenanceMode.clear();
    this.maintenanceLocks.clear();
    
    // 重新启动任务
    this.startHealthChecks();
    this.startCleanupTask();
    
    secureLogger.info('Pipeline manager reset');
  }

  // ===== 鉴权维护模式和支持方法 =====

  /**
   * 批量设置维护模式（优化版本）
   * @param pipelineIds 流水线ID数组
   * @param reason 维护原因
   * @param options 可选参数
   * @returns Promise<{success: string[], failed: string[]}>
   */
  async setAuthMaintenanceMode(
    pipelineIds: string[], 
    reason: string, 
    options?: {
      estimatedDuration?: number;
      force?: boolean;
      skipHealthCheck?: boolean;
    }
  ): Promise<{success: string[], failed: string[]}> {
    const success: string[] = [];
    const failed: string[] = [];
    
    // 并发处理所有流水线
    const maintenancePromises = pipelineIds.map(async (pipelineId) => {
      try {
        await this.setSinglePipelineMaintenance(pipelineId, reason, options);
        success.push(pipelineId);
      } catch (error) {
        failed.push(pipelineId);
        secureLogger.error('Failed to set maintenance mode for pipeline', {
          pipelineId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    await Promise.all(maintenancePromises);

    // 发送维护模式事件
    if (success.length > 0) {
      this.emit('maintenance-mode-set', {
        pipelineIds: success,
        reason,
        timestamp: new Date()
      });
    }

    secureLogger.info('Batch maintenance mode set completed', {
      total: pipelineIds.length,
      success: success.length,
      failed: failed.length,
      reason
    });

    return { success, failed };
  }

  /**
   * 批量清除维护模式（优化版本）
   * @param pipelineIds 流水线ID数组
   * @param options 可选参数
   * @returns Promise<{success: string[], failed: string[]}>
   */
  async clearAuthMaintenanceMode(
    pipelineIds: string[], 
    options?: {
      skipHealthCheck?: boolean;
      force?: boolean;
    }
  ): Promise<{success: string[], failed: string[]}> {
    const success: string[] = [];
    const failed: string[] = [];
    
    // 并发处理所有流水线
    const recoveryPromises = pipelineIds.map(async (pipelineId) => {
      try {
        await this.clearSinglePipelineMaintenance(pipelineId, options);
        success.push(pipelineId);
      } catch (error) {
        failed.push(pipelineId);
        secureLogger.error('Failed to clear maintenance mode for pipeline', {
          pipelineId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    await Promise.all(recoveryPromises);

    // 发送维护模式清除事件
    if (success.length > 0) {
      this.emit('maintenance-mode-cleared', {
        pipelineIds: success,
        timestamp: new Date()
      });
    }

    secureLogger.info('Batch maintenance mode clear completed', {
      total: pipelineIds.length,
      success: success.length,
      failed: failed.length
    });

    return { success, failed };
  }

  /**
   * 检查维护状态并自动恢复
   * @param maxDuration 最大维护持续时间（毫秒）
   * @returns Promise<{recovered: string[], stillInMaintenance: string[]}>
   */
  async checkAndRecoverFromMaintenance(maxDuration: number = 3600000): Promise<{
    recovered: string[];
    stillInMaintenance: string[];
  }> {
    const now = Date.now();
    const recovered: string[] = [];
    const stillInMaintenance: string[] = [];

    for (const [pipelineId, maintenanceInfo] of this.maintenanceMode.entries()) {
      const maintenanceDuration = now - maintenanceInfo.setAt.getTime();
      
      if (maintenanceDuration > maxDuration) {
        // 自动恢复过期的维护
        try {
          await this.clearSinglePipelineMaintenance(pipelineId, {
            skipHealthCheck: false
          });
          recovered.push(pipelineId);
          secureLogger.info('Auto-recovered pipeline from maintenance', {
            pipelineId,
            maintenanceDuration,
            reason: maintenanceInfo.reason
          });
        } catch (error) {
          stillInMaintenance.push(pipelineId);
          secureLogger.warn('Failed to auto-recover pipeline from maintenance', {
            pipelineId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } else {
        stillInMaintenance.push(pipelineId);
      }
    }

    return { recovered, stillInMaintenance };
  }

  /**
   * 获取维护状态统计信息
   * @returns Object 维护状态统计
   */
  getMaintenanceStatusStats(): {
    totalInMaintenance: number;
    byProvider: Record<string, number>;
    byReason: Record<string, number>;
    averageMaintenanceTime: number;
    oldestMaintenance?: {
      pipelineId: string;
      startTime: Date;
      duration: number;
    };
  } {
    const now = Date.now();
    const byProvider: Record<string, number> = {};
    const byReason: Record<string, number> = {};
    let totalMaintenanceTime = 0;
    let oldestMaintenanceInfo: {
      pipelineId: string;
      startTime: Date;
      duration: number;
    } | undefined;

    for (const [pipelineId, maintenanceInfo] of this.maintenanceMode.entries()) {
      // 统计时间
      const duration = now - maintenanceInfo.setAt.getTime();
      totalMaintenanceTime += duration;

      // 查找最老的维护
      if (!oldestMaintenanceInfo || maintenanceInfo.setAt < oldestMaintenanceInfo.startTime) {
        oldestMaintenanceInfo = {
          pipelineId,
          startTime: maintenanceInfo.setAt,
          duration
        };
      }

      // 从流水线信息中提取提供商
      const pipeline = this.pipelines.get(pipelineId);
      const provider = pipeline?.provider || 'unknown';
      byProvider[provider] = (byProvider[provider] || 0) + 1;

      // 按原因统计
      const reason = maintenanceInfo.reason || 'unknown';
      byReason[reason] = (byReason[reason] || 0) + 1;
    }

    const totalInMaintenance = this.maintenanceMode.size;
    const averageMaintenanceTime = totalInMaintenance > 0 ? totalMaintenanceTime / totalInMaintenance : 0;

    return {
      totalInMaintenance,
      byProvider,
      byReason,
      averageMaintenanceTime,
      oldestMaintenance: oldestMaintenanceInfo
    };
  }

  /**
   * 强制进入维护模式（用于紧急情况）
   * @param provider 提供商名称
   * @param reason 维护原因
   * @returns Promise<number> 进入维护模式的流水线数量
   */
  async forceMaintenanceModeForProvider(provider: string, reason: string): Promise<number> {
    const pipelinesToMaintain: string[] = [];

    // 查找所有属于指定提供商的流水线
    for (const [pipelineId, pipeline] of this.pipelines.entries()) {
      if (pipeline.provider === provider) {
        pipelinesToMaintain.push(pipelineId);
      }
    }

    if (pipelinesToMaintain.length === 0) {
      secureLogger.warn('No pipelines found for provider in force maintenance', {
        provider
      });
      return 0;
    }

    const { success } = await this.setAuthMaintenanceMode(
      pipelinesToMaintain, 
      reason, 
      {
        force: true,
        estimatedDuration: 1800000 // 30分钟
      }
    );

    secureLogger.warn('Force maintenance mode applied to provider pipelines', {
      provider,
      totalPipelines: pipelinesToMaintain.length,
      maintenanceApplied: success.length,
      reason
    });

    return success.length;
  }

  // ===== 鉴权维护模式相关方法 =====

  /**
   * 设置单个流水线的维护模式
   */
  private async setSinglePipelineMaintenance(
    pipelineId: string, 
    reason: string, 
    options?: {
      estimatedDuration?: number;
      force?: boolean;
      skipHealthCheck?: boolean;
    }
  ): Promise<void> {
    // 检查流水线是否存在
    if (!this.pipelines.has(pipelineId)) {
      throw new Error(`Pipeline not found: ${pipelineId}`);
    }

    // 获取维护锁以防止并发问题
    if (this.maintenanceLocks.get(pipelineId) && !options?.force) {
      throw new Error(`Pipeline maintenance lock already acquired: ${pipelineId}`);
    }

    try {
      this.maintenanceLocks.set(pipelineId, true);
      
      // 更新流水线状态
      const status = this.pipelineStatus.get(pipelineId);
      if (status) {
        const previousStatus = status.status;
        status.status = 'inactive'; // 设置为非活跃状态
        
        // 记录维护模式信息
        this.maintenanceMode.set(pipelineId, {
          underMaintenance: true,
          reason: reason,
          setAt: new Date(),
          estimatedDuration: options?.estimatedDuration || 1800000 // 预估30分钟
        });
        
        // 更新流水线健康状态
        this.updatePipelineHealth(pipelineId, 'degraded');
        
        secureLogger.info('Pipeline set to maintenance mode', {
          pipelineId,
          previousStatus,
          maintenanceReason: reason,
          estimatedDuration: options?.estimatedDuration
        });
      }
    } finally {
      this.maintenanceLocks.delete(pipelineId);
    }
  }

  
  /**
   * 清除单个流水线的维护模式
   */
  private async clearSinglePipelineMaintenance(
    pipelineId: string, 
    options?: {
      skipHealthCheck?: boolean;
      force?: boolean;
    }
  ): Promise<void> {
    // 检查流水线是否处于维护模式
    if (!this.maintenanceMode.has(pipelineId)) {
      throw new Error(`Pipeline not in maintenance mode: ${pipelineId}`);
    }

    // 获取维护锁
    if (this.maintenanceLocks.get(pipelineId) && !options?.force) {
      throw new Error(`Pipeline maintenance lock already acquired: ${pipelineId}`);
    }

    try {
      this.maintenanceLocks.set(pipelineId, true);
      
      const maintenanceInfo = this.maintenanceMode.get(pipelineId)!;
      
      // 恢复流水线状态
      const status = this.pipelineStatus.get(pipelineId);
      if (status) {
        const previousStatus = status.status;
        status.status = 'active'; // 恢复为活跃状态
        
        // 清除维护模式信息
        this.maintenanceMode.delete(pipelineId);
        
        // 执行健康检查以恢复健康状态
        if (!options?.skipHealthCheck) {
          try {
            const pipeline = this.pipelines.get(pipelineId);
            if (pipeline) {
              const healthResult = await this.checkPipelineHealth(pipeline);
              if (healthResult.healthy) {
                this.updatePipelineHealth(pipelineId, 'healthy');
              } else {
                this.updatePipelineHealth(pipelineId, 'degraded');
              }
            }
          } catch (healthError) {
            secureLogger.warn('Failed to check health after clearing maintenance', {
              pipelineId,
              error: healthError instanceof Error ? healthError.message : String(healthError)
            });
            this.updatePipelineHealth(pipelineId, 'degraded');
          }
        }
        
        secureLogger.info('Pipeline maintenance mode cleared', {
          pipelineId,
          previousStatus,
          maintenanceReason: maintenanceInfo.reason,
          maintenanceDuration: Date.now() - maintenanceInfo.setAt.getTime()
        });
      }
    } finally {
      this.maintenanceLocks.delete(pipelineId);
    }
  }

  
  /**
   * 检查流水线是否处于维护模式
   */
  isPipelineUnderMaintenance(pipelineId: string): boolean {
    const maintenanceInfo = this.maintenanceMode.get(pipelineId);
    return maintenanceInfo?.underMaintenance || false;
  }

  /**
   * 获取维护状态
   */
  getMaintenanceStatus(): Record<string, MaintenanceInfo> {
    const status: Record<string, MaintenanceInfo> = {};
    for (const [pipelineId, maintenanceInfo] of this.maintenanceMode) {
      status[pipelineId] = { ...maintenanceInfo };
    }
    return status;
  }

  /**
   * 获取维护模式下的流水线列表
   */
  getMaintenancePipelines(): string[] {
    return Array.from(this.maintenanceMode.keys());
  }

  /**
   * 检查维护模式是否超时
   */
  async checkMaintenanceTimeouts(): Promise<void> {
    const now = Date.now();
    const timeoutDuration = 3600000; // 1小时超时
    
    const expiredMaintenance: string[] = [];
    
    for (const [pipelineId, maintenanceInfo] of this.maintenanceMode) {
      const maintenanceDuration = now - maintenanceInfo.setAt.getTime();
      
      // 如果维护时间超过预估时间+1小时，自动清除
      if (maintenanceDuration > (maintenanceInfo.estimatedDuration || 1800000) + timeoutDuration) {
        expiredMaintenance.push(pipelineId);
      }
    }
    
    if (expiredMaintenance.length > 0) {
      secureLogger.info('Clearing maintenance mode for expired pipelines', {
        expiredPipelines: expiredMaintenance.length
      });
      
      await this.clearAuthMaintenanceMode(expiredMaintenance);
    }
  }
}

// 导出默认实例管理器
export const pipelineManager = new PipelineManager();