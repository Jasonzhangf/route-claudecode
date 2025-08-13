/**
 * Mock Server Core
 * Mock Server的核心HTTP服务器和请求处理
 * @author Jason Zhang
 * @version v3.0-refactor
 */

import http from 'http';
import { EventEmitter } from 'events';
import { URL } from 'url';

export class MockServerCore extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            port: config.port || 3458,
            host: config.host || 'localhost',
            cors: config.cors !== false,
            maxRequestSize: config.maxRequestSize || 50 * 1024 * 1024, // 50MB
            timeout: config.timeout || 30000, // 30秒
            ...config
        };
        
        this.server = null;
        this.isRunning = false;
        this.host = this.config.host;
        this.port = this.config.port;
        
        // 请求处理器映射
        this.routeHandlers = new Map();
        this.middlewares = [];
        
        // 统计信息
        this.stats = {
            totalRequests: 0,
            activeConnections: 0,
            errors: 0,
            startTime: null
        };
        
        // 初始化路由
        this.setupRoutes();
        
        console.log('🖥️  Mock Server Core initialized');
    }
    
    /**
     * 启动HTTP服务器
     */
    async start(options = {}) {
        if (this.isRunning) {
            throw new Error('Server is already running');
        }
        
        this.host = options.host || this.config.host;
        this.port = options.port || this.config.port;
        
        return new Promise((resolve, reject) => {
            this.server = http.createServer(this.handleRequest.bind(this));
            
            this.server.on('connection', (socket) => {
                this.stats.activeConnections += 1;
                socket.on('close', () => {
                    this.stats.activeConnections -= 1;
                });
            });
            
            this.server.on('error', (error) => {
                this.stats.errors += 1;
                this.emit('serverError', error);
                reject(error);
            });
            
            this.server.listen(this.port, this.host, () => {
                this.isRunning = true;
                this.stats.startTime = Date.now();
                
                console.log(`🚀 Mock Server Core listening on http://${this.host}:${this.port}`);
                this.emit('serverStarted', { host: this.host, port: this.port });
                
                resolve({
                    host: this.host,
                    port: this.port,
                    address: `http://${this.host}:${this.port}`
                });
            });
        });
    }
    
    /**
     * 停止HTTP服务器
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }
        
        return new Promise((resolve) => {
            this.server.close(() => {
                this.isRunning = false;
                this.stats.startTime = null;
                
                console.log('🛑 Mock Server Core stopped');
                this.emit('serverStopped');
                
                resolve();
            });
        });
    }
    
    /**
     * 处理HTTP请求
     */
    async handleRequest(req, res) {
        const startTime = Date.now();
        this.stats.totalRequests += 1;
        
        try {
            // 设置基本响应头
            this.setCommonHeaders(res);
            
            // CORS处理
            if (this.config.cors) {
                this.handleCORS(req, res);
            }
            
            // OPTIONS请求直接返回
            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }
            
            // 解析请求
            const requestData = await this.parseRequest(req);
            
            // 应用中间件
            for (const middleware of this.middlewares) {
                await middleware(requestData, res);
            }
            
            // 路由处理
            const response = await this.routeRequest(requestData);
            
            // 发送响应
            this.sendResponse(res, response);
            
            // 记录请求
            const duration = Date.now() - startTime;
            this.emit('requestProcessed', {
                method: req.method,
                url: req.url,
                duration,
                status: response.status || 200
            });
            
        } catch (error) {
            this.stats.errors += 1;
            
            console.error('❌ Request processing error:', error.message);
            this.emit('requestError', { error: error.message, url: req.url });
            
            this.sendErrorResponse(res, error);
        }
    }
    
    /**
     * 解析HTTP请求
     */
    async parseRequest(req) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        
        const requestData = {
            method: req.method,
            url: req.url,
            pathname: url.pathname,
            searchParams: url.searchParams,
            headers: req.headers,
            timestamp: new Date().toISOString(),
            body: null
        };
        
        // 解析请求体
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            requestData.body = await this.parseRequestBody(req);
        }
        
        return requestData;
    }
    
    /**
     * 解析请求体
     */
    parseRequestBody(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            let size = 0;
            
            req.on('data', (chunk) => {
                size += chunk.length;
                
                if (size > this.config.maxRequestSize) {
                    reject(new Error('Request body too large'));
                    return;
                }
                
                body += chunk.toString();
            });
            
            req.on('end', () => {
                try {
                    // 尝试解析JSON
                    if (req.headers['content-type']?.includes('application/json')) {
                        resolve(JSON.parse(body));
                    } else {
                        resolve(body);
                    }
                } catch (error) {
                    // 解析失败，返回原始字符串
                    resolve(body);
                }
            });
            
            req.on('error', reject);
        });
    }
    
    /**
     * 路由请求
     */
    async routeRequest(requestData) {
        const { pathname, method } = requestData;
        const routeKey = `${method} ${pathname}`;
        
        // 寻找精确匹配
        let handler = this.routeHandlers.get(routeKey);
        
        // 寻找模式匹配
        if (!handler) {
            for (const [route, routeHandler] of this.routeHandlers) {
                if (this.matchRoute(route, routeKey)) {
                    handler = routeHandler;
                    break;
                }
            }
        }
        
        // 默认处理器
        if (!handler) {
            handler = this.routeHandlers.get('DEFAULT');
        }
        
        if (!handler) {
            throw new Error(`No handler found for ${routeKey}`);
        }
        
        return await handler(requestData);
    }
    
    /**
     * 匹配路由模式
     */
    matchRoute(routePattern, requestRoute) {
        // 简单的通配符匹配
        const pattern = routePattern.replace(/\\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(requestRoute);
    }
    
    /**
     * 设置通用响应头
     */
    setCommonHeaders(res) {
        res.setHeader('Server', 'Claude-Code-Router-MockServer/v3.0');
        res.setHeader('X-Powered-By', 'Mock-Server');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    
    /**
     * 处理CORS
     */
    handleCORS(req, res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.setHeader('Access-Control-Max-Age', '86400');
    }
    
    /**
     * 发送响应
     */
    sendResponse(res, response) {
        const status = response.status || 200;
        const headers = response.headers || {};
        const body = response.body || response;
        
        // 设置自定义头
        Object.entries(headers).forEach(([key, value]) => {
            res.setHeader(key, value);
        });
        
        res.writeHead(status);
        
        if (typeof body === 'object') {
            res.end(JSON.stringify(body, null, 2));
        } else {
            res.end(body);
        }
    }
    
    /**
     * 发送错误响应
     */
    sendErrorResponse(res, error) {
        const status = error.status || 500;
        const message = error.message || 'Internal Server Error';
        
        const errorResponse = {
            error: {
                message,
                status,
                timestamp: new Date().toISOString(),
                server: 'mock-server'
            }
        };
        
        res.writeHead(status);
        res.end(JSON.stringify(errorResponse, null, 2));
    }
    
    /**
     * 设置路由
     */
    setupRoutes() {
        // 健康检查
        this.addRoute('GET /health', this.handleHealthCheck.bind(this));
        
        // 状态信息
        this.addRoute('GET /status', this.handleStatusCheck.bind(this));
        
        // AI Provider模拟端点
        this.addRoute('POST /v1/messages', this.handleAnthropicRequest.bind(this));
        this.addRoute('POST /v1/chat/completions', this.handleOpenAIRequest.bind(this));
        this.addRoute('POST /v1/models/*/generateContent', this.handleGeminiRequest.bind(this));
        
        // 场景管理
        this.addRoute('GET /scenarios', this.handleGetScenarios.bind(this));
        this.addRoute('POST /scenarios/*/start', this.handleStartScenario.bind(this));
        this.addRoute('POST /scenarios/*/stop', this.handleStopScenario.bind(this));
        
        // 数据查询
        this.addRoute('GET /data/*', this.handleDataQuery.bind(this));
        
        // 默认处理器
        this.addRoute('DEFAULT', this.handleDefault.bind(this));
    }
    
    /**
     * 添加路由处理器
     */
    addRoute(route, handler) {
        this.routeHandlers.set(route, handler);
        console.log(`🔗 Route added: ${route}`);
    }
    
    /**
     * 添加中间件
     */
    addMiddleware(middleware) {
        this.middlewares.push(middleware);
    }
    
    /**
     * 健康检查处理器
     */
    async handleHealthCheck(requestData) {
        return {
            status: 200,
            body: {
                status: 'healthy',
                server: 'mock-server',
                uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0,
                timestamp: new Date().toISOString()
            }
        };
    }
    
    /**
     * 状态检查处理器
     */
    async handleStatusCheck(requestData) {
        return {
            status: 200,
            body: {
                server: {
                    host: this.host,
                    port: this.port,
                    isRunning: this.isRunning,
                    uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0
                },
                stats: this.stats,
                routes: Array.from(this.routeHandlers.keys()),
                middlewares: this.middlewares.length,
                timestamp: new Date().toISOString()
            }
        };
    }
    
    /**
     * Anthropic请求处理器
     */
    async handleAnthropicRequest(requestData) {
        // 这里会委托给ProviderSimulation
        this.emit('providerRequest', {
            provider: 'anthropic',
            request: requestData
        });
        
        return {
            status: 200,
            body: {
                id: `msg_mock_${Date.now()}`,
                type: 'message',
                role: 'assistant',
                content: [
                    {
                        type: 'text',
                        text: 'This is a mock response from Anthropic provider simulation.'
                    }
                ],
                model: 'claude-3-sonnet-20240229',
                stop_reason: 'end_turn',
                usage: {
                    input_tokens: 10,
                    output_tokens: 20
                }
            }
        };
    }
    
    /**
     * OpenAI请求处理器
     */
    async handleOpenAIRequest(requestData) {
        this.emit('providerRequest', {
            provider: 'openai',
            request: requestData
        });
        
        return {
            status: 200,
            body: {
                id: `chatcmpl_mock_${Date.now()}`,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: 'gpt-4',
                choices: [
                    {
                        index: 0,
                        message: {
                            role: 'assistant',
                            content: 'This is a mock response from OpenAI provider simulation.'
                        },
                        finish_reason: 'stop'
                    }
                ],
                usage: {
                    prompt_tokens: 10,
                    completion_tokens: 20,
                    total_tokens: 30
                }
            }
        };
    }
    
    /**
     * Gemini请求处理器
     */
    async handleGeminiRequest(requestData) {
        this.emit('providerRequest', {
            provider: 'gemini',
            request: requestData
        });
        
        return {
            status: 200,
            body: {
                candidates: [
                    {
                        content: {
                            parts: [
                                {
                                    text: 'This is a mock response from Gemini provider simulation.'
                                }
                            ],
                            role: 'model'
                        },
                        finishReason: 'STOP',
                        index: 0
                    }
                ],
                usageMetadata: {
                    promptTokenCount: 10,
                    candidatesTokenCount: 20,
                    totalTokenCount: 30
                }
            }
        };
    }
    
    /**
     * 获取场景处理器
     */
    async handleGetScenarios(requestData) {
        this.emit('scenarioRequest', {
            action: 'list',
            request: requestData
        });
        
        return {
            status: 200,
            body: {
                scenarios: [],
                message: 'Scenario list endpoint - implement with ScenarioManager'
            }
        };
    }
    
    /**
     * 启动场景处理器
     */
    async handleStartScenario(requestData) {
        const scenarioName = this.extractScenarioName(requestData.pathname);
        
        this.emit('scenarioRequest', {
            action: 'start',
            scenarioName,
            request: requestData
        });
        
        return {
            status: 200,
            body: {
                message: `Scenario start endpoint for: ${scenarioName}`,
                scenarioName,
                status: 'started'
            }
        };
    }
    
    /**
     * 停止场景处理器
     */
    async handleStopScenario(requestData) {
        const scenarioName = this.extractScenarioName(requestData.pathname);
        
        this.emit('scenarioRequest', {
            action: 'stop',
            scenarioName,
            request: requestData
        });
        
        return {
            status: 200,
            body: {
                message: `Scenario stop endpoint for: ${scenarioName}`,
                scenarioName,
                status: 'stopped'
            }
        };
    }
    
    /**
     * 数据查询处理器
     */
    async handleDataQuery(requestData) {
        this.emit('dataRequest', {
            query: requestData.pathname,
            params: Object.fromEntries(requestData.searchParams),
            request: requestData
        });
        
        return {
            status: 200,
            body: {
                message: 'Data query endpoint - implement with DataReplayInfrastructure',
                query: requestData.pathname,
                params: Object.fromEntries(requestData.searchParams)
            }
        };
    }
    
    /**
     * 默认处理器
     */
    async handleDefault(requestData) {
        return {
            status: 404,
            body: {
                error: {
                    message: `Endpoint not found: ${requestData.method} ${requestData.pathname}`,
                    status: 404,
                    timestamp: new Date().toISOString()
                }
            }
        };
    }
    
    /**
     * 从路径提取场景名
     */
    extractScenarioName(pathname) {
        const parts = pathname.split('/');
        return parts[2] || 'unknown';
    }
    
    /**
     * 获取服务器统计
     */
    getStats() {
        return {
            ...this.stats,
            uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0,
            routes: Array.from(this.routeHandlers.keys()).length,
            middlewares: this.middlewares.length
        };
    }
    
    /**
     * 清理资源
     */
    async cleanup() {
        if (this.isRunning) {
            await this.stop();
        }
        
        this.routeHandlers.clear();
        this.middlewares.length = 0;
        this.removeAllListeners();
        
        console.log('🧹 Mock Server Core cleaned up');
    }
}