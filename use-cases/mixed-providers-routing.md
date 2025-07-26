# Use Case 4: 混合供应商路由 (CodeWhisperer + OpenAI)

## 场景描述
在Use Case 2的基础上，除了两个CodeWhisperer供应商外，还增加OpenAI供应商，实现更灵活的多供应商路由策略，某些模型路由到OpenAI供应商以获得更好的性能或特定功能。

## 用户需求
- **基础**: Use Case 2的多CodeWhisperer供应商模型分离
- **扩展**: 增加OpenAI供应商
- **路由策略**: 某些模型类别路由到OpenAI，其他保持CodeWhisperer
- **目标**: 多样化供应商、功能互补、成本和性能平衡

## 技术实现

### 1. 混合供应商配置
```json
{
  "name": "Mixed Providers Routing",
  "input": {"format": "anthropic", "defaultInstance": true},
  "routing": {
    "rules": {
      "default": {
        "provider": "codewhisperer-primary",
        "model": "CLAUDE_SONNET_4_20250514_V1_0",
        "format": "anthropic"
      },
      "background": {
        "provider": "codewhisperer-secondary", 
        "model": "CLAUDE_3_7_SONNET_20250219_V1_0",
        "format": "anthropic"
      },
      "thinking": {
        "provider": "openai-shuaihong",
        "model": "gpt-4o",
        "format": "openai",
        "reason": "OpenAI在复杂推理任务上表现更好"
      },
      "longcontext": {
        "provider": "codewhisperer-primary",
        "model": "CLAUDE_SONNET_4_20250514_V1_0", 
        "format": "anthropic"
      },
      "search": {
        "provider": "openai-shuaihong",
        "model": "gpt-4o-mini",
        "format": "openai",
        "reason": "OpenAI在搜索和信息检索上更快"
      },
      "code-generation": {
        "provider": "codewhisperer-primary",
        "model": "CLAUDE_SONNET_4_20250514_V1_0",
        "format": "anthropic",
        "reason": "CodeWhisperer专门针对代码生成优化"
      },
      "creative": {
        "provider": "openai-shuaihong", 
        "model": "gpt-4o",
        "format": "openai",
        "reason": "OpenAI在创意写作方面表现更好"
      }
    }
  },
  "output": {
    "anthropic": {"enabled": true},
    "openai": {"enabled": true}
  },
  "providers": {
    "codewhisperer-primary": {
      "type": "aws",
      "name": "Primary CodeWhisperer",
      "authMethod": "kiro-token",
      "tokenPath": "~/.aws/sso/cache/kiro-auth-token-primary.json",
      "outputFormat": "anthropic",
      "models": [
        "CLAUDE_SONNET_4_20250514_V1_0",
        "CLAUDE_3_7_SONNET_20250219_V1_0"
      ]
    },
    "codewhisperer-secondary": {
      "type": "aws",
      "name": "Secondary CodeWhisperer",
      "authMethod": "kiro-token", 
      "tokenPath": "~/.aws/sso/cache/kiro-auth-token-secondary.json",
      "outputFormat": "anthropic",
      "models": [
        "CLAUDE_3_7_SONNET_20250219_V1_0",
        "CLAUDE_SONNET_4_20250514_V1_0"
      ]
    },
    "openai-shuaihong": {
      "type": "openai",
      "name": "Shuaihong OpenAI Provider",
      "apiKey": "${SHUAIHONG_API_KEY}",
      "baseUrl": "https://api.shuaihong.com/v1",
      "outputFormat": "openai",
      "models": [
        "gpt-4o",
        "gpt-4o-mini", 
        "gpt-4-turbo",
        "gpt-3.5-turbo"
      ]
    }
  }
}
```

### 2. 混合路由器实现
```typescript
// routing/mixed-provider-router.ts
export class MixedProviderRouter {
  private config: MixedProviderConfig;
  private anthropicRouter: AnthropicRouter;
  private openaiRouter: OpenAIRouter;
  
  constructor(config: MixedProviderConfig) {
    this.config = config;
    this.anthropicRouter = new AnthropicRouter();
    this.openaiRouter = new OpenAIRouter();
  }
  
  async route(request: ProcessedRequest): Promise<RoutingDecision> {
    const category = this.classifyRequest(request);
    const rule = this.config.routing.rules[category];
    
    if (!rule) {
      throw new Error(`No routing rule found for category: ${category}`);
    }
    
    const provider = this.config.providers[rule.provider];
    if (!provider) {
      throw new Error(`Provider ${rule.provider} not found`);
    }
    
    return {
      targetProvider: rule.provider,
      targetModel: rule.model,
      outputFormat: rule.format,
      category: category,
      providerConfig: provider,
      needsFormatConversion: this.needsFormatConversion(request, rule)
    };
  }
  
  private classifyRequest(request: ProcessedRequest): string {
    const content = this.getRequestContent(request);
    const tokenCount = this.calculateTokens(request.messages);
    
    // 基于内容特征分类
    if (this.isCodeGenerationRequest(content)) return 'code-generation';
    if (this.isCreativeRequest(content)) return 'creative';
    if (this.isSearchRequest(request)) return 'search';
    
    // 基于模型和上下文分类
    if (tokenCount > 60000) return 'longcontext';
    if (request.metadata?.thinking) return 'thinking';
    if (request.originalModel?.includes('haiku')) return 'background';
    
    return 'default';
  }
  
  private isCodeGenerationRequest(content: string): boolean {
    const codeKeywords = ['function', 'class', 'import', 'def ', 'const ', 'let ', 'var '];
    return codeKeywords.some(keyword => content.toLowerCase().includes(keyword));
  }
  
  private isCreativeRequest(content: string): boolean {
    const creativeKeywords = ['写一个故事', '创作', '诗歌', '小说', '剧本'];
    return creativeKeywords.some(keyword => content.includes(keyword));
  }
  
  private needsFormatConversion(request: ProcessedRequest, rule: RoutingRule): boolean {
    return request.inputFormat !== rule.format;
  }
}
```

### 3. 格式转换器
```typescript
// output/format-converter.ts
export class FormatConverter {
  async convertAnthropicToOpenAI(
    request: ProcessedRequest,
    targetModel: string
  ): Promise<OpenAIRequest> {
    return {
      model: targetModel,
      messages: this.convertMessages(request.messages),
      max_tokens: request.maxTokens || 4000,
      temperature: request.temperature || 0.7,
      stream: request.stream || false,
      tools: request.tools ? this.convertTools(request.tools) : undefined
    };
  }
  
  async convertOpenAIToAnthropic(
    response: OpenAIResponse,
    originalRequest: ProcessedRequest
  ): Promise<AnthropicResponse> {
    return {
      id: response.id,
      type: 'message',
      role: 'assistant',
      content: this.convertContent(response.choices[0].message.content),
      model: originalRequest.originalModel,
      stop_reason: this.mapStopReason(response.choices[0].finish_reason),
      stop_sequence: null,
      usage: {
        input_tokens: response.usage?.prompt_tokens || 0,
        output_tokens: response.usage?.completion_tokens || 0
      }
    };
  }
  
  private convertMessages(messages: AnthropicMessage[]): OpenAIMessage[] {
    return messages.map(msg => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : this.extractTextContent(msg.content)
    }));
  }
  
  private convertTools(anthropicTools: AnthropicTool[]): OpenAITool[] {
    return anthropicTools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema
      }
    }));
  }
}
```

### 4. 混合供应商管理器
```typescript
// providers/mixed-provider-manager.ts
export class MixedProviderManager {
  private codewhispererProviders: Map<string, CodeWhispererProvider>;
  private openaiProviders: Map<string, OpenAIProvider>;
  private formatConverter: FormatConverter;
  
  constructor(config: MixedProviderConfig) {
    this.codewhispererProviders = new Map();
    this.openaiProviders = new Map();
    this.formatConverter = new FormatConverter();
    
    this.initializeProviders(config);
  }
  
  async processRequest(request: ProviderRequest): Promise<any> {
    const provider = await this.getProvider(request.provider, request.providerType);
    
    // 如果需要格式转换
    if (request.needsFormatConversion) {
      request = await this.convertRequestFormat(request);
    }
    
    try {
      const response = await provider.processRequest(request);
      
      // 转换响应格式回原始格式
      if (request.needsFormatConversion) {
        return await this.convertResponseFormat(response, request);
      }
      
      return response;
    } catch (error) {
      // 尝试故障转移
      return await this.handleFailover(request, error);
    }
  }
  
  private async getProvider(
    providerName: string,
    providerType: string
  ): Promise<CodeWhispererProvider | OpenAIProvider> {
    switch (providerType) {
      case 'aws':
        return this.codewhispererProviders.get(providerName);
      case 'openai':
        return this.openaiProviders.get(providerName);
      default:
        throw new Error(`Unknown provider type: ${providerType}`);
    }
  }
  
  private async handleFailover(
    request: ProviderRequest,
    error: Error
  ): Promise<any> {
    // 实现故障转移逻辑
    const fallbackProvider = this.getFallbackProvider(request);
    if (fallbackProvider) {
      console.warn(`Provider ${request.provider} failed, trying fallback:`, error);
      return await fallbackProvider.processRequest(request);
    }
    throw error;
  }
}
```

### 5. OpenAI供应商实现
```typescript
// providers/openai/index.ts
export class OpenAIProvider {
  private client: OpenAI;
  private config: OpenAIProviderConfig;
  
  constructor(config: OpenAIProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl
    });
  }
  
  async processRequest(request: ProviderRequest): Promise<any> {
    const openaiRequest = this.buildOpenAIRequest(request);
    
    if (request.stream) {
      return await this.handleStreamRequest(openaiRequest);
    } else {
      return await this.handleNonStreamRequest(openaiRequest);
    }
  }
  
  private async handleStreamRequest(request: OpenAIRequest): Promise<any> {
    const stream = await this.client.chat.completions.create({
      ...request,
      stream: true
    });
    
    // 转换OpenAI流式响应为Anthropic格式
    return this.convertStreamResponse(stream);
  }
  
  private async handleNonStreamRequest(request: OpenAIRequest): Promise<any> {
    const response = await this.client.chat.completions.create(request);
    
    // 转换OpenAI响应为Anthropic格式
    return this.convertResponse(response);
  }
}
```

## 配置文件示例

### mixed-providers-routing.json
```json
{
  "name": "Mixed Providers Routing",
  "description": "CodeWhisperer + OpenAI混合供应商路由",
  "input": {"format": "anthropic", "defaultInstance": true},
  "routing": {
    "strategy": "mixed-providers",
    "rules": {
      "default": {
        "provider": "codewhisperer-primary",
        "model": "CLAUDE_SONNET_4_20250514_V1_0",
        "format": "anthropic",
        "priority": 1
      },
      "background": {
        "provider": "codewhisperer-secondary",
        "model": "CLAUDE_3_5_HAIKU_20241022_V1_0", 
        "format": "anthropic",
        "priority": 2
      },
      "thinking": {
        "provider": "openai-shuaihong",
        "model": "gpt-4o",
        "format": "openai",
        "priority": 1,
        "reason": "OpenAI在复杂推理任务上表现更好",
        "fallback": {
          "provider": "codewhisperer-primary",
          "model": "CLAUDE_3_7_SONNET_20250219_V1_0"
        }
      },
      "longcontext": {
        "provider": "codewhisperer-primary",
        "model": "CLAUDE_SONNET_4_20250514_V1_0",
        "format": "anthropic",
        "priority": 1
      },
      "search": {
        "provider": "openai-shuaihong",
        "model": "gpt-4o-mini",
        "format": "openai", 
        "priority": 1,
        "reason": "OpenAI在搜索任务上响应更快",
        "fallback": {
          "provider": "codewhisperer-secondary",
          "model": "CLAUDE_3_7_SONNET_20250219_V1_0"
        }
      },
      "code-generation": {
        "provider": "codewhisperer-primary",
        "model": "CLAUDE_SONNET_4_20250514_V1_0",
        "format": "anthropic",
        "priority": 1,
        "reason": "CodeWhisperer专门针对代码生成优化"
      },
      "creative": {
        "provider": "openai-shuaihong",
        "model": "gpt-4o",
        "format": "openai",
        "priority": 1,
        "reason": "OpenAI在创意写作方面表现更好",
        "fallback": {
          "provider": "codewhisperer-primary", 
          "model": "CLAUDE_SONNET_4_20250514_V1_0"
        }
      }
    }
  },
  "output": {
    "anthropic": {"enabled": true},
    "openai": {"enabled": true, "convertToAnthropic": true}
  },
  "providers": {
    "codewhisperer-primary": {
      "type": "aws",
      "name": "Primary CodeWhisperer",
      "authMethod": "kiro-token",
      "tokenPath": "~/.aws/sso/cache/kiro-auth-token-primary.json",
      "outputFormat": "anthropic",
      "maxConcurrentRequests": 10,
      "models": [
        "CLAUDE_SONNET_4_20250514_V1_0",
        "CLAUDE_3_7_SONNET_20250219_V1_0"
      ],
      "specialties": ["code-generation", "longcontext"]
    },
    "codewhisperer-secondary": {
      "type": "aws",
      "name": "Secondary CodeWhisperer",
      "authMethod": "kiro-token",
      "tokenPath": "~/.aws/sso/cache/kiro-auth-token-secondary.json", 
      "outputFormat": "anthropic",
      "maxConcurrentRequests": 8,
      "models": [
        "CLAUDE_3_7_SONNET_20250219_V1_0",
        "CLAUDE_SONNET_4_20250514_V1_0"
      ],
      "specialties": ["background", "fallback"]
    },
    "openai-shuaihong": {
      "type": "openai",
      "name": "Shuaihong OpenAI Provider",
      "apiKey": "${SHUAIHONG_API_KEY}",
      "baseUrl": "https://api.shuaihong.com/v1",
      "outputFormat": "openai",
      "maxConcurrentRequests": 15,
      "models": [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo", 
        "gpt-3.5-turbo"
      ],
      "specialties": ["thinking", "creative", "search"],
      "rateLimit": {
        "requestsPerMinute": 100,
        "tokensPerMinute": 50000
      }
    }
  },
  "server": {"port": 3456, "host": "127.0.0.1"},
  "monitoring": {
    "enabled": true,
    "trackProviderUsage": true,
    "trackFormatConversions": true,
    "trackFailovers": true
  }
}
```

## 启动和使用

### 1. 环境配置
```bash
# 配置CodeWhisperer tokens
kiro2cc refresh --output ~/.aws/sso/cache/kiro-auth-token-primary.json
kiro2cc refresh --output ~/.aws/sso/cache/kiro-auth-token-secondary.json

# 配置OpenAI API Key
export SHUAIHONG_API_KEY=sk-your-shuaihong-api-key
```

### 2. 启动混合路由器
```bash
# 启动混合供应商路由器
ccr start --config=mixed-providers-routing.json

# 显示供应商状态
ccr start --config=mixed-providers-routing.json --show-providers
```

### 3. 测试不同类型请求
```bash
# 代码生成 -> CodeWhisperer
claude-code "写一个React组件用于显示用户列表"

# 创意写作 -> OpenAI
claude-code "写一个关于AI的科幻小说开头"

# 复杂推理 -> OpenAI  
claude-code "分析这个算法的时间复杂度并提出优化方案"

# 搜索任务 -> OpenAI
claude-code "搜索关于机器学习的最新研究"

# 长上下文 -> CodeWhisperer
claude-code "分析这个10万行的代码库"
```

## 监控和统计

### 1. 供应商使用统计
```typescript
app.get('/stats/providers', (req, res) => {
  res.json({
    'codewhisperer-primary': {
      requests: 1250,
      successRate: 98.5,
      avgResponseTime: 245,
      specialties: ['code-generation', 'longcontext']
    },
    'codewhisperer-secondary': {
      requests: 485,
      successRate: 97.2,
      avgResponseTime: 312,
      specialties: ['background', 'fallback']
    },
    'openai-shuaihong': {
      requests: 890,
      successRate: 99.1,
      avgResponseTime: 180,
      specialties: ['thinking', 'creative', 'search']
    }
  });
});
```

### 2. 格式转换统计
```typescript
app.get('/stats/conversions', (req, res) => {
  res.json({
    totalConversions: 890,
    anthropicToOpenAI: 890,
    openAIToAnthropic: 890,
    conversionSuccessRate: 99.8,
    avgConversionTime: 5
  });
});
```

## 预期效果

### 功能互补
- **CodeWhisperer**: 专注代码生成和长上下文处理
- **OpenAI**: 擅长复杂推理、创意写作和搜索任务
- **智能路由**: 根据任务类型自动选择最适合的供应商

### 性能优化
- **专业化分工**: 每个供应商处理其擅长的任务类型
- **故障转移**: 供应商故障时自动切换到备用供应商
- **格式透明**: 用户无需关心底层格式转换

### 成本控制
- **灵活定价**: 根据不同供应商的定价策略优化成本
- **资源分配**: 合理分配不同类型任务到合适的供应商
- **监控完善**: 详细的使用统计和成本分析

这个Use Case 4展示了如何构建一个真正的混合供应商系统，充分发挥每个供应商的优势，实现功能互补和成本优化。