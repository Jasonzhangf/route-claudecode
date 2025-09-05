/**
 * 基础模块接口定义
 *
 * 所有模块必须实现的基础接口，确保模块间的一致性
 *
 * @author Jason Zhang
 */
/**
 * 模块类型枚举
 */
export declare enum ModuleType {
    VALIDATOR = "validator",
    TRANSFORMER = "transformer",
    PROTOCOL = "protocol",
    SERVER_COMPATIBILITY = "server-compatibility",
    COMPATIBILITY = "compatibility",
    SERVER = "server",
    ROUTER = "router",
    PIPELINE = "pipeline",
    CLIENT = "client",
    CONFIG = "config",
    DEBUG = "debug",
    ERROR_HANDLER = "error-handler",
    MIDDLEWARE = "middleware",
    PROVIDER = "provider",
    SERVICE = "service",
    UTILITY = "utility"
}
/**
 * 模块状态接口
 */
export interface ModuleStatus {
    id: string;
    name: string;
    type: ModuleType;
    status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error' | 'idle' | 'busy';
    health: 'healthy' | 'degraded' | 'unhealthy';
    lastActivity?: Date;
    error?: Error;
}
/**
 * 模块性能指标
 */
export interface ModuleMetrics {
    requestsProcessed: number;
    averageProcessingTime: number;
    errorRate: number;
    memoryUsage: number;
    cpuUsage: number;
    lastProcessedAt?: Date;
}
/**
 * 验证结果接口
 */
export interface IValidationResult {
    valid: boolean;
    errors: string[];
    warnings?: string[];
}
/**
 * 标准请求接口
 */
export interface IStandardRequest {
    id?: string;
    model?: string;
    messages: any[];
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
    tools?: any[];
}
/**
 * 模块接口定义
 */
export interface ModuleInterface {
    /**
     * 获取模块ID
     */
    getId(): string;
    /**
     * 获取模块名称
     */
    getName(): string;
    /**
     * 获取模块类型
     */
    getType(): ModuleType;
    /**
     * 获取模块版本
     */
    getVersion(): string;
    /**
     * 获取模块状态
     */
    getStatus(): ModuleStatus;
    /**
     * 获取模块性能指标
     */
    getMetrics(): ModuleMetrics;
    /**
     * 配置模块
     */
    configure(config: any): Promise<void>;
    /**
     * 启动模块
     */
    start(): Promise<void>;
    /**
     * 停止模块
     */
    stop(): Promise<void>;
    /**
     * 处理数据
     */
    process(input: any): Promise<any>;
    /**
     * 重置模块状态
     */
    reset(): Promise<void>;
    /**
     * 清理模块资源
     */
    cleanup(): Promise<void>;
    /**
     * 健康检查
     */
    healthCheck(): Promise<{
        healthy: boolean;
        details: any;
    }>;
    /**
     * 添加连接的模块
     */
    addConnection(module: ModuleInterface): void;
    /**
     * 移除连接的模块
     */
    removeConnection(moduleId: string): void;
    /**
     * 获取连接的模块
     */
    getConnection(moduleId: string): ModuleInterface | undefined;
    /**
     * 获取所有连接的模块
     */
    getConnections(): ModuleInterface[];
    /**
     * 发送消息到目标模块
     */
    sendToModule(targetModuleId: string, message: any, type?: string): Promise<any>;
    /**
     * 广播消息到所有连接的模块
     */
    broadcastToModules(message: any, type?: string): Promise<void>;
    /**
     * 监听来自其他模块的消息
     */
    onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void): void;
    /**
     * 事件监听器
     */
    on(event: string, listener: (...args: any[]) => void): void;
    removeAllListeners(): void;
}
/**
 * 模块连接器接口
 * 用于模块间的标准化通信
 */
export interface ModuleConnection {
    /**
     * 发送消息到目标模块
     */
    send(targetModuleId: string, message: any): Promise<any>;
    /**
     * 广播消息到所有模块
     */
    broadcast(message: any): Promise<void>;
    /**
     * 监听来自其他模块的消息
     */
    onMessage(listener: (sourceModuleId: string, message: any) => void): void;
    /**
     * 建立模块间连接
     */
    connect(targetModuleId: string): Promise<void>;
    /**
     * 断开模块间连接
     */
    disconnect(targetModuleId: string): Promise<void>;
    /**
     * 获取连接状态
     */
    getConnectionStatus(targetModuleId: string): 'connected' | 'disconnected' | 'connecting' | 'error';
}
/**
 * 数据接口定义
 */
export interface DataInterface {
    type: string;
    schema: Record<string, any>;
    description: string;
}
/**
 * 模块配置接口
 */
export interface ModuleConfig {
    id: string;
    moduleId: string;
    enabled: boolean;
    config: Record<string, any>;
}
/**
 * 模块工厂接口
 */
export interface ModuleFactory {
    createModule(type: ModuleType, config: any): Promise<ModuleInterface>;
}
/**
 * 模块工厂接口别名（向后兼容）
 */
export interface IModuleFactory extends ModuleFactory {
}
/**
 * 流水线规范接口
 */
export interface PipelineSpec {
    id: string;
    name: string;
    description: string;
    version: string;
    provider?: string;
    model?: string;
    timeout?: number;
    modules: {
        id: string;
        config?: Record<string, any>;
    }[];
    configuration: PipelineConfiguration;
    metadata: PipelineMetadata;
}
/**
 * 流水线配置
 */
export interface PipelineConfiguration {
    parallel: boolean;
    failFast: boolean;
    retryPolicy: {
        maxRetries: number;
        backoffMultiplier: number;
    };
}
/**
 * 流水线元数据
 */
export interface PipelineMetadata {
    author: string;
    created: number;
    tags: string[];
}
/**
 * 模块执行上下文
 */
export interface ModuleExecutionContext {
    requestId: string;
    moduleId: string;
    parentContext?: any;
    metadata?: Record<string, any>;
    timeout?: number;
    debug?: boolean;
}
/**
 * 模块执行结果
 */
export interface ModuleExecutionResult {
    success: boolean;
    data?: any;
    error?: Error;
    processingTime: number;
    metadata?: Record<string, any>;
}
/**
 * 模块事件类型
 */
export declare enum ModuleEventType {
    STARTED = "started",
    STOPPED = "stopped",
    ERROR = "error",
    STATUS_CHANGED = "statusChanged",
    CONFIG_UPDATED = "configUpdated",
    PROCESSING_STARTED = "processingStarted",
    PROCESSING_COMPLETED = "processingCompleted",
    PROCESSING_FAILED = "processingFailed",
    HEALTH_CHECK_FAILED = "healthCheckFailed"
}
/**
 * 模块事件数据
 */
export interface ModuleEventData {
    moduleId: string;
    moduleName: string;
    eventType: ModuleEventType;
    timestamp: Date;
    data?: any;
}
/**
 * 简单的ModuleInterface适配器类
 * 为现有类提供快速的ModuleInterface实现
 */
export declare class SimpleModuleAdapter implements ModuleInterface {
    private moduleId;
    private moduleName;
    private moduleType;
    private moduleVersion;
    private status;
    private metrics;
    private connections;
    private messageListeners;
    private isStarted;
    constructor(id: string, name: string, type: ModuleType, version?: string);
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
    cleanup(): Promise<void>;
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
//# sourceMappingURL=base-module.d.ts.map