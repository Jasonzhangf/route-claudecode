/**
 * 标准请求数据结构接口
 *
 * 定义系统内部使用的标准化请求格式
 *
 * @author Jason Zhang
 */
import { Message } from './message';
import { Tool } from './tool';
/**
 * 标准请求接口
 */
export interface StandardRequest {
    readonly id: string;
    readonly model: string;
    readonly messages: Message[];
    readonly temperature?: number;
    readonly maxTokens?: number;
    readonly max_tokens?: number;
    readonly top_p?: number;
    readonly stream?: boolean;
    readonly system?: string;
    readonly tools?: Tool[];
    readonly toolChoice?: ToolChoice;
    readonly tool_choice?: ToolChoice;
    readonly stop?: string | string[];
    readonly metadata: RequestMetadata;
    readonly timestamp: Date;
}
/**
 * 工具选择设置
 */
export type ToolChoice = 'auto' | 'required' | 'none' | {
    type: 'function';
    function: {
        name: string;
    };
};
/**
 * 请求元数据
 */
export interface RequestMetadata {
    originalFormat: 'anthropic' | 'openai' | 'gemini';
    targetFormat: 'anthropic' | 'openai' | 'gemini';
    provider: string;
    category: string;
    priority?: number;
    sessionId?: string;
    conversationId?: string;
    userId?: string;
    debugEnabled?: boolean;
    captureLevel?: 'basic' | 'full';
    processingSteps?: string[];
    routingHints?: RoutingHints;
    performance?: PerformanceMetrics;
}
/**
 * 路由提示
 */
export interface RoutingHints {
    preferredProvider?: string;
    excludeProviders?: string[];
    requireFeatures?: string[];
    maxLatency?: number;
    costPreference?: 'low' | 'medium' | 'high';
    qualityPreference?: 'fast' | 'balanced' | 'best';
}
/**
 * 性能指标
 */
export interface PerformanceMetrics {
    startTime: Date;
    routingTime?: number;
    preprocessingTime?: number;
    apiCallTime?: number;
    postprocessingTime?: number;
    totalTime?: number;
    retryCount?: number;
}
/**
 * 标准请求构建器
 */
export declare class StandardRequestBuilder {
    private request;
    constructor(id: string, model: string);
    /**
     * 设置消息列表
     */
    setMessages(messages: Message[]): this;
    /**
     * 添加消息
     */
    addMessage(message: Message): this;
    /**
     * 设置温度参数
     */
    setTemperature(temperature: number): this;
    /**
     * 设置最大令牌数
     */
    setMaxTokens(maxTokens: number): this;
    /**
     * 设置流式模式
     */
    setStream(stream: boolean): this;
    /**
     * 设置工具列表
     */
    setTools(tools: Tool[]): this;
    /**
     * 设置工具选择
     */
    setToolChoice(toolChoice: ToolChoice): this;
    /**
     * 设置停止词
     */
    setStop(stop: string | string[]): this;
    /**
     * 设置元数据
     */
    setMetadata(metadata: Partial<RequestMetadata>): this;
    /**
     * 设置路由提示
     */
    setRoutingHints(hints: RoutingHints): this;
    /**
     * 构建请求
     */
    build(): StandardRequest;
    /**
     * 从Anthropic格式创建
     */
    static fromAnthropic(anthropicRequest: any): StandardRequestBuilder;
    /**
     * 从OpenAI格式创建
     */
    static fromOpenAI(openaiRequest: any): StandardRequestBuilder;
}
//# sourceMappingURL=request.d.ts.map