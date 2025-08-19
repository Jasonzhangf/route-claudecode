"use strict";
/**
 * 代理路由定义
 *
 * 定义RCC v4.0的AI模型代理端点
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
exports.setupProxyRoutes = setupProxyRoutes;
/**
 * 配置代理路由
 */
function setupProxyRoutes(router, middlewareManager) {
    // Anthropic兼容端点
    router.post('/v1/messages', async (req, res, params) => {
        try {
            await handleAnthropicProxy(req, res);
        }
        catch (error) {
            res.statusCode = 500;
            res.body = {
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }, [
        middlewareManager.createCors({ origin: true, credentials: true }),
        middlewareManager.createLogger({ level: 2, format: 'detailed' }),
        middlewareManager.createRateLimit({ maxRequests: 200, windowMs: 60000 }),
    ]);
    // OpenAI兼容端点
    router.post('/v1/chat/completions', async (req, res, params) => {
        try {
            await handleOpenAIProxy(req, res);
        }
        catch (error) {
            res.statusCode = 500;
            res.body = {
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }, [
        middlewareManager.createCors({ origin: true, credentials: true }),
        middlewareManager.createLogger({ level: 2, format: 'detailed' }),
        middlewareManager.createRateLimit({ maxRequests: 200, windowMs: 60000 }),
    ]);
    // Google Gemini兼容端点
    router.post('/v1beta/models/:model/generateContent', async (req, res, params) => {
        try {
            const model = params.model;
            if (!model) {
                res.statusCode = 400;
                res.body = { error: 'Model parameter is required' };
                return;
            }
            await handleGeminiProxy(req, res, model);
        }
        catch (error) {
            res.statusCode = 500;
            res.body = {
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }, [
        middlewareManager.createCors({ origin: true, credentials: true }),
        middlewareManager.createLogger({ level: 2, format: 'detailed' }),
        middlewareManager.createRateLimit({ maxRequests: 200, windowMs: 60000 }),
    ]);
    // 统一代理端点
    router.post('/v1/proxy/:provider/:model', async (req, res, params) => {
        try {
            const provider = params.provider;
            const model = params.model;
            if (!provider || !model) {
                res.statusCode = 400;
                res.body = { error: 'Provider and model parameters are required' };
                return;
            }
            await handleUniversalProxy(req, res, provider, model);
        }
        catch (error) {
            res.statusCode = 500;
            res.body = {
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }, [
        middlewareManager.createCors({ origin: true, credentials: true }),
        middlewareManager.createLogger({ level: 2, format: 'detailed' }),
        middlewareManager.createRateLimit({ maxRequests: 150, windowMs: 60000 }),
    ]);
}
/**
 * 处理Anthropic格式代理请求
 */
async function handleAnthropicProxy(req, res) {
    const requestBody = req.body;
    // 验证请求格式
    if (!requestBody || !requestBody.messages) {
        res.statusCode = 400;
        res.body = {
            error: 'Bad Request',
            message: 'Invalid request format. Expected Anthropic messages format.',
        };
        return;
    }
    try {
        // 获取全局Pipeline服务
        const { getGlobalPipelineManager } = await Promise.resolve().then(() => __importStar(require('../services/global-service-registry')));
        const pipelineManager = getGlobalPipelineManager();
        if (!pipelineManager) {
            res.statusCode = 503;
            res.body = {
                error: 'Service Unavailable',
                message: 'Pipeline manager not initialized',
            };
            return;
        }
        // 创建执行上下文
        const executionContext = {
            requestId: `anthropic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            priority: 'normal',
            debug: false,
            metadata: {
                protocol: 'anthropic',
                model: requestBody.model,
                clientInfo: req.headers?.['user-agent'],
                originalFormat: 'anthropic',
            },
        };
        // 查找适合的Pipeline来处理Anthropic请求
        const allPipelines = pipelineManager.getAllPipelines();
        let targetPipelineId = null;
        // 找到支持Anthropic协议的Pipeline
        for (const [pipelineId, pipeline] of allPipelines) {
            const status = pipeline.getStatus();
            if (status.status === 'running' && status.protocols?.includes('anthropic')) {
                targetPipelineId = pipelineId;
                break;
            }
        }
        if (!targetPipelineId) {
            res.statusCode = 503;
            res.body = {
                error: 'Service Unavailable',
                message: 'No available pipeline for Anthropic protocol',
            };
            return;
        }
        // 执行Pipeline处理
        const result = await pipelineManager.executePipeline(targetPipelineId, requestBody, executionContext);
        // 返回结果
        res.body = result.result;
        res.headers = {
            ...res.headers,
            'X-Pipeline-ID': targetPipelineId,
            'X-Execution-ID': result.executionId,
            'X-Processing-Time': `${result.performance.totalTime}ms`,
            'X-RCC-Version': '4.0.0-alpha.1',
        };
    }
    catch (error) {
        console.error('Anthropic proxy processing failed:', error);
        res.statusCode = 500;
        res.body = {
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Pipeline execution failed',
            type: 'proxy_error',
        };
    }
}
/**
 * 处理OpenAI格式代理请求
 */
async function handleOpenAIProxy(req, res) {
    const requestBody = req.body;
    // 验证请求格式
    if (!requestBody || !requestBody.messages) {
        res.statusCode = 400;
        res.body = {
            error: 'Bad Request',
            message: 'Invalid request format. Expected OpenAI chat completions format.',
        };
        return;
    }
    try {
        // 获取全局Pipeline服务
        const { getGlobalPipelineManager } = await Promise.resolve().then(() => __importStar(require('../services/global-service-registry')));
        const pipelineManager = getGlobalPipelineManager();
        if (!pipelineManager) {
            res.statusCode = 503;
            res.body = {
                error: 'Service Unavailable',
                message: 'Pipeline manager not initialized',
            };
            return;
        }
        // 创建执行上下文
        const executionContext = {
            requestId: `openai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            priority: 'normal',
            debug: false,
            metadata: {
                protocol: 'openai',
                model: requestBody.model,
                clientInfo: req.headers?.['user-agent'],
                originalFormat: 'openai',
                stream: requestBody.stream || false,
            },
        };
        // 查找适合的Pipeline来处理OpenAI请求
        const allPipelines = pipelineManager.getAllPipelines();
        let targetPipelineId = null;
        // 找到支持OpenAI协议的Pipeline
        for (const [pipelineId, pipeline] of allPipelines) {
            const status = pipeline.getStatus();
            if (status.status === 'running' && status.protocols?.includes('openai')) {
                targetPipelineId = pipelineId;
                break;
            }
        }
        if (!targetPipelineId) {
            res.statusCode = 503;
            res.body = {
                error: 'Service Unavailable',
                message: 'No available pipeline for OpenAI protocol',
            };
            return;
        }
        // 执行Pipeline处理
        const result = await pipelineManager.executePipeline(targetPipelineId, requestBody, executionContext);
        // 返回结果
        res.body = result.result;
        res.headers = {
            ...res.headers,
            'X-Pipeline-ID': targetPipelineId,
            'X-Execution-ID': result.executionId,
            'X-Processing-Time': `${result.performance.totalTime}ms`,
            'X-RCC-Version': '4.0.0-alpha.1',
        };
    }
    catch (error) {
        console.error('OpenAI proxy processing failed:', error);
        res.statusCode = 500;
        res.body = {
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Pipeline execution failed',
            type: 'proxy_error',
        };
    }
}
/**
 * 处理Google Gemini格式代理请求
 */
async function handleGeminiProxy(req, res, model) {
    const requestBody = req.body;
    // 验证请求格式
    if (!requestBody || !requestBody.contents) {
        res.statusCode = 400;
        res.body = {
            error: 'Bad Request',
            message: 'Invalid request format. Expected Gemini generateContent format.',
        };
        return;
    }
    try {
        // 获取全局Pipeline服务
        const { getGlobalPipelineManager } = await Promise.resolve().then(() => __importStar(require('../services/global-service-registry')));
        const pipelineManager = getGlobalPipelineManager();
        if (!pipelineManager) {
            res.statusCode = 503;
            res.body = {
                error: 'Service Unavailable',
                message: 'Pipeline manager not initialized',
            };
            return;
        }
        // 创建执行上下文
        const executionContext = {
            requestId: `gemini_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            priority: 'normal',
            debug: false,
            metadata: {
                protocol: 'gemini',
                model: model,
                clientInfo: req.headers?.['user-agent'],
                originalFormat: 'gemini',
            },
        };
        // 查找适合的Pipeline来处理Gemini请求
        const allPipelines = pipelineManager.getAllPipelines();
        let targetPipelineId = null;
        // 找到支持Gemini协议的Pipeline
        for (const [pipelineId, pipeline] of allPipelines) {
            const status = pipeline.getStatus();
            if (status.status === 'running' && status.protocols?.includes('gemini')) {
                targetPipelineId = pipelineId;
                break;
            }
        }
        if (!targetPipelineId) {
            res.statusCode = 503;
            res.body = {
                error: 'Service Unavailable',
                message: 'No available pipeline for Gemini protocol',
            };
            return;
        }
        // 执行Pipeline处理
        const result = await pipelineManager.executePipeline(targetPipelineId, { ...requestBody, model }, executionContext);
        // 返回结果
        res.body = result.result;
        res.headers = {
            ...res.headers,
            'X-Pipeline-ID': targetPipelineId,
            'X-Execution-ID': result.executionId,
            'X-Processing-Time': `${result.performance.totalTime}ms`,
            'X-RCC-Version': '4.0.0-alpha.1',
        };
    }
    catch (error) {
        console.error('Gemini proxy processing failed:', error);
        res.statusCode = 500;
        res.body = {
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Pipeline execution failed',
            type: 'proxy_error',
        };
    }
}
/**
 * 处理统一代理请求
 */
async function handleUniversalProxy(req, res, provider, model) {
    const requestBody = req.body;
    // 验证请求
    if (!requestBody) {
        res.statusCode = 400;
        res.body = {
            error: 'Bad Request',
            message: 'Request body is required.',
        };
        return;
    }
    try {
        // 获取全局Pipeline服务
        const { getGlobalPipelineManager, getGlobalProviderManager } = await Promise.resolve().then(() => __importStar(require('../services/global-service-registry')));
        const pipelineManager = getGlobalPipelineManager();
        const providerManager = getGlobalProviderManager();
        if (!pipelineManager || !providerManager) {
            res.statusCode = 503;
            res.body = {
                error: 'Service Unavailable',
                message: 'Required services not initialized',
            };
            return;
        }
        // 验证Provider是否存在
        const providerStatuses = providerManager.getProviderStatuses();
        const targetProvider = providerStatuses.find(p => p.routeInfo.id === provider);
        if (!targetProvider) {
            res.statusCode = 404;
            res.body = {
                error: 'Not Found',
                message: `Provider '${provider}' not found`,
            };
            return;
        }
        if (!targetProvider.routeInfo.healthy) {
            res.statusCode = 503;
            res.body = {
                error: 'Service Unavailable',
                message: `Provider '${provider}' is not healthy`,
            };
            return;
        }
        // 创建执行上下文
        const executionContext = {
            requestId: `universal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            priority: 'normal',
            debug: false,
            metadata: {
                protocol: 'universal',
                provider: provider,
                model: model,
                clientInfo: req.headers?.['user-agent'],
                originalFormat: 'universal',
            },
        };
        // 查找适合的Pipeline
        const allPipelines = pipelineManager.getAllPipelines();
        let targetPipelineId = null;
        // 找到支持指定Provider的Pipeline
        for (const [pipelineId, pipeline] of allPipelines) {
            const status = pipeline.getStatus();
            if (status.status === 'running' && status.supportedProviders?.includes(provider)) {
                targetPipelineId = pipelineId;
                break;
            }
        }
        if (!targetPipelineId) {
            res.statusCode = 503;
            res.body = {
                error: 'Service Unavailable',
                message: `No available pipeline for provider '${provider}'`,
            };
            return;
        }
        // 执行Pipeline处理
        const result = await pipelineManager.executePipeline(targetPipelineId, { ...requestBody, provider, model }, executionContext);
        // 返回统一格式的响应
        res.body = {
            success: true,
            provider,
            model,
            request_id: executionContext.requestId,
            execution_id: result.executionId,
            response: result.result,
            usage: result.performance,
            metadata: {
                processing_time_ms: result.performance.totalTime,
                pipeline_id: targetPipelineId,
                rcc_version: '4.0.0-alpha.1',
                provider_healthy: targetProvider.routeInfo.healthy,
                provider_load: targetProvider.routeInfo.currentLoad,
            },
        };
        res.headers = {
            ...res.headers,
            'X-Pipeline-ID': targetPipelineId,
            'X-Execution-ID': result.executionId,
            'X-Processing-Time': `${result.performance.totalTime}ms`,
            'X-Provider': provider,
            'X-Model': model,
            'X-RCC-Version': '4.0.0-alpha.1',
        };
    }
    catch (error) {
        console.error('Universal proxy processing failed:', error);
        res.statusCode = 500;
        res.body = {
            error: 'Internal Server Error',
            message: error instanceof Error ? error.message : 'Pipeline execution failed',
            type: 'proxy_error',
            provider,
            model,
        };
    }
}
//# sourceMappingURL=proxy-routes.js.map