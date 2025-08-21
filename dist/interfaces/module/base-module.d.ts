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
    SERVER = "server"
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
     * 事件监听器
     */
    on(event: string, listener: (...args: any[]) => void): void;
    removeAllListeners(): void;
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
//# sourceMappingURL=base-module.d.ts.map