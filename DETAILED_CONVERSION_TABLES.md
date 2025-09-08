# Detailed Field Conversion Tables: Anthropic ↔ OpenAI Protocol

## Quick Reference Tables

### Request Field Conversions (Anthropic → OpenAI)

| Source (Anthropic) | Target (OpenAI) | Transform Type | Validation | Default Value | Notes |
|-------------------|-----------------|----------------|------------|---------------|-------|
| `model` | `model` | `direct` | String validation | Required field | Model name mapping may apply |
| `messages` | `messages` | `complex` | Array validation | Required field | Content format conversion |
| `system` | `messages[0]` | `system_to_message` | String/array validation | Optional | Converts to system role message |
| `max_tokens` | `max_tokens` | `direct` | Integer range [1-262144] | 4096 | Provider-specific limits |
| `temperature` | `temperature` | `direct` | Float range [0-2] | 0.7 | Provider-specific ranges |
| `top_p` | `top_p` | `direct` | Float range [0-1] | 0.9 | Probability parameter |
| `top_k` | `top_k` | `direct` | Integer range [0-100] | None | Anthropic-specific parameter |
| `stop_sequences` | `stop` | `array_convert` | Array of strings | [] | Name change only |
| `stream` | `stream` | `boolean` | Boolean validation | false | Streaming protocol flag |
| `tools` | `tools` | `tool_transform` | Array validation | [] | Complex format conversion |
| `tool_choice` | `tool_choice` | `choice_transform` | String/object validation | "auto" | Format-specific conversion |

### Response Field Conversions (OpenAI → Anthropic)

| Source (OpenAI) | Target (Anthropic) | Transform Type | Validation | Notes |
|-----------------|-------------------|----------------|------------|-------|
| `id` | `id` | `direct` | String validation | Response identifier |
| `object` | `type` | `value_map` | String validation | "chat.completion" → "message" |
| `created` | - | `discard` | Timestamp | Usually discarded |
| `model` | `model` | `direct` | String validation | Model name preservation |
| `choices[0]` | `content` | `complex` | Object transformation | Most complex conversion |
| `usage` | `usage` | `format_convert` | Object validation | Token usage statistics |
| `finish_reason` | `stop_reason` | `value_map` | String validation | Reason code mapping |

## Detailed Conversion Specifications

### Message Content Conversions

#### Anthropic → OpenAI Message Transformation

**Input (Anthropic):**
```json
{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "What's the weather?"
    },
    {
      "type": "tool_use",
      "id": "tool_weather_123",
      "name": "get_weather",
      "input": {"location": "NYC"}
    }
  ]
}
```

**Output (OpenAI):**
```json
{
  "role": "user",
  "content": "What's the weather?",
  "tool_calls": [
    {
      "id": "tool_weather_123",
      "type": "function",
      "function": {
        "name": "get_weather",
        "arguments": "{\"location\": \"NYC\"}"
      }
    }
  ]
}
```

**Transformation Rules:**
1. **Text Content**: Concatenate all `text` type content with spaces
2. **Tool Use**: Convert to `tool_calls` array format
3. **Tool Result**: Convert to formatted string with tool result prefix
4. **Image Content**: Convert to OpenAI image URL format (if supported)
5. **System Reminders**: Convert to text with special formatting

#### OpenAI → Anthropic Message Transformation

**Input (OpenAI):**
```json
{
  "role": "assistant",
  "content": "I'll check the weather for you.",
  "tool_calls": [
    {
      "id": "call_weather_123",
      "type": "function",
      "function": {
        "name": "get_weather",
        "arguments": "{\"location\": \"NYC\"}"
      }
    }
  ]
}
```

**Output (Anthropic):**
```json
{
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "I'll check the weather for you."
    },
    {
      "type": "tool_use",
      "id": "call_weather_123",
      "name": "get_weather",
      "input": {"location": "NYC"}
    }
  ]
}
```

**Transformation Rules:**
1. **Text Content**: Create text content block
2. **Tool Calls**: Convert each to tool_use block
3. **Arguments**: Parse JSON string to object
4. **ID Preservation**: Maintain original ID for correlation

### Tool Definition Conversions

#### Anthropic → OpenAI Tool Transformation

**Input (Anthropic):**
```json
{
  "name": "list_files",
  "description": "List files in a directory",
  "input_schema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Directory path"
      }
    },
    "required": ["path"]
  }
}
```

**Output (OpenAI):**
```json
{
  "type": "function",
  "function": {
    "name": "list_files",
    "description": "List files in a directory",
    "parameters": {
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "Directory path"
        }
      }
    }
  }
}
```

**Transformation Steps:**
1. Wrap in `function` object
2. Add `type: "function"` at top level
3. Rename `input_schema` → `parameters`
4. Preserve all nested structure and validation

#### Tool Choice Conversions

**Anthropic Tool Choice:**
```json
{
  "tool_choice": {
    "type": "tool",
    "name": "get_weather"
  }
}
```

**OpenAI Tool Choice:**
```json
{
  "tool_choice": {
    "type": "function",
    "function": {
      "name": "get_weather"
    }
  }
}
```

**Special Cases:**
- `"tool_choice": "auto"` → `"tool_choice": "auto"` (direct)
- `"tool_choice": "any"` → `"tool_choice": "required"` (value mapping)

### System Message Conversions

#### Anthropic System Array → OpenAI System Message

**Input (Anthropic):**
```json
{
  "system": [
    {
      "type": "text",
      "text": "You are a helpful assistant."
    },
    {
      "type": "text", 
      "text": "Be concise and accurate."
    }
  ]
}
```

**Output (OpenAI):**
```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant. Be concise and accurate."
    }
  ]
}
```

**Transformation Rules:**
1. Extract all text content from system array
2. Concatenate with spaces
3. Create system role message
4. Insert as first message in messages array

### Response Conversions

#### OpenAI → Anthropic Response Transformation

**Input (OpenAI):**
```json
{
  "id": "chatcmpl-12345",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "The weather in NYC is sunny.",
        "tool_calls": [
          {
            "id": "call_abc123",
            "type": "function",
            "function": {
              "name": "get_weather",
              "arguments": "{\"location\": \"NYC\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 15,
    "total_tokens": 25
  }
}
```

**Output (Anthropic):**
```json
{
  "id": "chatcmpl-12345",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "The weather in NYC is sunny."
    },
    {
      "type": "tool_use",
      "id": "call_abc123",
      "name": "get_weather",
      "input": {"location": "NYC"}
    }
  ],
  "model": "gpt-4",
  "stop_reason": "tool_use",
  "usage": {
    "input_tokens": 10,
    "output_tokens": 15
  }
}
```

**Transformation Rules:**
1. **ID**: Direct mapping
2. **Type**: "chat.completion" → "message"
3. **Role**: Direct mapping (assistant)
4. **Content**: Complex conversion from message.content and tool_calls
5. **Model**: Direct mapping
6. **Stop Reason**: "tool_calls" → "tool_use", "stop" → "end_turn"
7. **Usage**: Rename fields (prompt_tokens → input_tokens, completion_tokens → output_tokens)

### Parameter Validation and Ranges

#### Temperature Ranges by Provider

| Provider | Min Value | Max Value | Default | RCC v4.0 Handling |
|----------|-----------|-----------|---------|-------------------|
| OpenAI | 0.0 | 2.0 | 0.7 | Full range supported |
| Anthropic | 0.0 | 1.0 | 0.7 | Clamped to 1.0 if exceeded |
| Qwen | 0.0 | 2.0 | 0.7 | Full range supported |
| Gemini | 0.0 | 1.0 | 0.7 | Clamped to 1.0 if exceeded |

#### Max Tokens Limits by Provider

| Provider | Max Tokens | RCC v4.0 Limit | Notes |
|----------|------------|----------------|-------|
| OpenAI GPT-4 | 128,000 | 128,000 | Model-dependent |
| OpenAI GPT-3.5 | 16,384 | 16,384 | Model-dependent |
| Anthropic Claude-3 | 200,000 | 200,000 | Consistent across models |
| Qwen Max Series | 262,144 | 262,144 | Highest limit |
| Gemini Pro | 1,000,000 | 1,000,000 | Highest overall |

### Streaming Protocol Conversions

#### Anthropic Streaming Events

| Event Type | Description | OpenAI Equivalent |
|------------|-------------|-------------------|
| `message_start` | Response beginning | Initial choice delta |
| `content_block_start` | Content block start | Role delta |
| `content_block_delta` | Content update | Content delta |
| `content_block_stop` | Content block end | - |
| `message_delta` | Message update | Finish reason |
| `message_stop` | Response end | Final chunk |

#### OpenAI Streaming Format

```json
// Initial chunk
{
  "choices": [{"delta": {"role": "assistant"}, "index": 0}],
  "model": "gpt-4"
}

// Content chunks
{
  "choices": [{"delta": {"content": "Hello"}, "index": 0}]
}

// Final chunk
{
  "choices": [{"delta": {}, "finish_reason": "stop", "index": 0}]
}
```

### Error Response Conversions

#### OpenAI Error → Anthropic Error

**Input (OpenAI):**
```json
{
  "error": {
    "message": "Invalid API key provided",
    "type": "invalid_request_error", 
    "code": "invalid_api_key"
  }
}
```

**Output (Anthropic):**
```json
{
  "type": "error",
  "error": {
    "type": "authentication_error",
    "message": "Invalid API key provided"
  }
}
```

**Error Type Mapping:**
- `invalid_request_error` → `invalid_request_error`
- `authentication_error` → `authentication_error`
- `rate_limit_error` → `rate_limit_error`
- `insufficient_quota` → `quota_exceeded`

### Provider-Specific Field Conversions

#### Qwen-Specific Conversions

**Request Adjustments:**
```json
// Add Qwen-specific headers
{
  "headers": {
    "X-DashScope-Async": "enable",
    "X-DashScope-SSE": "enable"
  }
}
```

**Response Normalization:**
- Fix tool calling conversation flow
- Normalize choice structure
- Handle streaming format differences

#### iFlow-Specific Conversions

**Temperature → Top-k Calculation:**
```typescript
// Convert temperature to top_k for iFlow
const top_k = Math.floor(temperature * 50);
```

**Model Name Mapping:**
```json
{
  "gpt-4": "iflow-plus",
  "gpt-3.5-turbo": "iflow-standard"
}
```

#### ModelScope-Specific Conversions

**Tool Format Validation:**
- Ensure OpenAI-compatible tool format
- Validate function parameters structure
- Handle model name resolution

### Complex Content Block Conversions

#### Mixed Content Types (Anthropic → OpenAI)

**Input:**
```json
{
  "content": [
    {"type": "text", "text": "Let me check"},
    {"type": "tool_use", "id": "tool1", "name": "search", "input": {"query": "weather"}},
    {"type": "text", "text": "and get back to you."}
  ]
}
```

**Output:**
```json
{
  "content": "Let me check and get back to you.",
  "tool_calls": [
    {
      "id": "tool1",
      "type": "function", 
      "function": {
        "name": "search",
        "arguments": "{\"query\": \"weather\"}"
      }
    }
  ]
}
```

**Processing Logic:**
1. Extract all text content and concatenate
2. Convert each tool_use to tool_call format
3. Preserve order of mixed content
4. Handle edge cases (pure tool messages, etc.)

This comprehensive conversion table serves as the definitive reference for implementing bidirectional protocol conversion in RCC v4.0, covering all field mappings, transformation rules, validation requirements, and edge case handling.