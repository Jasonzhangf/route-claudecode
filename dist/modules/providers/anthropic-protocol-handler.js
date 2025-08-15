"use strict";
/**
 * Anthropic Protocol处理器
 *
 * 基于官方 @anthropic-ai/sdk 实现的Anthropic协议处理器
 *
 * @author Jason Zhang
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicProtocolHandler = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const base_module_impl_1 = require("../base-module-impl");
/**
 * Anthropic Protocol处理器实现
 */
class AnthropicProtocolHandler extends base_module_impl_1.BaseModule {
    protocolConfig;
    anthropicClient;
    constructor(id, config = {}) {
        super(id, 'Anthropic Protocol Handler', 'protocol', '1.0.0');
        this.protocolConfig = {
            apiKey: '',
            defaultModel: 'claude-3-sonnet-20240229',
            timeout: 30000,
            maxRetries: 3,
            enableToolCalls: true,
            debug: false,
            ...config
        };
        this.initializeClient();
    }
    /**
     * 初始化Anthropic客户端
     */
    initializeClient() {
        if (!this.protocolConfig.apiKey) {
            throw new Error('Anthropic API key is required');
        }
        const clientConfig = {
            apiKey: this.protocolConfig.apiKey,
            timeout: this.protocolConfig.timeout,
            maxRetries: this.protocolConfig.maxRetries,
        };
        // 如果指定了自定义baseURL，则设置
        if (this.protocolConfig.baseURL) {
            clientConfig.baseURL = this.protocolConfig.baseURL;
        }
        this.anthropicClient = new sdk_1.default(clientConfig);
    }
    /**
     * 配置处理
     */
    async onConfigure(config) {
        this.protocolConfig = { ...this.protocolConfig, ...config };
        // 重新初始化客户端
        this.initializeClient();
        if (this.protocolConfig.debug) {
            console.log(`[Anthropic Protocol] Configuration updated:`, {
                baseURL: this.protocolConfig.baseURL || 'https://api.anthropic.com',
                model: this.protocolConfig.defaultModel,
                enableToolCalls: this.protocolConfig.enableToolCalls
            });
        }
    }
    /**
     * 主要处理逻辑
     */
    async onProcess(input) {
        const startTime = Date.now();
        try {
            // 1. 转换请求格式
            const anthropicRequest = await this.transformToAnthropic(input);
            // 2. 调用Anthropic API
            const anthropicResponse = await this.callAnthropicAPI(anthropicRequest);
            // 3. 转换响应格式
            const standardResponse = await this.transformFromAnthropic(anthropicResponse, input);
            // 4. 更新指标
            const processingTime = Date.now() - startTime;
            this.updateProcessingMetrics(processingTime, true);
            if (this.protocolConfig.debug) {
                console.log(`[Anthropic Protocol] Request processed successfully in ${processingTime}ms`);
            }
            return standardResponse;
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.updateProcessingMetrics(processingTime, false);
            if (this.protocolConfig.debug) {
                console.error(`[Anthropic Protocol] Request failed after ${processingTime}ms:`, error);
            }
            throw this.createProcessingError(error, input);
        }
    }
    /**
     * 转换标准请求到Anthropic格式
     */
    async transformToAnthropic(request) {
        const anthropicRequest = {
            model: request.model || this.protocolConfig.defaultModel,
            messages: this.transformMessages(request.messages),
            max_tokens: request.max_tokens || 4096,
        };
        // 可选参数
        if (request.temperature !== undefined) {
            anthropicRequest.temperature = request.temperature;
        }
        if (request.top_p !== undefined) {
            anthropicRequest.top_p = request.top_p;
        }
        if (request.system) {
            anthropicRequest.system = request.system;
        }
        if (request.stop) {
            anthropicRequest.stop_sequences = Array.isArray(request.stop) ? request.stop : [request.stop];
        }
        // 处理工具调用
        if (request.tools && this.protocolConfig.enableToolCalls) {
            anthropicRequest.tools = this.transformTools(request.tools);
            if (request.tool_choice) {
                anthropicRequest.tool_choice = this.transformToolChoice(request.tool_choice);
            }
        }
        return anthropicRequest;
    }
    /**
     * 转换消息格式
     */
    transformMessages(messages) {
        const anthropicMessages = [];
        for (const message of messages) {
            // 跳过system消息，因为Anthropic在顶级system字段中处理
            if (message.role === 'system') {
                continue;
            }
            if (message.role === 'user') {
                const userMessage = message;
                anthropicMessages.push({
                    role: 'user',
                    content: this.transformMessageContent(userMessage.content)
                });
            }
            else if (message.role === 'assistant') {
                const assistantMessage = message;
                const content = [];
                // 添加文本内容
                if (assistantMessage.content) {
                    if (typeof assistantMessage.content === 'string') {
                        content.push({
                            type: 'text',
                            text: assistantMessage.content
                        });
                    }
                }
                // 添加工具调用
                if (assistantMessage.toolCalls && this.protocolConfig.enableToolCalls) {
                    for (const toolCall of assistantMessage.toolCalls) {
                        content.push({
                            type: 'tool_use',
                            id: toolCall.id,
                            name: toolCall.function.name,
                            input: typeof toolCall.function.arguments === 'string'
                                ? JSON.parse(toolCall.function.arguments)
                                : toolCall.function.arguments || {}
                        });
                    }
                }
                anthropicMessages.push({
                    role: 'assistant',
                    content: content.length === 1 && content[0] && content[0].type === 'text'
                        ? (content[0].text || '')
                        : content
                });
            }
            else if (message.role === 'tool') {
                const toolMessage = message;
                anthropicMessages.push({
                    role: 'user',
                    content: [{
                            type: 'tool_result',
                            tool_use_id: toolMessage.toolCallId,
                            content: toolMessage.content
                        }]
                });
            }
        }
        return anthropicMessages;
    }
    /**
     * 转换消息内容
     */
    transformMessageContent(content) {
        if (typeof content === 'string') {
            return content;
        }
        if (Array.isArray(content)) {
            return content.map(block => {
                if (block.type === 'text') {
                    return {
                        type: 'text',
                        text: block.text
                    };
                }
                else if (block.type === 'image') {
                    return {
                        type: 'image',
                        source: block.source
                    };
                }
                return block;
            });
        }
        return String(content);
    }
    /**
     * 转换工具定义
     */
    transformTools(tools) {
        return tools.map(tool => ({
            name: tool.function.name,
            description: tool.function.description,
            input_schema: {
                type: 'object',
                properties: tool.function.parameters.properties || {},
                required: tool.function.parameters.required || []
            }
        }));
    }
    /**
     * 转换工具选择
     */
    transformToolChoice(toolChoice) {
        if (typeof toolChoice === 'string') {
            switch (toolChoice) {
                case 'auto':
                    return { type: 'auto' };
                case 'none':
                    return undefined; // Anthropic 没有 "none" 选项
                case 'required':
                    return { type: 'any' };
                default:
                    return { type: 'auto' };
            }
        }
        if (typeof toolChoice === 'object' && toolChoice.type === 'function') {
            return {
                type: 'tool',
                name: toolChoice.function.name
            };
        }
        return { type: 'auto' };
    }
    /**
     * 调用Anthropic API
     */
    async callAnthropicAPI(request) {
        if (this.protocolConfig.debug) {
            console.log(`[Anthropic Protocol] API call with model: ${request.model}`);
        }
        try {
            const response = await this.anthropicClient.messages.create(request);
            if (this.protocolConfig.debug) {
                console.log(`[Anthropic Protocol] API call successful`);
            }
            // 确保返回的是Message类型而不是Stream
            if ('stream' in response) {
                throw new Error('Streaming responses not supported in this handler');
            }
            return response;
        }
        catch (error) {
            if (this.protocolConfig.debug) {
                console.error(`[Anthropic Protocol] API call failed:`, error);
            }
            throw error;
        }
    }
    /**
     * 转换Anthropic响应到标准格式
     */
    async transformFromAnthropic(response, originalRequest) {
        const choices = [{
                index: 0,
                message: this.transformAnthropicMessage(response),
                finishReason: this.mapStopReason(response.stop_reason)
            }];
        const usage = {
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
            totalTokens: response.usage.input_tokens + response.usage.output_tokens
        };
        const standardResponse = {
            id: response.id,
            choices,
            usage,
            model: response.model,
            created: Math.floor(Date.now() / 1000),
            metadata: {
                requestId: originalRequest.id,
                provider: 'anthropic',
                model: response.model,
                originalFormat: 'anthropic',
                targetFormat: 'anthropic',
                processingSteps: ['validate', 'transform', 'call_api', 'transform_back'],
                performance: {
                    totalTime: Date.now() - originalRequest.timestamp.getTime(),
                    apiCallTime: 0, // 会在调用时设置
                    transformationTime: 0,
                    validationTime: 0,
                    retryCount: 0
                }
            },
            timestamp: new Date()
        };
        return standardResponse;
    }
    /**
     * 转换Anthropic消息到标准格式
     */
    transformAnthropicMessage(anthropicMessage) {
        const message = {
            role: 'assistant',
            content: '',
            toolCalls: []
        };
        // 处理内容
        const textBlocks = [];
        const toolCalls = [];
        for (const block of anthropicMessage.content) {
            if (block.type === 'text') {
                textBlocks.push(block.text);
            }
            else if (block.type === 'tool_use') {
                toolCalls.push({
                    id: block.id,
                    type: 'function',
                    function: {
                        name: block.name,
                        arguments: typeof block.input === 'string'
                            ? block.input
                            : JSON.stringify(block.input)
                    }
                });
            }
        }
        message.content = textBlocks.join('\n').trim();
        if (toolCalls.length > 0) {
            message.toolCalls = toolCalls;
        }
        return message;
    }
    /**
     * 映射停止原因
     */
    mapStopReason(reason) {
        switch (reason) {
            case 'end_turn': return 'stop';
            case 'max_tokens': return 'length';
            case 'tool_use': return 'tool_calls';
            case 'stop_sequence': return 'stop';
            default: return 'stop';
        }
    }
    /**
     * 更新处理指标
     */
    updateProcessingMetrics(processingTime, success) {
        this.metrics.requestsProcessed++;
        this.metrics.lastProcessedAt = new Date();
        if (success) {
            this.processingTimes.push(processingTime);
            // 保持最近100次的处理时间
            if (this.processingTimes.length > 100) {
                this.processingTimes = this.processingTimes.slice(-100);
            }
            // 计算平均处理时间
            this.metrics.averageProcessingTime =
                this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
        }
        else {
            this.errors.push(new Error(`Processing failed after ${processingTime}ms`));
            // 保持最近50个错误
            if (this.errors.length > 50) {
                this.errors = this.errors.slice(-50);
            }
        }
        // 计算错误率
        this.metrics.errorRate = this.errors.length / Math.max(this.metrics.requestsProcessed, 1);
    }
    /**
     * 创建处理错误
     */
    createProcessingError(error, request) {
        const processingError = new Error(`Anthropic Protocol processing failed: ${error.message}`);
        // 添加调试信息
        processingError.originalError = error;
        processingError.requestModel = request.model;
        processingError.baseURL = this.protocolConfig.baseURL || 'https://api.anthropic.com';
        return processingError;
    }
    /**
     * 健康检查
     */
    async onHealthCheck() {
        try {
            // 检查配置有效性
            if (!this.protocolConfig.apiKey) {
                return {
                    healthy: false,
                    details: { error: 'No API key configured' }
                };
            }
            // 检查错误率
            if (this.metrics.errorRate > 0.5) {
                return {
                    healthy: false,
                    details: {
                        error: 'High error rate',
                        errorRate: this.metrics.errorRate,
                        recentErrors: this.errors.slice(-5).map(e => e.message)
                    }
                };
            }
            // 检查平均响应时间
            if (this.metrics.averageProcessingTime > this.protocolConfig.timeout * 0.8) {
                return {
                    healthy: false,
                    details: {
                        error: 'High response time',
                        averageTime: this.metrics.averageProcessingTime,
                        timeout: this.protocolConfig.timeout
                    }
                };
            }
            return {
                healthy: true,
                details: {
                    baseURL: this.protocolConfig.baseURL || 'https://api.anthropic.com',
                    model: this.protocolConfig.defaultModel,
                    requestsProcessed: this.metrics.requestsProcessed,
                    averageProcessingTime: this.metrics.averageProcessingTime,
                    errorRate: this.metrics.errorRate,
                    enableToolCalls: this.protocolConfig.enableToolCalls,
                    sdkVersion: 'official'
                }
            };
        }
        catch (error) {
            return {
                healthy: false,
                details: { error: error instanceof Error ? error.message : String(error) }
            };
        }
    }
    /**
     * 获取当前配置
     */
    getConfig() {
        return { ...this.protocolConfig };
    }
    /**
     * 测试API连接
     */
    async testConnection() {
        try {
            const testRequest = {
                model: this.protocolConfig.defaultModel,
                messages: [{ role: 'user', content: 'test' }],
                max_tokens: 1
            };
            await this.callAnthropicAPI(testRequest);
            return true;
        }
        catch (error) {
            if (this.protocolConfig.debug) {
                console.error('[Anthropic Protocol] Connection test failed:', error);
            }
            return false;
        }
    }
}
exports.AnthropicProtocolHandler = AnthropicProtocolHandler;
//# sourceMappingURL=anthropic-protocol-handler.js.map