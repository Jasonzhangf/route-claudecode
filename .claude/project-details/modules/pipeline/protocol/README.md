# Protocol层 - 双向协议控制模块

## 模块概述

**位置**: 流水线第2层 (Protocol Layer)
**职责**: Provider协议标准处理和双向控制
**架构**: 预配置 + 双向处理 + 协议控制

Protocol层是流水线的第二层，负责Provider协议的标准处理，包括模型名映射、端点配置、API认证、协议参数验证等。采用预配置方式固化所有协议控制参数。

## 目录结构

```
protocol/
├── README.md                    # 协议模块文档
├── openai-protocol.ts           # OpenAI协议处理模块
├── gemini-protocol.ts           # Gemini协议处理模块
├── gemini-native-protocol.ts    # Gemini原生协议处理模块
└── base-pipeline-module.ts      # 基础流水线模块类
```

## 双向处理架构

### 1. Request处理 (ProviderRequest → EnhancedProviderRequest)
```typescript
interface ProtocolLayer {
  processRequest(input: ProviderRequest): Promise<EnhancedProviderRequest>;
  
  // 预配置协议控制字段
  pre_configured_protocol: {
    model_name_mapping: Record<string, string>;
    endpoint_url: string;
    api_key: string;
    auth_method: 'bearer' | 'api_key' | 'oauth';
    timeout_config: TimeoutConfig;
    stream_config: StreamConfig;
  };
}
```

### 2. Response处理 (ProviderResponse → ProcessedProviderResponse)
```typescript
interface ProtocolLayer {
  processResponse(input: ProviderResponse): Promise<ProcessedProviderResponse>;
  
  // 预配置响应处理字段
  pre_configured_response: {
    error_code_mapping: Record<string, string>;
    usage_stats_extraction: UsageStatsConfig;
    status_code_handling: StatusCodeConfig;
    rate_limit_headers: RateLimitConfig;
  };
}
```

### 3. 协议控制功能
- **模型名映射**: virtual_model → provider_model
- **端点URL设置**: API调用端点配置
- **API认证处理**: 密钥、token、OAuth等
- **协议参数验证**: 请求参数验证和清理
- **流式/非流式配置**: stream参数处理
- **错误码标准化**: Provider错误码统一处理
- **响应统计收集**: usage、rate_limit等数据收集

## 接口定义

### 双向处理接口
```typescript
interface ProtocolLayer {
  // 双向处理方法
  processRequest(input: ProviderRequest): Promise<EnhancedProviderRequest>;
  processResponse(input: ProviderResponse): Promise<ProcessedProviderResponse>;
  
  // 配置注入（PipelineAssembler调用）
  injectConfiguration(config: ProtocolConfig): void;
  
  // 健康检查
  healthCheck(): Promise<{ healthy: boolean; details: any }>;
}

interface ProtocolConfig {
  provider: 'openai' | 'gemini' | 'anthropic' | 'lmstudio';
  model_mapping: Record<string, string>;
  api_endpoint: string;
  api_key: string;
  auth_config: AuthenticationConfig;
  timeout_settings: TimeoutConfig;
  stream_settings: StreamConfig;
  validation_rules: ValidationRules;
}

interface AuthenticationConfig {
  method: 'bearer' | 'api_key' | 'oauth' | 'custom';
  header_name?: string;
  header_prefix?: string;
  token_refresh?: TokenRefreshConfig;
}
```

### 预配置原则
```typescript
// ✅ 正确：组装时注入配置
const protocolLayer = new ProtocolLayer();
protocolLayer.injectConfiguration({
  provider: 'openai',
  model_mapping: { 'default': 'gpt-4' },
  api_endpoint: 'https://api.openai.com/v1',
  api_key: 'sk-xxx'
});

// ✅ 正确：运行时只传递数据
const result = await protocolLayer.processRequest(providerRequest);

// ❌ 错误：运行时传递配置
const result = await protocolLayer.processRequest(request, {
  api_key: 'sk-xxx',
  endpoint: 'https://api.openai.com/v1'
});
```

## 预配置协议处理

### OpenAI双向协议处理
```typescript
export class OpenAIProtocolLayer implements ProtocolLayer {
  private config: ProtocolConfig;
  private modelMapping: Record<string, string>;
  private authConfig: AuthenticationConfig;

  // PipelineAssembler调用，注入预配置
  injectConfiguration(config: ProtocolConfig): void {
    this.config = config;
    this.modelMapping = config.model_mapping;
    this.authConfig = config.auth_config;
  }

  // Request处理：应用协议控制
  async processRequest(input: ProviderRequest): Promise<EnhancedProviderRequest> {
    return {
      ...input,
      // 使用预配置的模型映射
      model: this.modelMapping[input.model] || input.model,
      // 添加预配置的认证头
      headers: {
        ...input.headers,
        'Authorization': `Bearer ${this.config.api_key}`,
        'Content-Type': 'application/json'
      },
      // 添加预配置的端点信息
      endpoint: this.config.api_endpoint,
      // 应用预配置的超时设置
      timeout: this.config.timeout_settings.request_timeout
    };
  }

  // Response处理：收集统计和错误处理
  async processResponse(input: ProviderResponse): Promise<ProcessedProviderResponse> {
    return {
      ...input,
      // 使用预配置的错误码映射
      normalized_error: this.mapErrorCode(input.error),
      // 提取使用统计（根据预配置规则）
      usage_stats: this.extractUsageStats(input),
      // 处理rate limit信息
      rate_limit_info: this.extractRateLimitInfo(input.headers),
      // 添加处理时间戳
      processed_at: new Date().toISOString()
    };
  }
  
  private mapErrorCode(error: any): any {
    // 使用预配置的错误码映射
    return this.config.validation_rules.error_mapping[error?.code] || error;
  }
  
  private extractUsageStats(response: any): any {
    // 使用预配置的usage提取规则
    return response.usage || null;
  }
}
```

### Gemini双向协议处理
```typescript
export class GeminiProtocolLayer implements ProtocolLayer {
  private config: ProtocolConfig;

  injectConfiguration(config: ProtocolConfig): void {
    this.config = config;
  }

  async processRequest(input: GeminiRequest): Promise<EnhancedGeminiRequest> {
    return {
      ...input,
      // 应用Gemini特定的API密钥格式
      headers: {
        'X-API-Key': this.config.api_key,
        'Content-Type': 'application/json'
      },
      // 使用预配置的端点
      endpoint: `${this.config.api_endpoint}/models/${input.model}:generateContent`,
      // 应用预配置的安全设置
      safetySettings: this.config.validation_rules.safety_settings
    };
  }

  async processResponse(input: GeminiResponse): Promise<ProcessedGeminiResponse> {
    return {
      ...input,
      // 标准化Gemini错误响应
      normalized_error: this.normalizeGeminiError(input.error),
      // 提取Gemini使用统计
      usage_stats: input.usageMetadata,
      processed_at: new Date().toISOString()
    };
  }
}
```

## 协议控制机制

### 模型名映射处理
```typescript
interface ModelMappingConfig {
  virtual_to_provider: Record<string, string>;
  provider_specific_params: Record<string, any>;
}

// 预配置模型映射示例
const openaiModelMapping = {
  'default': 'gpt-4',
  'fast': 'gpt-3.5-turbo',
  'smart': 'gpt-4',
  'vision': 'gpt-4-vision-preview'
};

const lmstudioModelMapping = {
  'default': 'llama-3.1-8b',
  'coding': 'qwen2.5-coder-32b',
  'reasoning': 'llama-3.1-70b'
};
```

### 认证处理机制
```typescript
interface AuthenticationHandler {
  provider: string;
  method: 'bearer' | 'api_key' | 'oauth' | 'custom';
  
  applyAuth(request: ProviderRequest): EnhancedProviderRequest;
}

// 预配置认证处理示例
const authHandlers = {
  openai: {
    method: 'bearer',
    header: 'Authorization',
    prefix: 'Bearer '
  },
  gemini: {
    method: 'api_key',
    header: 'X-API-Key',
    prefix: ''
  },
  anthropic: {
    method: 'api_key',
    header: 'x-api-key',
    prefix: ''
  }
};
```

### 流式状态管理
```typescript
class StreamStateManager {
  private activeStreams: Map<string, StreamState> = new Map();
  
  createStream(requestId: string): StreamState {
    const state = new StreamState(requestId);
    this.activeStreams.set(requestId, state);
    return state;
  }
  
  closeStream(requestId: string): void {
    this.activeStreams.delete(requestId);
  }
}
```

## 协议验证规则

### OpenAI协议验证
```typescript
const openaiValidationRules = {
  required: ['model', 'messages'],
  optional: ['temperature', 'max_tokens', 'stream', 'tools'],
  messages: {
    required: ['role', 'content'],
    roles: ['system', 'user', 'assistant', 'tool']
  }
};
```

### Anthropic协议验证
```typescript
const anthropicValidationRules = {
  required: ['model', 'max_tokens', 'messages'],
  optional: ['temperature', 'stream', 'tools'],
  messages: {
    required: ['role', 'content'],
    roles: ['user', 'assistant']
  }
};
```

### Gemini协议验证
```typescript
const geminiValidationRules = {
  required: ['contents'],
  optional: ['generationConfig', 'safetySettings', 'tools'],
  contents: {
    required: ['role', 'parts'],
    roles: ['user', 'model']
  }
};
```

## 错误处理

### 验证错误
```typescript
class ProtocolValidationError extends Error {
  constructor(protocol: string, field: string, message: string) {
    super(`Protocol validation failed for ${protocol}.${field}: ${message}`);
    this.name = 'ProtocolValidationError';
  }
}
```

### 转换错误
```typescript
class StreamConversionError extends Error {
  constructor(direction: 'to-stream' | 'to-non-stream', message: string) {
    super(`Stream conversion failed (${direction}): ${message}`);
    this.name = 'StreamConversionError';
  }
}
```

## 性能优化

### 流式缓冲
- 合理的缓冲区大小
- 及时释放已处理的数据
- 内存使用监控

### 验证缓存
- 缓存验证结果
- 避免重复验证
- 智能缓存失效

## 双向处理质量要求

### 预配置要求
- ✅ 所有协议控制参数在组装时固化
- ✅ 运行时零配置传递
- ✅ 模型映射表预加载
- ✅ 认证配置预设置

### 双向一致性
- ✅ processRequest和processResponse配对处理
- ✅ 请求增强和响应标准化的一致性
- ✅ 错误码映射的双向支持
- ✅ 统计数据的完整收集

### 协议控制准确性
- ✅ 无静默失败
- ✅ 无硬编码协议规则
- ✅ 完整的协议验证
- ✅ 标准化的错误处理

### 性能和安全
- ✅ 无状态并发安全
- ✅ API密钥安全处理
- ✅ 超时和重试控制
- ✅ 类型安全的TypeScript实现

### 架构要求
- ✅ 与现有PipelineAssembler兼容
- ✅ 支持动态Provider配置
- ✅ 支持新认证方式的插件式添加
- ✅ 模块化设计，独立测试

## 总结

Protocol层作为流水线的第二层，采用双向处理架构，通过预配置协议控制参数，实现了高效、安全、可维护的协议处理功能。与现有PipelineAssembler完美集成，支持运行时零配置、高并发处理，为整个流水线系统提供了强大的协议控制能力。