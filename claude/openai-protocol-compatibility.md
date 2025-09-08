# OpenAI协议内特殊字段转换逻辑实现

## 1. Protocol层实现

### 1.1 流式处理
- `stream: true` → 转换为非流式请求发送给不支持流式的Provider
- `stream: false` → 直接发送
- 非流式响应 → 模拟流式响应返回

### 1.2 协议验证
- 验证请求/响应格式是否符合OpenAI标准
- 标准化字段格式
- 错误格式转换

## 2. ServerCompatibility层实现

### 2.1 iFlow兼容性处理
```typescript
// iflow-compatibility.ts
export class IFlowCompatibilityModule extends ServerCompatibilityModule {
  async processRequest(request: any, context: ModuleProcessingContext): Promise<any> {
    // 1. top_k 参数计算
    if (!request.top_k && request.temperature) {
      const topKConfig = this.config.parameters.topK;
      request.top_k = Math.max(
        topKConfig.min,
        Math.min(topKConfig.max, Math.floor(request.temperature * topKConfig.max))
      );
    }
    
    // 2. 模型名称映射
    if (this.config.models.mapping && this.config.models.mapping[request.model]) {
      request.model = this.config.models.mapping[request.model];
    }
    
    // 3. 认证方式处理
    if (this.config.apiKey) {
      context.metadata.protocolConfig.customHeaders = {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      };
    }
    
    return request;
  }
  
  async processResponse(response: any, context: ModuleProcessingContext): Promise<any> {
    // 标准化响应格式
    if (!response.id) {
      response.id = `chatcmpl-iflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    if (!response.object) {
      response.object = 'chat.completion';
    }
    
    return response;
  }
}
```

### 2.2 Qwen兼容性处理
```typescript
// qwen-compatibility.ts
export class QwenCompatibilityModule extends ServerCompatibilityModule {
  async processRequest(request: any, context: ModuleProcessingContext): Promise<any> {
    // 1. 工具调用对话流修复
    if (request.messages && Array.isArray(request.messages)) {
      request.messages = this.fixQwenToolCallingConversationFlow(request.messages);
    }
    
    // 2. OAuth2 token加载
    const authFilePath = `/Users/fanzhang/.route-claudecode/auth/qwen-auth-1.json`;
    if (fs.existsSync(authFilePath)) {
      const authData = JSON.parse(fs.readFileSync(authFilePath, 'utf8'));
      if (authData.access_token) {
        context.metadata.protocolConfig.apiKey = authData.access_token;
      }
    }
    
    return request;
  }
  
  async processResponse(response: any, context: ModuleProcessingContext): Promise<any> {
    // 1. 标准化choices数组
    if (response.choices && Array.isArray(response.choices)) {
      response.choices = this.normalizeQwenChoices(response.choices);
    }
    
    // 2. 标准化工具调用格式
    if (response.choices) {
      for (let i = 0; i < response.choices.length; i++) {
        const choice = response.choices[i];
        if (choice.message && choice.message.tool_calls) {
          choice.message.tool_calls = this.normalizeQwenToolCalls(choice.message.tool_calls);
        }
      }
    }
    
    return response;
  }
}
```

### 2.3 ModelScope兼容性处理
```typescript
// modelscope-compatibility.ts
export class ModelScopeCompatibilityModule extends ServerCompatibilityModule {
  async processRequest(request: any, context: ModuleProcessingContext): Promise<any> {
    // 1. 工具格式转换（Anthropic → OpenAI）
    if (request.tools && Array.isArray(request.tools)) {
      request.tools = this.convertAnthropicToOpenAI(request.tools);
    }
    
    // 2. 模型名称映射
    if (request.__internal && request.__internal.actualModel) {
      request.model = request.__internal.actualModel;
    }
    
    return request;
  }
  
  async processResponse(response: any, context: ModuleProcessingContext): Promise<any> {
    // 标准化响应格式
    if (!response.id) {
      response.id = `chatcmpl-modelscope-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    return response;
  }
}
```

## 3. 字段转换规则

### 3.1 请求字段转换
| 源字段 | 目标字段 | 转换规则 |
|--------|----------|----------|
| temperature | temperature | 直接映射，范围限制 |
| top_p | top_p | 直接映射，范围限制 |
| max_tokens | max_tokens | 直接映射，范围限制 |
| stop_sequences | stop | 数组转换 |
| tools | tools | 格式标准化 |
| tool_choice | tool_choice | 格式转换 |

### 3.2 响应字段转换
| 源字段 | 目标字段 | 转换规则 |
|--------|----------|----------|
| id | id | 生成唯一ID |
| object | object | 标准化为"chat.completion" |
| choices | choices | 格式标准化 |
| usage | usage | 字段映射 |

## 4. 特殊处理逻辑

### 4.1 工具调用处理
- Anthropic工具格式 → OpenAI工具格式
- 工具调用参数序列化
- 工具结果格式化

### 4.2 流式响应处理
- 非流式响应 → 流式响应模拟
- 流式块生成和聚合
- SSE格式处理

### 4.3 错误处理
- Provider特定错误格式 → OpenAI标准错误格式
- 错误代码映射
- 错误信息标准化

这些实现确保了不同Provider的兼容性处理，同时保持了OpenAI协议的标准格式。