/**
 * Anthropic Client Implementation
 * Real implementation using the official Anthropic SDK
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider } from '../base-provider.js';
import { AIRequest, AIResponse, ModelInfo, ProviderConfig, AuthResult } from '../../types/interfaces.js';
import { AnthropicConverter } from './converter.js';
import { AnthropicParser } from './parser.js';
import { AnthropicAuth } from './auth.js';

export class AnthropicClient extends BaseProvider {
  private converter: AnthropicConverter;
  private parser: AnthropicParser;
  private auth: AnthropicAuth;
  private anthropicSDK?: Anthropic;

  constructor() {
    super('anthropic', '1.0.0');
    this.converter = new AnthropicConverter();
    this.parser = new AnthropicParser();
    this.auth = new AnthropicAuth();
  }

  async initialize(config: ProviderConfig): Promise<void> {
    await super.initialize(config);
    
    // Initialize Anthropic-specific authentication
    await this.auth.initialize(config.apiKey || '');
    
    // Initialize official Anthropic SDK
    this.anthropicSDK = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.endpoint || 'https://api.anthropic.com',
      timeout: config.timeout || 30000,
      maxRetries: config.retryAttempts || 3
    });

    console.log('✅ Anthropic SDK initialized successfully');
  }

  async processRequest(request: AIRequest): Promise<AIResponse> {
    if (!this.anthropicSDK) {
      throw new Error('Anthropic SDK not initialized');
    }

    try {
      // Validate authentication
      if (!await this.validateToken()) {
        const authResult = await this.refreshToken();
        if (!authResult.success) {
          throw new Error('Authentication failed');
        }
      }

      // Convert request to Anthropic format
      const anthropicRequest = await this.converter.toAnthropicFormat(request);
      
      // Make API call using official SDK
      let response;
      if (request.stream) {
        response = await this.handleStreamingRequest(anthropicRequest);
      } else {
        response = await this.anthropicSDK.messages.create({
          model: anthropicRequest.model,
          messages: anthropicRequest.messages,
          max_tokens: anthropicRequest.max_tokens,
          temperature: anthropicRequest.temperature,
          top_p: anthropicRequest.top_p,
          top_k: anthropicRequest.top_k,
          stop_sequences: anthropicRequest.stop_sequences,
          tools: anthropicRequest.tools,
          stream: false
        });
      }

      // Parse and convert response
      return await this.parser.parseResponse(response);
      
    } catch (error) {
      const providerError = this.handleError(error);
      
      if (this.shouldRetry(providerError)) {
        // SDK handles retries automatically, but we can add custom retry logic here
        await this.delay(providerError.retryAfter || 1000);
        return this.processRequest(request);
      }
      
      throw providerError;
    }
  }

  private async handleStreamingRequest(anthropicRequest: any): Promise<any> {
    if (!this.anthropicSDK) {
      throw new Error('Anthropic SDK not initialized');
    }

    const stream = await this.anthropicSDK.messages.create({
      ...anthropicRequest,
      stream: true
    });

    // Collect streaming response
    let fullResponse = {
      id: '',
      type: 'message' as const,
      role: 'assistant' as const,
      content: [] as any[],
      model: anthropicRequest.model,
      stop_reason: 'end_turn' as const,
      usage: { input_tokens: 0, output_tokens: 0 }
    };

    for await (const chunk of stream) {
      switch (chunk.type) {
        case 'message_start':
          fullResponse.id = chunk.message.id;
          fullResponse.model = chunk.message.model;
          fullResponse.usage = chunk.message.usage;
          break;
        case 'content_block_start':
          if (chunk.content_block.type === 'text') {
            fullResponse.content.push({
              type: 'text',
              text: ''
            });
          }
          break;
        case 'content_block_delta':
          if (chunk.delta.type === 'text_delta') {
            const lastContent = fullResponse.content[fullResponse.content.length - 1];
            if (lastContent && lastContent.type === 'text') {
              lastContent.text += chunk.delta.text;
            }
          }
          break;
        case 'message_delta':
          if (chunk.delta.stop_reason) {
            fullResponse.stop_reason = chunk.delta.stop_reason;
          }
          if (chunk.usage) {
            fullResponse.usage.output_tokens = chunk.usage.output_tokens;
          }
          break;
      }
    }

    return fullResponse;
  }

  async getModels(): Promise<ModelInfo[]> {
    // Anthropic models (as of current knowledge)
    return [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        provider: this.name,
        capabilities: ['text-generation', 'conversation', 'tool-calling', 'vision'],
        maxTokens: 8192,
        contextWindow: 200000,
        pricing: {
          inputTokens: 3.00, // per million tokens
          outputTokens: 15.00
        }
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        provider: this.name,
        capabilities: ['text-generation', 'conversation', 'tool-calling', 'vision'],
        maxTokens: 8192,
        contextWindow: 200000,
        pricing: {
          inputTokens: 0.25,
          outputTokens: 1.25
        }
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        provider: this.name,
        capabilities: ['text-generation', 'conversation', 'tool-calling', 'vision'],
        maxTokens: 4096,
        contextWindow: 200000,
        pricing: {
          inputTokens: 15.00,
          outputTokens: 75.00
        }
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        provider: this.name,
        capabilities: ['text-generation', 'conversation', 'tool-calling', 'vision'],
        maxTokens: 4096,
        contextWindow: 200000,
        pricing: {
          inputTokens: 3.00,
          outputTokens: 15.00
        }
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        provider: this.name,
        capabilities: ['text-generation', 'conversation', 'tool-calling', 'vision'],
        maxTokens: 4096,
        contextWindow: 200000,
        pricing: {
          inputTokens: 0.25,
          outputTokens: 1.25
        }
      }
    ];
  }

  protected async performHealthCheck(): Promise<void> {
    if (!this.anthropicSDK) {
      throw new Error('Anthropic SDK not initialized');
    }

    try {
      // Make a simple request to verify API connectivity
      await this.anthropicSDK.messages.create({
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1
      });
    } catch (error) {
      throw new Error(`Anthropic health check failed: ${error.message}`);
    }
  }

  protected async performAuthentication(): Promise<AuthResult> {
    return await this.auth.authenticate();
  }

  protected async performTokenRefresh(): Promise<AuthResult> {
    return await this.auth.refreshToken();
  }

  protected async performTokenValidation(): Promise<boolean> {
    return this.auth.isTokenValid();
  }

  async convertRequest(request: AIRequest, targetFormat: string): Promise<any> {
    if (targetFormat === 'anthropic') {
      return await this.converter.toAnthropicFormat(request);
    } else if (targetFormat === 'openai') {
      return await this.converter.toOpenAIFormat(request);
    } else if (targetFormat === 'gemini') {
      return await this.converter.toGeminiFormat(request);
    }
    
    return super.convertRequest(request, targetFormat);
  }

  async convertResponse(response: any, sourceFormat: string): Promise<AIResponse> {
    if (sourceFormat === 'anthropic') {
      return await this.parser.parseResponse(response);
    }
    
    return super.convertResponse(response, sourceFormat);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Method to get SDK instance for advanced usage
  getSDK(): Anthropic | undefined {
    return this.anthropicSDK;
  }

  // Method to handle SDK-specific errors
  protected handleSDKError(error: any): any {
    if (error instanceof Anthropic.APIError) {
      return {
        code: `ANTHROPIC_API_ERROR_${error.status}`,
        message: error.message,
        type: error.status === 401 ? 'authentication' : 
              error.status === 429 ? 'rate-limit' :
              error.status >= 500 ? 'server' : 'validation',
        retryable: error.status === 429 || error.status >= 500,
        retryAfter: error.headers?.['retry-after'] ? parseInt(error.headers['retry-after']) * 1000 : undefined,
        originalError: error
      };
    }

    return this.handleError(error);
  }
}

console.log('✅ Anthropic client loaded - using official SDK');