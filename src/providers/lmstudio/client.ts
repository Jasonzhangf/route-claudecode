/**
 * LM Studio Client
 * OpenAI-compatible local server implementation
 */

import { EnhancedOpenAIClient } from '../openai';
import { ProviderConfig } from '@/types';

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
}