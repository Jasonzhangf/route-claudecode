/**
 * Anthropic到OpenAI格式转换器
 *
 * 将Anthropic格式的请求转换为OpenAI兼容格式
 *
 * @author Jason Zhang
 */
import { BaseModule } from '../base-module-impl';
import { StandardRequest } from '../../interfaces/standard/request';
/**
 * Anthropic到OpenAI转换器配置
 */
export interface AnthropicToOpenAITransformerConfig {
    model: string;
    preserveToolCalls: boolean;
    mapSystemMessage: boolean;
    defaultMaxTokens: number;
}
/**
 * Anthropic到OpenAI格式转换器
 */
export declare class AnthropicToOpenAITransformer extends BaseModule {
    private transformerConfig;
    constructor(id: string, config?: Partial<AnthropicToOpenAITransformerConfig>);
    /**
     * 配置处理
     */
    protected onConfigure(config: Partial<AnthropicToOpenAITransformerConfig>): Promise<void>;
    /**
     * 处理格式转换
     */
    protected onProcess(input: StandardRequest): Promise<any>;
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
}
//# sourceMappingURL=anthropic-to-openai-transformer.d.ts.map