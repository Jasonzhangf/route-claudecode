/**
 * Gemini流式模拟器单元测试
 * 项目所有者: Jason Zhang
 */

import { GeminiStreamingSimulator } from '@/providers/gemini/modules/streaming-simulator';
import { AnthropicResponse } from '@/types';

describe('GeminiStreamingSimulator', () => {
  const mockRequestId = 'test-request-001';
  let simulator: GeminiStreamingSimulator;

  beforeEach(() => {
    simulator = new GeminiStreamingSimulator({
      chunkDelay: 1, // Minimal delay for testing
      textChunkSize: 5, // Small chunks for testing
      enableToolCallStreaming: true
    });
  });

  describe('simulateStreaming', () => {
    it('should generate correct event sequence for text response', async () => {
      const mockResponse: AnthropicResponse = {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'gemini-2.5-pro',
        content: [
          { type: 'text', text: 'Hello world' }
        ],
        stop_reason: 'end_turn',
        stop_sequence: undefined,
        usage: { input_tokens: 10, output_tokens: 5 }
      };

      const events = [];
      for await (const event of simulator.simulateStreaming(mockResponse, mockRequestId)) {
        events.push(event);
      }

      // Verify event sequence
      expect(events[0].event).toBe('message_start');
      expect(events[1].event).toBe('content_block_start');
      
      // Should have multiple content_block_delta events for chunked text
      const deltaEvents = events.filter(e => e.event === 'content_block_delta');
      expect(deltaEvents.length).toBeGreaterThan(1);
      
      // Verify delta content combines to original text
      const combinedText = deltaEvents
        .map(e => JSON.parse(e.data).delta.text)
        .join('');
      expect(combinedText).toBe('Hello world');

      expect(events[events.length - 3].event).toBe('content_block_stop');
      expect(events[events.length - 2].event).toBe('message_delta');
      expect(events[events.length - 1].event).toBe('message_stop');
    });

    it('should handle tool use response correctly', async () => {
      const mockResponse: AnthropicResponse = {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'gemini-2.5-pro',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_123',
            name: 'get_weather',
            input: { location: 'NYC' }
          }
        ],
        stop_reason: 'tool_use',
        stop_sequence: undefined,
        usage: { input_tokens: 10, output_tokens: 5 }
      };

      const events = [];
      for await (const event of simulator.simulateStreaming(mockResponse, mockRequestId)) {
        events.push(event);
      }

      expect(events[0].event).toBe('message_start');
      expect(events[1].event).toBe('content_block_start');
      
      const startData = JSON.parse(events[1].data);
      expect(startData.content_block.type).toBe('tool_use');
      expect(startData.content_block.id).toBe('toolu_123');
      expect(startData.content_block.name).toBe('get_weather');

      // Should have tool use delta events
      const deltaEvents = events.filter(e => e.event === 'content_block_delta');
      expect(deltaEvents.length).toBeGreaterThan(0);

      const firstDelta = JSON.parse(deltaEvents[0].data);
      expect(firstDelta.delta.type).toBe('input_json_delta');
    });

    it('should handle mixed content types', async () => {
      const mockResponse: AnthropicResponse = {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'gemini-2.5-pro',
        content: [
          { type: 'text', text: 'Let me help you.' },
          {
            type: 'tool_use',
            id: 'toolu_456',
            name: 'search_web',
            input: { query: 'weather' }
          },
          { type: 'text', text: 'Done!' }
        ],
        stop_reason: 'tool_use',
        stop_sequence: undefined,
        usage: { input_tokens: 15, output_tokens: 8 }
      };

      const events = [];
      for await (const event of simulator.simulateStreaming(mockResponse, mockRequestId)) {
        events.push(event);
      }

      // Should have 3 content blocks
      const blockStarts = events.filter(e => e.event === 'content_block_start');
      expect(blockStarts.length).toBe(3);

      const blockStops = events.filter(e => e.event === 'content_block_stop');
      expect(blockStops.length).toBe(3);

      // Verify correct content types
      const firstBlock = JSON.parse(blockStarts[0].data);
      expect(firstBlock.content_block.type).toBe('text');

      const secondBlock = JSON.parse(blockStarts[1].data);
      expect(secondBlock.content_block.type).toBe('tool_use');
      expect(secondBlock.content_block.name).toBe('search_web');

      const thirdBlock = JSON.parse(blockStarts[2].data);
      expect(thirdBlock.content_block.type).toBe('text');
    });

    it('should include stop_reason and usage in message_delta', async () => {
      const mockResponse: AnthropicResponse = {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'gemini-2.5-pro',
        content: [{ type: 'text', text: 'Test' }],
        stop_reason: 'max_tokens',
        stop_sequence: undefined,
        usage: { input_tokens: 20, output_tokens: 10 }
      };

      const events = [];
      for await (const event of simulator.simulateStreaming(mockResponse, mockRequestId)) {
        events.push(event);
      }

      const messageDelta = events.find(e => e.event === 'message_delta');
      expect(messageDelta).toBeDefined();

      const deltaData = JSON.parse(messageDelta!.data);
      expect(deltaData.delta.stop_reason).toBe('max_tokens');
      expect(deltaData.delta.usage).toEqual({
        input_tokens: 20,
        output_tokens: 10
      });
    });

    it('should handle empty content gracefully', async () => {
      const mockResponse: AnthropicResponse = {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'gemini-2.5-pro',
        content: [],
        stop_reason: 'end_turn',
        stop_sequence: undefined,
        usage: { input_tokens: 5, output_tokens: 0 }
      };

      const events = [];
      for await (const event of simulator.simulateStreaming(mockResponse, mockRequestId)) {
        events.push(event);
      }

      expect(events[0].event).toBe('message_start');
      expect(events[events.length - 2].event).toBe('message_delta');
      expect(events[events.length - 1].event).toBe('message_stop');

      // Should not have any content block events
      const contentEvents = events.filter(e => 
        e.event.startsWith('content_block_')
      );
      expect(contentEvents.length).toBe(0);
    });

    it('should respect chunkDelay configuration', async () => {
      const slowSimulator = new GeminiStreamingSimulator({
        chunkDelay: 50,
        textChunkSize: 1
      });

      const mockResponse: AnthropicResponse = {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'gemini-2.5-pro',
        content: [{ type: 'text', text: 'ABC' }],
        stop_reason: 'end_turn',
        stop_sequence: undefined,
        usage: { input_tokens: 1, output_tokens: 3 }
      };

      const startTime = Date.now();
      const events = [];
      
      for await (const event of slowSimulator.simulateStreaming(mockResponse, mockRequestId)) {
        events.push({ ...event, timestamp: Date.now() });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should take at least some time due to delays
      expect(duration).toBeGreaterThan(50);

      // Should have multiple text deltas
      const textDeltas = events.filter(e => 
        e.event === 'content_block_delta' && 
        JSON.parse(e.data).delta.type === 'text_delta'
      );
      expect(textDeltas.length).toBeGreaterThan(1);
    });
  });

  describe('validateResponse', () => {
    it('should pass validation for valid response', () => {
      const validResponse: AnthropicResponse = {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'test',
        content: [],
        stop_sequence: undefined,
        usage: { input_tokens: 0, output_tokens: 0 }
      };

      expect(() => {
        GeminiStreamingSimulator.validateResponse(validResponse);
      }).not.toThrow();
    });

    it('should throw for null response', () => {
      expect(() => {
        GeminiStreamingSimulator.validateResponse(null as any);
      }).toThrow('GeminiStreamingSimulator: response is required');
    });

    it('should throw for missing required fields', () => {
      const invalidResponse = {
        // Missing id, type, role
        content: []
      };

      expect(() => {
        GeminiStreamingSimulator.validateResponse(invalidResponse as any);
      }).toThrow('GeminiStreamingSimulator: response missing required fields');
    });

    it('should throw for non-array content', () => {
      const invalidResponse = {
        id: 'test',
        type: 'message',
        role: 'assistant',
        content: 'not an array'
      };

      expect(() => {
        GeminiStreamingSimulator.validateResponse(invalidResponse as any);
      }).toThrow('GeminiStreamingSimulator: response.content must be an array');
    });
  });

  describe('configuration updates', () => {
    it('should update configuration correctly', () => {
      simulator.updateConfig({
        chunkDelay: 100,
        textChunkSize: 20
      });

      // Test the configuration change by checking behavior
      // (This is a basic test; in a real scenario, we'd verify the actual behavior change)
      expect(() => {
        simulator.updateConfig({ enableToolCallStreaming: false });
      }).not.toThrow();
    });
  });

  describe('error handling during streaming', () => {
    it('should generate error event on streaming failure', async () => {
      const mockResponse: AnthropicResponse = {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'gemini-2.5-pro',
        content: null as any, // Invalid content to trigger error
        stop_reason: 'end_turn',
        stop_sequence: undefined,
        usage: { input_tokens: 5, output_tokens: 0 }
      };

      const events = [];
      for await (const event of simulator.simulateStreaming(mockResponse, mockRequestId)) {
        events.push(event);
      }

      // Should include an error event
      const errorEvent = events.find(e => e.event === 'error');
      expect(errorEvent).toBeDefined();
      
      if (errorEvent) {
        const errorData = JSON.parse(errorEvent.data);
        expect(errorData.type).toBe('error');
        expect(errorData.error.type).toBe('streaming_error');
      }
    });

    it('should handle tool use without input', async () => {
      const mockResponse: AnthropicResponse = {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'gemini-2.5-pro',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_123',
            name: 'get_time',
            input: {} // Empty input
          }
        ],
        stop_reason: 'tool_use',
        stop_sequence: undefined,
        usage: { input_tokens: 5, output_tokens: 2 }
      };

      const events = [];
      for await (const event of simulator.simulateStreaming(mockResponse, mockRequestId)) {
        events.push(event);
      }

      // Should complete without errors
      expect(events[events.length - 1].event).toBe('message_stop');
      
      const deltaEvents = events.filter(e => e.event === 'content_block_delta');
      expect(deltaEvents.length).toBeGreaterThan(0);
    });
  });

  describe('message_start event format', () => {
    it('should create correct message_start event structure', async () => {
      const mockResponse: AnthropicResponse = {
        id: 'msg_test_123',
        type: 'message',
        role: 'assistant',
        model: 'gemini-2.5-pro',
        content: [{ type: 'text', text: 'Hi' }],
        stop_reason: 'end_turn',
        stop_sequence: undefined,
        usage: { input_tokens: 10, output_tokens: 5 }
      };

      const events = [];
      for await (const event of simulator.simulateStreaming(mockResponse, mockRequestId)) {
        events.push(event);
        if (event.event === 'message_start') break; // Just test the first event
      }

      const messageStart = events[0];
      expect(messageStart.event).toBe('message_start');
      
      const data = JSON.parse(messageStart.data);
      expect(data.type).toBe('message_start');
      expect(data.message.id).toBe('msg_test_123');
      expect(data.message.type).toBe('message');
      expect(data.message.role).toBe('assistant');
      expect(data.message.model).toBe('gemini-2.5-pro');
      expect(data.message.content).toEqual([]);
      expect(data.message.usage).toEqual({ input_tokens: 0, output_tokens: 0 });
    });
  });
});