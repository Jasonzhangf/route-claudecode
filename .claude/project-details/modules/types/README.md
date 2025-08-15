# 核心类型定义模块

## 模块概述

核心类型定义模块提供RCC v4.0系统中所有模块共享的类型定义，确保类型安全和接口一致性。

## 目录结构

```
src/types/
├── README.md                    # 类型定义模块文档
├── index.ts                     # 类型定义入口
├── core-types.ts                # 核心类型定义
├── request-response-types.ts    # 请求响应类型
├── pipeline-types.ts            # 流水线相关类型
├── config-types.ts              # 配置相关类型
├── error-types.ts               # 错误相关类型
├── debug-types.ts               # Debug相关类型
└── ai-service-types/            # AI服务类型定义
    ├── openai-types.ts          # OpenAI类型
    ├── anthropic-types.ts       # Anthropic类型
    ├── gemini-types.ts          # Gemini类型
    └── common-types.ts          # 通用AI服务类型
```

## 核心类型定义

### 基础类型
```typescript
// src/types/core-types.ts

export type RequestId = string;
export type Timestamp = number;
export type ModuleName = string;
export type ProviderName = string;
export type ModelName = string;

export interface BaseEntity {
  id: string;
  timestamp: Timestamp;
}

export interface Identifiable {
  id: string;
}

export interface Timestamped {
  timestamp: Timestamp;
}

export interface Versioned {
  version: string;
}
```

### 请求响应类型
```typescript
// src/types/request-response-types.ts

export interface RCCRequest extends BaseEntity {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: any;
  requestId: RequestId;
  sessionId?: string;        // 会话ID，用于流控管理
  conversationId?: string;   // 对话ID，用于请求顺序管控
}

export interface RCCResponse extends BaseEntity {
  status: number;
  headers: Record<string, string>;
  body: any;
  requestId: RequestId;
  duration?: number;
}

export interface StreamRequest extends RCCRequest {
  stream: true;
}

export interface NonStreamRequest extends RCCRequest {
  stream?: false;
}

export interface StreamResponse extends RCCResponse {
  chunks: StreamChunk[];
  metadata: StreamMetadata;
}

export interface StreamChunk {
  id: string;
  data: any;
  timestamp: Timestamp;
}

export interface StreamMetadata {
  totalChunks: number;
  startTime: Timestamp;
  endTime?: Timestamp;
}
```

### 流水线类型
```typescript
// src/types/pipeline-types.ts

export enum PipelineStatus {
  PENDING = 'PENDING',
  CREATING = 'CREATING',
  ACTIVE = 'ACTIVE',
  PROCESSING = 'PROCESSING',
  INACTIVE = 'INACTIVE',
  DESTROYING = 'DESTROYING',
  DESTROYED = 'DESTROYED',
  FAILED = 'FAILED',
  RETRY = 'RETRY'
}

export interface Pipeline extends BaseEntity {
  provider: ProviderName;
  model: ModelName;
  status: PipelineStatus;
  modules: PipelineModule[];
  config: PipelineConfig;
  healthStatus: HealthStatus;
}

export interface PipelineModule {
  name: ModuleName;
  version: string;
  process(input: any): Promise<any>;
  validate(input: any): boolean;
  getSchema(): ValidationSchema;
}

export interface PipelineConfig {
  provider: ProviderName;
  model: ModelName;
  timeout: number;
  retryCount: number;
  healthCheckInterval: number;
}

export interface HealthStatus {
  isHealthy: boolean;
  lastCheck: Timestamp;
  consecutiveFailures: number;
  error?: string;
}

export interface ValidationSchema {
  type: string;
  properties: Record<string, any>;
  required: string[];
}
```

### 配置类型
```typescript
// src/types/config-types.ts

export interface ProviderConfig {
  name: ProviderName;
  protocol: string;
  baseUrl: string;
  serverType: string;
  models: ModelName[];
  availability: boolean;
  
  // 单密钥配置（向后兼容）
  apiKey?: string;
  
  // 多密钥配置（负载均衡）
  apiKeys?: ApiKeyConfig[];
  
  // 负载均衡配置
  loadBalance?: LoadBalanceConfig;
  
  // 特殊配置
  authType?: 'bearer' | 'oauth2' | 'aws-iam';
  projectId?: string;
  region?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface ApiKeyConfig {
  keyId: string;
  key: string;
  weight: number;
  rateLimits?: RateLimits;
  quotaLimits?: QuotaLimits;
  status: 'active' | 'suspended' | 'rate_limited';
}

export interface RateLimits {
  requestsPerMinute: number;
  requestsPerHour?: number;
  tokensPerDay?: number;
}

export interface QuotaLimits {
  dailyQuota: number;
  monthlyQuota: number;
}

export interface LoadBalanceConfig {
  keySelectionStrategy: 'round_robin' | 'least_used' | 'quota_aware' | 'error_rate_aware';
  rotationPolicy: RotationPolicy;
}

export interface RotationPolicy {
  rotateOnError: boolean;
  rotateOnRateLimit: boolean;
  rotateOnQuotaExceeded: boolean;
  cooldownPeriod: number;
}

export interface RoutingConfig {
  routes: RouteConfig[];
}

export interface RouteConfig {
  category: RequestCategory;
  rules: RoutingRule[];
  loadBalance?: RouteLoadBalanceConfig;
}

export type RequestCategory = 'default' | 'think' | 'longContext' | 'background' | 'code' | 'webSearch';

export interface RoutingRule {
  provider: ProviderName;
  model: ModelName;
  weight: number;
  priority?: number;
  costPerToken?: number;
  capabilities?: string[];
}

export interface RouteLoadBalanceConfig {
  strategy: 'weighted_round_robin' | 'least_connections' | 'response_time_based' | 'health_aware';
  failoverEnabled: boolean;
  healthCheckInterval: number;
  maxRetries: number;
}

export interface GeneratedRoutingTable {
  timestamp: Timestamp;
  routes: GeneratedRoute[];
}

export interface GeneratedRoute {
  category: RequestCategory;
  pipelines: GeneratedPipeline[];
}

export interface GeneratedPipeline {
  id: string;
  provider: ProviderName;
  model: ModelName;
  weight: number;
  isActive: boolean;
}

export interface GlobalConfig {
  server: ServerConfig;
  debug: DebugConfig;
  logging: LoggingConfig;
  loadBalance: GlobalLoadBalanceConfig;
}

export interface ServerConfig {
  defaultPort: number;
  host: string;
  timeout: number;
  maxConcurrentRequests: number;
}

export interface DebugConfig {
  enabled: boolean;
  maxRecordSize: number;
  retentionDays: number;
  compressionEnabled: boolean;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  maxFileSize: string;
  maxFiles: number;
  enableConsole: boolean;
}

export interface GlobalLoadBalanceConfig {
  healthCheckEnabled: boolean;
  healthCheckInterval: number;
  failureThreshold: number;
  recoveryThreshold: number;
  circuitBreakerEnabled: boolean;
  circuitBreakerTimeout: number;
  backoffStrategy: 'linear' | 'exponential';
  maxBackoffTime: number;
}
```

### 错误类型
```typescript
// src/types/error-types.ts

export enum ErrorType {
  CLIENT_ERROR = 'CLIENT_ERROR',
  ROUTER_ERROR = 'ROUTER_ERROR',
  PIPELINE_ERROR = 'PIPELINE_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  QUOTA_EXCEEDED_ERROR = 'QUOTA_EXCEEDED_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export interface RCCError extends BaseEntity {
  type: ErrorType;
  module: ModuleName;
  message: string;
  details: any;
  requestId?: RequestId;
  stack?: string;
  originalError?: any;
}

export interface APIErrorResponse {
  error: {
    type: string;
    message: string;
    module: string;
    details?: any;
    timestamp: Timestamp;
    request_id?: RequestId;
    code?: string;
  };
  status: number;
  headers: Record<string, string>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}
```

### Debug类型
```typescript
// src/types/debug-types.ts

export interface DebugRecord extends BaseEntity {
  requestId: RequestId;
  port: number;
  sessionId: string;
  readableTime: string;        // 可读的当前时区时间: "2024-08-15 14:30:22 CST"
  
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: any;
  };
  
  pipeline: {
    id: string;
    provider: ProviderName;
    model: ModelName;
    modules: ModuleRecord[];
  };
  
  response: {
    status: number;
    headers: Record<string, string>;
    body: any;
    duration: number;
  };
  
  error?: {
    type: string;
    message: string;
    module: string;
    stack: string;
  };
}

export interface ModuleRecord {
  moduleName: ModuleName;
  startTime: Timestamp;
  startTimeReadable: string;   // 可读的开始时间
  endTime: Timestamp;
  endTimeReadable: string;     // 可读的结束时间
  duration: number;            // 处理时长(毫秒)
  input: any;
  output: any;
  error?: RCCError;
  metadata: {
    version: string;
    config: any;
  };
}

export interface DebugSession extends BaseEntity {
  sessionId: string;
  port: number;
  startTime: Timestamp;
  startTimeReadable: string;   // 可读的开始时间: "2024-08-15 14:30:22 CST"
  endTime?: Timestamp;
  endTimeReadable?: string;    // 可读的结束时间
  duration?: number;           // 会话持续时间(毫秒)
  requestCount: number;
  errorCount: number;
  activePipelines: string[];
  metadata: {
    version: string;
    config: any;
    timezone: string;          // 时区信息
  };
}

export interface ReplayResult {
  original: any;
  replayed: any;
  isValid: boolean;
  differences: ReplayDifference[];
}

export interface ReplayDifference {
  path: string;
  originalValue: any;
  replayedValue: any;
  type: 'missing' | 'extra' | 'different';
}
```

## AI服务类型定义

### OpenAI类型
```typescript
// src/types/ai-service-types/openai-types.ts

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: OpenAITool[];
  tool_choice?: 'auto' | 'none' | OpenAIToolChoice;
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: object;
  };
}

export interface OpenAIToolChoice {
  type: 'function';
  function: {
    name: string;
  };
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
}

export interface OpenAIChoice {
  index: number;
  message: OpenAIMessage;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}

export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OpenAIStreamResponse {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: OpenAIStreamChoice[];
}

export interface OpenAIStreamChoice {
  index: number;
  delta: OpenAIStreamDelta;
  finish_reason: string | null;
}

export interface OpenAIStreamDelta {
  role?: string;
  content?: string;
  tool_calls?: OpenAIToolCall[];
}
```

### Anthropic类型
```typescript
// src/types/ai-service-types/anthropic-types.ts

export interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  system?: string;
  temperature?: number;
  stream?: boolean;
  tools?: AnthropicTool[];
}

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
  input?: object;
  content?: string;
  is_error?: boolean;
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: object;
}

export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContent[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  stop_sequence?: string;
  usage: AnthropicUsage;
}

export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface AnthropicStreamResponse {
  type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop';
  message?: AnthropicResponse;
  index?: number;
  content_block?: AnthropicContent;
  delta?: {
    type: string;
    text?: string;
  };
  usage?: AnthropicUsage;
}
```

### Gemini类型
```typescript
// src/types/ai-service-types/gemini-types.ts

export interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig?: GeminiGenerationConfig;
  safetySettings?: GeminiSafetySetting[];
  tools?: GeminiTool[];
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
  functionCall?: {
    name: string;
    args: object;
  };
  functionResponse?: {
    name: string;
    response: object;
  };
}

export interface GeminiGenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
}

export interface GeminiSafetySetting {
  category: string;
  threshold: string;
}

export interface GeminiTool {
  function_declarations: GeminiFunctionDeclaration[];
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: object;
}

export interface GeminiResponse {
  candidates: GeminiCandidate[];
  usageMetadata: GeminiUsageMetadata;
}

export interface GeminiCandidate {
  content: GeminiContent;
  finishReason: string;
  index: number;
  safetyRatings: GeminiSafetyRating[];
}

export interface GeminiSafetyRating {
  category: string;
  probability: string;
}

export interface GeminiUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}
```

### 通用AI服务类型
```typescript
// src/types/ai-service-types/common-types.ts

export type AIServiceType = 'openai' | 'anthropic' | 'gemini' | 'lmstudio' | 'ollama' | 'codewhisperer';

export interface AIServiceConfig {
  type: AIServiceType;
  baseUrl: string;
  apiKey: string;
  timeout: number;
  maxRetries: number;
}

export interface AIServiceRequest {
  model: string;
  messages: any[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
}

export interface AIServiceResponse {
  id: string;
  model: string;
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

export interface AIServiceError {
  type: string;
  message: string;
  code?: string;
  statusCode?: number;
}
```

## 模块接口类型

### 模块基础接口
```typescript
// src/types/module-interfaces.ts

export interface ModuleInterface {
  name: ModuleName;
  version: string;
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  getStatus(): ModuleStatus;
}

export interface ModuleStatus {
  isActive: boolean;
  lastActivity: Timestamp;
  errorCount: number;
  processedCount: number;
}

export interface ClientModule extends ModuleInterface {
  start(): Promise<void>;
  stop(): Promise<void>;
  getServerStatus(): Promise<ServerStatus>;
  handleError(error: RCCError): void;
}

// CLI相关类型
export interface ServerStartOptions {
  port: number;
  configPath?: string;
  debug: boolean;
}

export interface ClientStartOptions {
  port: number;
  autoStart: boolean;
  configPath?: string;
}

export interface CLIServer {
  start(options: ServerStartOptions): Promise<void>;
  gracefulShutdown(): Promise<void>;
}

export interface CLIClient {
  startClaudeCode(options: ClientStartOptions): Promise<void>;
  cleanup(): Promise<void>;
}

export interface ProcessManager {
  checkExecutable(command: string): Promise<void>;
  killProcessOnPort(port: number): Promise<void>;
}

export interface RouterModule extends ModuleInterface {
  processRequest(request: RCCRequest): Promise<RCCResponse>;
  getProviderConfigs(): Promise<ProviderConfig[]>;
  updateProviderConfig(provider: string, config: ProviderConfig): Promise<void>;
  enqueueRequest(sessionId: string, conversationId: string, request: RCCRequest): Promise<string>;
  getQueueStatus(sessionId: string, conversationId?: string): QueueStatus;
}

export interface DebugModule extends ModuleInterface {
  registerModule(moduleName: string, port: number): void;
  enableDebug(moduleName: string): void;
  disableDebug(moduleName: string): void;
  recordInput(moduleName: string, requestId: string, input: any): void;
  recordOutput(moduleName: string, requestId: string, output: any): void;
  recordError(moduleName: string, requestId: string, error: RCCError): void;
}

export interface ServerStatus {
  isRunning: boolean;
  port: number;
  startTime: Timestamp;
  activePipelines: number;
  requestCount: number;
  errorCount: number;
  activeSessions: number;
  queuedRequests: number;
}

// 会话流控相关类型
export interface QueuedRequest {
  requestId: string;
  sessionId: string;
  conversationId: string;
  request: RCCRequest;
  enqueuedAt: Timestamp;
  enqueuedAtReadable: string;
  priority: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
}

export interface ProcessingRequest extends QueuedRequest {
  startedAt: Timestamp;
  startedAtReadable: string;
}

export interface QueueStatus {
  sessionId: string;
  conversationId?: string;
  exists: boolean;
  totalQueued: number;
  totalProcessing: number;
  conversations: ConversationStatus[];
  createdAt?: Timestamp;
  lastActivity?: Timestamp;
}

export interface ConversationStatus {
  conversationId: string;
  queuedCount: number;
  processingCount: number;
  lastActivity: Timestamp;
}

export interface FlowControlConfig {
  maxConcurrentSessions: number;
  maxRequestsPerConversation: number;
  requestTimeout: number;
  sessionCleanupInterval: number;
  priorityWeights: Record<string, number>;
}
```

## 类型导出

```typescript
// src/types/index.ts

// 核心类型
export * from './core-types';
export * from './request-response-types';
export * from './pipeline-types';
export * from './config-types';
export * from './error-types';
export * from './debug-types';

// AI服务类型
export * from './ai-service-types/openai-types';
export * from './ai-service-types/anthropic-types';
export * from './ai-service-types/gemini-types';
export * from './ai-service-types/common-types';

// 模块接口类型
export * from './module-interfaces';

// 类型工具
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type Required<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
```

## 质量要求

- ✅ 完整的类型覆盖
- ✅ 严格的类型检查
- ✅ 接口一致性
- ✅ 向后兼容性
- ✅ 文档完整性
- ✅ 类型安全性
- ✅ 可扩展性设计