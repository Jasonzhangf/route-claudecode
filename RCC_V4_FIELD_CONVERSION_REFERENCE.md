# RCC v4.0 Field Conversion Configuration Reference Document

## Executive Summary

This document provides a comprehensive analysis of the current field conversion architecture in RCC v4.0, documenting the six-layer pipeline's field transformation logic, compatibility layer adjustments, and provider-specific configurations. This serves as a reference for understanding the existing implementation without suggesting changes.

## Six-Layer Architecture Field Transformations

### Layer 1: Client Layer (Anthropic Format Input)
**Input Format**: Standard Anthropic API format
**Key Fields**:
- `model`: Model identifier (e.g., "claude-3-sonnet-20240229")
- `messages`: Array of message objects with `role` and `content`
- `max_tokens`: Maximum tokens for response
- `temperature`: Sampling temperature
- `tools`: Array of tool definitions with `name`, `description`, `input_schema`
- `tool_choice`: Tool selection strategy
- `system`: System message (string or array)

### Layer 2: Router Layer (Model Mapping)
**Function**: Route selection based on model and configuration
**Field Transformations**:
- Model name mapping from virtual to actual provider models
- Provider selection based on routing rules
- No format changes - passes Anthropic format through

### Layer 3: Transformer Layer (Anthropic → OpenAI Conversion)
**Core Implementation**: `anthropic-openai-converter.ts`

#### Request Field Mappings (Anthropic → OpenAI)
```typescript
// Basic field mappings
'system' → 'messages[0]' (as system role)
'max_tokens' → 'max_tokens' (direct mapping)
'temperature' → 'temperature' (direct mapping)
'tools' → 'tools' (format conversion)
'tool_choice' → 'tool_choice' (format conversion)

// Message content transformations
Anthropic content array → OpenAI string content
Anthropic tool_use → OpenAI tool_calls
Anthropic tool_result → OpenAI tool role messages
```

#### Tool Definition Conversion
```typescript
// Anthropic format
{
  name: "function_name",
  description: "Function description",
  input_schema: { /* JSON Schema */ }
}

// OpenAI format
{
  type: "function",
  function: {
    name: "function_name",
    description: "Function description",
    parameters: { /* JSON Schema */ }
  }
}
```

#### Response Field Mappings (OpenAI → Anthropic)
```typescript
'choices[0].message.content' → 'content[0].text'
'choices[0].message.tool_calls' → 'content[].tool_use'
'usage.prompt_tokens' → 'usage.input_tokens'
'usage.completion_tokens' → 'usage.output_tokens'
```

### Layer 4: Protocol Layer (OpenAI Format Validation)
**Function**: Ensures pure OpenAI format output
**Validations**:
- ❌ Rejects any Anthropic format data
- ❌ Prohibits Anthropic fields in metadata/internal
- ✅ Only allows OpenAI-compatible configuration
- ✅ Enforces OpenAI tool format: `[{type: "function", function: {...}}]`

### Layer 5: Server Compatibility Layer (Provider-Specific Adjustments)
**Function**: OpenAI format adjustments for specific providers

#### LM Studio Compatibility (`lmstudio-compatibility.ts`)
**Request Adjustments**:
- Model name mapping from virtual to actual LM Studio models
- Message content format conversion (complex Anthropic content → string)
- Tool validation and format fixing
- Max tokens configuration (removed limits - user-controlled)

**Response Adjustments**:
- Usage field normalization
- Choices field standardization
- Response format validation

#### Qwen Compatibility (`qwen-compatibility.ts`)
**Request Adjustments**:
- Model name mapping using context.actualModel
- Tool calling conversation flow fixing
- OAuth2 token loading from auth files

**Response Adjustments**:
- Choices array normalization
- Tool calls format standardization
- Usage field mapping (input_tokens → prompt_tokens, output_tokens → completion_tokens)

### Layer 6: Server Layer (HTTP API Calls)
**Function**: Pure HTTP requests with OpenAI format
**No Field Transformations**: Only HTTP-level operations

## Field Mapping Templates

### Default Request Field Mapping
```typescript
const defaultRequestMapping = {
  'system': 'messages[0]',           // System message placement
  'max_tokens': 'max_tokens',        // Direct mapping
  'temperature': 'temperature',      // Direct mapping
  'tools': 'tools',                  // Format conversion
  'tool_choice': 'tool_choice'       // Format conversion
};
```

### Default Response Field Mapping
```typescript
const defaultResponseMapping = {
  'choices[0].message.content': 'content[0].text',
  'choices[0].message.tool_calls': 'content[].tool_use',
  'usage.prompt_tokens': 'usage.input_tokens',
  'usage.completion_tokens': 'usage.output_tokens'
};
```

### Custom Field Handlers
```typescript
customFieldHandlers: {
  'tools': this.transformToolsWithTemplate.bind(this),
  'messages': this.transformMessagesWithTemplate.bind(this)
}
```

## Provider-Specific Field Configurations

### LM Studio Field Handling
```typescript
// Model mapping rules
const defaultModelMapping = {
  'default': 'llama-3.1-8b-instruct',
  'reasoning': 'llama-3.1-8b-instruct',
  'longContext': 'llama-3.1-8b-instruct',
  'webSearch': 'llama-3.1-8b-instruct',
  'background': 'llama-3.1-8b-instruct'
};

// Message content conversion
Anthropic content array → String content for LM Studio
Complex content blocks → Concatenated string with markers
```

### Qwen Field Handling
```typescript
// Tool calling conversation flow requirements
// Assistant message with tool_calls MUST be followed by tool messages
// responding to each tool_call_id

// OAuth2 token field mapping
context.metadata.protocolConfig.apiKey = authData.access_token;

// Usage field normalization
input_tokens → prompt_tokens
output_tokens → completion_tokens
```

## Security and Validation Rules

### Transformer Security Features
1. **Input Validation**: Strict format checking with fallback to minimal valid requests
2. **Field Sanitization**: Removal of all Anthropic-specific fields
3. **Type Safety**: TypeScript enforcement with strict mode
4. **Error Handling**: ZeroFallback policy with RCC error types

### Protocol Layer Enforcement
- ❌ No Anthropic format data allowed after Protocol layer
- ❌ No cross-protocol information in metadata
- ✅ Only OpenAI-compatible fields permitted
- ✅ Strict tool format validation

## Field Conversion Examples

### Complete Request Flow Example
```typescript
// Input (Anthropic)
{
  model: "claude-3-sonnet",
  max_tokens: 4096,
  messages: [
    {role: "user", content: "Hello"}
  ],
  tools: [{
    name: "get_weather",
    description: "Get weather",
    input_schema: {type: "object", properties: {} }
  }]
}

// After Transformer (OpenAI)
{
  model: "claude-3-sonnet",
  max_tokens: 4096,
  messages: [
    {role: "user", content: "Hello"}
  ],
  tools: [{
    type: "function",
    function: {
      name: "get_weather",
      description: "Get weather",
      parameters: {type: "object", properties: {} }
    }
  }]
}

// After Server Compatibility (LM Studio)
{
  model: "llama-3.1-8b-instruct", // Mapped to actual model
  max_tokens: 4096,
  messages: [
    {role: "user", content: "Hello"}
  ],
  tools: [{
    type: "function",
    function: {
      name: "get_weather",
      description: "Get weather",
      parameters: {type: "object", properties: {} }
    }
  }]
}
```

### Response Flow Example
```typescript
// Server Response (OpenAI)
{
  id: "chatcmpl-123",
  choices: [{
    message: {
      role: "assistant",
      content: "Weather is sunny",
      tool_calls: [{
        id: "call_123",
        type: "function",
        function: {name: "get_weather", arguments: "{}"}
      }]
    },
    finish_reason: "tool_calls"
  }],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15
  }
}

// After Transformer (Anthropic)
{
  id: "msg_456",
  type: "message",
  role: "assistant",
  content: [{
    type: "text",
    text: "Weather is sunny"
  }, {
    type: "tool_use",
    id: "call_123",
    name: "get_weather",
    input: {}
  }],
  stop_reason: "tool_use",
  usage: {
    input_tokens: 10,
    output_tokens: 5
  }
}
```

## Error Handling and Field Validation

### Field Validation Rules
1. **Required Fields**: model, messages array validation
2. **Type Checking**: Strict TypeScript enforcement
3. **Format Validation**: JSON schema validation for complex fields
4. **Boundary Checks**: Token limits and parameter ranges

### Error Types and Field Issues
```typescript
// TransformerSecurityError for invalid transformations
// RCCError for protocol violations
// ValidationError for field format issues
```

## Performance Considerations

### Field Processing Metrics
- **Transformer Layer**: < 50ms average processing time
- **Server Compatibility Layer**: < 30ms average processing time
- **End-to-End**: < 100ms total processing time

### Memory Usage
- **Field Mapping Templates**: Pre-configured and cached
- **Message Content**: Stream processing for large payloads
- **Tool Definitions**: Lazy loading and validation

## Configuration Reference

### Transformer Configuration
```typescript
interface SecureTransformerPreConfig {
  preserveToolCalls: boolean;        // Default: true
  mapSystemMessage: boolean;          // Default: true
  defaultMaxTokens: number;           // Default: 262144
  fieldMappingTemplate?: Record<string, string>;
  customTransformRules?: Record<string, (value: any) => any>;
  transformDirection?: 'anthropic-to-openai' | 'openai-to-anthropic';
  concurrencyLimit?: number;          // Default: 10
}
```

### Server Compatibility Configuration
```typescript
// LM Studio
interface LMStudioCompatibilityPreConfig {
  baseUrl: string;
  models: string[];
  maxTokens?: Record<string, number>;
  modelMappingRules?: Record<string, string>;
  enableRequestProcessing?: boolean;   // Default: true
  enableResponseProcessing?: boolean;  // Default: true
}

// Qwen
interface QwenCompatibilityConfig {
  baseUrl: string;
  models: string[];
  timeout: number;
  maxRetries: number;
}
```

## Summary

The RCC v4.0 field conversion architecture implements a strict six-layer pipeline with:

1. **Bidirectional Transformation**: Anthropic ↔ OpenAI format conversion
2. **Provider-Specific Adaptations**: LM Studio, Qwen, and other provider compatibility
3. **Security-First Design**: ZeroFallback policy with comprehensive validation
4. **Template-Based Mapping**: Configurable field mappings with custom handlers
5. **Performance Optimization**: Sub-100ms processing with concurrent safety

The architecture ensures protocol compliance while maintaining flexibility for provider-specific requirements through the layered approach documented in this reference.