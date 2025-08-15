"use strict";
/**
 * Pipeline集成HTTP服务器
 *
 * 将Pipeline管理系统集成到HTTP服务器中，实现完整的请求处理流程
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineServer = void 0;
const http_server_1 = require("./http-server");
const pipeline_manager_1 = require("../pipeline/pipeline-manager");
const pipeline_factory_1 = require("../pipeline/pipeline-factory");
const module_registry_1 = require("../pipeline/module-registry");
const middleware_1 = require("../middleware");
const events_1 = require("events");
/**
 * Pipeline集成HTTP服务器
 * 使用组合而非继承的方式集成HTTPServer功能
 */
class PipelineServer extends events_1.EventEmitter {
    httpServer;
    pipelineManager;
    pipelineConfigs;
    serverConfig;
    constructor(config) {
        super();
        this.serverConfig = config;
        this.pipelineConfigs = config.pipelines || [];
        // 使用组合：创建HTTPServer实例
        this.httpServer = new http_server_1.HTTPServer(config);
        // 转发HTTPServer的事件到PipelineServer
        this.httpServer.on('error', (error) => this.emit('error', error));
        this.httpServer.on('started', (data) => this.emit('started', data));
        this.httpServer.on('stopped', () => this.emit('stopped'));
        // 初始化Pipeline管理器
        const moduleRegistry = new module_registry_1.ModuleRegistry();
        const factory = new pipeline_factory_1.StandardPipelineFactoryImpl(moduleRegistry);
        this.pipelineManager = new pipeline_manager_1.PipelineManager(factory);
        this.initializePipelineRoutes();
        this.initializeMiddleware();
    }
    /**
     * 初始化Pipeline相关路由
     */
    initializePipelineRoutes() {
        // Anthropic兼容端点 - 使用Pipeline处理
        this.httpServer.addRoute('POST', '/v1/messages', async (req, res) => {
            await this.handleAnthropicRequest(req, res);
        });
        // OpenAI兼容端点 - 使用Pipeline处理
        this.httpServer.addRoute('POST', '/v1/chat/completions', async (req, res) => {
            await this.handleOpenAIRequest(req, res);
        });
        // Gemini兼容端点 - 使用Pipeline处理
        this.httpServer.addRoute('POST', '/v1beta/models/:model/generateContent', async (req, res) => {
            await this.handleGeminiRequest(req, res);
        });
        // 统一Pipeline端点
        this.httpServer.addRoute('POST', '/v1/pipeline/:pipelineId', async (req, res) => {
            await this.handlePipelineRequest(req, res);
        });
        // Pipeline管理端点
        this.httpServer.addRoute('GET', '/v1/pipelines', async (req, res) => {
            await this.handleGetPipelines(req, res);
        });
        this.httpServer.addRoute('GET', '/v1/pipelines/:pipelineId/status', async (req, res) => {
            await this.handleGetPipelineStatus(req, res);
        });
        this.httpServer.addRoute('POST', '/v1/pipelines/:pipelineId/start', async (req, res) => {
            await this.handleStartPipeline(req, res);
        });
        this.httpServer.addRoute('POST', '/v1/pipelines/:pipelineId/stop', async (req, res) => {
            await this.handleStopPipeline(req, res);
        });
    }
    /**
     * 初始化中间件
     */
    initializeMiddleware() {
        // CORS中间件
        if (this.serverConfig.enableCors !== false) {
            this.httpServer.use((0, middleware_1.cors)({
                origin: true,
                credentials: true,
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
            }));
        }
        // 日志中间件
        this.httpServer.use((0, middleware_1.logger)({
            level: this.serverConfig.logLevel === 'debug' ? 2 : 1,
            format: 'detailed'
        }));
        // 认证中间件 (可选)
        if (this.serverConfig.enableAuth) {
            this.httpServer.use((0, middleware_1.authentication)({
                required: false,
                apiKeyHeader: 'Authorization'
            }));
        }
        // 请求验证中间件
        if (this.serverConfig.enableValidation !== false) {
            this.httpServer.use((0, middleware_1.validation)({
                maxBodySize: this.serverConfig.maxRequestSize || 10 * 1024 * 1024,
                validateContentType: true
            }));
        }
        // 速率限制中间件
        this.httpServer.use((0, middleware_1.rateLimit)({
            maxRequests: 1000,
            windowMs: 60000,
            message: 'Too many requests from this IP'
        }));
    }
    /**
     * 启动服务器并初始化所有Pipeline
     */
    async start() {
        // 先创建和启动所有Pipeline
        await this.initializePipelines();
        // 启动HTTP服务器
        await this.httpServer.start();
        // 设置Pipeline事件监听
        this.setupPipelineEventListeners();
        console.log(`🎯 Pipeline Server started with ${this.pipelineConfigs.length} pipelines`);
    }
    /**
     * 停止服务器并清理Pipeline资源
     */
    async stop() {
        // 停止所有Pipeline
        await this.cleanupPipelines();
        // 停止HTTP服务器
        await this.httpServer.stop();
        console.log('🛑 Pipeline Server stopped');
    }
    /**
     * 初始化所有Pipeline
     */
    async initializePipelines() {
        console.log(`🔧 Initializing ${this.pipelineConfigs.length} pipelines...`);
        for (const config of this.pipelineConfigs) {
            try {
                const pipelineId = await this.pipelineManager.createPipeline(config);
                const pipeline = this.pipelineManager.getPipeline(pipelineId);
                if (pipeline) {
                    await pipeline.start();
                    console.log(`✅ Pipeline ${config.name} (${pipelineId}) initialized successfully`);
                }
            }
            catch (error) {
                console.error(`❌ Failed to initialize pipeline ${config.name}:`, error);
                throw error;
            }
        }
    }
    /**
     * 清理所有Pipeline
     */
    async cleanupPipelines() {
        const pipelines = this.pipelineManager.getAllPipelines();
        for (const [pipelineId, pipeline] of pipelines) {
            try {
                await pipeline.stop();
                await this.pipelineManager.destroyPipeline(pipelineId);
                console.log(`🧹 Pipeline ${pipelineId} cleaned up`);
            }
            catch (error) {
                console.error(`❌ Failed to cleanup pipeline ${pipelineId}:`, error);
            }
        }
    }
    /**
     * 设置Pipeline事件监听
     */
    setupPipelineEventListeners() {
        this.pipelineManager.on('executionStarted', (data) => {
            if (this.serverConfig.debug) {
                console.log(`🏃 Pipeline execution started: ${data.pipelineId} (${data.executionId})`);
            }
        });
        this.pipelineManager.on('executionCompleted', (data) => {
            if (this.serverConfig.debug) {
                console.log(`✅ Pipeline execution completed: ${data.executionResult.executionId} in ${data.executionResult.performance.totalTime}ms`);
            }
        });
        this.pipelineManager.on('executionFailed', (data) => {
            console.error(`❌ Pipeline execution failed: ${data.executionResult.executionId}`, data.executionResult.error);
        });
    }
    /**
     * 处理Anthropic格式请求
     */
    async handleAnthropicRequest(req, res) {
        const requestBody = req.body;
        if (!requestBody || !requestBody.messages) {
            res.statusCode = 400;
            res.body = {
                error: 'Bad Request',
                message: 'Invalid request format. Expected Anthropic messages format.'
            };
            return;
        }
        // 查找合适的Anthropic Pipeline
        const pipeline = this.findPipelineByProtocol('anthropic', requestBody.model);
        if (!pipeline) {
            res.statusCode = 503;
            res.body = {
                error: 'Service Unavailable',
                message: 'No available Anthropic pipeline found'
            };
            return;
        }
        try {
            const executionContext = {
                requestId: req.id,
                priority: 'normal',
                debug: this.serverConfig.debug,
                metadata: {
                    protocol: 'anthropic',
                    model: requestBody.model,
                    clientInfo: req.headers['user-agent']
                }
            };
            const result = await this.pipelineManager.executePipeline(pipeline.getId(), requestBody, executionContext);
            res.body = result.result;
            res.headers['X-Pipeline-ID'] = pipeline.getId();
            res.headers['X-Execution-ID'] = result.executionId;
            res.headers['X-Processing-Time'] = `${result.performance.totalTime}ms`;
        }
        catch (error) {
            console.error('Anthropic request processing failed:', error);
            res.statusCode = 500;
            res.body = {
                error: 'Internal Server Error',
                message: 'Pipeline execution failed'
            };
        }
    }
    /**
     * 处理OpenAI格式请求
     */
    async handleOpenAIRequest(req, res) {
        const requestBody = req.body;
        if (!requestBody || !requestBody.messages) {
            res.statusCode = 400;
            res.body = {
                error: 'Bad Request',
                message: 'Invalid request format. Expected OpenAI chat completions format.'
            };
            return;
        }
        // 查找合适的OpenAI Pipeline
        const pipeline = this.findPipelineByProtocol('openai', requestBody.model);
        if (!pipeline) {
            res.statusCode = 503;
            res.body = {
                error: 'Service Unavailable',
                message: 'No available OpenAI pipeline found'
            };
            return;
        }
        try {
            const executionContext = {
                requestId: req.id,
                priority: 'normal',
                debug: this.serverConfig.debug,
                metadata: {
                    protocol: 'openai',
                    model: requestBody.model,
                    clientInfo: req.headers['user-agent']
                }
            };
            const result = await this.pipelineManager.executePipeline(pipeline.getId(), requestBody, executionContext);
            res.body = result.result;
            res.headers['X-Pipeline-ID'] = pipeline.getId();
            res.headers['X-Execution-ID'] = result.executionId;
            res.headers['X-Processing-Time'] = `${result.performance.totalTime}ms`;
        }
        catch (error) {
            console.error('OpenAI request processing failed:', error);
            res.statusCode = 500;
            res.body = {
                error: 'Internal Server Error',
                message: 'Pipeline execution failed'
            };
        }
    }
    /**
     * 处理Gemini格式请求
     */
    async handleGeminiRequest(req, res) {
        const requestBody = req.body;
        const model = this.extractPathParam(req.url, '/v1beta/models/:model/generateContent', 'model');
        if (!requestBody || !requestBody.contents) {
            res.statusCode = 400;
            res.body = {
                error: 'Bad Request',
                message: 'Invalid request format. Expected Gemini generateContent format.'
            };
            return;
        }
        if (!model) {
            res.statusCode = 400;
            res.body = {
                error: 'Bad Request',
                message: 'Model parameter is required'
            };
            return;
        }
        // 查找合适的Gemini Pipeline
        const pipeline = this.findPipelineByProtocol('gemini', model);
        if (!pipeline) {
            res.statusCode = 503;
            res.body = {
                error: 'Service Unavailable',
                message: 'No available Gemini pipeline found'
            };
            return;
        }
        try {
            const executionContext = {
                requestId: req.id,
                priority: 'normal',
                debug: this.serverConfig.debug,
                metadata: {
                    protocol: 'gemini',
                    model: model,
                    clientInfo: req.headers['user-agent']
                }
            };
            const result = await this.pipelineManager.executePipeline(pipeline.getId(), { ...requestBody, model }, executionContext);
            res.body = result.result;
            res.headers['X-Pipeline-ID'] = pipeline.getId();
            res.headers['X-Execution-ID'] = result.executionId;
            res.headers['X-Processing-Time'] = `${result.performance.totalTime}ms`;
        }
        catch (error) {
            console.error('Gemini request processing failed:', error);
            res.statusCode = 500;
            res.body = {
                error: 'Internal Server Error',
                message: 'Pipeline execution failed'
            };
        }
    }
    /**
     * 处理直接Pipeline请求
     */
    async handlePipelineRequest(req, res) {
        const pipelineId = this.extractPathParam(req.url, '/v1/pipeline/:pipelineId', 'pipelineId');
        if (!pipelineId) {
            res.statusCode = 400;
            res.body = {
                error: 'Bad Request',
                message: 'Pipeline ID is required'
            };
            return;
        }
        const pipeline = this.pipelineManager.getPipeline(pipelineId);
        if (!pipeline) {
            res.statusCode = 404;
            res.body = {
                error: 'Not Found',
                message: `Pipeline ${pipelineId} not found`
            };
            return;
        }
        try {
            const executionContext = {
                requestId: req.id,
                priority: 'normal',
                debug: this.serverConfig.debug,
                metadata: {
                    direct: true,
                    clientInfo: req.headers['user-agent']
                }
            };
            const result = await this.pipelineManager.executePipeline(pipelineId, req.body, executionContext);
            res.body = {
                success: true,
                executionId: result.executionId,
                result: result.result,
                performance: result.performance
            };
        }
        catch (error) {
            console.error('Direct pipeline request failed:', error);
            res.statusCode = 500;
            res.body = {
                error: 'Internal Server Error',
                message: 'Pipeline execution failed'
            };
        }
    }
    /**
     * 获取所有Pipeline状态
     */
    async handleGetPipelines(req, res) {
        const pipelineStatuses = this.pipelineManager.getAllPipelineStatus();
        res.body = {
            pipelines: pipelineStatuses,
            count: Object.keys(pipelineStatuses).length,
            server: this.getStatus()
        };
    }
    /**
     * 获取特定Pipeline状态
     */
    async handleGetPipelineStatus(req, res) {
        const pipelineId = this.extractPathParam(req.url, '/v1/pipelines/:pipelineId/status', 'pipelineId');
        if (!pipelineId) {
            res.statusCode = 400;
            res.body = {
                error: 'Bad Request',
                message: 'Pipeline ID is required'
            };
            return;
        }
        const status = this.pipelineManager.getPipelineStatus(pipelineId);
        if (!status) {
            res.statusCode = 404;
            res.body = {
                error: 'Not Found',
                message: `Pipeline ${pipelineId} not found`
            };
            return;
        }
        res.body = status;
    }
    /**
     * 启动Pipeline
     */
    async handleStartPipeline(req, res) {
        const pipelineId = this.extractPathParam(req.url, '/v1/pipelines/:pipelineId/start', 'pipelineId');
        if (!pipelineId) {
            res.statusCode = 400;
            res.body = {
                error: 'Bad Request',
                message: 'Pipeline ID is required'
            };
            return;
        }
        const pipeline = this.pipelineManager.getPipeline(pipelineId);
        if (!pipeline) {
            res.statusCode = 404;
            res.body = {
                error: 'Not Found',
                message: `Pipeline ${pipelineId} not found`
            };
            return;
        }
        try {
            await pipeline.start();
            res.body = {
                success: true,
                message: `Pipeline ${pipelineId} started successfully`
            };
        }
        catch (error) {
            res.statusCode = 500;
            res.body = {
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Failed to start pipeline'
            };
        }
    }
    /**
     * 停止Pipeline
     */
    async handleStopPipeline(req, res) {
        const pipelineId = this.extractPathParam(req.url, '/v1/pipelines/:pipelineId/stop', 'pipelineId');
        if (!pipelineId) {
            res.statusCode = 400;
            res.body = {
                error: 'Bad Request',
                message: 'Pipeline ID is required'
            };
            return;
        }
        const pipeline = this.pipelineManager.getPipeline(pipelineId);
        if (!pipeline) {
            res.statusCode = 404;
            res.body = {
                error: 'Not Found',
                message: `Pipeline ${pipelineId} not found`
            };
            return;
        }
        try {
            await pipeline.stop();
            res.body = {
                success: true,
                message: `Pipeline ${pipelineId} stopped successfully`
            };
        }
        catch (error) {
            res.statusCode = 500;
            res.body = {
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Failed to stop pipeline'
            };
        }
    }
    /**
     * 根据协议和模型查找Pipeline
     */
    findPipelineByProtocol(protocol, model) {
        const pipelines = this.pipelineManager.getAllPipelines();
        for (const [pipelineId, pipeline] of pipelines) {
            const status = pipeline.getStatus();
            if (status.status === 'running') {
                // 简单匹配逻辑，可以根据需要扩展
                const pipelineProvider = pipeline.provider;
                const pipelineModel = pipeline.model;
                if (protocol === 'anthropic' && pipelineProvider.includes('anthropic')) {
                    if (!model || pipelineModel.includes(model) || model.includes(pipelineModel)) {
                        return pipeline;
                    }
                }
                else if (protocol === 'openai' && pipelineProvider.includes('openai')) {
                    if (!model || pipelineModel.includes(model) || model.includes(pipelineModel)) {
                        return pipeline;
                    }
                }
                else if (protocol === 'gemini' && pipelineProvider.includes('gemini')) {
                    if (!model || pipelineModel.includes(model) || model.includes(pipelineModel)) {
                        return pipeline;
                    }
                }
            }
        }
        return null;
    }
    /**
     * 提取路径参数
     */
    extractPathParam(url, pattern, paramName) {
        // 简单实现，去除查询参数
        const cleanUrl = url?.split('?')[0];
        if (!cleanUrl) {
            return null;
        }
        // 转换pattern为正则表达式
        const regexPattern = pattern.replace(/:([^/]+)/g, '([^/]+)');
        const regex = new RegExp(`^${regexPattern}$`);
        const match = cleanUrl.match(regex);
        if (match) {
            // 查找参数位置
            const paramIndex = pattern.split('/').findIndex(part => part === `:${paramName}`);
            if (paramIndex > 0 && match[paramIndex]) {
                return match[paramIndex];
            }
        }
        return null;
    }
    /**
     * 获取Pipeline管理器
     */
    getPipelineManager() {
        return this.pipelineManager;
    }
    /**
     * 获取Pipeline配置
     */
    getPipelineConfigs() {
        return [...this.pipelineConfigs];
    }
    /**
     * 获取服务器状态
     * 委托给HTTPServer并添加Pipeline相关信息
     */
    getStatus() {
        const httpStatus = this.httpServer.getStatus();
        const pipelineStatuses = this.pipelineManager.getAllPipelineStatus();
        return {
            ...httpStatus,
            activePipelines: Object.keys(pipelineStatuses).length,
            pipelines: pipelineStatuses
        };
    }
    /**
     * 添加中间件 - 委托给HTTPServer
     */
    use(middleware) {
        this.httpServer.use(middleware);
    }
    /**
     * 添加路由 - 委托给HTTPServer
     */
    addRoute(method, path, handler, middleware) {
        this.httpServer.addRoute(method, path, handler, middleware);
    }
}
exports.PipelineServer = PipelineServer;
//# sourceMappingURL=pipeline-server.js.map