/**
 * MOCKUP IMPLEMENTATION - Gemini Authentication
 * This is a placeholder implementation for Gemini authentication
 * All functionality is mocked and should be replaced with real implementations
 */

import { AuthResult } from '../../types/interfaces.js';

export class GeminiAuth {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
    console.log('🔧 MOCKUP: GeminiAuth initialized - placeholder implementation');
  }

  async authenticate(): Promise<AuthResult> {
    console.log('🔧 MOCKUP: GeminiAuth authenticating - placeholder implementation');
    
    if (!this.apiKey) {
      return {
        success: false,
        error: 'No Gemini API key provided'
      };
    }

    // MOCKUP: Gemini uses API key directly
    return {
      success: true,
      token: this.apiKey
    };
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  isValid(): boolean {
    return !!this.apiKey;
  }
}

// MOCKUP INDICATOR
console.log('🔧 MOCKUP: Gemini auth loaded - placeholder implementation');