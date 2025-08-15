# Transformer模块

## 模块概述

Transformer模块负责Anthropic格式与目标协议格式之间的双向转换，是流水线的第一个处理环节。

## 目录结构

```
src/pipeline/modules/transformer/
├── README.md                    # Transformer模块文档
├── index.ts                     # 模块入口
├── transformer-module.ts        # 基础Transformer类
├── openai-transformer.ts        # OpenAI转换器
├── anthropic-transformer.ts     # Anthropic转换器
├── gemini-transformer.ts        # Gemini转换器
└── types/
    ├── transformer-types.ts     # 转换器类型定义
    ├── anthropic-types.ts       # Anthropic格式类型
    ├── openai-types.ts          # OpenAI格式类型
    └── gemini-types.ts          # Gemini格式类型
```

## 核心功能

### 1. 格式转换
- **Anthropic → Target Protocol**: 请求格式转换
- **Target Protocol → Anthropic**: 响应格式转换
- **双向验证**: 输入输出格式验证
- **工具调用转换**: 不同协议的工具调用格式适配

### 2. 支持的协议
- **OpenAI**: GPT系列模型协议
- **Anthropic**: Claude系列模型协议
- **Gemini**: Google Gemini协议
- **可扩展**: 支持新协议的插件式添加

## 接口定义

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

## 转换规则

### OpenAI转换器
```typescript
// Anthropic → OpenAI
{
  "model": "claude-3-5-sonnet-20241022",
  "messages": [
    {
      "role": "user",
      "content": "Hello"
    }
  ]
}
↓
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "user", 
      "content": "Hello"
    }
  ]
}
```

### Gemini转换器
```typescript
// Anthropic → Gemini
{
  "messages": [
    {
      "role": "user",
      "content": "Hello"
    }
  ]
}
↓
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "Hello"
        }
      ]
    }
  ]
}
```

## 工具调用转换

### Anthropic工具格式
```json
{
  "tools": [
    {
      "name": "get_weather",
      "description": "Get weather information",
      "input_schema": {
        "type": "object",
        "properties": {
          "location": {"type": "string"}
        }
      }
    }
  ]
}
```

### OpenAI工具格式
```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get weather information",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {"type": "string"}
          }
        }
      }
    }
  ]
}
```

### Gemini工具格式
```json
{
  "function_declarations": [
    {
      "name": "get_weather",
      "description": "Get weather information",
      "parameters": {
        "type": "object",
        "properties": {
          "location": {"type": "string"}
        }
      }
    }
  ]
}
```

## 流式处理

### 流式响应转换
- 保持流式特性不变
- 逐块转换响应格式
- 处理不同协议的流式标记

### 错误处理
- 格式验证失败时抛出VALIDATION_ERROR
- 使用标准API error handler
- 包含具体的转换错误信息

## 实现示例

```typescript
export class OpenAITransformer implements TransformerModule {
  name = 'transformer' as const;
  targetProtocol = 'openai';

  async transformRequest(anthropicRequest: AnthropicRequest): Promise<OpenAIRequest> {
    // 验证输入格式
    if (!this.validateAnthropicRequest(anthropicRequest)) {
      throw new ValidationError('Invalid Anthropic request format');
    }

    // 执行转换
    const openaiRequest: OpenAIRequest = {
      model: this.mapModel(anthropicRequest.model),
      messages: this.convertMessages(anthropicRequest.messages),
      tools: this.convertTools(anthropicRequest.tools),
      stream: anthropicRequest.stream
    };

    return openaiRequest;
  }

  async transformResponse(openaiResponse: OpenAIResponse): Promise<AnthropicResponse> {
    // 验证响应格式
    if (!this.validateProtocolResponse(openaiResponse)) {
      throw new ValidationError('Invalid OpenAI response format');
    }

    // 执行转换
    return {
      id: openaiResponse.id,
      type: 'message',
      role: 'assistant',
      content: this.convertContent(openaiResponse.choices[0].message.content),
      model: anthropicRequest.model,
      usage: this.convertUsage(openaiResponse.usage)
    };
  }
}
```

## 质量要求

- ✅ 无静默失败
- ✅ 无mockup转换
- ✅ 无重复转换代码
- ✅ 无硬编码协议格式
- ✅ 完整的格式验证
- ✅ 双向转换支持
- ✅ 工具调用完整支持