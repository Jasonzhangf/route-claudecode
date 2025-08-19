/**
 * Provider故障转移管理器
 *
 * 实现Provider健康检查、故障检测和自动切换机制
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
// import { ProviderInfo, ProviderHealthStatus } from './load-balancer';
interface ProviderInfo {
  id: string;
  name: string;
  weight?: number;
}
interface ProviderHealthStatus {
  healthy: boolean;
}

/**
 * 健康检查配置
 */
export interface HealthCheckConfig {
  enabled: boolean;
  interval: number; // 检查间隔 (毫秒)
  timeout: number; // 检查超时 (毫秒)
  retryAttempts: number; // 重试次数
  retryDelay: number; // 重试延迟 (毫秒)
  failureThreshold: number; // 连续失败阈值
  recoveryThreshold: number; // 恢复阈值
  endpoints: {
    health: string; // 健康检查端点
    ping: string; // ping端点
  };
}

/**
 * 故障转移配置
 */
export interface FailoverConfig {
  enabled: boolean;
  automaticFailover: boolean; // 自动故障转移
  manualFailover: boolean; // 手动故障转移
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number; // 熔断器失败阈值
    recoveryTime: number; // 恢复时间 (毫秒)
    halfOpenRetries: number; // 半开状态重试次数
  };
  notification: {
    enabled: boolean;
    channels: string[]; // 通知渠道
  };
}

/**
 * 健康检查结果
 */
export interface HealthCheckResult {
  providerId: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  timestamp: number;
  error?: string;
  metrics: {
    availability: number; // 可用性百分比
    avgResponseTime: number; // 平均响应时间
    lastSuccessTime: number; // 最后成功时间
    consecutiveFailures: number; // 连续失败次数
  };
}

/**
 * 故障转移事件
 */
export interface FailoverEvent {
  type: 'failover' | 'recovery' | 'degradation';
  fromProvider: string;
  toProvider?: string;
  timestamp: number;
  reason: string;
  automatic: boolean;
}

/**
 * 熔断器状态
 */
export enum CircuitBreakerState {
  CLOSED = 'closed', // 正常状态
  OPEN = 'open', // 断开状态
  HALF_OPEN = 'half_open', // 半开状态
}

/**
 * 熔断器信息
 */
export interface CircuitBreakerInfo {
  providerId: string;
  state: CircuitBreakerState;
  failureCount: number;
  nextRetryTime: number;
  halfOpenRetries: number;
}

/**
 * Provider故障转移管理器
 */
export class ProviderFailoverManager extends EventEmitter {
  private providers: Map<string, ProviderInfo> = new Map();
  private healthStatus: Map<string, HealthCheckResult> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerInfo> = new Map();
  private healthCheckTimers: Map<string, NodeJS.Timeout> = new Map();
  private config: FailoverConfig;
  private healthCheckConfig: HealthCheckConfig;
  private primaryProvider: string | null = null;
  private isInitialized = false;

  constructor(failoverConfig?: Partial<FailoverConfig>, healthCheckConfig?: Partial<HealthCheckConfig>) {
    super();

    // 默认故障转移配置
    this.config = {
      enabled: true,
      automaticFailover: true,
      manualFailover: true,
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        recoveryTime: 60000,
        halfOpenRetries: 3,
      },
      notification: {
        enabled: true,
        channels: ['console', 'log'],
      },
      ...failoverConfig,
    };

    // 默认健康检查配置
    this.healthCheckConfig = {
      enabled: true,
      interval: 30000, // 30秒
      timeout: 5000, // 5秒
      retryAttempts: 3,
      retryDelay: 1000, // 1秒
      failureThreshold: 3, // 连续3次失败
      recoveryThreshold: 2, // 连续2次成功恢复
      endpoints: {
        health: '/health',
        ping: '/ping',
      },
      ...healthCheckConfig,
    };
  }

  /**
   * 初始化故障转移管理器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('故障转移管理器已经初始化');
      return;
    }

    console.log('🚀 初始化Provider故障转移管理器...');

    // 启动健康检查
    if (this.healthCheckConfig.enabled) {
      this.startHealthChecks();
    }

    // 初始化熔断器
    if (this.config.circuitBreaker.enabled) {
      this.initializeCircuitBreakers();
    }

    this.isInitialized = true;

    this.emit('manager-initialized', {
      config: this.config,
      healthCheckConfig: this.healthCheckConfig,
      timestamp: Date.now(),
    });

    console.log('✅ 故障转移管理器初始化完成');
  }

  /**
   * 添加Provider
   */
  addProvider(provider: ProviderInfo): void {
    this.providers.set(provider.id, provider);

    // 初始化健康状态
    this.healthStatus.set(provider.id, {
      providerId: provider.id,
      status: 'healthy',
      responseTime: 0,
      timestamp: Date.now(),
      metrics: {
        availability: 100,
        avgResponseTime: 0,
        lastSuccessTime: Date.now(),
        consecutiveFailures: 0,
      },
    });

    // 初始化熔断器
    if (this.config.circuitBreaker.enabled) {
      this.circuitBreakers.set(provider.id, {
        providerId: provider.id,
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
        nextRetryTime: 0,
        halfOpenRetries: 0,
      });
    }

    // 设置第一个Provider为主Provider
    if (!this.primaryProvider) {
      this.primaryProvider = provider.id;
      console.log(`🎯 设置主Provider: ${provider.name} (${provider.id})`);
    }

    // 启动该Provider的健康检查
    if (this.healthCheckConfig.enabled && this.isInitialized) {
      this.startProviderHealthCheck(provider.id);
    }

    this.emit('provider-added', {
      providerId: provider.id,
      providerName: provider.name,
      isPrimary: provider.id === this.primaryProvider,
      timestamp: Date.now(),
    });

    console.log(`📦 Provider已添加: ${provider.name} (${provider.id})`);
  }

  /**
   * 移除Provider
   */
  removeProvider(providerId: string): boolean {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return false;
    }

    // 停止健康检查
    this.stopProviderHealthCheck(providerId);

    // 清理状态
    this.providers.delete(providerId);
    this.healthStatus.delete(providerId);
    this.circuitBreakers.delete(providerId);

    // 如果是主Provider，需要故障转移
    if (this.primaryProvider === providerId) {
      const alternativeProvider = this.findHealthyAlternativeProvider();
      if (alternativeProvider) {
        this.performFailover(providerId, alternativeProvider, '主Provider被移除', false);
      } else {
        this.primaryProvider = null;
        console.warn('⚠️ 没有可用的替代Provider');
      }
    }

    this.emit('provider-removed', {
      providerId,
      providerName: provider.name,
      timestamp: Date.now(),
    });

    console.log(`🗑️ Provider已移除: ${provider.name} (${providerId})`);
    return true;
  }

  /**
   * 获取当前健康的Provider
   */
  getHealthyProviders(): ProviderInfo[] {
    const healthyProviders: ProviderInfo[] = [];

    for (const [providerId, provider] of this.providers) {
      const health = this.healthStatus.get(providerId);
      const circuitBreaker = this.circuitBreakers.get(providerId);

      if (health?.status === 'healthy' && circuitBreaker?.state === CircuitBreakerState.CLOSED) {
        healthyProviders.push(provider);
      }
    }

    return healthyProviders;
  }

  /**
   * 获取当前主Provider
   */
  getPrimaryProvider(): ProviderInfo | null {
    if (!this.primaryProvider) {
      return null;
    }
    return this.providers.get(this.primaryProvider) || null;
  }

  /**
   * 手动执行故障转移
   */
  async performManualFailover(fromProviderId: string, toProviderId: string, reason: string): Promise<boolean> {
    if (!this.config.manualFailover) {
      throw new Error('手动故障转移已禁用');
    }

    const fromProvider = this.providers.get(fromProviderId);
    const toProvider = this.providers.get(toProviderId);

    if (!fromProvider || !toProvider) {
      throw new Error('Provider不存在');
    }

    // 检查目标Provider是否健康
    const toProviderHealth = this.healthStatus.get(toProviderId);
    if (toProviderHealth?.status !== 'healthy') {
      throw new Error(`目标Provider不健康: ${toProviderId}`);
    }

    return this.performFailover(fromProviderId, toProviderId, `手动故障转移: ${reason}`, false);
  }

  /**
   * 获取所有Provider的健康状态
   */
  getHealthStatus(): Map<string, HealthCheckResult> {
    return new Map(this.healthStatus);
  }

  /**
   * 获取熔断器状态
   */
  getCircuitBreakerStatus(): Map<string, CircuitBreakerInfo> {
    return new Map(this.circuitBreakers);
  }

  /**
   * 记录Provider请求成功
   */
  recordSuccess(providerId: string, responseTime: number): void {
    const health = this.healthStatus.get(providerId);
    const circuitBreaker = this.circuitBreakers.get(providerId);

    if (health) {
      // 更新健康状态
      health.metrics.consecutiveFailures = 0;
      health.metrics.lastSuccessTime = Date.now();
      health.metrics.avgResponseTime = (health.metrics.avgResponseTime + responseTime) / 2;
      health.responseTime = responseTime;
      health.timestamp = Date.now();

      // 如果之前不健康，现在可能恢复
      if (health.status !== 'healthy') {
        this.checkRecovery(providerId);
      }
    }

    if (circuitBreaker) {
      // 重置熔断器
      if (circuitBreaker.state === CircuitBreakerState.HALF_OPEN) {
        circuitBreaker.halfOpenRetries++;
        if (circuitBreaker.halfOpenRetries >= this.config.circuitBreaker.halfOpenRetries) {
          circuitBreaker.state = CircuitBreakerState.CLOSED;
          circuitBreaker.failureCount = 0;
          circuitBreaker.halfOpenRetries = 0;
          console.log(`🔄 熔断器已关闭: ${providerId}`);
        }
      } else if (circuitBreaker.state === CircuitBreakerState.CLOSED) {
        circuitBreaker.failureCount = Math.max(0, circuitBreaker.failureCount - 1);
      }
    }
  }

  /**
   * 记录Provider请求失败
   */
  recordFailure(providerId: string, error: string): void {
    const health = this.healthStatus.get(providerId);
    const circuitBreaker = this.circuitBreakers.get(providerId);

    if (health) {
      // 更新健康状态
      health.metrics.consecutiveFailures++;
      health.timestamp = Date.now();
      health.error = error;

      // 检查是否需要标记为不健康
      if (health.metrics.consecutiveFailures >= this.healthCheckConfig.failureThreshold) {
        this.markProviderUnhealthy(providerId, error);
      }
    }

    if (circuitBreaker && circuitBreaker.state === CircuitBreakerState.CLOSED) {
      circuitBreaker.failureCount++;

      // 检查是否需要打开熔断器
      if (circuitBreaker.failureCount >= this.config.circuitBreaker.failureThreshold) {
        this.openCircuitBreaker(providerId);
      }
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    console.log('🧹 清理故障转移管理器...');

    // 停止所有健康检查
    for (const timer of this.healthCheckTimers.values()) {
      clearInterval(timer);
    }
    this.healthCheckTimers.clear();

    // 清理状态
    this.providers.clear();
    this.healthStatus.clear();
    this.circuitBreakers.clear();
    this.primaryProvider = null;
    this.isInitialized = false;

    this.emit('manager-cleanup', {
      timestamp: Date.now(),
    });

    console.log('✅ 故障转移管理器清理完成');
  }

  // ===== Private Helper Methods =====

  private startHealthChecks(): void {
    for (const providerId of this.providers.keys()) {
      this.startProviderHealthCheck(providerId);
    }
  }

  private startProviderHealthCheck(providerId: string): void {
    if (this.healthCheckTimers.has(providerId)) {
      return; // 已经在运行
    }

    const timer = setInterval(async () => {
      try {
        await this.performHealthCheck(providerId);
      } catch (error) {
        console.error(`健康检查失败 [${providerId}]:`, error);
      }
    }, this.healthCheckConfig.interval);

    this.healthCheckTimers.set(providerId, timer);
    console.log(`⚕️ 启动健康检查: ${providerId}`);
  }

  private stopProviderHealthCheck(providerId: string): void {
    const timer = this.healthCheckTimers.get(providerId);
    if (timer) {
      clearInterval(timer);
      this.healthCheckTimers.delete(providerId);
      console.log(`⏸️ 停止健康检查: ${providerId}`);
    }
  }

  private async performHealthCheck(providerId: string): Promise<void> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return;
    }

    const startTime = Date.now();

    try {
      // 模拟健康检查 - 实际应该调用Provider的健康检查端点
      const isHealthy = await this.checkProviderHealth(provider);
      const responseTime = Date.now() - startTime;

      if (isHealthy) {
        this.recordSuccess(providerId, responseTime);
      } else {
        this.recordFailure(providerId, '健康检查失败');
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.recordFailure(providerId, error.message);
      console.error(`健康检查异常 [${providerId}]:`, error.message);
    }
  }

  private async checkProviderHealth(provider: ProviderInfo): Promise<boolean> {
    // 简化实现 - 实际应该发送HTTP请求到Provider的健康检查端点
    try {
      // 模拟健康检查，90%概率成功
      return Math.random() > 0.1;
    } catch (error) {
      return false;
    }
  }

  private initializeCircuitBreakers(): void {
    for (const providerId of this.providers.keys()) {
      this.circuitBreakers.set(providerId, {
        providerId,
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
        nextRetryTime: 0,
        halfOpenRetries: 0,
      });
    }
  }

  private markProviderUnhealthy(providerId: string, error: string): void {
    const health = this.healthStatus.get(providerId);
    if (!health) return;

    const wasHealthy = health.status === 'healthy';
    health.status = 'unhealthy';
    health.error = error;

    if (wasHealthy) {
      console.warn(`⚠️ Provider标记为不健康: ${providerId} - ${error}`);

      this.emit('provider-unhealthy', {
        providerId,
        error,
        timestamp: Date.now(),
      });

      // 如果这是主Provider，尝试故障转移
      if (this.primaryProvider === providerId && this.config.automaticFailover) {
        const alternativeProvider = this.findHealthyAlternativeProvider();
        if (alternativeProvider) {
          this.performFailover(providerId, alternativeProvider, `健康检查失败: ${error}`, true);
        }
      }
    }
  }

  private checkRecovery(providerId: string): void {
    const health = this.healthStatus.get(providerId);
    if (!health || health.metrics.consecutiveFailures > 0) {
      return;
    }

    // 检查是否满足恢复条件
    const timeSinceLastSuccess = Date.now() - health.metrics.lastSuccessTime;
    if (timeSinceLastSuccess < this.healthCheckConfig.recoveryThreshold * this.healthCheckConfig.interval) {
      health.status = 'healthy';
      delete health.error;

      console.log(`✅ Provider已恢复: ${providerId}`);

      this.emit('provider-recovered', {
        providerId,
        timestamp: Date.now(),
      });
    }
  }

  private openCircuitBreaker(providerId: string): void {
    const circuitBreaker = this.circuitBreakers.get(providerId);
    if (!circuitBreaker) return;

    circuitBreaker.state = CircuitBreakerState.OPEN;
    circuitBreaker.nextRetryTime = Date.now() + this.config.circuitBreaker.recoveryTime;
    circuitBreaker.halfOpenRetries = 0;

    console.warn(`⚡ 熔断器已打开: ${providerId}`);

    this.emit('circuit-breaker-opened', {
      providerId,
      nextRetryTime: circuitBreaker.nextRetryTime,
      timestamp: Date.now(),
    });

    // 如果这是主Provider，尝试故障转移
    if (this.primaryProvider === providerId && this.config.automaticFailover) {
      const alternativeProvider = this.findHealthyAlternativeProvider();
      if (alternativeProvider) {
        this.performFailover(providerId, alternativeProvider, '熔断器打开', true);
      }
    }

    // 设置定时器检查恢复
    setTimeout(() => {
      this.tryHalfOpenCircuitBreaker(providerId);
    }, this.config.circuitBreaker.recoveryTime);
  }

  private tryHalfOpenCircuitBreaker(providerId: string): void {
    const circuitBreaker = this.circuitBreakers.get(providerId);
    if (!circuitBreaker || circuitBreaker.state !== CircuitBreakerState.OPEN) {
      return;
    }

    if (Date.now() >= circuitBreaker.nextRetryTime) {
      circuitBreaker.state = CircuitBreakerState.HALF_OPEN;
      circuitBreaker.halfOpenRetries = 0;

      console.log(`🔄 熔断器半开: ${providerId}`);

      this.emit('circuit-breaker-half-open', {
        providerId,
        timestamp: Date.now(),
      });
    }
  }

  private findHealthyAlternativeProvider(): string | null {
    const healthyProviders = this.getHealthyProviders();

    // 优先选择权重最高的健康Provider
    let bestProvider: ProviderInfo | null = null;
    let bestWeight = 0;

    for (const provider of healthyProviders) {
      if (provider.id !== this.primaryProvider && provider.weight > bestWeight) {
        bestProvider = provider;
        bestWeight = provider.weight;
      }
    }

    return bestProvider?.id || null;
  }

  private performFailover(fromProviderId: string, toProviderId: string, reason: string, automatic: boolean): boolean {
    const fromProvider = this.providers.get(fromProviderId);
    const toProvider = this.providers.get(toProviderId);

    if (!fromProvider || !toProvider) {
      console.error('故障转移失败: Provider不存在');
      return false;
    }

    const oldPrimary = this.primaryProvider;
    this.primaryProvider = toProviderId;

    const failoverEvent: FailoverEvent = {
      type: 'failover',
      fromProvider: fromProviderId,
      toProvider: toProviderId,
      timestamp: Date.now(),
      reason,
      automatic,
    };

    console.warn(`🔄 执行故障转移: ${fromProvider.name} → ${toProvider.name} (${reason})`);

    this.emit('failover-executed', failoverEvent);

    // 发送通知
    if (this.config.notification.enabled) {
      this.sendNotification(failoverEvent);
    }

    return true;
  }

  private sendNotification(event: FailoverEvent): void {
    const message = `故障转移: ${event.fromProvider} → ${event.toProvider} (${event.reason})`;

    for (const channel of this.config.notification.channels) {
      switch (channel) {
        case 'console':
          console.warn(`🔔 ${message}`);
          break;
        case 'log':
          // 实际项目中应该使用日志系统
          console.log(`[FAILOVER] ${new Date().toISOString()} - ${message}`);
          break;
        // 可以扩展更多通知渠道 (email, slack, etc.)
      }
    }
  }
}
