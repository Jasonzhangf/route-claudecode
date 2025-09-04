/**
 * 运行时调度器 - Runtime Scheduler
 * 
 * RCC v4.0 架构重构核心组件
 * 
 * 实现DynamicScheduler接口，提供运行时请求调度功能
 * 
 * @author RCC v4.0 Architecture Team
 */

import { EventEmitter } from 'events';
import { DynamicScheduler, ScheduleRequest, ScheduleResponse, PipelineHealthStatus, LoadBalanceStrategy } from '../interfaces/scheduler/dynamic-scheduler';
// 临时解决方案：使用router目录下的load-balancer
import { LoadBalancer } from '../router/load-balancer';
import { CompletePipeline } from './pipeline-manager-types';
import { secureLogger } from '../utils/secure-logger';
import { DynamicSchedulerError } from '../interfaces/scheduler/dynamic-scheduler';

/**
 * 运行时调度器配置接口
 */
export interface RuntimeSchedulerConfig {
  /** 负载均衡策略 */
  strategy?: LoadBalanceStrategy;
  /** 最大错误次数 */
  maxErrorCount?: number;
  /** 拉黑时长 (毫秒) */
  blacklistDuration?: number;
  /** 认证问题重试延迟 (毫秒) */
  authRetryDelay?: number;
  /** 健康检查间隔 (毫秒) */
  healthCheckInterval?: number;
}

/**
 * 运行时调度器实现
 * 
 * 职责：
 * 1. 运行时请求调度
 * 2. 负载均衡决策
 * 3. 流水线健康状态管理
 * 4. 错误处理和恢复
 * 
 * 与初始化器完全分离：
 * - 不处理配置解析
 * - 不创建新流水线
 * - 只调度已存在的活跃流水线
 */
export class RuntimeScheduler extends EventEmitter implements DynamicScheduler {
  
  private registeredPipelines: Map<string, CompletePipeline> = new Map();
  private pipelinesByCategory: Map<string, CompletePipeline[]> = new Map();
  private isCleanedUp: boolean = false;
  private lastScheduleTime?: number;
  private config: RuntimeSchedulerConfig;
  
  constructor(config?: RuntimeSchedulerConfig) {
    super();
    
    this.config = {
      maxErrorCount: 3,
      blacklistDuration: 300000, // 5分钟
      authRetryDelay: 60000, // 1分钟
      healthCheckInterval: 30000, // 30秒
      ...config
    };
    
    secureLogger.info('⏱️ 运行时调度器创建', {
      strategy: this.config.strategy,
      maxErrorCount: this.config.maxErrorCount,
      blacklistDuration: this.config.blacklistDuration
    });
  }
  
  /**
   * 调度请求 - 核心调度接口
   */
  async scheduleRequest(request: ScheduleRequest): Promise<ScheduleResponse> {
    if (this.isCleanedUp) {
      throw new DynamicSchedulerError(
        '调度器已清理，无法处理请求',
        'SCHEDULER_CLEANED_UP'
      );
    }
    
    try {
      secureLogger.debug('⏱️ 开始调度请求', {
        requestId: request.requestId,
        model: request.model,
        priority: request.priority
      });
      
      // 获取该模型的可用流水线
      const availablePipelines = this.pipelinesByCategory.get(request.model) || [];
      if (availablePipelines.length === 0) {
        throw new DynamicSchedulerError(
          `没有可用的流水线处理模型: ${request.model}`,
          'NO_AVAILABLE_PIPELINES'
        );
      }
      
      const startTime = Date.now();
      
      // 根据配置选择流水线
      const selectedPipeline = this.selectPipeline(availablePipelines, request);
      
      // 执行流水线处理 - TODO: 实现完整的流水线处理逻辑
      // const response = await this.processThroughPipeline(selectedPipeline, request.request);
      const response = { success: true, message: 'Pipeline processing not implemented yet' };
      
      const processingTime = Date.now() - startTime;
      this.lastScheduleTime = Date.now();
      
      secureLogger.info('✅ 请求调度成功', {
        requestId: request.requestId,
        pipelineId: selectedPipeline.pipelineId,
        processingTime: `${processingTime}ms`
      });
      
      return {
        requestId: request.requestId,
        pipelineId: selectedPipeline.pipelineId,
        response: response,
        processingTime: processingTime,
        success: true,
        error: undefined,
        strategy: this.config.strategy || 'round_robin'
      };
      
    } catch (cause) {
      secureLogger.error('❌ 请求调度失败', {
        requestId: request.requestId,
        model: request.model,
        error: cause.message,
        stack: cause.stack
      });
      
      return {
        requestId: request.requestId,
        pipelineId: '',
        response: null,
        processingTime: Date.now() - Date.now(),
        success: false,
        error: cause.message,
        strategy: this.config.strategy || 'round_robin'
      };
    }
  }
  
  /**
   * 选择流水线（根据负载均衡策略）
   */
  private selectPipeline(pipelines: CompletePipeline[], request: ScheduleRequest): CompletePipeline {
    const strategy = this.config.strategy || LoadBalanceStrategy.ROUND_ROBIN;
    
    switch (strategy) {
      case LoadBalanceStrategy.ROUND_ROBIN:
        return this.selectRoundRobin(pipelines, request.model);
      case LoadBalanceStrategy.RANDOM:
        return this.selectRandom(pipelines);
      case LoadBalanceStrategy.LEAST_CONNECTIONS:
        return this.selectLeastConnections(pipelines);
      case LoadBalanceStrategy.PRIORITY_BASED:
        return this.selectPriorityBased(pipelines, request);
      default:
        return this.selectRoundRobin(pipelines, request.model);
    }
  }
  
  private selectRoundRobin(pipelines: CompletePipeline[], model: string): CompletePipeline {
    const key = `rr_${model}`;
    const currentIndex = (this.roundRobinCounters.get(key) || 0) % pipelines.length;
    this.roundRobinCounters.set(key, currentIndex + 1);
    return pipelines[currentIndex];
  }
  
  private selectRandom(pipelines: CompletePipeline[]): CompletePipeline {
    const index = Math.floor(Math.random() * pipelines.length);
    return pipelines[index];
  }
  
  private selectLeastConnections(pipelines: CompletePipeline[]): CompletePipeline {
    // 选择连接数最少的流水线
    return pipelines.reduce((least, current) => {
      const leastConnections = this.getConnectionCount(least.pipelineId);
      const currentConnections = this.getConnectionCount(current.pipelineId);
      return currentConnections < leastConnections ? current : least;
    });
  }
  
  private selectPriorityBased(pipelines: CompletePipeline[], request: ScheduleRequest): CompletePipeline {
    // 根据优先级和健康状态选择
    const priority = request.priority;
    const sortedPipelines = pipelines.sort((a, b) => {
      const aHealth = this.getPipelineHealthScore(a.pipelineId);
      const bHealth = this.getPipelineHealthScore(b.pipelineId);
      return bHealth - aHealth;
    });
    
    if (priority === 'high') {
      return sortedPipelines[0];
    } else if (priority === 'low') {
      return sortedPipelines[sortedPipelines.length - 1];
    } else {
      return sortedPipelines[Math.floor(sortedPipelines.length / 2)];
    }
  }
  
  private roundRobinCounters = new Map<string, number>();
  private connectionCounts = new Map<string, number>();
  
  private getConnectionCount(pipelineId: string): number {
    return this.connectionCounts.get(pipelineId) || 0;
  }
  
  private getPipelineHealthScore(pipelineId: string): number {
    // 返回流水线健康度分数 (0-100)
    const pipeline = this.registeredPipelines.get(pipelineId);
    if (!pipeline) return 0;
    
    // 基于错误率、响应时间等计算健康度
    return 100; // 默认健康
  }
  
  /**
   * 注册流水线到调度器
   */
  registerPipeline(pipeline: CompletePipeline, category: string): void {
    if (this.isCleanedUp) {
      throw new DynamicSchedulerError(
        '调度器已清理，无法注册流水线',
        'SCHEDULER_CLEANED_UP'
      );
    }
    
    try {
      // 注册到总的流水线映射
      this.registeredPipelines.set(pipeline.pipelineId, pipeline);
      
      // 按分类组织流水线
      if (!this.pipelinesByCategory.has(category)) {
        this.pipelinesByCategory.set(category, []);
      }
      this.pipelinesByCategory.get(category)!.push(pipeline);
      
      // 初始化连接计数
      this.connectionCounts.set(pipeline.pipelineId, 0);
      
      secureLogger.info('📋 流水线注册成功', {
        pipelineId: pipeline.pipelineId,
        category: category,
        virtualModel: pipeline.virtualModel,
        totalPipelines: this.registeredPipelines.size
      });
      
      // 触发事件
      this.emit('pipelineRegistered', {
        pipelineId: pipeline.pipelineId,
        category: category,
        virtualModel: pipeline.virtualModel
      });
    } catch (cause) {
      secureLogger.error('❌ 流水线注册失败', {
        pipelineId: pipeline.pipelineId,
        category: category,
        error: cause.message
      });
      
      throw new DynamicSchedulerError(
        `流水线注册失败: ${cause.message}`,
        'PIPELINE_REGISTRATION_FAILED',
        cause
      );
    }
  }
  
  /**
   * 移除流水线
   */
  unregisterPipeline(pipelineId: string): void {
    if (this.isCleanedUp) {
      return;
    }
    
    try {
      const pipeline = this.registeredPipelines.get(pipelineId);
      if (!pipeline) {
        secureLogger.warn('⚠️ 尝试移除不存在的流水线', { pipelineId });
        return;
      }
      
      // 从总映射中移除
      this.registeredPipelines.delete(pipelineId);
      
      // 从分类映射中移除
      for (const [category, pipelines] of this.pipelinesByCategory.entries()) {
        const index = pipelines.findIndex(p => p.pipelineId === pipelineId);
        if (index !== -1) {
          pipelines.splice(index, 1);
          // 如果分类为空，则删除整个分类
          if (pipelines.length === 0) {
            this.pipelinesByCategory.delete(category);
          }
          break;
        }
      }
      
      // 清理连接计数
      this.connectionCounts.delete(pipelineId);
      
      // 清理轮询计数器中的相关条目
      for (const [key, _] of this.roundRobinCounters.entries()) {
        if (key.includes(pipelineId)) {
          this.roundRobinCounters.delete(key);
        }
      }
      
      secureLogger.info('✅ 流水线移除成功', {
        pipelineId: pipelineId,
        remainingPipelines: this.registeredPipelines.size
      });
      
      // 触发事件
      this.emit('pipelineUnregistered', {
        pipelineId: pipelineId,
        virtualModel: pipeline.virtualModel
      });
    } catch (cause) {
      secureLogger.error('❌ 流水线移除失败', {
        pipelineId: pipelineId,
        error: cause.message
      });
    }
  }
  
  /**
   * 获取负载均衡统计信息
   */
  getSchedulerStats(): {
    totalPipelines: number;
    availablePipelines: number;
    blacklistedPipelines: number;
    categoriesCount: number;
    strategy: LoadBalanceStrategy;
    lastScheduleTime?: number;
  } {
    const totalPipelines = this.registeredPipelines.size;
    const availablePipelines = Array.from(this.registeredPipelines.values())
      .filter(pipeline => this.isPipelineAvailable(pipeline.pipelineId)).length;
    const blacklistedPipelines = totalPipelines - availablePipelines;
    const categoriesCount = this.pipelinesByCategory.size;
    const strategy = this.config.strategy || LoadBalanceStrategy.ROUND_ROBIN;
    
    return {
      totalPipelines,
      availablePipelines,
      blacklistedPipelines,
      categoriesCount,
      strategy,
      lastScheduleTime: this.lastScheduleTime
    };
  }
  
  private isPipelineAvailable(pipelineId: string): boolean {
    // 检查流水线是否在黑名单中或临时阻塞中
    if (this.blacklistedPipelines.has(pipelineId)) {
      return false;
    }
    
    const blockUntil = this.temporarilyBlockedPipelines.get(pipelineId);
    if (blockUntil && Date.now() < blockUntil) {
      return false;
    }
    
    return true;
  }
  
  private blacklistedPipelines = new Set<string>();
  private temporarilyBlockedPipelines = new Map<string, number>();
  
  /**
   * 获取流水线健康状态
   */
  getPipelineHealth(pipelineId: string): PipelineHealthStatus | null {
    const pipeline = this.registeredPipelines.get(pipelineId);
    if (!pipeline) {
      return null;
    }
    
    const isAvailable = this.isPipelineAvailable(pipelineId);
    const isBlacklisted = this.blacklistedPipelines.has(pipelineId);
    const errorCount = this.getErrorCount(pipelineId);
    const lastErrorTime = this.getLastErrorTime(pipelineId);
    const blacklistUntil = this.temporarilyBlockedPipelines.get(pipelineId);
    
    let healthStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (isBlacklisted) {
      healthStatus = 'unhealthy';
    } else if (!isAvailable || errorCount > 0) {
      healthStatus = 'degraded';
    } else {
      healthStatus = 'healthy';
    }
    
    return {
      pipelineId,
      isAvailable,
      isBlacklisted,
      errorCount,
      lastErrorTime,
      blacklistUntil,
      healthStatus
    };
  }
  
  private errorCounts = new Map<string, number>();
  private lastErrorTimes = new Map<string, number>();
  
  private getErrorCount(pipelineId: string): number {
    return this.errorCounts.get(pipelineId) || 0;
  }
  
  private getLastErrorTime(pipelineId: string): number | undefined {
    return this.lastErrorTimes.get(pipelineId);
  }
  
  /**
   * 获取分类下的所有流水线状态
   */
  getCategoryPipelineHealth(category: string): PipelineHealthStatus[] {
    const pipelines = this.pipelinesByCategory.get(category) || [];
    const healthStatuses: PipelineHealthStatus[] = [];
    
    for (const pipeline of pipelines) {
      const healthStatus = this.getPipelineHealth(pipeline.pipelineId);
      if (healthStatus) {
        healthStatuses.push(healthStatus);
      }
    }
    
    return healthStatuses;
  }
  
  /**
   * 清理调度器资源
   */
  async cleanup(): Promise<void> {
    if (this.isCleanedUp) {
      return;
    }
    
    try {
      secureLogger.info('🧹 开始清理运行时调度器资源');
      
      // 清理所有映射和计数器
      this.registeredPipelines.clear();
      this.pipelinesByCategory.clear();
      this.connectionCounts.clear();
      this.roundRobinCounters.clear();
      this.errorCounts.clear();
      this.lastErrorTimes.clear();
      this.blacklistedPipelines.clear();
      this.temporarilyBlockedPipelines.clear();
      
      // 移除所有事件监听器
      this.removeAllListeners();
      this.isCleanedUp = true;
      
      secureLogger.info('✅ 运行时调度器清理完成');
    } catch (cause) {
      secureLogger.error('❌ 运行时调度器清理失败', {
        error: cause.message,
        stack: cause.stack
      });
      
      throw new DynamicSchedulerError(
        `调度器清理失败: ${cause.message}`,
        'SCHEDULER_CLEANUP_FAILED',
        cause
      );
    }
  }
  
  /**
   * 记录流水线错误
   */
  recordPipelineError(pipelineId: string, error: Error): void {
    const currentCount = this.errorCounts.get(pipelineId) || 0;
    this.errorCounts.set(pipelineId, currentCount + 1);
    this.lastErrorTimes.set(pipelineId, Date.now());
    
    // 检查是否需要临时阻塞或加入黑名单
    const maxErrors = this.config.maxErrorCount || 3;
    if (currentCount + 1 >= maxErrors) {
      const blockDuration = this.config.blacklistDuration || 300000; // 5分钟
      this.temporarilyBlockedPipelines.set(pipelineId, Date.now() + blockDuration);
      
      secureLogger.warn('⚠️ 流水线临时阻塞', {
        pipelineId,
        errorCount: currentCount + 1,
        blockUntil: new Date(Date.now() + blockDuration).toISOString()
      });
      
      this.emit('pipelineBlocked', {
        pipelineId,
        errorCount: currentCount + 1,
        blockUntil: Date.now() + blockDuration
      });
    }
    
    this.emit('pipelineError', {
      pipelineId,
      error: error.message,
      errorCount: currentCount + 1
    });
  }
  
  /**
   * 清除流水线错误计数
   */
  clearPipelineErrors(pipelineId: string): void {
    this.errorCounts.delete(pipelineId);
    this.lastErrorTimes.delete(pipelineId);
    this.temporarilyBlockedPipelines.delete(pipelineId);
    this.blacklistedPipelines.delete(pipelineId);
    
    secureLogger.info('✅ 流水线错误计数已清除', { pipelineId });
    
    this.emit('pipelineReactivated', { pipelineId });
  }
  
  /**
   * 获取调度器状态
   */
  getStatus(): any {
    return this.getSchedulerStats();
  }
}

// 重新导出接口类型以供外部使用
export { ScheduleRequest, ScheduleResponse } from '../interfaces/scheduler/dynamic-scheduler';