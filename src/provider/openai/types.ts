/**
 * MOCKUP IMPLEMENTATION - OpenAI Types
 * This is a placeholder implementation for OpenAI-specific types
 * All functionality is mocked and should be replaced with real implementations
 */

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: OpenAITool[];
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
  mockup_indicator?: string;
}

export interface OpenAIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  system_fingerprint?: string;
}

export interface OpenAIChoice {
  index: number;
  message: OpenAIMessage;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'function_call';
  logprobs?: any;
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface OpenAIStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Partial<OpenAIToolCall>[];
    };
    finish_reason?: string;
  }[];
  system_fingerprint?: string;
}

export interface OpenAIConfig {
  apiKey: string;
  organizationId?: string;
  baseURL?: string;
  defaultModel?: string;
  maxTokens?: number;
  temperature?: number;
  mockup_indicator?: string;
}

// MOCKUP INDICATOR
console.log('🔧 MOCKUP: OpenAI types loaded - placeholder implementation');