/**
 * 请求路由器接口定义
 *
 * 定义请求路由和负载均衡的标准接口
 *
 * @author Jason Zhang
 */
import { Pipeline } from '../module/pipeline-module';
import { StandardRequest } from '../standard/request';
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
//# sourceMappingURL=request-router.d.ts.map