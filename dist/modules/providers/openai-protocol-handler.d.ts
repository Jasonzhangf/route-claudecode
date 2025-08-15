/**
 * OpenAI Protocol处理器
 *
 * 基于官方 openai SDK 实现的OpenAI协议处理器
 *
 * @author Jason Zhang
 */
import { BaseModule } from '../base-module-impl';
import { StandardRequest } from '../../interfaces/standard/request';
import { StandardResponse } from '../../interfaces/standard/response';
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
export declare class OpenAIProtocolHandler extends BaseModule {
    private protocolConfig;
    private openaiClient;
    constructor(id: string, config?: Partial<OpenAIProtocolConfig>);
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
}
//# sourceMappingURL=openai-protocol-handler.d.ts.map