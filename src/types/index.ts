/**
 * RCC v4.0 核心类型定义
 * 
 * 统一的类型系统，确保整个项目的类型一致性
 * 
 * @author Jason Zhang
 */

// 基础类型定义
export interface RCCConfig {
  version: string;
  debug?: DebugConfig;
  server?: ServerConfig;
  providers?: ProviderConfig[];
  routing?: RoutingConfig;
  pipeline?: PipelineConfig;
}

export interface DebugConfig {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error';
  saveRequests: boolean;
  captureLevel: 'basic' | 'full';
}

export interface ServerConfig {
  port: number;
  host: string;
  cors?: {
    enabled: boolean;
    origins: string[];
  };
}

export interface ProviderConfig {
  id: string;
  name: string;
  protocol: 'openai' | 'anthropic' | 'gemini';
  baseUrl: string;
  apiKey: string;
  models: ModelConfig[];
  healthCheck?: HealthCheckConfig;
  rateLimit?: RateLimitConfig;
}

export interface ModelConfig {
  id: string;
  name: string;
  maxTokens: number;
  supportsFunctions: boolean;
  supportsStreaming: boolean;
}

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  endpoint: string;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute: number;
}

export interface RoutingConfig {
  strategy: 'weighted' | 'round-robin' | 'least-connections';
  categories: Record<string, CategoryConfig>;
}

export interface CategoryConfig {
  rules: RoutingRule[];
}

export interface RoutingRule {
  provider: string;
  model: string;
  weight: number;
}

export interface PipelineConfig {
  modules: Record<string, ModuleConfig>;
}

export interface ModuleConfig {
  enabled: boolean;
  [key: string]: any;
}

// 错误类型
export class RCCError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, any>;
  
  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message);
    this.name = 'RCCError';
    this.code = code;
    this.details = details;
  }
}

// 请求/响应类型
export interface StandardRequest {
  id: string;
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: Tool[];
  metadata?: RequestMetadata;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, any>;
  content?: string;
  tool_use_id?: string;
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface RequestMetadata {
  originalFormat: 'anthropic' | 'openai' | 'gemini';
  targetFormat: 'anthropic' | 'openai' | 'gemini';
  provider: string;
  category: string;
  debugEnabled?: boolean;
  captureLevel?: 'basic' | 'full';
  processingSteps?: string[];
}

export interface StandardResponse {
  id: string;
  choices: Choice[];
  usage?: Usage;
  model?: string;
  created?: number;
}

export interface Choice {
  index: number;
  message: Message;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// 模块接口类型
export interface ModuleInterface {
  id: string;
  name: string;
  version: string;
  type: ModuleType;
  process(input: any): Promise<any>;
  validate(input: any): Promise<ValidationResult>;
  getMetrics(): ModuleMetrics;
}

export type ModuleType = 
  | 'router'
  | 'input-transformer'
  | 'format-normalizer'
  | 'preprocessor'
  | 'protocol'
  | 'response-interceptor'
  | 'postprocessor'
  | 'output-transformer'
  | 'debug'
  | 'error-capture'
  | 'unit-test';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ModuleMetrics {
  processedRequests: number;
  averageProcessingTime: number;
  errorCount: number;
  lastProcessedAt?: Date;
}