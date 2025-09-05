/**
 * 静态流水线组装系统 - 改造版 Pipeline Manager
 *
 * 核心职责:
 * 1. 静态流水线组装系统: 根据路由器输出动态选择模块进行组装
 * 2. 流水线只组装一次，后续只会销毁和重启
 * 3. 不负责负载均衡和请求路由(由LoadBalancer处理)
 * 4. 错误处理策略: 不可恢复的销毁，多次错误拉黑，认证问题处理
 *
 * RCC v4.0 架构更新 (基于用户纠正):
 * - ❌ 智能动态组装 → ✅ 静态组装+动态模块选择
 * - ❌ Pipeline负责路由 → ✅ LoadBalancer负责路由
 * - ✅ 组装一次，销毁重启的生命周期管理
 *
 * @author RCC v4.0 Architecture Team
 */
import { EventEmitter } from 'events';
import { PipelineConfig, ExecutionContext, ExecutionResult, ExecutionRecord, StandardPipelineFactory } from '../interfaces/pipeline/pipeline-framework';
import { ModuleInterface, ModuleType, ModuleStatus, ModuleMetrics } from '../interfaces/module/base-module';
import { PipelineStatus } from '../interfaces/module/pipeline-module';
import { RoutingTable } from '../router/pipeline-router';
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
            status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error' | 'idle' | 'busy';
        };
        protocol: {
            id: string;
            name: string;
            type: string;
            status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error' | 'idle' | 'busy';
        };
        serverCompatibility: {
            id: string;
            name: string;
            type: string;
            status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error' | 'idle' | 'busy';
        };
        server: {
            id: string;
            name: string;
            type: string;
            status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error' | 'idle' | 'busy';
            endpoint: string;
        };
    };
}
/**
 * Pipeline管理器
 */
export declare class PipelineManager extends EventEmitter implements ModuleInterface {
    private moduleId;
    private moduleName;
    private moduleVersion;
    private moduleStatus;
    private moduleMetrics;
    private connections;
    private messageListeners;
    private isStarted;
    private pipelines;
    private activeExecutions;
    private factory;
    private systemConfig;
    private isInitialized;
    private configName;
    private configFile;
    private port;
    private loadBalancer;
    private pipelineAssemblyStats;
    private readonly MODULE_SELECTORS;
    constructor(factory: StandardPipelineFactory, systemConfig?: any);
    /**
     * 静态流水线组装系统初始化 - 根据路由表组装所有流水线
     * 核心改造: 基于路由器输出动态选择模块进行组装
     */
    initializeFromRoutingTable(routingTable: RoutingTable, configInfo?: {
        name: string;
        file: string;
        port?: number;
    }): Promise<void>;
    /**
     * 🎯 核心算法: 根据路由器输出动态选择模块
     * 静态组装系统的关键方法 - 基于路由决策选择正确的模块
     */
    private selectModulesBasedOnRouterOutput;
    /**
     * 确定服务器模块类型
     */
    private determineServerModuleType;
    /**
     * 使用动态选择的模块创建流水线
     */
    private createCompletePipelineWithSelectedModules;
    /**
     * 创建完整流水线 (Provider.Model.APIKey组合)
     */
    private createCompletePipeline;
    /**
     * 获取模块类型用于创建
     */
    private getModuleTypeForCreation;
    /**
     * 获取模块配置
     */
    private getModuleConfig;
    /**
     * 获取模块实例
     */
    private getModuleInstance;
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
     * 获取指定Pipeline状态
     */
    getPipelineStatusById(pipelineId: string): PipelineStatus | null;
    /**
     * 获取所有Pipeline状态
     */
    getAllPipelineStatus(): Record<string, PipelineStatus>;
    /**
     * 获取调度器状态（符合PipelineModuleInterface接口）
     */
    getPipelineStatus(): any;
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
        details: any;
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
    getId(): string;
    getName(): string;
    getType(): ModuleType;
    getVersion(): string;
    getStatus(): ModuleStatus;
    getMetrics(): ModuleMetrics;
    configure(config: any): Promise<void>;
    initialize(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    process(input: any): Promise<any>;
    reset(): Promise<void>;
    cleanup(): Promise<void>;
    isRunning(): boolean;
    addConnection(module: any): void;
    removeConnection(moduleId: string): void;
    getConnection(moduleId: string): any;
    getConnections(): any[];
    sendToModule(targetModuleId: string, message: any, type?: string): Promise<any>;
    broadcastToModules(message: any, type?: string): Promise<void>;
    onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void): void;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
    removeAllListeners(event?: string | symbol): this;
}
//# sourceMappingURL=pipeline-manager.d.ts.map