"use strict";
/**
 * 高级路由管理器
 *
 * 支持路径参数、中间件组合、路由组等高级功能
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Router = void 0;
/**
 * 高级路由管理器
 */
class Router {
    constructor(server) {
        this.routes = [];
        this.server = server;
    }
    /**
     * 添加GET路由
     */
    get(path, handler, middleware) {
        this.addRoute('GET', path, handler, middleware);
    }
    /**
     * 添加POST路由
     */
    post(path, handler, middleware) {
        this.addRoute('POST', path, handler, middleware);
    }
    /**
     * 添加PUT路由
     */
    put(path, handler, middleware) {
        this.addRoute('PUT', path, handler, middleware);
    }
    /**
     * 添加DELETE路由
     */
    delete(path, handler, middleware) {
        this.addRoute('DELETE', path, handler, middleware);
    }
    /**
     * 添加PATCH路由
     */
    patch(path, handler, middleware) {
        this.addRoute('PATCH', path, handler, middleware);
    }
    /**
     * 添加所有HTTP方法的路由
     */
    all(path, handler, middleware) {
        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
        methods.forEach(method => {
            this.addRoute(method, path, handler, middleware);
        });
    }
    /**
     * 添加路由
     */
    addRoute(method, path, handler, middleware) {
        const route = {
            method: method.toUpperCase(),
            path: this.normalizePath(path),
            handler,
            middleware,
        };
        this.routes.push(route);
        // 在HTTP服务器上注册路由
        this.server.addRoute(route.method, route.path, this.createRouteHandler(route), middleware);
    }
    /**
     * 添加路由组
     */
    group(groupConfig) {
        groupConfig.routes.forEach(route => {
            const fullPath = this.joinPaths(groupConfig.prefix, route.path);
            const combinedMiddleware = [...(groupConfig.middleware || []), ...(route.middleware || [])];
            this.addRoute(route.method, fullPath, route.handler, combinedMiddleware);
        });
    }
    /**
     * 创建路由处理器包装器
     */
    createRouteHandler(route) {
        return async (req, res) => {
            // 解析路径参数
            const url = req.url || '/';
            const path = url.split('?')[0] || '/';
            const pathMatch = this.matchPath(route.path, path);
            if (!pathMatch.matched) {
                res.statusCode = 404;
                res.body = { error: 'Not Found' };
                return;
            }
            // 调用增强的路由处理器
            await route.handler(req, res, pathMatch.params);
        };
    }
    /**
     * 标准化路径
     */
    normalizePath(path) {
        // 确保路径以/开头
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
        // 移除尾部的/（除非是根路径）
        if (path.length > 1 && path.endsWith('/')) {
            path = path.slice(0, -1);
        }
        return path;
    }
    /**
     * 连接路径
     */
    joinPaths(prefix, path) {
        const normalizedPrefix = this.normalizePath(prefix);
        const normalizedPath = this.normalizePath(path);
        if (normalizedPath === '/') {
            return normalizedPrefix;
        }
        return normalizedPrefix + normalizedPath;
    }
    /**
     * 匹配路径并提取参数
     */
    matchPath(routePath, requestPath) {
        const routeSegments = routePath.split('/').filter(Boolean);
        const requestSegments = requestPath.split('/').filter(Boolean);
        // 检查段数是否匹配
        if (routeSegments.length !== requestSegments.length) {
            return { matched: false, params: {} };
        }
        const params = {};
        for (let i = 0; i < routeSegments.length; i++) {
            const routeSegment = routeSegments[i];
            const requestSegment = requestSegments[i];
            if (!routeSegment || !requestSegment) {
                return { matched: false, params: {} };
            }
            if (routeSegment.startsWith(':')) {
                // 参数段
                const paramName = routeSegment.slice(1);
                params[paramName] = decodeURIComponent(requestSegment);
            }
            else if (routeSegment !== requestSegment) {
                // 静态段不匹配
                return { matched: false, params: {} };
            }
        }
        return { matched: true, params };
    }
    /**
     * 获取所有路由信息
     */
    getRoutes() {
        return [...this.routes];
    }
    /**
     * 根据名称查找路由
     */
    findRoute(name) {
        return this.routes.find(route => route.name === name);
    }
    /**
     * 生成路由URL
     */
    generateUrl(routeName, params = {}) {
        const route = this.findRoute(routeName);
        if (!route) {
            throw new Error(`Route '${routeName}' not found`);
        }
        let url = route.path;
        // 替换路径参数
        for (const [key, value] of Object.entries(params)) {
            url = url.replace(`:${key}`, encodeURIComponent(value));
        }
        return url;
    }
    /**
     * 打印路由表
     */
    printRoutes() {
        console.log('\\n📋 Registered Routes:');
        console.log('════════════════════════════════════════');
        this.routes.forEach(route => {
            const middlewareInfo = route.middleware ? ` (${route.middleware.length} middleware)` : '';
            console.log(`${route.method.padEnd(7)} ${route.path}${middlewareInfo}`);
            if (route.description) {
                console.log(`        ${route.description}`);
            }
        });
        console.log('════════════════════════════════════════\\n');
    }
}
exports.Router = Router;
//# sourceMappingURL=router.js.map