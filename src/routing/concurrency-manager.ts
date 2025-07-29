/**
 * Provider并发控制管理器
 * 解决单服务器多客户端访问时的资源竞争问题
 * Owner: Jason Zhang
 */

import { logger } from '@/utils/logger';
import { 
  ProviderOccupancyState, 
  ProviderLockRequest, 
  ProviderLockResult,
  ConcurrentLoadBalancingConfig,
  ProviderConcurrencyMetrics
} from '@/types/concurrency';

export class ConcurrencyManager {
  private providerStates: Map<string, ProviderOccupancyState> = new Map();
  private sessionLocks: Map<string, string> = new Map(); // sessionId -> providerId
  private lockTimers: Map<string, NodeJS.Timeout> = new Map();
  private config: ConcurrentLoadBalancingConfig;

  constructor(config: ConcurrentLoadBalancingConfig) {
    this.config = config;
    logger.info('ConcurrencyManager initialized', {
      maxConcurrencyPerProvider: config.maxConcurrencyPerProvider,
      lockTimeoutMs: config.lockTimeoutMs,
      enableWaitingQueue: config.enableWaitingQueue
    });
  }

  /**
   * 初始化provider状态
   */
  initializeProvider(providerId: string, maxConcurrency?: number): void {
    if (!this.providerStates.has(providerId)) {
      const state: ProviderOccupancyState = {
        providerId,
        isOccupied: false,
        activeConnections: 0,
        maxConcurrency: maxConcurrency || this.config.maxConcurrencyPerProvider,
        waitingQueue: [],
        lastActivity: new Date()
      };
      
      this.providerStates.set(providerId, state);
      logger.debug(`Initialized provider concurrency state: ${providerId}`, {
        maxConcurrency: state.maxConcurrency
      });
    }
  }

  /**
   * 尝试获取provider锁 (核心方法)
   */
  async acquireProviderLock(request: ProviderLockRequest): Promise<ProviderLockResult> {
    const { sessionId, providerId, requestId } = request;
    
    logger.debug(`Attempting to acquire lock for provider: ${providerId}`, {
      sessionId, requestId
    });

    // 确保provider已初始化
    this.initializeProvider(providerId);
    const state = this.providerStates.get(providerId)!;

    // 检查是否已经被当前session占用
    const currentLock = this.sessionLocks.get(sessionId);
    if (currentLock === providerId) {
      logger.debug(`Session ${sessionId} already holds lock for ${providerId}`);
      return {
        success: true,
        providerId,
        sessionId,
        reason: 'available'
      };
    }

    // 检查是否有可用容量
    if (state.activeConnections < state.maxConcurrency) {
      // 获取锁成功
      return this.grantLock(sessionId, providerId, requestId);
    }

    // Provider满载，根据配置决定策略
    if (this.config.enableWaitingQueue) {
      return this.addToWaitingQueue(sessionId, providerId, request);
    } else {
      return {
        success: false,
        providerId,
        sessionId,
        reason: 'occupied'
      };
    }
  }

  /**
   * 批量尝试获取可用provider (负载均衡优化版)
   */
  async acquireAvailableProvider(
    sessionId: string, 
    requestId: string,
    candidateProviders: string[],
    preferenceWeights?: Map<string, number>
  ): Promise<ProviderLockResult> {
    
    logger.info(`Searching for available provider among ${candidateProviders.length} candidates`, {
      sessionId, requestId, candidates: candidateProviders
    });

    // 按空闲程度排序provider
    const sortedProviders = this.sortProvidersByAvailability(candidateProviders, preferenceWeights);
    
    for (const providerId of sortedProviders) {
      const result = await this.acquireProviderLock({
        sessionId,
        requestId, 
        providerId,
        priority: 'normal'
      });

      if (result.success) {
        logger.info(`Successfully acquired lock for provider: ${providerId}`, {
          sessionId, requestId, 
          utilizationRate: this.getProviderUtilization(providerId)
        });
        return result;
      }

      logger.debug(`Provider ${providerId} unavailable: ${result.reason}`);
    }

    // 所有provider都不可用
    logger.warn(`No available providers found among candidates`, {
      sessionId, requestId, candidates: candidateProviders,
      occupancyStates: this.getOccupancySnapshot()
    });

    return {
      success: false,
      providerId: candidateProviders[0], // 返回第一个作为默认
      sessionId,
      reason: 'occupied'
    };
  }

  /**
   * 释放provider锁
   */
  releaseProviderLock(sessionId: string, requestId?: string): boolean {
    const providerId = this.sessionLocks.get(sessionId);
    if (!providerId) {
      logger.debug(`No lock found for session: ${sessionId}`);
      return false;
    }

    const state = this.providerStates.get(providerId);
    if (!state) {
      logger.warn(`Provider state not found: ${providerId}`);
      return false;
    }

    // 释放锁
    state.activeConnections = Math.max(0, state.activeConnections - 1);
    state.isOccupied = state.activeConnections > 0;
    state.lastActivity = new Date();
    
    this.sessionLocks.delete(sessionId);
    
    // 清理超时定时器
    const timer = this.lockTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.lockTimers.delete(sessionId);
    }

    logger.info(`Released lock for provider: ${providerId}`, {
      sessionId, requestId,
      remainingConnections: state.activeConnections,
      queueLength: state.waitingQueue.length
    });

    // 处理等待队列
    this.processWaitingQueue(providerId);

    return true;
  }

  /**
   * 获取provider并发指标
   */
  getProviderMetrics(providerId: string): ProviderConcurrencyMetrics | null {
    const state = this.providerStates.get(providerId);
    if (!state) return null;

    const utilizationRate = state.activeConnections / state.maxConcurrency;
    const idleTime = state.lastActivity ? Date.now() - state.lastActivity.getTime() : 0;

    return {
      providerId,
      currentLoad: state.activeConnections,
      maxConcurrency: state.maxConcurrency,
      utilizationRate,
      averageResponseTime: 0, // TODO: 实现响应时间统计
      successRate: 1.0, // TODO: 从健康状态获取
      queueLength: state.waitingQueue.length,
      idleTime
    };
  }

  /**
   * 获取所有provider占用状态快照
   */
  getOccupancySnapshot(): Record<string, any> {
    const snapshot: Record<string, any> = {};
    
    for (const [providerId, state] of this.providerStates) {
      snapshot[providerId] = {
        activeConnections: state.activeConnections,
        maxConcurrency: state.maxConcurrency,
        utilizationRate: (state.activeConnections / state.maxConcurrency * 100).toFixed(1) + '%',
        queueLength: state.waitingQueue.length,
        isAvailable: state.activeConnections < state.maxConcurrency
      };
    }
    
    return snapshot;
  }

  // ==================== 私有方法 ====================

  /**
   * 授予锁
   */
  private grantLock(sessionId: string, providerId: string, requestId: string): ProviderLockResult {
    const state = this.providerStates.get(providerId)!;
    
    // 更新状态
    state.activeConnections++;
    state.isOccupied = true;
    state.currentSessionId = sessionId;
    state.occupiedSince = new Date();
    state.lastActivity = new Date();
    
    // 记录session锁
    this.sessionLocks.set(sessionId, providerId);
    
    // 设置超时释放
    this.setLockTimeout(sessionId);
    
    logger.info(`Granted lock for provider: ${providerId}`, {
      sessionId, requestId,
      activeConnections: state.activeConnections,
      utilizationRate: `${(state.activeConnections / state.maxConcurrency * 100).toFixed(1)}%`
    });

    return {
      success: true,
      providerId,
      sessionId,
      reason: 'available'
    };
  }

  /**
   * 添加到等待队列
   */
  private addToWaitingQueue(sessionId: string, providerId: string, request: ProviderLockRequest): ProviderLockResult {
    const state = this.providerStates.get(providerId)!;
    
    if (!state.waitingQueue.includes(sessionId)) {
      state.waitingQueue.push(sessionId);
      
      logger.info(`Added session to waiting queue: ${providerId}`, {
        sessionId: request.sessionId,
        queuePosition: state.waitingQueue.length,
        estimatedWaitTime: state.waitingQueue.length * 30000 // 估算30秒/请求
      });
    }

    return {
      success: false,
      providerId,
      sessionId,
      waitTime: state.waitingQueue.length * 30000,
      reason: 'occupied'
    };
  }

  /**
   * 按可用性排序providers
   */
  private sortProvidersByAvailability(
    providerIds: string[], 
    weights?: Map<string, number>
  ): string[] {
    return [...providerIds].sort((a, b) => {
      const stateA = this.providerStates.get(a);
      const stateB = this.providerStates.get(b);
      
      if (!stateA || !stateB) return 0;
      
      // 优先选择完全空闲的provider
      const availabilityA = stateA.maxConcurrency - stateA.activeConnections;
      const availabilityB = stateB.maxConcurrency - stateB.activeConnections;
      
      if (availabilityA !== availabilityB) {
        return availabilityB - availabilityA; // 空闲容量大的优先
      }
      
      // 如果空闲容量相同，考虑权重
      if (weights) {
        const weightA = weights.get(a) || 1;
        const weightB = weights.get(b) || 1;
        return weightB - weightA; // 权重大的优先
      }
      
      return 0;
    });
  }

  /**
   * 处理等待队列
   */
  private processWaitingQueue(providerId: string): void {
    const state = this.providerStates.get(providerId);
    if (!state || state.waitingQueue.length === 0) return;
    
    // 如果有容量，处理队列中的第一个请求
    if (state.activeConnections < state.maxConcurrency) {
      const waitingSessionId = state.waitingQueue.shift();
      if (waitingSessionId) {
        logger.info(`Processing waiting queue for provider: ${providerId}`, {
          sessionId: waitingSessionId,
          remainingQueue: state.waitingQueue.length
        });
        
        // 异步授予锁 (这里可以通过事件机制通知等待的客户端)
        // TODO: 实现基于Promise的等待机制
      }
    }
  }

  /**
   * 设置锁超时
   */
  private setLockTimeout(sessionId: string): void {
    const timer = setTimeout(() => {
      logger.warn(`Lock timeout for session: ${sessionId}`);
      this.releaseProviderLock(sessionId, 'timeout');
    }, this.config.lockTimeoutMs);
    
    this.lockTimers.set(sessionId, timer);
  }

  /**
   * 获取provider利用率
   */
  private getProviderUtilization(providerId: string): number {
    const state = this.providerStates.get(providerId);
    if (!state) return 0;
    
    return state.activeConnections / state.maxConcurrency;
  }
}