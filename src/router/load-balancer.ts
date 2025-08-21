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
  private config: LoadBalancerConfig;
  
  // 轮询计数器
  private roundRobinCounters = new Map<string, number>();
  
  // 流水线权重信息
  private pipelineWeights = new Map<string, PipelineWeight>();
  
  // 性能指标
  private responseTimeHistory = new Map<string, number[]>();
  private requestCounts = new Map<string, number>();
  private errorCounts = new Map<string, number>();
  
  // 健康检查定时器
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(pipelineManager: PipelineManager, config: LoadBalancerConfig = DEFAULT_LOAD_BALANCER_CONFIG) {
    super();
    this.pipelineManager = pipelineManager;
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

  private onPipelineSystemInitialized(data: any): void {
    secureLogger.info('🔧 Pipeline system initialized, updating load balancer', {
      totalPipelines: data.totalPipelines
    });

    // 初始化所有流水线的权重信息
    for (const pipelineId of data.createdPipelines) {
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

  private onExecutionCompleted(data: any): void {
    if (!this.config.enableMetrics) {
      return;
    }

    const pipelineId = data.executionResult.executionRecord.pipelineId;
    const responseTime = data.executionResult.performance.totalTime;

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

  private onExecutionFailed(data: any): void {
    if (!this.config.enableMetrics) {
      return;
    }

    const pipelineId = data.executionResult.executionRecord.pipelineId;
    
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