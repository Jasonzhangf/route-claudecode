/**
 * Pipeline管理器核心实现
 *
 * 负责Pipeline的创建、执行、监控和销毁
 *
 * RCC v4.0 架构更新:
 * - 初始化时创建所有流水线 (Provider.Model.APIKey组合)
 * - 每条流水线在初始化时完成握手连接
 * - Runtime状态管理和零Fallback策略
 *
 * @author Jason Zhang
 * @author RCC v4.0
 */
import { EventEmitter } from 'events';
import { PipelineConfig, ExecutionContext, ExecutionResult, ExecutionRecord, StandardPipelineFactory } from '../interfaces/pipeline/pipeline-framework';
import { ModuleInterface } from '../interfaces/module/base-module';
import { PipelineStatus } from '../interfaces/module/pipeline-module';
import { RoutingTable } from '../interfaces/router/request-router';
/**
 * 完整流水线定义 (RCC v4.0)
 */
export interface CompletePipeline {
    readonly pipelineId: string;
    readonly virtualModel: string;
    readonly provider: string;
    readonly targetModel: string;
    readonly apiKey: string;
    readonly transformer: ModuleInterface;
    readonly protocol: ModuleInterface;
    readonly serverCompatibility: ModuleInterface;
    readonly server: ModuleInterface;
    readonly serverCompatibilityName: string;
    readonly transformerName: string;
    readonly protocolName: string;
    readonly endpoint: string;
    status: 'initializing' | 'runtime' | 'error' | 'stopped';
    lastHandshakeTime: Date;
    execute(request: any): Promise<any>;
    handshake(): Promise<void>;
    healthCheck(): Promise<boolean>;
    getStatus(): PipelineStatus;
    stop(): Promise<void>;
}
/**
 * 流水线创建配置 (RCC v4.0)
 */
export interface CompletePipelineConfig {
    pipelineId: string;
    virtualModel: string;
    provider: string;
    targetModel: string;
    apiKey: string;
    endpoint: string;
    transformer: string;
    protocol: string;
    serverCompatibility: string;
}
/**
 * 流水线表数据结构 (用于保存到generated目录)
 */
export interface PipelineTableData {
    configName: string;
    configFile: string;
    generatedAt: string;
    totalPipelines: number;
    pipelinesGroupedByVirtualModel: Record<string, PipelineTableEntry[]>;
    allPipelines: PipelineTableEntry[];
}
/**
 * 流水线表条目 (包含4层架构详细信息)
 */
export interface PipelineTableEntry {
    pipelineId: string;
    virtualModel: string;
    provider: string;
    targetModel: string;
    apiKeyIndex: number;
    endpoint: string;
    status: 'initializing' | 'runtime' | 'error' | 'stopped';
    createdAt: string;
    handshakeTime?: number;
    architecture: {
        transformer: {
            id: string;
            name: string;
            type: string;
            status: string;
        };
        protocol: {
            id: string;
            name: string;
            type: string;
            status: string;
        };
        serverCompatibility: {
            id: string;
            name: string;
            type: string;
            status: string;
        };
        server: {
            id: string;
            name: string;
            type: string;
            status: string;
            endpoint: string;
        };
    };
}
/**
 * Pipeline管理器
 */
export declare class PipelineManager extends EventEmitter {
    private pipelines;
    private activeExecutions;
    private factory;
    private systemConfig;
    private isInitialized;
    private configName;
    private configFile;
    private port;
    constructor(factory: StandardPipelineFactory, systemConfig?: any);
    /**
     * 初始化流水线系统 - 从Routing Table创建所有流水线 (RCC v4.0)
     */
    initializeFromRoutingTable(routingTable: RoutingTable, configInfo?: {
        name: string;
        file: string;
        port?: number;
    }): Promise<void>;
    /**
     * 创建完整流水线 (Provider.Model.APIKey组合)
     */
    private createCompletePipeline;
    /**
     * 检查系统是否已初始化
     */
    isSystemInitialized(): boolean;
    /**
     * 创建Pipeline (传统方法，保留向后兼容)
     */
    createPipeline(config: PipelineConfig): Promise<string>;
    /**
     * 销毁Pipeline
     */
    destroyPipeline(pipelineId: string): Promise<boolean>;
    /**
     * 获取Pipeline
     */
    getPipeline(pipelineId: string): CompletePipeline | null;
    /**
     * 获取所有Pipeline
     */
    getAllPipelines(): Map<string, CompletePipeline>;
    /**
     * 执行Pipeline
     */
    executePipeline(pipelineId: string, input: any, context: ExecutionContext): Promise<ExecutionResult>;
    /**
     * 取消执行
     */
    cancelExecution(executionId: string): Promise<boolean>;
    /**
     * 获取Pipeline状态
     */
    getPipelineStatus(pipelineId: string): PipelineStatus | null;
    /**
     * 获取所有Pipeline状态
     */
    getAllPipelineStatus(): Record<string, PipelineStatus>;
    /**
     * 获取活跃执行
     */
    getActiveExecutions(): ExecutionRecord[];
    /**
     * 获取Pipeline执行历史
     */
    getExecutionHistory(pipelineId: string): ExecutionRecord[];
    /**
     * 健康检查
     */
    healthCheck(): Promise<{
        healthy: boolean;
        pipelines: number;
        activeExecutions: number;
        issues: string[];
    }>;
    /**
     * 设置Pipeline事件监听器
     */
    private setupPipelineEventListeners;
    /**
     * 生成执行ID
     */
    private generateExecutionId;
    /**
     * 计算性能指标
     */
    private calculatePerformanceMetrics;
    /**
     * 保存流水线表到generated目录
     */
    private savePipelineTableToGenerated;
    /**
     * 生成流水线表数据
     */
    private generatePipelineTableData;
    /**
     * 从流水线ID提取API Key索引
     */
    private extractApiKeyIndex;
    /**
     * 从流水线提取endpoint信息
     */
    private extractEndpoint;
    /**
     * 提取4层架构详细信息
     */
    private extractArchitectureDetails;
    /**
     * 保存流水线表到debug-logs目录 (按端口分组)
     */
    private savePipelineTableToDebugLogs;
    /**
     * 生成debug版本的流水线表数据 (包含更多调试信息)
     */
    private generateDebugPipelineTableData;
}
//# sourceMappingURL=pipeline-manager.d.ts.map