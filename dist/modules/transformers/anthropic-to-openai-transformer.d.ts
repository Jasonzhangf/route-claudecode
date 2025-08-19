/**
 * ⚠️ DEPRECATED - SECURITY VULNERABILITIES FOUND ⚠️
 *
 * This transformer implementation has been deprecated due to critical security vulnerabilities
 * identified in the security audit report. DO NOT USE in production.
 *
 * Security Issues:
 * - Hardcoded configuration values
 * - Unsafe JSON parsing (lines 265, 361)
 * - Missing input validation and boundary checks
 * - No timeout protection
 * - Business logic mixed with protocol conversion
 * - Information disclosure in error messages
 *
 * Migration Path:
 * Use SecureAnthropicToOpenAITransformer instead:
 * import { SecureAnthropicToOpenAITransformer } from './secure-anthropic-openai-transformer';
 *
 * @deprecated Use SecureAnthropicToOpenAITransformer instead
 * @security-risk HIGH - Multiple critical vulnerabilities
 * @author Jason Zhang
 */
import { IModuleInterface, ModuleType, IModuleStatus, IModuleMetrics } from '../../interfaces/core/module-implementation-interface';
import { EventEmitter } from 'events';
/**
 * Anthropic到OpenAI转换器配置
 */
export interface AnthropicToOpenAITransformerConfig {
    model: string;
    preserveToolCalls: boolean;
    mapSystemMessage: boolean;
    defaultMaxTokens: number;
    modelMapping?: {
        [key: string]: string;
    };
    modelMaxTokens?: {
        [key: string]: number;
    };
    apiMaxTokens?: number;
}
/**
 * Anthropic到OpenAI格式转换器
 */
export declare class AnthropicToOpenAITransformer extends EventEmitter implements IModuleInterface {
    protected readonly id: string;
    protected readonly name: string;
    protected readonly type: ModuleType;
    protected readonly version: string;
    protected status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
    protected metrics: IModuleMetrics;
    getId(): string;
    getName(): string;
    getType(): ModuleType;
    getVersion(): string;
    getStatus(): IModuleStatus;
    getMetrics(): IModuleMetrics;
    configure(config: any): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    reset(): Promise<void>;
    cleanup(): Promise<void>;
    healthCheck(): Promise<{
        healthy: boolean;
        details: any;
    }>;
    process(input: any): Promise<any>;
    private transformerConfig;
    constructor(id?: string, config?: Partial<AnthropicToOpenAITransformerConfig>);
    /**
     * 配置处理
     */
    protected onConfigure(config: Partial<AnthropicToOpenAITransformerConfig>): Promise<void>;
    /**
     * 处理格式转换 - 支持请求和响应双向转换
     */
    protected onProcess(input: any): Promise<any>;
    /**
     * 判断是否为Anthropic请求
     */
    private isAnthropicRequest;
    /**
     * 判断是否为OpenAI响应
     */
    private isOpenAIResponse;
    /**
     * 转换Anthropic请求为OpenAI格式
     */
    private convertRequestToOpenAI;
    /**
     * 转换OpenAI响应为Anthropic格式
     */
    private convertResponseToAnthropic;
    /**
     * 转换停止原因
     */
    private convertStopReason;
    /**
     * 转换消息格式
     */
    private convertMessages;
    /**
     * 转换消息内容
     */
    private convertMessageContent;
    /**
     * 从Anthropic内容中提取工具调用
     */
    private extractToolCallsFromContent;
    /**
     * 转换工具定义
     */
    private convertTools;
    /**
     * 转换工具选择
     */
    private convertToolChoice;
    /**
     * 限制max_tokens在API允许范围内
     */
    private clampMaxTokens;
    /**
     * 获取最优的max_tokens默认值
     */
    private getOptimalMaxTokens;
    /**
     * 从配置中获取模型的最大token限制
     */
    private getModelMaxTokensFromConfig;
}
//# sourceMappingURL=anthropic-to-openai-transformer.d.ts.map