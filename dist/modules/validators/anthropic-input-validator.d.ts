/**
 * Anthropic输入验证模块
 *
 * 验证输入是否符合Anthropic API标准格式
 *
 * @author Jason Zhang
 */
import { BaseModule } from '../base-module-impl';
import { StandardRequest } from '../../interfaces/standard/request';
/**
 * Anthropic输入验证模块配置
 */
export interface AnthropicInputValidatorConfig {
    strictMode: boolean;
    allowExtraFields: boolean;
    maxMessagesLength: number;
    maxMessageLength: number;
    maxToolsLength: number;
}
/**
 * Anthropic输入验证模块
 */
export declare class AnthropicInputValidator extends BaseModule {
    private validatorConfig;
    constructor(id: string, config?: Partial<AnthropicInputValidatorConfig>);
    /**
     * 配置处理
     */
    protected onConfigure(config: Partial<AnthropicInputValidatorConfig>): Promise<void>;
    /**
     * 处理输入验证
     */
    protected onProcess(input: any): Promise<StandardRequest>;
    /**
     * 验证基本结构
     */
    private validateBasicStructure;
    /**
     * 验证必需字段
     */
    private validateRequiredFields;
    /**
     * 验证消息格式
     */
    private validateMessages;
    /**
     * 验证消息内容块
     */
    private validateMessageContentBlocks;
    /**
     * 验证工具格式
     */
    private validateTools;
    /**
     * 验证参数范围
     */
    private validateParameterRanges;
    /**
     * 验证无额外字段
     */
    private validateNoExtraFields;
}
//# sourceMappingURL=anthropic-input-validator.d.ts.map