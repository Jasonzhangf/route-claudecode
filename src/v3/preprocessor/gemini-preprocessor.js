/**
 * Gemini Preprocessor - 透传式预处理器
 * 负责Gemini请求的基础预处理，主要为透传模式，不做特殊格式转换
 * @author Jason Zhang
 */

import { getLogger } from '../logging/index.js';

const logger = getLogger();

export class GeminiPreprocessor {
    constructor(config) {
        this.config = config;
        this.type = 'gemini';
        this.mode = 'passthrough';
        this.replayIntegration = true;
        
        logger.debug('Gemini preprocessor initialized', {
            endpoint: config.endpoint || 'Official Gemini API',
            timeout: config.timeout || 30000
        });
    }

    /**
     * 预处理请求（透传模式）
     */
    async processRequest(request, context) {
        logger.debug('Gemini preprocessor processing request', {
            model: request.model,
            providerId: context.providerId,
            messageCount: request.messages?.length || 0,
            hasTools: !!(request.tools && request.tools.length > 0)
        });

        // 记录请求到回放系统
        this.recordPreprocessorRequest(request, context);

        // 透传模式：直接返回原始请求，只添加必要的标准化
        const processedRequest = {
            ...request,
            // 确保基本字段存在
            messages: request.messages || [],
            model: request.model || 'gemini-1.5-pro-latest',
            
            // 添加请求元数据
            metadata: {
                requestId: context.requestId,
                providerId: context.providerId,
                preprocessorType: 'gemini',
                processedAt: Date.now(),
                originalModel: request.model
            }
        };

        // 基础参数验证和标准化
        if (request.max_tokens) {
            processedRequest.max_tokens = Math.min(Math.max(request.max_tokens, 1), 8192);
        }

        if (request.temperature !== undefined) {
            processedRequest.temperature = Math.min(Math.max(request.temperature, 0), 2);
        }

        if (request.top_p !== undefined) {
            processedRequest.top_p = Math.min(Math.max(request.top_p, 0), 1);
        }

        logger.debug('Gemini preprocessing completed', {
            providerId: context.providerId,
            originalModel: request.model,
            processedModel: processedRequest.model,
            messageCount: processedRequest.messages.length,
            hasMetadata: !!processedRequest.metadata
        });

        // 记录处理后的请求到回放系统
        this.recordPreprocessorOutput(processedRequest, context);

        return processedRequest;
    }

    /**
     * 后处理响应（透传模式）
     */
    async postprocessResponse(response, originalRequest, context) {
        logger.debug('Gemini preprocessor postprocessing response', {
            providerId: context.providerId,
            hasResponse: !!response,
            responseType: typeof response
        });

        // 记录响应到回放系统
        this.recordPreprocessorResponse(response, context);

        // 透传模式：直接返回响应，只添加基础验证
        if (!response) {
            logger.warn('Empty response received from Gemini', {
                providerId: context.providerId,
                requestId: context.requestId
            });
            return response;
        }

        // 添加处理元数据
        const processedResponse = {
            ...response,
            metadata: {
                requestId: context.requestId,
                providerId: context.providerId,
                postprocessorType: 'gemini',
                processedAt: Date.now()
            }
        };

        logger.debug('Gemini postprocessing completed', {
            providerId: context.providerId,
            hasMetadata: !!processedResponse.metadata,
            responseSize: JSON.stringify(response).length
        });

        // 记录处理后的响应到回放系统
        this.recordPreprocessorOutputResponse(processedResponse, context);

        return processedResponse;
    }

    /**
     * 健康检查
     */
    async healthCheck() {
        try {
            const startTime = Date.now();
            logger.debug('Gemini preprocessor health check');
            const responseTime = Date.now() - startTime;
            
            return {
                healthy: true,
                preprocessor: 'gemini',
                type: 'passthrough',
                responseTime: responseTime,
                timestamp: Date.now()
            };
        } catch (error) {
            logger.error('Gemini preprocessor health check failed', error);
            return {
                healthy: false,
                preprocessor: 'gemini',
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    /**
     * 获取预处理器信息
     */
    getInfo() {
        return {
            type: 'gemini',
            mode: 'passthrough',
            features: [
                'basic_validation',
                'parameter_normalization',
                'metadata_injection',
                'replay_system_integration'
            ],
            config: {
                timeout: this.config.timeout || 30000,
                endpoint: this.config.endpoint || 'Official Gemini API'
            }
        };
    }

    /**
     * 记录预处理器请求到回放系统
     */
    recordPreprocessorRequest(request, context) {
        try {
            if (global.debugRecorder) {
                global.debugRecorder.recordLayerData('preprocessor', 'gemini-request', {
                    requestId: context.requestId,
                    timestamp: Date.now(),
                    providerId: context.providerId,
                    preprocessorType: 'gemini',
                    model: request.model,
                    messageCount: request.messages?.length || 0,
                    hasTools: !!(request.tools && request.tools.length > 0),
                    request: JSON.parse(JSON.stringify(request))
                });
            }
        } catch (error) {
            logger.warn('Failed to record preprocessor request to replay system', error);
        }
    }

    /**
     * 记录预处理器输出到回放系统
     */
    recordPreprocessorOutput(processedRequest, context) {
        try {
            if (global.debugRecorder) {
                global.debugRecorder.recordLayerData('preprocessor', 'gemini-processed-request', {
                    requestId: context.requestId,
                    timestamp: Date.now(),
                    providerId: context.providerId,
                    preprocessorType: 'gemini',
                    originalModel: processedRequest.metadata?.originalModel,
                    processedModel: processedRequest.model,
                    messageCount: processedRequest.messages?.length || 0,
                    processedRequest: JSON.parse(JSON.stringify(processedRequest))
                });
            }
        } catch (error) {
            logger.warn('Failed to record preprocessor output to replay system', error);
        }
    }

    /**
     * 记录预处理器响应到回放系统
     */
    recordPreprocessorResponse(response, context) {
        try {
            if (global.debugRecorder) {
                global.debugRecorder.recordLayerData('preprocessor', 'gemini-response', {
                    requestId: context.requestId,
                    timestamp: Date.now(),
                    providerId: context.providerId,
                    preprocessorType: 'gemini',
                    hasResponse: !!response,
                    responseType: typeof response,
                    responseSize: response ? JSON.stringify(response).length : 0,
                    response: response ? JSON.parse(JSON.stringify(response)) : null
                });
            }
        } catch (error) {
            logger.warn('Failed to record preprocessor response to replay system', error);
        }
    }

    /**
     * 记录预处理器输出响应到回放系统
     */
    recordPreprocessorOutputResponse(processedResponse, context) {
        try {
            if (global.debugRecorder) {
                global.debugRecorder.recordLayerData('preprocessor', 'gemini-processed-response', {
                    requestId: context.requestId,
                    timestamp: Date.now(),
                    providerId: context.providerId,
                    preprocessorType: 'gemini',
                    hasMetadata: !!processedResponse.metadata,
                    responseSize: JSON.stringify(processedResponse).length,
                    processedResponse: JSON.parse(JSON.stringify(processedResponse))
                });
            }
        } catch (error) {
            logger.warn('Failed to record preprocessor output response to replay system', error);
        }
    }
}