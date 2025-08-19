/**
 * Provider管理器
 *
 * 统一管理Provider实例的生命周期、路由和负载均衡
 *
 * @author Jason Zhang
 */
import { IModuleInterface } from '../../interfaces/core/module-implementation-interface';
import { ProviderConfig, ProviderProtocolType } from './provider-factory';
import { StandardRequest } from '../../interfaces/standard/request';
import { StandardResponse } from '../../interfaces/standard/response';
/**
 * Provider路由策略
 */
export type RoutingStrategy = 'round-robin' | 'least-loaded' | 'random' | 'priority';
/**
 * Provider管理器配置
 */
export interface ProviderManagerConfig {
    /** 路由策略 */
    routingStrategy: RoutingStrategy;
    /** 健康检查间隔(毫秒) */
    healthCheckInterval: number;
    /** 最大重试次数 (同一Provider) */
    maxRetries: number;
    /** 调试模式 */
    debug: boolean;
    /** 严格错误报告 - RCC v4.0 Zero Fallback Policy */
    strictErrorReporting: boolean;
}
/**
 * Provider路由信息
 */
export interface ProviderRouteInfo {
    /** Provider ID */
    id: string;
    /** Provider Protocol类型 */
    type: ProviderProtocolType;
    /** 优先级 */
    priority: number;
    /** 权重 */
    weight: number;
    /** 是否健康 */
    healthy: boolean;
    /** 当前负载 */
    currentLoad: number;
}
/**
 * 请求路由结果
 */
export interface RouteResult {
    /** 选中的Provider */
    provider: IModuleInterface;
    /** Provider信息 */
    info: ProviderRouteInfo;
    /** 路由决策原因 */
    reason: string;
}
/**
 * Provider管理器
 */
export declare class ProviderManager {
    private config;
    private factory;
    private providers;
    private routeInfos;
    private healthCheckTimer?;
    private roundRobinIndex;
    constructor(config?: Partial<ProviderManagerConfig>);
    /**
     * 初始化管理器
     */
    initialize(providerConfigs: ProviderConfig[]): Promise<void>;
    /**
     * 注册Provider
     */
    registerProvider(provider: IModuleInterface): Promise<void>;
    /**
     * 注销Provider
     */
    unregisterProvider(providerId: string): Promise<boolean>;
    /**
     * 路由请求到合适的Provider
     */
    routeRequest(request: StandardRequest): Promise<StandardResponse>;
    /**
     * 选择Provider
     */
    private selectProvider;
    /**
     * 应用路由策略
     */
    private applyRoutingStrategy;
    /**
     * 检查Provider兼容性
     */
    private isProviderCompatible;
    /**
     * 更新Provider负载
     */
    private updateProviderLoad;
    /**
     * 标记Provider为不健康
     */
    private markProviderUnhealthy;
    /**
     * 启动健康检查
     */
    private startHealthCheck;
    /**
     * 执行健康检查
     */
    private performHealthCheck;
    /**
     * 获取Provider类型
     */
    private getProviderType;
    /**
     * 获取所有Provider状态
     */
    getProviderStatuses(): Array<any>;
    /**
     * 获取健康的Provider数量
     */
    getHealthyProviderCount(): number;
    /**
     * 获取管理器统计信息
     */
    getManagerStats(): {
        totalProviders: number;
        healthyProviders: number;
        unhealthyProviders: number;
        routingStrategy: RoutingStrategy;
        strictErrorReporting: boolean;
        healthCheckInterval: number;
        providers: {
            id: any;
            type: any;
            healthy: any;
            currentLoad: any;
            status: any;
        }[];
    };
    /**
     * 停止管理器
     */
    stop(): Promise<void>;
}
//# sourceMappingURL=provider-manager.d.ts.map