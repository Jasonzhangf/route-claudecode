/**
 * Provider负载均衡器 - 重构版本
 *
 * 模块化的负载均衡器，通过组合各个子模块实现功能
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { IModuleInterface } from '../../../interfaces/core/module-implementation-interface';
import {
  LoadBalancingStrategy,
  ProviderInstance,
  LoadBalancingContext,
  LoadBalancingResult,
  LoadBalancerConfig,
  ProviderHealthStatus,
  LoadBalancerStatistics,
  ProviderMetrics,
  ILoadBalancingStrategy,
} from './types';
import { StrategyFactory } from './strategies';
import { HealthChecker } from './health-checker';
import { CircuitBreaker } from './circuit-breaker';
import { MetricsCollector } from './metrics-collector';
import { SessionManager } from './session-manager';

/**
 * 重构后的Provider负载均衡器
 */
export class ProviderLoadBalancer extends EventEmitter {
  private providers: Map<string, ProviderInstance> = new Map();
  private config: LoadBalancerConfig;
  private isInitialized: boolean = false;

  // 组合的子模块
  private strategy: ILoadBalancingStrategy;
  private healthChecker: HealthChecker;
  private circuitBreaker: CircuitBreaker;
  private metricsCollector: MetricsCollector;
  private sessionManager: SessionManager;

  constructor(config: Partial<LoadBalancerConfig> = {}) {
    super();

    this.config = this.createDefaultConfig(config);

    // 初始化子模块
    this.strategy = StrategyFactory.createStrategy(this.config.strategy);
    this.healthChecker = new HealthChecker(this.providers, this.config);
    this.circuitBreaker = new CircuitBreaker(this.config);
    this.metricsCollector = new MetricsCollector(this.providers);
    this.sessionManager = new SessionManager(this.config);

    this.setupEventHandlers();
  }

  /**
   * 模块初始化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.log('info', 'Initializing load balancer...');

    // 启动子模块
    this.healthChecker.startHealthCheck();
    this.sessionManager.start();

    this.isInitialized = true;
    this.emit('initialized');

    this.log('info', 'Load balancer initialized successfully');
  }

  /**
   * 模块清理
   */
  async cleanup(): Promise<void> {
    this.log('info', 'Cleaning up load balancer...');

    // 停止子模块
    this.healthChecker.stopHealthCheck();
    this.sessionManager.stop();
    this.circuitBreaker.cleanup();
    this.metricsCollector.cleanup();

    // 清理数据
    this.providers.clear();

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
      lastUpdated: Date.now(),
    });

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

    // 清理相关数据
    this.circuitBreaker.reset(providerId);
    this.sessionManager.removeProviderSessions(providerId);

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

    this.metricsCollector.updateMetrics(providerId, metrics);
    this.healthChecker.updateHealthStatus(providerId);
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
      const stickyProviderId = this.sessionManager.getStickyProvider(context.sessionId);
      if (stickyProviderId) {
        const stickyProvider = availableProviders.find(p => p.id === stickyProviderId);
        if (stickyProvider) {
          return this.createResult(
            stickyProvider,
            LoadBalancingStrategy.ROUND_ROBIN,
            'Sticky session',
            availableProviders
          );
        }
      }
    }

    // 使用策略选择Provider
    const selectedProvider = this.strategy.selectProvider(availableProviders, context);

    // 更新会话映射
    if (this.config.stickySessions && context.sessionId) {
      this.sessionManager.setSessionProvider(context.sessionId, selectedProvider.id);
    }

    // 更新连接计数
    selectedProvider.currentConnections++;

    const result = this.createResult(
      selectedProvider,
      this.strategy.strategyName,
      this.getSelectionReason(this.strategy.strategyName),
      availableProviders
    );

    if (this.config.logging.logSelections) {
      this.log('debug', `Selected provider: ${selectedProvider.id} using ${this.strategy.strategyName}`);
    }

    this.emit('providerSelected', result);

    return result;
  }

  /**
   * 记录请求结果（用于熔断器）
   */
  recordRequestResult(providerId: string, success: boolean): void {
    this.circuitBreaker.recordResult(providerId, success);
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
    const baseStats = this.metricsCollector.calculateStatistics(providers);
    const sessionStats = this.sessionManager.getSessionStatistics();
    const circuitBreakerStats = this.circuitBreaker.getStatistics();

    return {
      ...baseStats,
      activeSessions: sessionStats.activeSessions,
      circuitBreakersOpen: circuitBreakerStats.open,
    };
  }

  /**
   * 更新负载均衡策略
   */
  updateStrategy(strategy: LoadBalancingStrategy): void {
    this.strategy = StrategyFactory.createStrategy(strategy);
    this.config.strategy = strategy;
    this.log('info', `Updated load balancing strategy to: ${strategy}`);
  }

  /**
   * 获取可用的Provider列表
   */
  private getAvailableProviders(context: LoadBalancingContext): ProviderInstance[] {
    const providers: ProviderInstance[] = [];

    for (const provider of this.providers.values()) {
      // 健康检查
      if (
        provider.healthStatus !== ProviderHealthStatus.HEALTHY &&
        provider.healthStatus !== ProviderHealthStatus.DEGRADED
      ) {
        continue;
      }

      // 熔断器检查
      if (!this.circuitBreaker.isClosed(provider.id)) {
        continue;
      }

      // 连接数检查
      if (provider.currentConnections >= provider.maxConnections) {
        continue;
      }

      // 能力检查
      if (context.requiredCapabilities && !this.hasRequiredCapabilities(provider, context.requiredCapabilities)) {
        continue;
      }

      providers.push(provider);
    }

    return providers;
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
      timestamp: Date.now(),
    };
  }

  /**
   * 计算选择信心度
   */
  private calculateConfidence(selected: ProviderInstance, available: ProviderInstance[]): number {
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
   * 检查Provider是否具备所需能力
   */
  private hasRequiredCapabilities(provider: ProviderInstance, capabilities: string[]): boolean {
    // 这里可以实现具体的能力检查逻辑
    return true;
  }

  /**
   * 获取选择原因
   */
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
      [LoadBalancingStrategy.ADAPTIVE]: 'Adaptive selection',
    };

    return reasons[strategy] || 'Unknown strategy';
  }

  /**
   * 创建默认配置
   */
  private createDefaultConfig(config: Partial<LoadBalancerConfig>): LoadBalancerConfig {
    return {
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
        halfOpenMaxCalls: 3,
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        maxBackoffTime: 10000,
      },
      logging: {
        enabled: true,
        logLevel: 'info',
        logSelections: true,
      },
      ...config,
    };
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 健康检查事件
    this.healthChecker.on('healthChanged', event => {
      this.emit('providerHealthChanged', event);
    });

    // 熔断器事件
    this.circuitBreaker.on('stateChanged', event => {
      this.emit('circuitBreakerStateChanged', event);
    });

    this.circuitBreaker.on('circuitBreakerOpened', event => {
      this.emit('circuitBreakerOpened', event);
    });

    // 指标事件
    this.metricsCollector.on('metricsUpdated', event => {
      this.emit('metricsUpdated', event);
    });

    // 会话事件
    this.sessionManager.on('sessionCreated', session => {
      this.emit('sessionCreated', session);
    });

    this.sessionManager.on('sessionRemoved', session => {
      this.emit('sessionRemoved', session);
    });
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
}
