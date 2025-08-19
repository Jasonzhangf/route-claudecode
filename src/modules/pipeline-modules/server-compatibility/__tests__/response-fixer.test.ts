/**
 * Response Compatibility Fixer - 单元测试
 *
 * 验证各Provider响应修复器的功能
 *
 * @author Jason Zhang
 */

import {
  LMStudioResponseFixer,
  DeepSeekResponseFixer,
  OllamaResponseFixer,
  GenericResponseFixer,
} from '../response-compatibility-fixer';
import { DebugRecorder, OpenAIStandardResponse } from '../enhanced-compatibility';

describe('Response Compatibility Fixers', () => {
  let mockDebugRecorder: DebugRecorder;

  beforeEach(() => {
    mockDebugRecorder = {
      record: jest.fn(),
      recordInput: jest.fn(),
      recordOutput: jest.fn(),
      recordError: jest.fn(),
    };
  });

  describe('LMStudioResponseFixer', () => {
    let fixer: LMStudioResponseFixer;

    beforeEach(() => {
      fixer = new LMStudioResponseFixer(mockDebugRecorder);
    });

    test('should fix missing required fields', async () => {
      const brokenResponse = {
        choices: [
          {
            message: { role: 'assistant', content: 'Hello from LM Studio!' },
            index: 0,
            finish_reason: 'stop',
          },
        ],
        // 缺少 id, created, object, usage, model
      };

      const result = await fixer.fixResponse(brokenResponse);

      expect(result.id).toMatch(/^chatcmpl-lms-/);
      expect(result.object).toBe('chat.completion');
      expect(result.created).toBeGreaterThan(0);
      expect(result.model).toBe('local-model');
      expect(result.choices).toHaveLength(1);
      expect(result.choices[0].message.content).toBe('Hello from LM Studio!');
      expect(result.usage.prompt_tokens).toBe(0);
      expect(result.usage.completion_tokens).toBe(0);
      expect(result.usage.total_tokens).toBe(0);
    });

    test('should preserve existing valid fields', async () => {
      const responseWithSomeFields = {
        id: 'existing-id',
        model: 'existing-model',
        created: 1234567890,
        choices: [
          {
            message: { role: 'assistant', content: 'Existing content' },
            index: 0,
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 10,
          total_tokens: 25,
        },
        system_fingerprint: 'test-fingerprint',
      };

      const result = await fixer.fixResponse(responseWithSomeFields);

      expect(result.id).toBe('existing-id');
      expect(result.model).toBe('existing-model');
      expect(result.created).toBe(1234567890);
      expect(result.usage.prompt_tokens).toBe(15);
      expect(result.usage.completion_tokens).toBe(10);
      expect(result.usage.total_tokens).toBe(25);
      expect(result.system_fingerprint).toBe('test-fingerprint');
    });

    test('should fix malformed choices array', async () => {
      const responseWithBadChoices = {
        choices: null, // 无效的choices
      };

      const result = await fixer.fixResponse(responseWithBadChoices);

      expect(result.choices).toHaveLength(1);
      expect(result.choices[0].index).toBe(0);
      expect(result.choices[0].message.role).toBe('assistant');
      expect(result.choices[0].message.content).toBe('');
      expect(result.choices[0].finish_reason).toBe('stop');
    });

    test('should fix incomplete usage statistics', async () => {
      const responseWithPartialUsage = {
        choices: [{ message: { role: 'assistant', content: 'Test' } }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          // 缺少 total_tokens
        },
      };

      const result = await fixer.fixResponse(responseWithPartialUsage);

      expect(result.usage.prompt_tokens).toBe(10);
      expect(result.usage.completion_tokens).toBe(5);
      expect(result.usage.total_tokens).toBe(15); // 应该自动计算
    });

    test('should record debug information', async () => {
      const response = {
        choices: [{ message: { role: 'assistant', content: 'Test' } }],
      };

      await fixer.fixResponse(response);

      expect(mockDebugRecorder.recordInput).toHaveBeenCalledWith(
        'lmstudio-response-fixer',
        expect.any(String),
        expect.objectContaining({
          original_response: response,
          response_analysis: expect.any(Object),
          fixes_needed: expect.any(Array),
        })
      );

      expect(mockDebugRecorder.recordOutput).toHaveBeenCalledWith(
        'lmstudio-response-fixer',
        expect.any(String),
        expect.objectContaining({
          fixed_response: expect.any(Object),
          fixes_applied: expect.any(Array),
          processing_time_ms: expect.any(Number),
        })
      );
    });

    test('should handle tool calls format', async () => {
      const responseWithToolCalls = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call-123',
                  type: 'function',
                  function: {
                    name: 'test_function',
                    arguments: '{"param": "value"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };

      const result = await fixer.fixResponse(responseWithToolCalls);

      expect(result.choices[0].message.tool_calls).toHaveLength(1);
      expect(result.choices[0].message.tool_calls![0].id).toBe('call-123');
      expect(result.choices[0].message.tool_calls![0].function.name).toBe('test_function');
      expect(result.choices[0].message.tool_calls![0].function.arguments).toBe('{"param": "value"}');
    });
  });

  describe('DeepSeekResponseFixer', () => {
    let fixer: DeepSeekResponseFixer;

    beforeEach(() => {
      fixer = new DeepSeekResponseFixer(mockDebugRecorder);
    });

    test('should handle thinking mode responses', async () => {
      const thinkingResponse = {
        id: 'deepseek-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'deepseek-chat',
        thinking: 'This is my internal reasoning process...', // DeepSeek特有字段
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Final response after thinking',
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 15, total_tokens: 35 },
      };

      const result = await fixer.fixResponse(thinkingResponse);

      expect(result.thinking).toBeUndefined(); // thinking字段应被移除
      expect(result.object).toBe('chat.completion');
      expect(result.choices[0].message.content).toBe('Final response after thinking');
      expect(mockDebugRecorder.record).toHaveBeenCalledWith(
        'deepseek_thinking_mode_detected',
        expect.objectContaining({
          thinking_content_length: expect.any(Number),
          has_reasoning_chain: true,
        })
      );
    });

    test('should standardize tool calls arguments format', async () => {
      const responseWithObjectArgs = {
        id: 'deepseek-456',
        object: 'chat.completion',
        choices: [
          {
            message: {
              role: 'assistant',
              tool_calls: [
                {
                  id: 'call-456',
                  type: 'function',
                  function: {
                    name: 'calculate',
                    arguments: { num1: 5, num2: 10 }, // 对象格式，需要转换为字符串
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      const result = await fixer.fixResponse(responseWithObjectArgs);

      expect(result.choices[0].message.tool_calls![0].function.arguments).toBe('{"num1":5,"num2":10}');
    });

    test('should preserve valid standard responses', async () => {
      const standardResponse: OpenAIStandardResponse = {
        id: 'deepseek-standard',
        object: 'chat.completion',
        created: 1234567890,
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Standard response' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      const result = await fixer.fixResponse(standardResponse);

      expect(result).toEqual(standardResponse);
    });
  });

  describe('OllamaResponseFixer', () => {
    let fixer: OllamaResponseFixer;

    beforeEach(() => {
      fixer = new OllamaResponseFixer(mockDebugRecorder);
    });

    test('should convert Ollama response format to OpenAI standard', async () => {
      const ollamaResponse = {
        response: 'Hello from Ollama!', // Ollama特有字段
        model: 'llama2:7b',
        done: true,
        prompt_eval_count: 15,
        eval_count: 12,
        context: [1, 2, 3], // Ollama上下文信息
      };

      const result = await fixer.fixResponse(ollamaResponse);

      expect(result.id).toMatch(/^chatcmpl-ollama-/);
      expect(result.object).toBe('chat.completion');
      expect(result.model).toBe('llama2:7b');
      expect(result.choices).toHaveLength(1);
      expect(result.choices[0].message.content).toBe('Hello from Ollama!');
      expect(result.choices[0].message.role).toBe('assistant');
      expect(result.choices[0].finish_reason).toBe('stop'); // done: true -> stop
      expect(result.usage.prompt_tokens).toBe(15);
      expect(result.usage.completion_tokens).toBe(12);
      expect(result.usage.total_tokens).toBe(27);
    });

    test('should handle incomplete Ollama responses', async () => {
      const incompleteResponse = {
        response: 'Partial response',
        done: false, // 未完成的响应
      };

      const result = await fixer.fixResponse(incompleteResponse);

      expect(result.choices[0].finish_reason).toBe('length'); // done: false -> length
      expect(result.usage.prompt_tokens).toBe(0);
      expect(result.usage.completion_tokens).toBe(0);
      expect(result.usage.total_tokens).toBe(0);
    });

    test('should handle string-only Ollama responses', async () => {
      const stringResponse = 'Simple string response from Ollama';

      const result = await fixer.fixResponse(stringResponse);

      expect(result.choices[0].message.content).toBe(stringResponse);
      expect(result.model).toBe('ollama-model');
    });

    test('should handle Ollama responses with existing OpenAI fields', async () => {
      const mixedResponse = {
        id: 'existing-id',
        response: 'Mixed format response',
        choices: [{ message: { content: 'Should be overridden' } }], // 应被Ollama的response字段覆盖
        usage: { prompt_tokens: 5 },
      };

      const result = await fixer.fixResponse(mixedResponse);

      expect(result.id).toBe('existing-id');
      expect(result.choices[0].message.content).toBe('Mixed format response'); // 使用Ollama的response
    });
  });

  describe('GenericResponseFixer', () => {
    let fixer: GenericResponseFixer;

    beforeEach(() => {
      fixer = new GenericResponseFixer(mockDebugRecorder);
    });

    test('should handle string responses', async () => {
      const stringResponse = 'This is a plain string response';

      const result = await fixer.fixResponse(stringResponse);

      expect(result.id).toMatch(/^chatcmpl-generic-/);
      expect(result.object).toBe('chat.completion');
      expect(result.choices[0].message.content).toBe(stringResponse);
      expect(result.choices[0].message.role).toBe('assistant');
      expect(result.model).toBe('generic-model');
    });

    test('should extract content from various response formats', async () => {
      const testCases = [
        { input: { content: 'From content field' }, expected: 'From content field' },
        { input: { message: 'From message field' }, expected: 'From message field' },
        { input: { text: 'From text field' }, expected: 'From text field' },
        { input: { output: 'From output field' }, expected: 'From output field' },
        { input: { choices: [{ message: { content: 'From choices' } }] }, expected: 'From choices' },
        { input: { unknown: 'field' }, expected: '{"unknown":"field"}' }, // JSON fallback
      ];

      for (const testCase of testCases) {
        const result = await fixer.fixResponse(testCase.input);
        expect(result.choices[0].message.content).toBe(testCase.expected);
      }
    });

    test('should enhance existing standard responses', async () => {
      const partialStandardResponse = {
        object: 'chat.completion',
        choices: [{ message: { role: 'assistant', content: 'Existing content' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
        // 缺少 id, created, total_tokens
      };

      const result = await fixer.fixResponse(partialStandardResponse);

      expect(result.id).toMatch(/^chatcmpl-generic-/);
      expect(result.created).toBeGreaterThan(0);
      expect(result.usage.total_tokens).toBe(15); // 应该被计算出来
      expect(result.choices[0].message.content).toBe('Existing content');
    });

    test('should handle nested object content', async () => {
      const nestedResponse = {
        content: {
          text: 'Nested text',
          metadata: { type: 'response' },
        },
      };

      const result = await fixer.fixResponse(nestedResponse);

      expect(result.choices[0].message.content).toBe('{"text":"Nested text","metadata":{"type":"response"}}');
    });

    test('should determine correct content extraction method', async () => {
      const testCases = [
        { input: 'string', expectedMethod: 'direct_string' },
        { input: { content: 'test' }, expectedMethod: 'content_field' },
        { input: { choices: [{ message: { content: 'test' } }] }, expectedMethod: 'choices_message_content' },
        { input: { message: 'test' }, expectedMethod: 'message_field' },
        { input: { text: 'test' }, expectedMethod: 'text_field' },
        { input: { output: 'test' }, expectedMethod: 'output_field' },
        { input: { unknown: 'field' }, expectedMethod: 'json_stringify_fallback' },
      ];

      for (const testCase of testCases) {
        await fixer.fixResponse(testCase.input);

        expect(mockDebugRecorder.record).toHaveBeenCalledWith(
          'generic_response_fix_completed',
          expect.objectContaining({
            content_extraction_method: testCase.expectedMethod,
          })
        );

        // 重置mock以便下次测试
        jest.clearAllMocks();
      }
    });

    test('should handle empty and null inputs gracefully', async () => {
      const emptyInputs = [null, undefined, '', {}, []];

      for (const input of emptyInputs) {
        const result = await fixer.fixResponse(input);

        expect(result.id).toBeTruthy();
        expect(result.object).toBe('chat.completion');
        expect(result.choices).toHaveLength(1);
        expect(result.usage).toBeDefined();
        expect(typeof result.choices[0].message.content).toBe('string');
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle fixer errors gracefully', async () => {
      const fixer = new LMStudioResponseFixer(mockDebugRecorder);

      // 模拟一个会导致错误的场景 - 传入循环引用对象
      const circularObj: any = { data: 'test' };
      circularObj.self = circularObj;

      await expect(fixer.fixResponse(circularObj)).rejects.toThrow();

      expect(mockDebugRecorder.recordError).toHaveBeenCalledWith(
        'lmstudio-response-fixer',
        expect.any(String),
        expect.objectContaining({
          error_type: expect.any(String),
          error_message: expect.any(String),
          processing_time_ms: expect.any(Number),
        })
      );
    });

    test('should preserve stack traces in error logging', async () => {
      const fixer = new GenericResponseFixer(mockDebugRecorder);

      // 创建一个会抛出错误的对象
      const errorObj = {
        get content() {
          throw new Error('Simulated getter error');
        },
      };

      await expect(fixer.fixResponse(errorObj)).rejects.toThrow('Simulated getter error');
    });
  });

  describe('Performance Tests', () => {
    test('should handle large responses efficiently', async () => {
      const fixer = new GenericResponseFixer(mockDebugRecorder);

      // 创建大型响应对象
      const largeResponse = {
        choices: Array.from({ length: 100 }, (_, i) => ({
          index: i,
          message: {
            role: 'assistant',
            content: 'Large response content '.repeat(1000), // 大量内容
          },
          finish_reason: 'stop',
        })),
      };

      const startTime = Date.now();
      const result = await fixer.fixResponse(largeResponse);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
      expect(result.choices).toHaveLength(100);
    });

    test('should handle concurrent fixing operations', async () => {
      const fixer = new LMStudioResponseFixer(mockDebugRecorder);

      const responses = Array.from({ length: 20 }, (_, i) => ({
        choices: [{ message: { role: 'assistant', content: `Response ${i}` } }],
      }));

      const startTime = Date.now();
      const results = await Promise.all(responses.map(res => fixer.fixResponse(res)));
      const endTime = Date.now();

      expect(results).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(2000); // 并发处理应该更快

      results.forEach((result, i) => {
        expect(result.choices[0].message.content).toBe(`Response ${i}`);
        expect(result.object).toBe('chat.completion');
      });
    });
  });
});
