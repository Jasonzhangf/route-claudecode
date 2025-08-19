/**
 * 客户端模块入口文件
 *
 * 提供完整的客户端功能，包括CLI、会话管理、HTTP处理和代理功能
 *
 * @author Jason Zhang
 */
export { CLI, CommandExecutor, CLIError, ServerController, ConfigManager } from './cli';
export * from './session';
export * from './http';
export * from './client-manager';
export declare const CLIENT_MODULE_VERSION = "4.0.0-alpha.2";
import { ClientSession, SessionManager, SessionError } from './session';
import { HttpClient, HttpError } from './http';
import { ClientProxy, EnvironmentExporter } from './client-manager';
import { ErrorHandler } from '../interfaces/client/error-handler';
/**
 * 客户端模块接口
 */
export interface ClientModuleInterface {
    version: string;
    initialize(): Promise<void>;
    executeCommand(command: string, options: any): Promise<void>;
    createSession(config?: any): ClientSession;
    getHttpClient(): HttpClient;
    getProxy(): ClientProxy;
}
/**
 * 客户端模块配置
 */
export interface ClientModuleConfig {
    serverHost?: string;
    serverPort?: number;
    enableCache?: boolean;
    enableDebug?: boolean;
    sessionConfig?: any;
    httpConfig?: any;
    proxyConfig?: any;
    errorHandler?: ErrorHandler;
}
/**
 * 客户端模块主类
 */
export declare class ClientModule implements ClientModuleInterface {
    private config;
    private errorHandler;
    readonly version = "4.0.0-alpha.2";
    private cli;
    private sessionManager;
    private httpClient;
    private proxy;
    private envExporter;
    private initialized;
    constructor(config: ClientModuleConfig, errorHandler: ErrorHandler);
    /**
     * 初始化模块
     */
    initialize(): Promise<void>;
    /**
     * 初始化子模块
     */
    private initializeSubModules;
    /**
     * 执行CLI命令
     */
    executeCommand(command: string, options?: any): Promise<void>;
    /**
     * 创建新会话
     */
    createSession(config?: any): ClientSession;
    /**
     * 获取HTTP客户端
     */
    getHttpClient(): HttpClient;
    /**
     * 获取代理实例
     */
    getProxy(): ClientProxy;
    /**
     * 获取会话管理器
     */
    getSessionManager(): SessionManager;
    /**
     * 获取环境导出器
     */
    getEnvironmentExporter(): EnvironmentExporter;
    /**
     * 获取模块统计信息
     */
    getStats(): {
        sessions: import("./session").SessionStats;
        http: import("./http").RequestStats;
        proxy: import("./cli").ClientProxyStatus;
    };
    /**
     * 清理模块资源
     */
    cleanup(): Promise<void>;
}
/**
 * 客户端工厂函数
 */
export declare function createClientModule(config: ClientModuleConfig, errorHandler: ErrorHandler): ClientModule;
/**
 * 快速创建客户端实例的工厂函数
 */
export declare function createClient(config?: ClientModuleConfig): Promise<ClientModule>;
export { SessionError, HttpError };
//# sourceMappingURL=index.d.ts.map