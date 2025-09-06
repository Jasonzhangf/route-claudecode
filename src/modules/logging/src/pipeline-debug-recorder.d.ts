/**
 * 真实的Pipeline Debug记录器
 *
 * 为RCC v4.0提供完整的6层流水线debug记录功能
 * - Layer 0: Client Layer (HTTP请求接收和解析)
 * - Layer 1: Router Layer (路由选择和模型映射)
 * - Layer 2: Transformer Layer (格式转换)
 * - Layer 3: Protocol Layer (协议控制)
 * - Layer 4: Server-Compatibility Layer (第三方服务器兼容)
 * - Layer 5: Server Layer (实际API调用)
 */
export interface PipelineLayerRecord {
    layer: string;
    layerOrder: number;
    module: string;
    moduleId: string;
    input: unknown;
    output: unknown;
    duration: number;
    timestamp: string;
    success: boolean;
    error?: string;
    metadata?: Record<string, unknown>;
}
export interface CompletePipelineDebugRecord {
    requestId: string;
    timestamp: string;
    port: number;
    protocol: 'anthropic' | 'openai' | 'gemini';
    originalRequest: unknown;
    finalResponse: unknown;
    totalDuration: number;
    pipelineSteps: PipelineLayerRecord[];
    compliance: {
        标准1_完整请求路径记录: string;
        标准2_分层request_response验证: string;
        标准3_端口分组Debug记录: string;
        标准4_模块级追踪和映射验证: string;
    };
    config?: {
        configPath?: string;
        routeId?: string;
        providerId?: string;
    };
}
export declare class PipelineDebugRecorder {
    private debugDir;
    private port;
    private enabled;
    constructor(port: number, enabled?: boolean);
    private ensureDebugDir;
    private getTimestamp;
    /**
     * 记录Client层处理 (Layer 0)
     */
    recordClientLayer(requestId: string, input: unknown, output: unknown, duration: number): PipelineLayerRecord;
    /**
     * 记录Router层处理 (Layer 1)
     */
    recordRouterLayer(requestId: string, input: unknown, output: unknown, duration: number, routingDecision: Record<string, unknown>): PipelineLayerRecord;
    /**
     * 记录Transformer层处理 (Layer 2)
     */
    recordTransformerLayer(requestId: string, input: unknown, output: unknown, duration: number, transformType?: string): PipelineLayerRecord;
    /**
     * 记录Protocol层处理 (Layer 3)
     */
    recordProtocolLayer(requestId: string, input: unknown, output: unknown, duration: number, protocolType?: string): PipelineLayerRecord;
    /**
     * 记录Server-Compatibility层处理 (Layer 4)
     */
    recordServerCompatibilityLayer(requestId: string, input: unknown, output: unknown, duration: number, compatibilityType?: string): PipelineLayerRecord;
    /**
     * 记录Server层处理 (Layer 5)
     */
    recordServerLayer(requestId: string, input: unknown, output: unknown, duration: number, success: boolean, error?: string): PipelineLayerRecord;
    /**
     * 记录完整的Pipeline执行
     */
    recordCompleteRequest(record: CompletePipelineDebugRecord): void;
    /**
     * 创建Pipeline执行记录
     */
    createPipelineRecord(requestId: string, protocol: 'anthropic' | 'openai' | 'gemini', originalRequest: unknown, finalResponse: unknown, totalDuration: number, pipelineSteps: PipelineLayerRecord[], config?: Record<string, unknown>): CompletePipelineDebugRecord;
    private updateComplianceReport;
    private detectFormat;
    /**
     * 深度分析 transformer 数据
     */
    private analyzeTransformerData;
    /**
     * 检查是否有 OpenAI 工具格式
     */
    private hasOpenAIToolFormat;
    /**
     * 分析工具格式
     */
    private analyzeToolFormat;
    /**
     * 验证转换是否成功 - 简化版本
     */
    private validateTransformation;
    /**
     * 检查数据是否不为空 - 简化版本
     */
    private isNotEmpty;
    /**
     * 检查工具转换是否正确
     */
    private checkToolsConversion;
    /**
     * 检查消息转换是否正确
     */
    private checkMessagesConversion;
    /**
     * 获取调试目录
     */
    getDebugDir(): string;
    /**
     * 设置调试状态
     */
    setEnabled(enabled: boolean): void;
}
//# sourceMappingURL=pipeline-debug-recorder.d.ts.map