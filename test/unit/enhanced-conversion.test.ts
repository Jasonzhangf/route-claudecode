/**
 * Enhanced Conversion Tests
 * Tests for intelligent streaming, protocol selection, and preprocessing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedConverter, EnhancedConversionConfig, ConversionContext } from '../../src/provider/conversion/enhanced-converter.js';
import { StreamingManager, StreamingConfig } from '../../src/provider/conversion/streaming-manager.js';
import { ProtocolSelector } from '../../src/provider/conversion/protocol-selector.js';
import { PreprocessorSelector } from '../../src/provider/conversion/preprocessor-selector.js';
import { AIRequest, AIResponse } from '../../src/types/interfaces.js';

describe('Enhanced Conversion', () => {
  let enhancedConverter: EnhancedConverter;
  let config: EnhancedConversionConfig;

  beforeEach(async () => {
    config = EnhancedConverter.createDefaultConfig();
    enhancedConverter = new EnhancedConverter(config);
    await enhancedConverter.initialize();
  });

  afterEach(async () => {
    await enhancedConverter.shutdown();
  });

  describe('Intelligent Streaming', () => {
    it('should handle force non-streaming mode', async () => {
      const request: AIRequest = {
        id: 'test-streaming-1',
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
        metadata: { timestamp: new Date(), source: 'test', priority: 1 }
      };

      const mockStreamingResponse = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { text: 'Hello' } };
          yield { type: 'content_block_delta', delta: { text: ' world' } };
          yield { type: 'message_stop', stop_reason: 'end_turn' };
        }
      };

      const context: ConversionContext = {
        requestId: 'test-streaming-1',
        validationLevel: 'lenient',
        enableDebugLogging: true,
        streamingPreferences: {
          mode: 'force_non_streaming',
          bufferingStrategy: 'full'
        }
      };

      const result = await enhancedConverter.convertResponse(
        mockStreamingResponse,
        'anthropic',
        'standard',
        context
      );

      expect(result.convertedResponse).toBeDefined();
      expect(result.convertedResponse!.choices[0].message.content).toContain('Hello world');
      expect(result.metadata.streamingMode).toBe('force_non_streaming');
      expect(result.metadata.chunksProcessed).toBeUndefined(); // No chunks emitted in full buffer mode
    });

    it('should handle simulated streaming mode', async () => {
      const completeResponse: AIResponse = {
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

      const context: ConversionContext = {
        requestId: 'test-streaming-2',
        validationLevel: 'lenient',
        enableDebugLogging: true,
        streamingPreferences: {
          mode: 'simulated_streaming',
          bufferingStrategy: 'minimal',
          chunkSize: 10,
          simulationDelay: 0
        }
      };

      const chunks: any[] = [];
      const result = await enhancedConverter.convertResponse(
        completeResponse,
        'standard',
        'standard',
        context,
        (chunk) => chunks.push(chunk)
      );

      expect(result.convertedResponse).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
      expect(result.metadata.streamingMode).toBe('simulated_streaming');
      expect(result.metadata.chunksProcessed).toBeGreaterThan(0);
    });

    it('should handle tool call parsing in streaming', async () => {
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

      const context: ConversionContext = {
        requestId: 'test-tool-streaming',
        validationLevel: 'lenient',
        enableDebugLogging: true,
        streamingPreferences: {
          mode: 'force_non_streaming',
          bufferingStrategy: 'smart',
          toolCallBuffering: true,
          enableToolCallParsing: true
        }
      };

      const result = await enhancedConverter.convertResponse(
        mockStreamingResponse,
        'anthropic',
        'standard',
        context
      );

      expect(result.convertedResponse).toBeDefined();
      expect(result.convertedResponse!.choices[0].message.metadata?.toolCalls).toBeDefined();
      expect(result.convertedResponse!.choices[0].message.metadata?.toolCalls).toHaveLength(1);
      expect(result.convertedResponse!.choices[0].finishReason).toBe('tool_calls');
    });

    it('should handle streaming errors gracefully', async () => {
      const mockErrorResponse = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { text: 'Hello' } };
          throw new Error('Streaming error');
        }
      };

      const context: ConversionContext = {
        requestId: 'test-error-streaming',
        validationLevel: 'lenient',
        enableDebugLogging: true,
        streamingPreferences: {
          mode: 'force_non_streaming'
        }
      };

      await expect(
        enhancedConverter.convertResponse(
          mockErrorResponse,
          'anthropic',
          'standard',
          context
        )
      ).rejects.toThrow('Streaming error');
    });
  });

  describe('Protocol Selection', () => {
    it('should select appropriate protocol for LMStudio', async () => {
      const request: AIRequest = {
        id: 'test-lmstudio',
        provider: 'lmstudio',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [{ name: 'test_tool', description: 'Test', parameters: {} }],
        metadata: { timestamp: new Date(), source: 'test', priority: 1 }
      };

      const context: ConversionContext = {
        requestId: 'test-lmstudio',
        validationLevel: 'lenient',
        enableDebugLogging: true,
        routingContext: {
          category: 'default',
          priority: 1
        }
      };

      const result = await enhancedConverter.convertRequest(
        request,
        'standard',
        'openai',
        context
      );

      expect(result.convertedRequest).toBeDefined();
      expect(result.protocolDecision).toBeDefined();
      expect(result.preprocessorConfig).toBeDefined();
      expect(result.preprocessorConfig!.type).toBe('openai_compatible');
      expect(result.preprocessorConfig!.variant).toBe('lmstudio');
    });

    it('should select appropriate protocol for Ollama', async () => {
      const request: AIRequest = {
        id: 'test-ollama',
        provider: 'ollama',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        metadata: { timestamp: new Date(), source: 'test', priority: 1 }
      };

      const context: ConversionContext = {
        requestId: 'test-ollama',
        validationLevel: 'lenient',
        enableDebugLogging: true,
        routingContext: {
          category: 'default'
        }
      };

      const result = await enhancedConverter.convertRequest(
        request,
        'standard',
        'openai',
        context
      );

      expect(result.convertedRequest).toBeDefined();
      expect(result.protocolDecision).toBeDefined();
      expect(result.preprocessorConfig).toBeDefined();
      expect(result.preprocessorConfig!.type).toBe('openai_compatible');
      expect(result.preprocessorConfig!.variant).toBe('ollama');
    });

    it('should handle protocol selection for Anthropic', async () => {
      const request: AIRequest = {
        id: 'test-anthropic-protocol',
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [{ name: 'test_tool', description: 'Test', parameters: {} }],
        metadata: { timestamp: new Date(), source: 'test', priority: 1 }
      };

      const context: ConversionContext = {
        requestId: 'test-anthropic-protocol',
        validationLevel: 'lenient',
        enableDebugLogging: true,
        routingContext: {
          category: 'default'
        }
      };

      const result = await enhancedConverter.convertRequest(
        request,
        'standard',
        'anthropic',
        context
      );

      expect(result.convertedRequest).toBeDefined();
      expect(result.protocolDecision).toBeDefined();
      expect(result.preprocessorConfig).toBeDefined();
      expect(result.preprocessorConfig!.type).toBe('provider_specific');
      expect(result.convertedRequest.max_tokens).toBeDefined();
    });
  });

  describe('Preprocessor Selection', () => {
    it('should apply LMStudio preprocessing rules', async () => {
      const request: AIRequest = {
        id: 'test-lmstudio-preprocess',
        provider: 'lmstudio',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [{ name: 'test_tool', description: 'Test', parameters: {} }],
        metadata: { timestamp: new Date(), source: 'test', priority: 1 }
      };

      const context: ConversionContext = {
        requestId: 'test-lmstudio-preprocess',
        validationLevel: 'lenient',
        enableDebugLogging: true,
        preprocessorContext: {
          enabledFeatures: ['model_mapping', 'parameter_cleanup']
        }
      };

      const result = await enhancedConverter.convertRequest(
        request,
        'standard',
        'openai',
        context
      );

      expect(result.convertedRequest).toBeDefined();
      expect(result.convertedRequest.model).toBe('local-model'); // Should be mapped
      expect(result.convertedRequest.tools).toBeUndefined(); // Should be removed
      expect(result.preprocessorConfig).toBeDefined();
      expect(result.preprocessorConfig!.enabledFeatures).toContain('model_mapping');
    });

    it('should apply Ollama preprocessing rules', async () => {
      const request: AIRequest = {
        id: 'test-ollama-preprocess',
        provider: 'ollama',
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        metadata: { timestamp: new Date(), source: 'test', priority: 1 }
      };

      const context: ConversionContext = {
        requestId: 'test-ollama-preprocess',
        validationLevel: 'lenient',
        enableDebugLogging: true
      };

      const result = await enhancedConverter.convertRequest(
        request,
        'standard',
        'openai',
        context
      );

      expect(result.convertedRequest).toBeDefined();
      expect(result.convertedRequest.model).toBe('llama2'); // Should be mapped for Ollama
      expect(result.preprocessorConfig).toBeDefined();
      expect(result.preprocessorConfig!.variant).toBe('ollama');
    });

    it('should apply custom preprocessor context', async () => {
      const request: AIRequest = {
        id: 'test-custom-preprocess',
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Hello' }],
        metadata: { timestamp: new Date(), source: 'test', priority: 1 }
      };

      const context: ConversionContext = {
        requestId: 'test-custom-preprocess',
        validationLevel: 'lenient',
        enableDebugLogging: true,
        preprocessorContext: {
          disabledRules: ['add_max_tokens'],
          globalSettingOverrides: {
            customSetting: 'test_value'
          }
        }
      };

      const result = await enhancedConverter.convertRequest(
        request,
        'standard',
        'anthropic',
        context
      );

      expect(result.convertedRequest).toBeDefined();
      expect(result.preprocessorConfig).toBeDefined();
      expect(result.preprocessorConfig!.globalSettings.customSetting).toBe('test_value');
    });
  });

  describe('Bidirectional Conversion', () => {
    it('should handle bidirectional conversion with streaming', async () => {
      const request: AIRequest = {
        id: 'test-bidirectional',
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Hello' }],
        metadata: { timestamp: new Date(), source: 'test', priority: 1 }
      };

      const response = {
        id: 'resp-123',
        model: 'claude-3-sonnet-20240229',
        content: [{ type: 'text', text: 'Hello! How can I help you?' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 10 }
      };

      const context: ConversionContext = {
        requestId: 'test-bidirectional',
        validationLevel: 'lenient',
        enableDebugLogging: true,
        streamingPreferences: {
          mode: 'simulated_streaming',
          chunkSize: 5,
          simulationDelay: 0
        }
      };

      const chunks: any[] = [];
      const result = await enhancedConverter.convertBidirectional(
        request,
        response,
        'standard',
        'anthropic',
        context,
        (chunk) => chunks.push(chunk)
      );

      expect(result.requestResult.convertedRequest).toBeDefined();
      expect(result.responseResult.convertedResponse).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
      expect(result.responseResult.metadata.streamingMode).toBe('simulated_streaming');
    });
  });

  describe('Validation', () => {
    it('should validate requests in strict mode', async () => {
      const invalidRequest = {
        // Missing required fields
        messages: 'not an array'
      } as any;

      const context: ConversionContext = {
        requestId: 'test-validation-strict',
        validationLevel: 'strict',
        enableDebugLogging: true
      };

      await expect(
        enhancedConverter.convertRequest(
          invalidRequest,
          'standard',
          'anthropic',
          context
        )
      ).rejects.toThrow();
    });

    it('should allow invalid requests in lenient mode', async () => {
      const invalidRequest = {
        id: 'test-invalid',
        provider: 'test',
        model: 'test',
        messages: 'not an array', // Invalid but should pass in lenient mode
        metadata: { timestamp: new Date(), source: 'test', priority: 1 }
      } as any;

      const context: ConversionContext = {
        requestId: 'test-validation-lenient',
        validationLevel: 'lenient',
        enableDebugLogging: true
      };

      const result = await enhancedConverter.convertRequest(
        invalidRequest,
        'standard',
        'anthropic',
        context
      );

      expect(result.validationResults.length).toBeGreaterThan(0);
      expect(result.validationResults[0].valid).toBe(false);
      expect(result.convertedRequest).toBeDefined(); // Should still convert
    });

    it('should skip validation when disabled', async () => {
      const request: AIRequest = {
        id: 'test-validation-disabled',
        provider: 'test',
        model: 'test',
        messages: [{ role: 'user', content: 'Hello' }],
        metadata: { timestamp: new Date(), source: 'test', priority: 1 }
      };

      const context: ConversionContext = {
        requestId: 'test-validation-disabled',
        validationLevel: 'disabled',
        enableDebugLogging: true
      };

      const result = await enhancedConverter.convertRequest(
        request,
        'standard',
        'anthropic',
        context
      );

      expect(result.validationResults).toHaveLength(0);
      expect(result.convertedRequest).toBeDefined();
    });
  });

  describe('Health Check', () => {
    it('should perform comprehensive health check', async () => {
      const health = await enhancedConverter.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.components.formatConverter).toBe(true);
      expect(health.components.streamingManager).toBe(true);
      expect(health.components.protocolSelector).toBe(true);
      expect(health.components.preprocessorSelector).toBe(true);
      expect(health.details.formatConverter.supportedFormats).toBeGreaterThan(0);
    });
  });

  describe('Configuration', () => {
    it('should create default configuration', () => {
      const defaultConfig = EnhancedConverter.createDefaultConfig();

      expect(defaultConfig.enableIntelligentStreaming).toBe(true);
      expect(defaultConfig.enableProtocolSelection).toBe(true);
      expect(defaultConfig.enablePreprocessorSelection).toBe(true);
      expect(defaultConfig.enableValidation).toBe(true);
      expect(defaultConfig.defaultStreamingConfig).toBeDefined();
      expect(defaultConfig.protocolSelector).toBeDefined();
      expect(defaultConfig.preprocessorSelector).toBeDefined();
    });

    it('should handle disabled features', async () => {
      const minimalConfig: EnhancedConversionConfig = {
        enableIntelligentStreaming: false,
        enableProtocolSelection: false,
        enablePreprocessorSelection: false,
        enableValidation: false,
        defaultStreamingConfig: {
          mode: 'force_non_streaming',
          bufferingStrategy: 'full',
          toolCallBuffering: false,
          chunkSize: 50,
          simulationDelay: 0,
          enableToolCallParsing: false
        }
      };

      const minimalConverter = new EnhancedConverter(minimalConfig);
      await minimalConverter.initialize();

      const request: AIRequest = {
        id: 'test-minimal',
        provider: 'test',
        model: 'test',
        messages: [{ role: 'user', content: 'Hello' }],
        metadata: { timestamp: new Date(), source: 'test', priority: 1 }
      };

      const context: ConversionContext = {
        requestId: 'test-minimal',
        validationLevel: 'disabled',
        enableDebugLogging: false
      };

      const result = await minimalConverter.convertRequest(
        request,
        'standard',
        'anthropic',
        context
      );

      expect(result.convertedRequest).toBeDefined();
      expect(result.protocolDecision).toBeUndefined();
      expect(result.preprocessorConfig).toBeUndefined();
      expect(result.validationResults).toHaveLength(0);

      await minimalConverter.shutdown();
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors', async () => {
      const invalidConfig = {
        ...config,
        protocolSelector: null // Invalid config
      };

      const converter = new EnhancedConverter(invalidConfig);
      
      // Should not throw during construction
      expect(converter).toBeDefined();
      
      // Should handle initialization gracefully
      await expect(converter.initialize()).resolves.not.toThrow();
      
      await converter.shutdown();
    });

    it('should handle conversion errors gracefully', async () => {
      const request: AIRequest = {
        id: 'test-error',
        provider: 'unknown_provider',
        model: 'unknown_model',
        messages: [{ role: 'user', content: 'Hello' }],
        metadata: { timestamp: new Date(), source: 'test', priority: 1 }
      };

      const context: ConversionContext = {
        requestId: 'test-error',
        validationLevel: 'lenient',
        enableDebugLogging: true
      };

      // Should handle unknown providers gracefully
      const result = await enhancedConverter.convertRequest(
        request,
        'standard',
        'anthropic',
        context
      );

      expect(result.convertedRequest).toBeDefined();
    });
  });
});

console.log('✅ Enhanced conversion tests loaded');