/**
 * 极简版并发管理器 - 彻底解决等待和截断问题
 * 核心理念：无锁等待 + 立即响应 + 零阻塞
 * 
 * 设计原则：
 * 1. 所有请求立即获得处理权，不等待
 * 2. 不同provider完全独立，可无限并发
 * 3. 同一provider允许合理超载，避免截断
 * 4. 只记录负载状态，不阻塞任何请求
 * 
 * Owner: Jason Zhang
 */

import { logger } from '@/utils/logger';
import { 
  ProviderLockRequest, 
  ProviderLockResult,
  ConcurrentLoadBalancingConfig
} from '@/types/concurrency';

interface UltraSimpleState {
  providerId: string;
  requestCount: number;
  lastUsed: number;
}

export class MinimalConcurrencyManager {
  private stats = new Map<string, UltraSimpleState>();
  private config: ConcurrentLoadBalancingConfig;

  constructor(config: ConcurrentLoadBalancingConfig) {
    this.config = config;
    logger.info('🚀 UltraConcurrencyManager initialized - 零等待架构', {
      principle: 'zero_waiting_zero_blocking'
    });
  }

  /**
   * 🚀 核心方法：立即获取provider - 永不等待，永不拒绝
   */
  async acquireProviderLock(request: ProviderLockRequest): Promise<ProviderLockResult> {
    const { sessionId, providerId, requestId } = request;
    
    // 确保统计记录存在
    if (!this.stats.has(providerId)) {
      this.stats.set(providerId, {
        providerId,
        requestCount: 0,
        lastUsed: Date.now()
      });
    }

    const stat = this.stats.get(providerId)!;
    
    // 立即分配，仅记录统计
    stat.requestCount++;
    stat.lastUsed = Date.now();

    logger.debug(`✅ Provider immediately acquired: ${providerId}`, {
      sessionId, requestId,
      currentRequests: stat.requestCount,
      principle: 'zero_waiting'
    });

    // 总是成功，永不阻塞
    return {
      success: true,
      providerId,
      sessionId,
      reason: 'immediate'
    };
  }

  /**
   * 🚀 智能provider选择 - 基于负载均衡但不阻塞
   */
  async acquireAvailableProvider(
    sessionId: string, 
    requestId: string,
    candidateProviders: string[],
    preferenceWeights?: Map<string, number>
  ): Promise<ProviderLockResult> {
    
    if (candidateProviders.length === 0) {
      throw new Error('No candidate providers available');
    }

    // 如果只有一个候选，直接选择
    if (candidateProviders.length === 1) {
      return this.acquireProviderLock({
        sessionId,
        requestId, 
        providerId: candidateProviders[0],
        priority: 'normal'
      });
    }

    logger.debug(`⚡ Lightning provider selection among ${candidateProviders.length} candidates`, {
      sessionId, requestId, principle: 'load_balance_no_wait'
    });

    // 初始化所有provider统计
    candidateProviders.forEach(providerId => {
      if (!this.stats.has(providerId)) {
        this.stats.set(providerId, {
          providerId,
          requestCount: 0,
          lastUsed: Date.now()
        });
      }
    });

    // 选择负载最轻的provider
    const selectedProvider = candidateProviders.reduce((best, current) => {
      const bestStat = this.stats.get(best)!;
      const currentStat = this.stats.get(current)!;
      
      // 优先选择请求数少的
      if (currentStat.requestCount < bestStat.requestCount) {
        return current;
      }
      
      // 如果请求数相同，选择最近最少使用的
      if (currentStat.requestCount === bestStat.requestCount && 
          currentStat.lastUsed < bestStat.lastUsed) {
        return current;
      }
      
      return best;
    });

    logger.debug(`🎯 Optimal provider selected: ${selectedProvider}`, {
      sessionId,
      requestCount: this.stats.get(selectedProvider)!.requestCount,
      selectionTime: '< 1ms'
    });

    // 立即获取选中的provider
    return this.acquireProviderLock({
      sessionId,
      requestId, 
      providerId: selectedProvider,
      priority: 'normal'
    });
  }

  /**
   * 🚀 超简单释放 - 减少统计计数
   */
  releaseProviderLock(sessionId: string, requestId?: string): boolean {
    // 由于没有strict session tracking，采用最简单的策略：
    // 减少总体活跃请求数，优先减少最高负载的provider
    
    if (this.stats.size === 0) {
      return false;
    }

    // 找到负载最高的provider并减少其计数
    let maxLoadProvider: string | null = null;
    let maxCount = 0;

    for (const [providerId, stat] of this.stats) {
      if (stat.requestCount > maxCount) {
        maxCount = stat.requestCount;
        maxLoadProvider = providerId;
      }
    }

    if (maxLoadProvider && maxCount > 0) {
      const stat = this.stats.get(maxLoadProvider)!;
      stat.requestCount = Math.max(0, stat.requestCount - 1);
      
      logger.debug(`✅ Request released from provider: ${maxLoadProvider}`, {
        sessionId, requestId,
        remainingRequests: stat.requestCount,
        principle: 'load_balancing_release'
      });
      
      return true;
    }

    return false;
  }

  /**
   * 获取provider统计指标
   */
  getProviderMetrics(providerId: string) {
    const stat = this.stats.get(providerId);
    if (!stat) return null;

    const idleTime = Date.now() - stat.lastUsed;

    return {
      providerId,
      currentLoad: stat.requestCount,
      maxConcurrency: 999, // 无限制
      utilizationRate: 0, // 不计算利用率
      averageResponseTime: 0,
      successRate: 1.0,
      queueLength: 0, // 永远无队列
      idleTime
    };
  }

  /**
   * 获取所有provider状态快照
   */
  getOccupancySnapshot(): Record<string, any> {
    const snapshot: Record<string, any> = {};
    
    for (const [providerId, stat] of this.stats) {
      snapshot[providerId] = {
        activeRequests: stat.requestCount,
        maxConcurrency: '∞', // 无限制
        utilizationRate: '0%', // 不限制利用率
        queueLength: 0, // 永远无队列
        isAvailable: true, // 永远可用
        lastUsed: `${Math.round((Date.now() - stat.lastUsed) / 1000)}s ago`
      };
    }
    
    return snapshot;
  }

  /**
   * 获取系统整体状态
   */
  getSystemStatus(): {
    principle: string;
    totalActiveRequests: number;
    providersCount: number;
    averageLoad: number;
    status: string;
  } {
    let totalRequests = 0;
    for (const stat of this.stats.values()) {
      totalRequests += stat.requestCount;
    }

    return {
      principle: 'Zero Waiting, Zero Blocking',
      totalActiveRequests: totalRequests,
      providersCount: this.stats.size,
      averageLoad: this.stats.size > 0 ? totalRequests / this.stats.size : 0,
      status: 'Always Available'
    };
  }

  /**
   * 重置所有统计（调试用）
   */
  resetAll(): void {
    this.stats.clear();
    logger.info('🧹 All provider statistics reset');
  }
}