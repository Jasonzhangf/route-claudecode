/**
 * Parameter Adapter - 单元测试
 *
 * 验证参数适配器的功能
 *
 * @author Jason Zhang
 */

import { ParameterAdapter } from '../parameter-adapter';
import { OpenAIStandardRequest, DebugRecorder } from '../enhanced-compatibility';
import { JQJsonHandler } from '../../../../utils/jq-json-handler';

describe('ParameterAdapter', () => {
  let adapter: ParameterAdapter;
  let mockDebugRecorder: DebugRecorder;

  beforeEach(() => {
    mockDebugRecorder = {
      record: jest.fn(),
      recordInput: jest.fn(),
      recordOutput: jest.fn(),
      recordError: jest.fn(),
    };

    adapter = new ParameterAdapter(mockDebugRecorder);
  });

  describe('DeepSeek Parameter Adaptation', () => {
    test('should set tool_choice to auto when tools are present', () => {
      const request: OpenAIStandardRequest = {
        model: 'deepseek-chat',
        messages: [{ role: 'user' as const, content: 'Test' }],
        tools: [
          {
            type: 'function',
            function: { name: 'test_func', description: 'Test function', parameters: {} },
          },
        ],
        // tool_choice 未设置
      };

      const result = adapter.adaptForDeepSeek(request);

      expect(result.tool_choice).toBe('auto');
      expect(mockDebugRecorder.record).toHaveBeenCalledWith(
        'deepseek_parameter_adaptations',
        expect.objectContaining({
          adaptations: expect.arrayContaining(['set_tool_choice_auto']),
        })
      );
    });

    test('should not override existing tool_choice', () => {
      const request: OpenAIStandardRequest = {
        model: 'deepseek-chat',
        messages: [{ role: 'user' as const, content: 'Test' }],
        tools: [
          {
            type: 'function',
            function: { name: 'test_func', description: 'Test function', parameters: {} },
          },
        ],
        tool_choice: 'required',
      };

      const result = adapter.adaptForDeepSeek(request);

      expect(result.tool_choice).toBe('required');
    });

    test('should limit max_tokens to DeepSeek maximum', () => {
      const request: OpenAIStandardRequest = {
        model: 'deepseek-chat',
        messages: [{ role: 'user' as const, content: 'Test' }],
        max_tokens: 16000, // 超出DeepSeek限制
      };

      const result = adapter.adaptForDeepSeek(request);

      expect(result.max_tokens).toBe(8192);
      expect(mockDebugRecorder.record).toHaveBeenCalledWith(
        'deepseek_max_tokens_adjusted',
        expect.objectContaining({
          original: 16000,
          adjusted: 8192,
          reason: 'deepseek_limit',
        })
      );
    });

    test('should constrain temperature to valid range', () => {
      const testCases = [
        { input: -0.5, expected: 0.01 },
        { input: 0.005, expected: 0.01 },
        { input: 0.5, expected: 0.5 },
        { input: 1.5, expected: 1.5 },
        { input: 3.0, expected: 2.0 },
        { input: 5.0, expected: 2.0 },
      ];

      testCases.forEach(({ input, expected }) => {
        const request: OpenAIStandardRequest = {
          model: 'deepseek-chat',
          messages: [{ role: 'user' as const, content: 'Test' }],
          temperature: input,
        };

        const result = adapter.adaptForDeepSeek(request);
        expect(result.temperature).toBe(expected);
      });
    });

    test('should constrain top_p to valid range', () => {
      const testCases = [
        { input: -0.1, expected: 0.01 },
        { input: 0.005, expected: 0.01 },
        { input: 0.5, expected: 0.5 },
        { input: 1.0, expected: 1.0 },
        { input: 1.5, expected: 1.0 },
      ];

      testCases.forEach(({ input, expected }) => {
        const request: OpenAIStandardRequest = {
          model: 'deepseek-chat',
          messages: [{ role: 'user' as const, content: 'Test' }],
          top_p: input,
        };

        const result = adapter.adaptForDeepSeek(request);
        expect(result.top_p).toBe(expected);
      });
    });
  });

  describe('LM Studio Parameter Adaptation', () => {
    test('should remove tools and tool_choice for LM Studio', () => {
      const request: OpenAIStandardRequest = {
        model: 'qwen2-7b',
        messages: [{ role: 'user' as const, content: 'Test' }],
        tools: [
          { type: 'function', function: { name: 'func1', description: 'Function 1', parameters: {} } },
          { type: 'function', function: { name: 'func2', description: 'Function 2', parameters: {} } },
        ],
        tool_choice: 'auto',
      };

      const result = adapter.adaptForLMStudio(request);

      expect(result.tools).toBeUndefined();
      expect(result.tool_choice).toBeUndefined();
      expect(mockDebugRecorder.record).toHaveBeenCalledWith(
        'lmstudio_tools_removed',
        expect.objectContaining({
          reason: 'lmstudio_limited_tool_support',
          removed_tools_count: 2,
          tools_list: ['func1', 'func2'],
        })
      );
    });

    test('should limit max_tokens to conservative value', () => {
      const request: OpenAIStandardRequest = {
        model: 'qwen2-7b',
        messages: [{ role: 'user' as const, content: 'Test' }],
        max_tokens: 8000,
      };

      const result = adapter.adaptForLMStudio(request);

      expect(result.max_tokens).toBe(4096);
      expect(mockDebugRecorder.record).toHaveBeenCalledWith(
        'lmstudio_max_tokens_adjusted',
        expect.objectContaining({
          original: 8000,
          adjusted: 4096,
          reason: 'conservative_local_model_limit',
        })
      );
    });

    test('should adjust penalty parameters to valid ranges', () => {
      const request: OpenAIStandardRequest = {
        model: 'qwen2-7b',
        messages: [{ role: 'user' as const, content: 'Test' }],
        frequency_penalty: 3.0, // 超出范围
        presence_penalty: -3.0, // 超出范围
      };

      const result = adapter.adaptForLMStudio(request);

      expect(result.frequency_penalty).toBe(2.0);
      expect(result.presence_penalty).toBe(-2.0);
    });

    test('should preserve valid parameters', () => {
      const request: OpenAIStandardRequest = {
        model: 'qwen2-7b',
        messages: [{ role: 'user' as const, content: 'Test' }],
        temperature: 0.8,
        max_tokens: 2000,
        frequency_penalty: 0.5,
        presence_penalty: 0.3,
      };

      const result = adapter.adaptForLMStudio(request);

      expect(result.temperature).toBe(0.8);
      expect(result.max_tokens).toBe(2000);
      expect(result.frequency_penalty).toBe(0.5);
      expect(result.presence_penalty).toBe(0.3);
    });
  });

  describe('Ollama Parameter Adaptation', () => {
    test('should remove unsupported tools', () => {
      const request: OpenAIStandardRequest = {
        model: 'llama2',
        messages: [{ role: 'user' as const, content: 'Test' }],
        tools: [{ type: 'function', function: { name: 'search', description: 'Search function', parameters: {} } }],
        tool_choice: 'auto',
      };

      const result = adapter.adaptForOllama(request);

      expect(result.tools).toBeUndefined();
      expect(result.tool_choice).toBeUndefined();
      expect(mockDebugRecorder.record).toHaveBeenCalledWith(
        'ollama_tools_removed',
        expect.objectContaining({
          reason: 'ollama_no_tool_support',
          removed_tools_count: 1,
        })
      );
    });

    test('should remove unsupported penalty parameters', () => {
      const request: OpenAIStandardRequest = {
        model: 'llama2',
        messages: [{ role: 'user' as const, content: 'Test' }],
        frequency_penalty: 0.5,
        presence_penalty: 0.3,
      };

      const result = adapter.adaptForOllama(request);

      expect(result.frequency_penalty).toBeUndefined();
      expect(result.presence_penalty).toBeUndefined();
    });

    test('should constrain temperature with zero minimum', () => {
      const testCases = [
        { input: -0.5, expected: 0 }, // Ollama允许0作为最小值
        { input: 0, expected: 0 },
        { input: 1.0, expected: 1.0 },
        { input: 2.5, expected: 2.0 },
      ];

      testCases.forEach(({ input, expected }) => {
        const request: OpenAIStandardRequest = {
          model: 'llama2',
          messages: [{ role: 'user' as const, content: 'Test' }],
          temperature: input,
        };

        const result = adapter.adaptForOllama(request);
        expect(result.temperature).toBe(expected);
      });
    });

    test('should limit max_tokens', () => {
      const request: OpenAIStandardRequest = {
        model: 'llama2',
        messages: [{ role: 'user' as const, content: 'Test' }],
        max_tokens: 16000,
      };

      const result = adapter.adaptForOllama(request);

      expect(result.max_tokens).toBe(8192);
    });
  });

  describe('Generic Parameter Adaptation', () => {
    test('should apply conservative parameter limits', () => {
      const request: OpenAIStandardRequest = {
        model: 'generic-model',
        messages: [{ role: 'user' as const, content: 'Test' }],
        temperature: -1.0,
        top_p: 2.0,
        max_tokens: 20000,
        frequency_penalty: -3.0,
        presence_penalty: 3.0,
      };

      const result = adapter.adaptGeneric(request);

      expect(result.temperature).toBe(0);
      expect(result.top_p).toBe(1.0);
      expect(result.max_tokens).toBe(8192);
      expect(result.frequency_penalty).toBe(-2.0);
      expect(result.presence_penalty).toBe(2.0);
    });

    test('should preserve tools for generic adaptation', () => {
      const request: OpenAIStandardRequest = {
        model: 'generic-model',
        messages: [{ role: 'user' as const, content: 'Test' }],
        tools: [
          { type: 'function', function: { name: 'generic_func', description: 'Generic function', parameters: {} } },
        ],
        tool_choice: 'required',
      };

      const result = adapter.adaptGeneric(request);

      expect(result.tools).toHaveLength(1);
      expect(result.tool_choice).toBe('required');
    });
  });

  describe('Adaptation Need Detection', () => {
    test('should correctly identify DeepSeek adaptation needs', () => {
      const request: OpenAIStandardRequest = {
        model: 'deepseek-chat',
        messages: [{ role: 'user' as const, content: 'Test' }],
        tools: [{ type: 'function', function: { name: 'test', description: 'Test', parameters: {} } }],
        max_tokens: 10000,
        temperature: 3.0,
      };

      const needs = adapter.getAdaptationNeeds(request, 'deepseek');

      expect(needs).toContain('set_tool_choice_auto');
      expect(needs).toContain('cap_max_tokens');
      expect(needs).toContain('adjust_temperature');
    });

    test('should correctly identify LM Studio adaptation needs', () => {
      const request: OpenAIStandardRequest = {
        model: 'qwen2-7b',
        messages: [{ role: 'user' as const, content: 'Test' }],
        tools: [{ type: 'function', function: { name: 'test', description: 'Test', parameters: {} } }],
        max_tokens: 8000,
      };

      const needs = adapter.getAdaptationNeeds(request, 'lmstudio');

      expect(needs).toContain('remove_tools');
      expect(needs).toContain('cap_max_tokens');
    });

    test('should correctly identify Ollama adaptation needs', () => {
      const request: OpenAIStandardRequest = {
        model: 'llama2',
        messages: [{ role: 'user' as const, content: 'Test' }],
        tools: [{ type: 'function', function: { name: 'test', description: 'Test', parameters: {} } }],
        frequency_penalty: 1.0,
        presence_penalty: 0.5,
      };

      const needs = adapter.getAdaptationNeeds(request, 'ollama');

      expect(needs).toContain('remove_tools');
      expect(needs).toContain('remove_frequency_penalty');
      expect(needs).toContain('remove_presence_penalty');
    });

    test('should determine if adaptation is needed', () => {
      const needsAdaptation: OpenAIStandardRequest = {
        model: 'deepseek-chat',
        messages: [{ role: 'user' as const, content: 'Test' }],
        max_tokens: 10000,
      };

      const noAdaptation: OpenAIStandardRequest = {
        model: 'deepseek-chat',
        messages: [{ role: 'user' as const, content: 'Test' }],
        temperature: 0.7,
        max_tokens: 4000,
      };

      expect(adapter.needsAdaptation(needsAdaptation, 'deepseek')).toBe(true);
      expect(adapter.needsAdaptation(noAdaptation, 'deepseek')).toBe(false);
    });
  });

  describe('Debug Recording', () => {
    test('should record adaptation operations', () => {
      const request: OpenAIStandardRequest = {
        model: 'deepseek-chat',
        messages: [{ role: 'user' as const, content: 'Test' }],
        max_tokens: 10000,
        temperature: 3.0,
      };

      adapter.adaptForDeepSeek(request);

      expect(mockDebugRecorder.record).toHaveBeenCalledWith(
        'deepseek_parameter_adaptations',
        expect.objectContaining({
          adaptations: expect.any(Array),
          original_params: expect.any(Object),
          adapted_params: expect.any(Object),
        })
      );
    });

    test('should record specific parameter adjustments', () => {
      const request: OpenAIStandardRequest = {
        model: 'deepseek-chat',
        messages: [{ role: 'user' as const, content: 'Test' }],
        max_tokens: 10000,
      };

      adapter.adaptForDeepSeek(request);

      expect(mockDebugRecorder.record).toHaveBeenCalledWith(
        'deepseek_max_tokens_adjusted',
        expect.objectContaining({
          original: 10000,
          adjusted: 8192,
          reason: 'deepseek_limit',
        })
      );
    });

    test('should not record when no adaptations are needed', () => {
      const request: OpenAIStandardRequest = {
        model: 'deepseek-chat',
        messages: [{ role: 'user' as const, content: 'Test' }],
        temperature: 0.7,
        max_tokens: 4000,
      };

      adapter.adaptForDeepSeek(request);

      expect(mockDebugRecorder.record).not.toHaveBeenCalledWith('deepseek_parameter_adaptations', expect.any(Object));
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle undefined parameters gracefully', () => {
      const request: OpenAIStandardRequest = {
        model: 'test-model',
        messages: [{ role: 'user' as const, content: 'Test' }],
        temperature: undefined,
        max_tokens: undefined,
        tools: undefined,
      };

      const result = adapter.adaptForDeepSeek(request);

      expect(result.model).toBe('test-model');
      expect(result.messages).toHaveLength(1);
      // undefined参数应该被保留或安全处理
    });

    test('should handle empty tools array', () => {
      const request: OpenAIStandardRequest = {
        model: 'test-model',
        messages: [{ role: 'user' as const, content: 'Test' }],
        tools: [],
      };

      const result = adapter.adaptForLMStudio(request);

      // 空数组应该不触发工具移除逻辑
      expect(result.tools).toEqual([]);
    });

    test('should handle extreme parameter values', () => {
      const request: OpenAIStandardRequest = {
        model: 'test-model',
        messages: [{ role: 'user' as const, content: 'Test' }],
        temperature: Number.MAX_VALUE,
        max_tokens: Number.MAX_SAFE_INTEGER,
        frequency_penalty: Number.NEGATIVE_INFINITY,
      };

      const result = adapter.adaptGeneric(request);

      expect(result.temperature).toBe(2.0);
      expect(result.max_tokens).toBe(8192);
      expect(result.frequency_penalty).toBe(-2.0);
    });

    test('should preserve original request immutability', () => {
      const originalRequest: OpenAIStandardRequest = {
        model: 'deepseek-chat',
        messages: [{ role: 'user' as const, content: 'Test' }],
        max_tokens: 10000,
        temperature: 3.0,
      };

      const originalCopy = JQJsonHandler.parseJsonString(JQJsonHandler.stringifyJson(originalRequest));

      adapter.adaptForDeepSeek(originalRequest);

      expect(originalRequest).toEqual(originalCopy);
    });
  });

  describe('Performance Tests', () => {
    test('should handle multiple adaptations efficiently', () => {
      const requests = Array.from({ length: 100 }, (_, i) => ({
        model: 'test-model',
        messages: [{ role: 'user' as const, content: `Test ${i}` }],
        temperature: Math.random() * 5, // 随机温度值
        max_tokens: Math.floor(Math.random() * 20000), // 随机token数
      }));

      const startTime = Date.now();
      const results = requests.map(req => adapter.adaptForDeepSeek(req));
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // 应该很快完成
      expect(results).toHaveLength(100);

      results.forEach(result => {
        expect(result.temperature).toBeLessThanOrEqual(2.0);
        expect(result.temperature).toBeGreaterThanOrEqual(0.01);
        expect(result.max_tokens).toBeLessThanOrEqual(8192);
      });
    });

    test('should handle concurrent adaptations', async () => {
      const requests = Array.from({ length: 50 }, (_, i) => ({
        model: 'test-model',
        messages: [{ role: 'user' as const, content: `Test ${i}` }],
        max_tokens: 10000 + i,
      }));

      const startTime = Date.now();
      const results = await Promise.all(requests.map(req => Promise.resolve(adapter.adaptForLMStudio(req))));
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(200);
      expect(results).toHaveLength(50);

      results.forEach(result => {
        expect(result.max_tokens).toBe(4096);
      });
    });
  });
});
