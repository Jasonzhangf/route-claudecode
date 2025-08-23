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
     * 获取系统配置文件路径
     */
    private getSystemConfigPath;
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
}
//# sourceMappingURL=rcc-cli.d.ts.map