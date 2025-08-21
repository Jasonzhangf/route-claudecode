/**
 * Pipeline工厂
 *
 * 负责创建各种类型的CompletePipeline实例
 * 封装了复杂的Pipeline创建逻辑
 *
 * @author RCC v4.0
 */
import { CompletePipeline, CompletePipelineConfig, PipelineSystemConfig } from './pipeline-manager-types';
import { PipelineConfig, StandardPipelineFactory, PipelineFramework } from '../interfaces/pipeline/pipeline-framework';
export declare class PipelineFactory {
    private factory;
    private systemConfig?;
    constructor(factory: StandardPipelineFactory, systemConfig?: PipelineSystemConfig);
    /**
     * 创建完整流水线 (Provider.Model.APIKey组合)
     */
    createCompletePipeline(config: CompletePipelineConfig): Promise<CompletePipeline>;
    /**
     * 创建用于向后兼容的Legacy Pipeline包装器
     */
    createLegacyPipelineWrapper(config: PipelineConfig): Promise<CompletePipeline>;
    /**
     * 创建默认的Pipeline设置
     */
    private createDefaultPipelineSettings;
}
/**
 * 标准流水线工厂实现
 * 实现StandardPipelineFactory接口，提供向后兼容
 */
export declare class StandardPipelineFactoryImpl implements StandardPipelineFactory {
    private moduleRegistry?;
    constructor(moduleRegistry?: any);
    private createDefaultPipelineSettings;
    /**
     * 创建标准流水线
     */
    createStandardPipeline(config: PipelineConfig): Promise<PipelineFramework>;
    /**
     * 创建LM Studio流水线
     */
    createLMStudioPipeline(model: string): Promise<PipelineFramework>;
    /**
     * 创建OpenAI流水线
     */
    createOpenAIPipeline(model: string): Promise<PipelineFramework>;
    /**
     * 创建Anthropic流水线
     */
    createAnthropicPipeline(model: string): Promise<PipelineFramework>;
    /**
     * 从规范创建流水线
     */
    createFromSpec(spec: any): Promise<PipelineFramework>;
    /**
     * 克隆流水线
     */
    clonePipeline(sourceId: string, newId: string): Promise<PipelineFramework>;
}
//# sourceMappingURL=pipeline-factory.d.ts.map