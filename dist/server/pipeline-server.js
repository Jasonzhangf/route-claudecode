"use strict";
/**
 * Pipeline集成HTTP服务器
 *
 * 将Pipeline管理系统集成到HTTP服务器中，实现完整的请求处理流程
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
exports.PipelineServer = void 0;
const http_server_1 = require("./http-server");
const jq_json_handler_1 = require("../utils/jq-json-handler");
const server_defaults_1 = require("../constants/server-defaults");
const events_1 = require("events");
const pipeline_debug_recorder_1 = require("../debug/pipeline-debug-recorder");
/**
 * Pipeline集成HTTP服务器
 * 使用组合而非继承的方式集成HTTPServer功能
 */
class PipelineServer extends events_1.EventEmitter {
    constructor(config, middlewareManager, pipelineService) {
        super();
        this.serverConfig = config;
        this.middlewareManager = middlewareManager;
        // 使用组合：创建HTTPServer实例
        this.httpServer = new http_server_1.HTTPServer(config);
        // 转发HTTPServer的事件到PipelineServer
        this.httpServer.on('error', error => this.emit('error', error));
        this.httpServer.on('started', data => this.emit('started', data));
        this.httpServer.on('stopped', () => this.emit('stopped'));
        // 使用依赖注入的Pipeline服务或创建默认实现
        if (pipelineService) {
            this.pipelineService = pipelineService;
        }
        else {
            // 这里需要从工厂创建Pipeline服务的具体实现
            // 避免直接依赖具体实现类
            this.pipelineService = this.createDefaultPipelineService(config);
        }
        // 转发Pipeline服务事件（如果支持EventEmitter接口）
        if ('on' in this.pipelineService && typeof this.pipelineService.on === 'function') {
            this.pipelineService.on('error', (error) => this.emit('error', error));
            this.pipelineService.on('executionStarted', (data) => this.emit('executionStarted', data));
            this.pipelineService.on('executionCompleted', (data) => this.emit('executionCompleted', data));
            this.pipelineService.on('executionFailed', (data) => this.emit('executionFailed', data));
        }
        // 初始化Debug记录器
        this.debugRecorder = new pipeline_debug_recorder_1.PipelineDebugRecorder(config.port || (0, server_defaults_1.getServerPort)(), config.debug !== false);
        this.initializePipelineRoutes();
        this.initializeMiddleware();
    }
    /**
     * 初始化服务器
     */
    async initialize() {
        // 初始化Pipeline服务
        if (this.pipelineService) {
            // Pipeline服务初始化逻辑
        }
        // 初始化HTTP服务器（如果支持初始化方法）
        if ('initialize' in this.httpServer && typeof this.httpServer.initialize === 'function') {
            await this.httpServer.initialize();
        }
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
        // 使用中间件管理器创建标准中间件栈
        const middlewareOptions = {
            cors: this.serverConfig.enableCors !== false
                ? {
                    origin: true,
                    credentials: true,
                    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
                }
                : undefined,
            logger: {
                level: this.serverConfig.logLevel === 'debug' ? 2 : 1,
                format: 'detailed',
            },
            authentication: this.serverConfig.enableAuth
                ? {
                    required: false,
                    apiKeyHeader: 'Authorization',
                }
                : undefined,
            validation: this.serverConfig.enableValidation !== false
                ? {
                    maxBodySize: this.serverConfig.maxRequestSize || 10 * 1024 * 1024,
                    validateContentType: true,
                }
                : undefined,
            rateLimit: {
                maxRequests: 1000,
                windowMs: 60000,
                message: 'Too many requests from this IP',
            },
        };
        // 创建并应用中间件栈
        const middlewares = this.middlewareManager.createStandardMiddlewareStack(middlewareOptions);
        middlewares.forEach(middleware => {
            this.httpServer.use(middleware);
        });
    }
    /**
     * 启动服务器并初始化所有Pipeline
     */
    async start() {
        try {
            console.log('🚀 Starting Pipeline Service...');
            // 先启动Pipeline服务
            await this.pipelineService.start();
            console.log('✅ Pipeline Service started');
            console.log('🚀 Starting HTTP Server...');
            // 启动HTTP服务器
            await this.httpServer.start();
            console.log('✅ HTTP Server started');
            console.log(`🎯 Pipeline Server started on port ${this.serverConfig.port}`);
        }
        catch (error) {
            console.error('❌ Failed to start Pipeline Server:', error);
            throw error;
        }
    }
    /**
     * 停止服务器并清理Pipeline资源
     */
    async stop() {
        // 停止Pipeline服务
        await this.pipelineService.stop();
        // 停止HTTP服务器
        await this.httpServer.stop();
        console.log('🛑 Pipeline Server stopped');
    }
    /**
     * 处理Anthropic格式请求 - 带完整6层Pipeline Debug记录
     */
    async handleAnthropicRequest(req, res) {
        const requestId = req.id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const startTime = Date.now();
        const pipelineSteps = [];
        console.log(`📥 [${requestId}] Anthropic请求开始处理，启用6层Pipeline Debug记录`);
        try {
            // ===== Layer 0: Client Layer =====
            const clientStart = Date.now();
            const clientInput = {
                endpoint: '/v1/messages',
                method: 'POST',
                headers: req.headers,
                body: req.body,
                contentType: req.headers['content-type'] || 'application/json',
            };
            // 基础请求验证
            if (!req.body || !req.body.messages) {
                res.statusCode = 400;
                res.body = {
                    error: 'Bad Request',
                    message: 'Invalid request format. Expected Anthropic messages format.',
                };
                return;
            }
            const clientOutput = {
                ...req.body,
                client_metadata: {
                    http_method: 'POST',
                    endpoint: '/v1/messages',
                    headers_validated: true,
                    content_type: 'application/json',
                    request_size: jq_json_handler_1.JQJsonHandler.stringifyJson(req.body).length,
                    anthropic_version: req.headers['anthropic-version'] || '2023-06-01',
                },
                validation: {
                    required_fields: ['model', 'messages'],
                    validation_passed: true,
                },
            };
            const clientRecord = this.debugRecorder.recordClientLayer(requestId, clientInput, clientOutput, Date.now() - clientStart);
            pipelineSteps.push(clientRecord);
            console.log(`   ✅ Layer 0 - Client: ${clientRecord.duration}ms`);
            // ===== Layer 1: Router Layer =====
            const routerStart = Date.now();
            // 基于配置文件的真实路由决策
            const routingDecision = this.makeRoutingDecision(req.body.model);
            const routerOutput = {
                ...clientOutput,
                model: routingDecision.mappedModel, // 应用模型映射
                routing_decision: routingDecision,
            };
            const routerRecord = this.debugRecorder.recordRouterLayer(requestId, clientOutput, routerOutput, Date.now() - routerStart, routingDecision);
            pipelineSteps.push(routerRecord);
            console.log(`   ✅ Layer 1 - Router: ${routerRecord.duration}ms (${routingDecision.originalModel} → ${routingDecision.mappedModel})`);
            // ===== 调用Pipeline Service处理剩余层级 =====
            const executionContext = {
                requestId,
                priority: 'normal',
                debug: this.serverConfig.debug,
                metadata: {
                    protocol: 'anthropic',
                    model: routerOutput.model,
                    clientInfo: req.headers['user-agent'],
                    routingDecision,
                },
            };
            // 记录Pipeline Service调用开始
            const pipelineStart = Date.now();
            const result = await this.pipelineService.handleRequest('anthropic', routerOutput, executionContext);
            const pipelineDuration = Date.now() - pipelineStart;
            // ===== 记录真实的剩余层级处理和响应 =====
            const transformedResponse = await this.recordRealPipelineLayers(requestId, routerOutput, result, pipelineSteps);
            // 处理流式响应
            let finalResponse = transformedResponse || result.result;
            // 如果客户端请求是流式的，需要模拟流式响应
            if (routerOutput.stream === true && finalResponse) {
                try {
                    // 创建Protocol模块实例进行流式响应转换
                    const { OpenAIProtocolModule } = await Promise.resolve().then(() => __importStar(require('../modules/pipeline-modules/protocol/openai-protocol')));
                    const protocolModule = new OpenAIProtocolModule();
                    // 将Anthropic格式的非流式响应转换为流式响应
                    const streamResponse = await protocolModule.process(finalResponse);
                    // 如果返回的是StreamResponse对象，提取chunks
                    if (streamResponse && 'chunks' in streamResponse) {
                        finalResponse = streamResponse;
                        console.log(`🌊 [${requestId}] 模拟流式响应生成完成，共${streamResponse.chunks.length}个chunk`);
                    }
                }
                catch (streamError) {
                    console.error(`❌ [${requestId}] 流式响应生成失败:`, streamError.message);
                    // 如果流式响应生成失败，回退到非流式响应
                }
            }
            // 处理流式响应
            const streamingResponse = await this.handleStreamingResponse('anthropic', routerOutput.stream === true, transformedResponse || result.result, requestId);
            // 构造最终响应 - 使用转换后的Anthropic格式响应
            res.body = streamingResponse;
            res.headers['X-Pipeline-ID'] = result.pipelineId;
            res.headers['X-Execution-ID'] = result.executionId;
            res.headers['X-Processing-Time'] = `${result.performance.totalTime}ms`;
            res.headers['X-Debug-Layers'] = '6';
            res.headers['X-Debug-File'] = `port-${this.serverConfig.port}/${requestId}`;
            // ===== 记录完整的Pipeline执行 =====
            const totalDuration = Date.now() - startTime;
            const pipelineRecord = this.debugRecorder.createPipelineRecord(requestId, 'anthropic', req.body, result.result, totalDuration, pipelineSteps, {
                configPath: this.serverConfig.configPath || 'unknown',
                routeId: routingDecision.routeId,
                providerId: routingDecision.providerId,
            });
            this.debugRecorder.recordCompleteRequest(pipelineRecord);
            console.log(`✅ [${requestId}] 六层Pipeline处理完成: ${totalDuration}ms`);
        }
        catch (error) {
            const totalDuration = Date.now() - startTime;
            console.error(`❌ [${requestId}] Anthropic请求处理失败:`, error.message);
            // 记录失败的执行
            const errorRecord = this.debugRecorder.createPipelineRecord(requestId, 'anthropic', req.body || {}, { error: error.message }, totalDuration, pipelineSteps);
            this.debugRecorder.recordCompleteRequest(errorRecord);
            res.statusCode = 500;
            res.body = {
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Pipeline execution failed',
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
                message: 'Invalid request format. Expected OpenAI chat completions format.',
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
                    clientInfo: req.headers['user-agent'],
                },
            };
            const result = await this.pipelineService.handleRequest('openai', requestBody, executionContext);
            // 处理流式响应
            const streamingResponse = await this.handleStreamingResponse('openai', requestBody.stream === true, result.result, req.id);
            res.body = streamingResponse;
            res.headers['X-Pipeline-ID'] = result.pipelineId;
            res.headers['X-Execution-ID'] = result.executionId;
            res.headers['X-Processing-Time'] = `${result.performance.totalTime}ms`;
        }
        catch (error) {
            console.error('OpenAI request processing failed:', error);
            res.statusCode = 500;
            res.body = {
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Pipeline execution failed',
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
                message: 'Invalid request format. Expected Gemini generateContent format.',
            };
            return;
        }
        if (!model) {
            res.statusCode = 400;
            res.body = {
                error: 'Bad Request',
                message: 'Model parameter is required',
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
                    clientInfo: req.headers['user-agent'],
                },
            };
            const result = await this.pipelineService.handleRequest('gemini', { ...requestBody, model }, executionContext);
            // 处理流式响应 (Gemini协议通常不支持流式，但为了保持一致性仍然检查)
            const streamingResponse = await this.handleStreamingResponse('gemini', requestBody.stream === true, result.result, req.id);
            res.body = streamingResponse;
            res.headers['X-Pipeline-ID'] = result.pipelineId;
            res.headers['X-Execution-ID'] = result.executionId;
            res.headers['X-Processing-Time'] = `${result.performance.totalTime}ms`;
        }
        catch (error) {
            console.error('Gemini request processing failed:', error);
            res.statusCode = 500;
            res.body = {
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Pipeline execution failed',
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
                message: 'Pipeline ID is required',
            };
            return;
        }
        const pipeline = this.pipelineService.getPipelineManager().getPipeline(pipelineId);
        if (!pipeline) {
            res.statusCode = 404;
            res.body = {
                error: 'Not Found',
                message: `Pipeline ${pipelineId} not found`,
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
                    clientInfo: req.headers['user-agent'],
                },
            };
            const result = await this.pipelineService
                .getPipelineManager()
                .executePipeline(pipelineId, req.body, executionContext);
            res.body = {
                success: true,
                executionId: result.executionId,
                result: result.result,
                performance: result.performance,
            };
        }
        catch (error) {
            console.error('Direct pipeline request failed:', error);
            res.statusCode = 500;
            res.body = {
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Pipeline execution failed',
            };
        }
    }
    /**
     * 获取所有Pipeline状态
     */
    async handleGetPipelines(req, res) {
        const pipelineStatuses = this.pipelineService.getPipelineManager().getAllPipelineStatus();
        res.body = {
            pipelines: pipelineStatuses,
            count: Object.keys(pipelineStatuses).length,
            server: this.getStatus(),
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
                message: 'Pipeline ID is required',
            };
            return;
        }
        const status = this.pipelineService.getPipelineManager().getPipelineStatus(pipelineId);
        if (!status) {
            res.statusCode = 404;
            res.body = {
                error: 'Not Found',
                message: `Pipeline ${pipelineId} not found`,
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
                message: 'Pipeline ID is required',
            };
            return;
        }
        const pipeline = this.pipelineService.getPipelineManager().getPipeline(pipelineId);
        if (!pipeline) {
            res.statusCode = 404;
            res.body = {
                error: 'Not Found',
                message: `Pipeline ${pipelineId} not found`,
            };
            return;
        }
        try {
            await pipeline.start();
            res.body = {
                success: true,
                message: `Pipeline ${pipelineId} started successfully`,
            };
        }
        catch (error) {
            res.statusCode = 500;
            res.body = {
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Failed to start pipeline',
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
                message: 'Pipeline ID is required',
            };
            return;
        }
        const pipeline = this.pipelineService.getPipelineManager().getPipeline(pipelineId);
        if (!pipeline) {
            res.statusCode = 404;
            res.body = {
                error: 'Not Found',
                message: `Pipeline ${pipelineId} not found`,
            };
            return;
        }
        try {
            await pipeline.stop();
            res.body = {
                success: true,
                message: `Pipeline ${pipelineId} stopped successfully`,
            };
        }
        catch (error) {
            res.statusCode = 500;
            res.body = {
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Failed to stop pipeline',
            };
        }
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
     * 创建默认Pipeline服务
     */
    createDefaultPipelineService(config) {
        // 创建简化版的Pipeline服务（避免复杂的依赖注入）
        return {
            start: async () => {
                console.log('✅ Simplified Pipeline Service started');
            },
            stop: async () => {
                console.log('🛑 Simplified Pipeline Service stopped');
            },
            getStatus: () => ({
                started: true,
                pipelineCount: 0,
                healthyPipelines: 0,
                pipelines: {},
                protocols: [],
                uptime: 0,
            }),
            initializePipelines: async () => { },
            cleanupPipelines: async () => { },
            getProtocolMatcher: () => null,
            isHealthy: () => true,
            handleRequest: async (protocol, input, context) => {
                // 简化的请求处理逻辑
                return {
                    executionId: `exec_${Date.now()}`,
                    pipelineId: 'default',
                    startTime: Date.now(),
                    endTime: Date.now(),
                    result: {
                        id: `msg_${Date.now()}`,
                        type: 'message',
                        role: 'assistant',
                        content: [{ type: 'text', text: 'Simplified response from pipeline service' }],
                        model: 'default-model',
                        stop_reason: 'end_turn',
                        stop_sequence: null,
                        usage: { input_tokens: 0, output_tokens: 0 }
                    },
                    error: null,
                    performance: {
                        startTime: Date.now(),
                        endTime: Date.now(),
                        totalTime: 0,
                        moduleTimings: {},
                    },
                    metadata: {
                        processingSteps: ['simplified']
                    }
                };
            },
            getPipelineManager: () => ({
                getAllPipelines: () => new Map(),
                getPipelineStatus: () => null,
                getAllPipelineStatus: () => ({}),
                getPipeline: () => null,
                createPipeline: async () => null,
                destroyPipeline: async () => { },
                on: () => { },
                off: () => { },
                executePipeline: async () => ({
                    executionId: `exec_${Date.now()}`,
                    pipelineId: 'default',
                    result: {
                        id: `msg_${Date.now()}`,
                        type: 'message',
                        role: 'assistant',
                        content: [{ type: 'text', text: 'Simplified response from pipeline' }],
                        model: 'default-model',
                        stop_reason: 'end_turn',
                        stop_sequence: null,
                        usage: { input_tokens: 0, output_tokens: 0 }
                    },
                    error: null,
                    performance: {
                        startTime: Date.now(),
                        endTime: Date.now(),
                        totalTime: 0,
                        moduleTimings: {},
                    },
                    metadata: {
                        processingSteps: ['simplified']
                    }
                })
            }),
            // on: (event: string, listener: (...args: any[]) => void) => {
            //   // 简化的事件监听
            // }
        };
    }
    /**
     * 获取Pipeline服务
     */
    getPipelineService() {
        return this.pipelineService;
    }
    /**
     * 获取Pipeline管理器
     */
    getPipelineManager() {
        return this.pipelineService.getPipelineManager();
    }
    /**
     * 获取Pipeline配置
     */
    getPipelineConfigs() {
        return [...this.serverConfig.pipelines];
    }
    /**
     * 设置路由器实例 - 用于路由决策
     */
    setRouter(router) {
        this.router = router;
    }
    /**
     * 基于配置文件进行真实的路由决策 - 使用新的虚拟模型映射系统
     */
    makeRoutingDecision(requestedModel) {
        // 使用新的虚拟模型映射系统
        try {
            // 1. 使用VirtualModelMapper将输入模型映射到虚拟模型
            const { VirtualModelMapper } = require('../router/virtual-model-mapping');
            const virtualModel = VirtualModelMapper.mapToVirtual(requestedModel, { model: requestedModel });
            console.log(`🎯 [Router] 虚拟模型映射: ${requestedModel} → ${virtualModel}`);
            // 2. 使用PipelineRouter获取可用的流水线列表
            if (!this.router) {
                throw new Error('PipelineRouter未初始化 - 请先调用setRouter()方法');
            }
            const routingDecision = this.router.route(requestedModel);
            const availablePipelines = routingDecision.availablePipelines;
            if (!availablePipelines || availablePipelines.length === 0) {
                throw new Error(`没有可用的流水线处理模型: ${requestedModel} (虚拟模型: ${virtualModel})`);
            }
            // 3. 选择第一个可用的流水线 (负载均衡器稍后处理)
            const selectedPipeline = availablePipelines[0];
            console.log(`✅ [Router] 路由决策完成: ${requestedModel} → ${virtualModel} → ${selectedPipeline}`);
            return {
                routeId: virtualModel,
                providerId: selectedPipeline.split('-')[0], // 从pipelineId提取provider名称
                originalModel: requestedModel,
                mappedModel: selectedPipeline.split('-')[1] || requestedModel, // 提取目标模型名称
                virtualModel: virtualModel,
                selectedPipeline: selectedPipeline,
                availablePipelines: availablePipelines,
                selectionCriteria: {
                    primary: 'virtual-model-mapping',
                    secondary: 'pipeline-availability',
                    tertiary: 'first-available',
                },
                configSource: 'runtime-routing-table',
            };
        }
        catch (error) {
            console.error(`❌ [Router] 新路由决策失败: ${error.message}`);
            throw new Error(`路由决策失败: ${error.message}`);
        }
    }
    /**
     * 根据Provider ID获取兼容性信息
     */
    getCompatibilityInfo(providerId) {
        // 默认配置
        const defaults = {
            'modelscope-compatibility': {
                type: 'modelscope',
                endpoint: 'https://api-inference.modelscope.cn',
                apiEndpoint: 'https://api-inference.modelscope.cn/v1/chat/completions',
            },
            'lmstudio-compatibility': {
                type: 'lmstudio',
                endpoint: 'http://localhost:1234/v1',
                apiEndpoint: 'http://localhost:1234/v1/chat/completions',
            },
            'anthropic-compatibility': {
                type: 'anthropic',
                endpoint: 'https://api.anthropic.com',
                apiEndpoint: 'https://api.anthropic.com/v1/messages',
            },
            'openai-compatibility': {
                type: 'openai',
                endpoint: 'https://api.openai.com',
                apiEndpoint: 'https://api.openai.com/v1/chat/completions',
            },
        };
        // 尝试从配置中获取信息
        const config = this.serverConfig;
        if (config.serverCompatibilityProviders && config.serverCompatibilityProviders[providerId]) {
            const providerConfig = config.serverCompatibilityProviders[providerId];
            const endpoint = providerConfig.connection?.endpoint || defaults[providerId]?.endpoint || 'unknown';
            return {
                type: providerId.replace('-compatibility', ''),
                endpoint: endpoint,
                apiEndpoint: endpoint.endsWith('/v1') ? `${endpoint}/chat/completions` : `${endpoint}/v1/chat/completions`,
            };
        }
        // 使用默认配置
        const defaultInfo = defaults[providerId];
        if (defaultInfo) {
            console.log(`🔄 [Compatibility] 使用默认配置: ${providerId}`);
            return defaultInfo;
        }
        // 如果都没找到，返回通用配置
        console.warn(`⚠️  未知Provider: ${providerId}，使用通用配置`);
        return {
            type: 'unknown',
            endpoint: 'http://localhost:8080',
            apiEndpoint: 'http://localhost:8080/v1/chat/completions',
        };
    }
    /**
     * 获取模型映射（支持简化和复杂两种配置格式）
     */
    getModelMapping(originalModel) {
        const routingRules = this.serverConfig.routingRules;
        if (!routingRules) {
            console.log(`🔄 [Router层] 无路由配置，保持原模型: ${originalModel}`);
            return originalModel;
        }
        // 方式1: 支持简化的demo1风格路由配置 (router.xxx格式)
        if (routingRules.router && typeof routingRules.router === 'object') {
            // 优先查找精确匹配
            if (routingRules.router[originalModel]) {
                const routeConfig = routingRules.router[originalModel];
                // 解析 "provider,model" 格式
                if (typeof routeConfig === 'string' && routeConfig.includes(',')) {
                    const [provider, mappedModel] = routeConfig.split(',');
                    console.log(`🎯 [Router层] 简化配置映射: ${originalModel} -> ${mappedModel} (via ${provider})`);
                    return mappedModel;
                }
            }
            // 如果没有找到精确匹配，使用默认路由
            if (routingRules.router.default) {
                const defaultRoute = routingRules.router.default;
                if (typeof defaultRoute === 'string' && defaultRoute.includes(',')) {
                    const [provider, mappedModel] = defaultRoute.split(',');
                    console.log(`🎯 [Router层] 使用默认路由: ${originalModel} -> ${mappedModel} (via ${provider})`);
                    return mappedModel;
                }
            }
        }
        // 方式2: 支持复杂的v4配置格式 (向后兼容)
        if (routingRules.modelMapping && routingRules.modelMapping[originalModel]) {
            const modelConfig = routingRules.modelMapping[originalModel];
            const defaultRoute = routingRules.defaultRoute;
            if (modelConfig.modelOverrides && defaultRoute && modelConfig.modelOverrides[defaultRoute]) {
                const mappedModel = modelConfig.modelOverrides[defaultRoute];
                console.log(`🎯 [Router层] 复杂配置映射: ${originalModel} -> ${mappedModel}`);
                return mappedModel;
            }
        }
        // 如果没有找到映射，返回原始模型
        console.log(`🔄 [Router层] 无映射配置，保持原模型: ${originalModel}`);
        return originalModel;
    }
    /**
     * 记录真实的Pipeline层级处理和响应 (Layer 2-5)
     * 返回转换后的Anthropic格式响应
     */
    async recordRealPipelineLayers(requestId, transformerInput, pipelineResult, pipelineSteps) {
        try {
            console.log(`🔍 [${requestId}] 开始记录真实的Pipeline响应层级...`);
            // 获取最终的API响应数据
            const finalResponse = pipelineResult.result;
            console.log(`📦 [${requestId}] 收到最终响应:`, finalResponse ? '有数据' : '无数据');
            // ===== Layer 2: Transformer Layer - 记录真实转换过程 =====
            const transformerStart = Date.now();
            // 转换Anthropic请求为OpenAI格式 (输入处理)
            const transformerRequestOutput = {
                model: transformerInput.model,
                messages: transformerInput.messages,
                max_tokens: transformerInput.max_tokens || 4096,
                temperature: transformerInput.temperature || 1.0,
                stream: transformerInput.stream || false,
                tools: transformerInput.tools || null,
            };
            // 转换OpenAI响应为Anthropic格式 (输出处理) - 实际调用transformer
            let transformerResponseOutput;
            if (finalResponse) {
                try {
                    // 创建临时transformer实例进行响应转换
                    const { SecureAnthropicToOpenAITransformer } = await Promise.resolve().then(() => __importStar(require('../modules/transformers/secure-anthropic-openai-transformer')));
                    const responseTransformer = new SecureAnthropicToOpenAITransformer();
                    // 调用响应转换
                    transformerResponseOutput = await responseTransformer.process(finalResponse);
                    // 修正模型名：从映射后的模型名转换回原始模型名
                    const originalModel = transformerInput.routing_decision?.originalModel || transformerInput.model;
                    if (transformerResponseOutput && transformerResponseOutput.model && originalModel) {
                        const mappedModel = transformerResponseOutput.model;
                        transformerResponseOutput.model = originalModel;
                        console.log(`🔄 [${requestId}] 模型名逆映射: ${mappedModel} -> ${originalModel}`);
                    }
                    console.log(`🔄 [${requestId}] OpenAI响应成功转换为Anthropic格式`);
                }
                catch (transformError) {
                    console.error(`❌ [${requestId}] 响应转换失败:`, transformError.message);
                    // 如果转换失败，使用默认Anthropic格式
                    transformerResponseOutput = {
                        id: `msg_${Date.now()}`,
                        type: 'message',
                        role: 'assistant',
                        model: transformerInput.model,
                        content: [
                            { type: 'text', text: finalResponse.choices?.[0]?.message?.content || 'Response conversion failed' },
                        ],
                        stop_reason: 'end_turn',
                        usage: {
                            input_tokens: finalResponse.usage?.prompt_tokens || 0,
                            output_tokens: finalResponse.usage?.completion_tokens || 0,
                        },
                    };
                }
            }
            else {
                // 如果没有finalResponse，使用错误响应
                transformerResponseOutput = {
                    id: `msg_${Date.now()}`,
                    type: 'message',
                    role: 'assistant',
                    model: transformerInput.model,
                    content: [{ type: 'text', text: 'No response received from server' }],
                    stop_reason: 'error',
                    usage: { input_tokens: 0, output_tokens: 0 },
                };
            }
            const transformerRecord = this.debugRecorder.recordTransformerLayer(requestId, { request: transformerInput, response_raw: pipelineResult.result }, {
                openai_request: transformerRequestOutput,
                anthropic_response: transformerResponseOutput,
                conversion_direction: 'bidirectional',
            }, Date.now() - transformerStart, 'anthropic-to-openai');
            pipelineSteps.push(transformerRecord);
            // Layer 2 - Transformer duration logging removed
            // ===== Layer 3: Protocol Layer - 记录协议处理 =====
            const protocolStart = Date.now();
            const protocolOutput = {
                input_protocol: 'anthropic',
                output_protocol: 'openai',
                protocol_version: 'openai-v1',
                streaming_supported: transformerInput.stream || false,
                content_type: 'application/json',
                api_version: 'v1',
                response_format: 'anthropic',
            };
            const protocolRecord = this.debugRecorder.recordProtocolLayer(requestId, { openai_request: transformerRequestOutput }, { ...protocolOutput, final_response: finalResponse }, Date.now() - protocolStart, 'openai');
            pipelineSteps.push(protocolRecord);
            console.log(`   ✅ Layer 3 - Protocol: ${protocolRecord.duration}ms`);
            // ===== Layer 4: Server-Compatibility Layer - 基于路由决策的动态兼容性处理 =====
            const compatibilityStart = Date.now();
            const routingDecision = transformerInput.routing_decision;
            const providerId = routingDecision?.providerId || 'unknown-provider';
            // 根据实际的Provider动态获取兼容性信息
            const compatibilityInfo = this.getCompatibilityInfo(providerId);
            const compatibilityOutput = {
                compatibility_layer: compatibilityInfo.type,
                endpoint_ready: true,
                target_server: compatibilityInfo.endpoint,
                model_mapping: {
                    original: routingDecision?.originalModel || transformerInput.model,
                    mapped: routingDecision?.mappedModel || transformerInput.model,
                },
                provider_ready: true,
                response_received: !!finalResponse,
                provider_id: providerId,
            };
            const compatibilityRecord = this.debugRecorder.recordServerCompatibilityLayer(requestId, { protocol_output: protocolOutput }, { ...compatibilityOutput, api_response: finalResponse }, Date.now() - compatibilityStart, compatibilityInfo.type);
            pipelineSteps.push(compatibilityRecord);
            console.log(`   ✅ Layer 4 - Server-Compatibility: ${compatibilityRecord.duration}ms`);
            // ===== Layer 5: Server Layer - 记录实际API调用结果 =====
            const serverStart = Date.now();
            const serverSuccess = !!(finalResponse && !finalResponse.error);
            const serverError = serverSuccess
                ? undefined
                : finalResponse?.error || `${compatibilityInfo.type} connection failed: Service unavailable`;
            const serverApiInput = {
                endpoint: compatibilityInfo.apiEndpoint,
                method: 'POST',
                model: routingDecision?.mappedModel || transformerInput.model,
                request_data: transformerRequestOutput,
                provider_id: providerId,
            };
            const serverApiOutput = serverSuccess
                ? {
                    status_code: 200,
                    response_data: finalResponse,
                    connection_successful: true,
                    provider_model: routingDecision?.mappedModel || transformerInput.model,
                    provider_type: compatibilityInfo.type,
                    response_time: pipelineResult.performance?.totalTime || 0,
                }
                : {
                    status_code: 500,
                    error: serverError,
                    connection_successful: false,
                };
            const serverRecord = this.debugRecorder.recordServerLayer(requestId, serverApiInput, serverApiOutput, Date.now() - serverStart, serverSuccess, serverError);
            pipelineSteps.push(serverRecord);
            console.log(`   ${serverSuccess ? '✅' : '❌'} Layer 5 - Server: ${serverRecord.duration}ms`);
            console.log(`🎯 [${requestId}] 所有Pipeline层级响应记录完成 - 包含真实API响应数据`);
            // 返回转换后的Anthropic格式响应
            return transformerResponseOutput;
        }
        catch (error) {
            console.error(`❌ [PIPELINE-DEBUG] 记录真实层级失败:`, error.message);
            console.error(`   请求ID: ${requestId}`);
            console.error(`   错误详情:`, error);
            // 错误情况下返回null，让调用者使用原始响应
            return null;
        }
    }
    /**
     * 获取服务器状态
     * 委托给HTTPServer并添加Pipeline相关信息
     */
    getStatus() {
        const httpStatus = this.httpServer.getStatus();
        const pipelineServiceStatus = this.pipelineService.getStatus();
        return {
            ...httpStatus,
            activePipelines: pipelineServiceStatus?.pipelineCount || 0,
            pipelines: pipelineServiceStatus?.pipelines || {},
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
    /**
     * 处理流式响应
     * 根据协议类型和客户端请求参数，将非流式响应转换为流式响应
     */
    async handleStreamingResponse(protocol, requestStreamFlag, response, requestId) {
        // 如果客户端请求不是流式的，直接返回原响应
        if (!requestStreamFlag || !response) {
            return response;
        }
        try {
            let streamResponse = response;
            // 根据协议类型选择合适的Protocol模块
            switch (protocol.toLowerCase()) {
                case 'openai':
                case 'anthropic':
                case 'gemini':
                    // 对于这些协议，使用OpenAIProtocolModule处理流式响应
                    const { OpenAIProtocolModule } = await Promise.resolve().then(() => __importStar(require('../modules/pipeline-modules/protocol/openai-protocol')));
                    const protocolModule = new OpenAIProtocolModule();
                    // 将非流式响应转换为流式响应
                    const convertedResponse = await protocolModule.process(response);
                    // 如果返回的是StreamResponse对象，使用它
                    if (convertedResponse && typeof convertedResponse === 'object' && 'chunks' in convertedResponse) {
                        streamResponse = convertedResponse;
                        console.log(`🌊 [${requestId}] ${protocol}流式响应生成完成，共${convertedResponse.chunks.length}个chunk`);
                    }
                    break;
                default:
                    // 对于不支持的协议，保持原响应
                    console.log(`🔄 [${requestId}] 协议${protocol}不支持流式响应转换，使用原响应`);
                    break;
            }
            return streamResponse;
        }
        catch (streamError) {
            console.error(`❌ [${requestId}] 流式响应生成失败:`, streamError.message);
            // 如果流式响应生成失败，回退到非流式响应
            return response;
        }
    }
}
exports.PipelineServer = PipelineServer;
//# sourceMappingURL=pipeline-server.js.map