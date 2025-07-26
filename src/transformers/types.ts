/**
 * Message Format Transformers
 * Handles conversion between different LLM API formats
 */

export interface UnifiedMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | UnifiedContent[];
  tool_calls?: UnifiedToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface UnifiedContent {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  tool_use_id?: string;
  id?: string;
  name?: string;
  input?: any;
  content?: string | any;
}

export interface UnifiedToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface UnifiedTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export interface UnifiedRequest {
  messages: UnifiedMessage[];
  model: string;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  tools?: UnifiedTool[];
  tool_choice?: string | { type: string; name?: string };
  system?: string;
}

export interface UnifiedResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: UnifiedToolCall[];
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface StreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string;
  }>;
}

export interface MessageTransformer {
  name: string;
  
  // Convert from provider format to unified format
  transformRequestToUnified(request: any): UnifiedRequest;
  
  // Convert from unified format to provider format
  transformRequestFromUnified(request: UnifiedRequest): any;
  
  // Convert provider response to unified format
  transformResponseToUnified(response: any): UnifiedResponse;
  
  // Convert unified response to provider format
  transformResponseFromUnified(response: UnifiedResponse): any;
  
  // Handle streaming conversion
  transformStreamChunk?(chunk: any): StreamChunk | null;
}

export interface TransformationContext {
  sourceProvider: 'openai' | 'anthropic' | 'unified';
  targetProvider: 'openai' | 'anthropic' | 'unified';
  preserveToolCalls?: boolean;
  preserveSystemMessages?: boolean;
}