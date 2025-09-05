/**
 * 负载均衡器实现
 * 
 * 负责在同一Provider.Model的多个APIKey流水线之间进行负载均衡
 * 
 * RCC v4.0 架构:
 * - 轮询算法 (Round Robin)
 * - 状态感知负载均衡
 * - 流水线健康检查
 * - 性能指标追踪
 * 
 * @author RCC v4.0
 */

import { EventEmitter } from 'events';
import { PipelineManager } from '../pipeline/pipeline-manager';
import { PipelineTableManager, RoutingTable } from '../pipeline/pipeline-table-manager';
import { secureLogger } from '../utils/secure-logger';

/**
 * 负载均衡统计信息
 */
export interface LoadBalancingStats {
  totalRoutes: number;
  selections: Record<string, number>;
  pipelineHealth: Record<string, boolean>;
  averageResponseTime: Record<string, number>;
  errorRates: Record<string, number>;
}

/**
 * 流水线权重信息
 */
export interface PipelineWeight {
  pipelineId: string;
  weight: number;
  isHealthy: boolean;
  lastResponseTime: number;
  errorCount: number;
  totalRequests: number;
}

/**
 * 负载均衡策略
 */
export type LoadBalancingStrategy = 'round_robin' | 'weighted' | 'least_connections' | 'response_time';

/**
 * 负载均衡器配置
 */
export interface LoadBalancerConfig {
  strategy: LoadBalancingStrategy;
  healthCheckInterval: number; // 毫秒
  responseTimeWindow: number; // 响应时间窗口大小
  errorRateThreshold: number; // 错误率阈值 (0-1)
  enableHealthCheck: boolean;
  enableMetrics: boolean;
}

/**
 * 默认负载均衡器配置
 */
export const DEFAULT_LOAD_BALANCER_CONFIG: LoadBalancerConfig = {
  strategy: 'round_robin',
  healthCheckInterval: 30000, // 30秒
  responseTimeWindow: 100, // 最近100个请求
  errorRateThreshold: 0.1, // 10%错误率
  enableHealthCheck: true,
  enableMetrics: true
};

/**
 * 负载均衡器
 */
export class LoadBalancer extends EventEmitter {
  private pipelineManager: PipelineManager;
  private pipelineTableManager?: PipelineTableManager;
  private config: LoadBalancerConfig;
  
  // 轮询计数器
  private roundRobinCounters = new Map<string, number>();
  
  // 流水线权重信息
  private pipelineWeights = new Map<string, PipelineWeight>();
  
  // 性能指标
  private responseTimeHistory = new Map<string, number[]>();
  private requestCounts = new Map<string, number>();
  private errorCounts = new Map<string, number>();
  
  // 流水线黑名单管理
  private blacklistedPipelines = new Set<string>();
  private temporarilyBlockedPipelines = new Map<string, number>(); // pipelineId -> blockUntilTimestamp
  
  // 健康检查定时器
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(pipelineManager: PipelineManager, config: LoadBalancerConfig = DEFAULT_LOAD_BALANCER_CONFIG, pipelineTableManager?: PipelineTableManager) {
    super();
    this.pipelineManager = pipelineManager;
    this.pipelineTableManager = pipelineTableManager;
    this.config = { ...DEFAULT_LOAD_BALANCER_CONFIG, ...config };
    
    this.initializeLoadBalancer();
  }

  /**
   * 初始化负载均衡器
   */
  private initializeLoadBalancer(): void {
    secureLogger.info('🚀 Initializing Load Balancer', {
      strategy: this.config.strategy,
      healthCheckEnabled: this.config.enableHealthCheck,
      metricsEnabled: this.config.enableMetrics
    });

    // 启动健康检查
    if (this.config.enableHealthCheck) {
      this.startHealthCheck();
    }

    // 监听Pipeline Manager事件
    this.pipelineManager.on('pipelineSystemInitialized', (data) => {
      this.onPipelineSystemInitialized(data);
    });

    this.pipelineManager.on('executionCompleted', (data) => {
      this.onExecutionCompleted(data);
    });

    this.pipelineManager.on('executionFailed', (data) => {
      this.onExecutionFailed(data);
    });

    secureLogger.info('✅ Load Balancer initialized successfully');
  }

  /**
   * 选择流水线进行负载均衡
   */
  selectPipeline(availablePipelines: string[]): string {
    if (availablePipelines.length === 0) {
      throw new Error('No available pipelines for load balancing');
    }

    if (availablePipelines.length === 1) {
      return availablePipelines[0];
    }

    let selectedPipeline: string;

    switch (this.config.strategy) {
      case 'round_robin':
        selectedPipeline = this.selectRoundRobin(availablePipelines);
        break;
      case 'weighted':
        selectedPipeline = this.selectWeighted(availablePipelines);
        break;
      case 'least_connections':
        selectedPipeline = this.selectLeastConnections(availablePipelines);
        break;
      case 'response_time':
        selectedPipeline = this.selectByResponseTime(availablePipelines);
        break;
      default:
        selectedPipeline = this.selectRoundRobin(availablePipelines);
        break;
    }

    // 记录选择结果
    this.recordSelection(selectedPipeline, availablePipelines);

    return selectedPipeline;
  }

  /**
   * 从Category级别的流水线池中选择流水线
   * 这是解决流水线切换问题的关键方法
   */
  selectPipelineFromCategory(virtualModel: string, excludePipelines: string[] = []): string {
    if (!this.pipelineTableManager) {
      throw new Error('PipelineTableManager not available - cannot access category pipeline pool');
    }

    // 获取当前category的完整流水线池
    const routingTable = this.pipelineTableManager.getCachedRoutingTable();
    if (!routingTable || !routingTable.pipelinesGroupedByVirtualModel[virtualModel]) {
      throw new Error(`No pipelines available for virtual model: ${virtualModel}`);
    }

    // 获取该category的所有流水线ID
    const categoryPipelines = routingTable.pipelinesGroupedByVirtualModel[virtualModel]
      .map((pipeline: { pipelineId: string }) => pipeline.pipelineId);

    // 过滤出健康的可用流水线（排除黑名单、临时阻塞和指定排除的）
    const healthyPipelines = categoryPipelines.filter((pipelineId: string) => {
      if (excludePipelines.includes(pipelineId)) return false;
      if (this.blacklistedPipelines.has(pipelineId)) return false;
      if (this.isTemporarilyBlocked(pipelineId)) return false;
      return this.isPipelineHealthy(pipelineId);
    });

    if (healthyPipelines.length === 0) {
      // 如果没有健康流水线，尝试解除一些临时阻塞的流水线
      this.cleanExpiredBlocks();
      
      const recheckedPipelines = categoryPipelines.filter((pipelineId: string) => {
        if (excludePipelines.includes(pipelineId)) return false;
        if (this.blacklistedPipelines.has(pipelineId)) return false;
        if (this.isTemporarilyBlocked(pipelineId)) return false;
        return true; // 不再检查健康状态，给机会重试
      });
      
      if (recheckedPipelines.length === 0) {
        throw new Error(`No available pipelines in category ${virtualModel} after filtering blacklist and exclusions`);
      }
      
      secureLogger.warn('🔄 Using potentially unhealthy pipelines due to no healthy alternatives', {
        virtualModel,
        availablePipelines: recheckedPipelines,
        blacklistedCount: this.blacklistedPipelines.size,
        temporarilyBlockedCount: this.temporarilyBlockedPipelines.size
      });
      
      return this.selectFromPipelines(recheckedPipelines);
    }

    secureLogger.info('⚖️  Category-level load balancing', {
      virtualModel,
      totalInCategory: categoryPipelines.length,
      healthyAvailable: healthyPipelines.length,
      excludedCount: excludePipelines.length,
      blacklistedCount: this.blacklistedPipelines.size,
      strategy: this.config.strategy
    });

    return this.selectFromPipelines(healthyPipelines);
  }

  /**
   * 从指定的流水线列表中选择一个
   */
  private selectFromPipelines(pipelines: string[]): string {
    if (pipelines.length === 1) {
      return pipelines[0];
    }

    // 使用配置的负载均衡策略
    return this.selectPipeline(pipelines);
  }

  /**
   * 轮询选择算法
   */
  private selectRoundRobin(availablePipelines: string[]): string {
    // 按流水线列表排序后轮询
    const sortedPipelines = availablePipelines
      .filter(id => this.isPipelineHealthy(id))
      .sort();

    if (sortedPipelines.length === 0) {
      // 如果没有健康的流水线，使用原始列表
      return availablePipelines[0];
    }

    const routeKey = sortedPipelines.join(',');
    const currentIndex = this.roundRobinCounters.get(routeKey) || 0;
    const selectedPipeline = sortedPipelines[currentIndex % sortedPipelines.length];

    this.roundRobinCounters.set(routeKey, currentIndex + 1);

    secureLogger.info(`⚖️  Round Robin selected: ${selectedPipeline} (${currentIndex % sortedPipelines.length + 1}/${sortedPipelines.length})`);
    return selectedPipeline;
  }

  /**
   * 加权选择算法
   */
  private selectWeighted(availablePipelines: string[]): string {
    const healthyPipelines = availablePipelines.filter(id => this.isPipelineHealthy(id));
    
    if (healthyPipelines.length === 0) {
      return availablePipelines[0];
    }

    // 计算总权重
    let totalWeight = 0;
    const weights: { pipelineId: string; weight: number }[] = [];

    for (const pipelineId of healthyPipelines) {
      const weight = this.calculatePipelineWeight(pipelineId);
      weights.push({ pipelineId, weight });
      totalWeight += weight;
    }

    if (totalWeight === 0) {
      return healthyPipelines[0];
    }

    // 加权随机选择
    let random = Math.random() * totalWeight;
    for (const { pipelineId, weight } of weights) {
      random -= weight;
      if (random <= 0) {
        secureLogger.info(`⚖️  Weighted selected: ${pipelineId} (weight: ${weight})`);
        return pipelineId;
      }
    }

    return healthyPipelines[0];
  }

  /**
   * 最少连接数选择算法
   */
  private selectLeastConnections(availablePipelines: string[]): string {
    const healthyPipelines = availablePipelines.filter(id => this.isPipelineHealthy(id));
    
    if (healthyPipelines.length === 0) {
      return availablePipelines[0];
    }

    // 选择当前连接数最少的流水线
    let selectedPipeline = healthyPipelines[0];
    let minConnections = this.getActiveConnections(selectedPipeline);

    for (const pipelineId of healthyPipelines) {
      const connections = this.getActiveConnections(pipelineId);
      if (connections < minConnections) {
        minConnections = connections;
        selectedPipeline = pipelineId;
      }
    }

    secureLogger.info(`⚖️  Least Connections selected: ${selectedPipeline} (connections: ${minConnections})`);
    return selectedPipeline;
  }

  /**
   * 响应时间选择算法
   */
  private selectByResponseTime(availablePipelines: string[]): string {
    const healthyPipelines = availablePipelines.filter(id => this.isPipelineHealthy(id));
    
    if (healthyPipelines.length === 0) {
      return availablePipelines[0];
    }

    // 选择平均响应时间最短的流水线
    let selectedPipeline = healthyPipelines[0];
    let minResponseTime = this.getAverageResponseTime(selectedPipeline);

    for (const pipelineId of healthyPipelines) {
      const responseTime = this.getAverageResponseTime(pipelineId);
      if (responseTime < minResponseTime) {
        minResponseTime = responseTime;
        selectedPipeline = pipelineId;
      }
    }

    secureLogger.info(`⚖️  Response Time selected: ${selectedPipeline} (avg: ${minResponseTime}ms)`);
    return selectedPipeline;
  }

  /**
   * 检查流水线是否健康
   */
  private isPipelineHealthy(pipelineId: string): boolean {
    const weight = this.pipelineWeights.get(pipelineId);
    if (!weight) {
      // 新流水线默认健康
      return true;
    }

    // 基于错误率判断健康状态
    const errorRate = weight.totalRequests > 0 ? weight.errorCount / weight.totalRequests : 0;
    return errorRate < this.config.errorRateThreshold;
  }

  /**
   * 检查流水线是否被临时阻塞
   */
  private isTemporarilyBlocked(pipelineId: string): boolean {
    const blockUntil = this.temporarilyBlockedPipelines.get(pipelineId);
    if (!blockUntil) return false;
    
    if (Date.now() >= blockUntil) {
      // 阻塞时间已过，自动恢复
      this.temporarilyBlockedPipelines.delete(pipelineId);
      secureLogger.info('🔄 Pipeline automatically recovered from temporary block', {
        pipelineId,
        blockedUntil: new Date(blockUntil).toISOString()
      });
      return false;
    }
    
    return true;
  }

  /**
   * 清理过期的临时阻塞
   */
  private cleanExpiredBlocks(): void {
    const now = Date.now();
    const expiredBlocks: string[] = [];
    
    for (const [pipelineId, blockUntil] of this.temporarilyBlockedPipelines) {
      if (now >= blockUntil) {
        expiredBlocks.push(pipelineId);
      }
    }
    
    for (const pipelineId of expiredBlocks) {
      this.temporarilyBlockedPipelines.delete(pipelineId);
      secureLogger.info('🔄 Cleaned expired pipeline block', { pipelineId });
    }
  }

  /**
   * 标记流水线为临时阻塞
   */
  public temporarilyBlockPipeline(pipelineId: string, durationMs: number = 30000): void {
    const blockUntil = Date.now() + durationMs;
    this.temporarilyBlockedPipelines.set(pipelineId, blockUntil);
    
    secureLogger.warn('⏸️ Pipeline temporarily blocked', {
      pipelineId,
      duration: durationMs,
      blockUntil: new Date(blockUntil).toISOString(),
      reason: 'Load balancer health management'
    });
  }

  /**
   * 将流水线加入黑名单
   */
  public blacklistPipeline(pipelineId: string, reason: string): void {
    this.blacklistedPipelines.add(pipelineId);
    
    secureLogger.error('🚫 Pipeline blacklisted', {
      pipelineId,
      reason,
      totalBlacklisted: this.blacklistedPipelines.size
    });
  }

  /**
   * 从黑名单中移除流水线
   */
  public unblacklistPipeline(pipelineId: string): void {
    if (this.blacklistedPipelines.delete(pipelineId)) {
      secureLogger.info('✅ Pipeline removed from blacklist', {
        pipelineId,
        remainingBlacklisted: this.blacklistedPipelines.size
      });
    }
  }

  /**
   * 计算流水线权重
   */
  private calculatePipelineWeight(pipelineId: string): number {
    const weight = this.pipelineWeights.get(pipelineId);
    if (!weight) {
      return 100; // 默认权重
    }

    // 基于响应时间和错误率计算权重
    const errorRate = weight.totalRequests > 0 ? weight.errorCount / weight.totalRequests : 0;
    const responseTimeFactor = weight.lastResponseTime > 0 ? 1000 / weight.lastResponseTime : 1;
    const errorFactor = Math.max(0.1, 1 - errorRate * 2); // 错误率越高权重越低

    return Math.floor(responseTimeFactor * errorFactor * 100);
  }

  /**
   * 获取活跃连接数
   */
  private getActiveConnections(pipelineId: string): number {
    const activeExecutions = this.pipelineManager.getActiveExecutions();
    return activeExecutions.filter(exec => exec.pipelineId === pipelineId).length;
  }

  /**
   * 获取平均响应时间
   */
  private getAverageResponseTime(pipelineId: string): number {
    const history = this.responseTimeHistory.get(pipelineId) || [];
    if (history.length === 0) {
      return 1000; // 默认1秒
    }

    const sum = history.reduce((total, time) => total + time, 0);
    return sum / history.length;
  }

  /**
   * 记录选择结果
   */
  private recordSelection(selectedPipeline: string, availablePipelines: string[]): void {
    if (!this.config.enableMetrics) {
      return;
    }

    // 更新请求计数
    const currentCount = this.requestCounts.get(selectedPipeline) || 0;
    this.requestCounts.set(selectedPipeline, currentCount + 1);

    // 更新流水线权重信息
    const weight = this.pipelineWeights.get(selectedPipeline);
    if (weight) {
      weight.totalRequests++;
    } else {
      this.pipelineWeights.set(selectedPipeline, {
        pipelineId: selectedPipeline,
        weight: 100,
        isHealthy: true,
        lastResponseTime: 1000,
        errorCount: 0,
        totalRequests: 1
      });
    }

    this.emit('pipelineSelected', {
      selectedPipeline,
      availablePipelines,
      strategy: this.config.strategy,
      timestamp: new Date()
    });
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);

    secureLogger.info(`⏰ Health check started (interval: ${this.config.healthCheckInterval}ms)`);
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const allPipelines = this.pipelineManager.getAllPipelines();
      
      for (const [pipelineId, pipeline] of allPipelines) {
        try {
          const isHealthy = await pipeline.healthCheck();
          const weight = this.pipelineWeights.get(pipelineId);
          
          if (weight) {
            weight.isHealthy = isHealthy;
          }

          if (!isHealthy) {
            secureLogger.warn(`⚠️  Pipeline ${pipelineId} failed health check`);
          }

        } catch (error) {
          secureLogger.error(`❌ Health check error for ${pipelineId}:`, { error: error.message });
          
          const weight = this.pipelineWeights.get(pipelineId);
          if (weight) {
            weight.isHealthy = false;
          }
        }
      }

    } catch (error) {
      secureLogger.error('❌ Health check failed:', { error: error.message });
    }
  }

  /**
   * 获取负载均衡统计信息
   */
  getLoadBalancingStats(): LoadBalancingStats {
    const stats: LoadBalancingStats = {
      totalRoutes: this.roundRobinCounters.size,
      selections: {},
      pipelineHealth: {},
      averageResponseTime: {},
      errorRates: {}
    };

    // 选择统计
    for (const [routeKey, count] of this.roundRobinCounters) {
      stats.selections[routeKey] = count;
    }

    // 健康状态和性能统计
    for (const [pipelineId, weight] of this.pipelineWeights) {
      stats.pipelineHealth[pipelineId] = weight.isHealthy;
      stats.averageResponseTime[pipelineId] = this.getAverageResponseTime(pipelineId);
      stats.errorRates[pipelineId] = weight.totalRequests > 0 ? weight.errorCount / weight.totalRequests : 0;
    }

    return stats;
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.roundRobinCounters.clear();
    this.responseTimeHistory.clear();
    this.requestCounts.clear();
    this.errorCounts.clear();
    this.pipelineWeights.clear();
    
    secureLogger.info('🔄 Load Balancer stats reset');
  }

  /**
   * 停止负载均衡器
   */
  stop(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    this.removeAllListeners();
    secureLogger.info('🛑 Load Balancer stopped');
  }

  // === 事件处理器 ===

  private onPipelineSystemInitialized(data: { systemId: string; pipelines: string[]; timestamp: string; totalPipelines?: number; createdPipelines?: string[] }): void {
    secureLogger.info('🔧 Pipeline system initialized, updating load balancer', {
      totalPipelines: data.totalPipelines || data.pipelines.length
    });

    // 初始化所有流水线的权重信息
    const pipelinesToInit = data.createdPipelines || data.pipelines;
    for (const pipelineId of pipelinesToInit) {
      this.pipelineWeights.set(pipelineId, {
        pipelineId,
        weight: 100,
        isHealthy: true,
        lastResponseTime: 1000,
        errorCount: 0,
        totalRequests: 0
      });
    }
  }

  private onExecutionCompleted(data: { pipelineId: string; responseTime: number; success: boolean; timestamp: string; executionResult?: any }): void {
    if (!this.config.enableMetrics) {
      return;
    }

    const pipelineId = data.executionResult?.executionRecord?.pipelineId || data.pipelineId;
    const responseTime = data.executionResult?.performance?.totalTime || data.responseTime;

    // 更新响应时间历史
    const history = this.responseTimeHistory.get(pipelineId) || [];
    history.push(responseTime);
    
    // 保持历史记录在窗口大小内
    if (history.length > this.config.responseTimeWindow) {
      history.shift();
    }
    
    this.responseTimeHistory.set(pipelineId, history);

    // 更新流水线权重信息
    const weight = this.pipelineWeights.get(pipelineId);
    if (weight) {
      weight.lastResponseTime = responseTime;
    }
  }

  private onExecutionFailed(data: { pipelineId: string; error: string; timestamp: string; errorType?: string; executionResult?: any }): void {
    if (!this.config.enableMetrics) {
      return;
    }

    const pipelineId = data.executionResult?.executionRecord?.pipelineId || data.pipelineId;
    
    // 更新错误计数
    const currentErrorCount = this.errorCounts.get(pipelineId) || 0;
    this.errorCounts.set(pipelineId, currentErrorCount + 1);

    // 更新流水线权重信息
    const weight = this.pipelineWeights.get(pipelineId);
    if (weight) {
      weight.errorCount++;
    }
  }
}