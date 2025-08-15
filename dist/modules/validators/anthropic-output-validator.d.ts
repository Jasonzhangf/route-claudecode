/**
 * Anthropic输出验证模块
 *
 * 验证输出是否符合Anthropic API响应格式
 *
 * @author Jason Zhang
 */
import { BaseModule } from '../base-module-impl';
import { StandardResponse } from '../../interfaces/standard/response';
/**
 * Anthropic输出验证模块配置
 */
export interface AnthropicOutputValidatorConfig {
    strictMode: boolean;
    validateTokens: boolean;
    validateTimestamp: boolean;
    allowEmptyContent: boolean;
}
/**
 * Anthropic输出验证模块
 */
export declare class AnthropicOutputValidator extends BaseModule {
    private validatorConfig;
    constructor(id: string, config?: Partial<AnthropicOutputValidatorConfig>);
    /**
     * 配置处理
     */
    protected onConfigure(config: Partial<AnthropicOutputValidatorConfig>): Promise<void>;
    /**
     * 处理输出验证
     */
    protected onProcess(input: any): Promise<StandardResponse>;
    /**
     * 验证基本结构
     */
    private validateBasicStructure;
    /**
     * 验证必需字段
     */
    private validateRequiredFields;
    /**
     * 验证响应内容
     */
    private validateContent;
    /**
     * 验证文本块
     */
    private validateTextBlock;
    /**
     * 验证工具使用块
     */
    private validateToolUseBlock;
    /**
     * 验证使用统计
     */
    private validateUsage;
    /**
     * 验证停止原因
     */
    private validateStopReason;
    /**
     * 验证时间戳
     */
    private validateTimestamp;
    /**
     * 验证无额外字段
     */
    private validateNoExtraFields;
}
//# sourceMappingURL=anthropic-output-validator.d.ts.map