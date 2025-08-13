/**
 * Gemini Provider-Protocol Client
 * 负责与Google Gemini官方API的直接通信
 * @author Jason Zhang
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getLogger } from '../../logging/index.js';

const logger = getLogger();

export class GeminiClient {
    constructor(config) {
        this.config = config;
        this.type = 'gemini';
        
        // 验证必需的配置
        if (!config.apiKey) {
            throw new Error('Gemini API key is required');
        }

        // 初始化Google AI客户端
        this.client = new GoogleGenerativeAI(config.apiKey);
        
        logger.debug('Gemini client initialized', {
            endpoint: config.endpoint || 'Official Gemini API',
            models: config.models || ['gemini-1.5-pro-latest'],
            timeout: config.timeout || 30000
        });
    }

    /**
     * 发送非流式请求到Gemini API
     */
    async sendRequest(request, context) {
        const requestId = context.requestId || `req_${Date.now()}`;
        
        logger.debug('Sending request to Gemini API', {
            requestId,
            model: request.model,
            contentCount: request.contents?.length || 0,
            hasTools: !!(request.tools && request.tools.length > 0)
        });

        try {
            // 获取Gemini模型实例
            const model = this.client.getGenerativeModel({
                model: request.model,
                generationConfig: request.generationConfig,
                safetySettings: request.safetySettings,
                tools: request.tools,
                systemInstruction: request.systemInstruction
            });

            // 记录请求到回放系统
            this.recordRequest(request, context);

            // 发送请求
            const startTime = Date.now();
            const result = await model.generateContent(request.contents);
            const duration = Date.now() - startTime;

            const response = await result.response;

            logger.debug('Gemini API response received', {
                requestId,
                duration,
                candidateCount: response.candidates?.length || 0,
                finishReason: response.candidates?.[0]?.finishReason,
                inputTokens: response.usageMetadata?.promptTokenCount || 0,
                outputTokens: response.usageMetadata?.candidatesTokenCount || 0
            });

            // 记录响应到回放系统
            this.recordResponse(response, context, duration);

            return response;

        } catch (error) {
            logger.error('Gemini API request failed', {
                requestId,
                error: error.message,
                status: error.status,
                stack: error.stack
            });

            // 记录错误到回放系统
            this.recordError(error, context);
            
            throw this.handleGeminiError(error);
        }
    }

    /**
     * 发送流式请求到Gemini API
     */
    async sendStreamRequest(request, context) {
        const requestId = context.requestId || `req_${Date.now()}`;
        
        logger.debug('Sending stream request to Gemini API', {
            requestId,
            model: request.model,
            contentCount: request.contents?.length || 0
        });

        try {
            // 获取Gemini模型实例
            const model = this.client.getGenerativeModel({
                model: request.model,
                generationConfig: request.generationConfig,
                safetySettings: request.safetySettings,
                tools: request.tools,
                systemInstruction: request.systemInstruction
            });

            // 记录请求到回放系统
            this.recordRequest(request, context);

            // 发送流式请求
            const startTime = Date.now();
            const result = await model.generateContentStream(request.contents);

            logger.debug('Gemini API stream started', {
                requestId,
                startTime
            });

            // 创建流式响应处理器
            return this.createStreamHandler(result.stream, context, startTime);

        } catch (error) {
            logger.error('Gemini API stream request failed', {
                requestId,
                error: error.message,
                status: error.status
            });

            // 记录错误到回放系统
            this.recordError(error, context);
            
            throw this.handleGeminiError(error);
        }
    }

    /**
     * 创建流式响应处理器
     */
    async* createStreamHandler(stream, context, startTime) {
        const requestId = context.requestId;
        let chunkCount = 0;
        let totalTokens = 0;

        try {
            for await (const chunk of stream) {
                chunkCount++;
                
                if (chunk.candidates) {
                    totalTokens += chunk.usageMetadata?.candidatesTokenCount || 0;
                }

                logger.debug('Gemini stream chunk received', {
                    requestId,
                    chunkIndex: chunkCount,
                    candidateCount: chunk.candidates?.length || 0,
                    accumulatedTokens: totalTokens
                });

                // 记录流式数据到回放系统
                this.recordStreamChunk(chunk, context, chunkCount);

                yield chunk;
            }

            const duration = Date.now() - startTime;
            
            logger.debug('Gemini stream completed', {
                requestId,
                duration,
                totalChunks: chunkCount,
                totalTokens
            });

            // 记录流式完成到回放系统
            this.recordStreamComplete(context, duration, chunkCount, totalTokens);

        } catch (error) {
            logger.error('Gemini stream error', {
                requestId,
                error: error.message,
                chunkCount
            });

            // 记录流式错误到回放系统
            this.recordStreamError(error, context, chunkCount);
            
            throw this.handleGeminiError(error);
        }
    }

    /**
     * 处理Gemini错误
     */
    handleGeminiError(error) {
        // 标准化错误格式
        const standardError = {
            name: 'GeminiAPIError',
            message: error.message || 'Unknown Gemini API error',
            status: error.status || 500,
            code: error.code || 'UNKNOWN_ERROR',
            provider: 'gemini',
            timestamp: new Date().toISOString()
        };

        // 根据错误类型设置具体信息
        if (error.status === 400) {
            standardError.code = 'INVALID_REQUEST';
            standardError.message = 'Invalid request format or parameters';
        } else if (error.status === 401) {
            standardError.code = 'INVALID_API_KEY';
            standardError.message = 'Invalid or missing API key';
        } else if (error.status === 403) {
            standardError.code = 'PERMISSION_DENIED';
            standardError.message = 'Permission denied or quota exceeded';
        } else if (error.status === 429) {
            standardError.code = 'RATE_LIMIT_EXCEEDED';
            standardError.message = 'Rate limit exceeded';
        } else if (error.status >= 500) {
            standardError.code = 'SERVER_ERROR';
            standardError.message = 'Gemini server error';
        }

        return standardError;
    }

    /**
     * 记录请求到回放系统
     */
    recordRequest(request, context) {
        try {
            if (global.debugRecorder) {
                global.debugRecorder.recordLayerData('provider-protocol', 'gemini-request', {
                    requestId: context.requestId,
                    timestamp: Date.now(),
                    provider: 'gemini',
                    model: request.model,
                    contentCount: request.contents?.length || 0,
                    hasTools: !!(request.tools && request.tools.length > 0),
                    generationConfig: request.generationConfig,
                    request: JSON.parse(JSON.stringify(request))
                });
            }
        } catch (error) {
            logger.warn('Failed to record request to replay system', error);
        }
    }

    /**
     * 记录响应到回放系统
     */
    recordResponse(response, context, duration) {
        try {
            if (global.debugRecorder) {
                global.debugRecorder.recordLayerData('provider-protocol', 'gemini-response', {
                    requestId: context.requestId,
                    timestamp: Date.now(),
                    provider: 'gemini',
                    duration,
                    candidateCount: response.candidates?.length || 0,
                    finishReason: response.candidates?.[0]?.finishReason,
                    inputTokens: response.usageMetadata?.promptTokenCount || 0,
                    outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
                    response: JSON.parse(JSON.stringify(response))
                });
            }
        } catch (error) {
            logger.warn('Failed to record response to replay system', error);
        }
    }

    /**
     * 记录流式数据块到回放系统
     */
    recordStreamChunk(chunk, context, chunkIndex) {
        try {
            if (global.debugRecorder) {
                global.debugRecorder.recordLayerData('provider-protocol', 'gemini-stream-chunk', {
                    requestId: context.requestId,
                    timestamp: Date.now(),
                    provider: 'gemini',
                    chunkIndex,
                    candidateCount: chunk.candidates?.length || 0,
                    chunk: JSON.parse(JSON.stringify(chunk))
                });
            }
        } catch (error) {
            logger.warn('Failed to record stream chunk to replay system', error);
        }
    }

    /**
     * 记录流式完成到回放系统
     */
    recordStreamComplete(context, duration, chunkCount, totalTokens) {
        try {
            if (global.debugRecorder) {
                global.debugRecorder.recordLayerData('provider-protocol', 'gemini-stream-complete', {
                    requestId: context.requestId,
                    timestamp: Date.now(),
                    provider: 'gemini',
                    duration,
                    totalChunks: chunkCount,
                    totalTokens
                });
            }
        } catch (error) {
            logger.warn('Failed to record stream completion to replay system', error);
        }
    }

    /**
     * 记录错误到回放系统
     */
    recordError(error, context) {
        try {
            if (global.debugRecorder) {
                global.debugRecorder.recordLayerData('provider-protocol', 'gemini-error', {
                    requestId: context.requestId,
                    timestamp: Date.now(),
                    provider: 'gemini',
                    error: {
                        message: error.message,
                        status: error.status,
                        code: error.code,
                        stack: error.stack
                    }
                });
            }
        } catch (recordError) {
            logger.warn('Failed to record error to replay system', recordError);
        }
    }

    /**
     * 记录流式错误到回放系统
     */
    recordStreamError(error, context, chunkCount) {
        try {
            if (global.debugRecorder) {
                global.debugRecorder.recordLayerData('provider-protocol', 'gemini-stream-error', {
                    requestId: context.requestId,
                    timestamp: Date.now(),
                    provider: 'gemini',
                    chunkCount,
                    error: {
                        message: error.message,
                        status: error.status,
                        code: error.code,
                        stack: error.stack
                    }
                });
            }
        } catch (recordError) {
            logger.warn('Failed to record stream error to replay system', recordError);
        }
    }

    /**
     * 健康检查
     */
    async healthCheck() {
        try {
            // 使用简单的模型调用来检查连接
            const model = this.client.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result = await model.generateContent('Health check');
            await result.response;
            
            return { healthy: true, provider: 'gemini' };
        } catch (error) {
            logger.warn('Gemini health check failed', error);
            return { 
                healthy: false, 
                provider: 'gemini',
                error: error.message 
            };
        }
    }

    /**
     * 获取支持的模型列表
     */
    getSupportedModels() {
        return [
            'gemini-2.0-flash-exp',
            'gemini-1.5-pro-latest',
            'gemini-1.5-flash',
            'gemini-1.5-flash-8b'
        ];
    }

    /**
     * 获取客户端配置信息
     */
    getConfig() {
        return {
            type: this.type,
            provider: 'gemini',
            endpoint: this.config.endpoint || 'https://generativelanguage.googleapis.com',
            timeout: this.config.timeout || 30000,
            maxRetries: this.config.maxRetries || 3,
            retryDelays: this.config.retryDelays || [1000, 2000, 5000]
        };
    }

    /**
     * 获取provider名称
     */
    get provider() {
        return 'gemini';
    }

    /**
     * 获取endpoint
     */
    get endpoint() {
        return this.config.endpoint || 'https://generativelanguage.googleapis.com';
    }

    /**
     * 获取超时设置
     */
    get timeout() {
        return this.config.timeout || 30000;
    }
}