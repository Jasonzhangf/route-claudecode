/**
 * Pipeline集成HTTP服务器
 *
 * 将Pipeline管理系统集成到HTTP服务器中，实现完整的请求处理流程
 *
 * @author Jason Zhang
 */
import { ServerConfig, MiddlewareFunction, RouteHandler } from './http-server';
import { PipelineManager } from '../pipeline/pipeline-manager';
import { PipelineConfig } from '../interfaces/pipeline/pipeline-framework';
import { ServerStatus } from '../interfaces';
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
}
/**
 * Pipeline集成HTTP服务器
 * 使用组合而非继承的方式集成HTTPServer功能
 */
export declare class PipelineServer extends EventEmitter {
    private httpServer;
    private pipelineManager;
    private pipelineConfigs;
    private serverConfig;
    constructor(config: PipelineServerConfig);
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
     * 初始化所有Pipeline
     */
    private initializePipelines;
    /**
     * 清理所有Pipeline
     */
    private cleanupPipelines;
    /**
     * 设置Pipeline事件监听
     */
    private setupPipelineEventListeners;
    /**
     * 处理Anthropic格式请求
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
     * 根据协议和模型查找Pipeline
     */
    private findPipelineByProtocol;
    /**
     * 提取路径参数
     */
    private extractPathParam;
    /**
     * 获取Pipeline管理器
     */
    getPipelineManager(): PipelineManager;
    /**
     * 获取Pipeline配置
     */
    getPipelineConfigs(): PipelineConfig[];
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
}
//# sourceMappingURL=pipeline-server.d.ts.map