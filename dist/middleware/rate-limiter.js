"use strict";
/**
 * 速率限制中间件
 *
 * 实现基于IP、用户或API密钥的请求速率限制
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryRateLimitStore = void 0;
exports.rateLimit = rateLimit;
/**
 * 创建速率限制中间件
 */
function rateLimit(options = {}) {
    const { windowMs = 15 * 60 * 1000, // 15分钟
    maxRequests = 100, keyGenerator = req => req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '127.0.0.1', skipSuccessfulRequests = false, skipFailedRequests = false, message = 'Too many requests, please try again later.', } = options;
    const store = new Map();
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
        const enhancedNext = (error) => {
            // 根据配置决定是否回滚计数
            if (skipSuccessfulRequests && !error && res.statusCode < 400) {
                record.count--;
                store.set(key, record);
            }
            else if (skipFailedRequests && (error || res.statusCode >= 400)) {
                record.count--;
                store.set(key, record);
            }
            originalNext(error);
        };
        enhancedNext();
    };
    function cleanupExpiredRecords(now) {
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
class MemoryRateLimitStore {
    constructor() {
        this.store = new Map();
    }
    get(key) {
        return this.store.get(key);
    }
    set(key, record) {
        this.store.set(key, record);
    }
    delete(key) {
        this.store.delete(key);
    }
    cleanup(now) {
        for (const [key, record] of this.store.entries()) {
            if (now >= record.resetTime) {
                this.store.delete(key);
            }
        }
    }
    size() {
        return this.store.size;
    }
}
exports.MemoryRateLimitStore = MemoryRateLimitStore;
//# sourceMappingURL=rate-limiter.js.map