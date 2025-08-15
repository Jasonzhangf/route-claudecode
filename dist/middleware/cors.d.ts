/**
 * CORS中间件
 *
 * 处理跨域资源共享
 *
 * @author Jason Zhang
 */
import { MiddlewareFunction } from '../server/http-server';
/**
 * CORS配置选项
 */
export interface CORSOptions {
    origin?: string | string[] | boolean;
    methods?: string[];
    allowedHeaders?: string[];
    exposedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
    headers?: string[];
}
/**
 * 创建CORS中间件
 */
export declare function cors(options?: CORSOptions): MiddlewareFunction;
//# sourceMappingURL=cors.d.ts.map