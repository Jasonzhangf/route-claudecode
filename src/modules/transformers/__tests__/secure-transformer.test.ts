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
  TransformerValidationError,
  AnthropicRequest,
  OpenAIRequest,
  OpenAIResponse,
  AnthropicResponse,
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
      maxMessageCount: 50,
      maxMessageSize: 10240,
      maxContentLength: 102400,
      maxToolsCount: 20,
      processingTimeoutMs: 30000,
      apiMaxTokens: 8192,
      modelMaxTokens: new Map([['test-model', 4096]]),
      strictValidation: true,
      sanitizeInputs: true,
      logSecurityEvents: false, // 测试时关闭日志
    };

    transformer = new SecureAnthropicToOpenAITransformer(config);
  });

  afterEach(async () => {
    await transformer.cleanup();
  });

  describe('基础功能测试', () => {
    test('应该正确初始化transformer', () => {
      expect(transformer.getId()).toBe('secure-anthropic-openai-transformer');
      expect(transformer.getName()).toBe('Secure Anthropic OpenAI Transformer');
      expect(transformer.getVersion()).toBe('2.0.0');
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
      const anthropicRequest: AnthropicRequest = {
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

      const result = (await transformer.process(anthropicRequest)) as OpenAIRequest;

      expect(result.model).toBe('claude-3-5-sonnet-20241022');
      expect(result.max_tokens).toBe(1000);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content).toBe('Hello, how are you?');
      expect(result.temperature).toBe(0.7);
      expect(result.stream).toBe(false);
    });

    test('应该正确处理系统消息', async () => {
      const anthropicRequest: AnthropicRequest = {
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

      const result = (await transformer.process(anthropicRequest)) as OpenAIRequest;

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('system');
      expect(result.messages[0].content).toBe('You are a helpful assistant.');
      expect(result.messages[1].role).toBe('user');
      expect(result.messages[1].content).toBe('Hello');
    });

    test('应该正确处理工具定义', async () => {
      const anthropicRequest: AnthropicRequest = {
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

      const result = (await transformer.process(anthropicRequest)) as OpenAIRequest;

      expect(result.tools).toHaveLength(1);
      expect(result.tools![0].type).toBe('function');
      expect(result.tools![0].function.name).toBe('get_weather');
      expect(result.tools![0].function.description).toBe('Get weather information');
    });

    test('应该正确限制max_tokens', async () => {
      const anthropicRequest: AnthropicRequest = {
        model: 'test-model',
        max_tokens: 10000, // 超过模型限制
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      };

      const result = (await transformer.process(anthropicRequest)) as OpenAIRequest;

      expect(result.max_tokens).toBe(4096); // 应该被限制到模型最大值
    });
  });

  describe('OpenAI到Anthropic转换测试', () => {
    beforeEach(async () => {
      await transformer.start();
    });

    test('应该正确转换OpenAI响应', async () => {
      const openaiResponse: OpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'claude-3-5-sonnet-20241022',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you today?',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      const result = (await transformer.process(openaiResponse)) as AnthropicResponse;

      expect(result.id).toBe('chatcmpl-123');
      expect(result.type).toBe('message');
      expect(result.role).toBe('assistant');
      expect(result.model).toBe('claude-3-5-sonnet-20241022');
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('Hello! How can I help you today?');
      expect(result.stop_reason).toBe('end_turn');
      expect(result.usage.input_tokens).toBe(10);
      expect(result.usage.output_tokens).toBe(20);
    });

    test('应该正确转换工具调用响应', async () => {
      const openaiResponse: OpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'claude-3-5-sonnet-20241022',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location": "San Francisco"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      const result = (await transformer.process(openaiResponse)) as AnthropicResponse;

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('tool_use');
      expect(result.content[0].id).toBe('call_123');
      expect(result.content[0].name).toBe('get_weather');
      expect(result.content[0].input).toEqual({ location: 'San Francisco' });
      expect(result.stop_reason).toBe('tool_use');
    });
  });

  describe('安全验证测试', () => {
    beforeEach(async () => {
      await transformer.start();
    });

    test('应该拒绝null输入', async () => {
      await expect(transformer.process(null)).rejects.toThrow(TransformerValidationError);
    });

    test('应该拒绝undefined输入', async () => {
      await expect(transformer.process(undefined)).rejects.toThrow(TransformerValidationError);
    });

    test('应该拒绝非对象输入', async () => {
      await expect(transformer.process('invalid')).rejects.toThrow(TransformerValidationError);
    });

    test('应该拒绝过大的输入', async () => {
      const largeInput = {
        model: 'test',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: 'x'.repeat(200000), // 超过maxContentLength
          },
        ],
      };

      await expect(transformer.process(largeInput)).rejects.toThrow(TransformerSecurityError);
    });

    test('应该验证Anthropic请求格式', async () => {
      const invalidRequest = {
        model: '', // 空模型名
        max_tokens: -1, // 负数tokens
        messages: [], // 空消息数组
      };

      await expect(transformer.process(invalidRequest)).rejects.toThrow(TransformerValidationError);
    });

    test('应该拒绝过多的消息', async () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        role: 'user' as const,
        content: `Message ${i}`,
      }));

      const request = {
        model: 'test',
        max_tokens: 1000,
        messages,
      };

      await expect(transformer.process(request)).rejects.toThrow(TransformerValidationError);
    });

    test('应该拒绝过多的工具', async () => {
      const tools = Array.from({ length: 30 }, (_, i) => ({
        name: `tool_${i}`,
        description: 'Test tool',
        input_schema: { type: 'object' },
      }));

      const request = {
        model: 'test',
        max_tokens: 1000,
        messages: [{ role: 'user' as const, content: 'Hello' }],
        tools,
      };

      await expect(transformer.process(request)).rejects.toThrow(TransformerValidationError);
    });

    test('应该安全解析JSON', async () => {
      const openaiResponse: OpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'test',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'test_function',
                    arguments: 'invalid json{', // 无效JSON
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      // 应该正常处理，跳过无效的工具调用
      const result = (await transformer.process(openaiResponse)) as AnthropicResponse;
      expect(result.content).toHaveLength(0); // 无效的工具调用被跳过
    });

    test('应该防止整数溢出', async () => {
      const request = {
        model: 'test',
        max_tokens: Number.MAX_SAFE_INTEGER + 1,
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };

      await expect(transformer.process(request)).rejects.toThrow(TransformerSecurityError);
    });
  });

  describe('错误处理测试', () => {
    test('应该在未启动状态下拒绝处理', async () => {
      const request = {
        model: 'test',
        max_tokens: 1000,
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };

      await expect(transformer.process(request)).rejects.toThrow(TransformerSecurityError);
    });

    test('应该处理配置错误', () => {
      expect(() => {
        new SecureAnthropicToOpenAITransformer({
          apiMaxTokens: -1, // 无效配置
        });
      }).toThrow();
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
        messages: [{ role: 'user' as const, content: 'Hello' }],
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
        messages: [{ role: 'user' as const, content: 'Hello' }],
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
        apiMaxTokens: 8192,
        processingTimeoutMs: 30000,
      },
    });
  });

  afterEach(async () => {
    await factory.cleanup();
  });

  describe('工厂基础功能', () => {
    test('应该创建安全的transformer实例', async () => {
      const transformer = await factory.createTransformer(SecureTransformerType.ANTHROPIC_TO_OPENAI);

      expect(transformer).toBeInstanceOf(SecureAnthropicToOpenAITransformer);
      expect(transformer.getId()).toBe('secure-anthropic-openai-transformer');
    });

    test('应该验证transformer类型', async () => {
      await expect(factory.createTransformer('invalid-type' as any)).rejects.toThrow(TransformerSecurityError);
    });

    test('应该验证配置安全性', async () => {
      await expect(
        factory.createTransformer(SecureTransformerType.ANTHROPIC_TO_OPENAI, {
          apiMaxTokens: -1, // 无效配置
        })
      ).rejects.toThrow(TransformerSecurityError);
    });

    test('应该防止重复实例ID', async () => {
      await factory.createTransformer(SecureTransformerType.ANTHROPIC_TO_OPENAI);

      // 尝试创建相同ID的实例应该失败
      await expect(factory.createTransformer(SecureTransformerType.ANTHROPIC_TO_OPENAI)).rejects.toThrow(
        TransformerSecurityError
      );
    });

    test('应该跟踪创建的实例', async () => {
      const transformer1 = await factory.createTransformer(SecureTransformerType.ANTHROPIC_TO_OPENAI, {
        // 使用不同配置以避免ID冲突
        apiMaxTokens: 4096,
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
        defaultSecurityConfig: {},
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
        strictValidation: false, // 覆盖默认值
      });

      expect(transformer).toBeDefined();
    });

    test('应该应用安全限制', async () => {
      await expect(
        factory.createTransformer(SecureTransformerType.ANTHROPIC_TO_OPENAI, {
          processingTimeoutMs: 500, // 低于最小值
        })
      ).rejects.toThrow(TransformerSecurityError);
    });
  });
});
