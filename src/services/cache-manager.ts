/**
 * 缓存管理器
 *
 * 负责管理各种类型的缓存数据
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { ICacheManager } from './global-service-registry';

/**
 * 缓存项
 */
interface CacheItem {
  key: string;
  value: any;
  createdAt: Date;
  expiresAt: Date | null;
  accessCount: number;
  lastAccessed: Date;
  size: number;
}

/**
 * 缓存统计
 */
interface CacheStats {
  totalItems: number;
  memoryUsage: number;
  hitRate: number;
  missRate: number;
  accessCount: number;
  cacheTypes: string[];
}

/**
 * 缓存类型配置
 */
interface CacheTypeConfig {
  maxSize: number;
  ttl: number; // Time to live in milliseconds
  maxItems: number;
  evictionPolicy: 'lru' | 'fifo' | 'ttl';
}

/**
 * 缓存管理器实现
 */
export class CacheManager extends EventEmitter implements ICacheManager {
  private caches: Map<string, Map<string, CacheItem>>;
  private configs: Map<string, CacheTypeConfig>;
  private stats: Map<string, { hits: number; misses: number; accesses: number }>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    super();
    this.caches = new Map();
    this.configs = new Map();
    this.stats = new Map();
    this.initializeDefaultCaches();
    this.startCleanupTimer();
  }

  /**
   * 初始化默认缓存类型
   */
  private initializeDefaultCaches(): void {
    const defaultCacheTypes = [
      {
        name: 'config',
        config: { maxSize: 10 * 1024 * 1024, ttl: 300000, maxItems: 100, evictionPolicy: 'ttl' as const },
      },
      {
        name: 'provider',
        config: { maxSize: 50 * 1024 * 1024, ttl: 60000, maxItems: 500, evictionPolicy: 'lru' as const },
      },
      {
        name: 'pipeline',
        config: { maxSize: 100 * 1024 * 1024, ttl: 120000, maxItems: 1000, evictionPolicy: 'lru' as const },
      },
      {
        name: 'response',
        config: { maxSize: 200 * 1024 * 1024, ttl: 30000, maxItems: 2000, evictionPolicy: 'fifo' as const },
      },
    ];

    for (const { name, config } of defaultCacheTypes) {
      this.caches.set(name, new Map());
      this.configs.set(name, config);
      this.stats.set(name, { hits: 0, misses: 0, accesses: 0 });
    }
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, 60000); // 每分钟清理一次
  }

  /**
   * 执行缓存清理
   */
  private performCleanup(): void {
    const now = new Date();
    let totalCleaned = 0;

    for (const [cacheType, cache] of this.caches) {
      const config = this.configs.get(cacheType)!;
      let cleaned = 0;

      // 清理过期项
      for (const [key, item] of cache) {
        if (item.expiresAt && item.expiresAt <= now) {
          cache.delete(key);
          cleaned++;
        }
      }

      // 根据驱逐策略清理多余项
      if (cache.size > config.maxItems) {
        cleaned += this.evictItems(cacheType, cache.size - config.maxItems);
      }

      totalCleaned += cleaned;
    }

    if (totalCleaned > 0) {
      this.emit('cleanupCompleted', { itemsCleaned: totalCleaned, timestamp: now });
    }
  }

  /**
   * 驱逐缓存项
   */
  private evictItems(cacheType: string, count: number): number {
    const cache = this.caches.get(cacheType)!;
    const config = this.configs.get(cacheType)!;
    let evicted = 0;

    if (count <= 0) return 0;

    const items = Array.from(cache.entries()).map(([key, item]) => ({ key, item }));

    // 根据驱逐策略排序
    switch (config.evictionPolicy) {
      case 'lru':
        items.sort((a, b) => a.item.lastAccessed.getTime() - b.item.lastAccessed.getTime());
        break;
      case 'fifo':
        items.sort((a, b) => a.item.createdAt.getTime() - b.item.createdAt.getTime());
        break;
      case 'ttl':
        items.sort((a, b) => {
          const aExpires = a.item.expiresAt?.getTime() || Infinity;
          const bExpires = b.item.expiresAt?.getTime() || Infinity;
          return aExpires - bExpires;
        });
        break;
    }

    // 删除指定数量的项
    for (let i = 0; i < Math.min(count, items.length); i++) {
      cache.delete(items[i].key);
      evicted++;
    }

    return evicted;
  }

  /**
   * 计算数据大小（简化实现）
   */
  private calculateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // 粗略估计字符串占用的字节数
    } catch {
      return 1024; // 如果无法序列化，返回默认大小
    }
  }

  /**
   * 设置缓存项
   */
  set(cacheType: string, key: string, value: any, ttl?: number): boolean {
    if (!this.caches.has(cacheType)) {
      return false;
    }

    const cache = this.caches.get(cacheType)!;
    const config = this.configs.get(cacheType)!;
    const now = new Date();
    const size = this.calculateSize(value);

    // 检查大小限制
    if (size > config.maxSize) {
      return false;
    }

    const expiresAt = ttl ? new Date(now.getTime() + ttl) : new Date(now.getTime() + config.ttl);

    const item: CacheItem = {
      key,
      value,
      createdAt: now,
      expiresAt,
      accessCount: 0,
      lastAccessed: now,
      size,
    };

    cache.set(key, item);
    this.emit('itemSet', { cacheType, key, size });

    return true;
  }

  /**
   * 获取缓存项
   */
  get(cacheType: string, key: string): any | null {
    if (!this.caches.has(cacheType)) {
      return null;
    }

    const cache = this.caches.get(cacheType)!;
    const stats = this.stats.get(cacheType)!;
    const item = cache.get(key);

    stats.accesses++;

    if (!item) {
      stats.misses++;
      return null;
    }

    // 检查是否过期
    if (item.expiresAt && item.expiresAt <= new Date()) {
      cache.delete(key);
      stats.misses++;
      return null;
    }

    // 更新访问信息
    item.accessCount++;
    item.lastAccessed = new Date();
    stats.hits++;

    this.emit('itemAccessed', { cacheType, key });

    return item.value;
  }

  /**
   * 删除缓存项
   */
  delete(cacheType: string, key: string): boolean {
    if (!this.caches.has(cacheType)) {
      return false;
    }

    const cache = this.caches.get(cacheType)!;
    const deleted = cache.delete(key);

    if (deleted) {
      this.emit('itemDeleted', { cacheType, key });
    }

    return deleted;
  }

  /**
   * 清空特定类型的缓存
   */
  async clear(cacheType: string): Promise<{ itemsCleared: number }> {
    if (!this.caches.has(cacheType)) {
      return { itemsCleared: 0 };
    }

    const cache = this.caches.get(cacheType)!;
    const itemsCleared = cache.size;
    cache.clear();

    // 重置统计
    this.stats.set(cacheType, { hits: 0, misses: 0, accesses: 0 });

    this.emit('cacheCleared', { cacheType, itemsCleared });

    return { itemsCleared };
  }

  /**
   * 清空所有缓存
   */
  async clearAll(): Promise<{ itemsCleared: number; cacheTypes: string[] }> {
    let totalItemsCleared = 0;
    const cacheTypes: string[] = [];

    for (const [cacheType, cache] of this.caches) {
      totalItemsCleared += cache.size;
      cacheTypes.push(cacheType);
      cache.clear();

      // 重置统计
      this.stats.set(cacheType, { hits: 0, misses: 0, accesses: 0 });
    }

    this.emit('allCachesCleared', { itemsCleared: totalItemsCleared, cacheTypes });

    return { itemsCleared: totalItemsCleared, cacheTypes };
  }

  /**
   * 获取缓存统计
   */
  getStats(): { totalItems: number; memoryUsage: number; cacheTypes: string[] } {
    let totalItems = 0;
    let memoryUsage = 0;
    const cacheTypes: string[] = [];

    for (const [cacheType, cache] of this.caches) {
      totalItems += cache.size;
      cacheTypes.push(cacheType);

      for (const item of cache.values()) {
        memoryUsage += item.size;
      }
    }

    return { totalItems, memoryUsage, cacheTypes };
  }

  /**
   * 获取详细统计
   */
  getDetailedStats(): Record<string, CacheStats> {
    const result: Record<string, CacheStats> = {};

    for (const [cacheType, cache] of this.caches) {
      const stats = this.stats.get(cacheType)!;
      let memoryUsage = 0;

      for (const item of cache.values()) {
        memoryUsage += item.size;
      }

      const hitRate = stats.accesses > 0 ? (stats.hits / stats.accesses) * 100 : 0;
      const missRate = stats.accesses > 0 ? (stats.misses / stats.accesses) * 100 : 0;

      result[cacheType] = {
        totalItems: cache.size,
        memoryUsage,
        hitRate,
        missRate,
        accessCount: stats.accesses,
        cacheTypes: [cacheType],
      };
    }

    return result;
  }

  /**
   * 检查缓存项是否存在
   */
  has(cacheType: string, key: string): boolean {
    if (!this.caches.has(cacheType)) {
      return false;
    }

    const cache = this.caches.get(cacheType)!;
    const item = cache.get(key);

    if (!item) {
      return false;
    }

    // 检查是否过期
    if (item.expiresAt && item.expiresAt <= new Date()) {
      cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 添加新的缓存类型
   */
  addCacheType(name: string, config: CacheTypeConfig): boolean {
    if (this.caches.has(name)) {
      return false;
    }

    this.caches.set(name, new Map());
    this.configs.set(name, config);
    this.stats.set(name, { hits: 0, misses: 0, accesses: 0 });

    this.emit('cacheTypeAdded', { name, config });

    return true;
  }

  /**
   * 停止缓存管理器
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    this.emit('stopped');
  }
}
