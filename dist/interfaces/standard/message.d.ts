/**
 * 标准消息数据结构接口
 *
 * 定义统一的消息格式，支持多种内容类型
 *
 * @author Jason Zhang
 */
/**
 * 消息接口
 */
export interface Message {
    readonly role: MessageRole;
    readonly content: string | ContentBlock[];
    readonly name?: string;
    readonly metadata?: MessageMetadata;
}
/**
 * 消息角色
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';
/**
 * 内容块
 */
export interface ContentBlock {
    readonly type: ContentBlockType;
    readonly text?: string;
    readonly id?: string;
    readonly name?: string;
    readonly input?: Record<string, any>;
    readonly content?: string;
    readonly toolUseId?: string;
    readonly source?: MediaSource;
    readonly mediaType?: string;
}
/**
 * 内容块类型
 */
export type ContentBlockType = 'text' | 'tool_use' | 'tool_result' | 'image' | 'audio' | 'video' | 'document';
/**
 * 媒体源
 */
export interface MediaSource {
    type: 'base64' | 'url' | 'file';
    data: string;
    metadata?: {
        filename?: string;
        size?: number;
        mimeType?: string;
    };
}
/**
 * 消息元数据
 */
export interface MessageMetadata {
    timestamp?: Date;
    source?: 'user' | 'system' | 'api';
    tags?: string[];
    annotations?: Annotation[];
    originalFormat?: 'anthropic' | 'openai' | 'gemini';
}
/**
 * 注释
 */
export interface Annotation {
    type: 'highlight' | 'note' | 'warning' | 'error';
    start: number;
    end: number;
    text: string;
    metadata?: Record<string, any>;
}
/**
 * 系统消息接口
 */
export interface SystemMessage extends Message {
    role: 'system';
    content: string;
    instructions?: string[];
    constraints?: string[];
    examples?: Example[];
}
/**
 * 示例
 */
export interface Example {
    input: string;
    output: string;
    description?: string;
}
/**
 * 用户消息接口
 */
export interface UserMessage extends Message {
    role: 'user';
    content: string | ContentBlock[];
    attachments?: Attachment[];
}
/**
 * 助手消息接口
 */
export interface AssistantMessage extends Message {
    role: 'assistant';
    content: string | ContentBlock[];
    toolCalls?: ToolCall[];
    reasoning?: string;
}
/**
 * 工具消息接口
 */
export interface ToolMessage extends Message {
    role: 'tool';
    content: string;
    toolCallId: string;
    status: 'success' | 'error';
    errorMessage?: string;
}
/**
 * 工具调用
 */
export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}
/**
 * 附件
 */
export interface Attachment {
    id: string;
    name: string;
    type: string;
    size: number;
    content: string;
    metadata?: Record<string, any>;
}
/**
 * 消息构建器
 */
export declare class MessageBuilder {
    private message;
    constructor(role: MessageRole);
    /**
     * 设置文本内容
     */
    setText(text: string): this;
    /**
     * 设置内容块列表
     */
    setContentBlocks(blocks: ContentBlock[]): this;
    /**
     * 添加文本块
     */
    addTextBlock(text: string): this;
    /**
     * 添加工具使用块
     */
    addToolUseBlock(id: string, name: string, input: Record<string, any>): this;
    /**
     * 添加工具结果块
     */
    addToolResultBlock(toolUseId: string, content: string): this;
    /**
     * 添加图片块
     */
    addImageBlock(source: MediaSource, mediaType?: string): this;
    /**
     * 设置消息名称
     */
    setName(name: string): this;
    /**
     * 设置元数据
     */
    setMetadata(metadata: Partial<MessageMetadata>): this;
    /**
     * 添加标签
     */
    addTag(tag: string): this;
    /**
     * 添加注释
     */
    addAnnotation(annotation: Annotation): this;
    /**
     * 构建消息
     */
    build(): Message;
    /**
     * 确保内容是块数组
     */
    private ensureContentBlocksArray;
    /**
     * 从Anthropic格式创建
     */
    static fromAnthropic(anthropicMessage: any): MessageBuilder;
    /**
     * 从OpenAI格式创建
     */
    static fromOpenAI(openaiMessage: any): MessageBuilder;
}
//# sourceMappingURL=message.d.ts.map