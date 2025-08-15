# RCC v4.0 架构设计规则

## 架构总览

### 严格模块化架构约束

RCC v4.0 采用严格模块化架构，每个模块都有明确的职责边界和接口定义。违反架构约束的代码将被拒绝。

## 模块层级架构

### 六层架构模型

```
┌─────────────────────────────────────────────────────────────────┐
│                    Level 1: Client Layer                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   CLI管理器      │  │   HTTP服务器     │  │   错误处理器     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Level 2: Router Layer                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   配置管理器     │  │   请求路由器     │  │   流水线管理器   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                Level 3: Pipeline Worker Pool                   │
│                                                                 │
│  Pipeline A (OpenAI)     Pipeline B (Anthropic)               │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │  Transformer    │    │  Transformer    │                    │
│  │  Protocol       │    │  Protocol       │                    │
│  │  Server-Compat  │    │  Server-Compat  │                    │
│  │  Server         │    │  Server         │                    │
│  └─────────────────┘    └─────────────────┘                    │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Level 4: Support Systems                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Debug系统      │  │   配置系统       │  │   类型系统       │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 依赖关系约束

#### 允许的依赖关系
```typescript
// ✅ 允许：上层模块依赖下层模块
import { ConfigManager } from '../config';
import { ErrorHandler } from '../error-handler';

// ✅ 允许：同层模块通过标准接口通信
import { RouterInterface } from '../router/types';

// ✅ 允许：所有模块都可以依赖类型定义
import { RCCRequest, RCCResponse } from '../types';
```

#### 禁止的依赖关系
```typescript
// ❌ 禁止：下层模块依赖上层模块
// 在 config 模块中
import { ClientManager } from '../client'; // 违反架构

// ❌ 禁止：跨越层级依赖
// 在 client 模块中
import { Transformer } from '../pipeline/transformer'; // 必须通过 router

// ❌ 禁止：流水线模块间直接依赖
// 在 transformer 模块中
import { ServerModule } from '../server'; // 必须通过流水线框架
```

## 模块职责定义

### 客户端模块 (Client Module)

#### 职责范围
- **CLI命令处理**: `rcc start`, `rcc stop`, `rcc code`, `rcc status`
- **HTTP服务器管理**: 启动、停止、状态监控
- **统一错误处理**: 所有模块错误的最终出口
- **用户交互界面**: 处理用户输入输出

#### 禁止处理的职责
```typescript
// ❌ 禁止：客户端模块不应处理请求路由
class ClientModule {
  processRequest(request: RCCRequest): Promise<RCCResponse> {
    // 不应该在这里做路由决策
    if (request.model === 'gpt-4') {
      return this.callOpenAI(request); // 违反职责边界
    }
  }
}

// ✅ 正确：委托给路由器模块
class ClientModule {
  async processRequest(request: RCCRequest): Promise<RCCResponse> {
    try {
      return await this.routerManager.routeRequest(request);
    } catch (error) {
      this.handleError(error); // 只负责错误处理
      throw error;
    }
  }
}
```

### 路由器模块 (Router Module)

#### 职责范围
- **配置管理**: 读取和验证Provider配置
- **请求路由**: 根据路由表分发请求
- **负载均衡**: 多Provider和多Key负载均衡
- **流水线生命周期管理**: 动态创建和销毁流水线
- **会话流控**: 基于session.conversationID.requestID的流控

#### 架构约束
```typescript
// ✅ 正确：路由器职责
class RouterManager {
  async routeRequest(request: RCCRequest): Promise<RCCResponse> {
    // 1. 根据配置选择Provider
    const provider = this.selectProvider(request);
    
    // 2. 获取或创建流水线
    const pipeline = await this.getPipeline(provider);
    
    // 3. 委托给流水线处理
    return await pipeline.process(request);
  }
  
  // ❌ 禁止：不应处理具体的格式转换
  private transformRequest(request: RCCRequest): any {
    // 这是 Transformer 模块的职责
  }
}
```

### 流水线Worker模块 (Pipeline Worker)

#### 流水线组成架构
```typescript
interface PipelineWorker {
  readonly id: string;
  readonly provider: string;
  readonly model: string;
  
  // 流水线组件（按顺序执行）
  readonly transformer: TransformerModule;
  readonly protocol: ProtocolModule;
  readonly serverCompatibility: ServerCompatibilityModule;
  readonly server: ServerModule;
  
  process(request: RCCRequest): Promise<RCCResponse>;
}
```

#### 流水线隔离约束
```typescript
// ✅ 正确：每个Provider.Model一个独立流水线
class PipelineManager {
  private pipelines: Map<string, PipelineWorker> = new Map();
  
  async getPipeline(provider: string, model: string): Promise<PipelineWorker> {
    const key = `${provider}.${model}`;
    
    if (!this.pipelines.has(key)) {
      // 动态创建独立流水线
      const pipeline = await this.createPipeline(provider, model);
      this.pipelines.set(key, pipeline);
    }
    
    return this.pipelines.get(key)!;
  }
}

// ❌ 禁止：流水线间共享状态
class BadPipelineManager {
  private sharedTransformer: TransformerModule; // 违反隔离原则
  
  createPipeline(provider: string): PipelineWorker {
    return new PipelineWorker(this.sharedTransformer); // 错误
  }
}
```

## 流水线子模块架构

### Transformer模块

#### 职责定义
```typescript
interface TransformerModule {
  // 主要职责：格式转换
  transformRequest(
    anthropicRequest: AnthropicRequest,
    targetProtocol: Protocol
  ): Promise<ProtocolRequest>;
  
  transformResponse(
    protocolResponse: ProtocolResponse,
    sourceProtocol: Protocol
  ): Promise<AnthropicResponse>;
}

// ✅ 正确：专注格式转换
class OpenAITransformer implements TransformerModule {
  async transformRequest(
    anthropicRequest: AnthropicRequest,
    targetProtocol: 'openai'
  ): Promise<OpenAIRequest> {
    return {
      model: anthropicRequest.model,
      messages: anthropicRequest.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      max_tokens: anthropicRequest.max_tokens,
      stream: anthropicRequest.stream
    };
  }
}

// ❌ 禁止：处理网络请求
class BadTransformer {
  async transformRequest(request: AnthropicRequest): Promise<any> {
    const transformed = this.doTransform(request);
    
    // 不应该在Transformer中发起网络请求
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify(transformed)
    });
    
    return response.json(); // 这是Server模块的职责
  }
}
```

### Protocol模块

#### 职责定义
```typescript
interface ProtocolModule {
  // 主要职责：协议控制转换
  handleStreamRequest(request: ProtocolRequest): Promise<ProtocolRequest>;
  handleStreamResponse(response: ProtocolResponse): Promise<ProtocolResponse>;
  validateProtocol(data: any): asserts data is ProtocolData;
}

// ✅ 正确：专注协议控制
class OpenAIProtocolModule implements ProtocolModule {
  async handleStreamRequest(request: OpenAIRequest): Promise<OpenAIRequest> {
    if (request.stream) {
      // 流式请求的协议处理
      return {
        ...request,
        stream_options: { include_usage: true }
      };
    }
    return request;
  }
  
  validateProtocol(data: any): asserts data is OpenAIRequest {
    if (!data.model || !data.messages) {
      throw new ProtocolError('Invalid OpenAI request format');
    }
  }
}
```

### Server-Compatibility模块

#### 职责定义
```typescript
interface ServerCompatibilityModule {
  // 主要职责：第三方服务器兼容处理
  adaptRequest(request: ProtocolRequest): Promise<ServerSpecificRequest>;
  adaptResponse(response: ServerSpecificResponse): Promise<ProtocolResponse>;
}

// ✅ 正确：处理特定服务器的兼容性
class DeepSeekCompatibilityModule implements ServerCompatibilityModule {
  async adaptRequest(request: OpenAIRequest): Promise<DeepSeekRequest> {
    // DeepSeek特定的请求适配
    return {
      ...request,
      // DeepSeek不支持某些参数，需要移除
      temperature: Math.min(request.temperature || 1, 2), // DeepSeek限制
      // 添加DeepSeek特定参数
      repetition_penalty: 1.1
    };
  }
}
```

### Server模块

#### 职责定义
```typescript
interface ServerModule {
  // 主要职责：与AI服务提供商的实际通信
  sendRequest(request: ServerSpecificRequest): Promise<ServerSpecificResponse>;
  handleError(error: NetworkError): Promise<ErrorResponse>;
  checkHealth(): Promise<HealthStatus>;
}

// ✅ 正确：使用SDK或HTTP客户端
class OpenAIServerModule implements ServerModule {
  constructor(
    private apiKey: string,
    private baseUrl: string
  ) {
    // 优先使用官方SDK
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl
    });
  }
  
  async sendRequest(request: OpenAIRequest): Promise<OpenAIResponse> {
    try {
      if (request.stream) {
        return await this.handleStreamRequest(request);
      } else {
        return await this.client.chat.completions.create(request);
      }
    } catch (error) {
      throw new NetworkError('OpenAI API call failed', { error, request });
    }
  }
}
```

## 数据流架构约束

### 标准数据流
```
AnthropicRequest → Transformer → ProtocolRequest → Protocol → 
ServerCompatibility → Server → [External API] → Server → 
ServerCompatibility → Protocol → Transformer → AnthropicResponse
```

### 数据流验证
```typescript
// 每个模块必须验证输入输出
abstract class BaseModule {
  protected abstract validateInput(input: any): void;
  protected abstract validateOutput(output: any): void;
  
  async process(input: any): Promise<any> {
    this.validateInput(input);
    const output = await this.doProcess(input);
    this.validateOutput(output);
    return output;
  }
  
  protected abstract doProcess(input: any): Promise<any>;
}
```

## 错误处理架构

### 错误边界定义
```typescript
// 每个模块都有明确的错误边界
class ModuleErrorBoundary {
  constructor(
    private moduleName: string,
    private errorHandler: ErrorHandler
  ) {}
  
  async executeWithErrorBoundary<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const moduleError = this.createModuleError(error, context);
      this.errorHandler.handleError(moduleError);
      throw moduleError;
    }
  }
  
  private createModuleError(error: any, context: string): RCCError {
    return {
      id: generateErrorId(),
      type: this.getErrorType(error),
      module: this.moduleName,
      message: `${this.moduleName} error in ${context}`,
      details: error,
      timestamp: Date.now()
    };
  }
}
```

## 配置架构约束

### 配置层级结构
```typescript
interface ArchitecturalConfig {
  // 全局配置
  global: {
    environment: 'development' | 'production' | 'test';
    debug: boolean;
    logLevel: string;
  };
  
  // 模块级配置
  modules: {
    client: ClientModuleConfig;
    router: RouterModuleConfig;
    pipeline: PipelineModuleConfig;
    debug: DebugModuleConfig;
  };
  
  // 流水线配置
  pipelines: {
    [providerModel: string]: PipelineConfig;
  };
}
```

### 配置访问约束
```typescript
// ✅ 正确：模块只能访问自己的配置
class ClientModule {
  constructor(config: ClientModuleConfig) {
    // 只能访问客户端模块配置
    this.port = config.server.port;
  }
}

// ❌ 禁止：跨模块配置访问
class ClientModule {
  constructor(globalConfig: ArchitecturalConfig) {
    // 不应该直接访问其他模块配置
    this.pipelineTimeout = globalConfig.modules.pipeline.timeout; // 违反边界
  }
}
```

## 接口设计约束

### 标准接口模式
```typescript
// 所有模块必须实现标准接口
interface ModuleInterface {
  readonly name: string;
  readonly version: string;
  
  initialize(config: ModuleConfig): Promise<void>;
  process(input: ModuleInput): Promise<ModuleOutput>;
  shutdown(): Promise<void>;
  getStatus(): ModuleStatus;
}

// 模块间通信接口
interface InterModuleCommunication {
  sendMessage(targetModule: string, message: ModuleMessage): Promise<void>;
  subscribeToEvents(eventType: string, handler: EventHandler): void;
  unsubscribe(eventType: string, handler: EventHandler): void;
}
```

### 接口版本控制
```typescript
// 接口必须包含版本信息
interface VersionedInterface {
  readonly interfaceVersion: string;
  readonly compatibility: string[];
  
  // 向后兼容性检查
  isCompatibleWith(version: string): boolean;
}
```

## 部署架构约束

### 模块独立部署
```typescript
// 每个模块必须支持独立部署
interface DeployableModule {
  readonly deploymentUnit: string;
  readonly dependencies: string[];
  readonly ports: number[];
  readonly healthEndpoint: string;
  
  deploy(environment: DeploymentEnvironment): Promise<void>;
  undeploy(): Promise<void>;
  checkHealth(): Promise<HealthStatus>;
}
```

### 配置隔离
```bash
# 部署时配置结构
/opt/rcc/
├── modules/
│   ├── client/
│   │   ├── config.json
│   │   └── secrets/
│   ├── router/
│   │   ├── config.json
│   │   └── secrets/
│   └── pipeline/
│       ├── config.json
│       └── secrets/
└── shared/
    ├── types/
    └── common/
```

## 监控和观测架构

### 模块级监控
```typescript
interface ModuleMonitoring {
  readonly metrics: ModuleMetrics;
  readonly logs: ModuleLogs;
  readonly traces: ModuleTraces;
  
  reportMetric(name: string, value: number, tags?: Record<string, string>): void;
  logEvent(level: LogLevel, message: string, context?: any): void;
  startTrace(operationName: string): TraceSpan;
}
```

### 架构健康检查
```typescript
class ArchitecturalHealthCheck {
  async checkArchitecturalCompliance(): Promise<ComplianceReport> {
    return {
      moduleIsolation: await this.checkModuleIsolation(),
      dependencyCompliance: await this.checkDependencyCompliance(),
      interfaceCompliance: await this.checkInterfaceCompliance(),
      errorHandlingCompliance: await this.checkErrorHandlingCompliance()
    };
  }
}
```

## 总结

这些架构规则确保了：

1. **严格模块化**: 明确的职责边界和依赖关系
2. **数据流清晰**: 标准化的数据流转路径
3. **错误隔离**: 每个模块的错误边界明确
4. **配置独立**: 模块级配置管理和访问控制
5. **接口标准化**: 统一的模块间通信接口
6. **部署灵活性**: 支持模块独立部署和扩展
7. **监控完整性**: 全面的架构监控和健康检查

**违反任何架构约束的代码都将被拒绝，确保系统的一致性和可维护性。**