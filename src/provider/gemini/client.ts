/**
 * MOCKUP IMPLEMENTATION - Gemini Client
 * This is a placeholder implementation for the Gemini client
 * All functionality is mocked and should be replaced with real implementations
 */

import { BaseProvider } from '../base-provider.js';
import { AIRequest, AIResponse } from '../../types/interfaces.js';

export class GeminiClient extends BaseProvider {
  constructor(apiKey?: string) {
    super('gemini', 'https://generativelanguage.googleapis.com/v1', apiKey);
  }

  async processRequest(request: AIRequest): Promise<AIResponse> {
    console.log('🔧 MOCKUP: GeminiClient processing request - placeholder implementation');
    
    // MOCKUP: Simulate Gemini-specific processing
    const response = this.createMockupResponse(request);
    response.choices[0].message.content = `[GEMINI MOCKUP] ${response.choices[0].message.content}`;
    response.metadata.provider = 'gemini';
    
    return response;
  }
}

// MOCKUP INDICATOR
console.log('🔧 MOCKUP: Gemini client loaded - placeholder implementation');