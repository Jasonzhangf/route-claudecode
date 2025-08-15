# Protocol模块

## 模块概述

Protocol模块负责协议控制转换，主要处理流式和非流式请求之间的转换，以及协议标准验证。

## 目录结构

```
src/pipeline/modules/protocol/
├── README.md                    # Protocol模块文档
├── index.ts                     # 模块入口
├── protocol-module.ts           # 基础Protocol类
├── openai-protocol.ts           # OpenAI协议处理
├── anthropic-protocol.ts        # Anthropic协议处理
├── gemini-protocol.ts           # Gemini协议处理
└── types/
    ├── protocol-types.ts        # 协议类型定义
    ├── stream-types.ts          # 流式处理类型
    └── validation-types.ts      # 验证相关类型
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

## 协议处理

### OpenAI协议处理
```typescript
export class OpenAIProtocol implements ProtocolModule {
  name = 'protocol' as const;
  protocol = 'openai';

  async convertToNonStreaming(streamRequest: OpenAIStreamRequest): Promise<OpenAINonStreamRequest> {
    // 移除流式标志
    const nonStreamRequest = { ...streamRequest };
    delete nonStreamRequest.stream;
    
    return nonStreamRequest;
  }

  async convertToStreaming(nonStreamResponse: OpenAINonStreamResponse): Promise<OpenAIStreamResponse> {
    // 将单个响应转换为流式响应
    const streamChunks = this.createStreamChunks(nonStreamResponse);
    return this.generateStreamResponse(streamChunks);
  }

  validateProtocolRequest(request: OpenAIRequest): boolean {
    // 验证必需字段
    if (!request.model || !request.messages) {
      return false;
    }
    
    // 验证messages格式
    return this.validateMessages(request.messages);
  }
}
```

### Anthropic协议处理
```typescript
export class AnthropicProtocol implements ProtocolModule {
  name = 'protocol' as const;
  protocol = 'anthropic';

  validateProtocolRequest(request: AnthropicRequest): boolean {
    // 验证Anthropic特有字段
    if (!request.model || !request.messages) {
      return false;
    }
    
    // 验证max_tokens字段
    if (!request.max_tokens || request.max_tokens <= 0) {
      return false;
    }
    
    return this.validateAnthropicMessages(request.messages);
  }
}
```

### Gemini协议处理
```typescript
export class GeminiProtocol implements ProtocolModule {
  name = 'protocol' as const;
  protocol = 'gemini';

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
  // stream字段被移除
  // 其他请求参数保持不变
}
```

### 流式响应生成
```typescript
interface StreamResponse {
  chunks: StreamChunk[];
  metadata: StreamMetadata;
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