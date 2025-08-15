/**
 * Provider服务
 *
 * 统一的Provider服务入口点，整合工厂、管理器和配置加载
 *
 * @author Jason Zhang
 */
import { ProviderManagerConfig } from './provider-manager';
import { ProviderConfig } from './provider-factory';
import { ConfigLoadOptions } from './config-loader';
import { StandardRequest } from '../../interfaces/standard/request';
import { StandardResponse } from '../../interfaces/standard/response';
import { ModuleStatus } from '../../interfaces/module/base-module';
/**
 * Provider服务配置
 */
export interface ProviderServiceConfig {
    /** Provider管理器配置 */
    manager: Partial<ProviderManagerConfig>;
    /** 配置加载选项 */
    configLoader?: ConfigLoadOptions;
    /** Provider配置（如果不使用配置文件） */
    providers?: ProviderConfig[];
    /** 自动启动 */
    autoStart?: boolean;
    /** 调试模式 */
    debug?: boolean;
}
/**
 * Provider服务状态
 */
export type ProviderServiceStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
/**
 * Provider服务统计信息
 */
export interface ProviderServiceStats {
    /** 服务状态 */
    status: ProviderServiceStatus;
    /** 启动时间 */
    startedAt?: Date;
    /** 运行时间(毫秒) */
    uptime?: number;
    /** 总请求数 */
    totalRequests: number;
    /** 成功请求数 */
    successfulRequests: number;
    /** 失败请求数 */
    failedRequests: number;
    /** 平均响应时间 */
    averageResponseTime: number;
    /** Provider统计 */
    providerStats: any;
}
/**
 * Provider服务
 */
export declare class ProviderService {
    private config;
    private manager;
    private factory;
    private status;
    private startedAt?;
    private stats;
    private requestTimes;
    constructor(config: ProviderServiceConfig);
    /**
     * 启动服务
     */
    start(): Promise<void>;
    /**
     * 停止服务
     */
    stop(): Promise<void>;
    /**
     * 重启服务
     */
    restart(): Promise<void>;
    /**
     * 处理请求
     */
    processRequest(request: StandardRequest): Promise<StandardResponse>;
    /**
     * 加载Provider配置
     */
    private loadProviderConfigs;
    /**
     * 更新响应时间统计
     */
    private updateResponseTime;
    /**
     * 获取服务状态
     */
    getStatus(): ProviderServiceStatus;
    /**
     * 获取服务统计信息
     */
    getStats(): ProviderServiceStats;
    /**
     * 获取所有Provider状态
     */
    getProviderStatuses(): Array<ModuleStatus & {
        routeInfo: any;
    }>;
    /**
     * 获取健康的Provider数量
     */
    getHealthyProviderCount(): number;
    /**
     * 检查服务健康状态
     */
    healthCheck(): Promise<{
        healthy: boolean;
        details: any;
    }>;
    /**
     * 重新加载配置
     */
    reloadConfig(): Promise<void>;
    /**
     * 创建服务实例
     */
    static create(config: ProviderServiceConfig): ProviderService;
    /**
     * 创建带配置文件的服务实例
     */
    static createFromConfigFile(configFilePath: string, managerConfig?: Partial<ProviderManagerConfig>): ProviderService;
}
//# sourceMappingURL=provider-service.d.ts.map