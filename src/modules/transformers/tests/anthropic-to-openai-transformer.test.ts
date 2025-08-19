/**
 * AnthropicToOpenAITransformer 单元测试
 *
 * 测试工具调用处理的边界情况和修复
 */

import { AnthropicToOpenAITransformer } from '../anthropic-to-openai-transformer';

describe('AnthropicToOpenAITransformer', () => {
  let transformer: AnthropicToOpenAITransformer;

  beforeEach(() => {
    transformer = new AnthropicToOpenAITransformer();
  });

  describe('工具调用处理', () => {
    it('应该正确处理有效的工具数组', async () => {
      const input = {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: '测试消息' }],
        tools: [
          {
            name: 'test_tool',
            description: '测试工具',
            input_schema: {
              type: 'object',
              properties: {
                param: { type: 'string' },
              },
            },
          },
        ],
      };

      const result = await transformer.process(input);

      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].type).toBe('function');
      expect(result.tools[0].function.name).toBe('test_tool');
    });

    it('应该安全处理空的工具数组', async () => {
      const input = {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: '测试消息' }],
        tools: [],
      };

      const result = await transformer.process(input);

      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools).toHaveLength(0);
    });

    it('应该安全处理undefined工具', async () => {
      const input = {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: '测试消息' }],
        tools: undefined,
      };

      const result = await transformer.process(input);

      expect(result.tools).toBeUndefined();
    });

    it('应该安全处理null工具', async () => {
      const input = {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: '测试消息' }],
        tools: null,
      };

      const result = await transformer.process(input);

      expect(result.tools).toBeUndefined();
    });

    it('应该安全处理非数组工具', async () => {
      const input = {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: '测试消息' }],
        tools: { invalidFormat: true },
      };

      const result = await transformer.process(input);

      expect(result.tools).toBeUndefined();
    });

    it('应该正确处理包含工具调用的复杂请求', async () => {
      const input = {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: '列出本目录中所有文件夹' }],
        tools: [
          {
            name: 'LS',
            description: 'Lists files and directories in a given path',
            input_schema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'The absolute path to the directory to list',
                },
              },
              required: ['path'],
            },
          },
        ],
        tool_choice: 'auto',
        max_tokens: 1024,
      };

      const result = await transformer.process(input);

      expect(result.tools).toBeDefined();
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].function.name).toBe('LS');
      expect(result.tool_choice).toBeDefined();
      expect(result.max_tokens).toBe(1024);
    });
  });

  describe('响应转换', () => {
    it('应该正确转换OpenAI响应为Anthropic格式', async () => {
      const openaiResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-3.5-turbo-0125',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '这是一个测试响应',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25,
        },
      };

      const result = await transformer.process(openaiResponse);

      expect(result.type).toBe('message');
      expect(result.role).toBe('assistant');
      expect(result.content).toBeDefined();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('这是一个测试响应');
      expect(result.stop_reason).toBe('end_turn');
      expect(result.usage.input_tokens).toBe(10);
      expect(result.usage.output_tokens).toBe(15);
    });

    it('应该正确转换包含工具调用的OpenAI响应', async () => {
      const openaiResponse = {
        id: 'chatcmpl-456',
        object: 'chat.completion',
        created: 1677652388,
        model: 'gpt-3.5-turbo-0125',
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
                    name: 'LS',
                    arguments: '{"path": "/current/directory"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 10,
          total_tokens: 30,
        },
      };

      const result = await transformer.process(openaiResponse);

      expect(result.type).toBe('message');
      expect(result.role).toBe('assistant');
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('tool_use');
      expect(result.content[0].id).toBe('call_123');
      expect(result.content[0].name).toBe('LS');
      expect(result.content[0].input.path).toBe('/current/directory');
      expect(result.stop_reason).toBe('tool_use');
    });
  });

  describe('错误处理', () => {
    it('应该不会因为工具处理错误而崩溃', async () => {
      const input = {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: '测试消息' }],
        tools: [
          {
            // 缺少必需字段的工具
            name: 'invalid_tool',
            // 缺少 description 和 input_schema
          },
        ],
      };

      // 即使工具格式有问题，转换器也应该能够处理
      await expect(transformer.process(input)).resolves.toBeDefined();
    });
  });
});
