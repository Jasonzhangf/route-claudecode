"use strict";
/**
 * 标准请求数据结构接口
 *
 * 定义系统内部使用的标准化请求格式
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StandardRequestBuilder = void 0;
/**
 * 标准请求构建器
 */
class StandardRequestBuilder {
    constructor(id, model) {
        this.request = {};
        this.request = {
            id,
            model,
            messages: [],
            timestamp: new Date(),
            metadata: {
                originalFormat: 'anthropic',
                targetFormat: 'anthropic',
                provider: '',
                category: 'default',
                processingSteps: [],
            },
        };
    }
    /**
     * 设置消息列表
     */
    setMessages(messages) {
        this.request.messages = messages;
        return this;
    }
    /**
     * 添加消息
     */
    addMessage(message) {
        if (!this.request.messages) {
            this.request.messages = [];
        }
        this.request.messages.push(message);
        return this;
    }
    /**
     * 设置温度参数
     */
    setTemperature(temperature) {
        this.request.temperature = temperature;
        return this;
    }
    /**
     * 设置最大令牌数
     */
    setMaxTokens(maxTokens) {
        this.request.maxTokens = maxTokens;
        return this;
    }
    /**
     * 设置流式模式
     */
    setStream(stream) {
        this.request.stream = stream;
        return this;
    }
    /**
     * 设置工具列表
     */
    setTools(tools) {
        this.request.tools = tools;
        return this;
    }
    /**
     * 设置工具选择
     */
    setToolChoice(toolChoice) {
        this.request.toolChoice = toolChoice;
        return this;
    }
    /**
     * 设置停止词
     */
    setStop(stop) {
        this.request.stop = stop;
        return this;
    }
    /**
     * 设置元数据
     */
    setMetadata(metadata) {
        this.request.metadata = { ...this.request.metadata, ...metadata };
        return this;
    }
    /**
     * 设置路由提示
     */
    setRoutingHints(hints) {
        if (!this.request.metadata) {
            this.request.metadata = {};
        }
        this.request.metadata.routingHints = hints;
        return this;
    }
    /**
     * 构建请求
     */
    build() {
        // 验证必需字段
        if (!this.request.id || !this.request.model || !this.request.messages || !this.request.metadata) {
            throw new Error('Missing required fields in StandardRequest');
        }
        return this.request;
    }
    /**
     * 从Anthropic格式创建
     */
    static fromAnthropic(anthropicRequest) {
        const builder = new StandardRequestBuilder(anthropicRequest.id || generateRequestId(), anthropicRequest.model);
        builder
            .setMessages(anthropicRequest.messages || [])
            .setMaxTokens(anthropicRequest.max_tokens)
            .setTemperature(anthropicRequest.temperature)
            .setStream(anthropicRequest.stream || false)
            .setMetadata({
            originalFormat: 'anthropic',
            targetFormat: 'anthropic',
            provider: '',
            category: 'default',
        });
        if (anthropicRequest.tools) {
            builder.setTools(anthropicRequest.tools);
        }
        if (anthropicRequest.tool_choice) {
            builder.setToolChoice(anthropicRequest.tool_choice);
        }
        return builder;
    }
    /**
     * 从OpenAI格式创建
     */
    static fromOpenAI(openaiRequest) {
        const builder = new StandardRequestBuilder(openaiRequest.id || generateRequestId(), openaiRequest.model);
        builder
            .setMessages(openaiRequest.messages || [])
            .setMaxTokens(openaiRequest.max_tokens)
            .setTemperature(openaiRequest.temperature)
            .setStream(openaiRequest.stream || false)
            .setMetadata({
            originalFormat: 'openai',
            targetFormat: 'openai',
            provider: '',
            category: 'default',
        });
        if (openaiRequest.tools) {
            builder.setTools(openaiRequest.tools);
        }
        if (openaiRequest.tool_choice) {
            builder.setToolChoice(openaiRequest.tool_choice);
        }
        if (openaiRequest.stop) {
            builder.setStop(openaiRequest.stop);
        }
        return builder;
    }
}
exports.StandardRequestBuilder = StandardRequestBuilder;
/**
 * 生成请求ID
 */
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
//# sourceMappingURL=request.js.map