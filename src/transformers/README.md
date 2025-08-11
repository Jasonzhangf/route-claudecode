# Message Format Transformers

这个模块提供了成熟的消息格式转换功能，支持在不同LLM API格式之间进行转换，特别是OpenAI和Anthropic格式。

## 特性

- 🔄 **双向转换**: OpenAI ↔ Anthropic 格式互转
- 🛠️ **工具调用支持**: 完整的工具调用格式转换
- 📡 **流式处理**: 实时流式响应转换
- 🎯 **统一接口**: 通过统一格式作为中间层
- 🔍 **格式检测**: 自动检测请求格式
- 📊 **详细日志**: 完整的转换过程日志

## 架构设计

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   OpenAI    │◄──►│   Unified   │◄──►│  Anthropic  │
│   Format    │    │   Format    │    │   Format    │
└─────────────┘    └─────────────┘    └─────────────┘
```

所有转换都通过统一格式作为中间层，确保一致性和可扩展性。

## 快速开始

### 基本使用

```typescript
import { 
  transformOpenAIToAnthropic, 
  transformAnthropicToOpenAI,
  transformationManager 
} from '@/transformers';

// OpenAI -> Anthropic
const openaiRequest = {
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
};
const anthropicRequest = transformOpenAIToAnthropic(openaiRequest);

// Anthropic -> OpenAI
const anthropicRequest = {
  model: 'claude-3-sonnet',
  messages: [{ role: 'user', content: 'Hello!' }]
};
const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
```

### 工具调用转换

```typescript
// OpenAI格式的工具调用
const openaiWithTools = {
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'What is the weather?' },
    {
      role: 'assistant',
      tool_calls: [{
        id: 'call_123',
        type: 'function',
        function: {
          name: 'get_weather',
          arguments: '{"location": "NYC"}'
        }
      }]
    },
    {
      role: 'tool',
      content: '{"temp": 22}',
      tool_call_id: 'call_123'
    }
  ],
  tools: [{
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get weather info',
      parameters: { /* schema */ }
    }
  }]
};

// 转换为Anthropic格式
const anthropicWithTools = transformOpenAIToAnthropic(openaiWithTools);
```

### 流式处理

```typescript
import { transformationManager } from '@/transformers';

// 创建流式转换器
const streamOptions = {
  sourceFormat: 'openai' as const,
  targetFormat: 'anthropic' as const,
  model: 'gpt-4',
  requestId: 'req-123'
};

// 转换流式响应
async function handleStream(originalStream: ReadableStream) {
  for await (const chunk of transformationManager.transformStream(originalStream, streamOptions)) {
    console.log(chunk); // Anthropic格式的SSE事件
  }
}
```

### 自定义转换上下文

```typescript
import { TransformationContext } from '@/transformers';

const context: TransformationContext = {
  sourceProvider: 'openai',
  targetProvider: 'anthropic',
  preserveToolCalls: true,
  preserveSystemMessages: true
};

const transformed = transformationManager.transformRequest(
  request, 
  context, 
  'request-id'
);
```

## 在Provider中使用

### 增强的OpenAI客户端

```typescript
import { EnhancedOpenAIClient } from '@/providers/openai/enhanced-client';

// 使用增强客户端，自动处理格式转换
const client = new EnhancedOpenAIClient(config, 'shuaihong-openai');

// 发送请求（自动转换格式）
const response = await client.sendRequest(baseRequest);

// 流式请求（自动转换流格式）
for await (const chunk of client.sendStreamRequest(baseRequest)) {
  // 处理Anthropic格式的流式响应
}
```

### 在现有Provider中集成

```typescript
import { transformAnthropicToOpenAI, transformOpenAIResponseToAnthropic } from '@/transformers';

class MyOpenAIProvider implements Provider {
  async sendRequest(request: BaseRequest): Promise<BaseResponse> {
    // 1. 转换请求格式
    const openaiRequest = transformAnthropicToOpenAI({
      model: request.model,
      messages: request.messages,
      system: request.metadata?.system,
      tools: request.metadata?.tools
    });

    // 2. 发送到OpenAI API
    const response = await this.httpClient.post('/chat/completions', openaiRequest);

    // 3. 转换响应格式
    const anthropicResponse = transformOpenAIResponseToAnthropic(response.data);

    // 4. 转换为BaseResponse
    return this.convertToBaseResponse(anthropicResponse);
  }
}
```

## 格式检测

```typescript
import { transformationManager } from '@/transformers';

const format = transformationManager.detectRequestFormat(request);
// 返回: 'openai' | 'anthropic' | 'unknown'

switch (format) {
  case 'openai':
    // 处理OpenAI格式
    break;
  case 'anthropic':
    // 处理Anthropic格式
    break;
  default:
    // 未知格式
}
```

## 支持的转换

### 消息格式

| 特性 | OpenAI | Anthropic | 转换支持 |
|------|--------|-----------|----------|
| 基本消息 | ✅ | ✅ | ✅ |
| 系统消息 | messages[0] | system字段 | ✅ |
| 工具调用 | tool_calls | content.tool_use | ✅ |
| 工具结果 | tool role | content.tool_result | ✅ |
| 流式响应 | SSE chunks | SSE events | ✅ |

### 工具调用映射

```typescript
// OpenAI格式
{
  tool_calls: [{
    id: "call_123",
    type: "function",
    function: {
      name: "get_weather",
      arguments: '{"location": "NYC"}'
    }
  }]
}

// 转换为Anthropic格式
{
  content: [{
    type: "tool_use",
    id: "call_123",
    name: "get_weather",
    input: { location: "NYC" }
  }]
}
```

## 错误处理

```typescript
try {
  const transformed = transformOpenAIToAnthropic(request);
} catch (error) {
  if (error.message.includes('transformer not found')) {
    // 处理转换器未找到错误
  } else {
    // 处理其他转换错误
  }
}
```

## 扩展自定义转换器

```typescript
import { MessageTransformer, UnifiedRequest, UnifiedResponse } from '@/transformers';

class CustomTransformer implements MessageTransformer {
  name = 'custom';

  transformRequestToUnified(request: any): UnifiedRequest {
    // 实现自定义格式到统一格式的转换
  }

  transformRequestFromUnified(request: UnifiedRequest): any {
    // 实现统一格式到自定义格式的转换
  }

  // ... 其他必需方法
}

// 注册自定义转换器
transformationManager.registerTransformer('custom', new CustomTransformer());
```

## 调试和监控

```typescript
// 获取转换器统计信息
const stats = transformationManager.getStats();
console.log('Available transformers:', stats.availableTransformers);

// 启用详细日志
import { logger } from '@/utils/logger';
logger.setLevel('trace'); // 查看详细转换日志
```

## 最佳实践

1. **使用统一接口**: 优先使用 `transformationManager` 而不是直接调用转换器
2. **错误处理**: 始终包装转换调用在try-catch中
3. **请求ID**: 传递requestId以便于调试和追踪
4. **格式检测**: 在不确定格式时使用 `detectRequestFormat`
5. **流式处理**: 对于实时应用使用流式转换器

## 性能考虑

- 转换器实例会被缓存，避免重复创建
- 流式转换使用异步生成器，内存效率高
- 大型消息会被分块处理，避免内存溢出
- 工具调用转换经过优化，处理复杂嵌套结构

## 故障排除

### 常见问题

1. **工具调用丢失**: 检查工具定义格式是否正确
2. **系统消息位置错误**: 确保使用正确的转换方向
3. **流式响应中断**: 检查网络连接和错误处理
4. **格式检测失败**: 手动指定源格式和目标格式

### 调试技巧

```typescript
// 启用详细日志
process.env.LOG_LEVEL = 'trace';

// 检查转换前后的数据
console.log('Before:', JSON.stringify(originalRequest, null, 2));
const transformed = transformOpenAIToAnthropic(originalRequest);
console.log('After:', JSON.stringify(transformed, null, 2));
```

这个转换系统提供了完整的格式转换能力，特别针对多轮对话和工具调用场景进行了优化，可以显著改善shuaihong provider的兼容性问题。