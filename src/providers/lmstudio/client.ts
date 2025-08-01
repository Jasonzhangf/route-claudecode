/**
 * LM Studio Client
 * OpenAI-compatible local server implementation with enhanced tool call support
 */

import { EnhancedOpenAIClient } from '../openai';
import { ProviderConfig } from '@/types';
import { logger } from '@/utils/logger';

export class LMStudioClient extends EnhancedOpenAIClient {
  constructor(config: ProviderConfig, providerId: string) {
    // Update the endpoint to the standard LM Studio endpoint if not already set
    const lmStudioConfig = { ...config };
    if (!lmStudioConfig.endpoint) {
      lmStudioConfig.endpoint = 'http://localhost:1234/v1';
    }
    
    // For LM Studio, we don't need authentication (type: "none")
    if (!lmStudioConfig.authentication) {
      lmStudioConfig.authentication = {
        type: 'none'
      };
    }
    
    super(lmStudioConfig, providerId);
  }

  /**
   * Check if LM Studio is healthy by testing the /models endpoint
   */
  async isHealthy(): Promise<boolean> {
    try {
      // For LM Studio, we test the /models endpoint to check if it's running
      const response = await this.httpClient.get('/models');
      return response.status === 200;
    } catch (error) {
      // If we can't connect, LM Studio is not running
      return false;
    }
  }

  /**
   * Override sendRequest to ensure proper session state handling
   */
  async sendRequest(request: any): Promise<any> {
    // Ensure tools are properly formatted for LM Studio
    if (request.metadata?.tools) {
      // LM Studio expects tools in OpenAI format
      request.tools = request.metadata.tools;
    }
    
    return super.sendRequest(request);
  }

  /**
   * Override sendStreamRequest to ensure proper session state handling
   */
  async *sendStreamRequest(request: any): AsyncIterable<any> {
    // Ensure tools are properly formatted for LM Studio
    if (request.metadata?.tools) {
      // LM Studio expects tools in OpenAI format
      request.tools = request.metadata.tools;
    }
    
    // Use the enhanced streaming from parent class
    yield* super.sendStreamRequest(request);
  }
}