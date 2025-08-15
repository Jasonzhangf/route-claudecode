/**
 * Pipeline管理器核心实现
 *
 * 负责Pipeline的创建、执行、监控和销毁
 *
 * @author Jason Zhang
 */
import { EventEmitter } from 'events';
import { PipelineConfig, ExecutionContext, ExecutionResult, ExecutionRecord, StandardPipelineFactory } from '../interfaces/pipeline/pipeline-framework';
import { StandardPipeline } from './standard-pipeline';
import { PipelineStatus } from '../interfaces/module/pipeline-module';
/**
 * Pipeline管理器
 */
export declare class PipelineManager extends EventEmitter {
    private pipelines;
    private activeExecutions;
    private factory;
    constructor(factory: StandardPipelineFactory);
    /**
     * 创建Pipeline
     */
    createPipeline(config: PipelineConfig): Promise<string>;
    /**
     * 销毁Pipeline
     */
    destroyPipeline(pipelineId: string): Promise<boolean>;
    /**
     * 获取Pipeline
     */
    getPipeline(pipelineId: string): StandardPipeline | null;
    /**
     * 获取所有Pipeline
     */
    getAllPipelines(): Map<string, StandardPipeline>;
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
}
//# sourceMappingURL=pipeline-manager.d.ts.map