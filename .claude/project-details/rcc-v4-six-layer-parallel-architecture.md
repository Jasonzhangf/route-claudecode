# RCC v4.0 六层平行架构规范

## 🎯 核心架构理念

### 平行流水线设计原则
1. **OpenAI和Gemini是平行架构**: 两条完全独立的分支流水线
2. **协议严格隔离**: 每条分支严格遵循单一协议格式
3. **双向处理机制**: 请求和响应都经过完整的六层处理
4. **零跨协议转换**: Transformer层禁止跨协议格式混合

## 🏗️ 六层平行架构图

```
                           🌐 Client Layer
                        (Anthropic格式输入/输出)
                               ↓ ↑
                        🧭 Router Layer
                     (模型映射 + 分支路由决策)
                               ↓ ↑
              ┌─────────────────────────────────────────┐
              ↓                                         ↑
    📤 OpenAI分支流水线                            📤 Gemini分支流水线
              ↓                                         ↑
  ┌─────────────────────┐                   ┌─────────────────────┐
  │ 🔄 REQUEST FLOW     │                   │ 🔄 REQUEST FLOW     │
  │                     │                   │                     │
  │ 3️⃣ Transformer:     │                   │ 3️⃣ Transformer:     │
  │   Anthropic→OpenAI  │                   │   Anthropic→Gemini  │
  │   ⚠️ 严禁跨协议        │                   │   ⚠️ 严禁跨协议        │
  │       ↓             │                   │       ↓             │
  │ 4️⃣ Protocol:        │                   │ 4️⃣ Protocol:        │
  │   OpenAI格式处理     │                   │   Gemini格式处理     │
  │       ↓             │                   │       ↓             │
  │ 5️⃣ ServerCompat:    │                   │ 5️⃣ ServerCompat:    │
  │   OpenAI格式内调整   │                   │   Gemini格式内调整   │
  │       ↓             │                   │       ↓             │
  │ 6️⃣ Server:          │                   │ 6️⃣ Server:          │
  │   HTTP API调用      │                   │   HTTP API调用      │
  │                     │                   │                     │
  │ ═══════════════════ │                   │ ═══════════════════ │
  │                     │                   │                     │
  │ 🔙 RESPONSE FLOW    │                   │ 🔙 RESPONSE FLOW    │
  │                     │                   │                     │
  │ 6️⃣ Server:          │                   │ 6️⃣ Server:          │
  │   返回响应数据       │                   │   返回响应数据       │
  │       ↑             │                   │       ↑             │
  │ 5️⃣ ServerCompat:    │                   │ 5️⃣ ServerCompat:    │
  │   响应格式标准化     │                   │   响应格式标准化     │
  │       ↑             │                   │       ↑             │
  │ 4️⃣ Protocol:        │                   │ 4️⃣ Protocol:        │
  │   响应协议处理       │                   │   响应协议处理       │
  │       ↑             │                   │       ↑             │
  │ 3️⃣ ResponseTrans:   │                   │ 3️⃣ ResponseTrans:   │
  │   OpenAI→Anthropic  │                   │   Gemini→Anthropic  │
  └─────────────────────┘                   └─────────────────────┘
              ↑                                         ↑
              └─────────────────────────────────────────┘
                               ↑ ↓
                        🌐 Client Layer
                     (Anthropic格式响应输出)
```

## 📋 各层详细规范

### 🌐 1. Client Layer (客户端层) - 共享
```typescript
interface ClientLayer {
  responsibility: '统一的Anthropic格式接口';
  input: 'Claude Code用户请求';
  output: 'Anthropic API格式请求/响应';
  
  functions: [
    '用户输入处理',
    'Anthropic格式标准化',
    '响应格式验证',
    '错误信息展示'
  ];
}
```

### 🧭 2. Router Layer (路由层) - 共享
```typescript
interface RouterLayer {
  responsibility: '模型映射和分支选择';
  input: 'AnthropicRequest';
  output: 'AnthropicRequest & { branch: "openai" | "gemini" }';
  
  functions: [
    'Demo1风格虚拟模型映射',
    '分支路由决策(OpenAI/Gemini)',
    '负载均衡器集成',
    '流水线选择'
  ];
  
  routing_logic: {
    virtual_models: ['default', 'background', 'reasoning', 'webSearch', 'longContext'],
    branch_selection: '根据provider配置选择OpenAI或Gemini分支'
  };
}
```

### 🔄 3a. OpenAI分支 - Transformer Layer
```typescript
interface OpenAITransformerLayer {
  responsibility: 'Anthropic → OpenAI协议转换';
  input: 'AnthropicRequest';
  output: 'OpenAIRequest'; // ✅ 纯OpenAI格式
  
  strict_rules: [
    '❌ 严禁输出任何Anthropic格式字段',
    '❌ 严禁输出任何Gemini格式字段',
    '❌ 严禁跨协议格式混合',
    '✅ 必须转换所有Anthropic特有字段'
  ];
  
  transformations: {
    tools: 'Anthropic[{name,description,input_schema}] → OpenAI[{type:"function",function:{name,description,parameters}}]',
    messages: 'Anthropic[{role,content[]}] → OpenAI[{role,content}]',
    system_message: 'Anthropic.system → OpenAI.messages[0]{role:"system",content}',
    parameters: 'Anthropic.max_tokens → OpenAI.max_tokens'
  };
}
```

### 🔄 3b. Gemini分支 - Transformer Layer
```typescript
interface GeminiTransformerLayer {
  responsibility: 'Anthropic → Gemini协议转换';
  input: 'AnthropicRequest';
  output: 'GeminiRequest'; // ✅ 纯Gemini格式
  
  strict_rules: [
    '❌ 严禁输出任何Anthropic格式字段',
    '❌ 严禁输出任何OpenAI格式字段',
    '❌ 严禁跨协议格式混合',
    '✅ 必须转换所有Anthropic特有字段'
  ];
  
  transformations: {
    tools: 'Anthropic[{name,description,input_schema}] → Gemini[{functionDeclarations:[{name,description,parameters}]}]',
    messages: 'Anthropic[{role,content[]}] → Gemini[{role:"user"|"model",parts:[{text}]}]',
    system_instruction: 'Anthropic.system → Gemini.system_instruction.parts[0].text',
    generation_config: 'Anthropic.max_tokens → Gemini.generationConfig.maxOutputTokens'
  };
}
```

### 🔌 4a. OpenAI分支 - Protocol Layer
```typescript
interface OpenAIProtocolLayer {
  responsibility: 'OpenAI协议标准处理';
  input: 'OpenAIRequest'; // ✅ 仅OpenAI格式
  output: 'OpenAIRequest'; // ✅ 仅OpenAI格式
  
  strict_rules: [
    '❌ 严禁接收或产生Anthropic格式',
    '❌ 严禁接收或产生Gemini格式',
    '❌ 严禁在metadata中存储非OpenAI协议信息',
    '✅ 只能添加OpenAI兼容的配置'
  ];
  
  functions: [
    'OpenAI模型名映射',
    '端点URL配置',
    'OpenAI API认证',
    '协议参数验证',
    '流式/非流式处理'
  ];
}
```

### 🔌 4b. Gemini分支 - Protocol Layer
```typescript
interface GeminiProtocolLayer {
  responsibility: 'Gemini协议标准处理';
  input: 'GeminiRequest'; // ✅ 仅Gemini格式
  output: 'GeminiRequest'; // ✅ 仅Gemini格式
  
  strict_rules: [
    '❌ 严禁接收或产生Anthropic格式',
    '❌ 严禁接收或产生OpenAI格式',
    '❌ 严禁在metadata中存储非Gemini协议信息',
    '✅ 只能添加Gemini兼容的配置'
  ];
  
  functions: [
    'Gemini模型名映射',
    'Google API端点配置',
    'OAuth2/API Key认证',
    '协议参数验证',
    '流式/非流式处理'
  ];
}
```

### 🔧 5a. OpenAI分支 - ServerCompatibility Layer
```typescript
interface OpenAIServerCompatibilityLayer {
  responsibility: 'Provider特定的OpenAI格式调整';
  input: 'OpenAIRequest'; // ✅ 仅OpenAI格式
  output: 'OpenAIRequest'; // ✅ 仅OpenAI格式 (Provider特定)
  
  strict_rules: [
    '❌ 严禁协议转换',
    '❌ 严禁接收或产生非OpenAI格式',
    '✅ 只允许OpenAI格式内的字段调整'
  ];
  
  provider_adjustments: {
    lmstudio: {
      model_mapping: 'gpt-4 → local-model-name',
      parameter_adjustment: 'LMStudio特定参数优化',
      tool_format: 'LMStudio工具格式微调'
    },
    openai_official: {
      model_mapping: '标准OpenAI模型名',
      parameter_adjustment: 'OpenAI官方API参数',
      rate_limiting: 'OpenAI速率限制处理'
    }
  };
}
```

### 🔧 5b. Gemini分支 - ServerCompatibility Layer
```typescript
interface GeminiServerCompatibilityLayer {
  responsibility: 'Provider特定的Gemini格式调整';
  input: 'GeminiRequest'; // ✅ 仅Gemini格式
  output: 'GeminiRequest'; // ✅ 仅Gemini格式 (Provider特定)
  
  strict_rules: [
    '❌ 严禁协议转换',
    '❌ 严禁接收或产生非Gemini格式',
    '✅ 只允许Gemini格式内的字段调整'
  ];
  
  provider_adjustments: {
    google_ai_studio: {
      model_mapping: 'gemini-1.5-pro → specific-version',
      parameter_adjustment: 'AI Studio特定参数',
      safety_settings: 'AI Studio安全设置'
    },
    vertex_ai: {
      model_mapping: 'Vertex AI模型名格式',
      parameter_adjustment: 'Vertex AI企业参数',
      project_config: 'GCP项目配置'
    }
  };
}
```

### 🌐 6a. OpenAI分支 - Server Layer
```typescript
interface OpenAIServerLayer {
  responsibility: 'OpenAI HTTP API调用';
  input: 'OpenAIRequest'; // ✅ Provider特定的OpenAI格式
  output: 'OpenAIResponse'; // ✅ OpenAI格式响应
  
  functions: [
    '纯HTTP请求处理',
    '无格式转换',
    'API调用(LMStudio/OpenAI)',
    '错误处理和重试',
    '响应状态码处理'
  ];
  
  endpoints: {
    lmstudio: 'http://localhost:1234/v1/chat/completions',
    openai: 'https://api.openai.com/v1/chat/completions'
  };
}
```

### 🌐 6b. Gemini分支 - Server Layer
```typescript
interface GeminiServerLayer {
  responsibility: 'Gemini HTTP API调用';
  input: 'GeminiRequest'; // ✅ Provider特定的Gemini格式
  output: 'GeminiResponse'; // ✅ Gemini格式响应
  
  functions: [
    '纯HTTP请求处理',
    '无格式转换',
    'API调用(Google AI Studio/Vertex AI)',
    '错误处理和重试',
    '响应状态码处理'
  ];
  
  endpoints: {
    google_ai_studio: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    vertex_ai: 'https://{region}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:generateContent'
  };
}
```

## 🔙 响应流水线处理

### OpenAI响应流水线
```typescript
interface OpenAIResponsePipeline {
  flow: [
    '6a. Server: 返回OpenAI格式响应',
    '5a. ServerCompatibility: OpenAI响应格式标准化',
    '4a. Protocol: OpenAI响应协议处理',
    '3a. ResponseTransformer: OpenAI → Anthropic转换',
    '2. Router: 响应路由处理',
    '1. Client: Anthropic格式响应输出'
  ];
  
  transformations: {
    tool_calls: 'OpenAI[{id,type:"function",function:{name,arguments}}] → Anthropic[{type:"tool_use",id,name,input}]',
    choices: 'OpenAI.choices[0].message → Anthropic.content[]',
    usage: 'OpenAI.usage → Anthropic.usage',
    finish_reason: 'OpenAI.choices[0].finish_reason → Anthropic.stop_reason'
  };
}
```

### Gemini响应流水线
```typescript
interface GeminiResponsePipeline {
  flow: [
    '6b. Server: 返回Gemini格式响应',
    '5b. ServerCompatibility: Gemini响应格式标准化',
    '4b. Protocol: Gemini响应协议处理',
    '3b. ResponseTransformer: Gemini → Anthropic转换',
    '2. Router: 响应路由处理',
    '1. Client: Anthropic格式响应输出'
  ];
  
  transformations: {
    function_calls: 'Gemini.candidates[0].content.parts[{functionCall}] → Anthropic[{type:"tool_use"}]',
    content_parts: 'Gemini.candidates[0].content.parts[{text}] → Anthropic.content[{type:"text"}]',
    usage_metadata: 'Gemini.usageMetadata → Anthropic.usage',
    finish_reason: 'Gemini.candidates[0].finishReason → Anthropic.stop_reason'
  };
}
```

## 🛡️ 架构验证和测试

### 格式验证规则
```typescript
// ✅ Transformer层输出验证
function validateTransformerOutput(output: any, targetProtocol: 'openai' | 'gemini') {
  if (targetProtocol === 'openai') {
    // ✅ 必须的OpenAI字段
    assert(output.messages && Array.isArray(output.messages));
    assert(output.model && typeof output.model === 'string');
    if (output.tools) {
      assert(output.tools[0].type === 'function');
      assert(output.tools[0].function.name);
    }
    
    // ❌ 严禁的非OpenAI字段
    assert(!output.system); // Anthropic格式
    assert(!output.input_schema); // Anthropic格式
    assert(!output.contents); // Gemini格式
    assert(!output.functionDeclarations); // Gemini格式
  }
  
  if (targetProtocol === 'gemini') {
    // ✅ 必须的Gemini字段
    assert(output.contents && Array.isArray(output.contents));
    assert(output.model && typeof output.model === 'string');
    if (output.tools) {
      assert(output.tools[0].functionDeclarations);
    }
    
    // ❌ 严禁的非Gemini字段
    assert(!output.messages); // OpenAI格式
    assert(!output.function); // OpenAI格式
    assert(!output.input_schema); // Anthropic格式
  }
}

// ✅ Protocol层格式一致性验证
function validateProtocolLayer(input: any, output: any, protocol: 'openai' | 'gemini') {
  // 输入输出必须是同一协议格式
  assert(getProtocolFormat(input) === protocol);
  assert(getProtocolFormat(output) === protocol);
  
  // 严禁跨协议污染
  if (protocol === 'openai') {
    assert(!hasAnthropicFields(output));
    assert(!hasGeminiFields(output));
  }
  
  if (protocol === 'gemini') {
    assert(!hasAnthropicFields(output));
    assert(!hasOpenAIFields(output));
  }
}
```

## 📊 工具调用格式对比表

| 协议 | 工具定义格式 | 工具调用格式 | 工具响应格式 |
|------|-------------|-------------|-------------|
| **Anthropic** | `{name, description, input_schema}` | `{type:"tool_use", id, name, input}` | `{type:"tool_result", tool_use_id, content}` |
| **OpenAI** | `{type:"function", function:{name, description, parameters}}` | `{id, type:"function", function:{name, arguments}}` | `{role:"tool", tool_call_id, content}` |
| **Gemini** | `{functionDeclarations:[{name, description, parameters}]}` | `{functionCall:{name, args}}` | `{functionResponse:{name, response}}` |

### 转换示例

#### Anthropic → OpenAI工具转换
```typescript
// Anthropic输入
const anthropicTool = {
  name: "list_files",
  description: "List files in directory",
  input_schema: {
    type: "object",
    properties: { path: { type: "string" } },
    required: ["path"]
  }
};

// OpenAI输出 (Transformer层)
const openaiTool = {
  type: "function",
  function: {
    name: "list_files",
    description: "List files in directory",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"]
    }
  }
};
```

#### Anthropic → Gemini工具转换
```typescript
// Anthropic输入
const anthropicTool = {
  name: "list_files",
  description: "List files in directory",
  input_schema: {
    type: "object",
    properties: { path: { type: "string" } },
    required: ["path"]
  }
};

// Gemini输出 (Transformer层)
const geminiTool = {
  functionDeclarations: [{
    name: "list_files",
    description: "List files in directory",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
      additionalProperties: false
    }
  }]
};
```

---

**🎯 总结**: 本六层平行架构规范确保了OpenAI和Gemini两条分支的完全隔离，提供了严格的格式验证和完整的工具调用转换规范。每一层都有明确的职责边界，保证了系统的可靠性、可维护性和扩展性。