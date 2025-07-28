/**
 * Core types and interfaces for Claude Code Router
 */

// Request types
export interface BaseRequest {
  model: string;
  messages: Array<{ role: string; content: any }>;
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  metadata?: {
    requestId: string;
    sessionId?: string;
    conversationId?: string;
    [key: string]: any;
  };
}

export interface AnthropicRequest extends BaseRequest {
  system?: Array<{ type: string; text: string }>;
  tools?: Array<{
    name: string;
    description: string;
    input_schema: Record<string, any>;
  }>;
  thinking?: boolean;
}

export interface OpenAIRequest extends BaseRequest {
  system?: string;
  tools?: Array<{
    type: string;
    function: {
      name: string;
      description: string;
      parameters: Record<string, any>;
    };
  }>;
}

// Response types
export interface BaseResponse {
  id?: string;
  type?: string;
  model: string;
  role: string;
  content: any[];
  stop_reason?: string;
  stop_sequence?: string | null;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AnthropicResponse extends BaseResponse {
  type: "message";
  stop_sequence?: string;
}

export interface OpenAIResponse extends BaseResponse {
  object: "chat.completion";
  created: number;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
}

// Routing types
export type RoutingCategory = 'default' | 'background' | 'thinking' | 'longcontext' | 'search';

export interface CategoryRouting {
  provider: string;
  model: string;
}

// Routing configuration is part of RouterConfig

// Legacy support - will be removed
export interface RoutingRule {
  category: RoutingCategory;
  condition: (request: BaseRequest) => boolean;
  provider: string;
  priority: number;
}

// Provider types
export interface ProviderConfig {
  type: 'codewhisperer' | 'shuaihong' | 'openai';
  endpoint: string;
  authentication: {
    type: 'bearer' | 'api_key';
    credentials: Record<string, string>;
  };
  settings: Record<string, any>;
  healthCheck?: {
    endpoint: string;
    interval: number;
  };
}

export interface ProviderInstance {
  id: string;
  config: ProviderConfig;
  status: 'active' | 'inactive' | 'error';
  lastCheck: Date;
  errorCount: number;
}

// Processor interfaces
export interface InputProcessor {
  name: string;
  canProcess(request: any): boolean;
  process(request: any): Promise<BaseRequest>;
  validate(request: any): boolean;
}

export interface OutputProcessor {
  name: string;
  canProcess(response: any, format: string): boolean;
  process(response: any, originalRequest: BaseRequest): Promise<BaseResponse>;
}

export interface Provider {
  name: string;
  type: string;
  config: ProviderConfig;
  isHealthy(): Promise<boolean>;
  sendRequest(request: BaseRequest): Promise<BaseResponse>;
  sendStreamRequest(request: BaseRequest): AsyncIterable<any>;
}

// Hook system types
export interface HookContext {
  requestId: string;
  stage: 'input' | 'routing' | 'provider' | 'output';
  timestamp: Date;
  data: any;
  metadata: Record<string, any>;
}

export interface Hook {
  name: string;
  stage: HookContext['stage'];
  priority: number;
  execute(context: HookContext): Promise<HookContext>;
}

// Configuration types
export interface RouterConfig {
  server: {
    port: number;
    host: string;
  };
  providers: Record<string, ProviderConfig>;
  routing: {
    [category: string]: {
      provider: string;
      model: string;
    };
  };
  debug: {
    enabled: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    traceRequests: boolean;
    saveRequests: boolean;
    logDir: string;
  };
  hooks: Hook[];
}

// Utility types
export interface RequestMetrics {
  requestId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  inputTokens: number;
  outputTokens: number;
  provider: string;
  success: boolean;
  error?: string;
}

export interface LoadBalancerState {
  providers: Record<string, ProviderInstance[]>;
  roundRobinIndex: Record<string, number>;
  healthStatus: Record<string, boolean>;
}

// Error types
export class RouterError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'RouterError';
  }
}

export class ProviderError extends RouterError {
  constructor(
    message: string,
    public provider: string,
    statusCode: number = 502,
    details?: any
  ) {
    super(message, 'PROVIDER_ERROR', statusCode, details);
    this.name = 'ProviderError';
  }
}

export class ValidationError extends RouterError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}