/**
 * Provider负载均衡器
 * 
 * 智能路由和Provider选择系统
 * 支持多种负载均衡策略和健康状态感知
 * 
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { IModuleInterface } from '../../interfaces/core/module-implementation-interface';

/**
 * 负载均衡策略枚举
 */
export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'round_robin',
  WEIGHTED_ROUND_ROBIN = 'weighted_round_robin', 
  LEAST_CONNECTIONS = 'least_connections',
  LEAST_RESPONSE_TIME = 'least_response_time',
  WEIGHTED_LEAST_CONNECTIONS = 'weighted_least_connections',
  RANDOM = 'random',
  WEIGHTED_RANDOM = 'weighted_random',
  HASH = 'hash',
  GEOGRAPHIC = 'geographic',
  ADAPTIVE = 'adaptive'
}

/**
 * Provider健康状态
 */
export enum ProviderHealthStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  DEGRADED = 'degraded',
  UNKNOWN = 'unknown',
  MAINTENANCE = 'maintenance'
}

/**
 * Provider实例信息
 */
export interface ProviderInstance {
  id: string;
  name: string;
  type: string; // 'anthropic', 'openai', 'gemini', 'lmstudio'
  endpoint: string;
  region?: string;
  weight: number; // 权重 (1-100)
  maxConnections: number;
  currentConnections: number;
  healthStatus: ProviderHealthStatus;
  metrics: ProviderMetrics;
  config: any;
  lastUpdated: number;
}

/**
 * Provider性能指标
 */
export interface ProviderMetrics {
  avgResponseTime: number; // 平均响应时间(ms)
  successRate: number; // 成功率 (0-1)
  requestCount: number; // 请求总数
  errorCount: number; // 错误总数
  lastResponseTime: number; // 最后响应时间
  throughput: number; // 吞吐量 (req/min)
  cpuUsage?: number; // CPU使用率
  memoryUsage?: number; // 内存使用率
}

/**
 * 负载均衡请求上下文
 */
export interface LoadBalancingContext {
  requestId: string;
  clientIp?: string;
  userAgent?: string;
  sessionId?: string;
  preferredProvider?: string;
  requiredCapabilities?: string[];
  priority: 'low' | 'normal' | 'high' | 'critical';
  timeout: number;
  retryCount: number;
  metadata?: Record<string, any>;
}

/**
 * 负载均衡结果
 */
export interface LoadBalancingResult {
  selectedProvider: ProviderInstance;
  strategy: LoadBalancingStrategy;
  selectionReason: string;
  alternatives: ProviderInstance[];
  confidence: number; // 选择信心 (0-1)
  estimatedResponseTime: number;
  timestamp: number;
}

/**
 * 负载均衡器配置
 */
export interface LoadBalancerConfig {
  strategy: LoadBalancingStrategy;
  enableHealthCheck: boolean;
  healthCheckInterval: number;
  enableAdaptive: boolean;
  adaptiveThreshold: number;
  stickySessions: boolean;
  sessionTtl: number;
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    recoveryTimeout: number;
    halfOpenMaxCalls: number;
  };
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffTime: number;
  };
  logging: {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    logSelections: boolean;
  };
}

/**
 * Provider负载均衡器
 */
export class ProviderLoadBalancer extends EventEmitter implements IModuleInterface {
  private providers: Map<string, ProviderInstance> = new Map();
  private config: LoadBalancerConfig;
  private roundRobinIndex: number = 0;
  private sessionMap: Map<string, string> = new Map(); // sessionId -> providerId
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private metricsHistory: Map<string, ProviderMetrics[]> = new Map();
  private healthCheckTimer?: NodeJS.Timeout;
  private isInitialized: boolean = false;

  constructor(config: Partial<LoadBalancerConfig> = {}) {
    super();
    
    this.config = {
      strategy: LoadBalancingStrategy.WEIGHTED_LEAST_CONNECTIONS,
      enableHealthCheck: true,
      healthCheckInterval: 30000, // 30秒
      enableAdaptive: true,
      adaptiveThreshold: 0.8,
      stickySessions: false,
      sessionTtl: 300000, // 5分钟
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        recoveryTimeout: 60000,
        halfOpenMaxCalls: 3
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        maxBackoffTime: 10000
      },
      logging: {
        enabled: true,
        logLevel: 'info',
        logSelections: true
      },
      ...config
    };
    
    this.startHealthCheck();
  }

  /**
   * 模块初始化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.log('info', 'Initializing load balancer...');
    
    // 启动健康检查
    this.startHealthCheck();
    
    // 启动会话清理
    this.startSessionCleanup();
    
    this.isInitialized = true;
    this.emit('initialized');
    
    this.log('info', 'Load balancer initialized successfully');
  }

  /**
   * 模块清理
   */
  async cleanup(): Promise<void> {
    this.log('info', 'Cleaning up load balancer...');
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
    
    this.providers.clear();
    this.sessionMap.clear();
    this.circuitBreakers.clear();
    this.metricsHistory.clear();
    
    this.isInitialized = false;
    this.emit('cleaned');
    
    this.log('info', 'Load balancer cleaned up');
  }

  /**
   * 添加Provider实例
   */
  addProvider(provider: ProviderInstance): void {
    this.providers.set(provider.id, {
      ...provider,
      currentConnections: 0,
      lastUpdated: Date.now()
    });
    
    // 初始化熔断器
    if (this.config.circuitBreaker.enabled) {
      this.circuitBreakers.set(provider.id, {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: 0,
        halfOpenCallCount: 0
      });
    }
    
    this.log('info', `Added provider: ${provider.id} (${provider.type})`);
    this.emit('providerAdded', provider);
  }

  /**
   * 移除Provider实例
   */
  removeProvider(providerId: string): boolean {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return false;
    }
    
    this.providers.delete(providerId);
    this.circuitBreakers.delete(providerId);
    this.metricsHistory.delete(providerId);
    
    // 清理会话映射
    for (const [sessionId, mappedProviderId] of this.sessionMap) {
      if (mappedProviderId === providerId) {
        this.sessionMap.delete(sessionId);
      }
    }
    
    this.log('info', `Removed provider: ${providerId}`);
    this.emit('providerRemoved', provider);
    
    return true;
  }

  /**
   * 更新Provider指标
   */
  updateProviderMetrics(providerId: string, metrics: Partial<ProviderMetrics>): void {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return;
    }
    
    // 更新指标
    provider.metrics = {
      ...provider.metrics,
      ...metrics
    };
    
    provider.lastUpdated = Date.now();
    
    // 保存历史指标
    const history = this.metricsHistory.get(providerId) || [];
    history.push({ ...provider.metrics });
    
    // 保持最近100个指标
    if (history.length > 100) {
      history.shift();
    }
    
    this.metricsHistory.set(providerId, history);
    
    // 更新健康状态
    this.updateProviderHealth(providerId);
    
    this.emit('metricsUpdated', { providerId, metrics: provider.metrics });
  }

  /**
   * 选择Provider
   */
  async selectProvider(context: LoadBalancingContext): Promise<LoadBalancingResult> {
    const availableProviders = this.getAvailableProviders(context);
    
    if (availableProviders.length === 0) {
      throw new Error('No available providers for load balancing');
    }
    
    // 检查粘性会话
    if (this.config.stickySessions && context.sessionId) {
      const stickyProvider = this.getStickyProvider(context.sessionId, availableProviders);
      if (stickyProvider) {
        return this.createResult(stickyProvider, LoadBalancingStrategy.ROUND_ROBIN, 
                                'Sticky session', availableProviders);
      }
    }
    
    // 根据策略选择Provider
    let selectedProvider: ProviderInstance;
    let strategy = this.config.strategy;
    
    // 自适应策略
    if (this.config.enableAdaptive) {
      const adaptiveStrategy = this.getAdaptiveStrategy(availableProviders);
      if (adaptiveStrategy !== strategy) {
        strategy = adaptiveStrategy;
        this.log('debug', `Switched to adaptive strategy: ${strategy}`);
      }
    }
    
    switch (strategy) {
      case LoadBalancingStrategy.ROUND_ROBIN:
        selectedProvider = this.selectRoundRobin(availableProviders);
        break;
      case LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN:
        selectedProvider = this.selectWeightedRoundRobin(availableProviders);
        break;
      case LoadBalancingStrategy.LEAST_CONNECTIONS:
        selectedProvider = this.selectLeastConnections(availableProviders);
        break;
      case LoadBalancingStrategy.LEAST_RESPONSE_TIME:
        selectedProvider = this.selectLeastResponseTime(availableProviders);
        break;
      case LoadBalancingStrategy.WEIGHTED_LEAST_CONNECTIONS:
        selectedProvider = this.selectWeightedLeastConnections(availableProviders);
        break;
      case LoadBalancingStrategy.RANDOM:
        selectedProvider = this.selectRandom(availableProviders);
        break;
      case LoadBalancingStrategy.WEIGHTED_RANDOM:
        selectedProvider = this.selectWeightedRandom(availableProviders);
        break;
      case LoadBalancingStrategy.HASH:
        selectedProvider = this.selectHash(availableProviders, context);
        break;
      default:
        selectedProvider = this.selectWeightedLeastConnections(availableProviders);
        strategy = LoadBalancingStrategy.WEIGHTED_LEAST_CONNECTIONS;
    }
    
    // 更新粘性会话
    if (this.config.stickySessions && context.sessionId) {
      this.sessionMap.set(context.sessionId, selectedProvider.id);
    }
    
    // 更新连接计数
    selectedProvider.currentConnections++;
    
    const result = this.createResult(selectedProvider, strategy, 
                                   this.getSelectionReason(strategy), availableProviders);
    
    if (this.config.logging.logSelections) {
      this.log('debug', `Selected provider: ${selectedProvider.id} using ${strategy}`);
    }
    
    this.emit('providerSelected', result);
    
    return result;
  }

  /**
   * 获取可用的Provider列表
   */
  private getAvailableProviders(context: LoadBalancingContext): ProviderInstance[] {
    const providers: ProviderInstance[] = [];
    
    for (const provider of this.providers.values()) {
      // 健康检查
      if (provider.healthStatus !== ProviderHealthStatus.HEALTHY &&
          provider.healthStatus !== ProviderHealthStatus.DEGRADED) {
        continue;
      }
      
      // 熔断器检查
      if (this.config.circuitBreaker.enabled && 
          !this.isCircuitBreakerClosed(provider.id)) {
        continue;
      }
      
      // 连接数检查
      if (provider.currentConnections >= provider.maxConnections) {
        continue;
      }
      
      // 能力检查
      if (context.requiredCapabilities && 
          !this.hasRequiredCapabilities(provider, context.requiredCapabilities)) {
        continue;
      }
      
      providers.push(provider);
    }
    
    return providers;
  }

  /**
   * 轮询选择
   */
  private selectRoundRobin(providers: ProviderInstance[]): ProviderInstance {
    const provider = providers[this.roundRobinIndex % providers.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % providers.length;
    return provider;
  }

  /**
   * 加权轮询选择
   */
  private selectWeightedRoundRobin(providers: ProviderInstance[]): ProviderInstance {
    const totalWeight = providers.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const provider of providers) {
      random -= provider.weight;
      if (random <= 0) {
        return provider;
      }
    }
    
    return providers[0]; // 回退
  }

  /**
   * 最少连接选择
   */
  private selectLeastConnections(providers: ProviderInstance[]): ProviderInstance {
    return providers.reduce((min, current) => 
      current.currentConnections < min.currentConnections ? current : min
    );
  }

  /**
   * 最短响应时间选择
   */
  private selectLeastResponseTime(providers: ProviderInstance[]): ProviderInstance {
    return providers.reduce((min, current) => 
      current.metrics.avgResponseTime < min.metrics.avgResponseTime ? current : min
    );
  }

  /**
   * 加权最少连接选择
   */
  private selectWeightedLeastConnections(providers: ProviderInstance[]): ProviderInstance {
    return providers.reduce((best, current) => {
      const currentScore = current.currentConnections / current.weight;
      const bestScore = best.currentConnections / best.weight;
      return currentScore < bestScore ? current : best;
    });
  }

  /**
   * 随机选择
   */
  private selectRandom(providers: ProviderInstance[]): ProviderInstance {
    const index = Math.floor(Math.random() * providers.length);
    return providers[index];
  }

  /**
   * 加权随机选择
   */
  private selectWeightedRandom(providers: ProviderInstance[]): ProviderInstance {
    const totalWeight = providers.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const provider of providers) {
      random -= provider.weight;
      if (random <= 0) {
        return provider;
      }
    }
    
    return providers[0]; // 回退
  }

  /**
   * 哈希选择
   */
  private selectHash(providers: ProviderInstance[], context: LoadBalancingContext): ProviderInstance {
    const hashInput = context.sessionId || context.clientIp || context.requestId;
    const hash = this.simpleHash(hashInput);
    const index = hash % providers.length;
    return providers[index];
  }

  /**
   * 获取自适应策略
   */
  private getAdaptiveStrategy(providers: ProviderInstance[]): LoadBalancingStrategy {
    // 计算系统整体负载
    const avgResponseTime = providers.reduce((sum, p) => sum + p.metrics.avgResponseTime, 0) / providers.length;
    const avgSuccessRate = providers.reduce((sum, p) => sum + p.metrics.successRate, 0) / providers.length;
    const avgLoad = providers.reduce((sum, p) => sum + p.currentConnections / p.maxConnections, 0) / providers.length;
    
    // 高负载时使用最少连接
    if (avgLoad > this.config.adaptiveThreshold) {
      return LoadBalancingStrategy.LEAST_CONNECTIONS;
    }
    
    // 响应时间差异大时使用最短响应时间
    const responseTimeVariance = this.calculateVariance(providers.map(p => p.metrics.avgResponseTime));
    if (responseTimeVariance > 1000) { // 1秒方差
      return LoadBalancingStrategy.LEAST_RESPONSE_TIME;
    }
    
    // 成功率低时使用加权策略
    if (avgSuccessRate < 0.95) {
      return LoadBalancingStrategy.WEIGHTED_LEAST_CONNECTIONS;
    }
    
    // 默认使用轮询
    return LoadBalancingStrategy.ROUND_ROBIN;
  }

  /**
   * 更新Provider健康状态
   */
  private updateProviderHealth(providerId: string): void {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return;
    }
    
    const metrics = provider.metrics;
    let newStatus = ProviderHealthStatus.HEALTHY;
    
    // 基于成功率判断健康状态
    if (metrics.successRate < 0.5) {
      newStatus = ProviderHealthStatus.UNHEALTHY;
    } else if (metrics.successRate < 0.8) {
      newStatus = ProviderHealthStatus.DEGRADED;
    }
    
    // 基于响应时间判断
    if (metrics.avgResponseTime > 10000) { // 10秒
      newStatus = ProviderHealthStatus.UNHEALTHY;
    } else if (metrics.avgResponseTime > 5000) { // 5秒
      if (newStatus === ProviderHealthStatus.HEALTHY) {
        newStatus = ProviderHealthStatus.DEGRADED;
      }
    }
    
    // 更新状态
    if (provider.healthStatus !== newStatus) {
      const oldStatus = provider.healthStatus;
      provider.healthStatus = newStatus;
      
      this.log('info', `Provider ${providerId} health changed: ${oldStatus} -> ${newStatus}`);
      this.emit('providerHealthChanged', { providerId, oldStatus, newStatus });
    }
  }

  /**
   * 检查熔断器状态
   */
  private isCircuitBreakerClosed(providerId: string): boolean {
    const breaker = this.circuitBreakers.get(providerId);
    if (!breaker) {
      return true;
    }
    
    const now = Date.now();
    
    switch (breaker.state) {
      case 'CLOSED':
        return true;
      case 'OPEN':
        // 检查是否可以进入半开状态
        if (now - breaker.lastFailureTime > this.config.circuitBreaker.recoveryTimeout) {
          breaker.state = 'HALF_OPEN';
          breaker.halfOpenCallCount = 0;
          this.log('info', `Circuit breaker for ${providerId} switched to HALF_OPEN`);
        }
        return breaker.state !== 'OPEN';
      case 'HALF_OPEN':
        return breaker.halfOpenCallCount < this.config.circuitBreaker.halfOpenMaxCalls;
      default:
        return true;
    }
  }

  /**
   * 记录请求结果（用于熔断器）
   */
  recordRequestResult(providerId: string, success: boolean): void {
    if (!this.config.circuitBreaker.enabled) {
      return;
    }
    
    const breaker = this.circuitBreakers.get(providerId);
    if (!breaker) {
      return;
    }
    
    if (success) {
      if (breaker.state === 'HALF_OPEN') {
        breaker.halfOpenCallCount++;
        if (breaker.halfOpenCallCount >= this.config.circuitBreaker.halfOpenMaxCalls) {
          breaker.state = 'CLOSED';
          breaker.failureCount = 0;
          this.log('info', `Circuit breaker for ${providerId} switched to CLOSED`);
        }
      } else {
        breaker.failureCount = Math.max(0, breaker.failureCount - 1);
      }
    } else {
      breaker.failureCount++;
      breaker.lastFailureTime = Date.now();
      
      if (breaker.failureCount >= this.config.circuitBreaker.failureThreshold) {
        breaker.state = 'OPEN';
        this.log('warn', `Circuit breaker for ${providerId} switched to OPEN`);
        this.emit('circuitBreakerOpened', { providerId });
      }
    }
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    if (!this.config.enableHealthCheck) {
      return;
    }
    
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    for (const [providerId, provider] of this.providers) {
      try {
        // 这里可以实现具体的健康检查逻辑
        // 例如发送ping请求或检查服务状态
        const isHealthy = await this.checkProviderHealth(provider);
        
        if (!isHealthy && provider.healthStatus === ProviderHealthStatus.HEALTHY) {
          provider.healthStatus = ProviderHealthStatus.UNHEALTHY;
          this.emit('providerHealthChanged', { 
            providerId, 
            oldStatus: ProviderHealthStatus.HEALTHY, 
            newStatus: ProviderHealthStatus.UNHEALTHY 
          });
        } else if (isHealthy && provider.healthStatus === ProviderHealthStatus.UNHEALTHY) {
          provider.healthStatus = ProviderHealthStatus.HEALTHY;
          this.emit('providerHealthChanged', { 
            providerId, 
            oldStatus: ProviderHealthStatus.UNHEALTHY, 
            newStatus: ProviderHealthStatus.HEALTHY 
          });
        }
      } catch (error) {
        this.log('error', `Health check failed for provider ${providerId}: ${error}`);
      }
    }
  }

  /**
   * 检查单个Provider健康状态
   */
  private async checkProviderHealth(provider: ProviderInstance): Promise<boolean> {
    // 基于指标判断健康状态
    const metrics = provider.metrics;
    
    // 成功率检查
    if (metrics.successRate < 0.7) {
      return false;
    }
    
    // 响应时间检查
    if (metrics.avgResponseTime > 15000) {
      return false;
    }
    
    // 最近活动检查
    const timeSinceLastUpdate = Date.now() - provider.lastUpdated;
    if (timeSinceLastUpdate > 300000) { // 5分钟无活动
      return false;
    }
    
    return true;
  }

  /**
   * 创建负载均衡结果
   */
  private createResult(
    selectedProvider: ProviderInstance, 
    strategy: LoadBalancingStrategy,
    reason: string,
    availableProviders: ProviderInstance[]
  ): LoadBalancingResult {
    const alternatives = availableProviders.filter(p => p.id !== selectedProvider.id);
    
    return {
      selectedProvider,
      strategy,
      selectionReason: reason,
      alternatives,
      confidence: this.calculateConfidence(selectedProvider, availableProviders),
      estimatedResponseTime: selectedProvider.metrics.avgResponseTime,
      timestamp: Date.now()
    };
  }

  /**
   * 计算选择信心度
   */
  private calculateConfidence(
    selected: ProviderInstance, 
    available: ProviderInstance[]
  ): number {
    if (available.length === 1) {
      return 1.0;
    }
    
    // 基于健康状态和性能指标计算信心度
    let confidence = 0.5; // 基础信心度
    
    // 健康状态加分
    if (selected.healthStatus === ProviderHealthStatus.HEALTHY) {
      confidence += 0.3;
    } else if (selected.healthStatus === ProviderHealthStatus.DEGRADED) {
      confidence += 0.1;
    }
    
    // 成功率加分
    confidence += selected.metrics.successRate * 0.2;
    
    // 响应时间加分（相对于平均值）
    const avgResponseTime = available.reduce((sum, p) => sum + p.metrics.avgResponseTime, 0) / available.length;
    if (selected.metrics.avgResponseTime < avgResponseTime) {
      confidence += 0.1;
    }
    
    return Math.min(1.0, confidence);
  }

  /**
   * 工具方法
   */
  private getStickyProvider(sessionId: string, available: ProviderInstance[]): ProviderInstance | null {
    const providerId = this.sessionMap.get(sessionId);
    if (!providerId) {
      return null;
    }
    
    return available.find(p => p.id === providerId) || null;
  }

  private hasRequiredCapabilities(provider: ProviderInstance, capabilities: string[]): boolean {
    // 这里可以实现具体的能力检查逻辑
    return true;
  }

  private getSelectionReason(strategy: LoadBalancingStrategy): string {
    const reasons: Record<LoadBalancingStrategy, string> = {
      [LoadBalancingStrategy.ROUND_ROBIN]: 'Round robin selection',
      [LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN]: 'Weighted round robin selection',
      [LoadBalancingStrategy.LEAST_CONNECTIONS]: 'Least connections',
      [LoadBalancingStrategy.LEAST_RESPONSE_TIME]: 'Fastest response time',
      [LoadBalancingStrategy.WEIGHTED_LEAST_CONNECTIONS]: 'Weighted least connections',
      [LoadBalancingStrategy.RANDOM]: 'Random selection',
      [LoadBalancingStrategy.WEIGHTED_RANDOM]: 'Weighted random selection',
      [LoadBalancingStrategy.HASH]: 'Hash-based selection',
      [LoadBalancingStrategy.GEOGRAPHIC]: 'Geographic selection',
      [LoadBalancingStrategy.ADAPTIVE]: 'Adaptive selection'
    };
    
    return reasons[strategy] || 'Unknown strategy';
  }

  private simpleHash(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private startSessionCleanup(): void {
    if (!this.config.stickySessions) {
      return;
    }
    
    setInterval(() => {
      const now = Date.now();
      for (const [sessionId, _] of this.sessionMap) {
        // 这里需要实现基于时间的会话清理逻辑
        // 由于我们没有存储会话创建时间，暂时跳过
      }
    }, this.config.sessionTtl);
  }

  private log(level: string, message: string): void {
    if (!this.config.logging.enabled) {
      return;
    }
    
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevel = levels.indexOf(this.config.logging.logLevel);
    const messageLevel = levels.indexOf(level);
    
    if (messageLevel >= configLevel) {
      console.log(`[LoadBalancer] ${level.toUpperCase()}: ${message}`);
    }
  }

  /**
   * 获取所有Provider状态
   */
  getAllProviders(): ProviderInstance[] {
    return Array.from(this.providers.values());
  }

  /**
   * 获取Provider统计信息
   */
  getStatistics(): LoadBalancerStatistics {
    const providers = Array.from(this.providers.values());
    
    return {
      totalProviders: providers.length,
      healthyProviders: providers.filter(p => p.healthStatus === ProviderHealthStatus.HEALTHY).length,
      degradedProviders: providers.filter(p => p.healthStatus === ProviderHealthStatus.DEGRADED).length,
      unhealthyProviders: providers.filter(p => p.healthStatus === ProviderHealthStatus.UNHEALTHY).length,
      totalConnections: providers.reduce((sum, p) => sum + p.currentConnections, 0),
      avgResponseTime: providers.reduce((sum, p) => sum + p.metrics.avgResponseTime, 0) / providers.length,
      avgSuccessRate: providers.reduce((sum, p) => sum + p.metrics.successRate, 0) / providers.length,
      activeSessions: this.sessionMap.size,
      circuitBreakersOpen: Array.from(this.circuitBreakers.values()).filter(b => b.state === 'OPEN').length
    };
  }
}

/**
 * 熔断器状态
 */
interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  halfOpenCallCount: number;
}

/**
 * 负载均衡器统计信息
 */
export interface LoadBalancerStatistics {
  totalProviders: number;
  healthyProviders: number;
  degradedProviders: number;
  unhealthyProviders: number;
  totalConnections: number;
  avgResponseTime: number;
  avgSuccessRate: number;
  activeSessions: number;
  circuitBreakersOpen: number;
}