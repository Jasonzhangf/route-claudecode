/**
 * 速率限制中间件
 * 
 * 实现基于IP、用户或API密钥的请求速率限制
 * 
 * @author Jason Zhang
 */

import { MiddlewareFunction } from '../server/http-server';

/**
 * 速率限制配置
 */
export interface RateLimitOptions {
  windowMs?: number;        // 时间窗口（毫秒）
  maxRequests?: number;     // 最大请求数
  keyGenerator?: (req: any) => string;  // 键生成函数
  skipSuccessfulRequests?: boolean;     // 跳过成功请求
  skipFailedRequests?: boolean;         // 跳过失败请求
  message?: string;         // 超限消息
}

/**
 * 请求记录
 */
interface RequestRecord {
  count: number;
  resetTime: number;
}

/**
 * 创建速率限制中间件
 */
export function rateLimit(options: RateLimitOptions = {}): MiddlewareFunction {
  const {
    windowMs = 15 * 60 * 1000,  // 15分钟
    maxRequests = 100,
    keyGenerator = (req) => req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '127.0.0.1',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    message = 'Too many requests, please try again later.'
  } = options;
  
  const store = new Map<string, RequestRecord>();
  
  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    // 清理过期记录
    cleanupExpiredRecords(now);
    
    // 获取当前记录
    const record = store.get(key) || { count: 0, resetTime: now + windowMs };
    
    // 检查是否超过限制
    if (record.count >= maxRequests && now < record.resetTime) {
      res.statusCode = 429;
      res.headers['X-RateLimit-Limit'] = maxRequests.toString();
      res.headers['X-RateLimit-Remaining'] = '0';
      res.headers['X-RateLimit-Reset'] = new Date(record.resetTime).toISOString();
      res.headers['Retry-After'] = Math.ceil((record.resetTime - now) / 1000).toString();
      res.body = { error: 'Too Many Requests', message };
      return;
    }
    
    // 重置计数器（如果窗口过期）
    if (now >= record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }
    
    // 增加计数器
    record.count++;
    store.set(key, record);
    
    // 设置速率限制头
    res.headers['X-RateLimit-Limit'] = maxRequests.toString();
    res.headers['X-RateLimit-Remaining'] = Math.max(0, maxRequests - record.count).toString();
    res.headers['X-RateLimit-Reset'] = new Date(record.resetTime).toISOString();
    
    // 继续处理请求
    const originalNext = next;
    const enhancedNext = (error?: Error) => {
      // 根据配置决定是否回滚计数
      if (skipSuccessfulRequests && !error && res.statusCode < 400) {
        record.count--;
        store.set(key, record);
      } else if (skipFailedRequests && (error || res.statusCode >= 400)) {
        record.count--;
        store.set(key, record);
      }
      
      originalNext(error);
    };
    
    enhancedNext();
  };
  
  function cleanupExpiredRecords(now: number): void {
    for (const [key, record] of store.entries()) {
      if (now >= record.resetTime) {
        store.delete(key);
      }
    }
  }
}

/**
 * 创建基于内存的速率限制存储
 */
export class MemoryRateLimitStore {
  private store = new Map<string, RequestRecord>();
  
  get(key: string): RequestRecord | undefined {
    return this.store.get(key);
  }
  
  set(key: string, record: RequestRecord): void {
    this.store.set(key, record);
  }
  
  delete(key: string): void {
    this.store.delete(key);
  }
  
  cleanup(now: number): void {
    for (const [key, record] of this.store.entries()) {
      if (now >= record.resetTime) {
        this.store.delete(key);
      }
    }
  }
  
  size(): number {
    return this.store.size;
  }
}