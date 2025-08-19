/**
 * 连接相关的接口和类型定义
 *
 * 统一管理连接池系统中所有的类型定义和接口
 *
 * @author Jason Zhang
 */

/**
 * 连接状态枚举
 */
export enum ConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  IDLE = 'idle',
  BUSY = 'busy',
  CLOSING = 'closing',
  CLOSED = 'closed',
  ERROR = 'error',
}

/**
 * 连接协议类型
 */
export type ConnectionProtocol = 'http' | 'https';

/**
 * 请求优先级类型
 */
export type RequestPriority = 'high' | 'normal' | 'low';

/**
 * 连接池配置接口
 */
export interface ConnectionPoolConfig {
  maxConnections: number; // 最大连接数
  maxIdleConnections: number; // 最大空闲连接数
  maxConnectionsPerHost: number; // 每个主机的最大连接数
  connectionTimeout: number; // 连接超时 (毫秒)
  idleTimeout: number; // 空闲超时 (毫秒)
  keepAliveTimeout: number; // Keep-Alive超时 (毫秒)
  retryAttempts: number; // 重试次数
  retryDelay: number; // 重试延迟 (毫秒)
  enableKeepAlive: boolean; // 启用Keep-Alive
  enableCompression: boolean; // 启用压缩
  monitoring: {
    enabled: boolean;
    metricsInterval: number; // 指标收集间隔 (毫秒)
  };
}

/**
 * 连接信息接口
 */
export interface ConnectionInfo {
  id: string;
  host: string;
  port: number;
  protocol: ConnectionProtocol;
  state: ConnectionState;
  createdAt: number;
  lastUsedAt: number;
  usageCount: number;
  isIdle: boolean;
  socket?: any;
  metadata?: Record<string, any>;
}

/**
 * 连接请求接口
 */
export interface ConnectionRequest {
  id: string;
  host: string;
  port: number;
  protocol: ConnectionProtocol;
  priority: RequestPriority;
  timeout: number;
  timestamp: number;
  resolve: (connection: ConnectionInfo) => void;
  reject: (error: Error) => void;
}

/**
 * 连接池统计指标接口
 */
export interface PoolMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageConnectionTime: number;
  averageRequestTime: number;
  poolUtilization: number; // 连接池利用率
  hitRate: number; // 连接复用命中率
}

/**
 * 连接池统计信息接口
 */
export interface PoolStatistics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  pendingRequests: number;
  connectionsByHost: Map<string, number>;
  metrics: PoolMetrics;
}

/**
 * 连接健康状态接口
 */
export interface ConnectionHealth {
  connectionId: string;
  isHealthy: boolean;
  lastCheckTime: number;
  errorCount: number;
  latency?: number;
  errorMessage?: string;
}

/**
 * 主机配置接口
 */
export interface HostConfig {
  host: string;
  port: number;
  protocol: ConnectionProtocol;
  connections: number;
}

/**
 * 连接池事件类型定义
 */
export interface PoolEvents {
  'connection-created': { connectionId: string; host: string; port: number };
  'connection-acquired': { connectionId: string; requestId: string };
  'connection-released': { connectionId: string; requestId: string };
  'connection-closed': { connectionId: string; reason: string };
  'connection-error': { connectionId: string; error: string };
  'pool-full': { pendingRequests: number };
  'pool-drained': { timestamp: number };
  'pool-initialized': { config: ConnectionPoolConfig; timestamp: number };
  'pool-cleanup': { timestamp: number };
  'metrics-updated': { statistics: PoolStatistics };
  'health-check-completed': { healthyConnections: number; unhealthyConnections: number };
}

/**
 * 连接工厂配置接口
 */
export interface ConnectionFactoryConfig {
  connectionTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableKeepAlive: boolean;
  keepAliveTimeout: number;
  enableCompression: boolean;
}

/**
 * 连接池错误类
 */
export class ConnectionPoolError extends Error {
  public readonly operation: string;

  constructor(operation: string, message: string) {
    super(`Connection pool ${operation} failed: ${message}`);
    this.name = 'ConnectionPoolError';
    this.operation = operation;
  }
}

/**
 * 连接错误类
 */
export class ConnectionError extends Error {
  public readonly connectionId?: string;
  public readonly host?: string;
  public readonly port?: number;

  constructor(message: string, connectionId?: string, host?: string, port?: number) {
    super(message);
    this.name = 'ConnectionError';
    this.connectionId = connectionId;
    this.host = host;
    this.port = port;
  }
}

/**
 * 默认连接池配置
 */
export const DEFAULT_POOL_CONFIG: ConnectionPoolConfig = {
  maxConnections: 100,
  maxIdleConnections: 20,
  maxConnectionsPerHost: 10,
  connectionTimeout: 10000,
  idleTimeout: 60000,
  keepAliveTimeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  enableKeepAlive: true,
  enableCompression: true,
  monitoring: {
    enabled: true,
    metricsInterval: 30000,
  },
};

/**
 * 请求优先级权重映射
 */
export const PRIORITY_WEIGHTS: Record<RequestPriority, number> = {
  high: 3,
  normal: 2,
  low: 1,
};
