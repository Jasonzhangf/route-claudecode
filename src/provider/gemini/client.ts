/**
 * Gemini Client Implementation
 * Real implementation using the official Google Generative AI SDK
 */

import { GoogleGenerativeAI, GenerativeModel, ChatSession } from '@google/generative-ai';
import { BaseProvider } from '../base-provider.js';
import { AIRequest, AIResponse, ModelInfo, ProviderConfig, AuthResult } from '../../types/interfaces.js';
import { GeminiConverter } from './converter.js';
import { GeminiParser } from './parser.js';
import { GeminiAuth } from './auth.js';

export class GeminiClient extends BaseProvider {
  private converter: GeminiConverter;
  private parser: GeminiParser;
  private auth: GeminiAuth;
  private geminiSDK?: GoogleGenerativeAI;
  private models: Map<string, GenerativeModel> = new Map();

  constructor() {
    super('gemini', '1.0.0');
    this.converter = new GeminiConverter();
    this.parser = new GeminiParser();
    this.auth = new GeminiAuth();
  }

  async initialize(config: ProviderConfig): Promise<void> {
    await super.initialize(config);
    
    // Initialize Gemini-specific authentication
    await this.auth.initialize(config.apiKey || '');
    
    // Initialize official Google Generative AI SDK
    this.geminiSDK = new GoogleGenerativeAI(config.apiKey || '');

    console.log('✅ Gemini SDK initialized successfully');
  }

  async processRequest(request: AIRequest): Promise<AIResponse> {
    if (!this.geminiSDK) {
      throw new Error('Gemini SDK not initialized');
    }

    try {
      // Validate authentication
      if (!await this.validateToken()) {
        const authResult = await this.refreshToken();
        if (!authResult.success) {
          throw new Error('Authentication failed');
        }
      }

      // Get or create model instance
      const model = await this.getModelInstance(request.model);
      
      // Convert request to Gemini format
      const geminiRequest = await this.converter.toGeminiFormat(request);
      
      // Make API call using official SDK
      let response;
      if (request.stream) {
        response = await this.handleStreamingRequest(model, geminiRequest);
      } else {
        if (this.isMultiTurnConversation(request)) {
          response = await this.handleChatRequest(model, geminiRequest);
        } else {
          response = await model.generateContent(geminiRequest);
        }
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

  private async getModelInstance(modelName: string): Promise<GenerativeModel> {
    if (!this.geminiSDK) {
      throw new Error('Gemini SDK not initialized');
    }

    if (!this.models.has(modelName)) {
      const model = this.geminiSDK.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 8192
        }
      });
      this.models.set(modelName, model);
    }

    return this.models.get(modelName)!;
  }

  private isMultiTurnConversation(request: AIRequest): boolean {
    return request.messages.length > 1;
  }

  private async handleChatRequest(model: GenerativeModel, geminiRequest: any): Promise<any> {
    const chat = model.startChat({
      history: geminiRequest.history || [],
      generationConfig: geminiRequest.generationConfig
    });

    const result = await chat.sendMessage(geminiRequest.message || geminiRequest.contents[geminiRequest.contents.length - 1]);
    return result;
  }

  private async handleStreamingRequest(model: GenerativeModel, geminiRequest: any): Promise<any> {
    let result;
    
    if (this.isMultiTurnConversation({ messages: [] } as AIRequest)) {
      const chat = model.startChat({
        history: geminiRequest.history || [],
        generationConfig: geminiRequest.generationConfig
      });
      result = await chat.sendMessageStream(geminiRequest.message || geminiRequest.contents[geminiRequest.contents.length - 1]);
    } else {
      result = await model.generateContentStream(geminiRequest);
    }

    // Collect streaming response
    let fullText = '';
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
    }

    // Return final result
    const finalResult = await result.response;
    return {
      ...finalResult,
      text: () => fullText
    };
  }

  async getModels(): Promise<ModelInfo[]> {
    // Gemini models (as of current knowledge)
    return [
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: this.name,
        capabilities: ['text-generation', 'conversation', 'tool-calling', 'vision', 'code-generation'],
        maxTokens: 8192,
        contextWindow: 2000000, // 2M tokens
        pricing: {
          inputTokens: 1.25, // per million tokens
          outputTokens: 5.00
        }
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        provider: this.name,
        capabilities: ['text-generation', 'conversation', 'tool-calling', 'vision', 'code-generation'],
        maxTokens: 8192,
        contextWindow: 1000000, // 1M tokens
        pricing: {
          inputTokens: 0.075,
          outputTokens: 0.30
        }
      },
      {
        id: 'gemini-pro',
        name: 'Gemini Pro',
        provider: this.name,
        capabilities: ['text-generation', 'conversation', 'tool-calling'],
        maxTokens: 8192,
        contextWindow: 32768,
        pricing: {
          inputTokens: 0.50,
          outputTokens: 1.50
        }
      },
      {
        id: 'gemini-pro-vision',
        name: 'Gemini Pro Vision',
        provider: this.name,
        capabilities: ['text-generation', 'conversation', 'vision'],
        maxTokens: 8192,
        contextWindow: 16384,
        pricing: {
          inputTokens: 0.25,
          outputTokens: 0.50
        }
      }
    ];
  }

  protected async performHealthCheck(): Promise<void> {
    if (!this.geminiSDK) {
      throw new Error('Gemini SDK not initialized');
    }

    try {
      // Make a simple request to verify API connectivity
      const model = await this.getModelInstance('gemini-pro');
      await model.generateContent('ping');
    } catch (error) {
      throw new Error(`Gemini health check failed: ${error.message}`);
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
    if (targetFormat === 'gemini') {
      return await this.converter.toGeminiFormat(request);
    } else if (targetFormat === 'openai') {
      return await this.converter.toOpenAIFormat(request);
    } else if (targetFormat === 'anthropic') {
      return await this.converter.toAnthropicFormat(request);
    }
    
    return super.convertRequest(request, targetFormat);
  }

  async convertResponse(response: any, sourceFormat: string): Promise<AIResponse> {
    if (sourceFormat === 'gemini') {
      return await this.parser.parseResponse(response);
    }
    
    return super.convertResponse(response, sourceFormat);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Method to get SDK instance for advanced usage
  getSDK(): GoogleGenerativeAI | undefined {
    return this.geminiSDK;
  }

  // Method to get model instance for advanced usage
  getModel(modelName: string): GenerativeModel | undefined {
    return this.models.get(modelName);
  }

  // Method to handle SDK-specific errors
  protected handleSDKError(error: any): any {
    // Google Generative AI SDK error handling
    if (error.message?.includes('API_KEY_INVALID')) {
      return {
        code: 'GEMINI_INVALID_API_KEY',
        message: 'Invalid Gemini API key',
        type: 'authentication',
        retryable: false,
        originalError: error
      };
    }

    if (error.message?.includes('QUOTA_EXCEEDED')) {
      return {
        code: 'GEMINI_QUOTA_EXCEEDED',
        message: 'Gemini API quota exceeded',
        type: 'rate-limit',
        retryable: true,
        retryAfter: 60000, // 1 minute
        originalError: error
      };
    }

    if (error.message?.includes('MODEL_NOT_FOUND')) {
      return {
        code: 'GEMINI_MODEL_NOT_FOUND',
        message: 'Gemini model not found',
        type: 'validation',
        retryable: false,
        originalError: error
      };
    }

    return this.handleError(error);
  }

  // Method to clear model cache
  clearModelCache(): void {
    this.models.clear();
  }

  // Method to get chat session for multi-turn conversations
  async getChatSession(modelName: string, history?: any[]): Promise<ChatSession> {
    const model = await this.getModelInstance(modelName);
    return model.startChat({ history: history || [] });
  }
}

console.log('✅ Gemini client loaded - using official SDK');