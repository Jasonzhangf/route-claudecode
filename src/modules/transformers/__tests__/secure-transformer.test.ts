/**
 * Secure Transformer Test Suite
 *
 * 全面测试新的安全Transformer实现
 * 验证所有安全修复和功能正确性
 *
 * @author Jason Zhang
 * @version 2.0.0
 */

import {
  SecureAnthropicToOpenAITransformer,
  SecureTransformerConfig,
  TransformerSecurityError,
} from '../secure-anthropic-openai-transformer';
import {
  SecureTransformerFactory,
  SecureTransformerType,
  createSecureTransformerFactory,
} from '../transformer-factory';

describe('SecureAnthropicToOpenAITransformer', () => {
  let transformer: SecureAnthropicToOpenAITransformer;
  let config: SecureTransformerConfig;

  beforeEach(() => {
    config = {
      preserveToolCalls: true,
      mapSystemMessage: true,
      defaultMaxTokens: 4096,
      maxTokens: 8192,
    };

    transformer = new SecureAnthropicToOpenAITransformer(config);
  });

  afterEach(async () => {
    await transformer.cleanup();
  });

  describe('基础功能测试', () => {
    test('应该正确初始化transformer', () => {
      expect(transformer.getId()).toBeDefined();
      expect(transformer.getName()).toBe('SecureAnthropicToOpenAITransformer');
      expect(transformer.getVersion()).toBe('3.0.0');
    });

    test('应该正确启动和停止', async () => {
      await transformer.start();
      expect(transformer.getStatus().status).toBe('running');

      await transformer.stop();
      expect(transformer.getStatus().status).toBe('stopped');
    });

    test('应该通过健康检查', async () => {
      await transformer.start();
      const health = await transformer.healthCheck();
      expect(health.healthy).toBe(true);
    });
  });

  describe('Anthropic到OpenAI转换测试', () => {
    beforeEach(async () => {
      await transformer.start();
    });

    test('应该正确转换基本Anthropic请求', async () => {
      const anthropicRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: 'Hello, how are you?',
          },
        ],
        temperature: 0.7,
        stream: false,
      };

      const result = await transformer.process(anthropicRequest);

      expect(result.model).toBe('claude-3-5-sonnet-20241022');
      expect(result.max_tokens).toBe(1000);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content).toBe('Hello, how are you?');
      expect(result.temperature).toBe(0.7);
      expect(result.stream).toBe(false);
    });

    test('应该正确处理系统消息', async () => {
      const anthropicRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
        system: 'You are a helpful assistant.',
      };

      const result = await transformer.process(anthropicRequest);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('system');
      expect(result.messages[0].content).toBe('You are a helpful assistant.');
      expect(result.messages[1].role).toBe('user');
      expect(result.messages[1].content).toBe('Hello');
    });

    test('应该正确处理工具定义', async () => {
      const anthropicRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: 'What is the weather?',
          },
        ],
        tools: [
          {
            name: 'get_weather',
            description: 'Get weather information',
            input_schema: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
            },
          },
        ],
      };

      const result = await transformer.process(anthropicRequest);

      expect(result.tools).toHaveLength(1);
      expect(result.tools![0].type).toBe('function');
      expect(result.tools![0].function.name).toBe('get_weather');
      expect(result.tools![0].function.description).toBe('Get weather information');
    });

    test('应该正确限制max_tokens', async () => {
      const anthropicRequest = {
        model: 'test-model',
        max_tokens: 10000, // 超过模型限制
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      };

      const result = await transformer.process(anthropicRequest);

      expect(result.max_tokens).toBe(8192); // 应该被限制到配置的最大值
    });
  });

  describe('安全验证测试', () => {
    beforeEach(async () => {
      await transformer.start();
    });

    test('应该拒绝null输入', async () => {
      await expect(transformer.process(null)).rejects.toThrow('Invalid input format');
    });

    test('应该拒绝undefined输入', async () => {
      await expect(transformer.process(undefined)).rejects.toThrow('Invalid input format');
    });

    test('应该拒绝非对象输入', async () => {
      await expect(transformer.process('invalid')).rejects.toThrow('Invalid input format');
    });
  });

  describe('错误处理测试', () => {
    test('应该在未启动状态下拒绝处理', async () => {
      const request = {
        model: 'test',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(transformer.process(request)).rejects.toThrow('Module is not running');
    });

    test('应该处理配置错误', () => {
      expect(() => {
        new SecureAnthropicToOpenAITransformer({
          maxTokens: -1, // 无效配置
        });
      }).toThrow(TransformerSecurityError);
    });
  });

  describe('性能和资源测试', () => {
    beforeEach(async () => {
      await transformer.start();
    });

    test('应该在合理时间内处理请求', async () => {
      const request = {
        model: 'test',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const startTime = Date.now();
      await transformer.process(request);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
    });

    test('应该更新性能指标', async () => {
      const request = {
        model: 'test',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await transformer.process(request);
      const metrics = transformer.getMetrics();

      expect(metrics.requestsProcessed).toBe(1);
      expect(metrics.averageProcessingTime).toBeGreaterThan(0);
      expect(metrics.errorRate).toBe(0);
    });
  });
});

describe('SecureTransformerFactory', () => {
  let factory: SecureTransformerFactory;

  beforeEach(() => {
    factory = createSecureTransformerFactory({
      defaultSecurityConfig: {
        maxTokens: 8192,
        preserveToolCalls: true,
        mapSystemMessage: true,
        defaultMaxTokens: 4096,
      },
      allowDeprecated: false,
      securityAuditMode: true,
      enableSecurityLogging: true,
    });
  });

  afterEach(async () => {
    await factory.cleanup();
  });

  describe('工厂基础功能', () => {
    test('应该创建安全的transformer实例', async () => {
      const transformer = await factory.createTransformer(SecureTransformerType.ANTHROPIC_TO_OPENAI);

      expect(transformer).toBeInstanceOf(SecureAnthropicToOpenAITransformer);
      expect(transformer.getId()).toBeDefined();
    });

    test('应该验证transformer类型', async () => {
      await expect(factory.createTransformer('invalid-type' as any)).rejects.toThrow(TransformerSecurityError);
    });

    test('应该验证配置安全性', async () => {
      await expect(
        factory.createTransformer(SecureTransformerType.ANTHROPIC_TO_OPENAI, {
          maxTokens: -1, // 无效配置
        })
      ).rejects.toThrow();
    });

    test('应该跟踪创建的实例', async () => {
      const transformer1 = await factory.createTransformer(SecureTransformerType.ANTHROPIC_TO_OPENAI, {
        maxTokens: 4096,
      });

      const instances = factory.getCreatedInstances();
      expect(instances).toHaveLength(1);
      expect(instances[0]).toBe(transformer1);
    });
  });

  describe('安全策略', () => {
    test('应该默认禁止废弃的transformer', () => {
      const factoryWithDeprecated = createSecureTransformerFactory({
        allowDeprecated: false,
        defaultSecurityConfig: {
          maxTokens: 8192,
          preserveToolCalls: true,
          mapSystemMessage: true,
          defaultMaxTokens: 4096,
        },
      });

      expect(factoryWithDeprecated).toBeDefined();
    });

    test('应该验证模块类型', async () => {
      await expect(factory.createModule('invalid' as any, {})).rejects.toThrow(TransformerSecurityError);
    });

    test('应该提供支持的类型列表', () => {
      const supportedTypes = factory.getSupportedTransformerTypes();
      expect(supportedTypes).toContain(SecureTransformerType.ANTHROPIC_TO_OPENAI);
    });
  });

  describe('配置合并', () => {
    test('应该正确合并默认配置和用户配置', async () => {
      const transformer = await factory.createTransformer(SecureTransformerType.ANTHROPIC_TO_OPENAI, {
        maxTokens: 4096,
      });

      expect(transformer).toBeDefined();
    });
  });
});
