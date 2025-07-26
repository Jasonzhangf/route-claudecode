# Use Case 2: 多CodeWhisperer供应商模型分离路由

## 场景描述
在Use Case 1的基础上，用户拥有两个不同的CodeWhisperer供应商实例，希望将不同的模型类别路由到不同的供应商，实现资源分离和成本优化。

## 用户需求
- **基础**: Use Case 1的Claude Code → CodeWhisperer重映射
- **扩展**: 两个CodeWhisperer供应商实例
- **路由策略**: 不同模型类别路由到不同供应商
- **目标**: 资源隔离、成本优化、性能分离

## 技术实现

### 1. 多供应商配置
```json
{
  "name": "Multi CodeWhisperer Providers",
  "input": {"format": "anthropic", "defaultInstance": true},
  "routing": {
    "rules": {
      "default": {"provider": "codewhisperer-primary", "model": "CLAUDE_SONNET_4_20250514_V1_0"},
      "background": {"provider": "codewhisperer-secondary", "model": "CLAUDE_3_7_SONNET_20250219_V1_0"},
      "thinking": {"provider": "codewhisperer-primary", "model": "CLAUDE_SONNET_4_20250514_V1_0"},
      "longcontext": {"provider": "codewhisperer-primary", "model": "CLAUDE_SONNET_4_20250514_V1_0"},
      "search": {"provider": "codewhisperer-secondary", "model": "CLAUDE_3_7_SONNET_20250219_V1_0"}
    }
  },
  "output": {"format": "anthropic"},
  "providers": {
    "codewhisperer-primary": {
      "type": "aws",
      "name": "Primary CodeWhisperer",
      "authMethod": "kiro-token",
      "tokenPath": "~/.aws/sso/cache/kiro-auth-token-primary.json",
      "priority": "high",
      "models": [
        "CLAUDE_SONNET_4_20250514_V1_0"
      ]
    },
    "codewhisperer-secondary": {
      "type": "aws", 
      "name": "Secondary CodeWhisperer",
      "authMethod": "kiro-token",
      "tokenPath": "~/.aws/sso/cache/kiro-auth-token-secondary.json",
      "priority": "normal",
      "models": [
        "CLAUDE_3_5_HAIKU_20241022_V1_0",
        "CLAUDE_3_5_SONNET_20241022_V2_0"
      ]
    }
  },
  "server": {"port": 3456, "host": "127.0.0.1"}
}
```

### 2. 路由策略设计
```typescript
// routing/multi-provider.ts
export class MultiProviderRouter {
  private config: MultiProviderConfig;
  
  async route(request: ProcessedRequest): Promise<RoutingDecision> {
    const category = this.classifyRequest(request);
    const rule = this.config.routing.rules[category];
    
    // 验证供应商和模型的兼容性
    const provider = this.config.providers[rule.provider];
    if (!provider.models.includes(rule.model)) {
      throw new Error(`Model ${rule.model} not supported by provider ${rule.provider}`);
    }
    
    return {
      targetProvider: rule.provider,
      targetModel: rule.model,
      outputFormat: 'anthropic',
      category: category,
      providerConfig: provider
    };
  }
  
  private classifyRequest(request: ProcessedRequest): string {
    const tokenCount = this.calculateTokens(request.messages);
    
    // 高优先级任务 -> Primary Provider
    if (tokenCount > 60000) return 'longcontext';
    if (request.metadata?.thinking) return 'thinking';
    if (request.originalModel?.includes('sonnet-4')) return 'default';
    
    // 低优先级任务 -> Secondary Provider  
    if (request.originalModel?.includes('haiku')) return 'background';
    if (request.tools?.some(t => t.name.includes('search'))) return 'search';
    
    return 'default';
  }
}
```

### 3. 供应商管理器
```typescript
// providers/codewhisperer/multi-manager.ts
export class MultiCodeWhispererManager {
  private providers: Map<string, CodeWhispererProvider>;
  
  constructor(config: MultiProviderConfig) {
    this.providers = new Map();
    
    // 初始化多个供应商实例
    Object.entries(config.providers).forEach(([name, providerConfig]) => {
      if (providerConfig.type === 'aws') {
        this.providers.set(name, new CodeWhispererProvider(providerConfig));
      }
    });
  }
  
  async processRequest(request: ProviderRequest): Promise<any> {
    const provider = this.providers.get(request.provider);
    if (!provider) {
      throw new Error(`Provider ${request.provider} not found`);
    }
    
    return await provider.processRequest(request);
  }
  
  async healthCheck(): Promise<Map<string, boolean>> {
    const health = new Map<string, boolean>();
    
    for (const [name, provider] of this.providers) {
      try {
        await provider.healthCheck();
        health.set(name, true);
      } catch (error) {
        health.set(name, false);
        console.warn(`Provider ${name} health check failed:`, error);
      }
    }
    
    return health;
  }
}
```

## 配置文件示例

### multi-codewhisperer-providers.json
```json
{
  "name": "Multi CodeWhisperer Providers",
  "description": "将不同模型类别路由到不同的CodeWhisperer供应商",
  "input": {
    "format": "anthropic",
    "defaultInstance": true
  },
  "routing": {
    "strategy": "model-separation",
    "rules": {
      "default": {
        "provider": "codewhisperer-primary",
        "model": "CLAUDE_SONNET_4_20250514_V1_0",
        "reason": "高质量通用任务使用主要供应商的最强模型"
      },
      "background": {
        "provider": "codewhisperer-secondary", 
        "model": "CLAUDE_3_7_SONNET_20250219_V1_0",
        "reason": "后台任务使用次要供应商的轻量模型节省成本"
      },
      "thinking": {
        "provider": "codewhisperer-primary",
        "model": "CLAUDE_SONNET_4_20250514_V1_0",
        "reason": "复杂推理任务使用主要供应商的最强模型"
      },
      "longcontext": {
        "provider": "codewhisperer-primary",
        "model": "CLAUDE_SONNET_4_20250514_V1_0", 
        "reason": "长上下文任务使用主要供应商的最强模型"
      },
      "search": {
        "provider": "codewhisperer-secondary",
        "model": "CLAUDE_3_7_SONNET_20250219_V1_0",
        "reason": "搜索任务使用次要供应商的轻量模型"
      }
    }
  },
  "output": {
    "format": "anthropic"
  },
  "providers": {
    "codewhisperer-primary": {
      "type": "aws",
      "name": "Primary CodeWhisperer Instance",
      "description": "主要供应商，处理高优先级和复杂任务",
      "authMethod": "kiro-token",
      "tokenPath": "~/.aws/sso/cache/kiro-auth-token-primary.json",
      "priority": "high",
      "models": [
        "CLAUDE_SONNET_4_20250514_V1_0",
        "CLAUDE_3_7_SONNET_20250219_V1_0"
      ],
      "limits": {
        "maxConcurrentRequests": 10,
        "maxTokensPerMinute": 100000
      }
    },
    "codewhisperer-secondary": {
      "type": "aws",
      "name": "Secondary CodeWhisperer Instance", 
      "description": "次要供应商，处理后台和搜索任务",
      "authMethod": "kiro-token",
      "tokenPath": "~/.aws/sso/cache/kiro-auth-token-secondary.json",
      "priority": "normal",
      "models": [
        "CLAUDE_3_7_SONNET_20250219_V1_0",
        "CLAUDE_SONNET_4_20250514_V1_0"
      ],
      "limits": {
        "maxConcurrentRequests": 5,
        "maxTokensPerMinute": 50000
      }
    }
  },
  "server": {
    "port": 3456,
    "host": "127.0.0.1",
    "cors": true
  },
  "hooks": {
    "debug": false,
    "logRequests": true,
    "logResponses": true,
    "logProviderSelection": true
  }
}
```

## 启动和使用

### 1. 准备多个Token
```bash
# 配置主要供应商token
kiro2cc refresh --output ~/.aws/sso/cache/kiro-auth-token-primary.json

# 配置次要供应商token  
kiro2cc refresh --output ~/.aws/sso/cache/kiro-auth-token-secondary.json
```

### 2. 启动路由器
```bash
# 启动多供应商路由器
ccr start --config=multi-codewhisperer-providers.json

# 或使用环境变量指定配置
export CCR_CONFIG=multi-codewhisperer-providers.json
ccr start
```

### 3. 验证路由
```bash
# 测试不同类型的请求路由
claude-code "写一个简单的函数" # -> Primary Provider (default)
claude-code "在后台整理这些文件" # -> Secondary Provider (background)  
claude-code "深入分析这个算法的复杂度" # -> Primary Provider (thinking)
claude-code "处理这个10万行的日志文件" # -> Primary Provider (longcontext)
claude-code "搜索相关的代码示例" # -> Secondary Provider (search)
```

## 监控和管理

### 1. 供应商状态监控
```typescript
// 健康检查端点
app.get('/health/providers', async (req, res) => {
  const health = await multiManager.healthCheck();
  res.json({
    timestamp: new Date().toISOString(),
    providers: Object.fromEntries(health)
  });
});
```

### 2. 路由统计
```typescript
// 路由统计
app.get('/stats/routing', (req, res) => {
  res.json({
    totalRequests: routingStats.total,
    providerDistribution: {
      'codewhisperer-primary': routingStats.primary,
      'codewhisperer-secondary': routingStats.secondary
    },
    categoryDistribution: routingStats.categories
  });
});
```

## 预期效果

### 资源分离
- **主要供应商**: 处理高质量、复杂任务 (default, thinking, longcontext)
- **次要供应商**: 处理后台、搜索任务 (background, search)
- **成本优化**: 根据任务重要性分配资源

### 性能优化
- **并发控制**: 不同供应商独立的并发限制
- **故障隔离**: 单个供应商故障不影响其他供应商
- **负载分散**: 避免单一供应商过载

### 灵活配置
- **动态路由**: 可以随时调整路由规则
- **供应商管理**: 独立管理每个供应商的配置
- **监控完善**: 实时监控各供应商状态和性能

这个Use Case 2展示了如何在单一CodeWhisperer基础上扩展到多供应商架构，实现更精细的资源管理和成本控制。