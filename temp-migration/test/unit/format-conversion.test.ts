/**
 * Format Conversion Tests
 * Tests for bidirectional format conversion between all supported providers
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UnifiedFormatConverter, SupportedFormat } from '../../src/provider/conversion/format-converter.js';
import { FormatValidator } from '../../src/provider/conversion/format-validator.js';
import { AIRequest, AIResponse } from '../../src/types/interfaces.js';

describe('Format Conversion', () => {
  let converter: UnifiedFormatConverter;
  let validator: FormatValidator;

  beforeEach(async () => {
    converter = new UnifiedFormatConverter();
    validator = new FormatValidator();
    
    await converter.initialize();
    await validator.initialize();
  });

  afterEach(async () => {
    await converter.shutdown();
    await validator.shutdown();
  });

  describe('Standard Format', () => {
    const standardRequest: AIRequest = {
      id: 'test-request-1',
      provider: 'test',
      model: 'test-model',
      messages: [
        { role: 'user', content: 'Hello, how are you?' }
      ],
      metadata: {
        timestamp: new Date(),
        source: 'test',
        priority: 1
      }
    };

    it('should validate standard request format', () => {
      const result = validator.validateRequest(standardRequest, 'standard');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should convert standard to Anthropic format', async () => {
      const converted = await converter.convertRequest(standardRequest, 'standard', 'anthropic');
      
      expect(converted.model).toBe(standardRequest.model);
      expect(converted.messages).toHaveLength(1);
      expect(converted.messages[0].role).toBe('user');
      expect(converted.messages[0].content).toBe('Hello, how are you?');
      expect(converted.max_tokens).toBeGreaterThan(0);
    });

    it('should convert standard to OpenAI format', async () => {
      const converted = await converter.convertRequest(standardRequest, 'standard', 'openai');
      
      expect(converted.model).toBe(standardRequest.model);
      expect(converted.messages).toHaveLength(1);
      expect(converted.messages[0].role).toBe('user');
      expect(converted.messages[0].content).toBe('Hello, how are you?');
      expect(converted.max_tokens).toBeGreaterThan(0);
    });

    it('should convert standard to Gemini format', async () => {
      const converted = await converter.convertRequest(standardRequest, 'standard', 'gemini');
      
      expect(converted.contents).toHaveLength(1);
      expect(converted.contents[0].role).toBe('user');
      expect(converted.contents[0].parts[0].text).toBe('Hello, how are you?');
      expect(converted.generationConfig.maxOutputTokens).toBeGreaterThan(0);
    });

    it('should convert standard to CodeWhisperer format', async () => {
      const converted = await converter.convertRequest(standardRequest, 'standard', 'codewhisperer');
      
      expect(converted.fileContext).toBeDefined();
      expect(converted.fileContext.leftFileContent).toBe('Hello, how are you?');
      expect(converted.fileContext.filename).toBeDefined();
      expect(converted.maxResults).toBe(5);
    });
  });

  describe('Anthropic Format', () => {
    const anthropicRequest = {
      model: 'claude-3-sonnet-20240229',
      messages: [
        { role: 'user', content: 'Hello, how are you?' }
      ],
      max_tokens: 1000,
      stream: false
    };

    const anthropicResponse = {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [
        { type: 'text', text: 'Hello! I am doing well, thank you for asking.' }
      ],
      model: 'claude-3-sonnet-20240229',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 10,
        output_tokens: 15
      }
    };

    it('should validate Anthropic request format', () => {
      const result = validator.validateRequest(anthropicRequest, 'anthropic');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate Anthropic response format', () => {
      const result = validator.validateResponse(anthropicResponse, 'anthropic');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should convert Anthropic request to standard format', async () => {
      const converted = await converter.convertRequest(anthropicRequest, 'anthropic', 'standard');
      
      expect(converted.id).toBeDefined();
      expect(converted.provider).toBe('anthropic');
      expect(converted.model).toBe(anthropicRequest.model);
      expect(converted.messages).toHaveLength(1);
      expect(converted.messages[0].content).toBe('Hello, how are you?');
    });

    it('should convert Anthropic response to standard format', async () => {
      const converted = await converter.convertResponse(anthropicResponse, 'anthropic');
      
      expect(converted.id).toBe(anthropicResponse.id);
      expect(converted.model).toBe(anthropicResponse.model);
      expect(converted.choices).toHaveLength(1);
      expect(converted.choices[0].message.content).toBe('Hello! I am doing well, thank you for asking.');
      expect(converted.choices[0].finishReason).toBe('stop');
      expect(converted.usage.promptTokens).toBe(10);
      expect(converted.usage.completionTokens).toBe(15);
    });
  });

  describe('OpenAI Format', () => {
    const openaiRequest = {
      model: 'gpt-4',
      messages: [
        { role: 'user', content: 'Hello, how are you?' }
      ],
      max_tokens: 1000,
      stream: false
    };

    const openaiResponse = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1677652288,
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello! I am doing well, thank you for asking.'
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 15,
        total_tokens: 25
      }
    };

    it('should validate OpenAI request format', () => {
      const result = validator.validateRequest(openaiRequest, 'openai');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate OpenAI response format', () => {
      const result = validator.validateResponse(openaiResponse, 'openai');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should convert OpenAI request to standard format', async () => {
      const converted = await converter.convertRequest(openaiRequest, 'openai', 'standard');
      
      expect(converted.id).toBeDefined();
      expect(converted.provider).toBe('openai');
      expect(converted.model).toBe(openaiRequest.model);
      expect(converted.messages).toHaveLength(1);
      expect(converted.messages[0].content).toBe('Hello, how are you?');
    });

    it('should convert OpenAI response to standard format', async () => {
      const converted = await converter.convertResponse(openaiResponse, 'openai');
      
      expect(converted.id).toBe(openaiResponse.id);
      expect(converted.model).toBe(openaiResponse.model);
      expect(converted.choices).toHaveLength(1);
      expect(converted.choices[0].message.content).toBe('Hello! I am doing well, thank you for asking.');
      expect(converted.choices[0].finishReason).toBe('stop');
      expect(converted.usage.totalTokens).toBe(25);
    });
  });

  describe('Gemini Format', () => {
    const geminiRequest = {
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Hello, how are you?' }]
        }
      ],
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7
      }
    };

    const geminiResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: 'Hello! I am doing well, thank you for asking.' }],
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

    it('should validate Gemini request format', () => {
      const result = validator.validateRequest(geminiRequest, 'gemini');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate Gemini response format', () => {
      const result = validator.validateResponse(geminiResponse, 'gemini');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should convert Gemini request to standard format', async () => {
      const converted = await converter.convertRequest(geminiRequest, 'gemini', 'standard');
      
      expect(converted.id).toBeDefined();
      expect(converted.provider).toBe('gemini');
      expect(converted.messages).toHaveLength(1);
      expect(converted.messages[0].role).toBe('user');
      expect(converted.messages[0].content).toBe('Hello, how are you?');
    });

    it('should convert Gemini response to standard format', async () => {
      const converted = await converter.convertResponse(geminiResponse, 'gemini');
      
      expect(converted.choices).toHaveLength(1);
      expect(converted.choices[0].message.content).toBe('Hello! I am doing well, thank you for asking.');
      expect(converted.choices[0].finishReason).toBe('stop');
      expect(converted.usage.totalTokens).toBe(25);
    });
  });

  describe('CodeWhisperer Format', () => {
    const codewhispererRequest = {
      fileContext: {
        filename: 'test.js',
        programmingLanguage: {
          languageName: 'javascript'
        },
        leftFileContent: 'function hello() {',
        rightFileContent: ''
      },
      maxResults: 5
    };

    const codewhispererResponse = {
      completions: [
        {
          content: '\n  console.log("Hello, world!");\n}',
          references: []
        }
      ]
    };

    it('should validate CodeWhisperer request format', () => {
      const result = validator.validateRequest(codewhispererRequest, 'codewhisperer');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate CodeWhisperer response format', () => {
      const result = validator.validateResponse(codewhispererResponse, 'codewhisperer');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should convert CodeWhisperer request to standard format', async () => {
      const converted = await converter.convertRequest(codewhispererRequest, 'codewhisperer', 'standard');
      
      expect(converted.id).toBeDefined();
      expect(converted.provider).toBe('codewhisperer');
      expect(converted.messages).toHaveLength(1);
      expect(converted.messages[0].content).toBe('function hello() {');
      expect(converted.metadata.language).toBe('javascript');
      expect(converted.metadata.filename).toBe('test.js');
    });

    it('should convert CodeWhisperer response to standard format', async () => {
      const converted = await converter.convertResponse(codewhispererResponse, 'codewhisperer');
      
      expect(converted.choices).toHaveLength(1);
      expect(converted.choices[0].message.content).toContain('console.log("Hello, world!");');
      expect(converted.choices[0].finishReason).toBe('stop');
    });
  });

  describe('Bidirectional Conversion', () => {
    const standardRequest: AIRequest = {
      id: 'test-bidirectional',
      provider: 'test',
      model: 'test-model',
      messages: [
        { role: 'user', content: 'Write a hello world function' }
      ],
      tools: [
        {
          name: 'code_generator',
          description: 'Generates code snippets',
          parameters: {
            type: 'object',
            properties: {
              language: { type: 'string' },
              code: { type: 'string' }
            },
            required: ['language', 'code']
          }
        }
      ],
      metadata: {
        timestamp: new Date(),
        source: 'test',
        priority: 1
      }
    };

    it('should maintain data integrity in round-trip conversion (Standard -> Anthropic -> Standard)', async () => {
      // Convert to Anthropic format
      const anthropicRequest = await converter.convertRequest(standardRequest, 'standard', 'anthropic');
      
      // Convert back to standard format
      const backToStandard = await converter.convertRequest(anthropicRequest, 'anthropic', 'standard');
      
      // Verify key data is preserved
      expect(backToStandard.model).toBe(standardRequest.model);
      expect(backToStandard.messages).toHaveLength(standardRequest.messages.length);
      expect(backToStandard.messages[0].content).toBe(standardRequest.messages[0].content);
      expect(backToStandard.tools).toHaveLength(standardRequest.tools!.length);
      expect(backToStandard.tools![0].name).toBe(standardRequest.tools![0].name);
    });

    it('should maintain data integrity in round-trip conversion (Standard -> OpenAI -> Standard)', async () => {
      // Convert to OpenAI format
      const openaiRequest = await converter.convertRequest(standardRequest, 'standard', 'openai');
      
      // Convert back to standard format
      const backToStandard = await converter.convertRequest(openaiRequest, 'openai', 'standard');
      
      // Verify key data is preserved
      expect(backToStandard.model).toBe(standardRequest.model);
      expect(backToStandard.messages).toHaveLength(standardRequest.messages.length);
      expect(backToStandard.messages[0].content).toBe(standardRequest.messages[0].content);
      expect(backToStandard.tools).toHaveLength(standardRequest.tools!.length);
      expect(backToStandard.tools![0].name).toBe(standardRequest.tools![0].name);
    });

    it('should handle cross-provider conversion (Anthropic -> OpenAI)', async () => {
      const anthropicRequest = {
        model: 'claude-3-sonnet-20240229',
        messages: [
          { role: 'user', content: 'Hello, how are you?' }
        ],
        max_tokens: 1000
      };

      // Convert Anthropic to OpenAI via standard format
      const standardRequest = await converter.convertRequest(anthropicRequest, 'anthropic', 'standard');
      const openaiRequest = await converter.convertRequest(standardRequest, 'standard', 'openai');
      
      expect(openaiRequest.model).toBe(anthropicRequest.model);
      expect(openaiRequest.messages).toHaveLength(1);
      expect(openaiRequest.messages[0].content).toBe('Hello, how are you?');
      expect(openaiRequest.max_tokens).toBeGreaterThan(0);
    });
  });

  describe('Enhanced Streaming Support', () => {
    it('should handle force non-streaming mode', async () => {
      const streamingConfig = {
        mode: 'force_non_streaming' as const,
        bufferingStrategy: 'full' as const,
        toolCallBuffering: true,
        chunkSize: 50,
        simulationDelay: 0,
        enableToolCallParsing: true
      };

      // Mock streaming response
      const mockStreamingResponse = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { text: 'Hello' } };
          yield { type: 'content_block_delta', delta: { text: ' world' } };
          yield { type: 'message_stop', stop_reason: 'end_turn' };
        }
      };

      const result = await converter.convertResponse(
        mockStreamingResponse,
        'anthropic',
        'standard',
        streamingConfig
      );

      expect(result.choices[0].message.content).toContain('Hello world');
      expect(result.metadata.streamingMode).toBe('force_non_streaming');
    });

    it('should handle simulated streaming mode', async () => {
      const streamingConfig = {
        mode: 'simulated_streaming' as const,
        bufferingStrategy: 'minimal' as const,
        toolCallBuffering: false,
        chunkSize: 10,
        simulationDelay: 0,
        enableToolCallParsing: false
      };

      const completeResponse = {
        id: 'test-response',
        model: 'test-model',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'This is a test response for streaming simulation'
          },
          finishReason: 'stop'
        }],
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        metadata: { timestamp: new Date(), processingTime: 0, provider: 'test' }
      };

      const chunks: any[] = [];
      const result = await converter.convertResponse(
        completeResponse,
        'standard',
        'standard',
        streamingConfig,
        (chunk) => chunks.push(chunk)
      );

      expect(chunks.length).toBeGreaterThan(0);
      expect(result.choices[0].message.content).toBe(completeResponse.choices[0].message.content);
    });

    it('should handle tool call parsing in streaming', async () => {
      const streamingConfig = {
        mode: 'force_non_streaming' as const,
        bufferingStrategy: 'smart' as const,
        toolCallBuffering: true,
        chunkSize: 50,
        simulationDelay: 0,
        enableToolCallParsing: true
      };

      const mockStreamingResponse = {
        [Symbol.asyncIterator]: async function* () {
          yield { 
            type: 'content_block_start', 
            content_block: { 
              type: 'tool_use', 
              id: 'tool_1', 
              name: 'test_function' 
            } 
          };
          yield { 
            type: 'content_block_delta', 
            delta: { partial_json: '{"param": "value"}' } 
          };
          yield { type: 'message_stop', stop_reason: 'tool_use' };
        }
      };

      const result = await converter.convertResponse(
        mockStreamingResponse,
        'anthropic',
        'standard',
        streamingConfig
      );

      expect(result.choices[0].message.metadata?.toolCalls).toBeDefined();
      expect(result.choices[0].message.metadata?.toolCalls).toHaveLength(1);
      expect(result.choices[0].finishReason).toBe('tool_calls');
    });
  });

  describe('Protocol-Driven Preprocessing', () => {
    it('should apply LMStudio preprocessing rules', async () => {
      const protocolDecision = {
        sourceFormat: 'standard' as const,
        targetFormat: 'openai' as const,
        provider: 'lmstudio',
        model: 'local-model',
        preprocessorConfig: {
          type: 'openai_compatible' as const,
          variant: 'lmstudio',
          rules: [
            {
              name: 'model_mapping',
              condition: 'always',
              action: 'map_model_name',
              parameters: { provider: 'lmstudio' }
            },
            {
              name: 'parameter_cleanup',
              condition: 'has_unsupported_params',
              action: 'remove_unsupported_parameters',
              parameters: { provider: 'lmstudio' }
            }
          ],
          enabledFeatures: ['model_mapping', 'parameter_adjustment']
        }
      };

      const request: AIRequest = {
        id: 'test-lmstudio',
        provider: 'lmstudio',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [{ name: 'test_tool', description: 'Test', parameters: {} }],
        metadata: { timestamp: new Date(), source: 'test', priority: 1 }
      };

      const converted = await converter.convertRequest(
        request,
        'standard',
        'openai',
        protocolDecision
      );

      expect(converted.model).toBe('local-model');
      expect(converted.tools).toBeUndefined(); // Should be removed for LMStudio
    });

    it('should apply Ollama preprocessing rules', async () => {
      const protocolDecision = {
        sourceFormat: 'standard' as const,
        targetFormat: 'openai' as const,
        provider: 'ollama',
        model: 'llama2',
        preprocessorConfig: {
          type: 'openai_compatible' as const,
          variant: 'ollama',
          rules: [
            {
              name: 'model_mapping',
              condition: 'always',
              action: 'map_model_name',
              parameters: { provider: 'ollama' }
            }
          ],
          enabledFeatures: ['model_mapping']
        }
      };

      const request: AIRequest = {
        id: 'test-ollama',
        provider: 'ollama',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        metadata: { timestamp: new Date(), source: 'test', priority: 1 }
      };

      const converted = await converter.convertRequest(
        request,
        'standard',
        'openai',
        protocolDecision
      );

      expect(converted.model).toBe('llama2');
    });

    it('should apply Anthropic preprocessing rules', async () => {
      const protocolDecision = {
        sourceFormat: 'standard' as const,
        targetFormat: 'anthropic' as const,
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        preprocessorConfig: {
          type: 'provider_specific' as const,
          rules: [
            {
              name: 'max_tokens_requirement',
              condition: 'missing_max_tokens',
              action: 'add_max_tokens',
              parameters: { defaultValue: 4096 }
            }
          ],
          enabledFeatures: ['message_formatting']
        }
      };

      const request: AIRequest = {
        id: 'test-anthropic',
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Hello' }],
        metadata: { timestamp: new Date(), source: 'test', priority: 1 }
      };

      const converted = await converter.convertRequest(
        request,
        'standard',
        'anthropic',
        protocolDecision
      );

      expect(converted.max_tokens).toBe(4096);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid request format', () => {
      const invalidRequest = {
        // Missing required fields
        messages: 'not an array'
      };

      const result = validator.validateRequest(invalidRequest, 'standard');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle unsupported format conversion', async () => {
      const request: AIRequest = {
        id: 'test',
        provider: 'test',
        model: 'test',
        messages: [],
        metadata: { timestamp: new Date(), source: 'test', priority: 1 }
      };

      await expect(
        converter.convertRequest(request, 'standard', 'unsupported' as SupportedFormat)
      ).rejects.toThrow();
    });

    it('should validate conversion results', () => {
      const originalRequest = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1000
      };

      const convertedRequest = {
        id: 'converted',
        provider: 'test',
        model: 'test-model',
        messages: [{ role: 'user', content: 'test' }],
        metadata: { timestamp: new Date(), source: 'test', priority: 1 }
      };

      const result = validator.validateConvertedRequest(
        originalRequest,
        convertedRequest,
        'anthropic',
        'standard'
      );

      expect(result.valid).toBe(true);
    });

    it('should handle streaming errors gracefully', async () => {
      const streamingConfig = {
        mode: 'force_non_streaming' as const,
        bufferingStrategy: 'full' as const,
        toolCallBuffering: true,
        chunkSize: 50,
        simulationDelay: 0,
        enableToolCallParsing: true
      };

      const mockErrorResponse = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { text: 'Hello' } };
          throw new Error('Streaming error');
        }
      };

      await expect(
        converter.convertResponse(
          mockErrorResponse,
          'anthropic',
          'standard',
          streamingConfig
        )
      ).rejects.toThrow('Streaming error');
    });

    it('should handle malformed tool calls in streaming', async () => {
      const streamingConfig = {
        mode: 'force_non_streaming' as const,
        bufferingStrategy: 'smart' as const,
        toolCallBuffering: true,
        chunkSize: 50,
        simulationDelay: 0,
        enableToolCallParsing: true
      };

      const mockStreamingResponse = {
        [Symbol.asyncIterator]: async function* () {
          yield { 
            type: 'content_block_start', 
            content_block: { 
              type: 'tool_use', 
              id: 'tool_1', 
              name: 'test_function' 
            } 
          };
          yield { 
            type: 'content_block_delta', 
            delta: { partial_json: '{"param": invalid_json' } // Malformed JSON
          };
          yield { type: 'message_stop', stop_reason: 'tool_use' };
        }
      };

      const result = await converter.convertResponse(
        mockStreamingResponse,
        'anthropic',
        'standard',
        streamingConfig
      );

      // Should still include tool call with parse error
      expect(result.choices[0].message.metadata?.toolCalls).toBeDefined();
      expect(result.choices[0].message.metadata?.toolCalls[0]).toHaveProperty('parseError');
    });
  });

  describe('Format Support', () => {
    it('should list all supported formats', () => {
      const formats = converter.getSupportedFormats();
      expect(formats).toContain('standard');
      expect(formats).toContain('anthropic');
      expect(formats).toContain('openai');
      expect(formats).toContain('gemini');
      expect(formats).toContain('codewhisperer');
    });

    it('should check conversion support', () => {
      expect(converter.isConversionSupported('standard', 'anthropic')).toBe(true);
      expect(converter.isConversionSupported('openai', 'gemini')).toBe(true);
      expect(converter.isConversionSupported('standard', 'unsupported' as SupportedFormat)).toBe(false);
    });
  });
});

console.log('✅ Format conversion tests loaded');