/**
 * 连接管理器模块
 *
 * 负责单个连接的生命周期管理和状态维护
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { ConnectionInfo, ConnectionState, ConnectionError, PoolEvents } from './connection-types';

/**
 * 连接管理器接口
 */
export interface IConnectionManager {
  markBusy(connectionId: string): void;
  markIdle(connectionId: string): void;
  markError(connectionId: string, error: string): void;
  isAvailable(connectionId: string): boolean;
  getConnection(connectionId: string): ConnectionInfo | null;
  updateUsage(connectionId: string): void;
  checkTimeout(connectionId: string, idleTimeout: number): boolean;
  destroy(connectionId: string, reason: string): boolean;
}

/**
 * 连接管理器实现
 */
export class ConnectionManager extends EventEmitter implements IConnectionManager {
  private connections: Map<string, ConnectionInfo> = new Map();
  private connectionTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * 添加连接到管理器
   */
  addConnection(connection: ConnectionInfo): void {
    if (this.connections.has(connection.id)) {
      throw new ConnectionError(`Connection ${connection.id} already exists in manager`, connection.id);
    }

    this.connections.set(connection.id, connection);
    this.emit('connection-added', { connectionId: connection.id });
  }

  /**
   * 标记连接为忙碌状态
   */
  markBusy(connectionId: string): void {
    const connection = this.getConnection(connectionId);
    if (!connection) {
      throw new ConnectionError(`Connection ${connectionId} not found`, connectionId);
    }

    if (connection.state === ConnectionState.CLOSED || connection.state === ConnectionState.ERROR) {
      throw new ConnectionError(`Cannot mark closed/error connection as busy: ${connectionId}`, connectionId);
    }

    // 清除任何现有的空闲定时器
    this.clearIdleTimer(connectionId);

    // 更新连接状态
    connection.state = ConnectionState.BUSY;
    connection.isIdle = false;
    connection.lastUsedAt = Date.now();
    connection.usageCount++;

    this.emit('connection-state-changed', {
      connectionId,
      oldState: ConnectionState.IDLE,
      newState: ConnectionState.BUSY,
    });
  }

  /**
   * 标记连接为空闲状态
   */
  markIdle(connectionId: string): void {
    const connection = this.getConnection(connectionId);
    if (!connection) {
      throw new ConnectionError(`Connection ${connectionId} not found`, connectionId);
    }

    if (connection.state === ConnectionState.CLOSED || connection.state === ConnectionState.ERROR) {
      return; // 忽略已关闭或错误状态的连接
    }

    const oldState = connection.state;
    connection.state = ConnectionState.IDLE;
    connection.isIdle = true;
    connection.lastUsedAt = Date.now();

    this.emit('connection-state-changed', {
      connectionId,
      oldState,
      newState: ConnectionState.IDLE,
    });
  }

  /**
   * 标记连接为错误状态
   */
  markError(connectionId: string, error: string): void {
    const connection = this.getConnection(connectionId);
    if (!connection) {
      return; // 连接可能已被移除
    }

    const oldState = connection.state;
    connection.state = ConnectionState.ERROR;
    connection.isIdle = false;
    connection.metadata = {
      ...connection.metadata,
      error,
      errorTime: Date.now(),
    };

    // 清除空闲定时器
    this.clearIdleTimer(connectionId);

    this.emit('connection-state-changed', {
      connectionId,
      oldState,
      newState: ConnectionState.ERROR,
    });

    this.emit('connection-error', {
      connectionId,
      error,
    });
  }

  /**
   * 检查连接是否可用
   */
  isAvailable(connectionId: string): boolean {
    const connection = this.getConnection(connectionId);
    if (!connection) {
      return false;
    }

    return connection.state === ConnectionState.IDLE && connection.isIdle;
  }

  /**
   * 获取连接信息
   */
  getConnection(connectionId: string): ConnectionInfo | null {
    return this.connections.get(connectionId) || null;
  }

  /**
   * 更新连接使用情况
   */
  updateUsage(connectionId: string): void {
    const connection = this.getConnection(connectionId);
    if (connection) {
      connection.lastUsedAt = Date.now();
      connection.usageCount++;
    }
  }

  /**
   * 检查连接是否超时
   */
  checkTimeout(connectionId: string, idleTimeout: number): boolean {
    const connection = this.getConnection(connectionId);
    if (!connection) {
      return true; // 不存在的连接视为超时
    }

    if (connection.state !== ConnectionState.IDLE) {
      return false; // 非空闲连接不检查超时
    }

    const idleTime = Date.now() - connection.lastUsedAt;
    return idleTime >= idleTimeout;
  }

  /**
   * 销毁连接
   */
  destroy(connectionId: string, reason: string): boolean {
    const connection = this.getConnection(connectionId);
    if (!connection) {
      return false;
    }

    // 清除定时器
    this.clearIdleTimer(connectionId);

    // 关闭socket
    if (connection.socket) {
      try {
        connection.socket.destroy();
      } catch (error) {
        // 忽略关闭错误
      }
    }

    // 更新状态
    connection.state = ConnectionState.CLOSED;

    // 从管理器中移除
    this.connections.delete(connectionId);

    this.emit('connection-closed', {
      connectionId,
      reason,
    });

    return true;
  }

  /**
   * 设置空闲超时
   */
  setIdleTimeout(connectionId: string, timeout: number): void {
    // 清除现有定时器
    this.clearIdleTimer(connectionId);

    // 设置新的定时器
    const timer = setTimeout(() => {
      const connection = this.getConnection(connectionId);
      if (connection && connection.state === ConnectionState.IDLE) {
        this.destroy(connectionId, '空闲超时');
      }
    }, timeout);

    this.connectionTimers.set(connectionId, timer);
  }

  /**
   * 获取所有连接信息
   */
  getAllConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  /**
   * 获取指定状态的连接
   */
  getConnectionsByState(state: ConnectionState): ConnectionInfo[] {
    return Array.from(this.connections.values()).filter(conn => conn.state === state);
  }

  /**
   * 获取指定主机的连接
   */
  getConnectionsByHost(host: string, port?: number): ConnectionInfo[] {
    return Array.from(this.connections.values()).filter(conn => {
      if (port !== undefined) {
        return conn.host === host && conn.port === port;
      }
      return conn.host === host;
    });
  }

  /**
   * 获取管理器统计信息
   */
  getStatistics() {
    const connections = Array.from(this.connections.values());

    return {
      total: connections.length,
      busy: connections.filter(c => c.state === ConnectionState.BUSY).length,
      idle: connections.filter(c => c.state === ConnectionState.IDLE).length,
      connecting: connections.filter(c => c.state === ConnectionState.CONNECTING).length,
      error: connections.filter(c => c.state === ConnectionState.ERROR).length,
      closed: connections.filter(c => c.state === ConnectionState.CLOSED).length,
      totalUsage: connections.reduce((sum, c) => sum + c.usageCount, 0),
      averageAge:
        connections.length > 0
          ? connections.reduce((sum, c) => sum + (Date.now() - c.createdAt), 0) / connections.length
          : 0,
    };
  }

  /**
   * 清理所有连接
   */
  cleanup(): void {
    // 清除所有定时器
    for (const timer of this.connectionTimers.values()) {
      clearTimeout(timer);
    }
    this.connectionTimers.clear();

    // 销毁所有连接
    const connectionIds = Array.from(this.connections.keys());
    for (const connectionId of connectionIds) {
      this.destroy(connectionId, '管理器清理');
    }

    this.connections.clear();

    this.emit('manager-cleanup', { timestamp: Date.now() });
  }

  /**
   * 执行维护操作
   */
  performMaintenance(idleTimeout: number): void {
    const now = Date.now();
    const connectionsToCleanup: string[] = [];

    for (const connection of this.connections.values()) {
      // 清理超时的空闲连接
      if (connection.state === ConnectionState.IDLE) {
        const idleTime = now - connection.lastUsedAt;
        if (idleTime > idleTimeout) {
          connectionsToCleanup.push(connection.id);
        }
      }

      // 清理错误状态的连接
      if (connection.state === ConnectionState.ERROR) {
        connectionsToCleanup.push(connection.id);
      }
    }

    // 执行清理
    for (const connectionId of connectionsToCleanup) {
      this.destroy(connectionId, '维护清理');
    }

    if (connectionsToCleanup.length > 0) {
      this.emit('maintenance-completed', {
        cleanedConnections: connectionsToCleanup.length,
        timestamp: now,
      });
    }
  }

  // ===== Private Methods =====

  private clearIdleTimer(connectionId: string): void {
    const timer = this.connectionTimers.get(connectionId);
    if (timer) {
      clearTimeout(timer);
      this.connectionTimers.delete(connectionId);
    }
  }
}
