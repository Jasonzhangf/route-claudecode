"use strict";
/**
 * 标准消息数据结构接口
 *
 * 定义统一的消息格式，支持多种内容类型
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageBuilder = void 0;
/**
 * 消息构建器
 */
class MessageBuilder {
    message = {};
    constructor(role) {
        this.message = {
            role,
            content: '',
            metadata: {
                timestamp: new Date(),
                source: 'api'
            }
        };
    }
    /**
     * 设置文本内容
     */
    setText(text) {
        this.message.content = text;
        return this;
    }
    /**
     * 设置内容块列表
     */
    setContentBlocks(blocks) {
        this.message.content = blocks;
        return this;
    }
    /**
     * 添加文本块
     */
    addTextBlock(text) {
        this.ensureContentBlocksArray();
        this.message.content.push({
            type: 'text',
            text
        });
        return this;
    }
    /**
     * 添加工具使用块
     */
    addToolUseBlock(id, name, input) {
        this.ensureContentBlocksArray();
        this.message.content.push({
            type: 'tool_use',
            id,
            name,
            input
        });
        return this;
    }
    /**
     * 添加工具结果块
     */
    addToolResultBlock(toolUseId, content) {
        this.ensureContentBlocksArray();
        this.message.content.push({
            type: 'tool_result',
            toolUseId,
            content
        });
        return this;
    }
    /**
     * 添加图片块
     */
    addImageBlock(source, mediaType = 'image/png') {
        this.ensureContentBlocksArray();
        this.message.content.push({
            type: 'image',
            source,
            mediaType
        });
        return this;
    }
    /**
     * 设置消息名称
     */
    setName(name) {
        this.message.name = name;
        return this;
    }
    /**
     * 设置元数据
     */
    setMetadata(metadata) {
        this.message.metadata = { ...this.message.metadata, ...metadata };
        return this;
    }
    /**
     * 添加标签
     */
    addTag(tag) {
        if (!this.message.metadata) {
            this.message.metadata = {};
        }
        if (!this.message.metadata.tags) {
            this.message.metadata.tags = [];
        }
        this.message.metadata.tags.push(tag);
        return this;
    }
    /**
     * 添加注释
     */
    addAnnotation(annotation) {
        if (!this.message.metadata) {
            this.message.metadata = {};
        }
        if (!this.message.metadata.annotations) {
            this.message.metadata.annotations = [];
        }
        this.message.metadata.annotations.push(annotation);
        return this;
    }
    /**
     * 构建消息
     */
    build() {
        if (!this.message.role || !this.message.content) {
            throw new Error('Missing required fields in Message');
        }
        return this.message;
    }
    /**
     * 确保内容是块数组
     */
    ensureContentBlocksArray() {
        if (typeof this.message.content === 'string') {
            // Only convert non-empty strings to text blocks
            if (this.message.content.length > 0) {
                this.message.content = [{ type: 'text', text: this.message.content }];
            }
            else {
                this.message.content = [];
            }
        }
        else if (!Array.isArray(this.message.content)) {
            this.message.content = [];
        }
    }
    /**
     * 从Anthropic格式创建
     */
    static fromAnthropic(anthropicMessage) {
        const builder = new MessageBuilder(anthropicMessage.role);
        if (typeof anthropicMessage.content === 'string') {
            builder.setText(anthropicMessage.content);
        }
        else if (Array.isArray(anthropicMessage.content)) {
            builder.setContentBlocks(anthropicMessage.content);
        }
        if (anthropicMessage.name) {
            builder.setName(anthropicMessage.name);
        }
        builder.setMetadata({
            originalFormat: 'anthropic'
        });
        return builder;
    }
    /**
     * 从OpenAI格式创建
     */
    static fromOpenAI(openaiMessage) {
        const builder = new MessageBuilder(openaiMessage.role);
        if (openaiMessage.content) {
            builder.setText(openaiMessage.content);
        }
        if (openaiMessage.name) {
            builder.setName(openaiMessage.name);
        }
        // 处理工具调用
        if (openaiMessage.tool_calls) {
            for (const toolCall of openaiMessage.tool_calls) {
                builder.addToolUseBlock(toolCall.id, toolCall.function.name, JSON.parse(toolCall.function.arguments));
            }
        }
        builder.setMetadata({
            originalFormat: 'openai'
        });
        return builder;
    }
}
exports.MessageBuilder = MessageBuilder;
//# sourceMappingURL=message.js.map