/**
 * Gemini请求转换器单元测试
 * 项目所有者: Jason Zhang
 */

import { GeminiRequestConverter } from '@/providers/gemini/modules/request-converter';
import { BaseRequest } from '@/types';

describe('GeminiRequestConverter', () => {
  describe('convertToGeminiFormat', () => {
    it('should convert basic text message request', () => {
      const baseRequest: BaseRequest = {
        model: 'gemini-2.5-pro',
        messages: [
          {
            role: 'user',
            content: 'Hello, world!'
          }
        ],
        metadata: { requestId: 'test-001' }
      };

      const result = GeminiRequestConverter.convertToGeminiFormat(baseRequest);

      expect(result).toEqual({
        model: 'gemini-2.5-pro',
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Hello, world!' }]
          }
        ]
      });
    });

    it('should handle multi-message conversation', () => {
      const baseRequest: BaseRequest = {
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'user', content: 'What is AI?' },
          { role: 'assistant', content: 'AI is artificial intelligence.' },
          { role: 'user', content: 'Tell me more.' }
        ]
      };

      const result = GeminiRequestConverter.convertToGeminiFormat(baseRequest);

      expect(result.contents).toHaveLength(3);
      expect(result.contents[0]).toEqual({
        role: 'user',
        parts: [{ text: 'What is AI?' }]
      });
      expect(result.contents[1]).toEqual({
        role: 'model',
        parts: [{ text: 'AI is artificial intelligence.' }]
      });
      expect(result.contents[2]).toEqual({
        role: 'user', 
        parts: [{ text: 'Tell me more.' }]
      });
    });

    it('should skip system messages', () => {
      const baseRequest: BaseRequest = {
        model: 'gemini-2.5-pro',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello!' }
        ]
      };

      const result = GeminiRequestConverter.convertToGeminiFormat(baseRequest);

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]).toEqual({
        role: 'user',
        parts: [{ text: 'Hello!' }]
      });
    });

    it('should handle generation config', () => {
      const baseRequest: BaseRequest = {
        model: 'gemini-2.5-pro',
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 1000,
        temperature: 0.7
      };

      const result = GeminiRequestConverter.convertToGeminiFormat(baseRequest);

      expect(result.generationConfig).toEqual({
        maxOutputTokens: 1000,
        temperature: 0.7
      });
    });

    it('should convert OpenAI format tools', () => {
      const baseRequest: BaseRequest = {
        model: 'gemini-2.5-pro',
        messages: [{ role: 'user', content: 'What is the weather?' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather information',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' }
                }
              }
            }
          }
        ]
      };

      const result = GeminiRequestConverter.convertToGeminiFormat(baseRequest);

      expect(result.tools).toEqual([{
        functionDeclarations: [{
          name: 'get_weather',
          description: 'Get weather information',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' }
            }
          }
        }]
      }]);
      expect(result.functionCallingConfig).toEqual({
        mode: 'AUTO'
      });
    });

    it('should convert Anthropic format tools', () => {
      const baseRequest: BaseRequest = {
        model: 'gemini-2.5-pro',
        messages: [{ role: 'user', content: 'Search the web' }],
        tools: [
          {
            name: 'search_web',
            description: 'Search the internet',
            input_schema: {
              type: 'object',
              properties: {
                query: { type: 'string' }
              }
            }
          }
        ]
      };

      const result = GeminiRequestConverter.convertToGeminiFormat(baseRequest);

      expect(result.tools).toEqual([{
        functionDeclarations: [{
          name: 'search_web',
          description: 'Search the internet',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' }
            }
          }
        }]
      }]);
    });

    it('should handle complex content blocks', () => {
      const baseRequest: BaseRequest = {
        model: 'gemini-2.5-pro',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this:' },
              { type: 'text', text: 'Second part' }
            ]
          }
        ]
      };

      const result = GeminiRequestConverter.convertToGeminiFormat(baseRequest);

      expect(result.contents[0].parts).toEqual([
        { text: 'Analyze this:' },
        { text: 'Second part' }
      ]);
    });

    it('should handle tool calls in messages', () => {
      const baseRequest: BaseRequest = {
        model: 'gemini-2.5-pro',
        messages: [
          {
            role: 'assistant',
            tool_calls: [
              {
                id: 'call-123',
                function: {
                  name: 'get_weather',
                  arguments: '{"location": "NYC"}'
                }
              }
            ]
          }
        ]
      };

      const result = GeminiRequestConverter.convertToGeminiFormat(baseRequest);

      expect(result.contents[0].parts).toEqual([
        {
          functionCall: {
            name: 'get_weather',
            args: { location: 'NYC' }
          }
        }
      ]);
    });

    it('should extract clean model name', () => {
      const testCases = [
        { input: 'gemini-2.5-pro', expected: 'gemini-2.5-pro' },
        { input: 'gemini-gemini-2.5-flash', expected: 'gemini-2.5-flash' },
        { input: 'google/gemini-pro', expected: 'gemini-pro' }
      ];

      testCases.forEach(({ input, expected }) => {
        const baseRequest: BaseRequest = {
          model: input,
          messages: [{ role: 'user', content: 'Test' }]
        };

        const result = GeminiRequestConverter.convertToGeminiFormat(baseRequest);
        expect(result.model).toBe(expected);
      });
    });

    // 错误处理测试
    it('should throw error for null request', () => {
      expect(() => {
        GeminiRequestConverter.convertToGeminiFormat(null as any);
      }).toThrow('GeminiRequestConverter: request is required');
    });

    it('should throw error for missing messages', () => {
      expect(() => {
        GeminiRequestConverter.convertToGeminiFormat({ model: 'test' } as any);
      }).toThrow('GeminiRequestConverter: request.messages must be a non-empty array');
    });

    it('should throw error for missing model', () => {
      expect(() => {
        GeminiRequestConverter.convertToGeminiFormat({
          messages: [{ role: 'user', content: 'Test' }]
        } as any);
      }).toThrow('GeminiRequestConverter: model is required');
    });

    it('should throw error for invalid model format', () => {
      expect(() => {
        GeminiRequestConverter.convertToGeminiFormat({
          model: 'invalid-model-name',
          messages: [{ role: 'user', content: 'Test' }]
        });
      }).toThrow('GeminiRequestConverter: Invalid model name format');
    });

    it('should throw error for unsupported role', () => {
      expect(() => {
        GeminiRequestConverter.convertToGeminiFormat({
          model: 'gemini-2.5-pro',
          messages: [{ role: 'unknown', content: 'Test' }]
        });
      }).toThrow('GeminiRequestConverter: Unsupported role: unknown');
    });

    it('should throw error for no valid messages after filtering', () => {
      expect(() => {
        GeminiRequestConverter.convertToGeminiFormat({
          model: 'gemini-2.5-pro',
          messages: [{ role: 'system', content: 'Only system message' }]
        });
      }).toThrow('GeminiRequestConverter: No valid messages to convert');
    });

    it('should handle malformed tool call arguments gracefully', () => {
      const baseRequest: BaseRequest = {
        model: 'gemini-2.5-pro',
        messages: [
          {
            role: 'assistant',
            tool_calls: [
              {
                id: 'call-123',
                function: {
                  name: 'get_weather',
                  arguments: 'invalid json'
                }
              }
            ]
          }
        ]
      };

      const result = GeminiRequestConverter.convertToGeminiFormat(baseRequest);

      expect(result.contents[0].parts).toEqual([
        {
          functionCall: {
            name: 'get_weather',
            args: {} // Empty object for invalid JSON
          }
        }
      ]);
    });

    it('should handle empty content gracefully', () => {
      const baseRequest: BaseRequest = {
        model: 'gemini-2.5-pro',
        messages: [
          { role: 'user', content: '' },
          { role: 'user', content: '   ' }, // whitespace only
          { role: 'user', content: 'Valid content' }
        ]
      };

      const result = GeminiRequestConverter.convertToGeminiFormat(baseRequest);

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].parts).toEqual([
        { text: 'Valid content' }
      ]);
    });
  });
});