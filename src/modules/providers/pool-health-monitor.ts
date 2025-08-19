/**
 * 连接池健康监控器模块
 *
 * 负责监控连接池中所有连接的健康状态，执行定期健康检查
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { ConnectionInfo, ConnectionHealth, ConnectionState, ConnectionError } from './connection-types';

/**
 * 健康检查配置
 */
export interface HealthCheckConfig {
  enabled: boolean;
  interval: number; // 检查间隔 (毫秒)
  timeout: number; // 单次检查超时 (毫秒)
  retryAttempts: number; // 重试次数
  failureThreshold: number; // 失败阈值
  recoveryThreshold: number; // 恢复阈值
}

/**
 * 健康监控器接口
 */
export interface IPoolHealthMonitor extends EventEmitter {
  start(): void;
  stop(): void;
  cleanup(): void;
  checkConnection(connectionId: string): Promise<ConnectionHealth>;
  checkAllConnections(): Promise<ConnectionHealth[]>;
  getHealthStatus(connectionId: string): ConnectionHealth | null;
  getOverallHealth(): HealthSummary;
}

/**
 * 健康状况摘要
 */
export interface HealthSummary {
  totalConnections: number;
  healthyConnections: number;
  unhealthyConnections: number;
  checkingConnections: number;
  averageLatency: number;
  healthRatio: number;
  lastCheckTime: number;
}

/**
 * 连接池健康监控器
 */
export class PoolHealthMonitor extends EventEmitter implements IPoolHealthMonitor {
  private config: HealthCheckConfig;
  private connections: Map<string, ConnectionInfo>;
  private healthData: Map<string, ConnectionHealth> = new Map();
  private checkTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkingConnections: Set<string> = new Set();

  constructor(config: HealthCheckConfig, connections: Map<string, ConnectionInfo>) {
    super();
    this.config = config;
    this.connections = connections;
  }

  /**
   * 启动健康监控
   */
  start(): void {
    if (this.isRunning || !this.config.enabled) {
      return;
    }

    this.isRunning = true;
    this.scheduleNextCheck();

    this.emit('monitor-started', {
      config: this.config,
      timestamp: Date.now(),
    });

    console.log(`🏥 连接池健康监控已启动 (间隔: ${this.config.interval}ms)`);
  }

  /**
   * 停止健康监控
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
      this.checkTimer = null;
    }

    this.checkingConnections.clear();

    this.emit('monitor-stopped', {
      timestamp: Date.now(),
    });

    console.log('🏥 连接池健康监控已停止');
  }

  /**
   * 检查单个连接健康状态
   */
  async checkConnection(connectionId: string): Promise<ConnectionHealth> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new ConnectionError(`Connection ${connectionId} not found`, connectionId);
    }

    // 避免重复检查
    if (this.checkingConnections.has(connectionId)) {
      const existing = this.healthData.get(connectionId);
      if (existing) {
        return existing;
      }
    }

    this.checkingConnections.add(connectionId);

    try {
      const health = await this.performHealthCheck(connection);
      this.healthData.set(connectionId, health);

      this.emit('connection-health-updated', {
        connectionId,
        health,
      });

      return health;
    } finally {
      this.checkingConnections.delete(connectionId);
    }
  }

  /**
   * 检查所有连接的健康状态
   */
  async checkAllConnections(): Promise<ConnectionHealth[]> {
    const connectionIds = Array.from(this.connections.keys());
    const healthChecks: Promise<ConnectionHealth>[] = [];

    for (const connectionId of connectionIds) {
      // 跳过已在检查中的连接
      if (!this.checkingConnections.has(connectionId)) {
        healthChecks.push(this.checkConnection(connectionId));
      }
    }

    const results = await Promise.allSettled(healthChecks);
    const healthResults: ConnectionHealth[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        healthResults.push(result.value);
      }
    }

    this.emit('health-check-completed', {
      totalChecked: healthResults.length,
      healthyCount: healthResults.filter(h => h.isHealthy).length,
      unhealthyCount: healthResults.filter(h => !h.isHealthy).length,
      timestamp: Date.now(),
    });

    return healthResults;
  }

  /**
   * 获取连接的健康状态
   */
  getHealthStatus(connectionId: string): ConnectionHealth | null {
    return this.healthData.get(connectionId) || null;
  }

  /**
   * 获取整体健康状况摘要
   */
  getOverallHealth(): HealthSummary {
    const allHealth = Array.from(this.healthData.values());
    const healthyConnections = allHealth.filter(h => h.isHealthy);
    const unhealthyConnections = allHealth.filter(h => !h.isHealthy);

    const avgLatency =
      healthyConnections.length > 0
        ? healthyConnections.reduce((sum, h) => sum + (h.latency || 0), 0) / healthyConnections.length
        : 0;

    return {
      totalConnections: this.connections.size,
      healthyConnections: healthyConnections.length,
      unhealthyConnections: unhealthyConnections.length,
      checkingConnections: this.checkingConnections.size,
      averageLatency: avgLatency,
      healthRatio: this.connections.size > 0 ? healthyConnections.length / this.connections.size : 0,
      lastCheckTime: Math.max(...allHealth.map(h => h.lastCheckTime), 0),
    };
  }

  /**
   * 清理已移除连接的健康数据
   */
  cleanup(): void {
    const existingConnectionIds = new Set(this.connections.keys());

    for (const connectionId of this.healthData.keys()) {
      if (!existingConnectionIds.has(connectionId)) {
        this.healthData.delete(connectionId);
      }
    }

    // 清理检查中的状态
    for (const connectionId of this.checkingConnections) {
      if (!existingConnectionIds.has(connectionId)) {
        this.checkingConnections.delete(connectionId);
      }
    }
  }

  /**
   * 获取不健康的连接列表
   */
  getUnhealthyConnections(): ConnectionHealth[] {
    return Array.from(this.healthData.values()).filter(health => !health.isHealthy);
  }

  /**
   * 重置连接的健康统计
   */
  resetConnectionHealth(connectionId: string): void {
    const health = this.healthData.get(connectionId);
    if (health) {
      health.errorCount = 0;
      health.errorMessage = undefined;
      health.isHealthy = true;
      health.lastCheckTime = Date.now();

      this.emit('connection-health-reset', {
        connectionId,
        timestamp: Date.now(),
      });
    }
  }

  // ===== Private Methods =====

  private scheduleNextCheck(): void {
    if (!this.isRunning) {
      return;
    }

    this.checkTimer = setTimeout(async () => {
      try {
        await this.performRoutineCheck();
      } catch (error) {
        console.error('健康检查执行失败:', error);
      } finally {
        this.scheduleNextCheck();
      }
    }, this.config.interval);
  }

  private async performRoutineCheck(): Promise<void> {
    if (this.connections.size === 0) {
      return;
    }

    console.log(`🏥 执行定期健康检查 (${this.connections.size} 个连接)`);

    const startTime = Date.now();
    const healthResults = await this.checkAllConnections();
    const duration = Date.now() - startTime;

    const summary = this.getOverallHealth();

    console.log(`🏥 健康检查完成: ${summary.healthyConnections}/${summary.totalConnections} 健康 (${duration}ms)`);

    // 处理不健康的连接
    const unhealthyConnections = healthResults.filter(h => !h.isHealthy);
    if (unhealthyConnections.length > 0) {
      this.handleUnhealthyConnections(unhealthyConnections);
    }
  }

  private async performHealthCheck(connection: ConnectionInfo): Promise<ConnectionHealth> {
    const startTime = Date.now();
    let attempts = 0;
    let lastError: string | undefined;

    // 获取现有健康数据
    const existingHealth = this.healthData.get(connection.id);

    while (attempts < this.config.retryAttempts) {
      try {
        await this.executeHealthCheck(connection);

        // 健康检查成功
        const latency = Date.now() - startTime;
        const health: ConnectionHealth = {
          connectionId: connection.id,
          isHealthy: true,
          lastCheckTime: Date.now(),
          errorCount: 0,
          latency,
          errorMessage: undefined,
        };

        return health;
      } catch (error) {
        attempts++;
        lastError = error.message;

        if (attempts < this.config.retryAttempts) {
          await this.delay(100 * attempts); // 指数退避
        }
      }
    }

    // 所有重试都失败了
    const errorCount = (existingHealth?.errorCount || 0) + 1;
    const health: ConnectionHealth = {
      connectionId: connection.id,
      isHealthy: errorCount < this.config.failureThreshold,
      lastCheckTime: Date.now(),
      errorCount,
      errorMessage: lastError,
    };

    return health;
  }

  private async executeHealthCheck(connection: ConnectionInfo): Promise<void> {
    return new Promise((resolve, reject) => {
      // 设置超时
      const timeout = setTimeout(() => {
        reject(new ConnectionError(`Health check timeout after ${this.config.timeout}ms`, connection.id));
      }, this.config.timeout);

      try {
        // 检查连接状态
        if (connection.state === ConnectionState.CLOSED || connection.state === ConnectionState.ERROR) {
          clearTimeout(timeout);
          reject(new ConnectionError(`Connection is in invalid state: ${connection.state}`, connection.id));
          return;
        }

        // 模拟健康检查（ping测试）
        const checkDelay = Math.random() * 50 + 10; // 10-60ms

        setTimeout(() => {
          clearTimeout(timeout);

          // 95%的成功率
          if (Math.random() > 0.05) {
            resolve();
          } else {
            reject(new ConnectionError('Simulated health check failure', connection.id));
          }
        }, checkDelay);
      } catch (error) {
        clearTimeout(timeout);
        reject(new ConnectionError(`Health check failed: ${error.message}`, connection.id));
      }
    });
  }

  private handleUnhealthyConnections(unhealthyConnections: ConnectionHealth[]): void {
    for (const health of unhealthyConnections) {
      this.emit('connection-unhealthy', {
        connectionId: health.connectionId,
        errorCount: health.errorCount,
        errorMessage: health.errorMessage,
      });

      // 如果错误次数超过阈值，标记连接需要关闭
      if (health.errorCount >= this.config.failureThreshold) {
        this.emit('connection-requires-closure', {
          connectionId: health.connectionId,
          reason: `健康检查失败次数超过阈值 (${health.errorCount})`,
        });
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 默认健康检查配置
 */
export const DEFAULT_HEALTH_CONFIG: HealthCheckConfig = {
  enabled: true,
  interval: 30000, // 30秒检查一次
  timeout: 5000, // 5秒超时
  retryAttempts: 2, // 重试2次
  failureThreshold: 3, // 连续3次失败才判定为不健康
  recoveryThreshold: 2, // 连续2次成功才判定为恢复
};
