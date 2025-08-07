/**
 * OpenAI-Compatible Provider Module
 * SDK-only implementation for OpenAI-compatible APIs
 */

export { OpenAISDKClient, OpenAISDKConfig } from './sdk-client';
export { 
  OpenAIClientFactory, 
  OpenAIClientConfig, 
  ClientType,
  createOpenAIClient 
} from './client-factory';

// EnhancedOpenAIClient removed - using SDK-only architecture