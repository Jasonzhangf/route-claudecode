/**
 * Pipeline集成HTTP服务器
 *
 * 将Pipeline管理系统集成到HTTP服务器中，实现完整的请求处理流程
 *
 * @author Jason Zhang
 */
import { ServerConfig, MiddlewareFunction, RouteHandler } from './http-server';
import { PipelineConfig } from '../interfaces/pipeline/pipeline-framework';
import { IMiddlewareManager } from '../interfaces/core';
import { ServerStatus } from '../interfaces';
import { IPipelineService } from '../interfaces/core/pipeline-abstraction';
import { EventEmitter } from 'events';
/**
 * Pipeline服务器配置
 */
export interface PipelineServerConfig extends ServerConfig {
    pipelines: PipelineConfig[];
    enableAuth?: boolean;
    enableValidation?: boolean;
    enableCors?: boolean;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    configPath?: string;
    routingRules?: any;
    serverCompatibilityProviders?: any;
}
/**
 * Pipeline集成HTTP服务器
 * 使用组合而非继承的方式集成HTTPServer功能
 */
export declare class PipelineServer extends EventEmitter {
    private httpServer;
    private pipelineService;
    private serverConfig;
    private middlewareManager;
    private debugRecorder;
    private router?;
    constructor(config: PipelineServerConfig, middlewareManager: IMiddlewareManager, pipelineService?: IPipelineService);
    /**
     * 初始化服务器
     */
    initialize(): Promise<void>;
    /**
     * 初始化Pipeline相关路由
     */
    private initializePipelineRoutes;
    /**
     * 初始化中间件
     */
    private initializeMiddleware;
    /**
     * 启动服务器并初始化所有Pipeline
     */
    start(): Promise<void>;
    /**
     * 停止服务器并清理Pipeline资源
     */
    stop(): Promise<void>;
    /**
     * 处理Anthropic格式请求 - 带完整6层Pipeline Debug记录
     */
    private handleAnthropicRequest;
    /**
     * 处理OpenAI格式请求
     */
    private handleOpenAIRequest;
    /**
     * 处理Gemini格式请求
     */
    private handleGeminiRequest;
    /**
     * 处理直接Pipeline请求
     */
    private handlePipelineRequest;
    /**
     * 获取所有Pipeline状态
     */
    private handleGetPipelines;
    /**
     * 获取特定Pipeline状态
     */
    private handleGetPipelineStatus;
    /**
     * 启动Pipeline
     */
    private handleStartPipeline;
    /**
     * 停止Pipeline
     */
    private handleStopPipeline;
    /**
     * 提取路径参数
     */
    private extractPathParam;
    /**
     * 创建默认Pipeline服务
     */
    private createDefaultPipelineService;
    /**
     * 获取Pipeline服务
     */
    getPipelineService(): IPipelineService;
    /**
     * 获取Pipeline管理器
     */
    getPipelineManager(): import("../interfaces/core/pipeline-abstraction").IPipelineManager;
    /**
     * 获取Pipeline配置
     */
    getPipelineConfigs(): PipelineConfig[];
    /**
     * 设置路由器实例 - 用于路由决策
     */
    setRouter(router: any): void;
    /**
     * 基于配置文件进行真实的路由决策 - 使用新的虚拟模型映射系统
     */
    private makeRoutingDecision;
    /**
     * 根据Provider ID获取兼容性信息
     */
    private getCompatibilityInfo;
    /**
     * 获取模型映射（支持简化和复杂两种配置格式）
     */
    private getModelMapping;
    /**
     * 记录真实的Pipeline层级处理和响应 (Layer 2-5)
     * 返回转换后的Anthropic格式响应
     */
    private recordRealPipelineLayers;
    /**
     * 获取服务器状态
     * 委托给HTTPServer并添加Pipeline相关信息
     */
    getStatus(): ServerStatus & {
        pipelines?: any;
    };
    /**
     * 添加中间件 - 委托给HTTPServer
     */
    use(middleware: MiddlewareFunction): void;
    /**
     * 添加路由 - 委托给HTTPServer
     */
    addRoute(method: string, path: string, handler: RouteHandler, middleware?: MiddlewareFunction[]): void;
    /**
     * 处理流式响应
     * 根据协议类型和客户端请求参数，将非流式响应转换为流式响应
     */
    private handleStreamingResponse;
}
//# sourceMappingURL=pipeline-server.d.ts.map