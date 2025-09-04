/**
 * Anthropic输出验证模块
 *
 * 验证输出是否符合Anthropic API响应格式
 *
 * @author Jason Zhang
 */
import { ModuleInterface, ModuleType, ModuleStatus, ModuleMetrics } from '../../interfaces/module/base-module';
import { EventEmitter } from 'events';
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
export declare class AnthropicOutputValidator extends EventEmitter implements ModuleInterface {
    protected readonly id: string;
    protected readonly name: string;
    protected readonly type: ModuleType;
    protected readonly version: string;
    protected status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
    protected metrics: ModuleMetrics;
    protected connections: Map<string, ModuleInterface>;
    getId(): string;
    getName(): string;
    getType(): ModuleType;
    getVersion(): string;
    getStatus(): ModuleStatus;
    getMetrics(): ModuleMetrics;
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
    addConnection(module: ModuleInterface): void;
    removeConnection(moduleId: string): void;
    getConnection(moduleId: string): ModuleInterface | undefined;
    getConnections(): ModuleInterface[];
    hasConnection(moduleId: string): boolean;
    clearConnections(): void;
    getConnectionCount(): number;
    sendToModule(targetModuleId: string, message: any, type?: string): Promise<any>;
    broadcastToModules(message: any, type?: string): Promise<void>;
    onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void): void;
    private validatorConfig;
    constructor(id?: string, config?: Partial<AnthropicOutputValidatorConfig>);
    /**
     * 配置处理
     */
    protected onConfigure(config: Partial<AnthropicOutputValidatorConfig>): Promise<void>;
    /**
     * 处理输出验证
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