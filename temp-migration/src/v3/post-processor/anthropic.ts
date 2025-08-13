/**
 * V3.0 Anthropic Output Processor
 * Handles response formatting to Anthropic-compatible format
 * 
 * Project owner: Jason Zhang
 */

import { BaseResponse } from '../types/index.js';

export class AnthropicOutputProcessor {
  private port: number;

  constructor(port: number) {
    this.port = port;
    console.log(`📤 V3 AnthropicOutputProcessor initialized for port ${port}`);
  }

  async process(response: any, request?: any): Promise<BaseResponse> {
    return this.processResponse(response, 'default');
  }

  async processResponse(response: any, requestId: string): Promise<BaseResponse> {
    // Convert any response format to Anthropic format
    const anthropicResponse: BaseResponse = {
      id: response.id || `msg-v3-${Date.now()}`,
      type: 'message',
      role: 'assistant',
      content: this.normalizeContent(response),
      model: response.model || 'v3-default',
      stop_reason: response.stop_reason || 'end_turn',
      usage: response.usage || {
        input_tokens: 0,
        output_tokens: 0
      }
    };

    console.log('📤 V3 Output processed:', {
      id: anthropicResponse.id,
      model: anthropicResponse.model,
      contentLength: JSON.stringify(anthropicResponse.content).length
    });

    return anthropicResponse;
  }

  private normalizeContent(response: any): any[] {
    if (response.content && Array.isArray(response.content)) {
      return response.content;
    }
    
    if (response.choices && Array.isArray(response.choices)) {
      // OpenAI format conversion
      const choice = response.choices[0];
      if (choice?.message?.content) {
        return [{
          type: 'text',
          text: choice.message.content
        }];
      }
    }
    
    if (typeof response === 'string') {
      return [{
        type: 'text',
        text: response
      }];
    }
    
    // Default fallback
    return [{
      type: 'text',
      text: 'V3 response processed successfully'
    }];
  }
}