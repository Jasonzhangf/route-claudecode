/**
 * Gemini响应转换器单元测试
 * 项目所有者: Jason Zhang
 */

import { GeminiResponseConverter } from '@/providers/gemini/modules/response-converter';

describe('GeminiResponseConverter', () => {
  const mockRequestId = 'test-request-001';
  const mockModel = 'gemini-2.5-pro';

  describe('convertToAnthropicFormat', () => {
    it('should convert basic text response', () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                { text: 'Hello! How can I help you today?' }
              ],
              role: 'model'
            },
            finishReason: 'STOP'
          }
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 15,
          totalTokenCount: 25
        }
      };

      const result = GeminiResponseConverter.convertToAnthropicFormat(
        geminiResponse,
        mockModel,
        mockRequestId
      );

      expect(result.type).toBe('message');
      expect(result.role).toBe('assistant');
      expect(result.model).toBe(mockModel);
      expect(result.content).toEqual([
        { type: 'text', text: 'Hello! How can I help you today?' }
      ]);
      expect(result.stop_reason).toBe('end_turn');
      expect(result.usage).toEqual({
        input_tokens: 10,
        output_tokens: 15
      });
    });

    it('should handle multiple text parts', () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                { text: 'First part. ' },
                { text: 'Second part.' }
              ]
            },
            finishReason: 'STOP'
          }
        ]
      };

      const result = GeminiResponseConverter.convertToAnthropicFormat(
        geminiResponse,
        mockModel,
        mockRequestId
      );

      expect(result.content).toEqual([
        { type: 'text', text: 'First part. ' },
        { type: 'text', text: 'Second part.' }
      ]);
    });

    it('should convert tool call response', () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'get_weather',
                    args: {
                      location: 'New York',
                      units: 'celsius'
                    }
                  }
                }
              ]
            },
            finishReason: 'STOP'
          }
        ]
      };

      const result = GeminiResponseConverter.convertToAnthropicFormat(
        geminiResponse,
        mockModel,
        mockRequestId
      );

      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toMatchObject({
        type: 'tool_use',
        name: 'get_weather',
        input: {
          location: 'New York',
          units: 'celsius'
        }
      });
      expect(result.content[0].id).toMatch(/^toolu_\d+_[a-z0-9]+$/);
    });

    it('should handle mixed text and tool calls', () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                { text: 'Let me check the weather for you.' },
                {
                  functionCall: {
                    name: 'get_weather',
                    args: { location: 'NYC' }
                  }
                },
                { text: 'I will get that information now.' }
              ]
            },
            finishReason: 'STOP'
          }
        ]
      };

      const result = GeminiResponseConverter.convertToAnthropicFormat(
        geminiResponse,
        mockModel,
        mockRequestId
      );

      expect(result.content).toHaveLength(3);
      expect(result.content[0]).toEqual({
        type: 'text',
        text: 'Let me check the weather for you.'
      });
      expect(result.content[1]).toMatchObject({
        type: 'tool_use',
        name: 'get_weather',
        input: { location: 'NYC' }
      });
      expect(result.content[2]).toEqual({
        type: 'text',
        text: 'I will get that information now.'
      });
    });

    it('should map finish reasons correctly', () => {
      const testCases = [
        { gemini: 'STOP', anthropic: 'end_turn' },
        { gemini: 'MAX_TOKENS', anthropic: 'max_tokens' },
        { gemini: 'SAFETY', anthropic: 'stop_sequence' },
        { gemini: 'RECITATION', anthropic: 'stop_sequence' },
        { gemini: 'OTHER', anthropic: 'end_turn' }
      ];

      testCases.forEach(({ gemini, anthropic }) => {
        const geminiResponse = {
          candidates: [
            {
              content: { parts: [{ text: 'Test' }] },
              finishReason: gemini
            }
          ]
        };

        const result = GeminiResponseConverter.convertToAnthropicFormat(
          geminiResponse,
          mockModel,
          mockRequestId
        );

        expect(result.stop_reason).toBe(anthropic);
      });
    });

    it('should handle empty content gracefully', () => {
      const geminiResponse = {
        candidates: [
          {
            content: { parts: [] },
            finishReason: 'STOP'
          }
        ]
      };

      const result = GeminiResponseConverter.convertToAnthropicFormat(
        geminiResponse,
        mockModel,
        mockRequestId
      );

      expect(result.content).toEqual([
        { type: 'text', text: '' }
      ]);
    });

    it('should handle missing usage metadata', () => {
      const geminiResponse = {
        candidates: [
          {
            content: { parts: [{ text: 'Test' }] },
            finishReason: 'STOP'
          }
        ]
      };

      const result = GeminiResponseConverter.convertToAnthropicFormat(
        geminiResponse,
        mockModel,
        mockRequestId
      );

      expect(result.usage).toEqual({
        input_tokens: 0,
        output_tokens: 0
      });
    });

    it('should handle undefined finish reason', () => {
      const geminiResponse = {
        candidates: [
          {
            content: { parts: [{ text: 'Test' }] }
            // No finishReason
          }
        ]
      };

      const result = GeminiResponseConverter.convertToAnthropicFormat(
        geminiResponse,
        mockModel,
        mockRequestId
      );

      expect(result.stop_reason).toBeUndefined();
    });

    it('should handle function call with no arguments', () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'get_current_time'
                    // No args
                  }
                }
              ]
            },
            finishReason: 'STOP'
          }
        ]
      };

      const result = GeminiResponseConverter.convertToAnthropicFormat(
        geminiResponse,
        mockModel,
        mockRequestId
      );

      expect(result.content[0]).toMatchObject({
        type: 'tool_use',
        name: 'get_current_time',
        input: {}
      });
    });
  });

  describe('validateResponse', () => {
    it('should pass validation for valid response', () => {
      const validResponse = {
        candidates: [
          {
            content: { parts: [{ text: 'Valid response' }] },
            finishReason: 'STOP'
          }
        ]
      };

      expect(() => {
        GeminiResponseConverter.validateResponse(validResponse, mockRequestId);
      }).not.toThrow();
    });

    it('should throw for null response', () => {
      expect(() => {
        GeminiResponseConverter.validateResponse(null as any, mockRequestId);
      }).toThrow('GeminiResponseConverter: Response is null or undefined');
    });

    it('should throw for missing candidates', () => {
      expect(() => {
        GeminiResponseConverter.validateResponse({} as any, mockRequestId);
      }).toThrow('GeminiResponseConverter: Response missing candidates array');
    });

    it('should throw for empty candidates array', () => {
      expect(() => {
        GeminiResponseConverter.validateResponse({
          candidates: []
        }, mockRequestId);
      }).toThrow('GeminiResponseConverter: Response candidates array is empty');
    });

    it('should throw for null first candidate', () => {
      expect(() => {
        GeminiResponseConverter.validateResponse({
          candidates: [null]
        }, mockRequestId);
      }).toThrow('GeminiResponseConverter: First candidate is null');
    });
  });

  describe('error handling', () => {
    it('should throw for streaming response detection', () => {
      const streamingResponse = {
        stream: true,
        candidates: [
          {
            content: { parts: [{ text: 'Test' }] }
          }
        ]
      };

      expect(() => {
        GeminiResponseConverter.convertToAnthropicFormat(
          streamingResponse,
          mockModel,
          mockRequestId
        );
      }).toThrow('GeminiResponseConverter: Streaming response detected - this is not allowed');
    });

    it('should throw for unknown finish reason', () => {
      const geminiResponse = {
        candidates: [
          {
            content: { parts: [{ text: 'Test' }] },
            finishReason: 'UNKNOWN_REASON'
          }
        ]
      };

      expect(() => {
        GeminiResponseConverter.convertToAnthropicFormat(
          geminiResponse,
          mockModel,
          mockRequestId
        );
      }).toThrow('GeminiResponseConverter: Unknown finish reason \'UNKNOWN_REASON\'');
    });

    it('should throw for missing response', () => {
      expect(() => {
        GeminiResponseConverter.convertToAnthropicFormat(
          null as any,
          mockModel,
          mockRequestId
        );
      }).toThrow('GeminiResponseConverter: geminiResponse is required');
    });

    it('should handle invalid function call gracefully', () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    // Missing name
                    args: { test: 'value' }
                  }
                }
              ]
            },
            finishReason: 'STOP'
          }
        ]
      };

      const result = GeminiResponseConverter.convertToAnthropicFormat(
        geminiResponse,
        mockModel,
        mockRequestId
      );

      // Should skip invalid function call and return empty text
      expect(result.content).toEqual([
        { type: 'text', text: '' }
      ]);
    });
  });

  describe('streaming detection', () => {
    it('should detect various streaming response formats', () => {
      const streamingFormats = [
        { stream: true },
        { streaming: true },
        { read: () => {} },
        { pipe: () => {} },
        { constructor: { name: 'ReadableStream' } }
      ];

      streamingFormats.forEach(format => {
        const streamingResponse = {
          ...format,
          candidates: [{ content: { parts: [{ text: 'Test' }] } }]
        };

        expect(() => {
          GeminiResponseConverter.convertToAnthropicFormat(
            streamingResponse,
            mockModel,
            mockRequestId
          );
        }).toThrow('Streaming response detected');
      });
    });

    it('should not detect streaming for normal responses', () => {
      const normalResponse = {
        candidates: [
          {
            content: { parts: [{ text: 'Normal response' }] },
            finishReason: 'STOP'
          }
        ]
      };

      expect(() => {
        GeminiResponseConverter.convertToAnthropicFormat(
          normalResponse,
          mockModel,
          mockRequestId
        );
      }).not.toThrow();
    });
  });
});