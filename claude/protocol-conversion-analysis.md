# Claude Code Router协议转换字段分析

## 1. Anthropic到OpenAI请求转换字段映射

### 1.1 基本字段转换
| Anthropic字段 | OpenAI字段 | 转换规则 |
|---------------|------------|----------|
| model | model | 直接映射 |
| messages | messages | 格式转换 |
| system | system消息 | 转换为messages中的system角色 |
| max_tokens | max_tokens | 直接映射 |
| temperature | temperature | 直接映射 |
| top_p | top_p | 直接映射 |
| stop_sequences | stop | 数组映射 |
| stream | stream | 直接映射 |

### 1.2 消息格式转换
**Anthropic消息格式:**
```json
{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "Hello"
    }
  ]
}
```

**OpenAI消息格式:**
```json
{
  "role": "user",
  "content": "Hello"
}
```

### 1.3 工具格式转换
**Anthropic工具格式:**
```json
{
  "name": "list_files",
  "description": "List files in directory",
  "input_schema": {
    "type": "object",
    "properties": {
      "path": {"type": "string"}
    }
  }
}
```

**OpenAI工具格式:**
```json
{
  "type": "function",
  "function": {
    "name": "list_files",
    "description": "List files in directory",
    "parameters": {
      "type": "object",
      "properties": {
        "path": {"type": "string"}
      }
    }
  }
}
```

## 2. OpenAI到Anthropic响应转换字段映射

### 2.1 基本字段转换
| OpenAI字段 | Anthropic字段 | 转换规则 |
|------------|---------------|----------|
| id | id | 直接映射 |
| object | type | "chat.completion" → "message" |
| created | - | 丢弃 |
| model | model | 直接映射 |
| choices | content | 结构转换 |
| usage | - | 转换为内部使用 |

### 2.2 响应格式转换
**OpenAI响应格式:**
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello!",
        "tool_calls": [
          {
            "id": "call_123",
            "type": "function",
            "function": {
              "name": "list_files",
              "arguments": "{\"path\": \".\"}"
            }
          }
        ]
      }
    }
  ]
}
```

**Anthropic响应格式:**
```json
{
  "id": "msg_123",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Hello!"
    }
  ]
}
```

## 3. OpenAI协议内特殊字段转换逻辑

### 3.1 流式处理字段
- `stream: true` → 转换为非流式请求发送给不支持流式的Provider
- `stream: false` → 直接发送

### 3.2 工具调用字段
- `tool_choice` → 转换为Provider特定的工具选择机制
- `tools` → 标准化为OpenAI格式

### 3.3 参数范围限制
- `temperature`: 0.0-2.0 → Provider特定范围
- `top_p`: 0.0-1.0 → Provider特定范围
- `max_tokens`: 根据Provider限制调整

## 4. Provider特定兼容性处理

### 4.1 iFlow兼容性处理
- `top_k` 参数计算：基于temperature动态计算
- 模型名称映射：配置驱动的模型名称转换
- 认证方式：Bearer Token格式化

### 4.2 Qwen兼容性处理
- 工具调用对话流修复：确保tool_calls后有对应的tool消息
- 响应格式标准化：修复choices和tool_calls格式

### 4.3 ModelScope兼容性处理
- 工具格式转换：Anthropic ↔ OpenAI工具格式转换
- 模型名称映射：从__internal对象获取实际模型名

这个分析为实现兼容性模块提供了详细的字段转换规则和处理逻辑。