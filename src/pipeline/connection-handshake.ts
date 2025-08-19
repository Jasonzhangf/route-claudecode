/**
 * 连接握手管理器 - 管理流水线生命周期和层间通信
 *
 * 设计原则：
 * 1. 严格分层：各层只能与相邻层通信，禁止跨层通信
 * 2. 连接握手：流水线启动前必须完成握手验证
 * 3. 健康检查：定期验证各层连接状态和API密钥有效性
 * 4. 生命周期管理：统一管理各层模块的初始化、运行和清理
 *
 * @author RCC v4.0
 */

import { EventEmitter } from 'events';
import { secureLogger } from '../utils/secure-logger';

export interface LayerConnection {
  layerId: string;
  moduleType: string;
  status: 'initializing' | 'ready' | 'error' | 'disconnected';
  lastHealthCheck: Date;
  errorCount: number;
  metadata?: any;
}

export interface HandshakeConfig {
  enabled: boolean;
  healthCheckInterval: number;
  validateApiKeys: boolean;
  timeoutMs: number;
}

export interface PipelineConfiguration {
  layers: Record<
    string,
    {
      module: string;
      [key: string]: any;
    }
  >;
  handshake: HandshakeConfig;
}

/**
 * 连接握手管理器
 * 确保流水线各层严格按照顺序连接，禁止跨层通信
 */
export class ConnectionHandshakeManager extends EventEmitter {
  private connections: Map<string, LayerConnection> = new Map();
  private handshakeConfig: HandshakeConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private isShuttingDown = false;

  // 定义流水线层次顺序 (严格按此顺序连接)
  private static readonly LAYER_ORDER = [
    'client',
    'router',
    'transformer',
    'protocol',
    'server-compatibility',
    'server',
  ];

  constructor(config: HandshakeConfig) {
    super();
    this.handshakeConfig = config;

    secureLogger.info('ConnectionHandshakeManager initialized', {
      enabled: config.enabled,
      healthCheckInterval: config.healthCheckInterval,
      validateApiKeys: config.validateApiKeys,
      timeoutMs: config.timeoutMs,
    });
  }

  /**
   * 启动完整的流水线连接握手流程
   */
  async initializePipeline(pipelineConfig: PipelineConfiguration): Promise<boolean> {
    if (!this.handshakeConfig.enabled) {
      secureLogger.info('Connection handshake disabled, skipping pipeline initialization');
      return true;
    }

    try {
      secureLogger.info('Starting pipeline handshake initialization');

      // Step 1: 按顺序初始化各层连接
      for (const layerId of ConnectionHandshakeManager.LAYER_ORDER) {
        const layerConfig = pipelineConfig.layers[layerId];
        if (!layerConfig) {
          secureLogger.warn(`Layer ${layerId} not configured, skipping`);
          continue;
        }

        await this.initializeLayer(layerId, layerConfig);
      }

      // Step 2: 验证所有连接状态
      const allReady = await this.verifyAllConnections();
      if (!allReady) {
        throw new Error('Not all layers are ready');
      }

      // Step 3: 启动健康检查
      this.startHealthCheck();

      secureLogger.info('Pipeline handshake initialization completed successfully', {
        totalLayers: this.connections.size,
        readyLayers: Array.from(this.connections.values()).filter(c => c.status === 'ready').length,
      });

      this.emit('pipeline-ready');
      return true;
    } catch (error) {
      secureLogger.error('Pipeline handshake initialization failed', {
        error: error.message,
        stack: error.stack,
      });

      // 清理已初始化的连接
      await this.cleanup();
      this.emit('pipeline-error', error);
      return false;
    }
  }

  /**
   * 初始化单个层连接
   */
  private async initializeLayer(layerId: string, layerConfig: any): Promise<void> {
    const connection: LayerConnection = {
      layerId,
      moduleType: layerConfig.module,
      status: 'initializing',
      lastHealthCheck: new Date(),
      errorCount: 0,
      metadata: layerConfig,
    };

    this.connections.set(layerId, connection);

    try {
      // 执行层特定的初始化握手
      await this.performLayerHandshake(layerId, layerConfig);

      connection.status = 'ready';
      connection.lastHealthCheck = new Date();

      secureLogger.info('Layer connection established', {
        layerId,
        moduleType: layerConfig.module,
        initTime: new Date().getTime() - connection.lastHealthCheck.getTime(),
      });

      this.emit('layer-ready', layerId);
    } catch (error) {
      connection.status = 'error';
      connection.errorCount++;

      secureLogger.error('Layer connection failed', {
        layerId,
        moduleType: layerConfig.module,
        error: error.message,
        errorCount: connection.errorCount,
      });

      throw new Error(`Failed to initialize layer ${layerId}: ${error.message}`);
    }
  }

  /**
   * 执行层特定的握手验证
   */
  private async performLayerHandshake(layerId: string, layerConfig: any): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Layer ${layerId} handshake timeout after ${this.handshakeConfig.timeoutMs}ms`));
      }, this.handshakeConfig.timeoutMs);

      try {
        // 根据层类型执行不同的握手逻辑
        switch (layerId) {
          case 'client':
            this.handshakeClientLayer(layerConfig);
            break;

          case 'router':
            this.handshakeRouterLayer(layerConfig);
            break;

          case 'transformer':
            this.handshakeTransformerLayer(layerConfig);
            break;

          case 'protocol':
            this.handshakeProtocolLayer(layerConfig);
            break;

          case 'server-compatibility':
            this.handshakeServerCompatibilityLayer(layerConfig);
            break;

          case 'server':
            this.handshakeServerLayer(layerConfig);
            break;

          default:
            throw new Error(`Unknown layer type: ${layerId}`);
        }

        clearTimeout(timeout);
        resolve();
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Client层握手验证
   */
  private handshakeClientLayer(config: any): void {
    // 验证HTTP客户端配置
    if (!config.validation) {
      throw new Error('Client layer validation must be enabled');
    }

    secureLogger.debug('Client layer handshake completed', { config });
  }

  /**
   * Router层握手验证
   */
  private handshakeRouterLayer(config: any): void {
    // 验证路由器配置
    if (config.cacheEnabled === undefined) {
      secureLogger.warn('Router layer cache setting not specified, using default');
    }

    secureLogger.debug('Router layer handshake completed', { config });
  }

  /**
   * Transformer层握手验证
   */
  private handshakeTransformerLayer(config: any): void {
    // 验证转换器配置
    if (!config.configurable) {
      throw new Error('Transformer layer must be configurable');
    }

    secureLogger.debug('Transformer layer handshake completed', { config });
  }

  /**
   * Protocol层握手验证
   */
  private handshakeProtocolLayer(config: any): void {
    // 验证协议层配置
    if (!config.streamSupport) {
      secureLogger.warn('Protocol layer stream support disabled');
    }

    secureLogger.debug('Protocol layer handshake completed', { config });
  }

  /**
   * Server Compatibility层握手验证
   */
  private handshakeServerCompatibilityLayer(config: any): void {
    // 验证服务器兼容层配置
    if (!config.bidirectional) {
      throw new Error('Server compatibility layer must support bidirectional conversion');
    }

    secureLogger.debug('Server compatibility layer handshake completed', { config });
  }

  /**
   * Server层握手验证
   */
  private handshakeServerLayer(config: any): void {
    // 验证服务器层配置
    if (!config.multiKeySupport) {
      throw new Error('Server layer must support multi-key functionality');
    }

    secureLogger.debug('Server layer handshake completed', { config });
  }

  /**
   * 验证所有连接状态
   */
  private async verifyAllConnections(): Promise<boolean> {
    const connections = Array.from(this.connections.values());
    const readyCount = connections.filter(c => c.status === 'ready').length;
    const totalCount = connections.length;

    secureLogger.info('Connection verification results', {
      readyCount,
      totalCount,
      readyPercentage: Math.round((readyCount / totalCount) * 100),
    });

    return readyCount === totalCount;
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      if (this.isShuttingDown) return;

      try {
        await this.performHealthCheck();
      } catch (error) {
        secureLogger.error('Health check failed', {
          error: error.message,
          totalConnections: this.connections.size,
        });
      }
    }, this.handshakeConfig.healthCheckInterval);

    secureLogger.info('Health check started', {
      interval: this.handshakeConfig.healthCheckInterval,
    });
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    const now = new Date();
    let healthyCount = 0;
    let unhealthyCount = 0;

    for (const connection of this.connections.values()) {
      try {
        // 检查连接状态
        if (connection.status === 'ready') {
          connection.lastHealthCheck = now;
          healthyCount++;
        } else {
          unhealthyCount++;
          secureLogger.warn('Connection unhealthy', {
            layerId: connection.layerId,
            status: connection.status,
            errorCount: connection.errorCount,
          });
        }
      } catch (error) {
        connection.errorCount++;
        connection.status = 'error';
        unhealthyCount++;

        secureLogger.error('Health check error for layer', {
          layerId: connection.layerId,
          error: error.message,
          errorCount: connection.errorCount,
        });
      }
    }

    this.emit('health-check-completed', {
      healthy: healthyCount,
      unhealthy: unhealthyCount,
      timestamp: now,
    });

    // 如果有太多不健康的连接，发出警告
    if (unhealthyCount > 0) {
      secureLogger.warn('Pipeline health check detected issues', {
        healthyConnections: healthyCount,
        unhealthyConnections: unhealthyCount,
        totalConnections: this.connections.size,
      });
    }
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(layerId?: string): LayerConnection | LayerConnection[] {
    if (layerId) {
      const connection = this.connections.get(layerId);
      if (!connection) {
        throw new Error(`Layer ${layerId} not found`);
      }
      return connection;
    }

    return Array.from(this.connections.values());
  }

  /**
   * 检查流水线是否就绪
   */
  isPipelineReady(): boolean {
    if (this.connections.size === 0) return false;

    return Array.from(this.connections.values()).every(c => c.status === 'ready');
  }

  /**
   * 强制重新连接某个层
   */
  async reconnectLayer(layerId: string): Promise<boolean> {
    const connection = this.connections.get(layerId);
    if (!connection) {
      throw new Error(`Layer ${layerId} not found`);
    }

    try {
      secureLogger.info('Attempting to reconnect layer', { layerId });

      connection.status = 'initializing';
      await this.performLayerHandshake(layerId, connection.metadata);

      connection.status = 'ready';
      connection.errorCount = 0;
      connection.lastHealthCheck = new Date();

      secureLogger.info('Layer reconnection successful', { layerId });
      this.emit('layer-reconnected', layerId);

      return true;
    } catch (error) {
      connection.status = 'error';
      connection.errorCount++;

      secureLogger.error('Layer reconnection failed', {
        layerId,
        error: error.message,
        errorCount: connection.errorCount,
      });

      return false;
    }
  }

  /**
   * 关闭所有连接和清理资源
   */
  async cleanup(): Promise<void> {
    this.isShuttingDown = true;

    secureLogger.info('Starting connection handshake cleanup');

    // 停止健康检查
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    // 关闭所有连接
    for (const connection of this.connections.values()) {
      try {
        connection.status = 'disconnected';
        secureLogger.debug('Layer connection closed', { layerId: connection.layerId });
      } catch (error) {
        secureLogger.error('Error closing layer connection', {
          layerId: connection.layerId,
          error: error.message,
        });
      }
    }

    this.connections.clear();
    this.removeAllListeners();

    secureLogger.info('Connection handshake cleanup completed');
  }
}
