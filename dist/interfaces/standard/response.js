"use strict";
/**
 * 标准响应数据结构接口
 *
 * 定义系统内部使用的标准化响应格式
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StandardResponseBuilder = void 0;
/**
 * 标准响应构建器
 */
class StandardResponseBuilder {
    response = {};
    constructor(id) {
        this.response = {
            id,
            choices: [],
            timestamp: new Date(),
            metadata: {
                requestId: '',
                provider: '',
                model: '',
                originalFormat: 'anthropic',
                targetFormat: 'anthropic',
                processingSteps: [],
                performance: {
                    totalTime: 0,
                    apiCallTime: 0,
                    transformationTime: 0,
                    validationTime: 0,
                    retryCount: 0
                }
            }
        };
    }
    /**
     * 设置选择项列表
     */
    setChoices(choices) {
        this.response.choices = choices;
        return this;
    }
    /**
     * 添加选择项
     */
    addChoice(choice) {
        if (!this.response.choices) {
            this.response.choices = [];
        }
        this.response.choices.push(choice);
        return this;
    }
    /**
     * 设置使用统计
     */
    setUsage(usage) {
        this.response.usage = usage;
        return this;
    }
    /**
     * 设置模型名称
     */
    setModel(model) {
        this.response.model = model;
        return this;
    }
    /**
     * 设置创建时间
     */
    setCreated(created) {
        this.response.created = created;
        return this;
    }
    /**
     * 设置元数据
     */
    setMetadata(metadata) {
        this.response.metadata = { ...this.response.metadata, ...metadata };
        return this;
    }
    /**
     * 添加处理步骤
     */
    addProcessingStep(step) {
        if (!this.response.metadata) {
            this.response.metadata = {};
        }
        if (!this.response.metadata.processingSteps) {
            this.response.metadata.processingSteps = [];
        }
        this.response.metadata.processingSteps.push(step);
        return this;
    }
    /**
     * 设置性能指标
     */
    setPerformanceMetrics(metrics) {
        if (!this.response.metadata) {
            this.response.metadata = {};
        }
        this.response.metadata.performance = {
            ...this.response.metadata.performance,
            ...metrics
        };
        return this;
    }
    /**
     * 构建响应
     */
    build() {
        // 验证必需字段
        if (!this.response.id || !this.response.choices || !this.response.metadata) {
            throw new Error('Missing required fields in StandardResponse');
        }
        return this.response;
    }
    /**
     * 从Anthropic格式创建
     */
    static fromAnthropic(anthropicResponse) {
        const builder = new StandardResponseBuilder(anthropicResponse.id);
        // 转换选择项
        const choices = [{
                index: 0,
                message: {
                    role: 'assistant',
                    content: anthropicResponse.content || []
                },
                finishReason: mapAnthropicStopReason(anthropicResponse.stop_reason)
            }];
        builder.setChoices(choices);
        if (anthropicResponse.usage) {
            builder.setUsage({
                promptTokens: anthropicResponse.usage.input_tokens || 0,
                completionTokens: anthropicResponse.usage.output_tokens || 0,
                totalTokens: (anthropicResponse.usage.input_tokens || 0) + (anthropicResponse.usage.output_tokens || 0)
            });
        }
        if (anthropicResponse.model) {
            builder.setModel(anthropicResponse.model);
        }
        builder.setMetadata({
            originalFormat: 'anthropic',
            targetFormat: 'anthropic'
        });
        return builder;
    }
    /**
     * 从OpenAI格式创建
     */
    static fromOpenAI(openaiResponse) {
        const builder = new StandardResponseBuilder(openaiResponse.id);
        // 转换选择项
        const choices = openaiResponse.choices?.map((choice) => ({
            index: choice.index,
            message: choice.message,
            finishReason: choice.finish_reason,
            logprobs: choice.logprobs
        })) || [];
        builder.setChoices(choices);
        if (openaiResponse.usage) {
            builder.setUsage(openaiResponse.usage);
        }
        if (openaiResponse.model) {
            builder.setModel(openaiResponse.model);
        }
        if (openaiResponse.created) {
            builder.setCreated(openaiResponse.created);
        }
        builder.setMetadata({
            originalFormat: 'openai',
            targetFormat: 'openai'
        });
        return builder;
    }
}
exports.StandardResponseBuilder = StandardResponseBuilder;
/**
 * 映射Anthropic停止原因
 */
function mapAnthropicStopReason(anthropicReason) {
    switch (anthropicReason) {
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
//# sourceMappingURL=response.js.map