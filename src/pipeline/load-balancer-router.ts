/**
 * 负载均衡路由系统 - Load Balancer Router
 * 
 * 核心职责 (基于用户纠正):
 * 1. 只路由请求，不组装流水线
 * 2. 根据配置在当前category下选择有效的流水线发送request
 * 3. 错误处理策略:
 *    - 不可恢复的流水线错误 → 销毁流水线
 *    - 可以等待的错误 → 暂时不处理
 *    - 多次连续错误 → 拉黑
 *    - 认证问题 → 临时拉黑，调用认证处理流程
 * 
 * @author RCC v4.0 Architecture Team
 */

import { EventEmitter } from 'events';
import { secureLogger } from '../utils/secure-logger';
import { CompletePipeline } from './pipeline-manager';
import {
  LoadBalancerRouteError,
  PipelineExecutionError,
  AuthenticationError,
  RateLimitError,
  NetworkError,
  UnrecoverableError
} from './load-balancer-errors';

/**
 * 流水线错误类型
 */
export enum PipelineErrorType {
  UNRECOVERABLE = 'unrecoverable',    // 不可恢复 - 销毁流水线
  RECOVERABLE = 'recoverable',        // 可等待 - 暂不处理
  AUTHENTICATION = 'authentication',  // 认证问题 - 临时拉黑+处理
  RATE_LIMIT = 'rate_limit',         // 限流 - 暂不处理
  NETWORK = 'network'                // 网络问题 - 可重试
}

/**
 * 流水线状态
 */
export interface PipelineStatus {
  pipelineId: string;
  isAvailable: boolean;
  isBlacklisted: boolean;
  errorCount: number;
  lastErrorTime?: number;
  blacklistUntil?: number;
  errorType?: PipelineErrorType;
}

/**
 * 负载均衡策略
 */
export enum LoadBalanceStrategy {
  ROUND_ROBIN = 'round_robin',
  LEAST_CONNECTIONS = 'least_connections', 
  RANDOM = 'random',
  PRIORITY_BASED = 'priority_based'
}

/**
 * 路由请求接口
 */
export interface RouteRequest {
  requestId: string;
  category: string;
  virtualModel?: string;
  request: any;
  metadata?: {
    priority?: number;
    timeout?: number;
    retries?: number;
  };
}

/**
 * 路由响应接口
 */
export interface RouteResponse {
  requestId: string;
  pipelineId: string;
  response: any;
  processingTime: number;
  success: boolean;
  error?: any;
}

/**
 * 负载均衡路由系统
 * 
 * 只负责请求路由，不负责流水线组装
 */
export class LoadBalancerRouter extends EventEmitter {
  private availablePipelines: Map<string, CompletePipeline> = new Map();
  private pipelineStatuses: Map<string, PipelineStatus> = new Map();
  private categoryPipelines: Map<string, string[]> = new Map(); // category -> pipelineIds
  private currentRoundRobinIndex: Map<string, number> = new Map(); // category -> index
  
  private config = {
    strategy: LoadBalanceStrategy.ROUND_ROBIN,
    maxErrorCount: 3,        // 连续错误次数后拉黑
    blacklistDuration: 300000, // 拉黑时长 (5分钟)
    authRetryDelay: 60000,   // 认证问题重试延迟 (1分钟)
    healthCheckInterval: 30000 // 健康检查间隔 (30秒)
  };

  constructor(config?: Partial<typeof LoadBalancerRouter.prototype.config>) {
    super();
    
    if (config) {
      this.config = { ...this.config, ...config };
    }

    secureLogger.info('🔀 负载均衡路由系统初始化', {
      strategy: this.config.strategy,
      maxErrorCount: this.config.maxErrorCount,
      blacklistDuration: this.config.blacklistDuration
    });

    // 启动定期健康检查
    this.startHealthCheck();
  }

  /**
   * 注册流水线到负载均衡系统
   */
  registerPipeline(pipeline: CompletePipeline, category: string): void {
    const pipelineId = pipeline.pipelineId;
    
    this.availablePipelines.set(pipelineId, pipeline);
    this.pipelineStatuses.set(pipelineId, {
      pipelineId,
      isAvailable: true,
      isBlacklisted: false,
      errorCount: 0
    });

    // 添加到类别映射
    if (!this.categoryPipelines.has(category)) {
      this.categoryPipelines.set(category, []);
    }
    this.categoryPipelines.get(category)!.push(pipelineId);

    secureLogger.info('📋 流水线注册到负载均衡系统', {
      pipelineId,
      category,
      totalPipelines: this.availablePipelines.size
    });

    this.emit('pipelineRegistered', { pipelineId, category });
  }

  /**
   * 核心路由方法 - 选择流水线并路由请求
   */
  async routeRequest(routeRequest: RouteRequest): Promise<RouteResponse> {
    const { requestId, category, request } = routeRequest;
    const startTime = Date.now();

    secureLogger.debug('🔀 开始路由请求', {
      requestId,
      category,
      strategy: this.config.strategy
    });

    try {
      // 1. 选择可用的流水线
      const selectedPipelineId = this.selectAvailablePipeline(category);
      
      if (!selectedPipelineId) {
        throw new LoadBalancerRouteError(
          `No available pipelines for category: ${category}`,
          requestId,
          category
        );
      }

      const pipeline = this.availablePipelines.get(selectedPipelineId)!;

      secureLogger.info('✅ 流水线选择成功', {
        requestId,
        selectedPipelineId,
        category
      });

      // 2. 执行请求
      const response = await this.executeRequestOnPipeline(pipeline, request, requestId);
      
      // 3. 更新成功统计
      this.updatePipelineSuccess(selectedPipelineId);

      const processingTime = Date.now() - startTime;
      
      const routeResponse: RouteResponse = {
        requestId,
        pipelineId: selectedPipelineId,
        response,
        processingTime,
        success: true
      };

      secureLogger.info('🎉 请求路由成功', {
        requestId,
        pipelineId: selectedPipelineId,
        processingTime: `${processingTime}ms`
      });

      this.emit('routeSuccess', routeResponse);
      return routeResponse;

    } catch (cause) {
      const processingTime = Date.now() - startTime;
      
      // 处理路由错误
      await this.handleRoutingError(cause, routeRequest);

      const routeResponse: RouteResponse = {
        requestId,
        pipelineId: 'unknown',
        response: null,
        processingTime,
        success: false,
        error: cause.message
      };

      secureLogger.error('❌ 请求路由失败', {
        requestId,
        category,
        error: cause.message,
        processingTime: `${processingTime}ms`
      });

      this.emit('routeError', routeResponse);
      return routeResponse;
    }
  }

  /**
   * 选择可用的流水线 (负载均衡算法)
   */
  private selectAvailablePipeline(category: string): string | null {
    const categoryPipelineIds = this.categoryPipelines.get(category) || [];
    
    // 过滤出可用的流水线
    const availablePipelineIds = categoryPipelineIds.filter(pipelineId => {
      const status = this.pipelineStatuses.get(pipelineId);
      return status?.isAvailable && !status.isBlacklisted;
    });

    if (availablePipelineIds.length === 0) {
      return null;
    }

    // 根据负载均衡策略选择
    switch (this.config.strategy) {
      case LoadBalanceStrategy.ROUND_ROBIN:
        return this.selectRoundRobin(category, availablePipelineIds);
      
      case LoadBalanceStrategy.RANDOM:
        return this.selectRandom(availablePipelineIds);
      
      case LoadBalanceStrategy.PRIORITY_BASED:
        return this.selectPriorityBased(availablePipelineIds);
      
      default:
        return this.selectRoundRobin(category, availablePipelineIds);
    }
  }

  /**
   * 轮询选择算法
   */
  private selectRoundRobin(category: string, availablePipelineIds: string[]): string {
    const currentIndex = this.currentRoundRobinIndex.get(category) || 0;
    const selectedPipelineId = availablePipelineIds[currentIndex % availablePipelineIds.length];
    
    // 更新下一次的索引
    this.currentRoundRobinIndex.set(category, (currentIndex + 1) % availablePipelineIds.length);
    
    return selectedPipelineId;
  }

  /**
   * 随机选择算法
   */
  private selectRandom(availablePipelineIds: string[]): string {
    const randomIndex = Math.floor(Math.random() * availablePipelineIds.length);
    return availablePipelineIds[randomIndex];
  }

  /**
   * 优先级选择算法 (选择错误最少的)
   */
  private selectPriorityBased(availablePipelineIds: string[]): string {
    let bestPipelineId = availablePipelineIds[0];
    let lowestErrorCount = Number.MAX_SAFE_INTEGER;

    for (const pipelineId of availablePipelineIds) {
      const status = this.pipelineStatuses.get(pipelineId);
      if (status && status.errorCount < lowestErrorCount) {
        lowestErrorCount = status.errorCount;
        bestPipelineId = pipelineId;
      }
    }

    return bestPipelineId;
  }

  /**
   * 在流水线上执行请求
   */
  private async executeRequestOnPipeline(
    pipeline: CompletePipeline, 
    request: any, 
    requestId: string
  ): Promise<any> {
    try {
      return await pipeline.execute(request);
    } catch (cause) {
      // 分析错误类型并相应处理
      const errorType = this.analyzeErrorType(cause);
      const specificError = this.createSpecificError(cause, pipeline.pipelineId, requestId, errorType);
      
      await this.handlePipelineError(pipeline.pipelineId, specificError, errorType);
      throw specificError;
    }
  }

  /**
   * 分析错误类型
   */
  private analyzeErrorType(error: any): PipelineErrorType {
    const errorMessage = error.message?.toLowerCase() || '';
    
    if (errorMessage.includes('unauthorized') || errorMessage.includes('invalid api key')) {
      return PipelineErrorType.AUTHENTICATION;
    }
    
    if (errorMessage.includes('rate limit') || errorMessage.includes('quota exceeded')) {
      return PipelineErrorType.RATE_LIMIT;
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return PipelineErrorType.NETWORK;
    }
    
    if (errorMessage.includes('invalid model') || errorMessage.includes('not supported')) {
      return PipelineErrorType.UNRECOVERABLE;
    }
    
    return PipelineErrorType.RECOVERABLE;
  }

  /**
   * 创建具体类型的错误
   */
  private createSpecificError(
    cause: any, 
    pipelineId: string, 
    requestId: string, 
    errorType: PipelineErrorType
  ): Error {
    switch (errorType) {
      case PipelineErrorType.AUTHENTICATION:
        return new AuthenticationError(`Authentication failed: ${cause.message}`, pipelineId);
      
      case PipelineErrorType.RATE_LIMIT:
        return new RateLimitError(`Rate limit exceeded: ${cause.message}`, pipelineId);
      
      case PipelineErrorType.NETWORK:
        return new NetworkError(`Network error: ${cause.message}`, pipelineId, cause);
      
      case PipelineErrorType.UNRECOVERABLE:
        return new UnrecoverableError(`Unrecoverable error: ${cause.message}`, pipelineId, cause);
      
      default:
        return new PipelineExecutionError(`Pipeline execution failed: ${cause.message}`, pipelineId, requestId);
    }
  }

  /**
   * 处理流水线错误 (核心错误处理策略)
   */
  private async handlePipelineError(
    pipelineId: string, 
    error: Error, 
    errorType: PipelineErrorType
  ): Promise<void> {
    const status = this.pipelineStatuses.get(pipelineId);
    if (!status) return;

    status.errorCount++;
    status.lastErrorTime = Date.now();
    status.errorType = errorType;

    secureLogger.warn('⚠️ 流水线错误处理', {
      pipelineId,
      errorType,
      errorCount: status.errorCount,
      maxErrorCount: this.config.maxErrorCount
    });

    switch (errorType) {
      case PipelineErrorType.UNRECOVERABLE:
        // 不可恢复的流水线错误 → 销毁流水线
        await this.destroyPipeline(pipelineId);
        break;

      case PipelineErrorType.AUTHENTICATION:
        // 认证时临时拉黑，调用认证处理流程
        status.isBlacklisted = true;
        status.blacklistUntil = Date.now() + this.config.authRetryDelay;
        this.emit('authenticationRequired', { pipelineId });
        break;

      case PipelineErrorType.RATE_LIMIT:
      case PipelineErrorType.RECOVERABLE:
        // 可以等待的错误暂时不处理
        if (status.errorCount >= this.config.maxErrorCount) {
          // 多次连续错误拉黑
          status.isBlacklisted = true;
          status.blacklistUntil = Date.now() + this.config.blacklistDuration;
          secureLogger.warn('🚫 流水线已拉黑', { pipelineId, duration: this.config.blacklistDuration });
        }
        break;

      case PipelineErrorType.NETWORK:
        // 网络问题，如果连续失败则暂时拉黑
        if (status.errorCount >= 2) {
          status.isBlacklisted = true;
          status.blacklistUntil = Date.now() + 60000; // 1分钟
        }
        break;
    }

    this.emit('pipelineError', { pipelineId, error, errorType, status });
  }

  /**
   * 处理路由错误
   */
  private async handleRoutingError(error: any, routeRequest: RouteRequest): Promise<void> {
    secureLogger.error('❌ 路由系统错误', {
      requestId: routeRequest.requestId,
      category: routeRequest.category,
      error: error.message
    });

    // 可以在这里添加更多的路由级别错误处理逻辑
  }

  /**
   * 更新流水线成功统计
   */
  private updatePipelineSuccess(pipelineId: string): void {
    const status = this.pipelineStatuses.get(pipelineId);
    if (status) {
      // 重置错误计数
      status.errorCount = 0;
      status.errorType = undefined;
    }
  }

  /**
   * 销毁流水线 (由PipelineManager处理)
   */
  private async destroyPipeline(pipelineId: string): Promise<void> {
    const pipeline = this.availablePipelines.get(pipelineId);
    if (!pipeline) return;

    try {
      // 从负载均衡系统移除
      this.availablePipelines.delete(pipelineId);
      this.pipelineStatuses.delete(pipelineId);
      
      // 从类别映射中移除
      for (const [category, pipelineIds] of this.categoryPipelines.entries()) {
        const index = pipelineIds.indexOf(pipelineId);
        if (index > -1) {
          pipelineIds.splice(index, 1);
        }
      }

      secureLogger.info('🗑️ 流水线已从负载均衡系统移除', { pipelineId });
      
      // 通知PipelineManager销毁实际的流水线
      this.emit('destroyPipelineRequired', { pipelineId, pipeline });

    } catch (cause) {
      const destroyError = new UnrecoverableError(
        `Pipeline destruction failed: ${cause.message}`,
        pipelineId,
        cause
      );
      secureLogger.error('❌ 流水线销毁失败', { pipelineId, error: destroyError.message });
    }
  }

  /**
   * 定期健康检查
   */
  private startHealthCheck(): void {
    setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    const now = Date.now();
    
    for (const [pipelineId, status] of this.pipelineStatuses.entries()) {
      // 检查拉黑状态是否应该解除
      if (status.isBlacklisted && status.blacklistUntil && now > status.blacklistUntil) {
        status.isBlacklisted = false;
        status.blacklistUntil = undefined;
        status.errorCount = 0;
        
        secureLogger.info('✅ 流水线拉黑状态已解除', { pipelineId });
        this.emit('pipelineReactivated', { pipelineId });
      }

      // 检查流水线健康状态
      const pipeline = this.availablePipelines.get(pipelineId);
      if (pipeline) {
        try {
          const isHealthy = await pipeline.healthCheck();
          status.isAvailable = isHealthy;
        } catch (cause) {
          status.isAvailable = false;
          const healthError = new NetworkError(
            `Health check failed: ${cause.message}`,
            pipelineId,
            cause
          );
          secureLogger.warn('⚠️ 流水线健康检查失败', { 
            pipelineId, 
            error: healthError.message 
          });
        }
      }
    }
  }

  /**
   * 获取负载均衡统计信息
   */
  getLoadBalancerStats() {
    const stats = {
      totalPipelines: this.availablePipelines.size,
      availablePipelines: 0,
      blacklistedPipelines: 0,
      categoriesCount: this.categoryPipelines.size,
      strategy: this.config.strategy
    };

    for (const status of this.pipelineStatuses.values()) {
      if (status.isAvailable && !status.isBlacklisted) {
        stats.availablePipelines++;
      }
      if (status.isBlacklisted) {
        stats.blacklistedPipelines++;
      }
    }

    return stats;
  }

  /**
   * 清理负载均衡系统
   */
  async cleanup(): Promise<void> {
    secureLogger.info('🧹 负载均衡路由系统清理');
    
    this.availablePipelines.clear();
    this.pipelineStatuses.clear();
    this.categoryPipelines.clear();
    this.currentRoundRobinIndex.clear();
    
    this.removeAllListeners();
  }
}