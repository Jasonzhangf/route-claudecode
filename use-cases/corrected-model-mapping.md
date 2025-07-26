# CodeWhisperer模型映射更正说明

## 根据Demo2的实际实现

基于 `examples/demo2/main.go` 中的 `ModelMap` 定义，CodeWhisperer实际只支持两个模型：

```go
var ModelMap = map[string]string{
	"claude-sonnet-4-20250514":  "CLAUDE_SONNET_4_20250514_V1_0",
	"claude-3-5-haiku-20241022": "CLAUDE_3_7_SONNET_20250219_V1_0",
}
```

## 模型特性分析

### CLAUDE_SONNET_4_20250514_V1_0
- **对应输入模型**: `claude-sonnet-4-20250514`
- **特性**: 最强模型，适合复杂任务
- **适用场景**: default, thinking, longcontext

### CLAUDE_3_7_SONNET_20250219_V1_0  
- **对应输入模型**: `claude-3-5-haiku-20241022`
- **特性**: 较轻量模型，响应更快
- **适用场景**: background, search

## 更正后的路由规则

### Use Case 1: 基础重映射
```json
{
  "modelMapping": {
    "claude-sonnet-4-20250514": "CLAUDE_SONNET_4_20250514_V1_0",
    "claude-3-5-haiku-20241022": "CLAUDE_3_7_SONNET_20250219_V1_0"
  },
  "routingRules": {
    "default": "CLAUDE_SONNET_4_20250514_V1_0",
    "background": "CLAUDE_3_7_SONNET_20250219_V1_0",
    "thinking": "CLAUDE_SONNET_4_20250514_V1_0",
    "longcontext": "CLAUDE_SONNET_4_20250514_V1_0",
    "search": "CLAUDE_3_7_SONNET_20250219_V1_0"
  }
}
```

### Use Case 2: 多供应商分离
```json
{
  "routing": {
    "rules": {
      "default": {"provider": "codewhisperer-primary", "model": "CLAUDE_SONNET_4_20250514_V1_0"},
      "background": {"provider": "codewhisperer-secondary", "model": "CLAUDE_3_7_SONNET_20250219_V1_0"},
      "thinking": {"provider": "codewhisperer-primary", "model": "CLAUDE_SONNET_4_20250514_V1_0"},
      "longcontext": {"provider": "codewhisperer-primary", "model": "CLAUDE_SONNET_4_20250514_V1_0"},
      "search": {"provider": "codewhisperer-secondary", "model": "CLAUDE_3_7_SONNET_20250219_V1_0"}
    }
  },
  "providers": {
    "codewhisperer-primary": {
      "models": ["CLAUDE_SONNET_4_20250514_V1_0"],
      "specialties": ["default", "thinking", "longcontext"]
    },
    "codewhisperer-secondary": {
      "models": ["CLAUDE_3_7_SONNET_20250219_V1_0"],
      "specialties": ["background", "search"]
    }
  }
}
```

### Use Case 3: 负载均衡
```json
{
  "routing": {
    "rules": {
      "default": {
        "providers": ["codewhisperer-primary", "codewhisperer-secondary"],
        "model": "CLAUDE_SONNET_4_20250514_V1_0",
        "loadBalancing": {"strategy": "weighted-round-robin"}
      },
      "background": {
        "providers": ["codewhisperer-secondary", "codewhisperer-primary"],
        "model": "CLAUDE_3_7_SONNET_20250219_V1_0",
        "loadBalancing": {"strategy": "round-robin"}
      }
    }
  }
}
```

### Use Case 4: 混合供应商
```json
{
  "routing": {
    "rules": {
      "default": {"provider": "codewhisperer-primary", "model": "CLAUDE_SONNET_4_20250514_V1_0", "format": "anthropic"},
      "background": {"provider": "codewhisperer-secondary", "model": "CLAUDE_3_7_SONNET_20250219_V1_0", "format": "anthropic"},
      "thinking": {"provider": "openai-shuaihong", "model": "gpt-4o", "format": "openai"},
      "search": {"provider": "openai-shuaihong", "model": "gpt-4o-mini", "format": "openai"},
      "code-generation": {"provider": "codewhisperer-primary", "model": "CLAUDE_SONNET_4_20250514_V1_0", "format": "anthropic"},
      "creative": {"provider": "openai-shuaihong", "model": "gpt-4o", "format": "openai"}
    }
  }
}
```

## 路由策略调整

### 基于实际模型能力的分类
1. **高性能任务** → `CLAUDE_SONNET_4_20250514_V1_0`
   - default: 通用高质量任务
   - thinking: 复杂推理任务  
   - longcontext: 长上下文处理

2. **轻量任务** → `CLAUDE_3_7_SONNET_20250219_V1_0`
   - background: 后台处理任务
   - search: 搜索和快速响应任务

### 供应商分配策略
- **Primary Provider**: 主要处理高性能模型 (CLAUDE_SONNET_4)
- **Secondary Provider**: 主要处理轻量模型 (CLAUDE_3_7_SONNET)
- **负载均衡**: 两个供应商都可以处理两种模型，根据负载情况分配

## 实现注意事项

1. **模型验证**: 确保路由的模型在目标供应商中可用
2. **故障转移**: 当主要模型不可用时，可以降级到轻量模型
3. **性能监控**: 监控两种模型的响应时间和成功率
4. **成本优化**: 优先使用轻量模型处理简单任务

这个更正确保了所有use case都基于demo2的实际实现，避免了不存在的模型映射。