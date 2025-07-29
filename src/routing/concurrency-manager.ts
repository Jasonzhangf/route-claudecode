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
   * 🚀 OPTIMIZED: 尝试获取provider锁 (优化版 - 减少严格锁定)
   */
  async acquireProviderLock(request: ProviderLockRequest): Promise<ProviderLockResult> {
    const { sessionId, providerId, requestId } = request;
    
    logger.debug(`Attempting to acquire lock for provider: ${providerId}`, {
      sessionId, requestId
    });

    // 确保provider已初始化
    this.initializeProvider(providerId);
    const state = this.providerStates.get(providerId)!;

    // 🎯 OPTIMIZATION 1: 不同provider之间不需要互斥，同一session可以并发访问不同provider
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

    // 🎯 OPTIMIZATION 2: 放宽并发限制 - 只在真正超负荷时才拒绝
    const utilizationRate = state.activeConnections / state.maxConcurrency;
    
    // 只有在使用率超过90%且当前连接数大于等于最大并发数时才考虑拒绝
    if (utilizationRate >= 0.9 && state.activeConnections >= state.maxConcurrency) {
      logger.debug(`Provider ${providerId} at high utilization`, {
        activeConnections: state.activeConnections,
        maxConcurrency: state.maxConcurrency,
        utilizationRate: `${(utilizationRate * 100).toFixed(1)}%`
      });
      
      // 即使满载，也允许短时间超载（最多+2个连接）
      if (state.activeConnections >= state.maxConcurrency + 2) {
        if (this.config.enableWaitingQueue) {
          return this.addToWaitingQueue(sessionId, providerId, request);
        } else {
          return {
            success: false,
            providerId,
            sessionId,
            reason: 'overloaded'
          };
        }
      }
    }

    // 🎯 OPTIMIZATION 3: 更宽松的锁获取策略
    return this.grantLock(sessionId, providerId, requestId);
  }

  /**
   * 🚀 OPTIMIZED: 批量尝试获取可用provider (快速并行版)
   */
  async acquireAvailableProvider(
    sessionId: string, 
    requestId: string,
    candidateProviders: string[],
    preferenceWeights?: Map<string, number>
  ): Promise<ProviderLockResult> {
    
    logger.debug(`🚀 Fast provider selection among ${candidateProviders.length} candidates`, {
      sessionId, requestId, candidates: candidateProviders
    });

    // 🎯 OPTIMIZATION 1: 并行检查所有provider的可用性，避免序列等待
    const availabilityChecks = candidateProviders.map(async (providerId) => {
      this.initializeProvider(providerId);
      const state = this.providerStates.get(providerId)!;
      const utilizationRate = state.activeConnections / state.maxConcurrency;
      
      return {
        providerId,
        utilizationRate,
        isAvailable: utilizationRate < 0.9 || state.activeConnections < state.maxConcurrency + 2,
        weight: preferenceWeights?.get(providerId) || 1
      };
    });
    
    const availabilityResults = await Promise.all(availabilityChecks);
    
    // 🎯 OPTIMIZATION 2: 智能排序 - 优先选择可用且权重高的provider
    const sortedProviders = availabilityResults
      .filter(result => result.isAvailable)
      .sort((a, b) => {
        // 首先按可用性排序，然后按权重和使用率排序
        if (a.utilizationRate !== b.utilizationRate) {
          return a.utilizationRate - b.utilizationRate; // 使用率低的优先
        }
        return b.weight - a.weight; // 权重高的优先
      })
      .map(result => result.providerId);
    
    if (sortedProviders.length === 0) {
      // 🎯 OPTIMIZATION 3: 如果没有"理想"的provider，选择使用率最低的
      const fallbackProvider = availabilityResults
        .sort((a, b) => a.utilizationRate - b.utilizationRate)[0];
      
      logger.info(`No ideal providers available, using fallback: ${fallbackProvider.providerId}`, {
        utilizationRate: `${(fallbackProvider.utilizationRate * 100).toFixed(1)}%`
      });
      
      sortedProviders.push(fallbackProvider.providerId);
    }

    // 🎯 OPTIMIZATION 4: 快速获取锁，不做过多检查
    for (const providerId of sortedProviders) {
      const result = await this.acquireProviderLock({
        sessionId,
        requestId, 
        providerId,
        priority: 'normal'
      });

      if (result.success) {
        logger.debug(`🎯 Successfully acquired provider: ${providerId}`, {
          sessionId, requestId, 
          utilizationRate: this.getProviderUtilization(providerId)
        });
        return result;
      }
    }

    // 兜底策略：选择第一个provider，允许超载
    const fallbackProvider = candidateProviders[0];
    logger.info(`🚨 All providers busy, forcing selection: ${fallbackProvider}`);
    
    return this.grantLock(sessionId, fallbackProvider, requestId);
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