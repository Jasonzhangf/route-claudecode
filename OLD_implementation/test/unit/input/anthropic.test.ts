/**
 * Unit tests for Anthropic Input Processor
 */

import { AnthropicInputProcessor } from '../../../src/input/anthropic';

describe('AnthropicInputProcessor', () => {
  let processor: AnthropicInputProcessor;

  beforeEach(() => {
    processor = new AnthropicInputProcessor();
  });

  describe('canProcess', () => {
    it('should accept valid Anthropic requests', () => {
      const validRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'Hello' }
        ]
      };

      expect(processor.canProcess(validRequest)).toBe(true);
    });

    it('should reject OpenAI format requests', () => {
      const openaiRequest = {
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'test',
              description: 'test',
              parameters: {}
            }
          }
        ]
      };

      expect(processor.canProcess(openaiRequest)).toBe(false);
    });

    it('should reject invalid requests', () => {
      expect(processor.canProcess(null)).toBe(false);
      expect(processor.canProcess({})).toBe(false);
      expect(processor.canProcess({ model: 'test' })).toBe(false);
    });
  });

  describe('validate', () => {
    it('should validate correct requests', () => {
      const validRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'Hello' }
        ]
      };

      expect(processor.validate(validRequest)).toBe(true);
    });

    it('should reject requests without model', () => {
      const invalidRequest = {
        messages: [
          { role: 'user', content: 'Hello' }
        ]
      };

      expect(processor.validate(invalidRequest)).toBe(false);
    });

    it('should reject requests without messages', () => {
      const invalidRequest = {
        model: 'claude-3-5-sonnet-20241022'
      };

      expect(processor.validate(invalidRequest)).toBe(false);
    });
  });

  describe('process', () => {
    it('should process valid requests', async () => {
      const request = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        max_tokens: 1000,
        temperature: 0.5
      };

      const result = await processor.process(request);

      expect(result).toMatchObject({
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        max_tokens: 1000,
        temperature: 0.5,
        stream: false
      });

      expect(result.metadata?.originalFormat).toBe('anthropic');
    });

    it('should handle system messages', async () => {
      const request = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        system: [
          { type: 'text', text: 'You are a helpful assistant' }
        ]
      };

      const result = await processor.process(request);

      expect(result.metadata?.system).toEqual([
        { type: 'text', text: 'You are a helpful assistant' }
      ]);
    });

    it('should handle tools', async () => {
      const request = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        tools: [
          {
            name: 'test_tool',
            description: 'A test tool',
            input_schema: { type: 'object' }
          }
        ]
      };

      const result = await processor.process(request);

      expect(result.metadata?.tools).toEqual([
        {
          name: 'test_tool',
          description: 'A test tool',
          input_schema: { type: 'object' }
        }
      ]);
    });
  });
});