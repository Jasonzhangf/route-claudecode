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
  constructor(id: string, config?: ProviderConfig) {
    super(id, config || { 
      type: 'codewhisperer', 
      name: 'CodeWhisperer Provider',
      endpoint: 'https://codewhisperer.us-east-1.amazonaws.com',
      defaultModel: 'CLAUDE_SONNET_4',
      authentication: { type: 'bearer', credentials: {} },
      models: ['CLAUDE_SONNET_4']
    });
  }
  
  async isHealthy(): Promise<boolean> { 
    return false; // Not implemented yet
  }
  
  async sendRequest(request: BaseRequest): Promise<BaseResponse> {
    throw new Error('CodeWhisperer provider not implemented yet');
  }
  
  async *sendStreamRequest?(request: BaseRequest): AsyncIterable<any> {
    throw new Error('CodeWhisperer stream provider not implemented yet');
  }
}

export class GeminiProvider extends BaseProvider {
  constructor(config: ProviderConfig, id: string) {
    super(id, config);
    // Use real Gemini client when available
    // this.client = createGeminiClient(config, id);
  }
  
  async isHealthy(): Promise<boolean> { 
    return false; // Not implemented yet
  }
  
  async sendRequest(request: BaseRequest): Promise<BaseResponse> {
    throw new Error('Gemini provider not implemented yet');
  }
  
  async *sendStreamRequest?(request: BaseRequest): AsyncIterable<any> {
    throw new Error('Gemini stream provider not implemented yet');
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