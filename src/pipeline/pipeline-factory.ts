/**
 * Pipeline工厂实现
 * 
 * 负责创建各种类型的Pipeline实例
 * 
 * @author Jason Zhang
 */

import { 
  StandardPipelineFactory, 
  PipelineFramework, 
  PipelineConfig 
} from '../interfaces/pipeline/pipeline-framework';
import { PipelineSpec } from '../interfaces/module/base-module';
import { StandardPipeline } from './standard-pipeline';
import { ModuleRegistry } from './module-registry';

/**
 * 标准Pipeline工厂
 */
export class StandardPipelineFactoryImpl implements StandardPipelineFactory {
  private moduleRegistry: ModuleRegistry;
  
  constructor(moduleRegistry: ModuleRegistry) {
    this.moduleRegistry = moduleRegistry;
  }
  
  /**
   * 创建标准流水线
   */
  async createStandardPipeline(config: PipelineConfig): Promise<PipelineFramework> {
    // 验证配置
    this.validateConfig(config);
    
    // 创建Pipeline实例
    const pipeline = new StandardPipeline(config);
    
    // 添加配置中的模块
    for (const moduleConfig of config.modules) {
      if (!moduleConfig.enabled) {
        continue;
      }
      
      const module = await this.moduleRegistry.createModule(
        moduleConfig.moduleId,
        moduleConfig.config
      );
      
      pipeline.addModule(module);
    }
    
    return pipeline;
  }
  
  /**
   * 创建LM Studio流水线
   */
  async createLMStudioPipeline(model: string): Promise<PipelineFramework> {
    const config: PipelineConfig = {
      id: `lmstudio-${model}-${Date.now()}`,
      name: `LM Studio Pipeline - ${model}`,
      description: `Pipeline for LM Studio model ${model}`,
      provider: 'lmstudio',
      model,
      modules: [
        {
          id: 'input-validator',
          moduleId: 'anthropic-input-validator',
          order: 1,
          enabled: true,
          config: { strictMode: true }
        },
        {
          id: 'anthropic-to-openai-transformer',
          moduleId: 'anthropic-to-openai-transformer',
          order: 2,
          enabled: true,
          config: { model, preserveToolCalls: true }
        },
        {
          id: 'lmstudio-protocol-handler',
          moduleId: 'openai-protocol-handler',
          order: 3,
          enabled: true,
          config: { 
            baseUrl: 'http://localhost:1234/v1',
            streaming: true
          }
        },
        {
          id: 'lmstudio-compatibility',
          moduleId: 'lmstudio-compatibility-handler',
          order: 4,
          enabled: true,
          config: { model }
        },
        {
          id: 'openai-to-anthropic-transformer',
          moduleId: 'openai-to-anthropic-transformer',
          order: 5,
          enabled: true,
          config: { preserveToolCalls: true }
        },
        {
          id: 'output-validator',
          moduleId: 'anthropic-output-validator',
          order: 6,
          enabled: true,
          config: { strictMode: true }
        }
      ],
      settings: {
        parallel: false,
        failFast: true,
        timeout: 60000,
        retryPolicy: {
          enabled: true,
          maxRetries: 3,
          backoffMultiplier: 2,
          initialDelay: 1000,
          maxDelay: 10000,
          retryableErrors: ['TIMEOUT', 'CONNECTION_ERROR', 'RATE_LIMIT']
        },
        errorHandling: {
          stopOnFirstError: true,
          allowPartialSuccess: false,
          errorRecovery: false,
          fallbackStrategies: []
        },
        logging: {
          enabled: true,
          level: 'info',
          includeInput: false,
          includeOutput: false,
          maskSensitiveData: true,
          maxLogSize: 1024 * 1024
        },
        monitoring: {
          enabled: true,
          collectMetrics: true,
          performanceTracking: true,
          alerting: {
            enabled: false,
            thresholds: {
              errorRate: 0.1,
              responseTime: 5000,
              throughput: 10
            },
            channels: []
          }
        }
      }
    };
    
    return this.createStandardPipeline(config);
  }
  
  /**
   * 创建OpenAI流水线
   */
  async createOpenAIPipeline(model: string): Promise<PipelineFramework> {
    const config: PipelineConfig = {
      id: `openai-${model}-${Date.now()}`,
      name: `OpenAI Pipeline - ${model}`,
      description: `Pipeline for OpenAI model ${model}`,
      provider: 'openai',
      model,
      modules: [
        {
          id: 'input-validator',
          moduleId: 'anthropic-input-validator',
          order: 1,
          enabled: true,
          config: { strictMode: true }
        },
        {
          id: 'anthropic-to-openai-transformer',
          moduleId: 'anthropic-to-openai-transformer',
          order: 2,
          enabled: true,
          config: { model, preserveToolCalls: true }
        },
        {
          id: 'openai-protocol-handler',
          moduleId: 'openai-protocol-handler',
          order: 3,
          enabled: true,
          config: { 
            baseUrl: 'https://api.openai.com/v1',
            streaming: true
          }
        },
        {
          id: 'openai-to-anthropic-transformer',
          moduleId: 'openai-to-anthropic-transformer',
          order: 4,
          enabled: true,
          config: { preserveToolCalls: true }
        },
        {
          id: 'output-validator',
          moduleId: 'anthropic-output-validator',
          order: 5,
          enabled: true,
          config: { strictMode: true }
        }
      ],
      settings: {
        parallel: false,
        failFast: true,
        timeout: 60000,
        retryPolicy: {
          enabled: true,
          maxRetries: 3,
          backoffMultiplier: 2,
          initialDelay: 1000,
          maxDelay: 10000,
          retryableErrors: ['TIMEOUT', 'CONNECTION_ERROR', 'RATE_LIMIT']
        },
        errorHandling: {
          stopOnFirstError: true,
          allowPartialSuccess: false,
          errorRecovery: false,
          fallbackStrategies: []
        },
        logging: {
          enabled: true,
          level: 'info',
          includeInput: false,
          includeOutput: false,
          maskSensitiveData: true,
          maxLogSize: 1024 * 1024
        },
        monitoring: {
          enabled: true,
          collectMetrics: true,
          performanceTracking: true,
          alerting: {
            enabled: false,
            thresholds: {
              errorRate: 0.1,
              responseTime: 5000,
              throughput: 10
            },
            channels: []
          }
        }
      }
    };
    
    return this.createStandardPipeline(config);
  }
  
  /**
   * 创建Anthropic流水线
   */
  async createAnthropicPipeline(model: string): Promise<PipelineFramework> {
    const config: PipelineConfig = {
      id: `anthropic-${model}-${Date.now()}`,
      name: `Anthropic Pipeline - ${model}`,
      description: `Pipeline for Anthropic model ${model}`,
      provider: 'anthropic',
      model,
      modules: [
        {
          id: 'input-validator',
          moduleId: 'anthropic-input-validator',
          order: 1,
          enabled: true,
          config: { strictMode: true }
        },
        {
          id: 'anthropic-protocol-handler',
          moduleId: 'anthropic-protocol-handler',
          order: 2,
          enabled: true,
          config: { 
            baseUrl: 'https://api.anthropic.com/v1',
            streaming: true
          }
        },
        {
          id: 'output-validator',
          moduleId: 'anthropic-output-validator',
          order: 3,
          enabled: true,
          config: { strictMode: true }
        }
      ],
      settings: {
        parallel: false,
        failFast: true,
        timeout: 60000,
        retryPolicy: {
          enabled: true,
          maxRetries: 3,
          backoffMultiplier: 2,
          initialDelay: 1000,
          maxDelay: 10000,
          retryableErrors: ['TIMEOUT', 'CONNECTION_ERROR', 'RATE_LIMIT']
        },
        errorHandling: {
          stopOnFirstError: true,
          allowPartialSuccess: false,
          errorRecovery: false,
          fallbackStrategies: []
        },
        logging: {
          enabled: true,
          level: 'info',
          includeInput: false,
          includeOutput: false,
          maskSensitiveData: true,
          maxLogSize: 1024 * 1024
        },
        monitoring: {
          enabled: true,
          collectMetrics: true,
          performanceTracking: true,
          alerting: {
            enabled: false,
            thresholds: {
              errorRate: 0.1,
              responseTime: 5000,
              throughput: 10
            },
            channels: []
          }
        }
      }
    };
    
    return this.createStandardPipeline(config);
  }
  
  /**
   * 从规范创建流水线
   */
  async createFromSpec(spec: PipelineSpec): Promise<PipelineFramework> {
    const config: PipelineConfig = {
      id: spec.id,
      name: spec.name,
      description: spec.description,
      provider: spec.provider || 'unknown',
      model: spec.model || 'unknown',
      modules: spec.modules.map((moduleSpec, index) => ({
        id: `${moduleSpec.id}-${index}`,
        moduleId: moduleSpec.id,
        order: index + 1,
        enabled: true,
        config: moduleSpec.config || {}
      })),
      settings: {
        parallel: false,
        failFast: true,
        timeout: spec.timeout || 60000,
        retryPolicy: {
          enabled: true,
          maxRetries: 3,
          backoffMultiplier: 2,
          initialDelay: 1000,
          maxDelay: 10000,
          retryableErrors: ['TIMEOUT', 'CONNECTION_ERROR', 'RATE_LIMIT']
        },
        errorHandling: {
          stopOnFirstError: true,
          allowPartialSuccess: false,
          errorRecovery: false,
          fallbackStrategies: []
        },
        logging: {
          enabled: true,
          level: 'info',
          includeInput: false,
          includeOutput: false,
          maskSensitiveData: true,
          maxLogSize: 1024 * 1024
        },
        monitoring: {
          enabled: true,
          collectMetrics: true,
          performanceTracking: true,
          alerting: {
            enabled: false,
            thresholds: {
              errorRate: 0.1,
              responseTime: 5000,
              throughput: 10
            },
            channels: []
          }
        }
      }
    };
    
    return this.createStandardPipeline(config);
  }
  
  /**
   * 克隆流水线
   */
  async clonePipeline(sourceId: string, newId: string): Promise<PipelineFramework> {
    // 这里应该从数据库或存储中获取源Pipeline配置
    // 目前为简化实现，抛出错误
    throw new Error('Pipeline cloning not implemented yet');
  }
  
  /**
   * 验证Pipeline配置
   */
  private validateConfig(config: PipelineConfig): void {
    if (!config.id || !config.id.trim()) {
      throw new Error('Pipeline ID is required');
    }
    
    if (!config.name || !config.name.trim()) {
      throw new Error('Pipeline name is required');
    }
    
    if (!config.modules || config.modules.length === 0) {
      throw new Error('Pipeline must have at least one module');
    }
    
    // 验证模块顺序的唯一性
    const orders = config.modules.map(m => m.order);
    const uniqueOrders = new Set(orders);
    if (orders.length !== uniqueOrders.size) {
      throw new Error('Module orders must be unique');
    }
    
    // 验证模块ID的唯一性
    const moduleIds = config.modules.map(m => m.id);
    const uniqueModuleIds = new Set(moduleIds);
    if (moduleIds.length !== uniqueModuleIds.size) {
      throw new Error('Module IDs must be unique');
    }
    
    // 验证设置
    if (config.settings.timeout <= 0) {
      throw new Error('Pipeline timeout must be positive');
    }
    
    if (config.settings.retryPolicy.maxRetries < 0) {
      throw new Error('Max retries must be non-negative');
    }
  }
}