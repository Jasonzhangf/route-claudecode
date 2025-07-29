/**
 * Provider并发控制相关类型定义
 * Owner: Jason Zhang
 */

export interface ProviderOccupancyState {
  providerId: string;
  isOccupied: boolean;
  currentSessionId?: string;
  occupiedSince?: Date;
  lastActivity?: Date;
  activeConnections: number;
  maxConcurrency: number;
  waitingQueue: string[]; // 等待的sessionId队列
}

export interface ProviderLockRequest {
  sessionId: string;
  requestId: string;
  providerId: string;
  priority: 'normal' | 'high' | 'urgent';
  timeoutMs?: number;
}

export interface ProviderLockResult {
  success: boolean;
  providerId: string;
  sessionId: string;
  waitTime?: number;
  alternativeProvider?: string;
  reason?: 'occupied' | 'timeout' | 'unhealthy' | 'available' | 'overloaded' | 'immediate';
}

export interface ConcurrentLoadBalancingConfig {
  enabled: boolean;
  maxConcurrencyPerProvider: number;
  lockTimeoutMs: number;
  queueTimeoutMs: number;
  enableWaitingQueue: boolean;
  preferIdleProviders: boolean;
}

export interface ProviderConcurrencyMetrics {
  providerId: string;
  currentLoad: number;          // 当前并发数
  maxConcurrency: number;       // 最大并发数
  utilizationRate: number;      // 利用率 (0-1)
  averageResponseTime: number;  // 平均响应时间
  successRate: number;          // 成功率
  queueLength: number;          // 排队长度
  idleTime: number;            // 空闲时间 (ms)
}