# Use Cases 说明文档

## 模型映射更正

根据 `examples/demo2/main.go` 中的实际实现，CodeWhisperer只支持两个模型：

```go
var ModelMap = map[string]string{
	"claude-sonnet-4-20250514":  "CLAUDE_SONNET_4_20250514_V1_0",
	"claude-3-5-haiku-20241022": "CLAUDE_3_7_SONNET_20250219_V1_0",
}
```

## Use Cases 概览

### [Use Case 1: Claude Code → CodeWhisperer 一键重映射](claude-code-to-codewhisperer.md)
- **目标**: 将Claude Code请求透明代理到单个CodeWhisperer实例
- **特性**: 一键启动、环境变量劫持、模型自动映射
- **适用**: 个人开发者，简单成本优化

### [Use Case 2: 多CodeWhisperer供应商模型分离](multi-codewhisperer-providers.md)
- **目标**: 两个CodeWhisperer供应商，不同任务类型路由到不同供应商
- **特性**: 资源分离、成本优化、供应商专业化
- **适用**: 小团队，需要资源分离管理

### [Use Case 3: CodeWhisperer供应商负载均衡](codewhisperer-load-balancing.md)
- **目标**: 两个CodeWhisperer供应商之间的智能负载均衡
- **特性**: 多种负载均衡策略、健康监控、故障自动切换
- **适用**: 中型团队，高可用性需求

### [Use Case 4: 混合供应商路由](mixed-providers-routing.md)
- **目标**: CodeWhisperer + OpenAI混合供应商，功能互补
- **特性**: 智能任务分类、格式自动转换、供应商优势互补
- **适用**: 大型团队，多样化AI需求

## 模型分配策略

### CLAUDE_SONNET_4_20250514_V1_0 (高性能模型)
- **输入模型**: `claude-sonnet-4-20250514`
- **适用场景**:
  - `default`: 通用高质量任务
  - `thinking`: 复杂推理任务
  - `longcontext`: 长上下文处理
  - `code-generation`: 代码生成任务

### CLAUDE_3_7_SONNET_20250219_V1_0 (轻量模型)
- **输入模型**: `claude-3-5-haiku-20241022`
- **适用场景**:
  - `background`: 后台处理任务
  - `search`: 搜索和快速响应任务

## 供应商分配建议

### Primary Provider (主要供应商)
- **模型**: 主要使用 `CLAUDE_SONNET_4_20250514_V1_0`
- **任务**: 高质量、复杂任务
- **场景**: default, thinking, longcontext, code-generation

### Secondary Provider (次要供应商)
- **模型**: 主要使用 `CLAUDE_3_7_SONNET_20250219_V1_0`
- **任务**: 轻量、快速响应任务
- **场景**: background, search

## 配置文件位置

- `claude-to-codewhisperer.json` - Use Case 1配置
- `multi-codewhisperer-providers.json` - Use Case 2配置
- `codewhisperer-load-balancing.json` - Use Case 3配置
- `mixed-providers-routing.json` - Use Case 4配置

## 启动命令

```bash
# Use Case 1: 基础重映射
ccr start --config=use-cases/claude-to-codewhisperer.json

# Use Case 2: 多供应商分离
ccr start --config=use-cases/multi-codewhisperer-providers.json

# Use Case 3: 负载均衡
ccr start --config=use-cases/codewhisperer-load-balancing.json

# Use Case 4: 混合供应商
ccr start --config=use-cases/mixed-providers-routing.json
```

## 测试验证

### 验证模型路由
```bash
# 高性能任务 -> CLAUDE_SONNET_4
claude-code "分析这个复杂算法的时间复杂度"

# 轻量任务 -> CLAUDE_3_7_SONNET  
claude-code "整理这些文件"
```

### 验证供应商分离
```bash
# 检查供应商状态
curl http://localhost:3456/health/providers

# 查看路由统计
curl http://localhost:3456/stats/routing
```

## 注意事项

1. **模型限制**: CodeWhisperer只支持两个模型，不要配置其他模型
2. **Token管理**: 确保每个供应商都有有效的Kiro token
3. **故障转移**: 配置合适的fallback策略
4. **监控**: 启用健康检查和性能监控
5. **成本控制**: 合理分配高性能和轻量模型的使用

## 参考文档

- [Demo2分析](../examples/demo2/README_ANALYSIS.md) - CodeWhisperer实现详解
- [模型映射更正](corrected-model-mapping.md) - 详细的模型映射说明