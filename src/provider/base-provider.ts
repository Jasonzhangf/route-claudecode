/**
 * MOCKUP IMPLEMENTATION - Base Provider
 * This is a placeholder implementation for the base provider functionality
 * All functionality is mocked and should be replaced with real implementations
 */

import { 
  ProviderClient, 
  AIRequest, 
  AIResponse, 
  ProviderHealth, 
  AuthResult, 
  ModelInfo 
} from '../types/interfaces.js';

export abstract class BaseProvider implements ProviderClient {
  protected name: string;
  protected version: string;
  protected endpoint: string;
  protected apiKey?: string;

  constructor(name: string, endpoint: string, apiKey?: string) {
    this.name = name;
    this.version = '1.0.0-mockup';
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    
    console.log(`🔧 MOCKUP: ${name} provider initialized - placeholder implementation`);
  }

  abstract processRequest(request: AIRequest): Promise<AIResponse>;

  async healthCheck(): Promise<ProviderHealth> {
    console.log(`🔧 MOCKUP: ${this.name} health check - placeholder implementation`);
    
    return {
      status: 'healthy',
      latency: Math.random() * 100 + 50, // 50-150ms mockup latency
      errorRate: 0,
      lastCheck: new Date()
    };
  }

  async authenticate(): Promise<AuthResult> {
    console.log(`🔧 MOCKUP: ${this.name} authentication - placeholder implementation`);
    
    if (!this.apiKey) {
      return {
        success: false,
        error: 'No API key provided'
      };
    }

    return {
      success: true,
      token: `mockup-token-${this.name}-${Date.now()}`,
      expiresAt: new Date(Date.now() + 3600000) // 1 hour from now
    };
  }

  async getModels(): Promise<ModelInfo[]> {
    console.log(`🔧 MOCKUP: ${this.name} getting models - placeholder implementation`);
    
    return [
      {
        id: `${this.name}-model-1`,
        name: `${this.name} Model 1`,
        provider: this.name,
        capabilities: ['text-generation', 'conversation']
      },
      {
        id: `${this.name}-model-2`,
        name: `${this.name} Model 2`,
        provider: this.name,
        capabilities: ['text-generation', 'conversation', 'tool-calling']
      }
    ];
  }

  protected createMockupResponse(request: AIRequest): AIResponse {
    return {
      id: `mockup-response-${Date.now()}`,
      model: request.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: `This is a mockup response from ${this.name} provider for model ${request.model}`
        },
        finishReason: 'stop'
      }],
      usage: {
        promptTokens: request.messages.reduce((acc, msg) => acc + msg.content.length / 4, 0),
        completionTokens: 25,
        totalTokens: 0
      },
      metadata: {
        timestamp: new Date(),
        processingTime: Math.random() * 1000 + 500, // 500-1500ms
        provider: this.name
      }
    };
  }
}

// MOCKUP INDICATOR
console.log('🔧 MOCKUP: BaseProvider class loaded - placeholder implementation');