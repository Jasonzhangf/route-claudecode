/**
 * Anthropic Protocol处理器
 *
 * 基于官方 @anthropic-ai/sdk 实现的Anthropic协议处理器
 *
 * @author Jason Zhang
 */
import { ModuleInterface, ModuleType, ModuleStatus, ModuleMetrics } from '../../interfaces/module/base-module';
import { EventEmitter } from 'events';
import { StandardRequest } from '../../interfaces/standard/request';
import { StandardResponse } from '../../interfaces/standard/response';
/**
 * Anthropic Protocol配置接口
 */
export interface AnthropicProtocolConfig {
    /** API密钥 */
    apiKey: string;
    /** API端点URL (可选，默认使用官方端点) */
    baseURL?: string;
    /** 默认模型 */
    defaultModel: string;
    /** 请求超时(毫秒) */
    timeout: number;
    /** 最大重试次数 */
    maxRetries: number;
    /** 启用工具调用 */
    enableToolCalls: boolean;
    /** 调试模式 */
    debug: boolean;
}
/**
 * Anthropic Protocol处理器实现
 */
export declare class AnthropicProtocolHandler extends EventEmitter implements ModuleInterface {
    protected readonly id: string;
    protected readonly name: string;
    protected readonly type: ModuleType;
    protected readonly version: string;
    protected status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
    protected metrics: ModuleMetrics;
    private processingTimes;
    private errors;
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
    private handleRequest;
    private protocolConfig;
    private anthropicClient;
    constructor(id?: string, config?: Partial<AnthropicProtocolConfig>);
    /**
     * 初始化Anthropic客户端
     */
    private initializeClient;
    /**
     * 配置处理
     */
    protected onConfigure(config: Partial<AnthropicProtocolConfig>): Promise<void>;
    /**
     * 主要处理逻辑
     */
    protected onProcess(input: StandardRequest): Promise<StandardResponse>;
    /**
     * 转换标准请求到Anthropic格式
     */
    private transformToAnthropic;
    /**
     * 转换消息格式
     */
    private transformMessages;
    /**
     * 转换消息内容
     */
    private transformMessageContent;
    /**
     * 转换工具定义
     */
    private transformTools;
    /**
     * 转换工具选择
     */
    private transformToolChoice;
    /**
     * 调用Anthropic API
     */
    private callAnthropicAPI;
    /**
     * 转换Anthropic响应到标准格式
     */
    private transformFromAnthropic;
    /**
     * 转换Anthropic消息到标准格式
     */
    private transformAnthropicMessage;
    /**
     * 映射停止原因
     */
    private mapStopReason;
    /**
     * 更新处理指标
     */
    private updateProcessingMetrics;
    /**
     * 创建处理错误
     */
    private createProcessingError;
    /**
     * 健康检查
     */
    protected onHealthCheck(): Promise<{
        healthy: boolean;
        details: any;
    }>;
    /**
     * 获取当前配置
     */
    getConfig(): AnthropicProtocolConfig;
    /**
     * 测试API连接
     */
    testConnection(): Promise<boolean>;
}
//# sourceMappingURL=anthropic-protocol-handler.d.ts.map