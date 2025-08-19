/**
 * Anthropic输入验证模块
 *
 * 验证输入是否符合Anthropic API标准格式
 *
 * @author Jason Zhang
 */
import { IModuleInterface, ModuleType, IModuleStatus, IModuleMetrics } from '../../interfaces/core/module-implementation-interface';
import { EventEmitter } from 'events';
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
export declare class AnthropicInputValidator extends EventEmitter implements IModuleInterface {
    protected readonly id: string;
    protected readonly name: string;
    protected readonly type: ModuleType;
    protected readonly version: string;
    protected status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
    protected config: AnthropicInputValidatorConfig;
    protected metrics: IModuleMetrics;
    private validatorConfig;
    constructor(config?: Partial<AnthropicInputValidatorConfig>);
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
    private updateMetrics;
    private validateInput;
    /**
     * 配置处理
     */
    protected onConfigure(config: Partial<AnthropicInputValidatorConfig>): Promise<void>;
    /**
     * 处理输入验证
     */
    protected onProcess(input: any): Promise<any>;
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