# RCC v4.0 详细设计文档

## 系统架构设计

### 整体架构图
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   客户端模块     │───▶│   路由器模块     │───▶│  流水线Worker   │
│   (Client)      │    │   (Router)      │    │  (Pipeline)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Debug系统 (Debug System)                     │
└─────────────────────────────────────────────────────────────────┘
```

### 数据流设计
```
Claude Code Request
        │
        ▼
┌─────────────────┐
│   客户端模块     │ ── HTTP Server (Port 3456)
│   - CLI处理     │
│   - 错误处理     │
└─────────────────┘
        │
        ▼
┌─────────────────┐
│   路由器模块     │ ── 配置读取 (~/.route-claudecode/config)
│   - 请求路由     │ ── 负载均衡
│   - 流水线管理   │ ── 动态路由表生成
└─────────────────┘
        │
        ▼
┌─────────────────┐
│  流水线Worker   │ ── 动态初始化/销毁
│  ┌─────────────┐│ ── 数据格式校验
│  │Transformer  ││ ── 模块间连接
│  └─────────────┘│
│  ┌─────────────┐│
│  │Protocol     ││
│  └─────────────┘│
│  ┌─────────────┐│
│  │Server-Compat││
│  └─────────────┘│
│  ┌─────────────┐│
│  │Server       ││
│  └─────────────┘│
└─────────────────┘
        │
        ▼
    AI Service Provider
```

## 模块详细设计

### 1. 客户端模块 (src/client/)

#### 1.1 CLI系统设计
```typescript
interface CLICommands {
  start(options: StartOptions): Promise<void>;
  stop(): Promise<void>;
  code(options: CodeOptions): Promise<void>;
  status(): Promise<ServerStatus>;
}

interface StartOptions {
  port?: number;
  config?: string;
  debug?: boolean;
}

interface CodeOptions {
  port?: number;
  export?: boolean;
}
```

#### 1.2 服务器管理
```typescript
interface ServerManager {
  startServer(port: number): Promise<void>;
  stopServer(): Promise<void>;
  getServerStatus(): Promise<ServerStatus>;
  setupRoutes(): void;
}
```

#### 1.3 错误处理系统
```typescript
interface ErrorHandler {
  handleError(error: RCCError): void;
  formatError(error: RCCError): string;
  logError(error: RCCError): void;
  reportToUser(error: RCCError): void;
}
```

### 2. 路由器模块 (src/router/)

#### 2.1 配置管理系统
```typescript
interface ConfigManager {
  loadProviderConfig(): Promise<ProviderConfig[]>;
  loadRoutingConfig(): Promise<RoutingConfig>;
  generateRoutingTable(): Promise<GeneratedRoutingTable>;
  watchConfigChanges(): void;
}

interface GeneratedRoutingTable {
  timestamp: number;
  routes: Array<{
    category: string;
    pipelines: Array<{
      id: string;
      provider: string;
      model: string;
      weight: number;
      isActive: boolean;
    }>;
  }>;
}
```

#### 2.2 请求路由系统
```typescript
interface RequestRouter {
  route(request: RCCRequest): Promise<Pipeline>;
  selectPipeline(category: string): Promise<Pipeline>;
  balanceLoad(pipelines: Pipeline[]): Pipeline;
}
```

#### 2.3 流水线管理器
```typescript
interface PipelineManager {
  createPipeline(provider: string, model: string): Promise<Pipeline>;
  destroyPipeline(pipelineId: string): Promise<void>;
  getPipeline(pipelineId: string): Pipeline | null;
  listActivePipelines(): Pipeline[];
  monitorAvailability(): void;
}
```

### 3. 流水线Worker (src/pipeline/)

#### 3.1 流水线框架
```typescript
interface PipelineFramework {
  id: string;
  provider: string;
  model: string;
  modules: PipelineModule[];
  
  process(input: any): Promise<any>;
  validate(): boolean;
  destroy(): Promise<void>;
}

interface PipelineModule {
  name: string;
  process(input: any): Promise<any>;
  validate(input: any): boolean;
  getSchema(): ValidationSchema;
}
```

#### 3.2 Transformer模块设计
```typescript
interface TransformerModule extends PipelineModule {
  name: 'transformer';
  targetProtocol: string;
  
  // Anthropic → Target Protocol
  transformRequest(anthropicRequest: AnthropicRequest): Promise<ProtocolRequest>;
  
  // Target Protocol → Anthropic  
  transformResponse(protocolResponse: ProtocolResponse): Promise<AnthropicResponse>;
  
  validateAnthropicRequest(request: AnthropicRequest): boolean;
  validateProtocolResponse(response: ProtocolResponse): boolean;
}
```

#### 3.3 Protocol模块设计
```typescript
interface ProtocolModule extends PipelineModule {
  name: 'protocol';
  protocol: string;
  
  // 流式 → 非流式
  convertToNonStreaming(streamRequest: StreamRequest): Promise<NonStreamRequest>;
  
  // 非流式 → 流式
  convertToStreaming(nonStreamResponse: NonStreamResponse): Promise<StreamResponse>;
  
  validateProtocolRequest(request: ProtocolRequest): boolean;
  validateProtocolResponse(response: ProtocolResponse): boolean;
}
```

#### 3.4 Server-Compatibility模块设计
```typescript
interface ServerCompatibilityModule extends PipelineModule {
  name: 'server-compatibility';
  serverType: string;
  
  // 标准协议 → 服务器特定格式
  adaptRequest(standardRequest: StandardRequest): Promise<ServerRequest>;
  
  // 服务器响应 → 标准协议
  adaptResponse(serverResponse: ServerResponse): Promise<StandardResponse>;
  
  validateStandardRequest(request: StandardRequest): boolean;
  validateServerResponse(response: ServerResponse): boolean;
}
```

#### 3.5 Server模块设计
```typescript
interface ServerModule extends PipelineModule {
  name: 'server';
  serverType: string;
  sdk?: any;
  
  sendRequest(request: ServerRequest): Promise<ServerResponse>;
  authenticate(): Promise<boolean>;
  checkHealth(): Promise<boolean>;
}
```

### 4. Debug系统 (src/debug/)

#### 4.1 Debug管理器
```typescript
interface DebugManager {
  registerModule(moduleName: string, port: number): void;
  enableDebug(moduleName: string): void;
  disableDebug(moduleName: string): void;
  recordInput(moduleName: string, requestId: string, input: any): void;
  recordOutput(moduleName: string, requestId: string, output: any): void;
  recordError(moduleName: string, requestId: string, error: RCCError): void;
}
```

#### 4.2 记录系统
```typescript
interface DebugRecorder {
  createSession(port: number): DebugSession;
  recordPipelineExecution(requestId: string, pipeline: Pipeline, data: any): void;
  saveRecord(record: DebugRecord): Promise<void>;
  loadRecord(requestId: string): Promise<DebugRecord>;
}

interface DebugSession {
  port: number;
  startTime: number;
  records: Map<string, DebugRecord[]>;
}
```

#### 4.3 回放系统
```typescript
interface ReplaySystem {
  replayRequest(requestId: string): Promise<any>;
  createUnitTest(requestId: string): Promise<string>;
  validateReplay(original: DebugRecord, replayed: DebugRecord): boolean;
}
```

## 配置系统设计

### 配置文件结构
```
~/.route-claudecode/
├── config/
│   ├── providers.json          # Provider配置
│   ├── routing.json           # 路由表配置
│   └── generated/             # 动态生成的配置
│       └── routing-table.json # 生成的路由表
├── debug/                     # Debug记录
│   ├── port-3456/            # 按端口分组
│   │   ├── session-xxx/      # 按会话分组
│   │   └── records/          # 记录文件
│   └── ...
└── logs/                      # 日志文件
    ├── client.log
    ├── router.log
    └── pipeline.log
```

### Provider配置Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "providers": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {"type": "string"},
          "protocol": {"type": "string", "enum": ["openai", "anthropic", "gemini"]},
          "baseUrl": {"type": "string", "format": "uri"},
          "apiKey": {"type": "string"},
          "models": {
            "type": "array",
            "items": {"type": "string"}
          },
          "maxTokens": {"type": "number", "minimum": 1},
          "availability": {"type": "boolean"}
        },
        "required": ["name", "protocol", "baseUrl", "apiKey", "models"]
      }
    }
  }
}
```

### Routing配置Schema
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "routes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "category": {"type": "string"},
          "rules": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "provider": {"type": "string"},
                "model": {"type": "string"},
                "weight": {"type": "number", "minimum": 0, "maximum": 1}
              },
              "required": ["provider", "model", "weight"]
            }
          }
        },
        "required": ["category", "rules"]
      }
    }
  }
}
```

## 错误处理设计

### 错误分类
```typescript
enum ErrorType {
  CLIENT_ERROR = 'CLIENT_ERROR',
  ROUTER_ERROR = 'ROUTER_ERROR', 
  PIPELINE_ERROR = 'PIPELINE_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

interface RCCError {
  id: string;
  type: ErrorType;
  module: string;
  message: string;
  details: any;
  timestamp: number;
  requestId?: string;
  stack?: string;
}
```

### 错误处理流程
```
Error发生 → 模块捕获 → 包装成RCCError → 传递给ErrorHandler → 记录日志 → 返回客户端
```

## 测试策略

### 测试层级
1. **单元测试**: 每个模块独立测试
2. **集成测试**: 模块间接口测试  
3. **流水线测试**: 完整流水线端到端测试
4. **回放测试**: 基于Debug记录的回放测试

### 测试数据管理
```typescript
interface TestDataManager {
  createTestRequest(type: string): RCCRequest;
  createMockProvider(config: ProviderConfig): MockProvider;
  validateTestResult(expected: any, actual: any): boolean;
}
```

## 性能优化设计

### 缓存策略
- 配置缓存: 避免频繁读取配置文件
- 流水线缓存: 复用已创建的流水线
- 响应缓存: 缓存相同请求的响应(可选)

### 并发处理
- 异步处理: 所有I/O操作异步化
- 流水线并行: 多个流水线可并行处理
- 连接池: 复用HTTP连接

### 内存管理
- 及时清理: 销毁不用的流水线
- 内存监控: 监控内存使用情况
- 垃圾回收: 定期清理Debug记录