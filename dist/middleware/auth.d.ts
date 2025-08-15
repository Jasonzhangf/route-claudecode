/**
 * 认证中间件
 *
 * 处理API密钥验证和用户认证
 *
 * @author Jason Zhang
 */
import { MiddlewareFunction } from '../server/http-server';
/**
 * 认证配置选项
 */
export interface AuthOptions {
    type: 'apikey' | 'bearer' | 'basic';
    validate: (token: string) => Promise<any> | any;
    headerName?: string;
    cookieName?: string;
    queryParam?: string;
    required?: boolean;
    message?: string;
}
/**
 * 创建认证中间件
 */
export declare function auth(options: AuthOptions): MiddlewareFunction;
/**
 * 创建API密钥认证中间件
 */
export declare function apiKeyAuth(validApiKeys: string[]): MiddlewareFunction;
/**
 * 创建Bearer令牌认证中间件
 */
export declare function bearerAuth(validateToken: (token: string) => Promise<any> | any): MiddlewareFunction;
/**
 * 创建Basic认证中间件
 */
export declare function basicAuth(validateCredentials: (username: string, password: string) => Promise<any> | any): MiddlewareFunction;
/**
 * 简单认证配置
 */
export interface SimpleAuthConfig {
    required?: boolean;
    apiKeyHeader?: string;
    bearerHeader?: string;
    basicAuth?: boolean;
}
/**
 * 创建简单认证中间件 - 与PipelineServer兼容
 */
export declare function authentication(config?: SimpleAuthConfig): MiddlewareFunction;
//# sourceMappingURL=auth.d.ts.map