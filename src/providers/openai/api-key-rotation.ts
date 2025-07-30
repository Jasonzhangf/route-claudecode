/**
 * OpenAI API Key Rotation Manager
 * 管理多个API keys的轮询使用，避免rate limit问题
 */

import { logger } from '@/utils/logger';

export interface ApiKeyState {
  key: string;
  index: number;
  isActive: boolean;
  lastUsed: Date;
  consecutiveErrors: number;
  rateLimitUntil?: Date;
  totalRequests: number;
  successfulRequests: number;
}

export interface RotationConfig {
  strategy: 'round_robin' | 'health_based' | 'rate_limit_aware';
  cooldownMs: number;
  maxRetriesPerKey: number;
  rateLimitCooldownMs: number;
}

export class ApiKeyRotationManager {
  private keys: ApiKeyState[] = [];
  private currentIndex = 0;
  private config: RotationConfig;
  private providerId: string;

  constructor(
    apiKeys: string | string[],
    providerId: string,
    config: Partial<RotationConfig> = {}
  ) {
    this.providerId = providerId;
    this.config = {
      strategy: config.strategy || 'rate_limit_aware',
      cooldownMs: config.cooldownMs || 5000,
      maxRetriesPerKey: config.maxRetriesPerKey || 3,
      rateLimitCooldownMs: config.rateLimitCooldownMs || 60000, // 1分钟rate limit冷却
      ...config
    };

    // 初始化API keys
    const keyArray = Array.isArray(apiKeys) ? apiKeys : [apiKeys];
    this.keys = keyArray.map((key, index) => ({
      key: key.trim(),
      index,
      isActive: true,
      lastUsed: new Date(0), // 初始化为很久以前
      consecutiveErrors: 0,
      totalRequests: 0,
      successfulRequests: 0
    }));

    logger.info('API key rotation manager initialized', {
      providerId: this.providerId,
      keyCount: this.keys.length,
      strategy: this.config.strategy,
      cooldownMs: this.config.cooldownMs
    });
  }

  /**
   * 获取下一个可用的API key
   */
  getNextApiKey(requestId?: string): string {
    const availableKey = this.selectBestKey();
    
    if (!availableKey) {
      // 如果没有可用的key，尝试重置所有key的错误状态
      this.resetErrorStates();
      const fallbackKey = this.selectBestKey();
      
      if (!fallbackKey) {
        throw new Error('No API keys available for provider ' + this.providerId);
      }
      
      logger.warn('All API keys were unavailable, reset error states', {
        providerId: this.providerId,
        requestId
      });
      
      return this.useKey(fallbackKey, requestId);
    }

    return this.useKey(availableKey, requestId);
  }

  /**
   * 报告API key使用成功
   */
  reportSuccess(apiKey: string, requestId?: string): void {
    const keyState = this.keys.find(k => k.key === apiKey);
    if (keyState) {
      keyState.consecutiveErrors = 0;
      keyState.successfulRequests++;
      keyState.isActive = true;
      
      // 清除rate limit状态
      if (keyState.rateLimitUntil) {
        delete keyState.rateLimitUntil;
        logger.info('API key rate limit cleared due to successful request', {
          providerId: this.providerId,
          keyIndex: keyState.index,
          requestId
        });
      }

      logger.debug('API key success reported', {
        providerId: this.providerId,
        keyIndex: keyState.index,
        successRate: keyState.successfulRequests / keyState.totalRequests,
        requestId
      });
    }
  }

  /**
   * 报告API key使用失败
   */
  reportError(apiKey: string, isRateLimit: boolean = false, requestId?: string): void {
    const keyState = this.keys.find(k => k.key === apiKey);
    if (keyState) {
      keyState.consecutiveErrors++;
      
      if (isRateLimit) {
        keyState.rateLimitUntil = new Date(Date.now() + this.config.rateLimitCooldownMs);
        logger.warn('API key marked with rate limit', {
          providerId: this.providerId,
          keyIndex: keyState.index,
          rateLimitUntil: keyState.rateLimitUntil.toISOString(),
          requestId
        });
      }

      // 如果连续错误次数超过阈值，暂时禁用这个key
      if (keyState.consecutiveErrors >= this.config.maxRetriesPerKey) {
        keyState.isActive = false;
        logger.warn('API key temporarily disabled due to consecutive errors', {
          providerId: this.providerId,
          keyIndex: keyState.index,
          consecutiveErrors: keyState.consecutiveErrors,
          requestId
        });
      }

      logger.debug('API key error reported', {
        providerId: this.providerId,
        keyIndex: keyState.index,
        consecutiveErrors: keyState.consecutiveErrors,
        isRateLimit,
        requestId
      });
    }
  }

  /**
   * 获取当前状态统计
   */
  getStats(): any {
    const activeKeys = this.keys.filter(k => k.isActive && !this.isRateLimited(k));
    const rateLimitedKeys = this.keys.filter(k => this.isRateLimited(k));
    const disabledKeys = this.keys.filter(k => !k.isActive);

    return {
      providerId: this.providerId,
      totalKeys: this.keys.length,
      activeKeys: activeKeys.length,
      rateLimitedKeys: rateLimitedKeys.length,
      disabledKeys: disabledKeys.length,
      strategy: this.config.strategy,
      keyDetails: this.keys.map(k => ({
        index: k.index,
        isActive: k.isActive,
        isRateLimited: this.isRateLimited(k),
        consecutiveErrors: k.consecutiveErrors,
        successRate: k.totalRequests > 0 ? k.successfulRequests / k.totalRequests : 0,
        lastUsed: k.lastUsed.toISOString(),
        rateLimitUntil: k.rateLimitUntil?.toISOString()
      }))
    };
  }

  /**
   * 选择最佳的API key
   */
  private selectBestKey(): ApiKeyState | null {
    const now = new Date();

    // 过滤可用的keys
    const availableKeys = this.keys.filter(k => 
      k.isActive && 
      !this.isRateLimited(k) &&
      (now.getTime() - k.lastUsed.getTime()) >= this.config.cooldownMs
    );

    if (availableKeys.length === 0) {
      return null;
    }

    switch (this.config.strategy) {
      case 'round_robin':
        return this.selectRoundRobin(availableKeys);
      
      case 'health_based':
        return this.selectHealthBased(availableKeys);
      
      case 'rate_limit_aware':
        return this.selectRateLimitAware(availableKeys);
      
      default:
        return availableKeys[0];
    }
  }

  /**
   * 轮询策略选择
   */
  private selectRoundRobin(availableKeys: ApiKeyState[]): ApiKeyState {
    // 找到下一个应该使用的key
    let nextKey = availableKeys[this.currentIndex % availableKeys.length];
    this.currentIndex = (this.currentIndex + 1) % availableKeys.length;
    return nextKey;
  }

  /**
   * 基于健康状态的选择
   */
  private selectHealthBased(availableKeys: ApiKeyState[]): ApiKeyState {
    // 按成功率和错误数排序
    return availableKeys.sort((a, b) => {
      const aSuccessRate = a.totalRequests > 0 ? a.successfulRequests / a.totalRequests : 1;
      const bSuccessRate = b.totalRequests > 0 ? b.successfulRequests / b.totalRequests : 1;
      
      if (aSuccessRate !== bSuccessRate) {
        return bSuccessRate - aSuccessRate; // 成功率高的优先
      }
      
      return a.consecutiveErrors - b.consecutiveErrors; // 错误少的优先
    })[0];
  }

  /**
   * 基于rate limit感知的选择
   */
  private selectRateLimitAware(availableKeys: ApiKeyState[]): ApiKeyState {
    const now = new Date();
    
    // 优先选择最久没使用的key
    return availableKeys.sort((a, b) => {
      // 首先考虑连续错误数（错误少的优先）
      if (a.consecutiveErrors !== b.consecutiveErrors) {
        return a.consecutiveErrors - b.consecutiveErrors;
      }
      
      // 然后考虑最后使用时间（最久的优先）
      return a.lastUsed.getTime() - b.lastUsed.getTime();
    })[0];
  }

  /**
   * 使用指定的key
   */
  private useKey(keyState: ApiKeyState, requestId?: string): string {
    keyState.lastUsed = new Date();
    keyState.totalRequests++;

    logger.debug('API key selected for use', {
      providerId: this.providerId,
      keyIndex: keyState.index,
      strategy: this.config.strategy,
      consecutiveErrors: keyState.consecutiveErrors,
      totalRequests: keyState.totalRequests,
      requestId
    });

    return keyState.key;
  }

  /**
   * 检查key是否处于rate limit状态
   */
  private isRateLimited(keyState: ApiKeyState): boolean {
    if (!keyState.rateLimitUntil) {
      return false;
    }
    
    const now = new Date();
    if (now >= keyState.rateLimitUntil) {
      // Rate limit已过期，清除状态
      delete keyState.rateLimitUntil;
      return false;
    }
    
    return true;
  }

  /**
   * 重置所有key的错误状态
   */
  private resetErrorStates(): void {
    this.keys.forEach(key => {
      key.consecutiveErrors = 0;
      key.isActive = true;
    });

    logger.info('All API key error states reset', {
      providerId: this.providerId,
      keyCount: this.keys.length
    });
  }

  /**
   * 强制重置所有rate limit状态（用于紧急情况）
   */
  resetAllRateLimits(): void {
    this.keys.forEach(key => {
      if (key.rateLimitUntil) {
        delete key.rateLimitUntil;
      }
    });

    logger.warn('All rate limits forcefully reset', {
      providerId: this.providerId,
      keyCount: this.keys.length
    });
  }
}