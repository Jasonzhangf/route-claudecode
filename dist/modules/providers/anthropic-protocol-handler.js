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
const bootstrap_constants_1 = require("../constants/src/bootstrap-constants");
// 获取Provider请求超时时间的辅助函数
function getProviderRequestTimeout(provider = 'anthropic') {
    return bootstrap_constants_1.API_DEFAULTS.PROVIDERS.ANTHROPIC?.REQUEST_TIMEOUT || 30000;
}
const base_module_1 = require("../interfaces/module/base-module");
const events_1 = require("events");
/**
 * Anthropic Protocol处理器实现
 */
class AnthropicProtocolHandler extends events_1.EventEmitter {
    getId() {
        return this.id;
    }
    getName() {
        return this.name;
    }
    getType() {
        return this.type;
    }
    getVersion() {
        return this.version;
    }
    getStatus() {
        return { id: this.id, name: this.name, type: this.type, status: this.status, health: 'healthy' };
    }
    getMetrics() {
        return { ...this.metrics };
    }
    async configure(config) { }
    async start() {
        this.status = 'running';
    }
    async stop() {
        this.status = 'stopped';
    }
    async reset() { }
    async cleanup() { }
    async healthCheck() {
        return { healthy: true, details: {} };
    }
    async process(input) {
        return this.handleRequest(input);
    }
    async handleRequest(input) {
        return input;
    }
    constructor(id = 'anthropic-protocol-handler', config = {}) {
        super();
        this.id = 'anthropic-protocol-handler';
        this.name = 'Anthropic Protocol Handler';
        this.type = base_module_1.ModuleType.PROTOCOL;
        this.version = '1.0.0';
        this.status = 'stopped';
        this.metrics = {
            requestsProcessed: 0,
            averageProcessingTime: 0,
            errorRate: 0,
            memoryUsage: 0,
            cpuUsage: 0,
        };
        this.processingTimes = [];
        this.errors = [];
        // ModuleInterface连接管理方法
        this.connections = new Map();
        this.protocolConfig = {
            apiKey: '',
            defaultModel: 'claude-3-sonnet-20240229',
            timeout: getProviderRequestTimeout(),
            maxRetries: 3,
            enableToolCalls: true,
            debug: false,
            ...config,
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
                enableToolCalls: this.protocolConfig.enableToolCalls,
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
            max_tokens: request.maxTokens || 4096,
        };
        // 可选参数
        if (request.temperature !== undefined) {
            anthropicRequest.temperature = request.temperature;
        }
        if (request.topP !== undefined) {
            anthropicRequest.top_p = request.topP;
        }
        if (request.system) {
            anthropicRequest.system = request.system;
        }
        if (request.stopSequences) {
            anthropicRequest.stop_sequences = Array.isArray(request.stopSequences) ? request.stopSequences : [request.stopSequences];
        }
        // 处理工具调用
        if (request.tools && this.protocolConfig.enableToolCalls) {
            anthropicRequest.tools = this.transformTools(request.tools);
            if (request.toolChoice) {
                anthropicRequest.tool_choice = this.transformToolChoice(request.toolChoice);
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
                anthropicMessages.push({
                    role: 'user',
                    content: this.transformMessageContent(message.content),
                });
            }
            else if (message.role === 'assistant') {
                const content = [];
                // 添加文本内容
                if (message.content) {
                    if (typeof message.content === 'string') {
                        content.push({
                            type: 'text',
                            text: message.content,
                        });
                    }
                }
                anthropicMessages.push({
                    role: 'assistant',
                    content: content.length === 1 && content[0] && content[0].type === 'text' ? content[0].text || '' : content,
                });
            }
            else if (message.role === 'tool') {
                anthropicMessages.push({
                    role: 'user',
                    content: [
                        {
                            type: 'tool_result',
                            tool_use_id: 'tool_call_id', // This would need to be extracted from the message
                            content: typeof message.content === 'string' ? message.content : String(message.content),
                        },
                    ],
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
                        text: block.text,
                    };
                }
                else if (block.type === 'image') {
                    return {
                        type: 'image',
                        source: block.source,
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
                required: tool.function.parameters.required || [],
            },
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
                name: toolChoice.function.name,
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
        const choices = [
            {
                index: 0,
                message: this.transformAnthropicMessage(response),
                finish_reason: this.mapStopReason(response.stop_reason),
            },
        ];
        const usage = {
            prompt_tokens: response.usage.input_tokens,
            completion_tokens: response.usage.output_tokens,
            total_tokens: response.usage.input_tokens + response.usage.output_tokens,
        };
        const standardResponse = {
            id: response.id,
            choices,
            usage,
            model: response.model,
            created: Math.floor(Date.now() / 1000),
        };
        return standardResponse;
    }
    /**
     * 转换Anthropic消息到标准格式
     */
    transformAnthropicMessage(anthropicMessage) {
        // 处理内容
        const textBlocks = [];
        for (const block of anthropicMessage.content) {
            if (block.type === 'text') {
                textBlocks.push(block.text);
            }
        }
        return {
            role: 'assistant',
            content: textBlocks.join('\n').trim(),
        };
    }
    /**
     * 映射停止原因
     */
    mapStopReason(reason) {
        switch (reason) {
            case 'end_turn':
                return 'stop';
            case 'max_tokens':
                return 'length';
            case 'tool_use':
                return 'tool_calls';
            case 'stop_sequence':
                return 'stop';
            default:
                return 'stop';
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
                    details: { error: 'No API key configured' },
                };
            }
            // 检查错误率
            if (this.metrics.errorRate > 0.5) {
                return {
                    healthy: false,
                    details: {
                        error: 'High error rate',
                        errorRate: this.metrics.errorRate,
                        recentErrors: this.errors.slice(-5).map(e => e.message),
                    },
                };
            }
            // 检查平均响应时间
            if (this.metrics.averageProcessingTime > this.protocolConfig.timeout * 0.8) {
                return {
                    healthy: false,
                    details: {
                        error: 'High response time',
                        averageTime: this.metrics.averageProcessingTime,
                        timeout: this.protocolConfig.timeout,
                    },
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
                    sdkVersion: 'official',
                },
            };
        }
        catch (error) {
            return {
                healthy: false,
                details: { error: error instanceof Error ? error.message : String(error) },
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
                max_tokens: 1,
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
    addConnection(module) {
        this.connections.set(module.getId(), module);
    }
    removeConnection(moduleId) {
        this.connections.delete(moduleId);
    }
    getConnection(moduleId) {
        return this.connections.get(moduleId);
    }
    getConnections() {
        return Array.from(this.connections.values());
    }
    hasConnection(moduleId) {
        return this.connections.has(moduleId);
    }
    clearConnections() {
        this.connections.clear();
    }
    getConnectionCount() {
        return this.connections.size;
    }
    // 模块间通信方法
    async sendToModule(targetModuleId, message, type) {
        const targetModule = this.connections.get(targetModuleId);
        if (targetModule) {
            // 发送消息到目标模块
            targetModule.onModuleMessage((sourceModuleId, msg, msgType) => {
                this.emit('moduleMessage', { fromModuleId: sourceModuleId, message: msg, type: msgType, timestamp: new Date() });
            });
            return Promise.resolve({ success: true, targetModuleId, message, type });
        }
        return Promise.resolve({ success: false, targetModuleId, message, type });
    }
    async broadcastToModules(message, type) {
        const promises = [];
        this.connections.forEach(module => {
            promises.push(this.sendToModule(module.getId(), message, type));
        });
        await Promise.allSettled(promises);
    }
    onModuleMessage(listener) {
        this.on('moduleMessage', (data) => {
            listener(data.fromModuleId, data.message, data.type);
        });
    }
    /**
     * 获取连接状态
     */
    getConnectionStatus(targetModuleId) {
        const connection = this.connections.get(targetModuleId);
        if (!connection) {
            return 'disconnected';
        }
        const status = connection.getStatus();
        return status.status === 'running' ? 'connected' : status.status;
    }
    /**
     * 验证连接
     */
    validateConnection(targetModule) {
        try {
            const status = targetModule.getStatus();
            const metrics = targetModule.getMetrics();
            return status.status === 'running' && status.health === 'healthy';
        }
        catch (error) {
            return false;
        }
    }
}
exports.AnthropicProtocolHandler = AnthropicProtocolHandler;
//# sourceMappingURL=anthropic-protocol-handler.js.map