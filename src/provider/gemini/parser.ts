/**
 * MOCKUP IMPLEMENTATION - Gemini Response Parser
 * This is a placeholder implementation for Gemini response parsing
 * All functionality is mocked and should be replaced with real implementations
 */

import { AIResponse } from '../../types/interfaces.js';

export class GeminiParser {
  constructor() {
    console.log('🔧 MOCKUP: GeminiParser initialized - placeholder implementation');
  }

  parseResponse(rawResponse: any): AIResponse {
    console.log('🔧 MOCKUP: Parsing Gemini response - placeholder implementation');
    
    const candidate = rawResponse.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || 'Mockup Gemini content';
    
    return {
      id: `gemini-parsed-${Date.now()}`,
      model: rawResponse.model || 'gemini-pro-mockup',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: content,
          metadata: {
            mockup_indicator: 'GEMINI_PARSED_RESPONSE'
          }
        },
        finishReason: this.parseFinishReason(candidate?.finishReason)
      }],
      usage: this.parseUsage(rawResponse.usageMetadata),
      metadata: {
        timestamp: new Date(),
        processingTime: 720,
        provider: 'gemini'
      }
    };
  }

  parseStreamingResponse(chunk: any): Partial<AIResponse> {
    console.log('🔧 MOCKUP: Parsing Gemini streaming chunk - placeholder implementation');
    
    const candidate = chunk.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || '';
    
    return {
      id: `gemini-stream-${Date.now()}`,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: content,
          metadata: {
            mockup_indicator: 'GEMINI_STREAMING_CHUNK'
          }
        },
        finishReason: candidate?.finishReason
      }]
    };
  }

  private parseFinishReason(finishReason: string): string {
    const reasonMap: Record<string, string> = {
      'STOP': 'stop',
      'MAX_TOKENS': 'length',
      'SAFETY': 'content_filter',
      'RECITATION': 'content_filter'
    };
    return reasonMap[finishReason] || 'stop';
  }

  private parseUsage(usageMetadata: any): any {
    return {
      promptTokens: usageMetadata?.promptTokenCount || 10,
      completionTokens: usageMetadata?.candidatesTokenCount || 15,
      totalTokens: usageMetadata?.totalTokenCount || 25
    };
  }
}

// MOCKUP INDICATOR
console.log('🔧 MOCKUP: Gemini parser loaded - placeholder implementation');