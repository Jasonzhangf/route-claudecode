"use strict";
/**
 * HTTP服务器核心类
 *
 * 实现RCC v4.0的HTTP服务器基础功能，包括路由、中间件、错误处理
 *
 * @author Jason Zhang
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTPServer = void 0;
const http = __importStar(require("http"));
const url = __importStar(require("url"));
const events_1 = require("events");
/**
 * HTTP服务器核心类
 */
class HTTPServer extends events_1.EventEmitter {
    server = null;
    routes = new Map();
    middleware = [];
    config;
    isRunning = false;
    startTime = null;
    requestCount = 0;
    constructor(config) {
        super();
        this.config = {
            maxRequestSize: 10 * 1024 * 1024, // 10MB
            timeout: 30000, // 30秒
            keepAliveTimeout: 5000, // 5秒
            debug: false,
            ...config
        };
        this.initializeRoutes();
    }
    /**
     * 初始化默认路由
     */
    initializeRoutes() {
        // 健康检查路由
        this.addRoute('GET', '/health', async (req, res) => {
            await this.handleHealthCheck(req, res);
        });
        // 状态路由
        this.addRoute('GET', '/status', async (req, res) => {
            await this.handleStatus(req, res);
        });
        // 版本信息路由
        this.addRoute('GET', '/version', async (req, res) => {
            await this.handleVersion(req, res);
        });
    }
    /**
     * 添加全局中间件
     */
    use(middleware) {
        this.middleware.push(middleware);
    }
    /**
     * 添加路由
     */
    addRoute(method, path, handler, middleware) {
        const route = { method, path, handler, middleware };
        if (!this.routes.has(method)) {
            this.routes.set(method, []);
        }
        this.routes.get(method).push(route);
        if (this.config.debug) {
            console.log(`📍 Route added: ${method} ${path}`);
        }
    }
    /**
     * 启动服务器
     */
    async start() {
        if (this.isRunning) {
            throw new Error('Server is already running');
        }
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res).catch(error => {
                    this.handleError(error, req, res);
                });
            });
            // 配置服务器选项
            this.server.timeout = this.config.timeout;
            this.server.keepAliveTimeout = this.config.keepAliveTimeout;
            this.server.on('error', (error) => {
                this.emit('error', error);
                reject(error);
            });
            this.server.listen(this.config.port, this.config.host, () => {
                this.isRunning = true;
                this.startTime = new Date();
                this.emit('started', {
                    host: this.config.host,
                    port: this.config.port
                });
                if (this.config.debug) {
                    console.log(`🚀 HTTP Server started on http://${this.config.host}:${this.config.port}`);
                }
                resolve();
            });
        });
    }
    /**
     * 停止服务器
     */
    async stop() {
        if (!this.isRunning || !this.server) {
            throw new Error('Server is not running');
        }
        return new Promise((resolve, reject) => {
            this.server.close((error) => {
                if (error) {
                    this.emit('error', error);
                    reject(error);
                    return;
                }
                this.isRunning = false;
                this.startTime = null;
                this.server = null;
                this.emit('stopped');
                if (this.config.debug) {
                    console.log('🛑 HTTP Server stopped');
                }
                resolve();
            });
        });
    }
    /**
     * 获取服务器状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            port: this.config.port,
            host: this.config.host,
            startTime: this.startTime || undefined,
            version: '4.0.0-alpha.1',
            activePipelines: 0, // TODO: 实现流水线计数
            totalRequests: this.requestCount,
            uptime: this.calculateUptime(),
            health: {
                status: this.isRunning ? 'healthy' : 'unhealthy',
                checks: this.performHealthChecks()
            }
        };
    }
    /**
     * 处理HTTP请求
     */
    async handleRequest(req, res) {
        this.requestCount++;
        // 创建请求上下文
        const requestContext = this.createRequestContext(req);
        const responseContext = this.createResponseContext(requestContext);
        try {
            if (this.config.debug) {
                console.log(`📥 ${requestContext.method} ${requestContext.url} [${requestContext.id}]`);
            }
            // 解析请求体
            await this.parseRequestBody(req, requestContext);
            // 执行中间件链
            await this.executeMiddleware(requestContext, responseContext);
            // 查找并执行路由处理器
            await this.executeRoute(requestContext, responseContext);
            // 发送响应
            this.sendResponse(res, responseContext);
        }
        catch (error) {
            this.handleError(error, req, res);
        }
    }
    /**
     * 创建请求上下文
     */
    createRequestContext(req) {
        const requestId = this.generateRequestId();
        const parsedUrl = url.parse(req.url || '', true);
        return {
            id: requestId,
            startTime: new Date(),
            method: req.method || 'GET',
            url: req.url || '/',
            headers: req.headers,
            query: parsedUrl.query,
            params: {},
            metadata: {}
        };
    }
    /**
     * 创建响应上下文
     */
    createResponseContext(req) {
        return {
            req,
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'X-Request-ID': req.id
            },
            sent: false
        };
    }
    /**
     * 解析请求体
     */
    async parseRequestBody(req, context) {
        if (req.method === 'GET' || req.method === 'HEAD') {
            return;
        }
        return new Promise((resolve, reject) => {
            const chunks = [];
            let totalSize = 0;
            req.on('data', (chunk) => {
                totalSize += chunk.length;
                if (totalSize > this.config.maxRequestSize) {
                    reject(new Error('Request body too large'));
                    return;
                }
                chunks.push(chunk);
            });
            req.on('end', () => {
                try {
                    const body = Buffer.concat(chunks).toString('utf-8');
                    if (body) {
                        const contentType = req.headers['content-type'] || '';
                        if (contentType.includes('application/json')) {
                            context.body = JSON.parse(body);
                        }
                        else {
                            context.body = body;
                        }
                    }
                    resolve();
                }
                catch (error) {
                    reject(new Error('Invalid request body format'));
                }
            });
            req.on('error', reject);
        });
    }
    /**
     * 执行中间件链
     */
    async executeMiddleware(req, res) {
        let index = 0;
        const next = (error) => {
            if (error) {
                throw error;
            }
            if (index >= this.middleware.length) {
                return;
            }
            const middleware = this.middleware[index++];
            if (middleware) {
                try {
                    const result = middleware(req, res, next);
                    if (result instanceof Promise) {
                        result.catch(next);
                    }
                }
                catch (err) {
                    next(err);
                }
            }
        };
        return new Promise((resolve, reject) => {
            const originalNext = next;
            const wrappedNext = (error) => {
                if (error) {
                    reject(error);
                }
                else if (index >= this.middleware.length) {
                    resolve();
                }
                else {
                    originalNext();
                }
            };
            wrappedNext();
        });
    }
    /**
     * 执行路由处理器
     */
    async executeRoute(req, res) {
        const routes = this.routes.get(req.method) || [];
        const route = this.findMatchingRoute(routes, req.url);
        if (!route) {
            res.statusCode = 404;
            res.body = { error: 'Not Found', message: `Route ${req.method} ${req.url} not found` };
            return;
        }
        // 提取路径参数
        this.extractPathParams(route.path, req.url, req);
        // 执行路由中间件
        if (route.middleware) {
            await this.executeRouteMiddleware(route.middleware, req, res);
        }
        // 执行路由处理器
        await route.handler(req, res);
    }
    /**
     * 查找匹配的路由
     */
    findMatchingRoute(routes, path) {
        // 简单实现：先查找精确匹配，后续可以扩展支持路径参数
        for (const route of routes) {
            if (this.pathMatches(route.path, path)) {
                return route;
            }
        }
        return null;
    }
    /**
     * 路径匹配检查
     */
    pathMatches(routePath, requestPath) {
        // 移除查询参数
        const cleanPath = requestPath.split('?')[0];
        // 简单实现：精确匹配
        if (routePath === cleanPath) {
            return true;
        }
        // TODO: 支持路径参数匹配 (如 /user/:id)
        return false;
    }
    /**
     * 提取路径参数
     */
    extractPathParams(routePath, requestPath, req) {
        // TODO: 实现路径参数提取
        // 目前只支持精确匹配，不需要参数提取
    }
    /**
     * 执行路由中间件
     */
    async executeRouteMiddleware(middleware, req, res) {
        let index = 0;
        const next = (error) => {
            if (error) {
                throw error;
            }
            if (index >= middleware.length) {
                return;
            }
            const mw = middleware[index++];
            if (mw) {
                try {
                    const result = mw(req, res, next);
                    if (result instanceof Promise) {
                        result.catch(next);
                    }
                }
                catch (err) {
                    next(err);
                }
            }
        };
        return new Promise((resolve, reject) => {
            const originalNext = next;
            const wrappedNext = (error) => {
                if (error) {
                    reject(error);
                }
                else if (index >= middleware.length) {
                    resolve();
                }
                else {
                    originalNext();
                }
            };
            wrappedNext();
        });
    }
    /**
     * 发送响应
     */
    sendResponse(res, context) {
        if (context.sent) {
            return;
        }
        context.sent = true;
        // 设置响应头
        for (const [key, value] of Object.entries(context.headers)) {
            res.setHeader(key, value);
        }
        res.statusCode = context.statusCode;
        // 发送响应体
        if (context.body !== undefined) {
            if (typeof context.body === 'object') {
                res.end(JSON.stringify(context.body, null, 2));
            }
            else {
                res.end(String(context.body));
            }
        }
        else {
            res.end();
        }
        if (this.config.debug) {
            const duration = Date.now() - context.req.startTime.getTime();
            console.log(`📤 ${context.statusCode} ${context.req.method} ${context.req.url} [${context.req.id}] ${duration}ms`);
        }
    }
    /**
     * 处理错误
     */
    handleError(error, req, res) {
        const message = error instanceof Error ? error.message : 'Internal Server Error';
        const statusCode = 500;
        console.error(`❌ Server Error: ${message}`);
        if (error instanceof Error && this.config.debug) {
            console.error(error.stack);
        }
        if (!res.headersSent) {
            res.statusCode = statusCode;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                error: 'Internal Server Error',
                message: this.config.debug ? message : 'An unexpected error occurred'
            }, null, 2));
        }
        this.emit('error', error);
    }
    /**
     * 生成请求ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * 计算运行时间
     */
    calculateUptime() {
        if (!this.startTime) {
            return '0s';
        }
        const uptimeMs = Date.now() - this.startTime.getTime();
        const uptimeSeconds = Math.floor(uptimeMs / 1000);
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;
        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        }
        else {
            return `${seconds}s`;
        }
    }
    /**
     * 执行健康检查
     */
    performHealthChecks() {
        const checks = [];
        // HTTP服务器检查
        const start = Date.now();
        checks.push({
            name: 'HTTP Server',
            status: this.isRunning ? 'pass' : 'fail',
            responseTime: Date.now() - start
        });
        // 内存检查
        const memStart = Date.now();
        const memUsage = process.memoryUsage();
        const maxMemory = 512 * 1024 * 1024; // 512MB
        checks.push({
            name: 'Memory Usage',
            status: memUsage.heapUsed < maxMemory ? 'pass' : 'warn',
            responseTime: Date.now() - memStart
        });
        return checks;
    }
    /**
     * 处理健康检查请求
     */
    async handleHealthCheck(req, res) {
        const health = this.performHealthChecks();
        const overallStatus = health.every(check => check.status === 'pass') ? 'healthy' : 'degraded';
        res.body = {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            checks: health
        };
    }
    /**
     * 处理状态请求
     */
    async handleStatus(req, res) {
        res.body = this.getStatus();
    }
    /**
     * 处理版本信息请求
     */
    async handleVersion(req, res) {
        res.body = {
            name: 'RCC (Route Claude Code)',
            version: '4.0.0-alpha.1',
            description: 'Modular AI routing proxy system',
            author: 'Jason Zhang'
        };
    }
}
exports.HTTPServer = HTTPServer;
//# sourceMappingURL=http-server.js.map