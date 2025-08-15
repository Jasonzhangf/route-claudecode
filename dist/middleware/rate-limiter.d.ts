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
    windowMs?: number;
    maxRequests?: number;
    keyGenerator?: (req: any) => string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
    message?: string;
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
export declare function rateLimit(options?: RateLimitOptions): MiddlewareFunction;
/**
 * 创建基于内存的速率限制存储
 */
export declare class MemoryRateLimitStore {
    private store;
    get(key: string): RequestRecord | undefined;
    set(key: string, record: RequestRecord): void;
    delete(key: string): void;
    cleanup(now: number): void;
    size(): number;
}
export {};
//# sourceMappingURL=rate-limiter.d.ts.map