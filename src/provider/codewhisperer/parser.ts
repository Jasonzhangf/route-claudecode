/**
 * MOCKUP IMPLEMENTATION - CodeWhisperer Response Parser
 * This is a placeholder implementation for CodeWhisperer response parsing
 * All functionality is mocked and should be replaced with real implementations
 */

import { AIResponse } from '../../types/interfaces.js';

export class CodeWhispererParser {
  constructor() {
    console.log('🔧 MOCKUP: CodeWhispererParser initialized - placeholder implementation');
  }

  parseResponse(rawResponse: any): AIResponse {
    console.log('🔧 MOCKUP: Parsing CodeWhisperer response - placeholder implementation');
    
    return {
      id: rawResponse.conversationId || `codewhisperer-parsed-${Date.now()}`,
      model: 'codewhisperer-mockup',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: rawResponse.message?.utterance || 'Mockup CodeWhisperer content',
          metadata: {
            mockup_indicator: 'CODEWHISPERER_PARSED_RESPONSE'
          }
        },
        finishReason: 'stop'
      }],
      usage: this.parseUsage(rawResponse.usage),
      metadata: {
        timestamp: new Date(),
        processingTime: 850,
        provider: 'codewhisperer'
      }
    };
  }

  parseStreamingResponse(chunk: any): Partial<AIResponse> {
    console.log('🔧 MOCKUP: Parsing CodeWhisperer streaming chunk - placeholder implementation');
    
    return {
      id: chunk.conversationId || `codewhisperer-stream-${Date.now()}`,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: chunk.message?.utterance || '',
          metadata: {
            mockup_indicator: 'CODEWHISPERER_STREAMING_CHUNK'
          }
        }
      }]
    };
  }

  private parseUsage(usage: any): any {
    return {
      promptTokens: usage?.inputTokens || 10,
      completionTokens: usage?.outputTokens || 15,
      totalTokens: (usage?.inputTokens || 10) + (usage?.outputTokens || 15)
    };
  }
}

// MOCKUP INDICATOR
console.log('🔧 MOCKUP: CodeWhisperer parser loaded - placeholder implementation');