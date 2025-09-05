/**
 * 客户端模块入口文件
 *
 * 提供完整的客户端功能，包括CLI、会话管理、HTTP处理和代理功能
 *
 * @author Jason Zhang
 */
export type { ClientSession } from './session';
export type { HttpClient } from './http';
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
export declare class ClientModule implements ModuleInterface {
    private config;
    private errorHandler;
    readonly version = "4.0.0-alpha.2";
    private sessionManager;
    private httpClient;
    private proxy;
    private envExporter;
    private initialized;
    private moduleId;
    private moduleName;
    private moduleStatus;
    private moduleMetrics;
    private moduleConnections;
    private moduleMessageListeners;
    constructor(config: any, errorHandler: ErrorHandler);
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
        proxy: import("../interfaces/core/cli-abstraction").ClientProxyStatus;
    };
    /**
     * 清理模块资源
     */
    cleanup(): Promise<void>;
    getId(): string;
    getName(): string;
    getType(): ModuleType;
    getVersion(): string;
    getStatus(): ModuleStatus;
    getMetrics(): ModuleMetrics;
    configure(config: any): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    process(input: any): Promise<any>;
    reset(): Promise<void>;
    healthCheck(): Promise<{
        healthy: boolean;
        details: any;
    }>;
    addConnection(module: ModuleInterface): void;
    removeConnection(moduleId: string): void;
    getConnection(moduleId: string): ModuleInterface | undefined;
    getConnections(): ModuleInterface[];
    sendToModule(targetModuleId: string, message: any, type?: string): Promise<any>;
    broadcastToModules(message: any, type?: string): Promise<void>;
    onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void): void;
    on(event: string, listener: (...args: any[]) => void): void;
    removeAllListeners(): void;
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
export { CLIError } from '../types/error';
import { ModuleInterface, ModuleType, ModuleStatus, ModuleMetrics, SimpleModuleAdapter } from '../interfaces/module/base-module';
export declare const clientModuleAdapter: SimpleModuleAdapter;
//# sourceMappingURL=index.d.ts.map