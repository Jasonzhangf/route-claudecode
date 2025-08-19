/**
 * 连接工厂模块
 *
 * 负责创建和初始化各种类型的Provider连接
 *
 * @author Jason Zhang
 */

import * as http from 'http';
import * as https from 'https';
import {
  ConnectionInfo,
  ConnectionState,
  ConnectionProtocol,
  ConnectionFactoryConfig,
  ConnectionError,
  DEFAULT_POOL_CONFIG,
} from './connection-types';

/**
 * 连接工厂类
 */
export class ConnectionFactory {
  private config: ConnectionFactoryConfig;
  private httpAgent: http.Agent;
  private httpsAgent: https.Agent;

  constructor(config?: Partial<ConnectionFactoryConfig>) {
    this.config = {
      connectionTimeout: config?.connectionTimeout ?? DEFAULT_POOL_CONFIG.connectionTimeout,
      retryAttempts: config?.retryAttempts ?? DEFAULT_POOL_CONFIG.retryAttempts,
      retryDelay: config?.retryDelay ?? DEFAULT_POOL_CONFIG.retryDelay,
      enableKeepAlive: config?.enableKeepAlive ?? DEFAULT_POOL_CONFIG.enableKeepAlive,
      keepAliveTimeout: config?.keepAliveTimeout ?? DEFAULT_POOL_CONFIG.keepAliveTimeout,
      enableCompression: config?.enableCompression ?? DEFAULT_POOL_CONFIG.enableCompression,
    };

    this.initializeAgents();
  }

  /**
   * 创建新连接
   */
  async createConnection(host: string, port: number, protocol: ConnectionProtocol): Promise<ConnectionInfo> {
    const connectionId = this.generateConnectionId();

    const connection: ConnectionInfo = {
      id: connectionId,
      host,
      port,
      protocol,
      state: ConnectionState.CONNECTING,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      usageCount: 0,
      isIdle: false,
      metadata: {
        factory: 'ConnectionFactory',
        version: '1.0.0',
      },
    };

    try {
      await this.establishConnection(connection);
      connection.state = ConnectionState.CONNECTED;
      return connection;
    } catch (error) {
      connection.state = ConnectionState.ERROR;
      throw new ConnectionError(`Failed to create connection: ${error.message}`, connectionId, host, port);
    }
  }

  /**
   * 创建多个连接
   */
  async createConnections(
    host: string,
    port: number,
    protocol: ConnectionProtocol,
    count: number
  ): Promise<ConnectionInfo[]> {
    const connections: ConnectionInfo[] = [];
    const errors: Error[] = [];

    const promises = Array.from({ length: count }, async () => {
      try {
        const connection = await this.createConnection(host, port, protocol);
        connections.push(connection);
      } catch (error) {
        errors.push(error);
      }
    });

    await Promise.allSettled(promises);

    if (errors.length > 0 && connections.length === 0) {
      throw new ConnectionError(
        `Failed to create any connections. Errors: ${errors.map(e => e.message).join(', ')}`,
        undefined,
        host,
        port
      );
    }

    return connections;
  }

  /**
   * 验证连接可用性
   */
  async validateConnection(connection: ConnectionInfo): Promise<boolean> {
    if (connection.state === ConnectionState.CLOSED || connection.state === ConnectionState.ERROR) {
      return false;
    }

    try {
      // 简单的连接健康检查
      await this.performHealthCheck(connection);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取HTTP Agent
   */
  getHttpAgent(): http.Agent {
    return this.httpAgent;
  }

  /**
   * 获取HTTPS Agent
   */
  getHttpsAgent(): https.Agent {
    return this.httpsAgent;
  }

  /**
   * 销毁工厂资源
   */
  destroy(): void {
    this.httpAgent.destroy();
    this.httpsAgent.destroy();
  }

  // ===== Private Methods =====

  private initializeAgents(): void {
    const commonOptions = {
      keepAlive: this.config.enableKeepAlive,
      keepAliveMsecs: this.config.keepAliveTimeout,
      timeout: this.config.connectionTimeout,
    };

    this.httpAgent = new http.Agent(commonOptions);
    this.httpsAgent = new https.Agent(commonOptions);
  }

  private generateConnectionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `conn-${timestamp}-${random}`;
  }

  private async establishConnection(connection: ConnectionInfo): Promise<void> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < this.config.retryAttempts) {
      try {
        await this.attemptConnection(connection);
        return; // 连接成功
      } catch (error) {
        lastError = error;
        attempt++;

        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * attempt); // 指数退避
        }
      }
    }

    throw lastError || new ConnectionError('Connection establishment failed after all retries');
  }

  private async attemptConnection(connection: ConnectionInfo): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const timeout = setTimeout(() => {
        reject(
          new ConnectionError(
            `Connection timeout after ${this.config.connectionTimeout}ms`,
            connection.id,
            connection.host,
            connection.port
          )
        );
      }, this.config.connectionTimeout);

      // 模拟连接建立过程
      const connectionDelay = this.calculateConnectionDelay();

      setTimeout(() => {
        clearTimeout(timeout);

        // 模拟90%的成功率
        if (Math.random() > 0.1) {
          const connectionTime = Date.now() - startTime;
          connection.metadata = {
            ...connection.metadata,
            connectionTime,
            establishedAt: Date.now(),
          };
          resolve();
        } else {
          reject(new ConnectionError('Simulated connection failure', connection.id, connection.host, connection.port));
        }
      }, connectionDelay);
    });
  }

  private async performHealthCheck(connection: ConnectionInfo): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new ConnectionError('Health check timeout', connection.id, connection.host, connection.port));
      }, 5000); // 5秒健康检查超时

      // 模拟健康检查
      setTimeout(
        () => {
          clearTimeout(timeout);

          if (connection.state === ConnectionState.CONNECTED || connection.state === ConnectionState.IDLE) {
            resolve();
          } else {
            reject(new ConnectionError(`Connection is in invalid state: ${connection.state}`, connection.id));
          }
        },
        Math.random() * 100 + 50
      ); // 50-150ms 健康检查时间
    });
  }

  private calculateConnectionDelay(): number {
    // 基于协议和配置计算连接延迟
    const baseDelay = 100; // 基础延迟100ms
    const randomDelay = Math.random() * 500; // 0-500ms随机延迟
    return baseDelay + randomDelay;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 连接工厂单例管理器
 */
export class ConnectionFactoryManager {
  private static instance: ConnectionFactory | null = null;
  private static config: ConnectionFactoryConfig | null = null;

  /**
   * 获取全局连接工厂实例
   */
  static getInstance(config?: Partial<ConnectionFactoryConfig>): ConnectionFactory {
    if (!ConnectionFactoryManager.instance) {
      ConnectionFactoryManager.config = {
        connectionTimeout: config?.connectionTimeout ?? DEFAULT_POOL_CONFIG.connectionTimeout,
        retryAttempts: config?.retryAttempts ?? DEFAULT_POOL_CONFIG.retryAttempts,
        retryDelay: config?.retryDelay ?? DEFAULT_POOL_CONFIG.retryDelay,
        enableKeepAlive: config?.enableKeepAlive ?? DEFAULT_POOL_CONFIG.enableKeepAlive,
        keepAliveTimeout: config?.keepAliveTimeout ?? DEFAULT_POOL_CONFIG.keepAliveTimeout,
        enableCompression: config?.enableCompression ?? DEFAULT_POOL_CONFIG.enableCompression,
      };

      ConnectionFactoryManager.instance = new ConnectionFactory(ConnectionFactoryManager.config);
    }

    return ConnectionFactoryManager.instance;
  }

  /**
   * 销毁全局实例
   */
  static destroyInstance(): void {
    if (ConnectionFactoryManager.instance) {
      ConnectionFactoryManager.instance.destroy();
      ConnectionFactoryManager.instance = null;
      ConnectionFactoryManager.config = null;
    }
  }

  /**
   * 重新配置全局实例
   */
  static reconfigure(config: Partial<ConnectionFactoryConfig>): ConnectionFactory {
    ConnectionFactoryManager.destroyInstance();
    return ConnectionFactoryManager.getInstance(config);
  }
}
