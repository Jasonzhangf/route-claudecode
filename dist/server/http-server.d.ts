/**
 * HTTP服务器核心类
 *
 * 实现RCC v4.0的HTTP服务器基础功能，包括路由、中间件、错误处理
 *
 * @author Jason Zhang
 */
import { EventEmitter } from 'events';
import { ServerStatus } from '../interfaces';
import { IRequestContext, IResponseContext } from '../interfaces/core/server-interface';
/**
 * HTTP请求上下文
 */
export interface RequestContext extends IRequestContext {
}
/**
 * HTTP响应上下文
 */
export interface ResponseContext extends IResponseContext {
}
/**
 * 中间件函数类型
 */
export type MiddlewareFunction = (req: RequestContext, res: ResponseContext, next: (error?: Error) => void) => void | Promise<void>;
/**
 * 路由处理函数类型
 */
export type RouteHandler = (req: RequestContext, res: ResponseContext) => void | Promise<void>;
/**
 * 路由定义
 */
export interface Route {
    method: string;
    path: string;
    handler: RouteHandler;
    middleware?: MiddlewareFunction[];
}
/**
 * 服务器配置
 */
export interface ServerConfig {
    port: number;
    host: string;
    maxRequestSize?: number;
    timeout?: number;
    keepAliveTimeout?: number;
    debug?: boolean;
}
/**
 * HTTP服务器核心类
 */
export declare class HTTPServer extends EventEmitter {
    private server;
    private routes;
    private middleware;
    private config;
    private isRunning;
    private startTime;
    private requestCount;
    private connections;
    constructor(config: ServerConfig);
    /**
     * 初始化默认路由
     */
    private initializeRoutes;
    /**
     * 添加全局中间件
     */
    use(middleware: MiddlewareFunction): void;
    /**
     * 添加路由
     */
    addRoute(method: string, path: string, handler: RouteHandler, middleware?: MiddlewareFunction[]): void;
    /**
     * 启动服务器
     */
    start(): Promise<void>;
    /**
     * 停止服务器
     */
    stop(): Promise<void>;
    /**
     * 获取服务器状态
     */
    getStatus(): ServerStatus;
    /**
     * 处理HTTP请求
     */
    private handleRequest;
    /**
     * 创建请求上下文
     */
    private createRequestContext;
    /**
     * 创建响应上下文
     */
    private createResponseContext;
    /**
     * 解析请求体
     */
    private parseRequestBody;
    /**
     * 执行中间件链
     */
    private executeMiddleware;
    /**
     * 执行路由处理器
     */
    private executeRoute;
    /**
     * 查找匹配的路由
     */
    private findMatchingRoute;
    /**
     * 路径匹配检查
     */
    private pathMatches;
    /**
     * 提取路径参数
     */
    private extractPathParams;
    /**
     * 执行路由中间件
     */
    private executeRouteMiddleware;
    /**
     * 发送响应
     */
    private sendResponse;
    /**
     * 处理错误 - 改进版错误处理
     */
    private handleError;
    /**
     * 生成请求ID
     */
    private generateRequestId;
    /**
     * 设置内置路由
     */
    private setupBuiltinRoutes;
    /**
     * 获取活跃Pipeline数量
     */
    private getActivePipelineCount;
    /**
     * 计算运行时间
     */
    private calculateUptime;
    /**
     * 执行健康检查
     */
    private performHealthChecks;
    /**
     * 处理健康检查请求
     */
    private handleHealthCheck;
    /**
     * 处理状态请求
     */
    private handleStatus;
    /**
     * 处理版本信息请求
     */
    private handleVersion;
}
//# sourceMappingURL=http-server.d.ts.map