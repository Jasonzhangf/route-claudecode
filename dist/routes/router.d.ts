/**
 * 简单路由器实现
 *
 * 提供基础的路由定义功能
 *
 * @author RCC v4.0 Team
 */
export interface RouteHandler {
    (req: any, res: any, next?: any): void | Promise<void>;
}
export interface IMiddlewareFunction extends RouteHandler {
}
export interface RouteDefinition {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';
    path: string;
    handler: RouteHandler;
    middleware?: RouteHandler[];
    name?: string;
    description?: string;
}
export declare class Router {
    private routes;
    get(path: string, handler: RouteHandler, middleware?: RouteHandler | RouteHandler[]): void;
    post(path: string, handler: RouteHandler, middleware?: RouteHandler | RouteHandler[]): void;
    put(path: string, handler: RouteHandler, middleware?: RouteHandler | RouteHandler[]): void;
    delete(path: string, handler: RouteHandler, middleware?: RouteHandler | RouteHandler[]): void;
    patch(path: string, handler: RouteHandler, middleware?: RouteHandler | RouteHandler[]): void;
    options(path: string, handler: RouteHandler, middleware?: RouteHandler | RouteHandler[]): void;
    group(prefixOrGroup: string | RouteGroup, options?: {
        middleware?: RouteHandler[];
    }): RouteGroup;
    getRoutes(): RouteDefinition[];
}
export interface RouteGroup {
    prefix: string;
    middleware?: RouteHandler[];
    routes?: RouteDefinition[];
}
export declare class RouteGroupClass implements RouteGroup {
    prefix: string;
    private router;
    middleware?: RouteHandler[];
    routes?: RouteDefinition[];
    constructor(prefix: string, middleware?: RouteHandler[]);
    get(path: string, handler: RouteHandler): void;
    post(path: string, handler: RouteHandler): void;
    put(path: string, handler: RouteHandler): void;
    delete(path: string, handler: RouteHandler): void;
    patch(path: string, handler: RouteHandler): void;
    options(path: string, handler: RouteHandler): void;
    getRoutes(): RouteDefinition[];
}
//# sourceMappingURL=router.d.ts.map