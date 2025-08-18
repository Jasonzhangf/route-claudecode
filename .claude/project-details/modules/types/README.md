# 类型定义模块 (Types Module)

## 模块概述

类型定义模块是RCC v4.0系统的静态类型系统核心，提供统一的类型定义和接口规范，确保整个系统的类型安全和一致性。

## 模块职责

1. **核心类型定义**: 定义系统使用的基础数据类型
2. **接口类型定义**: 定义各模块间的接口类型
3. **配置类型定义**: 定义配置相关的类型
4. **请求响应类型定义**: 定义请求和响应的数据类型
5. **错误类型定义**: 定义系统错误和异常相关的类型
6. **模块类型定义**: 定义模块化架构相关的类型
7. **流水线类型定义**: 定义流水线处理相关的类型
8. **路由类型定义**: 定义路由相关的类型

## 模块结构

```
types/
├── README.md                          # 本模块设计文档
├── index.ts                           # 模块入口和导出
├── core/                              # 核心类型定义
│   ├── base-types.ts                   # 基础类型定义
│   ├── request-response-types.ts        # 请求响应类型定义
│   ├── error-types.ts                  # 错误类型定义
│   ├── config-types.ts                 # 配置类型定义
│   └── module-types.ts                 # 模块类型定义
├── pipeline/                          # 流水线类型定义
│   ├── pipeline-types.ts                # 流水线类型定义
│   ├── module-types.ts                 # 模块类型定义
│   ├── execution-types.ts              # 执行类型定义
│   └── validation-types.ts              # 验证类型定义
├── router/                            # 路由器类型定义
│   ├── routing-types.ts                # 路由类型定义
│   ├── provider-types.ts               # Provider类型定义
│   ├── load-balancing-types.ts         # 负载均衡类型定义
│   └── flow-control-types.ts           # 流控类型定义
├── client/                            # 客户端类型定义
│   ├── cli-types.ts                    # CLI类型定义
│   ├── server-types.ts                 # 服务器类型定义
│   └── session-types.ts                # 会话类型定义
├── debug/                             # 调试类型定义
│   ├── debug-types.ts                  # 调试类型定义
│   ├── recording-types.ts              # 记录类型定义
│   └── replay-types.ts                # 回放类型定义
├── cli/                               # CLI架构类型定义
│   ├── command-types.ts                 # 命令类型定义
│   ├── argument-types.ts              # 参数类型定义
│   └── plugin-types.ts                # 插件类型定义
├── extensions/                        # 扩展类型定义
│   ├── provider-extension-types.ts     # Provider扩展类型定义
│   ├── model-extension-types.ts        # 模型扩展类型定义
│   ├── token-extension-types.ts        # Token扩展类型定义
│   └── blacklist-extension-types.ts    # 黑名单扩展类型定义
├── utils/                             # 工具类型定义
│   ├── promise-types.ts                # Promise类型定义
│   ├── event-types.ts                  # 事件类型定义
│   ├── cache-types.ts                  # 缓存类型定义
│   └── validation-types.ts            # 验证工具类型定义
└── schemas/                            # JSON Schema定义
    ├── config-schema.json             # 配置Schema
    ├── provider-schema.json           # Provider Schema
    ├── routing-schema.json            # 路由Schema
    └── debug-schema.json              # 调试Schema
```

## 核心类型定义

### 基础类型定义
```typescript
// base-types.ts
export type UUID = string;
export type ISODateString = string;
export type EmailAddress = string;
export type URLString = string;
export type SemanticVersion = string;

export interface Timestamped {
  createdAt: ISODateString;
  updatedAt: ISODateString;
  deletedAt?: ISODateString;
}

export interface Identifiable {
  id: UUID;
}

export interface Versioned {
  version: SemanticVersion;
}

export interface Metadata {
  [key: string]: any;
}

export interface BaseEntity extends Identifiable, Timestamped, Versioned {
  metadata?: Metadata;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
export type HttpStatus = number;
export type ContentType = 'application/json' | 'text/plain' | 'application/xml' | string;

export interface HttpHeaders {
  [key: string]: string | string[];
}

export interface HttpQueryParams {
  [key: string]: string | string[];
}

export interface HttpResponse {
  status: HttpStatus;
  headers: HttpHeaders;
  body: any;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  type: string;
}

export interface ValidationErrors {
  errors: ValidationError[];
}
```

### 请求响应类型定义
```typescript
// request-response-types.ts
export interface RequestContext {
  id: string;
  timestamp: number;
  method: HttpMethod;
  url: string;
  headers: HttpHeaders;
  query: HttpQueryParams;
  body?: any;
  metadata?: Record<string, any>;
}

export interface ResponseContext {
  requestId: string;
  status: HttpStatus;
  headers: HttpHeaders;
  body?: any;
  timestamp: number;
  processingTime?: number;
}

export interface RCCRequest {
  id: string;
  timestamp: number;
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: Tool[];
  metadata?: RequestMetadata;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentBlock[];
  name?: string;
  toolCallId?: string;
}

export interface ContentBlock {
  type: 'text' | 'image_url' | 'tool_use' | 'tool_result';
  text?: string;
  imageUrl?: ImageUrl;
  id?: string;
  name?: string;
  input?: Record<string, any>;
  content?: string;
  toolUseId?: string;
}

export interface ImageUrl {
  url: string;
  detail?: 'low' | 'high' | 'auto';
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
  sessionId?: string;
  conversationId?: string;
  requestId?: string;
}

export interface RCCResponse {
  id: string;
  choices: Choice[];
  usage?: Usage;
  model?: string;
  created?: number;
  metadata?: ResponseMetadata;
}

export interface Choice {
  index: number;
  message: Message;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'eos';
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ResponseMetadata {
  provider: string;
  model: string;
  processingTime: number;
  retries: number;
  cacheHit?: boolean;
  transformed?: boolean;
}
```

### 错误类型定义
```typescript
// error-types.ts
export enum ErrorCode {
  // 客户端错误 (1000-1999)
  CLIENT_ERROR = 1000,
  CLI_INVALID_COMMAND = 1001,
  CLI_MISSING_ARGUMENT = 1002,
  CLI_INVALID_OPTION = 1003,
  SERVER_START_FAILED = 1004,
  SERVER_STOP_FAILED = 1005,
  
  // 路由器错误 (2000-2999)
  ROUTER_ERROR = 2000,
  CONFIG_LOAD_FAILED = 2001,
  CONFIG_VALIDATION_FAILED = 2002,
  ROUTING_DECISION_FAILED = 2003,
  LOAD_BALANCING_FAILED = 2004,
  SESSION_FLOW_CONTROL_FAILED = 2005,
  
  // 流水线错误 (3000-3999)
  PIPELINE_ERROR = 3000,
  PIPELINE_CREATION_FAILED = 3001,
  PIPELINE_EXECUTION_FAILED = 3002,
  MODULE_PROCESSING_FAILED = 3003,
  TRANSFORMER_FAILED = 3004,
  PROTOCOL_HANDLING_FAILED = 3005,
  
  // 配置错误 (4000-4999)
  CONFIG_ERROR = 4000,
  CONFIG_FILE_NOT_FOUND = 4001,
  CONFIG_PARSE_FAILED = 4002,
  CONFIG_VALIDATION_FAILED = 4003,
  ENV_VARIABLE_MISSING = 4004,
  
  // 网络错误 (5000-5999)
  NETWORK_ERROR = 5000,
  CONNECTION_TIMEOUT = 5001,
  DNS_RESOLUTION_FAILED = 5002,
  SSL_HANDSHAKE_FAILED = 5003,
  HTTP_STATUS_ERROR = 5004,
  
  // 验证错误 (6000-6999)
  VALIDATION_ERROR = 6000,
  INPUT_VALIDATION_FAILED = 6001,
  OUTPUT_VALIDATION_FAILED = 6002,
  FORMAT_VALIDATION_FAILED = 6003,
  
  // 调试错误 (7000-7999)
  DEBUG_ERROR = 7000,
  RECORDING_FAILED = 7001,
  REPLAY_FAILED = 7002,
  DEBUG_DATA_CORRUPTED = 7003,
  
  // 权限错误 (8000-8999)
  AUTHENTICATION_ERROR = 8000,
  AUTHORIZATION_ERROR = 8001,
  PERMISSION_DENIED = 8002,
  
  // 系统错误 (9000-9999)
  SYSTEM_ERROR = 9000,
  OUT_OF_MEMORY = 9001,
  FILE_SYSTEM_ERROR = 9002,
  PROCESS_CRASH = 9003
}

export class RCCErrors extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, any>;
  public readonly requestId?: string;
  public readonly moduleId?: string;
  
  constructor(
    message: string, 
    code: ErrorCode, 
    details?: Record<string, any>,
    requestId?: string,
    moduleId?: string
  ) {
    super(message);
    this.name = 'RCCErrors';
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    this.moduleId = moduleId;
  }
  
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      requestId: this.requestId,
      moduleId: this.moduleId,
      stack: this.stack
    };
  }
}

export interface ErrorReport {
  id: string;
  timestamp: ISODateString;
  error: RCCErrors;
  context: ErrorContext;
  stackTrace?: string;
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
  userId?: string;
}

export interface ErrorContext {
  module: string;
  function: string;
  file: string;
  line: number;
  column: number;
}
```

### 配置类型定义
```typescript
// config-types.ts
export interface RCCConfig {
  version: SemanticVersion;
  debug?: DebugConfig;
  server?: ServerConfig;
  providers?: ProviderConfig[];
  routing?: RoutingConfig;
  pipeline?: PipelineConfig;
  client?: ClientConfig;
  security?: SecurityConfig;
}

export interface DebugConfig {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error';
  saveRequests: boolean;
  captureLevel: 'basic' | 'full';
  outputPath?: string;
  maxFileSize?: number;
  retentionDays?: number;
}

export interface ServerConfig {
  port: number;
  host: string;
  cors?: {
    enabled: boolean;
    origins: string[];
    credentials: boolean;
    methods: HttpMethod[];
    allowedHeaders: string[];
  };
  ssl?: {
    enabled: boolean;
    certPath: string;
    keyPath: string;
    caPath?: string;
  };
  rateLimit?: {
    enabled: boolean;
    requestsPerMinute: number;
    burstLimit: number;
  };
  timeout?: number;
  keepAliveTimeout?: number;
}

export interface ProviderConfig {
  id: string;
  name: string;
  protocol: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'lmstudio' | 'vllm' | string;
  baseUrl: string;
  apiKey: string;
  models: ModelConfig[];
  healthCheck?: HealthCheckConfig;
  rateLimit?: RateLimitConfig;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  availability: boolean;
}

export interface ModelConfig {
  id: string;
  name: string;
  maxTokens: number;
  supportsFunctions: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsEmbeddings: boolean;
  supportsTools: boolean;
  costFactor?: number;
  performanceImpact?: number;
  recommendedMaxTokens?: number;
}

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  endpoint: string;
  expectedStatus: number | number[];
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute: number;
  burstLimit: number;
}

export interface RoutingConfig {
  strategy: 'weighted' | 'round-robin' | 'least-connections' | 'adaptive';
  categories: Record<string, CategoryConfig>;
  defaultCategory: string;
  fallbackStrategy?: string;
  loadBalancing?: {
    algorithm: 'random' | 'weighted-round-robin' | 'least-connections';
    healthAware: boolean;
    adaptive: boolean;
  };
}

export interface CategoryConfig {
  rules: RoutingRule[];
  defaultModel?: string;
  fallbackModels?: string[];
}

export interface RoutingRule {
  provider: string;
  model: string;
  weight: number;
  conditions?: RoutingCondition[];
  priority?: number;
}

export interface RoutingCondition {
  type: 'model' | 'category' | 'feature' | 'user' | 'role' | 'tag';
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'nin' | 'contains' | 'regex';
  value: any;
  field?: string;
}

export interface PipelineConfig {
  modules: Record<string, ModuleConfig>;
  settings: PipelineSettings;
  validation: PipelineValidation;
}

export interface ModuleConfig {
  id: string;
  moduleId: string;
  order: number;
  enabled: boolean;
  config: Record<string, any>;
  dependencies?: string[];
  optional?: boolean;
}

export interface PipelineSettings {
  parallel: boolean;
  failFast: boolean;
  timeout: number;
  retryPolicy: RetryPolicy;
  errorHandling: ErrorHandlingStrategy;
  logging: LoggingConfig;
  monitoring: MonitoringConfig;
}

export interface RetryPolicy {
  enabled: boolean;
  maxRetries: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
  retryableErrors: string[];
}

export interface ErrorHandlingStrategy {
  stopOnFirstError: boolean;
  allowPartialSuccess: boolean;
  errorRecovery: boolean;
  fallbackStrategies: FallbackStrategy[];
}

export interface FallbackStrategy {
  condition: string;
  action: 'retry' | 'skip' | 'alternative' | 'abort';
  parameters?: Record<string, any>;
}

export interface LoggingConfig {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error';
  includeInput: boolean;
  includeOutput: boolean;
  maskSensitiveData: boolean;
  maxLogSize: number;
}

export interface MonitoringConfig {
  enabled: boolean;
  collectMetrics: boolean;
  performanceTracking: boolean;
  alerting: AlertingConfig;
}

export interface AlertingConfig {
  enabled: boolean;
  thresholds: {
    errorRate: number;
    responseTime: number;
    throughput: number;
  };
  channels: string[];
}

export interface ClientConfig {
  defaultProvider?: string;
  defaultModel?: string;
  autoStartServer?: boolean;
  exportEnvironment?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export interface SecurityConfig {
  encryption?: {
    enabled: boolean;
    algorithm: string;
    keyDerivation: {
      algorithm: string;
      iterations: number;
      saltLength: number;
      keyLength: number;
    };
  };
  authentication?: {
    enabled: boolean;
    methods: ('api-key' | 'jwt' | 'oauth')[];
    requireHTTPS: boolean;
  };
  rateLimiting?: {
    enabled: boolean;
    globalLimit: number;
    perUserLimit: number;
    windowMs: number;
  };
  inputValidation?: {
    enabled: boolean;
    maxRequestSize: number;
    allowedContentTypes: string[];
    sanitizeInput: boolean;
  };
  outputSanitization?: {
    enabled: boolean;
    stripScripts: boolean;
    trimWhitespace: boolean;
  };
}
```

## 流水线类型定义

### 流水线类型定义
```typescript
// pipeline-types.ts
export type ModuleType = 
  | 'validator'
  | 'transformer'
  | 'protocol'
  | 'server-compatibility'
  | 'server';

export interface ModuleStatus {
  id: string;
  name: string;
  type: ModuleType;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
  health: 'healthy' | 'degraded' | 'unhealthy';
  lastActivity?: Date;
  error?: Error;
}

export interface ModuleMetrics {
  requestsProcessed: number;
  averageProcessingTime: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
  lastProcessedAt?: Date;
}

export interface ModuleInterface {
  id: string;
  name: string;
  type: ModuleType;
  version: string;
  getStatus(): ModuleStatus;
  getMetrics(): ModuleMetrics;
  configure(config: any): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  process(input: any): Promise<any>;
  reset(): Promise<void>;
  cleanup(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; details: any }>;
  on(event: string, listener: (...args: any[]) => void): void;
  removeAllListeners(): void;
}

export interface PipelineSpec {
  id: string;
  name: string;
  description: string;
  version: string;
  provider?: string;
  model?: string;
  timeout?: number;
  modules: {
    id: string;
    config?: Record<string, any>;
  }[];
  configuration: PipelineConfiguration;
  metadata: PipelineMetadata;
}

export interface PipelineConfiguration {
  parallel: boolean;
  failFast: boolean;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
  };
}

export interface PipelineMetadata {
  author: string;
  created: number;
  tags: string[];
}

export interface PipelineStatus {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'busy' | 'error' | 'stopped';
  provider: string;
  model: string;
  activeConnections: number;
  totalRequests: number;
  successRequests: number;
  errorRequests: number;
  averageResponseTime: number;
  lastActivity: Date;
  health: 'healthy' | 'degraded' | 'unhealthy';
}

export interface PipelineFramework extends Pipeline {
  readonly id: string;
  
  on(event: string, listener: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): boolean;
  removeListener(event: string, listener: (...args: any[]) => void): this;
  removeAllListeners(event?: string): this;
  addModule(module: ModuleInterface): void;
  removeModule(moduleId: string): void;
  getModule(moduleId: string): ModuleInterface | null;
  getAllModules(): ModuleInterface[];
  setModuleOrder(moduleIds: string[]): void;
  executeModule(moduleId: string, input: any): Promise<any>;
  getExecutionHistory(): ExecutionRecord[];
  reset(): Promise<void>;
  cleanup(): Promise<void>;
}

export interface Pipeline {
  getId(): string;
  getName(): string;
  getProvider(): string;
  getModel(): string;
  getStatus(): PipelineStatus;
  start(): Promise<void>;
  stop(): Promise<void>;
  execute(input: any, context?: any): Promise<any>;
}

export interface ExecutionRecord {
  id: string;
  pipelineId: string;
  requestId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  moduleExecutions: ModuleExecutionRecord[];
  totalTime?: number;
  error?: Error;
}

export interface ModuleExecutionRecord {
  moduleId: string;
  moduleName: string;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input: any;
  output?: any;
  error?: Error;
  processingTime?: number;
  metadata?: Record<string, any>;
}

export interface PipelineConfig {
  id: string;
  name: string;
  description?: string;
  provider: string;
  model: string;
  modules: ModuleConfig[];
  settings: PipelineSettings;
  spec?: PipelineSpec;
  metadata?: Record<string, any>;
}

export interface ExecutionContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  priority: 'low' | 'normal' | 'high';
  timeout?: number;
  debug?: boolean;
  traceId?: string;
  metadata?: Record<string, any>;
}

export interface ExecutionResult {
  executionId: string;
  status: 'success' | 'failure' | 'partial' | 'cancelled';
  result?: any;
  error?: Error;
  executionRecord: ExecutionRecord;
  performance: PerformanceMetrics;
}

export interface ExecutionStatus {
  executionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  progress: number; // 0-100
  currentModule?: string;
  startTime: Date;
  estimatedRemainingTime?: number;
  error?: Error;
}

export interface PerformanceMetrics {
  totalTime: number;
  modulesTiming: Record<string, number>;
  memoryUsage: {
    peak: number;
    average: number;
  };
  cpuUsage: {
    peak: number;
    average: number;
  };
  throughput: number;
  errorCount: number;
}
```

## 路由器类型定义

### 路由器类型定义
```typescript
// routing-types.ts
export interface RoutingRequest {
  protocol: string;
  model?: string;
  content: any;
  context: ExecutionContext;
  metadata?: Record<string, any>;
}

export interface RoutingDecision {
  target: RoutingTarget;
  confidence: number;
  reason: string;
  fallbacks?: RoutingTarget[];
  transformations?: RequestTransformation[];
}

export interface RoutingTarget {
  type: 'pipeline' | 'provider' | 'fallback';
  id: string;
  name: string;
  weight: number;
  healthScore: number;
}

export interface RequestTransformation {
  type: 'format' | 'model' | 'parameters';
  description: string;
  apply(request: any): any;
}

export interface RoutingStats {
  totalRequests: number;
  successfulRoutes: number;
  failedRoutes: number;
  averageResponseTime: number;
  routingByStrategy: Record<string, number>;
  routingByTarget: Record<string, number>;
}

export interface IRoutingStrategy {
  route(request: RoutingRequest): Promise<RoutingDecision>;
  getName(): string;
  getPriority(): number;
}

export interface RouterModuleInterface {
  version: string;
  initialize(): Promise<void>;
  routeRequest(request: RoutingRequest): Promise<RoutingDecision>;
  getConfig(): RouterConfig;
  updateConfig(config: RouterConfig): Promise<void>;
  getRouteStats(): RoutingStats;
}

export interface RouterConfig {
  version: string;
  providers: Record<string, ProviderConfig>;
  routing: RoutingConfig;
  loadBalancing: LoadBalancingConfig;
  flowControl: FlowControlConfig;
}

export interface LoadBalancingConfig {
  strategy: 'weighted-round-robin' | 'least-connections' | 'random' | 'adaptive';
  healthCheck: {
    enabled: boolean;
    interval: number;
    timeout: number;
    endpoint: string;
  };
  failover: {
    enabled: boolean;
    maxRetries: number;
    retryDelay: number;
  };
}

export interface FlowControlConfig {
  maxConcurrentSessions: number;
  maxRequestsPerConversation: number;
  requestTimeout: number;
  sessionCleanupInterval: number;
  priorityWeights: Record<string, number>;
}
```

## 客户端类型定义

### 客户端类型定义
```typescript
// client-types.ts
export interface CLICommands {
  start(options: StartOptions): Promise<void>;
  stop(options: StopOptions): Promise<void>;
  code(options: CodeOptions): Promise<void>;
  status(options: StatusOptions): Promise<ServerStatus>;
  config(options: ConfigOptions): Promise<void>;
}

export interface StartOptions {
  port?: number;
  host?: string;
  config?: string;
  debug?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  maxRetries?: number;
  retryDelay?: number;
}

export interface StopOptions {
  port?: number;
  force?: boolean;
}

export interface CodeOptions {
  port?: number;
  autoStart?: boolean;
  export?: boolean;
  config?: string;
}

export interface StatusOptions {
  port?: number;
  detailed?: boolean;
}

export interface ConfigOptions {
  list?: boolean;
  validate?: boolean;
  reset?: boolean;
  path?: string;
}

export interface ServerStatus {
  isRunning: boolean;
  port: number;
  host: string;
  startTime: Date;
  version: string;
  activePipelines: number;
  totalRequests: number;
  uptime: string;
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{
      name: string;
      status: 'pass' | 'warn' | 'fail';
      responseTime: number;
      details?: Record<string, any>;
    }>;
  };
  metrics?: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkUsage: {
      inbound: number;
      outbound: number;
    };
  };
}

export interface CLIModuleInterface {
  version: string;
  run(args?: string[]): Promise<void>;
  executeCommand(command: string, options: any): Promise<void>;
  showHelp(): void;
  showVersion(): void;
}

export interface ParsedCommand {
  command: string;
  subcommand?: string;
  options: Record<string, any>;
  args: string[];
}

export interface CommandParserInterface {
  parseArguments(args: string[]): ParsedCommand;
  executeCommand(command: ParsedCommand): Promise<void>;
  showHelp(command?: string): void;
  showVersion(): void;
}
```

## 调试类型定义

### 调试类型定义
```typescript
// debug-types.ts
export interface DebugManager {
  initialize(): Promise<void>;
  startRecording(): void;
  stopRecording(): void;
  getRecordingStatus(): RecordingStatus;
  getRecordedData(filter?: DebugFilter): DebugRecord[];
  clearRecordedData(): void;
  exportData(format: ExportFormat): Promise<string>;
}

export interface DebugRecorder {
  recordEvent(event: DebugEvent): void;
  startSession(sessionId: string): void;
  endSession(sessionId: string): void;
  recordRequest(request: DebugRequest): void;
  recordResponse(response: DebugResponse): void;
  recordError(error: DebugError): void;
}

export interface ReplaySystem {
  replayRequest(requestId: string): Promise<any>;
  createUnitTest(requestId: string): Promise<string>;
  validateReplay(original: DebugRecord, replayed: DebugRecord): boolean;
}

export interface DebugRecord {
  id: string;
  timestamp: Date;
  type: 'request' | 'response' | 'error' | 'event' | 'metric';
  module: string;
  data: any;
  metadata: DebugMetadata;
  context: DebugContext;
}

export interface DebugRequest {
  id: string;
  timestamp: Date;
  method: HttpMethod;
  url: string;
  headers: HttpHeaders;
  body?: any;
  metadata: RequestMetadata;
}

export interface DebugResponse {
  id: string;
  timestamp: Date;
  status: HttpStatus;
  headers: HttpHeaders;
  body?: any;
  metadata: ResponseMetadata;
  processingTime?: number;
}

export interface DebugError {
  id: string;
  timestamp: Date;
  error: RCCErrors;
  context: ErrorContext;
  stackTrace?: string;
}

export interface DebugEvent {
  id: string;
  timestamp: Date;
  type: string;
  data: any;
  metadata: Record<string, any>;
}

export interface DebugMetadata {
  requestId?: string;
  sessionId?: string;
  conversationId?: string;
  processingTime?: number;
  memoryUsage?: number;
}

export interface DebugContext {
  module: string;
  function: string;
  file: string;
  line: number;
  column: number;
}

export interface RecordingStatus {
  isRecording: boolean;
  sessionId?: string;
  startTime?: Date;
  totalRecords: number;
  modules: string[];
}

export interface DebugFilter {
  module?: string;
  type?: 'request' | 'response' | 'error' | 'event' | 'metric';
  startTime?: Date;
  endTime?: Date;
  requestId?: string;
}

export type ExportFormat = 'json' | 'csv' | 'xml' | 'yaml';

export interface DebugModuleInterface {
  version: string;
  initialize(): Promise<void>;
  getManager(): DebugManager;
  getRecorder(): DebugRecorder;
  getReplaySystem(): ReplaySystem;
}
```

## CLI架构类型定义

### CLI架构类型定义
```typescript
// cli-architecture-types.ts
export interface CLIFrameworkOptions {
  name: string;
  version: string;
  description: string;
  bin?: string;
  commands?: Command[];
  plugins?: Plugin[];
}

export interface CommandOptions {
  name: string;
  description: string;
  usage?: string;
  aliases?: string[];
  subcommands?: Command[];
  options?: CommandOption[];
  arguments?: CommandArgument[];
  examples?: string[];
  hidden?: boolean;
}

export interface CommandOption {
  name: string;
  alias?: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required?: boolean;
  default?: any;
  choices?: any[];
  validate?: (value: any) => boolean | string;
}

export interface CommandArgument {
  name: string;
  description: string;
  required?: boolean;
  variadic?: boolean;
  default?: any;
  validate?: (value: any) => boolean | string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export abstract class Command {
  protected name: string;
  protected description: string;
  protected usage: string;
  protected aliases: string[];
  protected subcommands: Map<string, Command> = new Map();
  protected options: CommandOption[];
  protected arguments: CommandArgument[];
  protected examples: string[];
  protected hidden: boolean;
  
  constructor(options: CommandOptions);
  
  getName(): string;
  getDescription(): string;
  getUsage(): string;
  getAliases(): string[];
  getSubcommands(): Command[];
  getSubcommand(name: string): Command | undefined;
  getOptions(): CommandOption[];
  getArguments(): CommandArgument[];
  getExamples(): string[];
  isHidden(): boolean;
  registerSubcommand(command: Command): void;
  validateArguments(args: Record<string, any>): ValidationResult;
  abstract async execute(args: Record<string, any>): Promise<void>;
  showHelp(): void;
}

export interface ParsedArguments {
  command: string[];
  options: Record<string, any>;
  flags: string[];
  arguments: string[];
  raw: string[];
}

export interface ArgumentParserInterface {
  parse(argv: string[]): ParsedArguments;
  validate(parsed: ParsedArguments, schema: CommandSchema): ValidationResult;
}

export interface CommandExecutorInterface {
  execute(command: Command, args: Record<string, any>): Promise<void>;
  executeBatch(commands: Array<{ command: Command; args: Record<string, any> }>): Promise<void>;
  executeParallel(commands: Array<{ command: Command; args: Record<string, any> }>): Promise<void>;
  executeInteractive(command: Command): Promise<void>;
}

export interface Plugin {
  getName(): string;
  getVersion(): string;
  getDescription(): string;
  getCommands(): Command[];
  initialize(cli: CLIFramework): Promise<void>;
  unload(): Promise<void>;
}

export interface PluginManagerInterface {
  loadPlugins(): Promise<void>;
  getPlugin(name: string): Plugin | undefined;
  getPlugins(): Plugin[];
  unloadPlugin(name: string): Promise<void>;
  unloadAllPlugins(): Promise<void>;
  refreshPlugins(): Promise<void>;
}

export interface HelpSystemInterface {
  showHelp(commandPath?: string[]): void;
  showGlobalHelp(): void;
  showCommandHelp(commandPath: string[]): void;
  generateHelpText(command?: Command): string;
}

export interface ErrorHandlerInterface {
  handleError(error: Error): void;
  handleValidationError(errors: string[]): void;
  handleCommandError(command: string, error: Error): void;
  handlePluginError(plugin: string, error: Error): void;
  showFriendlyError(error: CLIError): void;
  generateErrorReport(error: Error): Promise<ErrorReport>;
}
```

## 扩展类型定义

### 扩展类型定义
```typescript
// extensions-types.ts
export interface ProviderUpdateOptions {
  autoInstall?: boolean;
  validateAfterUpdate?: boolean;
  backupExisting?: boolean;
  updateInterval?: number;
  forceUpdate?: boolean;
}

export interface ProviderUpdateResult {
  provider: string;
  version: string;
  updated: boolean;
  installed: boolean;
  validated: boolean;
  backupCreated: boolean;
  error?: string;
}

export interface ProviderInfo {
  name: string;
  version: string;
  description: string;
  homepage: string;
  repository: string;
  registry: string;
  latestVersion?: string;
  downloadUrl?: string;
  checksum?: string;
  dependencies?: Record<string, string>;
  keywords?: string[];
  author?: string;
  license?: string;
  engines?: Record<string, string>;
  scripts?: Record<string, string>;
  config?: ProviderConfig;
  models?: ModelConfig[];
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
  capabilities: ModelCapabilities;
  limits: ModelLimits;
  pricing: ModelPricing;
  availability: ModelAvailability;
  metadata: Record<string, any>;
}

export interface ModelCapabilities {
  maxTokens: number;
  supportsStreaming: boolean;
  supportsFunctions: boolean;
  supportsVision: boolean;
  supportsEmbeddings: boolean;
  supportsAudio: boolean;
  supportsVideo: boolean;
  supportsFiles: boolean;
  supportsTools: boolean;
}

export interface ModelLimits {
  maxInputTokens: number;
  maxOutputTokens: number;
  maxTotalTokens: number;
  requestsPerMinute: number;
  tokensPerMinute: number;
  tokensPerDay: number;
}

export interface ModelPricing {
  inputCostPerMillionTokens: number;
  outputCostPerMillionTokens: number;
  cacheHitCostPerMillionTokens?: number;
  trainingCostPerMillionTokens?: number;
}

export interface ModelAvailability {
  regions: string[];
  status: 'available' | 'limited' | 'unavailable' | 'deprecated';
  deprecationDate?: string;
  maintenanceWindows?: MaintenanceWindow[];
}

export interface MaintenanceWindow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface TokenTestConfig {
  model: string;
  provider: string;
  testCases: TokenTestCase[];
  maxRetries: number;
  timeout: number;
  concurrency: number;
  validateResults: boolean;
}

export interface TokenTestCase {
  name: string;
  description: string;
  inputTokens: number;
  outputTokens?: number;
  expectedBehavior: 'success' | 'failure' | 'partial';
  inputContent?: string;
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
}

export interface TokenTestResult {
  testCase: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens?: number;
  actualInputTokens?: number;
  actualOutputTokens?: number;
  success: boolean;
  errorMessage?: string;
  duration: number;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface TokenLimitReport {
  model: string;
  provider: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxTotalTokens: number;
  testedAt: Date;
  testResults: TokenTestResult[];
  recommendations: string[];
  confidence: number; // 0-1
}

export interface BlacklistEntry {
  id: string;
  type: 'model' | 'provider' | 'user' | 'ip';
  value: string;
  reason: string;
  createdAt: Date;
  expiresAt?: Date;
  createdBy: string;
  metadata?: Record<string, any>;
}

export interface BlacklistConfig {
  enabled: boolean;
  defaultExpireDays: number;
  notifyOnBlock: boolean;
  logBlocks: boolean;
  whitelist?: string[];
}

export interface LongContextModel {
  id: string;
  name: string;
  provider: string;
  maxTokens: number;
  recommendedMaxTokens: number;
  costFactor: number; // 相对于基础模型的成本系数
  performanceImpact: number; // 对性能的影响程度（0-1）
  supportedFeatures: string[];
  availability: {
    regions: string[];
    status: 'available' | 'limited' | 'unavailable';
  };
  benchmarks?: ModelBenchmark[];
}

export interface ModelBenchmark {
  testType: 'context-length' | 'performance' | 'quality';
  inputTokens: number;
  outputTokens: number;
  processingTime: number; // 毫秒
  memoryUsage: number; // MB
  cost?: number; // 美元
  accuracy?: number; // 0-1
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ContextAnalysisResult {
  model: string;
  provider: string;
  requiredTokens: number;
  recommendedModel?: LongContextModel;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  costEstimate?: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
  };
}
```

## 接口定义

```typescript
interface TypesModuleInterface {
  version: string;
  initialize(): Promise<void>;
  getCoreTypes(): CoreTypes;
  getPipelineTypes(): PipelineTypes;
  getRouterTypes(): RouterTypes;
  getClientTypes(): ClientTypes;
  getDebugTypes(): DebugTypes;
  getCliTypes(): CliTypes;
  getExtensionTypes(): ExtensionTypes;
  validateType<T>(data: any, schema: TypeSchema): data is T;
  getTypeSchema(typeName: string): TypeSchema;
  registerTypeSchema(typeName: string, schema: TypeSchema): void;
}

interface CoreTypes {
  BaseTypes: typeof import('./core/base-types');
  RequestResponseTypes: typeof import('./core/request-response-types');
  ErrorTypes: typeof import('./core/error-types');
  ConfigTypes: typeof import('./core/config-types');
  ModuleTypes: typeof import('./core/module-types');
}

interface PipelineTypes {
  PipelineTypes: typeof import('./pipeline/pipeline-types');
  ModuleTypes: typeof import('./pipeline/module-types');
  ExecutionTypes: typeof import('./pipeline/execution-types');
  ValidationTypes: typeof import('./pipeline/validation-types');
}

interface RouterTypes {
  RoutingTypes: typeof import('./router/routing-types');
  ProviderTypes: typeof import('./router/provider-types');
  LoadBalancingTypes: typeof import('./router/load-balancing-types');
  FlowControlTypes: typeof import('./router/flow-control-types');
}

interface ClientTypes {
  CliTypes: typeof import('./client/cli-types');
  ServerTypes: typeof import('./client/server-types');
  SessionTypes: typeof import('./client/session-types');
}

interface DebugTypes {
  DebugTypes: typeof import('./debug/debug-types');
  RecordingTypes: typeof import('./debug/recording-types');
  ReplayTypes: typeof import('./debug/replay-types');
}

interface CliTypes {
  CommandTypes: typeof import('./cli/command-types');
  ArgumentTypes: typeof import('./cli/argument-types');
  PluginTypes: typeof import('./cli/plugin-types');
}

interface ExtensionTypes {
  ProviderExtensionTypes: typeof import('./extensions/provider-extension-types');
  ModelExtensionTypes: typeof import('./extensions/model-extension-types');
  TokenExtensionTypes: typeof import('./extensions/token-extension-types');
  BlacklistExtensionTypes: typeof import('./extensions/blacklist-extension-types');
}

interface TypeSchema {
  name: string;
  properties: Record<string, PropertySchema>;
  required?: string[];
  additionalProperties?: boolean;
}

interface PropertySchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  enum?: any[];
  minimum?: number;
  maximum?: number;
  format?: string;
  items?: TypeSchema;
  properties?: Record<string, PropertySchema>;
  required?: string[];
}
```

## 依赖关系

- 不依赖任何其他模块（基础类型定义模块）
- 被所有其他模块依赖以获取类型定义

## 设计原则

1. **一致性**: 保持类型定义的一致性和规范性
2. **完整性**: 覆盖系统所有需要的类型定义
3. **可维护性**: 清晰的类型结构和文档
4. **类型安全**: 确保类型定义的准确性和安全性
5. **可扩展性**: 易于添加新的类型定义
6. **文档化**: 提供完整的类型文档和使用示例
7. **验证性**: 支持类型验证和运行时检查
8. **模块化**: 按模块组织类型定义
9. **版本控制**: 支持类型定义的版本管理
10. **兼容性**: 确保向前和向后兼容性