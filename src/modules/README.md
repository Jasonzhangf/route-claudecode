# 模块系统 (Modules System)

## 模块概述

模块系统是RCC v4.0的核心组件，负责实现流水线Worker中的四层处理架构：Transformer → Protocol → Server-Compatibility → Server。采用官方SDK优先策略，严禁mockup响应，确保真实流水线测试。

## 模块职责

基于最新设计的流水线子模块职责：

1. **Transformer模块**: Anthropic格式与目标协议格式双向转换
2. **Protocol模块**: 协议控制转换，流式和非流式处理
3. **Server-Compatibility模块**: 第三方服务器兼容处理
4. **Server模块**: 与AI服务提供商的实际通信，优先使用官方SDK

## 模块架构设计

### 流水线Worker架构

```
流水线Worker (每个provider.model独立)
┌─────────────────────────────────────────────────────────────────┐
│  openai_gpt-4    │  gemini_2.5-pro  │  lmstudio_llama │ ... │
│ ┌─────────────┐  │ ┌─────────────┐  │ ┌─────────────┐ │     │
│ │Transformer  │  │ │Transformer  │  │ │Transformer  │ │     │
│ │Protocol     │  │ │Protocol     │  │ │Protocol     │ │     │
│ │Server-Comp  │  │ │Server-Comp  │  │ │Server-Comp  │ │     │
│ │Server       │  │ │Server       │  │ │Server       │ │     │
│ └─────────────┘  │ └─────────────┘  │ └─────────────┘ │     │
└─────────────────────────────────────────────────────────────────┘
```

### 四层处理流程

```
Anthropic Request (Claude Code格式)
        │
        ▼
┌─────────────────┐
│  Transformer    │ ── Anthropic → Target Protocol (OpenAI/Gemini/etc)
│                 │ ── 工具调用转换
│                 │ ── 流式处理适配
└─────────────────┘
        │
        ▼
┌─────────────────┐
│   Protocol      │ ── 协议验证和标准化
│                 │ ── 流式控制
│                 │ ── 格式规范化
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ Server-Comp     │ ── 第三方服务器适配
│                 │ ── 参数映射和特殊处理
│                 │ ── LMStudio/Ollama/vLLM兼容
└─────────────────┘
        │
        ▼
┌─────────────────┐
│    Server       │ ── 实际API调用 (官方SDK优先)
│                 │ ── 真实网络通信
│                 │ ── 响应处理和错误管理
└─────────────────┘
        │
        ▼
    AI Service Response
```

## 模块结构 (按最新设计)

```
modules/
├── README.md                                 # 本模块设计文档
├── index.ts                                  # 模块统一导出
├── base-module-impl.ts                       # 基础模块实现
├── pipeline-modules/                         # 流水线子模块 (核心)
│   ├── __tests__/                           # 流水线测试
│   │   └── lmstudio-pipeline.test.ts        # 真实流水线测试
│   ├── base-pipeline-module.ts              # 流水线模块基类
│   ├── index.ts                             # 流水线模块导出
│   ├── lmstudio-pipeline.ts                 # LM Studio完整流水线
│   ├── transformer/                         # 第1层：格式转换
│   │   ├── README.md                        # Transformer设计文档
│   │   └── anthropic-to-openai.ts           # Anthropic→OpenAI转换
│   ├── protocol/                            # 第2层：协议处理
│   │   ├── README.md                        # Protocol设计文档
│   │   └── openai-protocol.ts               # OpenAI协议处理
│   ├── server-compatibility/                # 第3层：兼容性处理
│   │   ├── README.md                        # Server-Compatibility设计文档
│   │   ├── lmstudio-compatibility.ts        # LM Studio兼容
│   │   ├── ollama-compatibility.ts          # Ollama兼容
│   │   └── vllm-compatibility.ts            # vLLM兼容
│   └── server/                              # 第4层：网络通信
│       ├── README.md                        # Server设计文档
│       └── openai-server.ts                 # OpenAI官方SDK
├── providers/                               # Provider管理 (支撑)
│   ├── [现有Provider文件...]               # 现有实现保持
│   └── ...
└── [其他支撑模块保持不变]
```

## 核心接口定义

### 流水线模块基础接口

```typescript
interface PipelineModule {
  name: string;
  version: string;
  layer: PipelineLayer; // 'transformer' | 'protocol' | 'server-compatibility' | 'server'

  initialize(config: ModuleConfig): Promise<void>;
  process(input: any, context: ProcessingContext): Promise<any>;
  healthCheck(): Promise<HealthStatus>;
  shutdown(): Promise<void>;
}
```

### Transformer模块接口

```typescript
interface TransformerModule extends PipelineModule {
  // 正向转换：Anthropic → Target
  transform(input: AnthropicRequest): Promise<TargetRequest>;

  // 反向转换：Target → Anthropic
  reverseTransform(output: TargetResponse): Promise<AnthropicResponse>;

  // 支持的目标协议
  getSupportedProtocols(): string[];
}
```

### Protocol模块接口

```typescript
interface ProtocolModule extends PipelineModule {
  // 请求处理
  processRequest(request: any): Promise<ProcessedRequest>;

  // 响应处理
  processResponse(response: any): Promise<ProcessedResponse>;

  // 流式处理支持
  supportsStreaming(): boolean;
}
```

### Server-Compatibility模块接口

```typescript
interface ServerCompatibilityModule extends PipelineModule {
  // 请求适配
  adaptRequest(request: any): Promise<AdaptedRequest>;

  // 响应适配
  adaptResponse(response: any): Promise<AdaptedResponse>;

  // 目标服务器类型
  getTargetServerType(): string;
}
```

### Server模块接口

```typescript
interface ServerModule extends PipelineModule {
  // 实际API调用
  callAPI(request: any): Promise<any>;

  // 连接健康检查
  checkConnection(): Promise<boolean>;

  // 支持的认证方式
  getSupportedAuthMethods(): string[];
}
```

## 流水线子模块详细说明

### 1. Transformer模块

**职责**: Anthropic格式与目标协议格式双向转换
**支持协议**: OpenAI, Anthropic, Gemini
**核心功能**: 格式转换、工具调用转换、流式处理

```typescript
// src/modules/pipeline-modules/transformer/anthropic-to-openai.ts
export class AnthropicToOpenAITransformer implements TransformerModule {
  async transform(input: AnthropicRequest): Promise<OpenAIRequest> {
    // 消息格式转换
    // 工具调用格式转换
    // 参数映射和适配
  }

  async reverseTransform(output: OpenAIResponse): Promise<AnthropicResponse> {
    // 响应格式转换
    // 错误格式统一
    // 流式响应处理
  }
}
```

### 2. Protocol模块

**职责**: 协议控制转换，流式和非流式处理
**核心功能**: 流式控制、协议验证、格式标准化

```typescript
// src/modules/pipeline-modules/protocol/openai-protocol.ts
export class OpenAIProtocol implements ProtocolModule {
  async processRequest(request: OpenAIRequest): Promise<ProcessedRequest> {
    // 协议格式验证
    // 参数规范化
    // 流式标志处理
  }

  async processResponse(response: any): Promise<OpenAIResponse> {
    // 响应格式验证
    // 错误状态处理
    // 流式数据整合
  }
}
```

### 3. Server-Compatibility模块

**职责**: 第三方服务器兼容处理
**支持服务**: OpenAI, DeepSeek, LMStudio, Gemini, Anthropic
**核心功能**: 请求适配、响应适配、特殊处理

```typescript
// src/modules/pipeline-modules/server-compatibility/lmstudio-compatibility.ts
export class LMStudioCompatibility implements ServerCompatibilityModule {
  async adaptRequest(request: OpenAIRequest): Promise<LMStudioRequest> {
    // LM Studio特殊参数处理
    // 端点URL适配
    // 认证方式调整
  }

  async adaptResponse(response: LMStudioResponse): Promise<OpenAIResponse> {
    // 响应格式统一
    // 错误码映射
    // 元数据补全
  }
}
```

### 4. Server模块 (官方SDK优先)

**职责**: 与AI服务提供商的实际通信
**SDK支持**: 优先使用官方SDK，回退到HTTP客户端
**支持服务**: OpenAI, Anthropic, Gemini, LMStudio, Ollama, CodeWhisperer

```typescript
// src/modules/pipeline-modules/server/openai-server.ts
import OpenAI from 'openai'; // 官方SDK优先

export class OpenAIServer implements ServerModule {
  private client: OpenAI;

  constructor(config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl, // 支持第三方服务
    });
  }

  async callAPI(request: OpenAIRequest): Promise<OpenAIResponse> {
    // 使用官方SDK进行真实API调用
    const response = await this.client.chat.completions.create(request);
    return response;
  }
}
```

## 官方SDK优先策略

### SDK使用优先级

```
官方SDK优先实现
src/modules/pipeline-modules/server/
├── openai/
│   ├── openai-server.ts        # 使用 'openai' SDK
│   └── docs/openai-sdk.md      # OpenAI SDK文档
├── anthropic/
│   ├── anthropic-server.ts     # 使用 '@anthropic-ai/sdk'
│   └── docs/anthropic-sdk.md   # Anthropic SDK文档
├── gemini/
│   ├── gemini-server.ts        # 使用 '@google/generative-ai'
│   └── docs/gemini-sdk.md      # Gemini SDK文档
├── lmstudio/
│   ├── lmstudio-server.ts      # HTTP客户端 (无官方SDK)
│   └── docs/lmstudio-api.md    # LM Studio API文档
└── codewhisperer/
    ├── codewhisperer-server.ts # 使用 '@aws-sdk/client-codewhisperer-runtime'
    └── docs/codewhisperer-sdk.md # CodeWhisperer SDK文档
```

### SDK集成示例

```typescript
// OpenAI官方SDK
import OpenAI from 'openai';

// Anthropic官方SDK
import Anthropic from '@anthropic-ai/sdk';

// Gemini官方SDK
import { GoogleGenerativeAI } from '@google/generative-ai';

// CodeWhisperer官方SDK
import { CodeWhispererRuntimeClient } from '@aws-sdk/client-codewhisperer-runtime';
```

## 质量标准 (严格执行)

### 模块交付检查标准

每个模块完成交付时必须通过以下检查：

- ✅ **无静默失败**: 所有错误通过标准API error handler处理
- ✅ **无mockup响应**: 严禁mockup，必须真实流水线测试
- ✅ **无重复代码**: 模块间功能不重叠
- ✅ **无硬编码**: 所有配置动态加载

### 真实流水线测试要求

```typescript
// 正确的测试方式 (必须)
describe('LMStudio Pipeline Integration', () => {
  it('should complete real end-to-end pipeline', async () => {
    const pipeline = new LMStudioPipeline(realConfig);
    const result = await pipeline.execute(realAnthropicRequest);

    expect(result).toBeDefined();
    expect(result.choices[0].message.content).toBeTruthy();
    expect(result.usage.total_tokens).toBeGreaterThan(0);
  });
});

// 禁止的测试方式 (严禁)
describe('LMStudio Pipeline', () => {
  it('should mock pipeline response', async () => {
    // ❌ 严禁使用Mock
    jest.mock('./lmstudio-server');
    const mockResponse = { choices: [{ message: { content: 'mocked' } }] };
  });
});
```

## 配置管理

### 模块配置结构

```typescript
interface ModuleConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  streamingEnabled?: boolean;
}
```

### 配置文件示例

```json
{
  "modules": {
    "transformer": {
      "anthropic-to-openai": {
        "enabled": true,
        "version": "1.0.0"
      }
    },
    "server": {
      "openai": {
        "apiKey": "${OPENAI_API_KEY}",
        "baseUrl": "https://api.openai.com/v1",
        "timeout": 30000
      },
      "lmstudio": {
        "baseUrl": "http://localhost:1234/v1",
        "timeout": 60000
      }
    }
  }
}
```

## 错误处理规范

### 标准错误类型

```typescript
enum ModuleErrorType {
  CONFIGURATION_ERROR = 'MODULE_CONFIGURATION_ERROR',
  TRANSFORMATION_ERROR = 'MODULE_TRANSFORMATION_ERROR',
  PROTOCOL_ERROR = 'MODULE_PROTOCOL_ERROR',
  COMPATIBILITY_ERROR = 'MODULE_COMPATIBILITY_ERROR',
  SERVER_ERROR = 'MODULE_SERVER_ERROR',
  NETWORK_ERROR = 'MODULE_NETWORK_ERROR',
}
```

### 错误处理实现

```typescript
// 模块中的错误处理
try {
  const result = await this.processRequest(request);
} catch (error) {
  // 必须通过标准API error handler处理
  ErrorHandler.handle(error, {
    module: 'transformer',
    operation: 'anthropic-to-openai',
    provider: this.config.provider,
  });
}
```

## 性能和监控

### 性能指标

- **转换延迟**: Transformer模块 < 10ms
- **协议处理**: Protocol模块 < 5ms
- **兼容性适配**: Server-Compatibility模块 < 5ms
- **网络通信**: Server模块 < 100ms (取决于外部服务)

### 监控集成

```typescript
interface ModuleMetrics {
  processCount: number;
  averageLatency: number;
  errorRate: number;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}
```

## 依赖关系

- **向上依赖**: Pipeline模块使用Modules构建处理流水线
- **向下依赖**: 依赖Types、Config、Debug等支撑模块
- **平级依赖**: 四层模块间按顺序依赖 (Transformer → Protocol → Server-Comp → Server)

## 扩展指南

### 添加新Provider支持

1. 在Server模块中实现新的ServerModule
2. 在Server-Compatibility模块中添加兼容性处理
3. 在Protocol模块中添加协议支持 (如果需要)
4. 在Transformer模块中添加格式转换 (如果需要)

### 添加新的处理层

1. 定义新的模块接口
2. 实现基础模块类
3. 更新流水线组合逻辑
4. 添加配置和测试支持

通过遵循本设计文档，模块系统能够提供高质量、可扩展、可维护的流水线处理能力，确保RCC v4.0的核心功能正确实现。
