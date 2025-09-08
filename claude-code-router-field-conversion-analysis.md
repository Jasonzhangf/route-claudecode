# Claude Code Router Field Conversion Analysis

## Project Overview

The **claude-code-router** project implements a sophisticated transformation system that converts between different AI provider protocols, primarily focusing on **Anthropic ↔ OpenAI** format conversions. The core transformation logic is implemented in the `@musistudio/llms` package, which provides a unified transformation interface.

## Architecture

### Core Components

1. **@musistudio/llms Package**: Contains the actual transformation implementations
2. **Transformer Interface**: Standardized interface for request/response transformations
3. **Provider-Specific Transformers**: Individual transformers for each AI provider
4. **Unified Format**: OpenAI format serves as the intermediate universal format

### Transformation Flow

```
Anthropic Request → AnthropicTransformer → OpenAI Format → ProviderTransformer → Provider Request
Provider Response → ProviderTransformer → OpenAI Format → AnthropicTransformer → Anthropic Response
```

## Field Conversion Tables

### Request Field Mappings (Anthropic → OpenAI)

| Anthropic Field | OpenAI Field | Transformation Logic |
|-----------------|--------------|---------------------|
| `model` | `model` | Direct mapping with provider prefix (e.g., "anthropic/claude-3.5-sonnet") |
| `messages` | `messages` | Content array conversion with role mapping |
| `messages[].role` | `messages[].role` | `user` → `user`, `assistant` → `assistant`, `system` → `system` |
| `messages[].content` | `messages[].content` | Text content or content array conversion |
| `messages[].content[].type` | `messages[].content` | `text` → string, `tool_use` → tool_calls, `tool_result` → tool role |
| `tools` | `tools` | Array mapping with format conversion |
| `tools[].name` | `tools[].function.name` | Direct mapping |
| `tools[].description` | `tools[].function.description` | Direct mapping |
| `tools[].input_schema` | `tools[].function.parameters` | Schema object mapping |
| `tool_choice` | `tool_choice` | Type conversion: `{"type": "tool", "name": "tool_name"}` → `{"type": "function", "function": {"name": "tool_name"}}` |
| `max_tokens` | `max_tokens` | Direct mapping with provider-specific limits |
| `temperature` | `temperature` | Direct mapping |
| `stream` | `stream` | Direct mapping |
| `thinking` | `reasoning` | Convert to reasoning object: `{"type": "enabled", "budget_tokens": number}` |
| `system` | `messages[0]` | Convert to system message with role "system" |

### Response Field Mappings (OpenAI → Anthropic)

| OpenAI Field | Anthropic Field | Transformation Logic |
|--------------|-----------------|---------------------|
| `choices[0].message.content` | `content[]` | Convert to content array with text type |
| `choices[0].message.tool_calls` | `content[]` | Convert to tool_use content blocks |
| `choices[0].message.tool_calls[].id` | `content[].id` | Direct mapping |
| `choices[0].message.tool_calls[].function.name` | `content[].name` | Direct mapping |
| `choices[0].message.tool_calls[].function.arguments` | `content[].input` | JSON parse and assign |
| `choices[0].finish_reason` | `stop_reason` | Mapping: `stop` → `end_turn`, `length` → `max_tokens`, `tool_calls` → `tool_use` |
| `usage.prompt_tokens` | `usage.input_tokens` | Direct mapping |
| `usage.completion_tokens` | `usage.output_tokens` | Direct mapping |
| `usage.total_tokens` | `usage` | Combined input/output tokens |
| `model` | `model` | Direct mapping |
| `id` | `id` | Generate message ID if missing |

### Tool Calling Conversions

#### Anthropic → OpenAI Tool Definition
```typescript
// Anthropic format
{
  "name": "function_name",
  "description": "Function description",
  "input_schema": {
    "type": "object",
    "properties": { ... },
    "required": ["field1"]
  }
}

// OpenAI format
{
  "type": "function",
  "function": {
    "name": "function_name",
    "description": "Function description",
    "parameters": {
      "type": "object",
      "properties": { ... },
      "required": ["field1"]
    }
  }
}
```

#### OpenAI → Anthropic Tool Usage
```typescript
// OpenAI format
{
  "tool_calls": [{
    "id": "call_123",
    "type": "function",
    "function": {
      "name": "function_name",
      "arguments": "{\"param\": \"value\"}"
    }
  }]
}

// Anthropic format
{
  "content": [{
    "type": "tool_use",
    "id": "call_123",
    "name": "function_name",
    "input": {"param": "value"}
  }]
}
```

## Provider-Specific Transformations

### DeepSeek Transformer
- **Max Tokens Limit**: Enforces 8192 token limit
- **Reasoning Content**: Converts `reasoning_content` to `thinking` format
- **Tool Choice**: Supports `tool_choice: "required"` for forced tool usage

### Gemini Transformer
- **Endpoint Mapping**: Converts to `/v1beta/models/:model:generateContent` format
- **Content Parts**: Handles Gemini's content parts structure
- **Grounding Metadata**: Converts web search results to annotations
- **Function Calling**: Maps between Gemini functions and OpenAI tools

### OpenRouter Transformer
- **Provider Routing**: Supports provider-specific routing parameters
- **Cache Control**: Removes cache_control fields for compatibility
- **Image Handling**: Converts base64 images to data URLs
- **Model Prefixing**: Handles provider/model naming conventions

### ToolUse Transformer
- **Forced Tool Usage**: Adds system prompt and ExitTool for mandatory tool calling
- **ExitTool Integration**: Provides mechanism to exit tool mode
- **Tool Choice**: Sets `tool_choice: "required"` for compatible models

## Stream Processing

### SSE (Server-Sent Events) Conversion

The system implements bidirectional SSE stream conversion:

1. **OpenAI Stream → Anthropic Stream**:
   - Converts `data: {...}` chunks to Anthropic event format
   - Maps `delta.content` to `text_delta` events
   - Converts `tool_calls` to `input_json_delta` events
   - Handles `finish_reason` to `stop_reason` mapping

2. **Anthropic Stream → OpenAI Stream**:
   - Converts Anthropic events to OpenAI chunk format
   - Maps `content_block_delta` to `delta.content`
   - Handles `tool_use` events to `tool_calls` format
   - Processes `message_delta` to final response format

### Event Mapping

| OpenAI Event | Anthropic Event | Purpose |
|--------------|-----------------|---------|
| `data: {"choices":[{"delta":{"content":"text"}}]}` | `event: content_block_delta
data: {"type":"text_delta","text":"text"}` | Text content streaming |
| `data: {"choices":[{"delta":{"tool_calls":[{"function":{"arguments":"{\"param\":\"value\"}"}}]}}]}` | `event: content_block_delta
data: {"type":"input_json_delta","partial_json":"{\"param\":\"value\"}"}` | Tool argument streaming |
| `data: {"choices":[{"finish_reason":"stop"}]}` | `event: message_delta
data: {"delta":{"stop_reason":"end_turn"}}` | Completion signaling |

## Error Handling

### Error Conversion Patterns

1. **API Errors**: Convert provider-specific error formats to unified error responses
2. **Validation Errors**: Map field validation errors between formats
3. **Rate Limiting**: Handle rate limit responses consistently
4. **Authentication**: Standardize authentication error responses

### Error Field Mappings

| OpenAI Error | Anthropic Error | Notes |
|--------------|-----------------|-------|
| `error.message` | `error.message` | Direct mapping |
| `error.type` | `error.type` | Error type classification |
| `error.code` | `error.code` | HTTP status code mapping |
| `error.param` | `error.param` | Invalid parameter identification |

## Configuration System

### Transformer Configuration

Transformers are configured in the `config.json` file:

```json
{
  "Providers": [
    {
      "name": "provider_name",
      "api_base_url": "https://api.provider.com/v1/chat/completions",
      "api_key": "sk-xxx",
      "models": ["model-name"],
      "transformer": {
        "use": ["transformer1", "transformer2"],
        "model-specific": {
          "use": ["additional_transformer"]
        }
      }
    }
  ]
}
```

### Available Transformers

- **Anthropic**: Preserves original Anthropic format
- **deepseek**: DeepSeek API adaptations
- **gemini**: Gemini API conversions
- **openrouter**: OpenRouter specific handling
- **tooluse**: Enhanced tool usage for compatible models
- **maxtoken**: Token limit enforcement
- **reasoning**: Reasoning content processing
- **cleancache**: Cache control field removal

## Implementation Details

### Key Functions

1. **`transformRequestIn(request)`**: Converts incoming requests to provider format
2. **`transformResponseOut(response)`**: Converts provider responses to standard format
3. **`convertOpenAIStreamToAnthropic(stream)`**: Bidirectional stream conversion
4. **`convertOpenAIResponseToAnthropic(response)`**: Response format conversion

### Data Flow

1. **Request Flow**: Client → Router → Transformer → Provider → Response
2. **Response Flow**: Provider → Transformer → Router → Client
3. **Stream Processing**: Real-time bidirectional conversion during streaming

## Performance Considerations

- **Streaming Efficiency**: Minimal overhead for real-time conversions
- **Memory Usage**: Efficient buffer management for large responses
- **Error Recovery**: Graceful handling of malformed data
- **Caching**: Optional caching for repeated transformations

## Compatibility Matrix

| Provider | Anthropic Support | OpenAI Support | Tool Calling | Streaming | Reasoning |
|----------|-------------------|----------------|--------------|-----------|-----------|
| DeepSeek | ✅ | ✅ | ✅ | ✅ | ✅ |
| Gemini | ✅ | ✅ | ✅ | ✅ | ❌ |
| OpenRouter | ✅ | ✅ | ✅ | ✅ | ✅ |
| Groq | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ollama | ✅ | ✅ | ✅ | ✅ | ❌ |

This analysis reveals that claude-code-router implements a comprehensive and sophisticated transformation system that handles the complex nuances of converting between different AI provider protocols while maintaining compatibility and performance.