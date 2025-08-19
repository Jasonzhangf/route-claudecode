/**
 * 池管理器模块
 *
 * 负责连接池的核心管理逻辑，包括连接分配、队列管理、负载均衡
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import {
  ConnectionInfo,
  ConnectionRequest,
  ConnectionState,
  ConnectionProtocol,
  RequestPriority,
  ConnectionPoolConfig,
  ConnectionPoolError,
  PRIORITY_WEIGHTS,
} from './connection-types';

/**
 * 池管理器接口
 */
export interface IPoolManager {
  acquireConnection(
    host: string,
    port: number,
    protocol: ConnectionProtocol,
    priority: RequestPriority
  ): Promise<ConnectionInfo>;
  releaseConnection(connectionId: string): void;
  addConnection(connection: ConnectionInfo): void;
  removeConnection(connectionId: string): boolean;
  getPoolSize(): number;
  getQueueSize(): number;
  canCreateConnection(host: string, port: number): boolean;
}

/**
 * 池管理器实现
 */
export class PoolManager extends EventEmitter implements IPoolManager {
  private config: ConnectionPoolConfig;
  private connections: Map<string, ConnectionInfo> = new Map();
  private connectionsByHost: Map<string, Set<string>> = new Map();
  private pendingRequests: Map<string, ConnectionRequest> = new Map();
  private requestQueue: ConnectionRequest[] = [];

  constructor(config: ConnectionPoolConfig) {
    super();
    this.config = config;
  }

  /**
   * 获取连接
   */
  async acquireConnection(
    host: string,
    port: number,
    protocol: ConnectionProtocol,
    priority: RequestPriority = 'normal'
  ): Promise<ConnectionInfo> {
    const hostKey = this.generateHostKey(host, port, protocol);

    // 尝试复用现有空闲连接
    const existingConnection = this.findAvailableConnection(hostKey);
    if (existingConnection) {
      this.markConnectionAcquired(existingConnection);
      return existingConnection;
    }

    // 检查是否可以创建新连接
    if (!this.canCreateConnection(host, port)) {
      // 加入等待队列
      return this.enqueueConnectionRequest(host, port, protocol, priority);
    }

    // 无法立即获取连接，加入队列
    return this.enqueueConnectionRequest(host, port, protocol, priority);
  }

  /**
   * 释放连接
   */
  releaseConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      console.warn(`尝试释放不存在的连接: ${connectionId}`);
      return;
    }

    if (connection.state !== ConnectionState.BUSY) {
      console.warn(`尝试释放非忙碌状态的连接: ${connectionId}, 状态: ${connection.state}`);
      return;
    }

    this.markConnectionReleased(connection);

    // 处理等待队列
    this.processQueuedRequests();
  }

  /**
   * 添加连接到池中
   */
  addConnection(connection: ConnectionInfo): void {
    if (this.connections.has(connection.id)) {
      throw new ConnectionPoolError('add', `Connection ${connection.id} already exists in pool`);
    }

    this.connections.set(connection.id, connection);

    const hostKey = this.generateHostKey(connection.host, connection.port, connection.protocol);
    if (!this.connectionsByHost.has(hostKey)) {
      this.connectionsByHost.set(hostKey, new Set());
    }
    this.connectionsByHost.get(hostKey)!.add(connection.id);

    this.emit('connection-added', {
      connectionId: connection.id,
      host: connection.host,
      port: connection.port,
    });
  }

  /**
   * 从池中移除连接
   */
  removeConnection(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    // 从主映射中移除
    this.connections.delete(connectionId);

    // 从主机映射中移除
    const hostKey = this.generateHostKey(connection.host, connection.port, connection.protocol);
    const hostConnections = this.connectionsByHost.get(hostKey);
    if (hostConnections) {
      hostConnections.delete(connectionId);
      if (hostConnections.size === 0) {
        this.connectionsByHost.delete(hostKey);
      }
    }

    this.emit('connection-removed', {
      connectionId,
      host: connection.host,
      port: connection.port,
    });

    return true;
  }

  /**
   * 获取池大小
   */
  getPoolSize(): number {
    return this.connections.size;
  }

  /**
   * 获取队列大小
   */
  getQueueSize(): number {
    return this.requestQueue.length;
  }

  /**
   * 检查是否可以创建新连接
   */
  canCreateConnection(host: string, port: number): boolean {
    // 检查总连接数限制
    if (this.connections.size >= this.config.maxConnections) {
      return false;
    }

    // 检查每个主机的连接数限制
    const hostKey = this.generateHostKey(host, port, 'http'); // 协议在此处不重要
    const hostConnections = this.getHostConnections(host, port);
    if (hostConnections.length >= this.config.maxConnectionsPerHost) {
      return false;
    }

    return true;
  }

  /**
   * 获取池统计信息
   */
  getStatistics() {
    const connections = Array.from(this.connections.values());

    return {
      totalConnections: connections.length,
      activeConnections: connections.filter(c => c.state === ConnectionState.BUSY).length,
      idleConnections: connections.filter(c => c.state === ConnectionState.IDLE).length,
      pendingRequests: this.requestQueue.length,
      connectionsByHost: new Map(
        Array.from(this.connectionsByHost.entries()).map(([host, connections]) => [host, connections.size])
      ),
      queueByPriority: this.getQueueStatisticsByPriority(),
    };
  }

  /**
   * 获取指定主机的连接
   */
  getHostConnections(host: string, port: number): ConnectionInfo[] {
    return Array.from(this.connections.values()).filter(conn => conn.host === host && conn.port === port);
  }

  /**
   * 获取可用连接
   */
  getAvailableConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values()).filter(conn => conn.state === ConnectionState.IDLE && conn.isIdle);
  }

  /**
   * 清空等待队列
   */
  clearQueue(reason: string = '队列清空'): void {
    const requests = [...this.requestQueue];
    this.requestQueue = [];
    this.pendingRequests.clear();

    // 拒绝所有等待的请求
    for (const request of requests) {
      request.reject(new ConnectionPoolError('queue-cleared', reason));
    }

    this.emit('queue-cleared', {
      clearedRequests: requests.length,
      reason,
    });
  }

  /**
   * 清理池资源
   */
  cleanup(): void {
    this.clearQueue('池清理');
    this.connections.clear();
    this.connectionsByHost.clear();

    this.emit('pool-cleanup', { timestamp: Date.now() });
  }

  // ===== Private Methods =====

  private findAvailableConnection(hostKey: string): ConnectionInfo | null {
    const hostConnections = this.connectionsByHost.get(hostKey);
    if (!hostConnections) {
      return null;
    }

    // 寻找最适合的空闲连接（使用最少的连接优先）
    let bestConnection: ConnectionInfo | null = null;
    let minUsageCount = Infinity;

    for (const connectionId of hostConnections) {
      const connection = this.connections.get(connectionId);
      if (connection && connection.state === ConnectionState.IDLE && connection.isIdle) {
        if (connection.usageCount < minUsageCount) {
          minUsageCount = connection.usageCount;
          bestConnection = connection;
        }
      }
    }

    return bestConnection;
  }

  private markConnectionAcquired(connection: ConnectionInfo): void {
    connection.state = ConnectionState.BUSY;
    connection.isIdle = false;
    connection.lastUsedAt = Date.now();
    connection.usageCount++;

    this.emit('connection-acquired', {
      connectionId: connection.id,
      requestId: `req-${Date.now()}`,
    });
  }

  private markConnectionReleased(connection: ConnectionInfo): void {
    connection.state = ConnectionState.IDLE;
    connection.isIdle = true;
    connection.lastUsedAt = Date.now();

    this.emit('connection-released', {
      connectionId: connection.id,
      requestId: `req-${Date.now()}`,
    });
  }

  private async enqueueConnectionRequest(
    host: string,
    port: number,
    protocol: ConnectionProtocol,
    priority: RequestPriority
  ): Promise<ConnectionInfo> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();
      const request: ConnectionRequest = {
        id: requestId,
        host,
        port,
        protocol,
        priority,
        timeout: this.config.connectionTimeout,
        timestamp: Date.now(),
        resolve,
        reject,
      };

      // 添加到映射和队列
      this.pendingRequests.set(requestId, request);
      this.insertRequestByPriority(request);

      // 如果池已满，发出事件
      if (this.connections.size >= this.config.maxConnections) {
        this.emit('pool-full', {
          pendingRequests: this.requestQueue.length,
        });
      }

      // 设置请求超时
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          const queueIndex = this.requestQueue.findIndex(r => r.id === requestId);
          if (queueIndex >= 0) {
            this.requestQueue.splice(queueIndex, 1);
          }
          reject(new ConnectionPoolError('acquire', 'Connection request timeout'));
        }
      }, request.timeout);

      this.emit('request-queued', {
        requestId,
        priority,
        queueSize: this.requestQueue.length,
      });
    });
  }

  private insertRequestByPriority(request: ConnectionRequest): void {
    const requestPriority = PRIORITY_WEIGHTS[request.priority];

    // 找到合适的插入位置（按优先级和时间戳排序）
    let insertIndex = 0;
    for (let i = 0; i < this.requestQueue.length; i++) {
      const existingPriority = PRIORITY_WEIGHTS[this.requestQueue[i].priority];

      if (requestPriority > existingPriority) {
        insertIndex = i;
        break;
      } else if (requestPriority === existingPriority) {
        // 相同优先级按时间戳排序（FIFO）
        if (request.timestamp < this.requestQueue[i].timestamp) {
          insertIndex = i;
          break;
        }
      }
      insertIndex = i + 1;
    }

    this.requestQueue.splice(insertIndex, 0, request);
  }

  private processQueuedRequests(): void {
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue[0];
      const hostKey = this.generateHostKey(request.host, request.port, request.protocol);

      // 尝试获取可用连接
      const availableConnection = this.findAvailableConnection(hostKey);
      if (availableConnection) {
        // 移除请求
        this.requestQueue.shift();
        this.pendingRequests.delete(request.id);

        // 分配连接
        this.markConnectionAcquired(availableConnection);
        request.resolve(availableConnection);

        this.emit('request-fulfilled', {
          requestId: request.id,
          connectionId: availableConnection.id,
        });
      } else {
        // 无可用连接，停止处理
        break;
      }
    }
  }

  private getQueueStatisticsByPriority() {
    const stats = { high: 0, normal: 0, low: 0 };
    for (const request of this.requestQueue) {
      stats[request.priority]++;
    }
    return stats;
  }

  private generateHostKey(host: string, port: number, protocol: ConnectionProtocol): string {
    return `${protocol}://${host}:${port}`;
  }

  private generateRequestId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `req-${timestamp}-${random}`;
  }
}
