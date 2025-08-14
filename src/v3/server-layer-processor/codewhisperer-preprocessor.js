/**
 * CodeWhisperer Preprocessor - V3.0 Six-Layer Architecture
 * 透传式预处理器，基本验证和元数据注入
 * 集成回放系统，支持数据捕获和分析
 * 
 * Project owner: Jason Zhang
 */

export class CodewhispererPreprocessor {
    constructor() {
        this.name = 'CodewhispererPreprocessor';
        this.version = 'v3.0.0';
        this.mode = 'passthrough';
        this.replayIntegration = true;
        
        console.log(`[V3:${process.env.RCC_PORT}] Initialized ${this.name} v${this.version} - Passthrough mode with validation`);
    }

    /**
     * 预处理请求
     * @param {Object} request - 输入请求
     * @param {Object} context - 上下文信息
     * @returns {Object} 预处理后的请求
     */
    async preprocessRequest(request, context = {}) {
        const { requestId, providerId } = context;
        const startTime = Date.now();

        console.log(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:Preprocessor] Processing request ${requestId}`);

        try {
            // 基本验证
            this.validateRequest(request);

            // 注入元数据
            const processedRequest = this.injectMetadata(request, context);

            // 回放系统集成
            if (this.replayIntegration && context.replayCapture) {
                context.replayCapture.preprocessor = {
                    input: request,
                    output: processedRequest,
                    metadata: {
                        duration: Date.now() - startTime,
                        mode: this.mode,
                        validationPassed: true
                    }
                };
            }

            console.log(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:Preprocessor] Request ${requestId} processed in ${Date.now() - startTime}ms`);
            return processedRequest;

        } catch (error) {
            console.error(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:Preprocessor] Request ${requestId} failed: ${error.message}`);
            
            // 回放系统错误记录
            if (this.replayIntegration && context.replayCapture) {
                context.replayCapture.preprocessor = {
                    input: request,
                    error: error.message,
                    metadata: {
                        duration: Date.now() - startTime,
                        mode: this.mode,
                        validationPassed: false
                    }
                };
            }
            
            throw error;
        }
    }

    /**
     * 验证请求格式
     * @param {Object} request - 请求对象
     */
    validateRequest(request) {
        if (!request) {
            throw new Error('Request cannot be null or undefined');
        }

        // 验证必需的CodeWhisperer请求结构
        if (!request.conversationState) {
            throw new Error('Missing conversationState in CodeWhisperer request');
        }

        const conversationState = request.conversationState;

        if (!conversationState.conversationId) {
            throw new Error('Missing conversationId in conversationState');
        }

        if (!conversationState.currentMessage) {
            throw new Error('Missing currentMessage in conversationState');
        }

        if (!conversationState.chatTriggerType) {
            throw new Error('Missing chatTriggerType in conversationState');
        }

        // 验证当前消息
        const currentMessage = conversationState.currentMessage;
        if (!currentMessage.userInputMessage && !currentMessage.assistantResponseMessage) {
            throw new Error('currentMessage must contain either userInputMessage or assistantResponseMessage');
        }

        // 验证用户输入消息格式
        if (currentMessage.userInputMessage) {
            const userMessage = currentMessage.userInputMessage;
            
            if (!userMessage.content && (!userMessage.userInputMessageContext?.toolResults || userMessage.userInputMessageContext.toolResults.length === 0)) {
                throw new Error('userInputMessage must have content or tool results');
            }

            if (!userMessage.modelId) {
                throw new Error('Missing modelId in userInputMessage');
            }

            if (!userMessage.origin) {
                throw new Error('Missing origin in userInputMessage');
            }
        }

        // 验证助手响应消息格式
        if (currentMessage.assistantResponseMessage) {
            const assistantMessage = currentMessage.assistantResponseMessage;
            
            if (!assistantMessage.content && (!assistantMessage.toolUses || assistantMessage.toolUses.length === 0)) {
                throw new Error('assistantResponseMessage must have content or tool uses');
            }
        }

        console.log(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:Preprocessor] Request validation passed`);
    }

    /**
     * 注入元数据
     * @param {Object} request - 原始请求
     * @param {Object} context - 上下文信息
     * @returns {Object} 注入元数据后的请求
     */
    injectMetadata(request, context) {
        const processedRequest = {
            ...request,
            metadata: {
                ...request.metadata,
                preprocessor: {
                    name: this.name,
                    version: this.version,
                    mode: this.mode,
                    processedAt: new Date().toISOString(),
                    requestId: context.requestId,
                    providerId: context.providerId
                }
            }
        };

        // 添加追踪信息到conversationState
        if (processedRequest.conversationState) {
            processedRequest.conversationState.metadata = {
                ...processedRequest.conversationState.metadata,
                preprocessedBy: this.name,
                preprocessedAt: new Date().toISOString()
            };
        }

        return processedRequest;
    }

    /**
     * 健康检查
     * @returns {Object} 健康状态
     */
    async healthCheck() {
        const startTime = Date.now();
        
        try {
            // 简单的功能测试
            const testRequest = {
                conversationState: {
                    conversationId: 'health-check-test',
                    chatTriggerType: 'MANUAL',
                    currentMessage: {
                        userInputMessage: {
                            content: 'Health check test',
                            modelId: 'CLAUDE_SONNET_4_20250514_V1_0',
                            origin: 'AI_EDITOR'
                        }
                    }
                }
            };

            const testContext = {
                requestId: 'health-check',
                providerId: 'test-provider'
            };

            // 尝试预处理测试请求
            await this.preprocessRequest(testRequest, testContext);

            return {
                healthy: true,
                responseTime: Date.now() - startTime,
                mode: this.mode,
                version: this.version,
                replayIntegration: this.replayIntegration
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                responseTime: Date.now() - startTime,
                mode: this.mode,
                version: this.version
            };
        }
    }

    /**
     * 获取预处理器信息
     * @returns {Object} 预处理器信息
     */
    getInfo() {
        return {
            name: this.name,
            version: this.version,
            mode: this.mode,
            replayIntegration: this.replayIntegration,
            capabilities: [
                'request-validation',
                'metadata-injection',
                'replay-integration',
                'passthrough-processing'
            ],
            supportedFormats: [
                'codewhisperer-conversationstate',
                'kiro-api-format'
            ]
        };
    }

    /**
     * 获取统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            totalRequests: this.totalRequests || 0,
            successfulRequests: this.successfulRequests || 0,
            failedRequests: this.failedRequests || 0,
            averageProcessingTime: this.averageProcessingTime || 0,
            lastProcessedAt: this.lastProcessedAt || null
        };
    }

    /**
     * 重置统计信息
     */
    resetStats() {
        this.totalRequests = 0;
        this.successfulRequests = 0;
        this.failedRequests = 0;
        this.averageProcessingTime = 0;
        this.lastProcessedAt = null;
        
        console.log(`[V3:${process.env.RCC_PORT}] [CodeWhisperer:Preprocessor] Statistics reset`);
    }

    /**
     * 更新统计信息
     * @private
     */
    _updateStats(processingTime, success = true) {
        this.totalRequests = (this.totalRequests || 0) + 1;
        
        if (success) {
            this.successfulRequests = (this.successfulRequests || 0) + 1;
        } else {
            this.failedRequests = (this.failedRequests || 0) + 1;
        }

        // 计算平均处理时间
        const currentAvg = this.averageProcessingTime || 0;
        this.averageProcessingTime = (currentAvg * (this.totalRequests - 1) + processingTime) / this.totalRequests;
        
        this.lastProcessedAt = new Date().toISOString();
    }
}