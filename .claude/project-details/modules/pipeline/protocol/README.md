# 协议模块 (Protocol Module)

## 模块概述

协议模块负责协议控制转换，主要处理流式和非流式请求之间的转换，以及协议标准验证。该模块实现了ModuleInterface接口，支持API化管理。

## 目录结构

```
protocol/
├── README.md                    # 协议模块文档
├── openai-protocol.ts           # OpenAI协议处理模块
├── gemini-protocol.ts           # Gemini协议处理模块
├── gemini-native-protocol.ts    # Gemini原生协议处理模块
└── base-pipeline-module.ts      # 基础流水线模块类
```

## 核心功能

### 1. 流式控制转换
- **流式 → 非流式**: 将流式请求转换为非流式请求发送给下游
- **非流式 → 流式**: 将非流式响应转换为流式响应返回上游
- **流式状态管理**: 维护流式处理的状态信息

### 2. 协议验证
- **请求验证**: 验证协议请求格式的正确性
- **响应验证**: 验证协议响应格式的正确性
- **字段完整性**: 检查必需字段的存在性

### 3. 协议标准化
- **格式统一**: 确保协议格式符合标准
- **参数校正**: 修正不符合标准的参数
- **兼容性处理**: 处理协议版本差异

## 接口定义

```typescript
interface ModuleInterface {
  // 基础信息
  getId(): string;
  getName(): string;
  getType(): ModuleType;
  getVersion(): string;
  
  // 状态管理
  getStatus(): ModuleStatus;
  getMetrics(): ModuleMetrics;
  
  // 生命周期
  configure(config: any): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  process(input: any): Promise<any>;
  reset(): Promise<void>;
  cleanup(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; details: any }>;
  
  // 模块间通信
  addConnection(module: ModuleInterface): void;
  removeConnection(moduleId: string): void;
  getConnection(moduleId: string): ModuleInterface | undefined;
  getConnections(): ModuleInterface[];
  sendToModule(targetModuleId: string, message: any, type?: string): Promise<any>;
  broadcastToModules(message: any, type?: string): Promise<void>;
  onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void): void;
}
```

## 协议处理

### OpenAI协议处理
```typescript
export class OpenAIProtocolModule extends EventEmitter implements ModuleInterface {
  async process(
    input: StreamRequest | NonStreamRequest | NonStreamResponse
  ): Promise<NonStreamRequest | StreamResponse> {
    if (this.isStreamRequest(input)) {
      return this.convertToNonStreaming(input as StreamRequest);
    } else if (this.isNonStreamRequest(input)) {
      return input as NonStreamRequest;
    } else if (this.isNonStreamResponse(input)) {
      return this.convertToStreaming(input as NonStreamResponse);
    } else {
      throw new Error('不支持的输入格式');
    }
  }

  convertToNonStreaming(streamRequest: StreamRequest): NonStreamRequest {
    // 移除流式标志
    const nonStreamRequest: NonStreamRequest = {
      model: streamRequest.model,
      messages: streamRequest.messages,
      max_tokens: streamRequest.max_tokens,
      temperature: streamRequest.temperature,
      top_p: streamRequest.top_p,
      frequency_penalty: streamRequest.frequency_penalty,
      presence_penalty: streamRequest.presence_penalty,
      stop: streamRequest.stop,
      stream: false, // 转换为非流式
      tools: streamRequest.tools,
      tool_choice: streamRequest.tool_choice,
    };
    
    return nonStreamRequest;
  }

  convertToStreaming(nonStreamResponse: NonStreamResponse): StreamResponse {
    // 将单个响应转换为流式响应
    const chunks = this.createStreamChunks(nonStreamResponse);
    return {
      chunks,
      aggregatedResponse: nonStreamResponse
    };
  }
}
```

### Gemini协议处理
```typescript
export class GeminiProtocolModule extends EventEmitter implements ModuleInterface {
  // Gemini协议特有处理逻辑
  validateProtocolRequest(request: GeminiRequest): boolean {
    // 验证Gemini特有字段
    if (!request.contents || !Array.isArray(request.contents)) {
      return false;
    }
    
    // 验证contents格式
    return this.validateGeminiContents(request.contents);
  }
}
```

## 流式处理机制

### 流式请求处理
```typescript
interface StreamRequest {
  stream: true;
  // 其他请求参数
}

interface NonStreamRequest {
  // stream字段被移除或设为false
  // 其他请求参数保持不变
}
```

### 流式响应生成
```typescript
interface StreamResponse {
  chunks: StreamChunk[];
  aggregatedResponse: NonStreamResponse;
}

interface StreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: StreamChoice[];
}
```

### 流式状态管理
```typescript
class StreamStateManager {
  private activeStreams: Map<string, StreamState> = new Map();
  
  createStream(requestId: string): StreamState {
    const state = new StreamState(requestId);
    this.activeStreams.set(requestId, state);
    return state;
  }
  
  closeStream(requestId: string): void {
    this.activeStreams.delete(requestId);
  }
}
```

## 协议验证规则

### OpenAI协议验证
```typescript
const openaiValidationRules = {
  required: ['model', 'messages'],
  optional: ['temperature', 'max_tokens', 'stream', 'tools'],
  messages: {
    required: ['role', 'content'],
    roles: ['system', 'user', 'assistant', 'tool']
  }
};
```

### Anthropic协议验证
```typescript
const anthropicValidationRules = {
  required: ['model', 'max_tokens', 'messages'],
  optional: ['temperature', 'stream', 'tools'],
  messages: {
    required: ['role', 'content'],
    roles: ['user', 'assistant']
  }
};
```

### Gemini协议验证
```typescript
const geminiValidationRules = {
  required: ['contents'],
  optional: ['generationConfig', 'safetySettings', 'tools'],
  contents: {
    required: ['role', 'parts'],
    roles: ['user', 'model']
  }
};
```

## 错误处理

### 验证错误
```typescript
class ProtocolValidationError extends Error {
  constructor(protocol: string, field: string, message: string) {
    super(`Protocol validation failed for ${protocol}.${field}: ${message}`);
    this.name = 'ProtocolValidationError';
  }
}
```

### 转换错误
```typescript
class StreamConversionError extends Error {
  constructor(direction: 'to-stream' | 'to-non-stream', message: string) {
    super(`Stream conversion failed (${direction}): ${message}`);
    this.name = 'StreamConversionError';
  }
}
```

## 性能优化

### 流式缓冲
- 合理的缓冲区大小
- 及时释放已处理的数据
- 内存使用监控

### 验证缓存
- 缓存验证结果
- 避免重复验证
- 智能缓存失效

## 质量要求

- ✅ 无静默失败
- ✅ 无mockup协议处理
- ✅ 无重复协议代码
- ✅ 无硬编码协议规则
- ✅ 完整的协议验证
- ✅ 流式处理支持
- ✅ 标准错误处理
- ✅ API化管理支持
- ✅ 模块化接口实现