/**
 * OpenAI Protocol处理器
 *
 * 基于官方 openai SDK 实现的OpenAI协议处理器
 *
 * @author Jason Zhang
 */
import { ModuleInterface, ModuleType, ModuleStatus, ModuleMetrics } from '../interfaces/module/base-module';
import { EventEmitter } from 'events';
import { StandardRequest } from '../types/src/index';
import { StandardResponse } from '../types/src/index';
/**
 * OpenAI Protocol配置接口
 */
export interface OpenAIProtocolConfig {
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
    /** 启用流式响应 */
    enableStreaming: boolean;
    /** 启用工具调用 */
    enableToolCalls: boolean;
    /** 调试模式 */
    debug: boolean;
}
/**
 * OpenAI Protocol处理器实现
 */
export declare class OpenAIProtocolHandler extends EventEmitter implements ModuleInterface {
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
    private openaiClient;
    constructor(id?: string, config?: Partial<OpenAIProtocolConfig>);
    /**
     * 初始化OpenAI客户端
     */
    private initializeClient;
    /**
     * 配置处理
     */
    protected onConfigure(config: Partial<OpenAIProtocolConfig>): Promise<void>;
    /**
     * 主要处理逻辑
     */
    protected onProcess(input: StandardRequest): Promise<StandardResponse>;
    /**
     * 转换标准请求到OpenAI格式
     */
    private transformToOpenAI;
    /**
     * 转换消息格式
     */
    private transformMessages;
    /**
     * 转换工具定义
     */
    private transformTools;
    /**
     * 转换工具选择
     */
    private transformToolChoice;
    /**
     * 调用OpenAI API
     */
    private callOpenAIAPI;
    /**
     * 转换OpenAI响应到标准格式
     */
    private transformFromOpenAI;
    /**
     * 映射结束原因
     */
    private mapFinishReason;
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
    getConfig(): OpenAIProtocolConfig;
    /**
     * 测试API连接
     */
    testConnection(): Promise<boolean>;
    private connections;
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
    /**
     * 获取连接状态
     */
    getConnectionStatus(targetModuleId: string): 'connected' | 'disconnected' | 'connecting' | 'error';
    /**
     * 验证连接
     */
    validateConnection(targetModule: ModuleInterface): boolean;
}
//# sourceMappingURL=openai-protocol-handler.d.ts.map