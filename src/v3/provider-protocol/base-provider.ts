/**
 * V3.0 Base Provider Implementation - Clean Architecture
 * 
 * LM Studio is now handled as an OpenAI-compatible provider with preprocessor
 * instead of a separate provider class. This follows proper separation of concerns.
 * 
 * Project owner: Jason Zhang
 */

import { Provider, BaseRequest, BaseResponse, ProviderConfig } from '../types/index.js';

export abstract class BaseProvider implements Provider {
  public readonly id: string;
  public readonly type: string;
  public readonly name: string;
  protected config: ProviderConfig;

  constructor(id: string, config: ProviderConfig) {
    this.id = id;
    this.type = config.type;
    this.name = config.name;
    this.config = config;
    
    console.log(`🔧 V3 ${this.type} provider initialized: ${this.id}`);
  }

  abstract isHealthy(): Promise<boolean>;
  abstract sendRequest(request: BaseRequest): Promise<BaseResponse>;
  
  // Legacy method for backward compatibility
  async processRequest(request: BaseRequest, requestId: string): Promise<BaseResponse> {
    return this.sendRequest(request);
  }

  protected createErrorResponse(request: BaseRequest, error: string): BaseResponse {
    return {
      id: `msg-${this.type}-error-${Date.now()}`,
      type: 'message',
      role: 'assistant',
      content: [{
        type: 'text',
        text: `Error from ${this.type} provider: ${error}`
      }],
      model: request.model,
      stop_reason: 'error',
      usage: {
        input_tokens: 0,
        output_tokens: 0
      }
    };
  }
}

// Mock provider implementations for V3 - these are placeholders
export class CodeWhispererProvider extends BaseProvider {
  private client: any;

  constructor(config: ProviderConfig, id: string) {
    super(id, config);
    this.initializeCodewhispererClient(config, id);
  }

  private async initializeCodewhispererClient(config: ProviderConfig, id: string) {
    try {
      // 动态导入CodeWhisperer客户端工厂
      const { CodewhispererClientFactory } = await import('./codewhisperer/client-factory.js');
      
      // 创建CodeWhisperer客户端
      this.client = CodewhispererClientFactory.createValidatedClient(config, id);
      
      console.log(`[V3:${process.env.RCC_PORT}] Initialized CodeWhisperer provider ${id}`, {
        type: config.type,
        endpoint: config.endpoint || 'https://codewhisperer.us-east-1.amazonaws.com'
      });
    } catch (error) {
      console.error(`Failed to initialize CodeWhisperer provider ${id}:`, error.message);
      throw error;
    }
  }
  
  async isHealthy(): Promise<boolean> {
    try {
      if (this.client && typeof this.client.healthCheck === 'function') {
        const health = await this.client.healthCheck();
        return health.healthy;
      }
      return false;
    } catch (error) {
      console.warn(`CodeWhisperer provider ${this.id} health check failed:`, error.message);
      return false;
    }
  }
  
  async sendRequest(request: BaseRequest): Promise<BaseResponse> {
    try {
      // Provider层只负责API通信，不做transformer转换
      // 转换应该在transformer层完成
      const context = {
        requestId: request.metadata?.requestId || `req_${Date.now()}`,
        providerId: this.id,
        config: this.config
      };
      
      // 直接发送到CodeWhisperer API（假设request已经被transformer转换过）
      const response = await this.client.sendRequest(request, context);
      return response;
    } catch (error) {
      console.error(`CodeWhisperer provider ${this.id} request failed:`, error.message);
      return this.createErrorResponse(request, error.message);
    }
  }
  
  async *sendStreamRequest?(request: BaseRequest): AsyncIterable<any> {
    try {
      const context = {
        requestId: request.metadata?.requestId || `req_${Date.now()}`,
        providerId: this.id,
        config: this.config
      };
      
      // 发送流式请求
      const stream = this.client.sendStreamRequest(request, context);
      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error) {
      console.error(`CodeWhisperer provider ${this.id} stream request failed:`, error.message);
      throw error;
    }
  }
}

export class GeminiProvider extends BaseProvider {
  private client: any;
  
  constructor(config: ProviderConfig, id: string) {
    super(id, config);
    this.initializeGeminiClient(config, id);
  }
  
  private async initializeGeminiClient(config: ProviderConfig, id: string) {
    try {
      // 动态导入Gemini客户端工厂，使用支持apiKeys数组的函数
      const { createGeminiClient } = await import('./gemini/client-factory.js');
      
      // 创建Gemini客户端，支持多API密钥
      this.client = createGeminiClient(config, id);
      
      console.log(`[V3:${process.env.RCC_PORT}] Initialized Gemini provider ${id}`, {
        type: config.type,
        endpoint: config.endpoint || 'https://generativelanguage.googleapis.com'
      });
      
    } catch (error) {
      console.error(`Failed to initialize Gemini provider ${id}:`, error.message);
      throw error;
    }
  }
  
  async isHealthy(): Promise<boolean> {
    try {
      if (this.client && typeof this.client.healthCheck === 'function') {
        const health = await this.client.healthCheck();
        return health.healthy;
      }
      return false;
    } catch (error) {
      console.warn(`Gemini provider ${this.id} health check failed:`, error.message);
      return false;
    }
  }
  
  async sendRequest(request: BaseRequest): Promise<BaseResponse> {
    try {
      // Provider层只负责API通信，不做transformer转换
      // 转换应该在transformer层完成
      const context = {
        requestId: request.metadata?.requestId || `req_${Date.now()}`,
        providerId: this.id,
        config: this.config
      };
      
      // 直接发送到Gemini API（假设request已经被transformer转换过）
      const response = await this.client.sendRequest(request, context);
      
      return response;
      
    } catch (error) {
      console.error(`Gemini provider ${this.id} request failed:`, error.message);
      return this.createErrorResponse(request, error.message);
    }
  }
  
  async *sendStreamRequest?(request: BaseRequest): AsyncIterable<any> {
    try {
      const context = {
        requestId: request.metadata?.requestId || `req_${Date.now()}`,
        providerId: this.id,
        config: this.config
      };
      
      // 发送流式请求
      const stream = this.client.sendStreamRequest(request, context);
      
      for await (const chunk of stream) {
        yield chunk;
      }
      
    } catch (error) {
      console.error(`Gemini provider ${this.id} stream request failed:`, error.message);
      throw error;
    }
  }
}

export class AnthropicProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super('anthropic', config);
  }
  
  async isHealthy(): Promise<boolean> { 
    return false; // Not implemented yet
  }
  
  async sendRequest(request: BaseRequest): Promise<BaseResponse> {
    throw new Error('Anthropic provider not implemented yet');
  }
  
  async *sendStreamRequest?(request: BaseRequest): AsyncIterable<any> {
    throw new Error('Anthropic stream provider not implemented yet');
  }
}

// NOTE: LMStudioClient has been removed - LM Studio is now handled as:
// 1. OpenAI-compatible provider (uses createOpenAIClient)  
// 2. Special preprocessing via LMStudioToolCompatibility preprocessor
// This follows proper separation of concerns and allows unlimited OpenAI-compatible providers