/**
 * Provider健康检查器
 *
 * 负责监控和管理Provider的健康状态
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { IHealthChecker, ProviderInstance, ProviderHealthStatus, LoadBalancerConfig } from './types';

/**
 * 健康检查器实现
 */
export class HealthChecker extends EventEmitter implements IHealthChecker {
  private providers: Map<string, ProviderInstance>;
  private config: LoadBalancerConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(providers: Map<string, ProviderInstance>, config: LoadBalancerConfig) {
    super();
    this.providers = providers;
    this.config = config;
  }

  /**
   * 检查Provider健康状态
   */
  async checkHealth(provider: ProviderInstance): Promise<boolean> {
    try {
      // 基于指标判断健康状态
      const metrics = provider.metrics;

      // 成功率检查
      if (metrics.successRate < 0.7) {
        return false;
      }

      // 响应时间检查
      if (metrics.avgResponseTime > 15000) {
        // 15秒
        return false;
      }

      // 最近活动检查
      const timeSinceLastUpdate = Date.now() - provider.lastUpdated;
      if (timeSinceLastUpdate > 300000) {
        // 5分钟无活动
        return false;
      }

      return true;
    } catch (error) {
      this.log('error', `Health check failed for provider ${provider.id}: ${error}`);
      return false;
    }
  }

  /**
   * 更新Provider健康状态
   */
  updateHealthStatus(providerId: string): void {
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
    if (metrics.avgResponseTime > 10000) {
      // 10秒
      newStatus = ProviderHealthStatus.UNHEALTHY;
    } else if (metrics.avgResponseTime > 5000) {
      // 5秒
      if (newStatus === ProviderHealthStatus.HEALTHY) {
        newStatus = ProviderHealthStatus.DEGRADED;
      }
    }

    // 更新状态
    if (provider.healthStatus !== newStatus) {
      const oldStatus = provider.healthStatus;
      provider.healthStatus = newStatus;

      this.log('info', `Provider ${providerId} health changed: ${oldStatus} -> ${newStatus}`);
      this.emit('healthChanged', { providerId, oldStatus, newStatus });
    }
  }

  /**
   * 启动健康检查
   */
  startHealthCheck(): void {
    if (!this.config.enableHealthCheck || this.isRunning) {
      return;
    }

    this.log('info', 'Starting health checker...');
    this.isRunning = true;

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    this.emit('started');
  }

  /**
   * 停止健康检查
   */
  stopHealthCheck(): void {
    if (!this.isRunning) {
      return;
    }

    this.log('info', 'Stopping health checker...');
    this.isRunning = false;

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    this.emit('stopped');
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    for (const [providerId, provider] of this.providers) {
      try {
        const isHealthy = await this.checkHealth(provider);

        if (!isHealthy && provider.healthStatus === ProviderHealthStatus.HEALTHY) {
          provider.healthStatus = ProviderHealthStatus.UNHEALTHY;
          this.emit('healthChanged', {
            providerId,
            oldStatus: ProviderHealthStatus.HEALTHY,
            newStatus: ProviderHealthStatus.UNHEALTHY,
          });
        } else if (isHealthy && provider.healthStatus === ProviderHealthStatus.UNHEALTHY) {
          provider.healthStatus = ProviderHealthStatus.HEALTHY;
          this.emit('healthChanged', {
            providerId,
            oldStatus: ProviderHealthStatus.UNHEALTHY,
            newStatus: ProviderHealthStatus.HEALTHY,
          });
        }
      } catch (error) {
        this.log('error', `Health check failed for provider ${providerId}: ${error}`);
      }
    }
  }

  /**
   * 检查是否正在运行
   */
  isHealthCheckRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 获取健康统计信息
   */
  getHealthStatistics(): HealthStatistics {
    const providers = Array.from(this.providers.values());

    return {
      total: providers.length,
      healthy: providers.filter(p => p.healthStatus === ProviderHealthStatus.HEALTHY).length,
      degraded: providers.filter(p => p.healthStatus === ProviderHealthStatus.DEGRADED).length,
      unhealthy: providers.filter(p => p.healthStatus === ProviderHealthStatus.UNHEALTHY).length,
      unknown: providers.filter(p => p.healthStatus === ProviderHealthStatus.UNKNOWN).length,
      maintenance: providers.filter(p => p.healthStatus === ProviderHealthStatus.MAINTENANCE).length,
    };
  }

  private log(level: string, message: string): void {
    if (!this.config.logging.enabled) {
      return;
    }

    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevel = levels.indexOf(this.config.logging.logLevel);
    const messageLevel = levels.indexOf(level);

    if (messageLevel >= configLevel) {
      console.log(`[HealthChecker] ${level.toUpperCase()}: ${message}`);
    }
  }
}

/**
 * 健康统计信息
 */
export interface HealthStatistics {
  total: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  unknown: number;
  maintenance: number;
}
