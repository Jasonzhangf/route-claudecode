/**
 * V3.0 Type Definitions
 * Six-layer architecture types
 * 
 * Project owner: Jason Zhang
 */

// Base request and response interfaces
export interface BaseRequest {
  model: string;
  max_tokens?: number;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  tools?: any[];
  stream?: boolean;
  metadata?: any;
}

export interface BaseResponse {
  id: string;
  type: string;
  role: string;
  content: any[];
  model: string;
  stop_reason: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

// Provider configuration
export interface ProviderConfig {
  type: 'codewhisperer' | 'gemini' | 'openai' | 'anthropic' | 'lmstudio' | 'shuaihong';
  name: string;
  endpoint: string;
  authentication: {
    type: string;
    credentials: any;
  };
  models: string[];
  defaultModel: string;
  preprocessing?: {
    enabled: boolean;
    preprocessorClass: string;
  };
  settings?: any;
  timeout?: number;
  maxTokens?: any;
  keyRotation?: any;
  maxRetries?: number;
  retryDelay?: number;
}

// Routing types
export type RoutingCategory = 'default' | 'background' | 'thinking' | 'longcontext' | 'search';

export interface CategoryRouting {
  provider?: string;
  model?: string;
  providers?: Array<{
    provider: string;
    model: string;
    weight?: number;
  }>;
  backup?: string[];
}

export interface RouterConfig {
  name?: string;
  server: {
    port: number;
    host: string;
    architecture?: string;
  };
  providers: Record<string, ProviderConfig>;
  routing: {
    strategy?: string;
    loadBalancing?: {
      algorithm: string;
    };
    categories?: Record<RoutingCategory, CategoryRouting>;
  } | Record<RoutingCategory, CategoryRouting>;
  hooks?: any[];
  layers?: Record<string, any>;
  debug: {
    enabled: boolean;
    logLevel: string;
    logDir?: string;
    traceRequests?: boolean;
    saveRequests?: boolean;
  };
}

// Provider interfaces
export interface Provider {
  id?: string;
  type?: string;
  name: string;
  isHealthy(): Promise<boolean>;
  sendRequest(request: BaseRequest): Promise<BaseResponse>;
  sendStreamRequest?(request: BaseRequest): AsyncIterable<any>;
}

// Error types
export class ProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

// Health monitoring
export interface ProviderHealth {
  providerId: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastChecked: Date;
  consecutiveFailures: number;
  responseTimeMs: number;
}

export interface FailoverTrigger {
  type: 'error_rate' | 'response_time' | 'consecutive_failures';
  threshold: number;
  windowMs: number;
}

export interface ProviderEntry {
  provider: string;
  model: string;
  weight?: number;
}

export interface LoadBalancingConfig {
  algorithm: 'round-robin' | 'weighted-round-robin' | 'random';
  healthCheckEnabled: boolean;
  failoverEnabled: boolean;
}

export interface FailoverConfig {
  enabled: boolean;
  triggers: FailoverTrigger[];
  backupProviders: string[];
}