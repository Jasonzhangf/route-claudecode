/**
 * 标准响应数据结构接口
 *
 * 定义系统内部使用的标准化响应格式
 *
 * @author Jason Zhang
 */
import { Message } from './message';
/**
 * 标准响应接口
 */
export interface StandardResponse {
    readonly id: string;
    readonly choices: Choice[];
    readonly usage?: Usage;
    readonly model?: string;
    readonly created?: number;
    readonly metadata: ResponseMetadata;
    readonly timestamp: Date;
}
/**
 * 选择项
 */
export interface Choice {
    readonly index: number;
    readonly message: Message;
    readonly finishReason: FinishReason;
    readonly logprobs?: LogProbs;
}
/**
 * 完成原因
 */
export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'function_call';
/**
 * 对数概率信息
 */
export interface LogProbs {
    tokens: string[];
    tokenLogprobs: number[];
    topLogprobs: Record<string, number>[];
    textOffset: number[];
}
/**
 * 使用统计
 */
export interface Usage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    promptTokensDetails?: {
        cachedTokens?: number;
    };
    completionTokensDetails?: {
        reasoningTokens?: number;
    };
}
/**
 * 响应元数据
 */
export interface ResponseMetadata {
    requestId: string;
    provider: string;
    model: string;
    originalFormat: 'anthropic' | 'openai' | 'gemini';
    targetFormat: 'anthropic' | 'openai' | 'gemini';
    processingSteps: string[];
    performance: ResponsePerformanceMetrics;
    quality?: ResponseQualityMetrics;
    transformations?: TransformationLog[];
}
/**
 * 响应性能指标
 */
export interface ResponsePerformanceMetrics {
    totalTime: number;
    apiCallTime: number;
    transformationTime: number;
    validationTime: number;
    retryCount: number;
    cacheHit?: boolean;
}
/**
 * 响应质量指标
 */
export interface ResponseQualityMetrics {
    coherenceScore?: number;
    relevanceScore?: number;
    safetyScore?: number;
    toxicityScore?: number;
    factualityScore?: number;
}
/**
 * 转换日志
 */
export interface TransformationLog {
    step: string;
    input: any;
    output: any;
    transformationTime: number;
    warnings?: string[];
    errors?: string[];
}
/**
 * 流式响应接口
 */
export interface StreamResponse {
    id: string;
    choices: StreamChoice[];
    created?: number;
    model?: string;
    metadata?: Partial<ResponseMetadata>;
}
/**
 * 流式选择项
 */
export interface StreamChoice {
    index: number;
    delta: MessageDelta;
    finishReason?: FinishReason;
    logprobs?: LogProbs;
}
/**
 * 消息增量
 */
export interface MessageDelta {
    role?: 'assistant';
    content?: string;
    toolCalls?: ToolCallDelta[];
}
/**
 * 工具调用增量
 */
export interface ToolCallDelta {
    index: number;
    id?: string;
    type?: 'function';
    function?: {
        name?: string;
        arguments?: string;
    };
}
/**
 * 标准响应构建器
 */
export declare class StandardResponseBuilder {
    private response;
    constructor(id: string);
    /**
     * 设置选择项列表
     */
    setChoices(choices: Choice[]): this;
    /**
     * 添加选择项
     */
    addChoice(choice: Choice): this;
    /**
     * 设置使用统计
     */
    setUsage(usage: Usage): this;
    /**
     * 设置模型名称
     */
    setModel(model: string): this;
    /**
     * 设置创建时间
     */
    setCreated(created: number): this;
    /**
     * 设置元数据
     */
    setMetadata(metadata: Partial<ResponseMetadata>): this;
    /**
     * 添加处理步骤
     */
    addProcessingStep(step: string): this;
    /**
     * 设置性能指标
     */
    setPerformanceMetrics(metrics: Partial<ResponsePerformanceMetrics>): this;
    /**
     * 构建响应
     */
    build(): StandardResponse;
    /**
     * 从Anthropic格式创建
     */
    static fromAnthropic(anthropicResponse: any): StandardResponseBuilder;
    /**
     * 从OpenAI格式创建
     */
    static fromOpenAI(openaiResponse: any): StandardResponseBuilder;
}
//# sourceMappingURL=response.d.ts.map