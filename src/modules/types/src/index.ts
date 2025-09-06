/**
 * Types Module
 */
export const TYPES_MODULE_VERSION = '4.0.0-alpha.2';

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
  modules: Record<string, any>;
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
  // 扩展属性以支持不同协议
  topP?: number;
  system?: string;
  stopSequences?: string[];
  toolChoice?: any;
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

export interface TypesModuleInterface {
  version: string;
}

export class TypesModule {
  // Types模块主要是类型定义，不需要实际的实现
}

export function createTypesModule(): TypesModule {
  return new TypesModule();
}

// Error Types for RCC4
export enum RCCErrorCode {
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_MISSING = 'CONFIG_MISSING',
  CONFIG_PARSE_ERROR = 'CONFIG_PARSE_ERROR',
  ROUTER_INVALID_ROUTE = 'ROUTER_INVALID_ROUTE',
  ROUTER_NO_PROVIDER = 'ROUTER_NO_PROVIDER',
  ROUTER_CONFIG_ERROR = 'ROUTER_CONFIG_ERROR',
  PIPELINE_ASSEMBLY_FAILED = 'PIPELINE_ASSEMBLY_FAILED',
  PIPELINE_EXECUTION_FAILED = 'PIPELINE_EXECUTION_FAILED',
  PIPELINE_MODULE_MISSING = 'PIPELINE_MODULE_MISSING',
  SERVER_START_FAILED = 'SERVER_START_FAILED',
  SERVER_PORT_IN_USE = 'SERVER_PORT_IN_USE',
  SERVER_CONFIG_INVALID = 'SERVER_CONFIG_INVALID',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  PROVIDER_AUTH_FAILED = 'PROVIDER_AUTH_FAILED',
  PROVIDER_RATE_LIMITED = 'PROVIDER_RATE_LIMITED',
  MODULE_INIT_FAILED = 'MODULE_INIT_FAILED',
  MODULE_NOT_FOUND = 'MODULE_NOT_FOUND',
  MODULE_CONNECTION_FAILED = 'MODULE_CONNECTION_FAILED',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_CONNECTION_FAILED = 'NETWORK_CONNECTION_FAILED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface ErrorContext {
  module?: string;
  operation?: string;
  requestId?: string;
  timestamp?: Date;
  details?: Record<string, any>;
  pipelineId?: string;
  moduleId?: string;
  layerName?: string;
  provider?: string;
  model?: string;
  attemptNumber?: number;
  maxAttempts?: number;
  metadata?: Record<string, any>;
}

export class RCCError extends Error {
  public readonly code: RCCErrorCode;
  public readonly module: string;
  public readonly context: ErrorContext;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: RCCErrorCode = RCCErrorCode.UNKNOWN_ERROR,
    module: string = 'UNKNOWN',
    context: ErrorContext = {}
  ) {
    super(message);
    this.name = 'RCCError';
    this.code = code;
    this.module = module;
    this.timestamp = new Date();
    this.context = {
      ...context,
      timestamp: this.timestamp
    };

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RCCError);
    }
  }

  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      module: this.module,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack
    };
  }

  toString(): string {
    return `[${this.code}] ${this.module}: ${this.message}`;
  }
}

// 额外的类型定义以支持编译
export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter';

export interface AssistantMessage {
  role: 'assistant';
  content: string;
  tool_calls?: any[];
}

export interface IValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
}

// Provider相关的超时设置类型
export interface ProviderTimeouts {
  request?: number;
  response?: number;
  connection?: number;
}

// 用于获取Provider请求超时的函数类型
export type GetProviderRequestTimeout = (provider: string) => number;