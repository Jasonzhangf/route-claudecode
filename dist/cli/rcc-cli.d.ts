/**
 * RCC主CLI类
 *
 * 统一的CLI入口，集成命令解析、验证、配置加载和执行
 *
 * @author Jason Zhang
 */
import { CLICommands, StartOptions, StopOptions, CodeOptions, StatusOptions, ConfigOptions, ServerStatus } from '../interfaces/client/cli-interface';
/**
 * CLI执行选项
 */
export interface CLIOptions {
    exitOnError?: boolean;
    suppressOutput?: boolean;
    configPath?: string;
    envPrefix?: string;
}
/**
 * RCC主CLI类
 */
export declare class RCCCli implements CLICommands {
    private parser;
    private validator;
    private configReader;
    private options;
    private pipelineManager?;
    private qwenAuthManager;
    private historyManager;
    private blacklistedModels;
    private apiBaseUrl;
    constructor(options?: CLIOptions);
    /**
     * 执行CLI命令
     */
    run(args?: string[]): Promise<void>;
    /**
     * 启动服务器模式
     */
    start(options: StartOptions): Promise<void>;
    /**
     * 停止服务器
     */
    stop(options: StopOptions): Promise<void>;
    /**
     * 启动客户端模式
     */
    code(options: CodeOptions): Promise<void>;
    /**
     * 查看服务器状态
     */
    status(options: StatusOptions): Promise<ServerStatus>;
    /**
     * 配置管理
     */
    config(options: ConfigOptions): Promise<void>;
    /**
     * 处理验证错误
     */
    private handleValidationErrors;
    /**
     * 处理认证命令
     */
    auth(provider: string, index?: number, options?: any): Promise<void>;
    /**
     * 执行provider认证
     */
    private authenticateProvider;
    /**
     * 列出认证文件
     */
    private listAuthFiles;
    /**
     * 删除认证文件
     */
    private removeAuthFile;
    /**
     * 刷新认证文件
     */
    private refreshAuthFile;
    /**
     * Provider更新命令
     */
    providerUpdate(options: any): Promise<void>;
    /**
     * 分类模型统计
     */
    /**
     * 分类模型统计信息
     */
    private categorizeModels;
    /**
     * 更新Provider模型
     */
    private updateProviderModels;
    /**
     * 更新通用OpenAI兼容Provider模型 (如 Shuaihong, OpenAI, Anthropic 等)
     */
    private updateGenericOpenAIProvider;
    /**
     * 更新Qwen模型
     */
    private updateQwenModels;
    /**
     * 更新ModelScope模型
     */
    private updateModelScopeModels;
    /**
     * 更新LM Studio模型
     */
    private updateLMStudioModels;
    /**
     * 获取模型的详细配置（包含精确maxTokens）
     */
    private getModelDetailedConfig;
    /**
     * 更新Provider配置中的模型列表（支持精确maxTokens）
     */
    private updateProviderConfigModels;
    /**
     * 处理错误
     */
    private handleError;
    /**
     * 启动服务器（实际实现）
     */
    private startServer;
    /**
     * 停止服务器（实际实现）
     */
    private stopServer;
    /**
     * 尝试通过HTTP端点优雅停止服务器
     */
    private attemptGracefulStop;
    /**
     * 查找占用指定端口的进程ID
     */
    private findProcessOnPort;
    /**
     * 发送TERM信号给进程
     */
    private sendTermSignal;
    /**
     * 强制终止进程
     */
    private forceKillProcess;
    /**
     * 自动检测并清理端口占用
     */
    private cleanupPortIfOccupied;
    /**
     * 启动客户端模式（实际实现）
     */
    private startClientMode;
    /**
     * 导出客户端配置
     */
    private exportClientConfig;
    /**
     * 获取服务器状态（实际实现）
     */
    private getServerStatus;
    /**
     * 显示服务器状态
     */
    private displayServerStatus;
    /**
     * 获取健康状态图标
     */
    private getHealthStatusIcon;
    /**
     * 列出配置文件
     */
    private listConfigurations;
    /**
     * 验证配置文件
     */
    private validateConfiguration;
    /**
     * 验证单个Provider配置
     */
    private validateProvider;
    /**
     * 验证路由配置
     */
    private validateRouterConfig;
    /**
     * 获取系统配置文件路径
     */
    private getSystemConfigPath;
    /**
     * 加载配置 (支持API化)
     *
     * 当前使用直接调用ConfigReader，未来可扩展为API调用
     */
    private loadConfigurationAsync;
    /**
     * 重置配置
     */
    private resetConfiguration;
    /**
     * 设置流水线事件监听器
     */
    private setupPipelineEventListeners;
    /**
     * 格式化运行时间
     */
    private formatUptime;
    /**
     * API动态模型获取功能 - 内联实现
     */
    /**
     * 增强版模型获取 - 支持能力测试和429重试
     */
    private fetchModelsForProvider;
    /**
     * 提取模型的精确上下文长度
     */
    private extractContextLength;
    /**
     * 智能模型分类
     */
    private classifyModel;
    /**
     * 429错误重试的模型获取
     */
    private fetchModelsWithRetry;
    /**
     * 测试模型上下文长度 - 通过max_tokens参数递归测试
     */
    private testModelContextLength;
    /**
     * 递归测试token长度 - 实现二分查找逻辑
     */
    private recursiveTokenTest;
    /**
     * 测试模型可用性
     */
    private testModelAvailability;
    /**
     * 测试多模态能力
     */
    private testMultimodalCapability;
    /**
     * 生成长测试消息
     */
    private generateLongTestMessage;
    /**
     * 获取Provider的默认端点 (已废弃 - 现在使用配置驱动)
     */
    private getDefaultEndpointForProvider;
    /**
     * Directly starts the Claude command (as a fallback for happy-cli).
     * @internal
     * @private
     */
    private startClaudeDirectly;
    /**
     * 查找 Claude 可执行文件
     */
    private findClaudeExecutable;
}
//# sourceMappingURL=rcc-cli.d.ts.map