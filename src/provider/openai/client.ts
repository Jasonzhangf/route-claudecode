/**
 * OpenAI Client Implementation
 * Real implementation using the official OpenAI SDK
 */

import OpenAI from 'openai';
import { BaseProvider } from '../base-provider.js';
import { AIRequest, AIResponse, ModelInfo, ProviderConfig, AuthResult } from '../../types/interfaces.js';
import { OpenAIConverter } from './converter.js';
import { OpenAIParser } from './parser.js';
import { OpenAIAuth } from './auth.js';

export class OpenAIClient extends BaseProvider {
  private converter: OpenAIConverter;
  private parser: OpenAIParser;
  private auth: OpenAIAuth;
  private openaiSDK?: OpenAI;

  constructor() {
    super('openai', '1.0.0');
    this.converter = new OpenAIConverter();
    this.parser = new OpenAIParser();
    this.auth = new OpenAIAuth();
  }

  async initialize(config: ProviderConfig): Promise<void> {
    await super.initialize(config);
    
    // Initialize OpenAI-specific authentication
    await this.auth.initialize(config.apiKey || '');
    
    // Initialize official OpenAI SDK
    this.openaiSDK = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.endpoint || 'https://api.openai.com/v1',
      timeout: config.timeout || 30000,
      maxRetries: config.retryAttempts || 3
    });

    console.log('✅ OpenAI SDK initialized successfully');
  }

  async processRequest(request: AIRequest): Promise<AIResponse> {
    if (!this.openaiSDK) {
      throw new Error('OpenAI SDK not initialized');
    }

    try {
      // Validate authentication
      if (!await this.validateToken()) {
        const authResult = await this.refreshToken();
        if (!authResult.success) {
          throw new Error('Authentication failed');
        }
      }

      // Convert request to OpenAI format
      const openaiRequest = await this.converter.toOpenAIFormat(request);
      
      // Make API call using official SDK
      let response;
      if (request.stream) {
        response = await this.handleStreamingRequest(openaiRequest);
      } else {
        response = await this.openaiSDK.chat.completions.create({
          model: openaiRequest.model,
          messages: openaiRequest.messages,
          tools: openaiRequest.tools,
          tool_choice: openaiRequest.tool_choice,
          temperature: openaiRequest.temperature,
          max_tokens: openaiRequest.max_tokens,
          top_p: openaiRequest.top_p,
          frequency_penalty: openaiRequest.frequency_penalty,
          presence_penalty: openaiRequest.presence_penalty,
          stop: openaiRequest.stop,
          stream: false
        });
      }

      // Parse and convert response
      return await this.parser.parseResponse(response);
      
    } catch (error) {
      const providerError = this.handleSDKError(error);
      
      if (this.shouldRetry(providerError)) {
        await this.delay(providerError.retryAfter || 1000);
        return this.processRequest(request);
      }
      
      throw providerError;
    }
  }

  private async handleStreamingRequest(openaiRequest: any): Promise<any> {
    if (!this.openaiSDK) {
      throw new Error('OpenAI SDK not initialized');
    }

    const stream = await this.openaiSDK.chat.completions.create({
      ...openaiRequest,
      stream: true
    });

    // Collect streaming response
    let fullResponse = {
      id: '',
      object: 'chat.completion',
      created: Date.now(),
      model: openaiRequest.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant' as const,
          content: ''
        },
        finish_reason: null
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };

    for await (const chunk of stream) {
      if (chunk.choices[0]?.delta?.content) {
        fullResponse.choices[0].message.content += chunk.choices[0].delta.content;
      }
      
      if (chunk.choices[0]?.finish_reason) {
        fullResponse.choices[0].finish_reason = chunk.choices[0].finish_reason;
      }

      if (chunk.id) {
        fullResponse.id = chunk.id;
      }

      if (chunk.usage) {
        fullResponse.usage = chunk.usage;
      }
    }

    return fullResponse;
  }

  async getModels(): Promise<ModelInfo[]> {
    if (!this.openaiSDK) {
      // Return static list if SDK not initialized
      return this.getStaticModelList();
    }

    try {
      const models = await this.openaiSDK.models.list();
      
      return models.data
        .filter(model => model.id.includes('gpt'))
        .map(model => ({
          id: model.id,
          name: this.getModelDisplayName(model.id),
          provider: this.name,
          capabilities: this.getModelCapabilities(model.id),
          maxTokens: this.getModelMaxTokens(model.id),
          contextWindow: this.getModelContextWindow(model.id),
          pricing: this.getModelPricing(model.id)
        }));
    } catch (error) {
      console.warn('Failed to fetch models from OpenAI API, using static list:', error);
      return this.getStaticModelList();
    }
  }

  private getStaticModelList(): ModelInfo[] {
    return [
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: this.name,
        capabilities: ['text-generation', 'conversation', 'tool-calling', 'vision'],
        maxTokens: 4096,
        contextWindow: 128000,
        pricing: {
          inputTokens: 10.00,
          outputTokens: 30.00
        }
      },
      {
        id: 'gpt-4',
        name: 'GPT-4',
        provider: this.name,
        capabilities: ['text-generation', 'conversation', 'tool-calling'],
        maxTokens: 4096,
        contextWindow: 8192,
        pricing: {
          inputTokens: 30.00,
          outputTokens: 60.00
        }
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: this.name,
        capabilities: ['text-generation', 'conversation', 'tool-calling'],
        maxTokens: 4096,
        contextWindow: 16385,
        pricing: {
          inputTokens: 0.50,
          outputTokens: 1.50
        }
      }
    ];
  }

  private getModelDisplayName(modelId: string): string {
    const nameMap: Record<string, string> = {
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4': 'GPT-4',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'gpt-4-vision-preview': 'GPT-4 Vision'
    };
    return nameMap[modelId] || modelId;
  }

  private getModelCapabilities(modelId: string): string[] {
    if (modelId.includes('vision')) {
      return ['text-generation', 'conversation', 'tool-calling', 'vision'];
    }
    if (modelId.includes('gpt-4') || modelId.includes('gpt-3.5')) {
      return ['text-generation', 'conversation', 'tool-calling'];
    }
    return ['text-generation', 'conversation'];
  }

  private getModelMaxTokens(modelId: string): number {
    return 4096; // Most OpenAI models support 4096 max tokens
  }

  private getModelContextWindow(modelId: string): number {
    const contextMap: Record<string, number> = {
      'gpt-4-turbo': 128000,
      'gpt-4': 8192,
      'gpt-3.5-turbo': 16385
    };
    return contextMap[modelId] || 4096;
  }

  private getModelPricing(modelId: string): { inputTokens: number; outputTokens: number } {
    const pricingMap: Record<string, { inputTokens: number; outputTokens: number }> = {
      'gpt-4-turbo': { inputTokens: 10.00, outputTokens: 30.00 },
      'gpt-4': { inputTokens: 30.00, outputTokens: 60.00 },
      'gpt-3.5-turbo': { inputTokens: 0.50, outputTokens: 1.50 }
    };
    return pricingMap[modelId] || { inputTokens: 0, outputTokens: 0 };
  }

  protected async performHealthCheck(): Promise<void> {
    if (!this.openaiSDK) {
      throw new Error('OpenAI SDK not initialized');
    }

    try {
      // Make a simple request to verify API connectivity
      await this.openaiSDK.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1
      });
    } catch (error) {
      throw new Error(`OpenAI health check failed: ${error.message}`);
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
    if (targetFormat === 'openai') {
      return await this.converter.toOpenAIFormat(request);
    } else if (targetFormat === 'anthropic') {
      return await this.converter.toAnthropicFormat(request);
    } else if (targetFormat === 'gemini') {
      return await this.converter.toGeminiFormat(request);
    }
    
    return super.convertRequest(request, targetFormat);
  }

  async convertResponse(response: any, sourceFormat: string): Promise<AIResponse> {
    if (sourceFormat === 'openai') {
      return await this.parser.parseResponse(response);
    }
    
    return super.convertResponse(response, sourceFormat);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Method to get SDK instance for advanced usage
  getSDK(): OpenAI | undefined {
    return this.openaiSDK;
  }

  // Method to handle SDK-specific errors
  protected handleSDKError(error: any): any {
    if (error instanceof OpenAI.APIError) {
      return {
        code: `OPENAI_API_ERROR_${error.status}`,
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

console.log('✅ OpenAI client loaded - using official SDK');