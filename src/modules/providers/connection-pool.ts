/**
 * Provider连接池管理器
 *
 * 高性能、模块化的连接池系统，整合连接管理、健康监控和性能分析
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import * as http from 'http';
import * as https from 'https';
import {
  ConnectionPoolConfig,
  ConnectionInfo,
  ConnectionState,
  ConnectionProtocol,
  RequestPriority,
  PoolStatistics,
  HostConfig,
  PoolEvents,
  ConnectionPoolError,
  DEFAULT_POOL_CONFIG,
} from './connection-types';
import { ConnectionFactory, ConnectionFactoryManager } from './connection-factory';
import { ConnectionManager, IConnectionManager } from './connection-manager';
import { PoolManager, IPoolManager } from './pool-manager';
import { PoolHealthMonitor, IPoolHealthMonitor, DEFAULT_HEALTH_CONFIG } from './pool-health-monitor';
import {
  PoolPerformanceMonitor,
  IPoolPerformanceMonitor,
  DEFAULT_PERFORMANCE_CONFIG,
} from './pool-performance-monitor';

/**
 * Provider连接池管理器
 *
 * 集成所有连接池功能模块的主控制器
 */
export class ProviderConnectionPool extends EventEmitter {
  private config: ConnectionPoolConfig;
  private connections: Map<string, ConnectionInfo> = new Map();

  // 核心模块组件
  private connectionFactory: ConnectionFactory;
  private connectionManager: ConnectionManager;
  private poolManager: PoolManager;
  private healthMonitor: IPoolHealthMonitor;
  private performanceMonitor: IPoolPerformanceMonitor;

  // 状态管理
  private isInitialized = false;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<ConnectionPoolConfig>) {
    super();

    // 合并配置
    this.config = {
      ...DEFAULT_POOL_CONFIG,
      ...config,
    };

    // 初始化核心组件
    this.initializeComponents();
    this.setupEventHandlers();
  }

  /**
   * 初始化连接池
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('连接池已经初始化');
      return;
    }

    console.log('🚀 初始化Provider连接池...');

    try {
      // 启动健康监控
      this.healthMonitor.start();

      // 启动性能监控
      this.performanceMonitor.start();

      // 启动维护定时器
      this.startMaintenanceTimer();

      this.isInitialized = true;

      this.emit('pool-initialized', {
        config: this.config,
        timestamp: Date.now(),
      });

      console.log(`✅ 连接池初始化完成 (最大连接数: ${this.config.maxConnections})`);
    } catch (error) {
      throw new ConnectionPoolError('initialize', `Initialization failed: ${error.message}`);
    }
  }

  /**
   * 获取连接
   */
  async acquire(
    host: string,
    port: number,
    protocol: ConnectionProtocol = 'http',
    priority: RequestPriority = 'normal'
  ): Promise<ConnectionInfo> {
    if (!this.isInitialized) {
      throw new ConnectionPoolError('acquire', 'Connection pool is not initialized');
    }

    const startTime = Date.now();

    try {
      // 尝试从池管理器获取连接
      const connection = await this.poolManager.acquireConnection(host, port, protocol, priority);

      // 记录性能指标
      const duration = Date.now() - startTime;
      this.performanceMonitor.recordRequest(duration, true);

      return connection;
    } catch (error) {
      // 记录失败指标
      const duration = Date.now() - startTime;
      this.performanceMonitor.recordRequest(duration, false);

      // 如果池管理器无法提供连接，尝试创建新连接
      if (this.poolManager.canCreateConnection(host, port)) {
        return this.createNewConnection(host, port, protocol);
      }

      throw error;
    }
  }

  /**
   * 释放连接
   */
  release(connectionId: string): void {
    if (!this.connections.has(connectionId)) {
      console.warn(`尝试释放不存在的连接: ${connectionId}`);
      return;
    }

    try {
      // 通过连接管理器标记为空闲
      this.connectionManager.markIdle(connectionId);

      // 通过池管理器释放
      this.poolManager.releaseConnection(connectionId);

      // 设置空闲超时
      this.connectionManager.setIdleTimeout(connectionId, this.config.idleTimeout);
    } catch (error) {
      console.error(`释放连接失败 [${connectionId}]:`, error.message);
    }
  }

  /**
   * 关闭连接
   */
  closeConnection(connectionId: string, reason: string = '手动关闭'): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    try {
      // 从池管理器移除
      this.poolManager.removeConnection(connectionId);

      // 销毁连接
      this.connectionManager.destroy(connectionId, reason);

      // 从本地映射移除
      this.connections.delete(connectionId);

      return true;
    } catch (error) {
      console.error(`关闭连接失败 [${connectionId}]:`, error.message);
      return false;
    }
  }

  /**
   * 获取连接池统计信息
   */
  getStatistics(): PoolStatistics {
    const poolStats = this.poolManager.getStatistics();
    const performanceMetrics = this.performanceMonitor.getCurrentMetrics();

    return {
      totalConnections: poolStats.totalConnections,
      activeConnections: poolStats.activeConnections,
      idleConnections: poolStats.idleConnections,
      pendingRequests: poolStats.pendingRequests,
      connectionsByHost: poolStats.connectionsByHost,
      metrics: performanceMetrics,
    };
  }

  /**
   * 获取HTTP Agent
   */
  getHttpAgent(): http.Agent {
    return this.connectionFactory.getHttpAgent();
  }

  /**
   * 获取HTTPS Agent
   */
  getHttpsAgent(): https.Agent {
    return this.connectionFactory.getHttpsAgent();
  }

  /**
   * 预热连接池
   */
  async warmup(hosts: Array<HostConfig>): Promise<void> {
    if (!this.isInitialized) {
      throw new ConnectionPoolError('warmup', 'Connection pool is not initialized');
    }

    console.log('🔥 预热连接池...');

    const warmupPromises = hosts.map(async hostConfig => {
      const connections: ConnectionInfo[] = [];

      try {
        const hostConnections = await this.connectionFactory.createConnections(
          hostConfig.host,
          hostConfig.port,
          hostConfig.protocol,
          hostConfig.connections
        );

        // 将连接添加到管理器
        for (const connection of hostConnections) {
          this.connections.set(connection.id, connection);
          this.connectionManager.addConnection(connection);
          this.poolManager.addConnection(connection);

          // 标记为空闲状态
          this.connectionManager.markIdle(connection.id);
        }

        connections.push(...hostConnections);
      } catch (error) {
        console.warn(`预热连接失败 [${hostConfig.host}:${hostConfig.port}]:`, error.message);
      }

      console.log(`✅ ${hostConfig.host}:${hostConfig.port} 预热完成: ${connections.length} 个连接`);
      return connections;
    });

    const results = await Promise.allSettled(warmupPromises);
    const totalWarmedConnections = results
      .filter(r => r.status === 'fulfilled')
      .reduce((sum, r) => sum + r.value.length, 0);

    console.log(`🔥 连接池预热完成: ${totalWarmedConnections} 个连接`);

    this.emit('pool-warmed', {
      totalConnections: totalWarmedConnections,
      hosts: hosts.length,
      timestamp: Date.now(),
    });
  }

  /**
   * 排空连接池
   */
  async drain(): Promise<void> {
    console.log('🔄 排空连接池...');

    // 停止接受新请求
    const connections = Array.from(this.connections.values());

    // 等待所有繁忙连接完成
    const busyConnections = connections.filter(conn => conn.state === ConnectionState.BUSY);
    if (busyConnections.length > 0) {
      console.log(`⏳ 等待 ${busyConnections.length} 个繁忙连接完成...`);

      await new Promise<void>(resolve => {
        const checkInterval = setInterval(() => {
          const stillBusy = Array.from(this.connections.values()).filter(conn => conn.state === ConnectionState.BUSY);

          if (stillBusy.length === 0) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);

        // 最多等待30秒
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 30000);
      });
    }

    // 关闭所有连接
    for (const connection of this.connections.values()) {
      this.connectionManager.destroy(connection.id, '连接池排空');
    }

    this.emit('pool-drained', { timestamp: Date.now() });
    console.log('✅ 连接池排空完成');
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    console.log('🧹 清理连接池...');

    // 停止监控组件
    this.healthMonitor.stop();
    this.performanceMonitor.stop();

    // 停止定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // 排空连接池
    await this.drain();

    // 清理各个管理器
    this.connectionManager.cleanup();
    this.poolManager.cleanup();
    this.connectionFactory.destroy();

    this.isInitialized = false;

    this.emit('pool-cleanup', { timestamp: Date.now() });
    console.log('✅ 连接池清理完成');
  }

  // ===== Private Helper Methods =====

  /**
   * 初始化核心组件
   */
  private initializeComponents(): void {
    // 初始化连接工厂
    this.connectionFactory = ConnectionFactoryManager.getInstance({
      connectionTimeout: this.config.connectionTimeout,
      retryAttempts: this.config.retryAttempts,
      retryDelay: this.config.retryDelay,
      enableKeepAlive: this.config.enableKeepAlive,
      keepAliveTimeout: this.config.keepAliveTimeout,
      enableCompression: this.config.enableCompression,
    });

    // 初始化连接管理器
    this.connectionManager = new ConnectionManager();

    // 初始化池管理器
    this.poolManager = new PoolManager(this.config);

    // 初始化健康监控器
    this.healthMonitor = new PoolHealthMonitor(DEFAULT_HEALTH_CONFIG, this.connections);

    // 初始化性能监控器
    this.performanceMonitor = new PoolPerformanceMonitor(DEFAULT_PERFORMANCE_CONFIG, this.connections, () =>
      this.poolManager.getQueueSize()
    );
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 连接管理器事件
    this.connectionManager.on('connection-closed', data => {
      this.connections.delete(data.connectionId);
      this.emit('connection-closed', data);
    });

    this.connectionManager.on('connection-error', data => {
      this.emit('connection-error', data);
    });

    // 池管理器事件
    this.poolManager.on('pool-full', data => {
      this.emit('pool-full', data);
    });

    this.poolManager.on('connection-acquired', data => {
      this.emit('connection-acquired', data);
    });

    this.poolManager.on('connection-released', data => {
      this.emit('connection-released', data);
    });

    // 健康监控事件
    this.healthMonitor.on('connection-unhealthy', data => {
      this.emit('connection-error', {
        connectionId: data.connectionId,
        error: data.errorMessage || '健康检查失败',
      });
    });

    this.healthMonitor.on('connection-requires-closure', data => {
      this.closeConnection(data.connectionId, data.reason);
    });

    this.healthMonitor.on('health-check-completed', data => {
      this.emit('health-check-completed', {
        healthyConnections: data.healthyCount,
        unhealthyConnections: data.unhealthyCount,
      });
    });

    // 性能监控事件
    this.performanceMonitor.on('metrics-collected', data => {
      this.emit('metrics-updated', {
        statistics: this.getStatistics(),
      });
    });

    this.performanceMonitor.on('performance-alerts', data => {
      console.warn('⚠️ 性能告警:', data.alerts);
    });
  }

  /**
   * 创建新连接
   */
  private async createNewConnection(host: string, port: number, protocol: ConnectionProtocol): Promise<ConnectionInfo> {
    const startTime = Date.now();

    try {
      // 使用连接工厂创建连接
      const connection = await this.connectionFactory.createConnection(host, port, protocol);

      // 添加到管理器
      this.connections.set(connection.id, connection);
      this.connectionManager.addConnection(connection);
      this.poolManager.addConnection(connection);

      // 标记为忙碌状态（新连接立即使用）
      this.connectionManager.markBusy(connection.id);

      // 记录连接时间
      const connectionTime = Date.now() - startTime;
      this.performanceMonitor.recordConnectionOperation('connection', connectionTime);

      this.emit('connection-created', {
        connectionId: connection.id,
        host,
        port,
      });

      console.log(`🔗 新连接已创建: ${host}:${port} (${connection.id})`);
      return connection;
    } catch (error) {
      const connectionTime = Date.now() - startTime;
      this.performanceMonitor.recordConnectionOperation('connection-failed', connectionTime);

      throw new ConnectionPoolError('create', `Failed to create connection to ${host}:${port}: ${error.message}`);
    }
  }

  /**
   * 启动维护定时器
   */
  private startMaintenanceTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.performMaintenance();
    }, 60000); // 每分钟执行一次维护
  }

  /**
   * 执行维护操作
   */
  private performMaintenance(): void {
    // 让连接管理器执行维护
    this.connectionManager.performMaintenance(this.config.idleTimeout);

    // 清理健康监控数据
    this.healthMonitor.cleanup();

    // 输出维护统计
    const stats = this.getStatistics();
    if (stats.totalConnections > 0) {
      console.log(
        `🧹 连接池维护: 总连接=${stats.totalConnections}, ` +
          `活跃=${stats.activeConnections}, 空闲=${stats.idleConnections}, ` +
          `等待=${stats.pendingRequests}`
      );
    }
  }
}
