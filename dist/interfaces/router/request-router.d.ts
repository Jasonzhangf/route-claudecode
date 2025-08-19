/**
 * DEPRECATED: This file has been replaced by src/interfaces/router/core-router-interfaces.ts
 *
 * ❌ DO NOT USE: These request router interfaces are deprecated
 * ✅ USE INSTEAD: src/interfaces/router/core-router-interfaces.ts
 *
 * The new CoreRouter interfaces provide a cleaner, more focused API.
 *
 * @deprecated Use interfaces from src/interfaces/router/core-router-interfaces.ts instead
 * @see src/interfaces/router/core-router-interfaces.ts
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
 * 标准请求接口
 */
export interface StandardRequest {
    readonly id: string;
    readonly model: string;
    readonly messages: any[];
    readonly temperature?: number;
    readonly maxTokens?: number;
    readonly stream?: boolean;
    readonly tools?: any[];
    readonly metadata: RequestMetadata;
    readonly timestamp: Date;
}
/**
 * 请求元数据
 */
export interface RequestMetadata {
    originalFormat: 'anthropic' | 'openai' | 'gemini';
    targetFormat: 'anthropic' | 'openai' | 'gemini';
    provider: string;
    category: string;
    debugEnabled?: boolean;
    captureLevel?: 'basic' | 'full';
    processingSteps?: string[];
}
/**
 * 请求路由器接口
 */
export interface RequestRouter {
    /**
     * 路由请求到指定流水线
     */
    route(request: RCCRequest): Promise<Pipeline>;
    /**
     * 根据类别选择流水线
     */
    selectPipeline(category: string, request?: RCCRequest): Promise<Pipeline>;
    /**
     * 负载均衡选择
     */
    balanceLoad(pipelines: Pipeline[], request?: RCCRequest): Pipeline;
    /**
     * 获取路由统计
     */
    getRoutingStats(): RoutingStats;
    /**
     * 更新路由表
     */
    updateRoutingTable(table: any): Promise<void>;
}
/**
 * RCC请求接口
 */
export interface RCCRequest extends StandardRequest {
    category?: string;
    priority?: number;
    sessionId?: string;
    conversationId?: string;
    routingHints?: RoutingHints;
}
/**
 * 路由提示
 */
export interface RoutingHints {
    preferredProvider?: string;
    excludeProviders?: string[];
    requireFeatures?: string[];
    maxLatency?: number;
    costPreference?: 'low' | 'medium' | 'high';
}
/**
 * 路由统计
 */
export interface RoutingStats {
    totalRequests: number;
    routingsByCategory: Record<string, number>;
    routingsByProvider: Record<string, number>;
    averageRoutingTime: number;
    failedRoutings: number;
    lastUpdated: Date;
}
/**
 * 负载均衡策略接口
 */
export interface LoadBalancingStrategy {
    /**
     * 策略名称
     */
    readonly name: string;
    /**
     * 选择流水线
     */
    select(pipelines: Pipeline[], request?: RCCRequest): Pipeline;
    /**
     * 更新流水线权重
     */
    updateWeights(pipelineWeights: Record<string, number>): void;
    /**
     * 获取策略配置
     */
    getConfig(): Record<string, any>;
}
/**
 * 轮询负载均衡策略
 */
export interface RoundRobinStrategy extends LoadBalancingStrategy {
    name: 'round-robin';
    getCurrentIndex(): number;
    resetIndex(): void;
}
/**
 * 加权负载均衡策略
 */
export interface WeightedStrategy extends LoadBalancingStrategy {
    name: 'weighted';
    getWeights(): Record<string, number>;
    setWeight(pipelineId: string, weight: number): void;
}
/**
 * 最少连接负载均衡策略
 */
export interface LeastConnectionsStrategy extends LoadBalancingStrategy {
    name: 'least-connections';
    getConnectionCounts(): Record<string, number>;
    updateConnectionCount(pipelineId: string, delta: number): void;
}
/**
 * 路由决策引擎接口
 */
export interface RoutingDecisionEngine {
    /**
     * 做出路由决策
     */
    makeDecision(request: RCCRequest, availablePipelines: Pipeline[]): Promise<RoutingDecision>;
    /**
     * 评估流水线适合度
     */
    evaluatePipeline(pipeline: Pipeline, request: RCCRequest): Promise<number>;
    /**
     * 获取决策历史
     */
    getDecisionHistory(limit?: number): RoutingDecision[];
}
/**
 * 路由决策结果
 */
export interface RoutingDecision {
    requestId: string;
    selectedPipeline: Pipeline;
    reason: string;
    confidence: number;
    alternativePipelines: Pipeline[];
    decisionTime: Date;
    processingTime: number;
}
/**
 * 健康检查接口
 */
export interface HealthChecker {
    /**
     * 检查流水线健康状态
     */
    checkHealth(pipeline: Pipeline): Promise<HealthStatus>;
    /**
     * 检查所有流水线健康状态
     */
    checkAllPipelines(): Promise<Record<string, HealthStatus>>;
    /**
     * 设置健康检查间隔
     */
    setCheckInterval(interval: number): void;
    /**
     * 获取健康历史
     */
    getHealthHistory(pipelineId: string): HealthStatus[];
}
/**
 * 健康状态
 */
export interface HealthStatus {
    pipelineId: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime?: number;
    errorRate: number;
    lastChecked: Date;
    details?: {
        message?: string;
        error?: string;
        metadata?: Record<string, any>;
    };
}
/**
 * 路由表接口 (RCC v4.0)
 */
export interface RoutingTable {
    routes: Record<string, PipelineRoute[]>;
    defaultRoute: string;
}
/**
 * 流水线路由定义 (RCC v4.0)
 */
export interface PipelineRoute {
    routeId: string;
    virtualModel: string;
    provider: string;
    targetModel: string;
    apiKeys: string[];
    pipelineIds: string[];
    isActive: boolean;
    health: 'healthy' | 'degraded' | 'unhealthy';
}
//# sourceMappingURL=request-router.d.ts.map