/**
 * Pipeline管理器测试
 * 
 * 测试PipelineManager的核心功能
 * 
 * @author Jason Zhang
 */

import { PipelineManager } from '../../src/pipeline/pipeline-manager';
import { ModuleRegistry, StandardPipelineFactoryImpl } from '../../src/pipeline';
import { AnthropicInputValidator } from '../../src/modules/validators/anthropic-input-validator';
import { AnthropicToOpenAITransformer } from '../../src/modules/transformers/anthropic-to-openai-transformer';
import { PipelineConfig, ExecutionContext } from '../../src/interfaces/pipeline/pipeline-framework';

describe('RCC v4.0 Pipeline Manager', () => {
  let pipelineManager: PipelineManager;
  let moduleRegistry: ModuleRegistry;
  let factory: StandardPipelineFactoryImpl;
  
  beforeEach(() => {
    moduleRegistry = new ModuleRegistry();
    factory = new StandardPipelineFactoryImpl(moduleRegistry);
    pipelineManager = new PipelineManager(factory);
    
    // 注册测试模块
    moduleRegistry.registerModule({
      id: 'anthropic-input-validator',
      name: 'Anthropic Input Validator',
      type: 'validator',
      description: 'Validates Anthropic API input format',
      factory: async (config) => new AnthropicInputValidator('validator-1', config),
      version: '1.0.0',
      author: 'Jason Zhang'
    });
    
    moduleRegistry.registerModule({
      id: 'anthropic-to-openai-transformer',
      name: 'Anthropic to OpenAI Transformer',
      type: 'transformer', 
      description: 'Transforms Anthropic format to OpenAI format',
      factory: async (config) => new AnthropicToOpenAITransformer('transformer-1', config),
      version: '1.0.0',
      author: 'Jason Zhang'
    });
  });
  
  afterEach(async () => {
    // 清理所有Pipeline
    const pipelines = pipelineManager.getAllPipelines();
    for (const [pipelineId] of pipelines) {
      await pipelineManager.destroyPipeline(pipelineId);
    }
    
    await moduleRegistry.clear();
  });
  
  describe('Pipeline Creation and Management', () => {
    it('should create a pipeline successfully', async () => {
      const config: PipelineConfig = {
        id: 'test-pipeline-1',
        name: 'Test Pipeline',
        description: 'Test pipeline for validation',
        provider: 'test',
        model: 'test-model',
        modules: [
          {
            id: 'validator',
            moduleId: 'anthropic-input-validator',
            order: 1,
            enabled: true,
            config: { strictMode: true }
          },
          {
            id: 'transformer',
            moduleId: 'anthropic-to-openai-transformer',
            order: 2,
            enabled: true,
            config: { model: 'gpt-3.5-turbo' }
          }
        ],
        settings: {
          parallel: false,
          failFast: true,
          timeout: 30000,
          retryPolicy: {
            enabled: false,
            maxRetries: 0,
            backoffMultiplier: 1,
            initialDelay: 1000,
            maxDelay: 5000,
            retryableErrors: []
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
            maxLogSize: 1024
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
      
      const pipelineId = await pipelineManager.createPipeline(config);
      expect(pipelineId).toBe('test-pipeline-1');
      
      const pipeline = pipelineManager.getPipeline(pipelineId);
      expect(pipeline).toBeTruthy();
      expect(pipeline!.getId()).toBe('test-pipeline-1');
      expect(pipeline!.getName()).toBe('Test Pipeline');
    });
    
    it('should start and stop pipeline successfully', async () => {
      const config: PipelineConfig = {
        id: 'test-pipeline-2',
        name: 'Test Pipeline 2',
        description: 'Test pipeline for start/stop',
        provider: 'test',
        model: 'test-model',
        modules: [
          {
            id: 'validator',
            moduleId: 'anthropic-input-validator',
            order: 1,
            enabled: true,
            config: {}
          }
        ],
        settings: {
          parallel: false,
          failFast: true,
          timeout: 30000,
          retryPolicy: {
            enabled: false,
            maxRetries: 0,
            backoffMultiplier: 1,
            initialDelay: 1000,
            maxDelay: 5000,
            retryableErrors: []
          },
          errorHandling: {
            stopOnFirstError: true,
            allowPartialSuccess: false,
            errorRecovery: false,
            fallbackStrategies: []
          },
          logging: {
            enabled: false,
            level: 'info',
            includeInput: false,
            includeOutput: false,
            maskSensitiveData: true,
            maxLogSize: 1024
          },
          monitoring: {
            enabled: false,
            collectMetrics: false,
            performanceTracking: false,
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
      
      const pipelineId = await pipelineManager.createPipeline(config);
      const pipeline = pipelineManager.getPipeline(pipelineId);
      
      // 启动Pipeline
      await pipeline!.start();
      const statusAfterStart = pipelineManager.getPipelineStatus(pipelineId);
      expect(statusAfterStart!.status).toBe('running');
      
      // 停止Pipeline
      await pipeline!.stop();
      const statusAfterStop = pipelineManager.getPipelineStatus(pipelineId);
      expect(statusAfterStop!.status).toBe('stopped');
    });
    
    it('should destroy pipeline successfully', async () => {
      const config: PipelineConfig = {
        id: 'test-pipeline-3',
        name: 'Test Pipeline 3',
        description: 'Test pipeline for destruction',
        provider: 'test',
        model: 'test-model',
        modules: [
          {
            id: 'validator',
            moduleId: 'anthropic-input-validator',
            order: 1,
            enabled: true,
            config: {}
          }
        ],
        settings: {
          parallel: false,
          failFast: true,
          timeout: 30000,
          retryPolicy: {
            enabled: false,
            maxRetries: 0,
            backoffMultiplier: 1,
            initialDelay: 1000,
            maxDelay: 5000,
            retryableErrors: []
          },
          errorHandling: {
            stopOnFirstError: true,
            allowPartialSuccess: false,
            errorRecovery: false,
            fallbackStrategies: []
          },
          logging: {
            enabled: false,
            level: 'info',
            includeInput: false,
            includeOutput: false,
            maskSensitiveData: true,
            maxLogSize: 1024
          },
          monitoring: {
            enabled: false,
            collectMetrics: false,
            performanceTracking: false,
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
      
      const pipelineId = await pipelineManager.createPipeline(config);
      expect(pipelineManager.getPipeline(pipelineId)).toBeTruthy();
      
      const destroyed = await pipelineManager.destroyPipeline(pipelineId);
      expect(destroyed).toBe(true);
      expect(pipelineManager.getPipeline(pipelineId)).toBeNull();
    });
  });
  
  describe('Pipeline Execution', () => {
    let testPipelineId: string;
    
    beforeEach(async () => {
      const config: PipelineConfig = {
        id: 'execution-test-pipeline',
        name: 'Execution Test Pipeline',
        description: 'Pipeline for testing execution',
        provider: 'test',
        model: 'test-model',
        modules: [
          {
            id: 'validator',
            moduleId: 'anthropic-input-validator',
            order: 1,
            enabled: true,
            config: { strictMode: false }
          }
        ],
        settings: {
          parallel: false,
          failFast: true,
          timeout: 30000,
          retryPolicy: {
            enabled: false,
            maxRetries: 0,
            backoffMultiplier: 1,
            initialDelay: 1000,
            maxDelay: 5000,
            retryableErrors: []
          },
          errorHandling: {
            stopOnFirstError: true,
            allowPartialSuccess: false,
            errorRecovery: false,
            fallbackStrategies: []
          },
          logging: {
            enabled: false,
            level: 'info',
            includeInput: false,
            includeOutput: false,
            maskSensitiveData: true,
            maxLogSize: 1024
          },
          monitoring: {
            enabled: false,
            collectMetrics: false,
            performanceTracking: false,
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
      
      testPipelineId = await pipelineManager.createPipeline(config);
      const pipeline = pipelineManager.getPipeline(testPipelineId);
      await pipeline!.start();
    });
    
    it('should execute pipeline with valid input', async () => {
      const input = {
        model: 'claude-3-sonnet-20240229',
        messages: [
          { role: 'user', content: 'Hello, world!' }
        ],
        max_tokens: 100
      };
      
      const context: ExecutionContext = {
        requestId: 'test-request-1',
        priority: 'normal'
      };
      
      const result = await pipelineManager.executePipeline(testPipelineId, input, context);
      
      expect(result.status).toBe('success');
      expect(result.executionId).toBeTruthy();
      expect(result.executionRecord).toBeTruthy();
      expect(result.executionRecord.status).toBe('completed');
      expect(result.performance).toBeTruthy();
    });
    
    it('should handle execution errors gracefully', async () => {
      const invalidInput = {
        // 缺少必需字段
      };
      
      const context: ExecutionContext = {
        requestId: 'test-request-2',
        priority: 'normal'
      };
      
      await expect(
        pipelineManager.executePipeline(testPipelineId, invalidInput, context)
      ).rejects.toThrow();
    });
  });
  
  describe('Pipeline Status and Monitoring', () => {
    it('should return correct pipeline status', async () => {
      const config: PipelineConfig = {
        id: 'status-test-pipeline',
        name: 'Status Test Pipeline',
        description: 'Pipeline for testing status',
        provider: 'test',
        model: 'test-model',
        modules: [
          {
            id: 'validator',
            moduleId: 'anthropic-input-validator',
            order: 1,
            enabled: true,
            config: {}
          }
        ],
        settings: {
          parallel: false,
          failFast: true,
          timeout: 30000,
          retryPolicy: {
            enabled: false,
            maxRetries: 0,
            backoffMultiplier: 1,
            initialDelay: 1000,
            maxDelay: 5000,
            retryableErrors: []
          },
          errorHandling: {
            stopOnFirstError: true,
            allowPartialSuccess: false,
            errorRecovery: false,
            fallbackStrategies: []
          },
          logging: {
            enabled: false,
            level: 'info',
            includeInput: false,
            includeOutput: false,
            maskSensitiveData: true,
            maxLogSize: 1024
          },
          monitoring: {
            enabled: false,
            collectMetrics: false,
            performanceTracking: false,
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
      
      const pipelineId = await pipelineManager.createPipeline(config);
      
      const statusBeforeStart = pipelineManager.getPipelineStatus(pipelineId);
      expect(statusBeforeStart!.status).toBe('stopped');
      
      const pipeline = pipelineManager.getPipeline(pipelineId);
      await pipeline!.start();
      
      const statusAfterStart = pipelineManager.getPipelineStatus(pipelineId);
      expect(statusAfterStart!.status).toBe('running');
    });
    
    it('should perform health check successfully', async () => {
      const healthCheck = await pipelineManager.healthCheck();
      
      expect(healthCheck).toBeTruthy();
      expect(typeof healthCheck.healthy).toBe('boolean');
      expect(typeof healthCheck.pipelines).toBe('number');
      expect(typeof healthCheck.activeExecutions).toBe('number');
      expect(Array.isArray(healthCheck.issues)).toBe(true);
    });
  });
});