/**
 * 高级路由管理器
 *
 * 支持路径参数、中间件组合、路由组等高级功能
 *
 * @author Jason Zhang
 */
import { HTTPServer, MiddlewareFunction } from '../server/http-server';
/**
 * 路由参数类型
 */
export type RouteParams = Record<string, string>;
/**
 * 增强的路由处理器
 */
export type EnhancedRouteHandler = (req: any, res: any, params: RouteParams) => void | Promise<void>;
/**
 * 路由定义接口
 */
export interface RouteDefinition {
    method: string;
    path: string;
    handler: EnhancedRouteHandler;
    middleware?: MiddlewareFunction[];
    name?: string;
    description?: string;
}
/**
 * 路由组配置
 */
export interface RouteGroup {
    prefix: string;
    middleware?: MiddlewareFunction[];
    routes: RouteDefinition[];
}
/**
 * 高级路由管理器
 */
export declare class Router {
    private routes;
    private server;
    constructor(server: HTTPServer);
    /**
     * 添加GET路由
     */
    get(path: string, handler: EnhancedRouteHandler, middleware?: MiddlewareFunction[]): void;
    /**
     * 添加POST路由
     */
    post(path: string, handler: EnhancedRouteHandler, middleware?: MiddlewareFunction[]): void;
    /**
     * 添加PUT路由
     */
    put(path: string, handler: EnhancedRouteHandler, middleware?: MiddlewareFunction[]): void;
    /**
     * 添加DELETE路由
     */
    delete(path: string, handler: EnhancedRouteHandler, middleware?: MiddlewareFunction[]): void;
    /**
     * 添加PATCH路由
     */
    patch(path: string, handler: EnhancedRouteHandler, middleware?: MiddlewareFunction[]): void;
    /**
     * 添加所有HTTP方法的路由
     */
    all(path: string, handler: EnhancedRouteHandler, middleware?: MiddlewareFunction[]): void;
    /**
     * 添加路由
     */
    addRoute(method: string, path: string, handler: EnhancedRouteHandler, middleware?: MiddlewareFunction[]): void;
    /**
     * 添加路由组
     */
    group(groupConfig: RouteGroup): void;
    /**
     * 创建路由处理器包装器
     */
    private createRouteHandler;
    /**
     * 标准化路径
     */
    private normalizePath;
    /**
     * 连接路径
     */
    private joinPaths;
    /**
     * 匹配路径并提取参数
     */
    private matchPath;
    /**
     * 获取所有路由信息
     */
    getRoutes(): RouteDefinition[];
    /**
     * 根据名称查找路由
     */
    findRoute(name: string): RouteDefinition | undefined;
    /**
     * 生成路由URL
     */
    generateUrl(routeName: string, params?: RouteParams): string;
    /**
     * 打印路由表
     */
    printRoutes(): void;
}
//# sourceMappingURL=router.d.ts.map