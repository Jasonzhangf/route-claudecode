/**
 * Enhanced Server Compatibility Module - 单元测试
 *
 * 验证服务器兼容性模块的核心功能
 *
 * @author Jason Zhang
 */

import {
  EnhancedServerCompatibilityModule,
  OpenAIStandardRequest,
  OpenAIStandardResponse,
  DebugRecorder,
} from '../enhanced-compatibility';
import { ModuleType } from '../../../../interfaces/module/base-module';

describe('EnhancedServerCompatibilityModule', () => {
  let module: EnhancedServerCompatibilityModule;
  let mockDebugRecorder: DebugRecorder;

  beforeEach(() => {
    // 创建模拟Debug记录器
    mockDebugRecorder = {
      record: jest.fn(),
      recordInput: jest.fn(),
      recordOutput: jest.fn(),
      recordError: jest.fn(),
    };

    // 初始化模块
    module = new EnhancedServerCompatibilityModule(mockDebugRecorder);
  });

  describe('Module Interface Implementation', () => {
    test('should implement ModuleInterface correctly', () => {
      expect(module.getId()).toBe('enhanced-server-compatibility-module');
      expect(module.getName()).toBe('Enhanced Server Compatibility Module');
      expect(module.getType()).toBe(ModuleType.SERVER_COMPATIBILITY);
      expect(module.getVersion()).toBe('1.0.0');
    });

    test('should return correct status', () => {
      const status = module.getStatus();
      expect(status.id).toBe('enhanced-server-compatibility-module');
      expect(status.status).toBe('running');
      expect(status.health).toBe('healthy');
    });

    test('should return metrics', () => {
      const metrics = module.getMetrics();
      expect(metrics).toHaveProperty('requestsProcessed');
      expect(metrics).toHaveProperty('averageProcessingTime');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('cpuUsage');
    });

    test('should handle health check', async () => {
      const health = await module.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.details).toHaveProperty('status');
    });
  });

  describe('Request Processing Detection', () => {
    test('should correctly identify requests vs responses', async () => {
      // 测试请求格式
      const request: OpenAIStandardRequest = {
        model: 'test-model',
        messages: [{ role: 'user' as const, content: 'Hello' }],
        temperature: 0.7,
        max_tokens: 100,
      };

      const result = await module.process(request);
      expect(result).toHaveProperty('model');
      expect(mockDebugRecorder.recordInput).toHaveBeenCalled();
    });

    test('should correctly identify response format', async () => {
      // 测试响应格式
      const response = {
        id: 'test-id',
        choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      const result = await module.process(response);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('object', 'chat.completion');
      expect(mockDebugRecorder.recordInput).toHaveBeenCalled();
    });
  });

  describe('Request Adaptation', () => {
    test('should adapt DeepSeek request correctly', async () => {
      const request: OpenAIStandardRequest = {
        model: 'deepseek-chat',
        messages: [{ role: 'user' as const, content: 'Test' }],
        tools: [{ type: 'function', function: { name: 'test', description: 'Test function', parameters: {} } }],
        max_tokens: 10000, // 超出DeepSeek限制
        temperature: 3.0, // 超出范围
      };

      const result = await module.adaptRequest(request, 'deepseek');

      expect(result.tool_choice).toBe('auto'); // DeepSeek自动设置tool_choice
      expect(result.max_tokens).toBe(8192); // 被限制到DeepSeek最大值
      expect(result.temperature).toBe(2.0); // 被限制到最大值
      expect(mockDebugRecorder.recordInput).toHaveBeenCalled();
      expect(mockDebugRecorder.recordOutput).toHaveBeenCalled();
    });

    test('should adapt LM Studio request correctly', async () => {
      const request: OpenAIStandardRequest = {
        model: 'qwen-local',
        messages: [{ role: 'user' as const, content: 'Test' }],
        tools: [{ type: 'function', function: { name: 'test', description: 'Test function', parameters: {} } }],
        max_tokens: 8000,
        temperature: 1.5,
      };

      const result = await module.adaptRequest(request, 'lmstudio');

      expect(result.tools).toBeDefined(); // LM Studio现在支持工具调用
      expect(result.tool_choice).toBeUndefined();
      expect(result.max_tokens).toBe(4096); // 被限制到LM Studio保守值
      expect(mockDebugRecorder.recordInput).toHaveBeenCalled();
    });

    test('should adapt Ollama request correctly', async () => {
      const request: OpenAIStandardRequest = {
        model: 'llama2',
        messages: [{ role: 'user' as const, content: 'Test' }],
        temperature: -0.5, // 无效值
        frequency_penalty: 1.0,
        presence_penalty: 0.5,
      };

      const result = await module.adaptRequest(request, 'ollama');

      expect(result.temperature).toBe(0); // 被调整到最小值
      // Ollama现在支持这些参数，所以不应该被移除
      expect(result.frequency_penalty).toBe(1.0);
      expect(result.presence_penalty).toBe(0.5);
    });

    test('should handle generic request adaptation', async () => {
      const request: OpenAIStandardRequest = {
        model: 'generic-model',
        messages: [{ role: 'user' as const, content: 'Test' }],
        temperature: 5.0, // 超出通用范围
        top_p: 2.0, // 超出范围
      };

      const result = await module.adaptRequest(request, 'unknown');

      expect(result.temperature).toBe(2.0); // 被限制到最大值
      expect(result.top_p).toBe(1.0); // 被限制到最大值
    });
  });

  describe('Response Fixing', () => {
    test('should fix LM Studio response format', async () => {
      const brokenResponse = {
        // 缺少必需字段
        choices: [
          {
            message: { role: 'assistant', content: 'Hello!' },
            index: 0,
          },
        ],
        // 缺少 id, created, usage, object
      };

      const result = (await module.adaptResponse(brokenResponse, 'lmstudio')) as OpenAIStandardResponse;

      expect(result.id).toMatch(/^chatcmpl-lms-/);
      expect(result.object).toBe('chat.completion');
      expect(result.created).toBeGreaterThan(0);
      expect(result.usage).toHaveProperty('prompt_tokens');
      expect(result.usage).toHaveProperty('completion_tokens');
      expect(result.usage).toHaveProperty('total_tokens');
      expect(result.choices).toHaveLength(1);
      expect(result.choices[0].message.role).toBe('assistant');
      expect(mockDebugRecorder.recordInput).toHaveBeenCalled();
      expect(mockDebugRecorder.recordOutput).toHaveBeenCalled();
    });

    test('should fix DeepSeek response with thinking mode', async () => {
      const deepseekResponse = {
        id: 'deepseek-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'deepseek-chat',
        thinking: 'Let me think about this...', // 非标准字段
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Response',
              tool_calls: [
                {
                  id: 'call-123',
                  type: 'function',
                  function: {
                    name: 'test_function',
                    arguments: { param: 'value' }, // 非字符串格式
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      const result = (await module.adaptResponse(deepseekResponse, 'deepseek')) as OpenAIStandardResponse;

      expect(result.thinking).toBeUndefined(); // thinking字段应被移除
      expect(result.choices[0].message.tool_calls![0].function.arguments).toBe('{"param": "value"}'); // 应转换为字符串
    });

    test('should fix Ollama response format', async () => {
      const ollamaResponse = {
        response: 'Hello from Ollama!', // Ollama特有字段
        done: true,
        prompt_eval_count: 10,
        eval_count: 15,
      };

      const result = (await module.adaptResponse(ollamaResponse, 'ollama')) as OpenAIStandardResponse;

      expect(result.id).toMatch(/^chatcmpl-ollama-/);
      expect(result.object).toBe('chat.completion');
      expect(result.choices[0].message.content).toBe('Hello from Ollama!');
      expect(result.usage.prompt_tokens).toBe(10);
      expect(result.usage.completion_tokens).toBe(15);
      expect(result.usage.total_tokens).toBe(25);
      expect(result.choices[0].finish_reason).toBe('stop');
    });

    test('should handle generic response fixing', async () => {
      // 测试纯字符串响应
      const stringResponse = 'Just a plain string response';

      const result = (await module.adaptResponse(stringResponse, 'generic')) as OpenAIStandardResponse;

      expect(result.id).toMatch(/^chatcmpl-/);
      expect(result.object).toBe('chat.completion');
      expect(result.choices[0].message.content).toBe(stringResponse);
      expect(result.usage.total_tokens).toBe(0); // 默认值
    });

    test('should handle already standard OpenAI response', async () => {
      const standardResponse: OpenAIStandardResponse = {
        id: 'chatcmpl-standard',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-3.5-turbo',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Standard response' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      const result = (await module.adaptResponse(standardResponse, 'generic')) as OpenAIStandardResponse;

      expect(result.id).toBe('chatcmpl-standard');
      expect(result.object).toBe('chat.completion');
      expect(result.choices[0].message.content).toBe('Standard response');
    });
  });

  describe('Error Normalization', () => {
    test('should normalize LM Studio errors', async () => {
      const lmstudioError = {
        message: 'model not loaded',
        code: 'MODEL_ERROR',
      };

      const result = await module.normalizeError(lmstudioError, 'lmstudio');

      expect(result.error.message).toBe('Model not available on local server');
      expect(result.error.type).toBe('invalid_request_error');
      expect(result.error.code).toBe('model_not_found');
      expect(mockDebugRecorder.record).toHaveBeenCalledWith('error_normalization', expect.any(Object));
    });

    test('should normalize DeepSeek rate limit errors', async () => {
      const deepseekError = {
        status: 429,
        message: 'Too many requests',
      };

      const result = await module.normalizeError(deepseekError, 'deepseek');

      expect(result.error.message).toBe('Rate limit exceeded');
      expect(result.error.type).toBe('rate_limit_error');
      expect(result.error.code).toBe('rate_limit_exceeded');
    });

    test('should normalize DeepSeek authentication errors', async () => {
      const authError = {
        status: 401,
        message: 'Unauthorized',
      };

      const result = await module.normalizeError(authError, 'deepseek');

      expect(result.error.message).toBe('Invalid API key');
      expect(result.error.type).toBe('authentication_error');
      expect(result.error.code).toBe('invalid_api_key');
    });

    test('should normalize generic errors', async () => {
      const genericError = {
        message: 'Something went wrong',
        status: 500,
      };

      const result = await module.normalizeError(genericError, 'unknown');

      expect(result.error.message).toBe('Something went wrong');
      expect(result.error.type).toBe('api_error');
      expect(result.error.code).toBe(null);
    });
  });

  describe('Provider Capabilities', () => {
    test('should return correct DeepSeek capabilities', () => {
      const capabilities = module.getProviderCapabilities('deepseek');

      expect(capabilities.name).toBe('deepseek');
      expect(capabilities.supportsTools).toBe(true);
      expect(capabilities.supportsThinking).toBe(true);
      expect(capabilities.parameterLimits.max_tokens?.max).toBe(8192);
      expect(capabilities.responseFixesNeeded).toContain('tool_calls_format');
      expect(capabilities.responseFixesNeeded).toContain('thinking_mode_cleanup');
    });

    test('should return correct LM Studio capabilities', () => {
      const capabilities = module.getProviderCapabilities('lmstudio');

      expect(capabilities.name).toBe('lmstudio');
      expect(capabilities.supportsTools).toBe(false);
      expect(capabilities.supportsThinking).toBe(false);
      expect(capabilities.parameterLimits.max_tokens?.max).toBe(4096);
      expect(capabilities.responseFixesNeeded).toContain('missing_usage');
      expect(capabilities.responseFixesNeeded).toContain('missing_id');
    });

    test('should return default capabilities for unknown provider', () => {
      const capabilities = module.getProviderCapabilities('unknown-provider');

      expect(capabilities.name).toBe('unknown');
      expect(capabilities.supportsTools).toBe(false);
      expect(capabilities.supportsThinking).toBe(false);
      expect(capabilities.responseFixesNeeded).toContain('basic_standardization');
    });
  });

  describe('Debug Integration', () => {
    test('should record debug information for request adaptation', async () => {
      const request: OpenAIStandardRequest = {
        model: 'test-model',
        messages: [{ role: 'user' as const, content: 'Test' }],
      };

      await module.adaptRequest(request, 'deepseek');

      expect(mockDebugRecorder.recordInput).toHaveBeenCalledWith(
        'server-compatibility-request',
        expect.any(String),
        expect.objectContaining({
          server_type: 'deepseek',
          original_request: request,
          needs_adaptation: expect.any(Array),
        })
      );

      expect(mockDebugRecorder.recordOutput).toHaveBeenCalledWith(
        'server-compatibility-request',
        expect.any(String),
        expect.objectContaining({
          server_type: 'deepseek',
          adapted_request: expect.any(Object),
          adaptations_applied: expect.any(Array),
        })
      );
    });

    test('should record debug information for response fixing', async () => {
      const response = {
        choices: [{ message: { role: 'assistant', content: 'Test' } }],
      };

      await module.adaptResponse(response, 'lmstudio');

      expect(mockDebugRecorder.recordInput).toHaveBeenCalledWith(
        'server-compatibility-response',
        expect.any(String),
        expect.objectContaining({
          server_type: 'lmstudio',
          original_response: response,
          response_analysis: expect.any(Object),
          fixes_needed: expect.any(Array),
        })
      );

      expect(mockDebugRecorder.recordOutput).toHaveBeenCalledWith(
        'server-compatibility-response',
        expect.any(String),
        expect.objectContaining({
          server_type: 'lmstudio',
          fixed_response: expect.any(Object),
          fixes_applied: expect.any(Array),
          validation_passed: expect.any(Boolean),
        })
      );
    });

    test('should handle errors gracefully and record them', async () => {
      // 创建一个会导致错误的场景
      const invalidRequest = null as any;

      try {
        await module.adaptRequest(invalidRequest, 'deepseek');
      } catch (error) {
        expect(mockDebugRecorder.recordError).toHaveBeenCalledWith(
          'server-compatibility-request',
          expect.any(String),
          expect.objectContaining({
            server_type: 'deepseek',
            error_type: expect.any(String),
            error_message: expect.any(String),
          })
        );
      }
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle concurrent requests efficiently', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        model: 'test-model',
        messages: [{ role: 'user' as const, content: `Test ${i}` }],
      }));

      const startTime = Date.now();
      const results = await Promise.all(requests.map(req => module.adaptRequest(req, 'deepseek')));
      const endTime = Date.now();

      expect(results).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
      results.forEach(result => {
        expect(result).toHaveProperty('model');
        expect(result.messages).toHaveLength(1);
      });
    });

    test('should handle malformed responses gracefully', async () => {
      const malformedResponses = [
        null,
        undefined,
        '',
        {},
        { invalid: 'structure' },
        { choices: null },
        { choices: [] },
      ];

      for (const response of malformedResponses) {
        const result = (await module.adaptResponse(response, 'generic')) as OpenAIStandardResponse;

        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('object', 'chat.completion');
        expect(result).toHaveProperty('choices');
        expect(result).toHaveProperty('usage');
        expect(Array.isArray(result.choices)).toBe(true);
        expect(result.choices.length).toBeGreaterThan(0);
      }
    });

    test('should maintain data integrity during adaptation', async () => {
      const originalRequest: OpenAIStandardRequest = {
        model: 'test-model',
        messages: [
          { role: 'system', content: 'System prompt' },
          { role: 'user' as const, content: 'User message' },
          { role: 'assistant', content: 'Assistant response' },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      };

      const adaptedRequest = await module.adaptRequest({ ...originalRequest }, 'deepseek');

      // 确保原始请求没有被修改
      expect(originalRequest.model).toBe('test-model');
      expect(originalRequest.messages).toHaveLength(3);

      // 确保适配结果保持核心数据完整性
      expect(adaptedRequest.model).toBe('test-model');
      expect(adaptedRequest.messages).toHaveLength(3);
      expect(adaptedRequest.messages[0].content).toBe('System prompt');
    });

    test('should validate response format after fixing', async () => {
      const responses = [
        { choices: [{ message: { role: 'assistant', content: 'Test 1' } }] },
        { id: 'existing-id', choices: [{ message: { role: 'assistant', content: 'Test 2' } }] },
        'String response',
        { response: 'Ollama format' }, // Ollama格式
      ];

      for (const response of responses) {
        const result = (await module.adaptResponse(response, 'generic')) as OpenAIStandardResponse;

        // 验证所有必需字段都存在
        expect(result.id).toBeTruthy();
        expect(result.object).toBe('chat.completion');
        expect(result.created).toBeGreaterThan(0);
        expect(result.model).toBeTruthy();
        expect(Array.isArray(result.choices)).toBe(true);
        expect(result.choices.length).toBeGreaterThan(0);
        expect(result.usage).toHaveProperty('prompt_tokens');
        expect(result.usage).toHaveProperty('completion_tokens');
        expect(result.usage).toHaveProperty('total_tokens');

        // 验证choices结构
        result.choices.forEach((choice, index) => {
          expect(choice.index).toBe(index);
          expect(choice.message.role).toBe('assistant');
          expect(typeof choice.message.content).toBe('string');
          expect(choice.finish_reason).toBeTruthy();
        });
      }
    });
  });

  describe('Module Lifecycle', () => {
    test('should start and stop gracefully', async () => {
      await expect(module.start()).resolves.toBeUndefined();
      await expect(module.stop()).resolves.toBeUndefined();
    });

    test('should reset without errors', async () => {
      await expect(module.reset()).resolves.toBeUndefined();
    });

    test('should cleanup resources', async () => {
      await expect(module.cleanup()).resolves.toBeUndefined();
    });

    test('should handle configuration updates', async () => {
      const config = {
        enableRequestAdaptation: true,
        enableResponseFixing: true,
        enableDebugLogging: false,
      };

      await expect(module.configure(config)).resolves.toBeUndefined();
    });
  });
});
