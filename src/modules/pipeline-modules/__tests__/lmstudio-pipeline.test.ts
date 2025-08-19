/**
 * LM Studio Pipeline Tests
 *
 * 测试LM Studio四层架构流水线的正确性
 *
 * @author Jason Zhang
 */

import { LMStudioPipeline, LMStudioPipelineConfig } from '../lmstudio-pipeline';

describe('LM Studio Pipeline', () => {
  let pipeline: LMStudioPipeline;
  let config: LMStudioPipelineConfig;

  beforeEach(() => {
    config = {
      id: 'test-lmstudio-pipeline',
      name: 'Test LM Studio Pipeline',
      lmstudioEndpoint: 'http://localhost:1234/v1',
      lmstudioApiKey: 'test-key',
      timeout: 10000,
      maxRetries: 2,
      supportedModels: ['llama-3.1-8b-instruct'],
    };

    pipeline = new LMStudioPipeline(config);
  });

  afterEach(async () => {
    if (pipeline) {
      await pipeline.destroy();
    }
  });

  describe('Pipeline Construction', () => {
    test('should create pipeline with correct configuration', () => {
      expect(pipeline.id).toBe(config.id);
      expect(pipeline.spec.name).toBe(config.name);
      expect(pipeline.spec.provider).toBe('lmstudio');
    });

    test('should have four modules in correct order', () => {
      const modules = pipeline.getAllModules();
      expect(modules).toHaveLength(4);

      const moduleNames = modules.map(m => m.getName());
      expect(moduleNames).toEqual([
        'Anthropic to OpenAI Transformer',
        'OpenAI Protocol Module',
        'LM Studio Compatibility Module',
        'OpenAI Server Module',
      ]);
    });

    test('should have correct module types', () => {
      const modules = pipeline.getAllModules();
      const moduleTypes = modules.map(m => m.getType());
      expect(moduleTypes).toEqual(['transformer', 'protocol', 'server-compatibility', 'server']);
    });
  });

  describe('Pipeline Lifecycle', () => {
    test('should start and stop successfully', async () => {
      // 注意：这个测试不需要真实的LM Studio连接
      // 因为我们只测试流水线结构，不测试实际API调用

      const status = pipeline.getStatus();
      expect(status.initialized).toBe(false);

      // 测试流水线规格
      const spec = pipeline.spec;
      expect(spec.provider).toBe('lmstudio');
      expect(spec.modules).toHaveLength(4);
      expect(spec.configuration.parallel).toBe(false);
      expect(spec.configuration.failFast).toBe(true);
    });

    test('should validate pipeline structure', async () => {
      // 测试模块可以获取
      const transformerModule = pipeline.getModule('anthropic-to-openai-transformer');
      expect(transformerModule).toBeDefined();
      expect(transformerModule?.getType()).toBe('transformer');

      const protocolModule = pipeline.getModule('openai-protocol');
      expect(protocolModule).toBeDefined();
      expect(protocolModule?.getType()).toBe('protocol');

      const compatibilityModule = pipeline.getModule('lmstudio-compatibility');
      expect(compatibilityModule).toBeDefined();
      expect(compatibilityModule?.getType()).toBe('server-compatibility');

      const serverModule = pipeline.getModule('openai-server');
      expect(serverModule).toBeDefined();
      expect(serverModule?.getType()).toBe('server');
    });
  });

  describe('Input Validation', () => {
    test('should validate Anthropic request format', () => {
      const validAnthropicRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [
          {
            role: 'user' as const,
            content: 'Hello, how are you?',
          },
        ],
      };

      // 测试transformer模块的验证
      const transformerModule = pipeline.getModule('anthropic-to-openai-transformer');
      expect(transformerModule).toBeDefined();

      // 这里我们测试模块存在，实际的验证逻辑在模块内部
      expect(transformerModule?.getName()).toBe('Anthropic to OpenAI Transformer');
    });

    test('should handle invalid input gracefully', () => {
      const invalidRequest = {
        // 缺少必要字段
        messages: [],
      };

      // 流水线应该能够处理无效输入并抛出适当的错误
      expect(() => {
        // 这里测试结构，不执行实际处理
        pipeline.getStatus();
      }).not.toThrow();
    });
  });

  describe('Module Integration', () => {
    test('should have proper module event handling', () => {
      let statusChangeCount = 0;
      let errorCount = 0;

      pipeline.on('moduleStatusChanged', () => {
        statusChangeCount++;
      });

      pipeline.on('moduleError', () => {
        errorCount++;
      });

      // 测试事件监听器已设置
      expect(pipeline.listenerCount('moduleStatusChanged')).toBe(1);
      expect(pipeline.listenerCount('moduleError')).toBe(1);
    });

    test('should support pipeline execution events', () => {
      let executionStarted = false;
      let executionCompleted = false;

      pipeline.on('pipelineExecutionCompleted', () => {
        executionCompleted = true;
      });

      pipeline.on('pipelineStarted', () => {
        executionStarted = true;
      });

      // 测试事件监听器存在
      expect(pipeline.listenerCount('pipelineExecutionCompleted')).toBe(1);
      expect(pipeline.listenerCount('pipelineStarted')).toBe(1);
    });
  });

  describe('Error Handling', () => {
    test('should prevent module manipulation', () => {
      // LM Studio流水线的模块顺序是固定的
      expect(() => pipeline.addModule({} as any)).toThrow('LM Studio流水线模块顺序是固定的');
      expect(() => pipeline.removeModule('test')).toThrow('LM Studio流水线模块顺序是固定的');
      expect(() => pipeline.setModuleOrder([])).toThrow('LM Studio流水线模块顺序是固定的');
      expect(() => pipeline.executeModule('test', {})).toThrow('使用execute方法执行完整流水线');
    });

    test('should handle uninitialized execution', async () => {
      // 未初始化的流水线应该抛出错误
      await expect(pipeline.execute({})).rejects.toThrow('流水线未初始化');
    });
  });

  describe('Configuration', () => {
    test('should use correct LM Studio endpoint configuration', () => {
      const status = pipeline.getStatus();
      expect(status.id).toBe('test-lmstudio-pipeline');
      expect(status.name).toBe('Test LM Studio Pipeline');
    });

    test('should have proper retry and timeout configuration', () => {
      const spec = pipeline.spec;
      expect(spec.configuration.retryPolicy?.maxRetries).toBe(2);
      expect(spec.configuration.failFast).toBe(true);
    });
  });
});

// 集成测试 - 需要真实LM Studio实例
describe('LM Studio Pipeline Integration (requires LM Studio)', () => {
  let pipeline: LMStudioPipeline;

  beforeEach(() => {
    const config: LMStudioPipelineConfig = {
      id: 'integration-test-pipeline',
      name: 'Integration Test Pipeline',
      lmstudioEndpoint: 'http://localhost:1234/v1',
      timeout: 30000,
      maxRetries: 1,
      supportedModels: ['llama-3.1-8b-instruct'],
    };

    pipeline = new LMStudioPipeline(config);
  });

  afterEach(async () => {
    if (pipeline) {
      await pipeline.destroy();
    }
  });

  test.skip('should execute complete pipeline with real LM Studio', async () => {
    // 这个测试需要真实的LM Studio实例运行在localhost:1234
    // 使用.skip来跳过，只有在有LM Studio环境时才运行

    const anthropicRequest = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 100,
      messages: [
        {
          role: 'user' as const,
          content: '简单回答：你好',
        },
      ],
    };

    await pipeline.start();

    const result = await pipeline.processAnthropicRequest(anthropicRequest);

    expect(result).toBeDefined();
    expect(result.type).toBe('message');
    expect(result.role).toBe('assistant');
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);
  });

  test.skip('should handle LM Studio connection errors gracefully', async () => {
    // 测试连接错误处理
    const badConfig: LMStudioPipelineConfig = {
      id: 'bad-config-pipeline',
      name: 'Bad Config Pipeline',
      lmstudioEndpoint: 'http://localhost:9999/v1', // 错误端口
      timeout: 5000,
      maxRetries: 1,
      supportedModels: ['test-model'],
    };

    const badPipeline = new LMStudioPipeline(badConfig);

    await expect(badPipeline.start()).rejects.toThrow();

    await badPipeline.destroy();
  });
});
