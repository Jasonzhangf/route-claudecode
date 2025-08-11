/**
 * MOCKUP IMPLEMENTATION - Anthropic Types
 * This is a placeholder implementation for Anthropic-specific types
 * All functionality is mocked and should be replaced with real implementations
 */

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContent[];
}

export interface AnthropicContent {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
  id?: string;
  name?: string;
  input?: any;
  content?: string;
  tool_use_id?: string;
}

export interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
  tools?: AnthropicTool[];
  mockup_indicator?: string;
}

export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContent[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  stop_sequence?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface AnthropicStreamChunk {
  type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop';
  message?: Partial<AnthropicResponse>;
  content_block?: {
    type: string;
    text?: string;
  };
  delta?: {
    type: string;
    text?: string;
    stop_reason?: string;
  };
  index?: number;
}

export interface AnthropicConfig {
  apiKey: string;
  baseURL?: string;
  defaultModel?: string;
  maxTokens?: number;
  temperature?: number;
  mockup_indicator?: string;
}

// MOCKUP INDICATOR
console.log('🔧 MOCKUP: Anthropic types loaded - placeholder implementation');