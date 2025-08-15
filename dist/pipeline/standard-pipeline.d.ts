/**
 * 标准流水线实现
 *
 * RCC v4.0核心流水线执行引擎
 *
 * @author Jason Zhang
 */
import { EventEmitter } from 'events';
import { ModuleInterface, PipelineSpec } from '../interfaces';
import { PipelineFramework, ExecutionRecord } from '../interfaces/pipeline/pipeline-framework';
import { PipelineStatus } from '../interfaces/module/pipeline-module';
/**
 * Pipeline配置接口
 */
export interface PipelineConfig {
    id: string;
    name: string;
    provider: string;
    model: string;
    modules: Array<{
        moduleId: string;
        order: number;
        config: any;
    }>;
}
/**
 * 执行上下文
 */
export interface ExecutionContext {
    metadata?: any;
    configuration?: any;
    timeout?: number;
}
/**
 * 标准流水线实现
 */
export declare class StandardPipeline extends EventEmitter implements PipelineFramework {
    readonly id: string;
    private readonly name;
    private readonly config;
    private moduleMap;
    private moduleOrder;
    private status;
    private executionHistory;
    constructor(config: PipelineConfig);
    get provider(): string;
    get model(): string;
    get modules(): ModuleInterface[];
    get spec(): PipelineSpec;
    /**
     * 处理请求
     */
    process(input: any): Promise<any>;
    /**
     * 验证流水线
     */
    validate(): Promise<boolean>;
    /**
     * 获取状态
     */
    getStatus(): PipelineStatus;
    /**
     * 启动流水线
     */
    start(): Promise<void>;
    /**
     * 停止流水线
     */
    stop(): Promise<void>;
    /**
     * 销毁流水线
     */
    destroy(): Promise<void>;
    /**
     * 添加模块
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
     * 执行流水线
     */
    execute(input: any, context?: ExecutionContext): Promise<any>;
    /**
     * 获取执行历史
     */
    getExecutionHistory(): ExecutionRecord[];
    /**
     * 重置流水线
     */
    reset(): Promise<void>;
    /**
     * 设置模块事件监听器
     */
    private setupModuleEventListeners;
}
//# sourceMappingURL=standard-pipeline.d.ts.map