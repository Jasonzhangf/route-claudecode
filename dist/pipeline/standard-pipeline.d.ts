/**
 * 标准Pipeline实现
 *
 * 实现PipelineFramework接口，提供完整的Pipeline执行功能
 *
 * @author Jason Zhang
 */
import { EventEmitter } from 'events';
import { PipelineFramework, PipelineConfig, ExecutionContext, ExecutionRecord } from '../interfaces/pipeline/pipeline-framework';
import { ModuleInterface, PipelineSpec } from '../interfaces/module/base-module';
import { PipelineStatus } from '../interfaces/module/pipeline-module';
/**
 * 标准Pipeline实现
 */
export declare class StandardPipeline extends EventEmitter implements PipelineFramework {
    readonly id: string;
    private readonly name;
    private readonly config;
    private readonly providerName;
    private readonly modelName;
    private modules;
    private moduleOrder;
    private status;
    private executionHistory;
    private currentExecution?;
    constructor(config: PipelineConfig);
    /**
     * 获取Pipeline ID
     */
    getId(): string;
    /**
     * Pipeline接口实现 - provider getter
     */
    get provider(): string;
    /**
     * Pipeline接口实现 - model getter
     */
    get model(): string;
    /**
     * Pipeline接口实现 - spec getter
     */
    get spec(): PipelineSpec;
    /**
     * 获取Pipeline名称
     */
    getName(): string;
    /**
     * 获取Pipeline状态
     */
    getStatus(): PipelineStatus;
    /**
     * 启动Pipeline
     */
    start(): Promise<void>;
    /**
     * 停止Pipeline
     */
    stop(): Promise<void>;
    /**
     * 执行Pipeline
     */
    execute(input: any, context?: ExecutionContext): Promise<any>;
    /**
     * 添加模块到流水线
     */
    addModule(module: ModuleInterface): void;
    /**
     * 移除模块
     */
    removeModule(moduleId: string): void;
    /**
     * 获取模块
     */
    getModule(moduleId: string): ModuleInterface | null;
    /**
     * 获取所有模块
     */
    getAllModules(): ModuleInterface[];
    /**
     * 设置模块顺序
     */
    setModuleOrder(moduleIds: string[]): void;
    /**
     * 执行单个模块
     */
    executeModule(moduleId: string, input: any): Promise<any>;
    /**
     * 获取执行历史
     */
    getExecutionHistory(): ExecutionRecord[];
    /**
     * 重置流水线状态
     */
    reset(): Promise<void>;
    /**
     * 执行单个模块（内部方法）
     */
    private executeModuleInternal;
    /**
     * 设置模块事件监听器
     */
    private setupModuleEventListeners;
    /**
     * 生成执行ID
     */
    private generateExecutionId;
    /**
     * 计算平均处理时间
     */
    private calculateAverageProcessingTime;
    /**
     * 计算错误率
     */
    private calculateErrorRate;
    /**
     * 计算吞吐量
     */
    private calculateThroughput;
    /**
     * Pipeline接口实现 - process方法
     */
    process(input: any): Promise<any>;
    /**
     * Pipeline接口实现 - validate方法
     */
    validate(): Promise<boolean>;
    /**
     * Pipeline接口实现 - destroy方法
     */
    destroy(): Promise<void>;
}
//# sourceMappingURL=standard-pipeline.d.ts.map