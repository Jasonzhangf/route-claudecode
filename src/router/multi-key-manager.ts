/**
 * 多Key轮询管理器
 * 基于demo1路由逻辑，添加多API Key轮询支持
 */

import { secureLogger } from '../utils/secure-logger';

export interface Provider {
  name: string;
  api_base_url: string;
  api_key: string | string[];
  models: string[];
  transformer?: any;
}

export interface KeyUsageStats {
  keyIndex: number;
  usageCount: number;
  lastUsed: number;
  blacklisted: boolean;
  blacklistUntil?: number;
}

export class MultiKeyManager {
  private keyStats: Map<string, KeyUsageStats[]> = new Map();
  private currentKeyIndex: Map<string, number> = new Map();

  constructor(private config: any) {
    this.initializeKeyStats();
  }

  /**
   * 初始化Key统计信息
   */
  private initializeKeyStats(): void {
    if (!this.config.Providers) return;

    for (const provider of this.config.Providers) {
      const keys = Array.isArray(provider.api_key) ? provider.api_key : [provider.api_key];
      const stats: KeyUsageStats[] = keys.map((_, index) => ({
        keyIndex: index,
        usageCount: 0,
        lastUsed: 0,
        blacklisted: false,
      }));

      this.keyStats.set(provider.name, stats);
      this.currentKeyIndex.set(provider.name, 0);
    }

    secureLogger.info('Multi-key manager initialized', {
      providers: this.config.Providers.length,
      totalKeys: Array.from(this.keyStats.values()).reduce((sum, stats) => sum + stats.length, 0),
    });
  }

  /**
   * 获取下一个可用的API Key（参考demo1的简单轮询）
   */
  getNextApiKey(providerName: string): string | null {
    const provider = this.findProvider(providerName);
    if (!provider) {
      secureLogger.error('Provider not found', { providerName });
      return null;
    }

    const keys = Array.isArray(provider.api_key) ? provider.api_key : [provider.api_key];
    if (keys.length === 1) {
      // 单key直接返回
      return keys[0];
    }

    // 多key轮询逻辑
    const stats = this.keyStats.get(providerName) || [];
    const availableKeys = stats.filter(stat => !this.isKeyBlacklisted(stat));

    if (availableKeys.length === 0) {
      secureLogger.warn('All keys blacklisted for provider', { providerName });
      return null;
    }

    // Round-robin轮询策略
    const currentIndex = this.currentKeyIndex.get(providerName) || 0;
    const nextIndex = this.findNextAvailableKey(providerName, currentIndex);

    if (nextIndex === -1) {
      return null;
    }

    // 更新使用统计
    this.updateKeyUsage(providerName, nextIndex);
    this.currentKeyIndex.set(providerName, (nextIndex + 1) % keys.length);

    secureLogger.debug('Selected API key', {
      providerName,
      keyIndex: nextIndex,
      totalKeys: keys.length,
    });

    return keys[nextIndex];
  }

  /**
   * 查找下一个可用的Key索引
   */
  private findNextAvailableKey(providerName: string, startIndex: number): number {
    const stats = this.keyStats.get(providerName) || [];
    const totalKeys = stats.length;

    for (let i = 0; i < totalKeys; i++) {
      const index = (startIndex + i) % totalKeys;
      const stat = stats[index];

      if (!this.isKeyBlacklisted(stat)) {
        return index;
      }
    }

    return -1;
  }

  /**
   * 检查Key是否被拉黑
   */
  private isKeyBlacklisted(stat: KeyUsageStats): boolean {
    if (!stat.blacklisted) return false;

    if (stat.blacklistUntil && Date.now() > stat.blacklistUntil) {
      // 拉黑时间到期，自动恢复
      stat.blacklisted = false;
      stat.blacklistUntil = undefined;
      secureLogger.info('API key restored from blacklist', { keyIndex: stat.keyIndex });
      return false;
    }

    return true;
  }

  /**
   * 更新Key使用统计
   */
  private updateKeyUsage(providerName: string, keyIndex: number): void {
    const stats = this.keyStats.get(providerName);
    if (!stats || keyIndex >= stats.length) return;

    stats[keyIndex].usageCount++;
    stats[keyIndex].lastUsed = Date.now();
  }

  /**
   * 标记Key为失败（拉黑处理）
   */
  markKeyFailed(providerName: string, apiKey: string, error: any): void {
    const provider = this.findProvider(providerName);
    if (!provider) return;

    const keys = Array.isArray(provider.api_key) ? provider.api_key : [provider.api_key];
    const keyIndex = keys.indexOf(apiKey);

    if (keyIndex === -1) return;

    const stats = this.keyStats.get(providerName);
    if (!stats || keyIndex >= stats.length) return;

    const blacklistDuration = this.config.MultiKeyConfig?.keyFailureHandling?.blacklistDuration || 300000;

    stats[keyIndex].blacklisted = true;
    stats[keyIndex].blacklistUntil = Date.now() + blacklistDuration;

    secureLogger.warn('API key blacklisted due to failure', {
      providerName,
      keyIndex,
      error: error.message || error,
      blacklistUntil: new Date(stats[keyIndex].blacklistUntil!).toISOString(),
    });
  }

  /**
   * 根据demo1的路由规则查找Provider
   */
  private findProvider(providerName: string): Provider | null {
    if (!this.config.Providers) return null;

    return this.config.Providers.find((p: Provider) => p.name === providerName) || null;
  }

  /**
   * 获取Provider使用统计
   */
  getProviderStats(providerName: string): KeyUsageStats[] | null {
    return this.keyStats.get(providerName) || null;
  }

  /**
   * 重置所有Key统计（周期性重置）
   */
  resetStats(): void {
    this.keyStats.forEach((stats, providerName) => {
      stats.forEach(stat => {
        stat.usageCount = 0;
        stat.lastUsed = 0;
        // 保持拉黑状态不变
      });
    });

    secureLogger.info('Key usage stats reset');
  }
}
