/**
 * 流水线管理器接口定义
 *
 * 定义流水线生命周期管理的标准接口
 *
 * @author Jason Zhang
 */
/**
 * 流水线接口
 */
export interface Pipeline {
    readonly id: string;
    readonly provider: string;
    readonly model: string;
    process(input: any): Promise<any>;
    validate(): Promise<boolean>;
    start(): Promise<void>;
    stop(): Promise<void>;
    getStatus(): PipelineStatus;
    getMetrics(): any;
}
/**
 * 流水线状态
 */
export interface PipelineStatus {
    id: string;
    status: 'idle' | 'running' | 'busy' | 'error' | 'stopped';
    health: 'healthy' | 'degraded' | 'unhealthy';
    lastActivity?: Date;
    error?: Error;
}
/**
 * Provider配置
 */
export interface ProviderConfig {
    id: string;
    name: string;
    protocol: 'openai' | 'anthropic' | 'gemini';
    baseUrl: string;
    apiKey: string;
    models: ModelConfig[];
    healthCheck?: HealthCheckConfig;
    rateLimit?: RateLimitConfig;
}
export interface ModelConfig {
    id: string;
    name: string;
    maxTokens: number;
    supportsFunctions: boolean;
    supportsStreaming: boolean;
}
export interface HealthCheckConfig {
    enabled: boolean;
    interval: number;
    endpoint: string;
}
export interface RateLimitConfig {
    requestsPerMinute: number;
    tokensPerMinute: number;
}
/**
 * 流水线管理器接口
 */
export interface PipelineManager {
    /**
     * 创建流水线
     */
    createPipeline(provider: string, model: string, config?: PipelineCreateOptions): Promise<Pipeline>;
    /**
     * 销毁流水线
     */
    destroyPipeline(pipelineId: string): Promise<void>;
    /**
     * 获取流水线
     */
    getPipeline(pipelineId: string): Pipeline | null;
    /**
     * 列出所有活跃流水线
     */
    listActivePipelines(): Pipeline[];
    /**
     * 监控可用性
     */
    monitorAvailability(): void;
    /**
     * 获取流水线统计信息
     */
    getPipelineStats(): PipelineManagerStats;
    /**
     * 清理无用的流水线
     */
    cleanup(): Promise<void>;
}
/**
 * 流水线创建选项
 */
export interface PipelineCreateOptions {
    priority?: number;
    maxConcurrency?: number;
    timeout?: number;
    retryPolicy?: {
        maxRetries: number;
        backoffMultiplier: number;
    };
    healthCheckConfig?: {
        enabled: boolean;
        interval: number;
        timeout: number;
    };
}
/**
 * 流水线管理器统计信息
 */
export interface PipelineManagerStats {
    totalPipelines: number;
    activePipelines: number;
    idlePipelines: number;
    errorPipelines: number;
    pipelinesByProvider: Record<string, number>;
    averageCreationTime: number;
    totalProcessedRequests: number;
    lastCleanup: Date;
}
/**
 * 流水线生命周期管理器接口 (已废弃)
 *
 * @deprecated 使用UnifiedInitializer替代
 */
/**
 * 生命周期状态
 */
export interface LifecycleStatus {
    phase: 'created' | 'initializing' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error' | 'destroyed';
    startTime?: Date;
    lastStateChange: Date;
    errorCount: number;
    restartCount: number;
}
/**
 * 流水线监控器接口
 */
export interface PipelineMonitor {
    /**
     * 开始监控流水线
     */
    startMonitoring(pipeline: Pipeline): void;
    /**
     * 停止监控流水线
     */
    stopMonitoring(pipelineId: string): void;
    /**
     * 获取监控数据
     */
    getMonitoringData(pipelineId: string): MonitoringData;
    /**
     * 设置告警规则
     */
    setAlertRules(rules: AlertRule[]): void;
    /**
     * 触发告警
     */
    triggerAlert(alert: Alert): void;
}
/**
 * 监控数据
 */
export interface MonitoringData {
    pipelineId: string;
    metrics: {
        requestCount: number;
        averageResponseTime: number;
        errorRate: number;
        throughput: number;
        memoryUsage: number;
        cpuUsage: number;
    };
    status: PipelineStatus;
    healthChecks: Array<{
        timestamp: Date;
        status: 'pass' | 'fail';
        responseTime: number;
        details?: string;
    }>;
    alerts: Alert[];
    collectedAt: Date;
}
/**
 * 告警规则
 */
export interface AlertRule {
    id: string;
    name: string;
    condition: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    enabled: boolean;
    actions: string[];
}
/**
 * 告警信息
 */
export interface Alert {
    id: string;
    ruleId: string;
    pipelineId: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: Date;
    resolved: boolean;
    resolvedAt?: Date;
    metadata?: Record<string, any>;
}
/**
 * 流水线工厂接口
 */
export interface PipelineFactory {
    /**
     * 注册流水线构建器
     */
    registerBuilder(provider: string, builder: PipelineBuilder): void;
    /**
     * 构建流水线
     */
    buildPipeline(provider: string, model: string, config: ProviderConfig): Promise<Pipeline>;
    /**
     * 获取支持的Provider列表
     */
    getSupportedProviders(): string[];
    /**
     * 验证Provider配置
     */
    validateProviderConfig(provider: string, config: ProviderConfig): boolean;
}
/**
 * 流水线构建器接口
 */
export interface PipelineBuilder {
    /**
     * 构建流水线
     */
    build(model: string, config: ProviderConfig): Promise<Pipeline>;
    /**
     * 验证配置
     */
    validateConfig(config: ProviderConfig): boolean;
    /**
     * 获取默认配置
     */
    getDefaultConfig(): Partial<ProviderConfig>;
}
//# sourceMappingURL=pipeline-manager.d.ts.map