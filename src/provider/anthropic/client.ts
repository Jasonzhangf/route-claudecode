/**
 * MOCKUP IMPLEMENTATION - Anthropic Client
 * This is a placeholder implementation for the Anthropic client
 * All functionality is mocked and should be replaced with real implementations
 */

import { BaseProvider } from '../base-provider.js';
import { AIRequest, AIResponse } from '../../types/interfaces.js';

export class AnthropicClient extends BaseProvider {
  constructor(apiKey?: string) {
    super('anthropic', 'https://api.anthropic.com/v1', apiKey);
  }

  async processRequest(request: AIRequest): Promise<AIResponse> {
    console.log('🔧 MOCKUP: AnthropicClient processing request - placeholder implementation');
    
    // MOCKUP: Simulate Anthropic-specific processing
    const response = this.createMockupResponse(request);
    response.choices[0].message.content = `[ANTHROPIC MOCKUP] ${response.choices[0].message.content}`;
    response.metadata.provider = 'anthropic';
    
    return response;
  }
}

// MOCKUP INDICATOR
console.log('🔧 MOCKUP: Anthropic client loaded - placeholder implementation');