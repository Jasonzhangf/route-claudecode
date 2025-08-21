"use strict";
/**
 * 简单路由器实现
 *
 * 提供基础的路由定义功能
 *
 * @author RCC v4.0 Team
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteGroupClass = exports.Router = void 0;
class Router {
    constructor() {
        this.routes = [];
    }
    get(path, handler, middleware) {
        const middlewareArray = Array.isArray(middleware) ? middleware : middleware ? [middleware] : undefined;
        this.routes.push({ method: 'GET', path, handler, middleware: middlewareArray });
    }
    post(path, handler, middleware) {
        const middlewareArray = Array.isArray(middleware) ? middleware : middleware ? [middleware] : undefined;
        this.routes.push({ method: 'POST', path, handler, middleware: middlewareArray });
    }
    put(path, handler, middleware) {
        const middlewareArray = Array.isArray(middleware) ? middleware : middleware ? [middleware] : undefined;
        this.routes.push({ method: 'PUT', path, handler, middleware: middlewareArray });
    }
    delete(path, handler, middleware) {
        const middlewareArray = Array.isArray(middleware) ? middleware : middleware ? [middleware] : undefined;
        this.routes.push({ method: 'DELETE', path, handler, middleware: middlewareArray });
    }
    patch(path, handler, middleware) {
        const middlewareArray = Array.isArray(middleware) ? middleware : middleware ? [middleware] : undefined;
        this.routes.push({ method: 'PATCH', path, handler, middleware: middlewareArray });
    }
    options(path, handler, middleware) {
        const middlewareArray = Array.isArray(middleware) ? middleware : middleware ? [middleware] : undefined;
        this.routes.push({ method: 'OPTIONS', path, handler, middleware: middlewareArray });
    }
    group(prefixOrGroup, options) {
        if (typeof prefixOrGroup === 'string') {
            return new RouteGroupClass(prefixOrGroup, options?.middleware);
        }
        else {
            // Handle RouteGroup object registration
            const routeGroup = prefixOrGroup;
            if (routeGroup.routes) {
                routeGroup.routes.forEach(route => {
                    this.routes.push({
                        ...route,
                        path: `${routeGroup.prefix || ''}${route.path}`,
                        middleware: [...(routeGroup.middleware || []), ...(route.middleware || [])]
                    });
                });
            }
            return routeGroup;
        }
    }
    getRoutes() {
        return [...this.routes];
    }
}
exports.Router = Router;
class RouteGroupClass {
    constructor(prefix, middleware) {
        this.prefix = prefix;
        this.router = new Router();
        this.middleware = middleware;
        this.routes = [];
    }
    get(path, handler) {
        this.router.get(`${this.prefix}${path}`, handler);
    }
    post(path, handler) {
        this.router.post(`${this.prefix}${path}`, handler);
    }
    put(path, handler) {
        this.router.put(`${this.prefix}${path}`, handler);
    }
    delete(path, handler) {
        this.router.delete(`${this.prefix}${path}`, handler);
    }
    patch(path, handler) {
        this.router.patch(`${this.prefix}${path}`, handler);
    }
    options(path, handler) {
        this.router.options(`${this.prefix}${path}`, handler);
    }
    getRoutes() {
        return this.router.getRoutes();
    }
}
exports.RouteGroupClass = RouteGroupClass;
//# sourceMappingURL=router.js.map