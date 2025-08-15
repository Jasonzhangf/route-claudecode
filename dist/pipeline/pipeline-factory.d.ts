/**
 * Pipeline工厂实现
 *
 * 负责创建各种类型的Pipeline实例
 *
 * @author Jason Zhang
 */
import { StandardPipelineFactory, PipelineFramework, PipelineConfig } from '../interfaces/pipeline/pipeline-framework';
import { PipelineSpec } from '../interfaces/module/base-module';
import { ModuleRegistry } from './module-registry';
/**
 * 标准Pipeline工厂
 */
export declare class StandardPipelineFactoryImpl implements StandardPipelineFactory {
    private moduleRegistry;
    constructor(moduleRegistry: ModuleRegistry);
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
    createFromSpec(spec: PipelineSpec): Promise<PipelineFramework>;
    /**
     * 克隆流水线
     */
    clonePipeline(sourceId: string, newId: string): Promise<PipelineFramework>;
    /**
     * 验证Pipeline配置
     */
    private validateConfig;
}
//# sourceMappingURL=pipeline-factory.d.ts.map