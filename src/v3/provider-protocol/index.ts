/**
 * Provider-Protocol Layer - Six-Layer Architecture
 * 
 * This layer handles communication with different AI providers
 * and manages provider-specific protocols and authentication.
 */

export { 
  CodeWhispererProvider, 
  GeminiProvider, 
  AnthropicProvider 
} from './base-provider.js';

export { createOpenAIClient } from './openai/client-factory.js';