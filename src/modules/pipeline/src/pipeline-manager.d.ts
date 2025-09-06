/**
 * Pipeline管理器
 *
 * 管理已组装流水线的生命周期、健康检查和执行调度
 *
 * @author Claude Code Router v4.0
 */
import { AssembledPipeline } from './assembly-types';
/**
 * 流水线管理器配置
 */
export interface PipelineManagerConfig {
    healthCheckInterval?: number;
    cleanupInterval?: number;
    maxInactiveTime?: number;
    enableAutoScaling?: boolean;
    maxPipelines?: number;
}
/**
 * 流水线状态信息
 */
export interface PipelineStatus {
    pipelineId: string;
    status: 'active' | 'inactive' | 'error' | 'stopped';
    health: 'healthy' | 'degraded' | 'unhealthy';
    lastUsed?: Date;
    executionCount: number;
    errorCount: number;
    averageResponseTime: number;
}
/**
 * 流水线管理器统计信息
 */
export interface PipelineManagerStats {
    totalPipelines: number;
    activePipelines: number;
    healthyPipelines: number;
    totalExecutions: number;
    totalErrors: number;
    averageResponseTime: number;
    uptime: number;
}
/**
 * Pipeline管理器
 */
export declare class PipelineManager {
    private pipelines;
    private pipelineStatus;
    private config;
    private isDestroyed;
    private healthCheckIntervalId;
    private cleanupIntervalId;
    private startTime;
    private totalExecutions;
    private totalErrors;
    private totalResponseTime;
    constructor(config?: PipelineManagerConfig);
    /**
     * 添加流水线
     */
    addPipeline(pipeline: AssembledPipeline): boolean;
    /**
     * 获取流水线
     */
    getPipeline(pipelineId: string): AssembledPipeline | undefined;
    /**
     * 移除流水线
     */
    removePipeline(pipelineId: string): boolean;
    /**
     * 销毁流水线
     */
    destroyPipeline(pipelineId: string): Promise<boolean>;
    /**
     * 获取所有流水线
     */
    getAllPipelines(): Map<string, AssembledPipeline>;
    /**
     * 获取流水线状态
     */
    getPipelineStatus(pipelineId: string): PipelineStatus | undefined;
    /**
     * 获取所有流水线状态
     */
    getAllPipelineStatus(): Record<string, PipelineStatus>;
    /**
     * 更新流水线健康状态
     */
    updatePipelineHealth(pipelineId: string, health: 'healthy' | 'degraded' | 'unhealthy'): boolean;
    /**
     * 记录流水线执行
     */
    recordPipelineExecution(pipelineId: string, success: boolean, responseTime: number): boolean;
    /**
     * 执行流水线
     */
    executePipeline(pipelineId: string, request: any): Promise<any>;
    /**
     * 健康检查所有流水线
     */
    healthCheckAllPipelines(): Promise<void>;
    /**
     * 检查单个流水线健康状态
     */
    private checkPipelineHealth;
    /**
     * 获取管理器统计信息
     */
    getStatistics(): PipelineManagerStats;
    /**
     * 启动健康检查任务
     */
    private startHealthChecks;
    /**
     * 启动清理任务
     */
    private startCleanupTask;
    /**
     * 清理不活跃的流水线
     */
    private cleanupInactivePipelines;
    /**
     * 清理流水线资源
     */
    private cleanupPipeline;
    /**
     * 销毁管理器
     */
    destroy(): Promise<void>;
    /**
     * 重置管理器状态
     */
    reset(): Promise<void>;
}
export declare const pipelineManager: PipelineManager;
//# sourceMappingURL=pipeline-manager.d.ts.map