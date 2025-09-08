# RCC v4.0 四层双向处理架构规范

## 🎯 核心架构理念

### 核心架构原则
1. **现有PipelineAssembler保持不变** - 不重复设计组装器
2. **一次性组装，预配置模块** - 所有配置在组装时固化
3. **运行时零配置传递** - process接口只传递纯数据
4. **双向处理架构** - 移除ResponseTransformer层，每层支持request/response
5. **模板字段表转换** - 用配置化映射替代硬编码逻辑
6. **并发安全的无状态模块** - 支持多请求并发处理

## 🏗️ 四层双向处理架构图

**重要说明**: 根据RouterPreprocessor的代码，**流水线只包含四层**：
- Client和Router不在流水线内，它们是外层组件
- Pipeline: Transformer ↔ Protocol ↔ ServerCompatibility ↔ Server

```
                           🌐 Client (外层组件)
                        (Anthropic格式输入/输出)
                               ↓ ↑
                        🧭 Router (外层组件)
                     (路由选择和流水线分发)
                               ↓ ↑
              ┌─────────────────────────────────────────────────────┐
              ↓         四层双向处理流水线                         ↑
  ┌─────────────────────────────────────────────────────────────────────┐
  │                    REQUEST FLOW (→)                                │
  │  1️⃣ Transformer  →  2️⃣ Protocol  →  3️⃣ ServerCompat  →  4️⃣ Server  │
  │                                                                     │
  │  🔄 协议转换       🔌 协议控制       🔧 Provider兼容     🌐 API调用  │
  │  Anthropic→OpenAI   • 模型名映射     • 字段调整        • HTTP请求 │
  │                     • 端点配置      • 模板转换                   │
  │                     • API密钥       • 参数优化                   │
  │                                                                     │
  │  ═════════════════════════════════════════════════════════════════  │
  │                                                                     │
  │                   RESPONSE FLOW (←)                                │
  │  1️⃣ Transformer  ←  2️⃣ Protocol  ←  3️⃣ ServerCompat  ←  4️⃣ Server  │
  │                                                                     │
  │  🔄 格式返回       🔌 响应处理       🔧 格式标准化     🌐 返回响应  │
  │  OpenAI→Anthropic   • 错误处理       • 响应清理        • 状态码   │
  │                     • 统计数据       • 网络重试                   │
  └─────────────────────────────────────────────────────────────────────┘
              ↑                                                 ↑
              └─────────────────────────────────────────────────┘
                               ↑ ↓
                        🌐 Client (外层组件)
                     (Anthropic格式响应输出)
```

## 📋 各层详细规范

### 🌐 Client (外层组件) - 请求入口
```typescript
interface ClientComponent {
  responsibility: '统一的Anthropic格式接口';
  location: '流水线外部';
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

### 🧭 Router (外层组件) - 流水线调度
```typescript
interface RouterComponent {
  responsibility: '路由选择和流水线分发';
  location: '流水线外部';
  input: 'AnthropicRequest';
  output: '选中的流水线ID';
  
  functions: [
    '虚拟模型映射',
    '流水线选择',
    '负载均衡调度',
    '健康检查'
  ];
  
  routing_logic: {
    virtual_models: ['default', 'background', 'reasoning', 'webSearch', 'longContext'],
    pipeline_selection: '根据路由表选择可用流水线'
  };
}
```

## 🔄 流水线四层架构

### 1️⃣ Transformer Layer (转换层)
```typescript
interface TransformerLayer {
  responsibility: 'Anthropic ↔ Provider协议转换';
  input_format: 'AnthropicRequest';
  output_format: 'ProviderRequest (OpenAI/Gemini/etc)';
  
  bidirectional_processing: {
    request_transform: 'processRequest(AnthropicRequest) → ProviderRequest',
    response_transform: 'processResponse(ProviderResponse) → AnthropicResponse'
  };
  
  pre_configured_fields: [
    'maxTokens映射表',
    '工具格式转换模板',
    '消息格式转换模板',
    '参数映射表'
  ];
  
  strict_rules: [
    '✅ 支持双向转换：request和response',
    '✅ 使用预配置的转换模板',
    '❌ 严禁运行时格式决策',
    '❌ 严禁跨协议格式混合'
  ];
}
```

#### 转换示例
```typescript
// Request转换 (Anthropic → OpenAI)
const requestTransform = {
  tools: 'Anthropic[{name,description,input_schema}] → OpenAI[{type:"function",function:{name,description,parameters}}]',
  messages: 'Anthropic[{role,content[]}] → OpenAI[{role,content}]',
  system_message: 'Anthropic.system → OpenAI.messages[0]{role:"system",content}',
  parameters: 'Anthropic.max_tokens → OpenAI.max_tokens'
};

// Response转换 (OpenAI → Anthropic)
const responseTransform = {
  tool_calls: 'OpenAI[{id,type:"function",function:{name,arguments}}] → Anthropic[{type:"tool_use",id,name,input}]',
  choices: 'OpenAI.choices[0].message → Anthropic.content[]',
  usage: 'OpenAI.usage → Anthropic.usage',
  finish_reason: 'OpenAI.choices[0].finish_reason → Anthropic.stop_reason'
};
```

### 2️⃣ Protocol Layer (协议层)
```typescript
interface ProtocolLayer {
  responsibility: 'Provider协议标准处理';
  input_format: 'ProviderRequest';
  output_format: 'ProviderRequest (with protocol config)';
  
  bidirectional_processing: {
    request_process: 'processRequest(ProviderRequest) → EnhancedProviderRequest',
    response_process: 'processResponse(ProviderResponse) → ProcessedProviderResponse'
  };
  
  pre_configured_fields: [
    '模型名映射表',
    '端点URL配置',
    'API密钥',
    '认证方式',
    '超时配置'
  ];
  
  functions: [
    '模型名映射',
    '端点URL设置',
    'API认证处理',
    '协议参数验证',
    '流式/非流式配置',
    '错误码标准化',
    '响应统计收集'
  ];
}
```

### 3️⃣ ServerCompatibility Layer (兼容层)
```typescript
interface ServerCompatibilityLayer {
  responsibility: 'Provider特定的格式微调';
  input_format: 'ProviderRequest (protocol enhanced)';
  output_format: 'ProviderRequest (server compatible)';
  
  bidirectional_processing: {
    request_adapt: 'processRequest(ProviderRequest) → ServerCompatibleRequest',
    response_adapt: 'processResponse(ServerResponse) → StandardProviderResponse'
  };
  
  pre_configured_fields: [
    'Provider特定字段映射',
    '参数范围限制',
    '工具格式微调模板',
    '错误码映射表'
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

### 4️⃣ Server Layer (服务层)
```typescript
interface ServerLayer {
  responsibility: 'HTTP API调用';
  input_format: 'ServerCompatibleRequest';
  output_format: 'ServerResponse';
  
  bidirectional_processing: {
    request_execute: 'processRequest(ServerCompatibleRequest) → HTTPResponse',
    response_handle: 'processResponse(HTTPResponse) → ServerResponse'
  };
  
  pre_configured_fields: [
    'API端点URL',
    'HTTP客户端配置',
    '超时设置',
    '重试策略',
    '连接池配置'
  ];
  
  functions: [
    '纯HTTP请求处理',
    'API调用执行',
    '网络错误处理',
    '响应状态码处理',
    '连接管理',
    '请求重试'
  ];
  
  endpoints: {
    lmstudio: 'http://localhost:1234/v1/chat/completions',
    openai: 'https://api.openai.com/v1/chat/completions',
    anthropic: 'https://api.anthropic.com/v1/messages'
  };
}
```

## 🔧 PipelineAssembler集成

### 现有PipelineAssembler保持不变
```typescript
interface PipelineAssembler {
  responsibility: '流水线组装和配置固化';
  timing: '系统初始化时执行一次';
  
  assembly_process: [
    '1. 读取配置文件',
    '2. 创建各层实例',
    '3. 预配置所有参数',
    '4. 连接层间接口',
    '5. 执行握手验证',
    '6. 标记为runtime状态'
  ];
  
  configuration_injection: {
    transformer: '注入转换模板和映射表',
    protocol: '注入API密钥和端点配置',
    compatibility: '注入Provider特定配置',
    server: '注入HTTP客户端和超时配置'
  };
}
```

### 运行时零配置原则
```typescript
// ✅ 正确：运行时只传递数据
const response = await pipeline.execute(request);

// ❌ 错误：运行时传递配置
const response = await pipeline.execute(request, {
  apiKey: 'xxx',
  endpoint: 'xxx',
  maxTokens: 4096
});
```

## 🛡️ 架构验证和测试

### 双向处理验证
```typescript
// 验证每层都支持双向处理
function validateBidirectionalSupport(layer: PipelineLayer) {
  assert(typeof layer.processRequest === 'function');
  assert(typeof layer.processResponse === 'function');
}

// 验证预配置完整性
function validatePreConfiguration(pipeline: Pipeline) {
  // 所有层都应该有预配置的参数，不需要运行时传递
  pipeline.layers.forEach(layer => {
    assert(layer.isConfigured === true);
    assert(Object.keys(layer.runtimeConfig).length === 0);
  });
}
```

### 格式验证规则
```typescript
// 验证Transformer层输出格式
function validateTransformerOutput(input: AnthropicRequest, output: ProviderRequest) {
  // 输入必须是Anthropic格式
  assert(hasAnthropicFields(input));
  
  // 输出必须是目标Provider格式
  assert(!hasAnthropicFields(output));
  assert(hasValidProviderFields(output));
}

// 验证Protocol层格式一致性
function validateProtocolLayer(input: ProviderRequest, output: ProviderRequest) {
  // 输入输出必须是同一协议格式
  assert(getProtocolFormat(input) === getProtocolFormat(output));
}
```

## 📊 工具调用双向转换表

| 转换方向 | Anthropic格式 | OpenAI格式 | 处理层 |
|---------|--------------|-----------|--------|
| **Request** | `{name, description, input_schema}` | `{type:"function", function:{name, description, parameters}}` | Transformer |
| **Tool Use** | `{type:"tool_use", id, name, input}` | `{id, type:"function", function:{name, arguments}}` | Transformer |
| **Tool Result** | `{type:"tool_result", tool_use_id, content}` | `{role:"tool", tool_call_id, content}` | Transformer |
| **Response** | `{type:"tool_use", id, name, input}` | `{id, type:"function", function:{name, arguments}}` | Transformer |

### 双向转换示例
```typescript
// Request转换 (Anthropic → OpenAI)
class TransformerLayer {
  async processRequest(anthropicRequest: AnthropicRequest): Promise<OpenAIRequest> {
    return this.convertToOpenAI(anthropicRequest);
  }
  
  async processResponse(openaiResponse: OpenAIResponse): Promise<AnthropicResponse> {
    return this.convertToAnthropic(openaiResponse);
  }
  
  private convertToOpenAI(input: AnthropicRequest): OpenAIRequest {
    return {
      model: input.model,
      messages: this.convertMessages(input.messages),
      tools: input.tools?.map(tool => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema
        }
      })),
      max_tokens: input.max_tokens
    };
  }
  
  private convertToAnthropic(output: OpenAIResponse): AnthropicResponse {
    return {
      content: this.convertResponseContent(output.choices[0].message),
      usage: output.usage,
      stop_reason: this.mapFinishReason(output.choices[0].finish_reason)
    };
  }
}
```

## 🎯 总结

### 核心架构优势
1. **清晰的责任边界**: Client和Router在流水线外，四层在流水线内
2. **双向处理能力**: 每层支持request和response处理，无需独立ResponseTransformer
3. **预配置架构**: 所有配置在组装时固化，运行时零配置传递
4. **并发安全**: 无状态设计支持多请求并发处理
5. **模板化转换**: 使用配置化映射替代硬编码逻辑
6. **现有组件保持**: PipelineAssembler保持不变，避免重复设计

### 与现有实现对比
```typescript
// ❌ 旧架构：六层 + 独立ResponseTransformer
Client → Router → Transformer → Protocol → ServerCompat → Server → ResponseTransformer

// ✅ 新架构：外层组件 + 四层双向处理
Client (外层) → Router (外层) → [Transformer ↔ Protocol ↔ ServerCompat ↔ Server] (流水线)
```

这个架构设计确保了：
- **性能优异**: 预配置消除运行时开销
- **架构清晰**: 四层双向处理，职责明确
- **易于维护**: 模板化转换，配置化管理
- **扩展性好**: 支持添加新的Provider和协议
- **向后兼容**: 现有PipelineAssembler继续使用