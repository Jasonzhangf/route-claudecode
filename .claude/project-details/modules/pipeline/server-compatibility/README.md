# Server-Compatibility模块

## 模块概述

Server-Compatibility模块负责处理不同AI服务商的API差异，特别是OpenAI的各种变种和扩展，确保标准协议能够适配各种第三方服务。

## 目录结构

```
src/pipeline/modules/server-compatibility/
├── README.md                           # Server-Compatibility模块文档
├── index.ts                            # 模块入口
├── server-compatibility-module.ts      # 基础兼容性类
├── openai-compatibility.ts             # OpenAI标准兼容
├── deepseek-compatibility.ts           # DeepSeek兼容处理
├── lmstudio-compatibility.ts           # LMStudio兼容处理
├── gemini-compatibility.ts             # Gemini兼容处理
├── anthropic-compatibility.ts          # Anthropic兼容处理
└── types/
    ├── compatibility-types.ts          # 兼容性类型定义
    ├── server-specific-types.ts        # 服务商特定类型
    └── adaptation-types.ts             # 适配相关类型
```

## 核心功能

### 1. 请求适配
- **标准协议 → 服务商特定格式**: 将标准协议转换为服务商要求的格式
- **参数调整**: 根据服务商特性调整参数
- **字段映射**: 处理不同服务商的字段差异

### 2. 响应适配
- **服务商响应 → 标准协议**: 将服务商响应转换回标准格式
- **格式统一**: 确保响应格式的一致性
- **错误码映射**: 统一不同服务商的错误码

### 3. 特殊处理
- **工具调用优化**: 针对不同服务商的工具调用特性优化
- **模型名称映射**: 处理模型名称的差异
- **参数限制处理**: 适配不同服务商的参数限制

## 接口定义

```typescript
interface ServerCompatibilityModule extends PipelineModule {
  name: 'server-compatibility';
  serverType: string;
  
  // 标准协议 → 服务器特定格式
  adaptRequest(standardRequest: StandardRequest): Promise<ServerRequest>;
  
  // 服务器响应 → 标准协议
  adaptResponse(serverResponse: ServerResponse): Promise<StandardResponse>;
  
  validateStandardRequest(request: StandardRequest): boolean;
  validateServerResponse(response: ServerResponse): boolean;
}
```

## 服务商适配实现

### OpenAI标准兼容
```typescript
export class OpenAICompatibility implements ServerCompatibilityModule {
  name = 'server-compatibility' as const;
  serverType = 'openai';

  async adaptRequest(standardRequest: OpenAIRequest): Promise<OpenAIRequest> {
    // OpenAI标准格式，无需适配
    return standardRequest;
  }

  async adaptResponse(serverResponse: OpenAIResponse): Promise<OpenAIResponse> {
    // OpenAI标准响应，无需适配
    return serverResponse;
  }
}
```

### DeepSeek兼容处理
```typescript
export class DeepSeekCompatibility implements ServerCompatibilityModule {
  name = 'server-compatibility' as const;
  serverType = 'deepseek';

  async adaptRequest(standardRequest: OpenAIRequest): Promise<DeepSeekRequest> {
    const adaptedRequest = { ...standardRequest };
    
    // DeepSeek特殊优化
    if (adaptedRequest.tools && adaptedRequest.tools.length > 0) {
      // 自动设置tool_choice为auto优化工具使用
      adaptedRequest.tool_choice = 'auto';
    }
    
    // 模型名称映射
    adaptedRequest.model = this.mapModelName(adaptedRequest.model);
    
    // 参数调整
    if (adaptedRequest.max_tokens && adaptedRequest.max_tokens > 8192) {
      adaptedRequest.max_tokens = 8192; // DeepSeek限制
    }
    
    return adaptedRequest;
  }

  private mapModelName(model: string): string {
    const modelMap = {
      'gpt-4': 'deepseek-chat',
      'gpt-3.5-turbo': 'deepseek-chat'
    };
    return modelMap[model] || 'deepseek-chat';
  }
}
```

### LMStudio兼容处理
```typescript
export class LMStudioCompatibility implements ServerCompatibilityModule {
  name = 'server-compatibility' as const;
  serverType = 'lmstudio';

  async adaptRequest(standardRequest: OpenAIRequest): Promise<LMStudioRequest> {
    const adaptedRequest = { ...standardRequest };
    
    // 本地模型名称处理
    adaptedRequest.model = this.resolveLocalModel(adaptedRequest.model);
    
    // 工具调用格式特殊处理
    if (adaptedRequest.tools) {
      adaptedRequest.tools = this.adaptToolsForLMStudio(adaptedRequest.tools);
    }
    
    // 参数限制调整
    if (adaptedRequest.temperature && adaptedRequest.temperature > 2.0) {
      adaptedRequest.temperature = 2.0; // LMStudio限制
    }
    
    return adaptedRequest;
  }

  private resolveLocalModel(model: string): string {
    // 处理本地模型路径
    if (model.startsWith('gpt-')) {
      return 'local-model'; // 使用当前加载的本地模型
    }
    return model;
  }
}
```

### Gemini兼容处理
```typescript
export class GeminiCompatibility implements ServerCompatibilityModule {
  name = 'server-compatibility' as const;
  serverType = 'gemini';

  async adaptRequest(standardRequest: GeminiRequest): Promise<GeminiServerRequest> {
    return {
      contents: this.convertMessages(standardRequest.contents),
      generationConfig: this.convertConfig(standardRequest.generationConfig),
      safetySettings: this.getDefaultSafetySettings(),
      tools: this.convertTools(standardRequest.tools)
    };
  }

  private getDefaultSafetySettings(): SafetySetting[] {
    return [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      }
    ];
  }

  private convertConfig(config: any): GenerationConfig {
    return {
      temperature: config?.temperature || 0.7,
      topP: config?.top_p || 0.9,
      topK: config?.top_k || 40,
      maxOutputTokens: config?.max_tokens || 2048
    };
  }
}
```

### Anthropic兼容处理
```typescript
export class AnthropicCompatibility implements ServerCompatibilityModule {
  name = 'server-compatibility' as const;
  serverType = 'anthropic';

  async adaptRequest(standardRequest: AnthropicRequest): Promise<AnthropicServerRequest> {
    const adaptedRequest = { ...standardRequest };
    
    // System消息特殊处理
    if (adaptedRequest.messages[0]?.role === 'system') {
      const systemMessage = adaptedRequest.messages.shift();
      adaptedRequest.system = systemMessage.content;
    }
    
    // 确保max_tokens存在
    if (!adaptedRequest.max_tokens) {
      adaptedRequest.max_tokens = 4096;
    }
    
    return adaptedRequest;
  }

  async adaptResponse(serverResponse: AnthropicServerResponse): Promise<AnthropicResponse> {
    // Anthropic响应格式已经是标准格式
    return serverResponse;
  }
}
```

## 特殊处理逻辑

### 工具调用适配
```typescript
interface ToolAdaptation {
  // OpenAI格式
  openai: {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: object;
    };
  };
  
  // Anthropic格式
  anthropic: {
    name: string;
    description: string;
    input_schema: object;
  };
  
  // Gemini格式
  gemini: {
    function_declarations: Array<{
      name: string;
      description: string;
      parameters: object;
    }>;
  };
}
```

### 模型名称映射
```typescript
const modelMappings = {
  deepseek: {
    'gpt-4': 'deepseek-chat',
    'gpt-3.5-turbo': 'deepseek-chat',
    'claude-3-5-sonnet': 'deepseek-reasoner'
  },
  lmstudio: {
    'gpt-4': 'local-model',
    'claude-3-5-sonnet': 'local-model'
  },
  gemini: {
    'gpt-4': 'gemini-2.5-pro',
    'gpt-3.5-turbo': 'gemini-2.5-flash'
  }
};
```

### 参数限制处理
```typescript
const parameterLimits = {
  deepseek: {
    max_tokens: 8192,
    temperature: { min: 0, max: 2 }
  },
  lmstudio: {
    max_tokens: 4096,
    temperature: { min: 0, max: 2 }
  },
  gemini: {
    maxOutputTokens: 8192,
    temperature: { min: 0, max: 2 }
  }
};
```

## 错误处理

### 适配错误
```typescript
class AdaptationError extends Error {
  constructor(serverType: string, operation: string, message: string) {
    super(`Adaptation failed for ${serverType} (${operation}): ${message}`);
    this.name = 'AdaptationError';
  }
}
```

### 验证错误
```typescript
class CompatibilityValidationError extends Error {
  constructor(serverType: string, field: string, message: string) {
    super(`Compatibility validation failed for ${serverType}.${field}: ${message}`);
    this.name = 'CompatibilityValidationError';
  }
}
```

## 扩展性设计

### 新服务商支持
1. 创建新的兼容性类
2. 实现ServerCompatibilityModule接口
3. 添加特定的适配逻辑
4. 注册到兼容性工厂

### 配置驱动适配
```typescript
interface CompatibilityConfig {
  serverType: string;
  modelMappings: Record<string, string>;
  parameterLimits: Record<string, any>;
  specialHandlers: string[];
}
```

## 质量要求

- ✅ 无静默失败
- ✅ 无mockup适配
- ✅ 无重复适配代码
- ✅ 无硬编码服务商配置
- ✅ 完整的适配验证
- ✅ 双向适配支持
- ✅ 扩展性设计