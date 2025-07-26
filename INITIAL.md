## FEATURE: Claude Code Output Router

一个结构化设计的路由转换器，用于将Claude Code的输出转换并路由到不同的AI模型提供商。支持多格式输入输出、智能模型路由、负载均衡和完整的调试监控系统。

### 核心功能
- **多格式支持**: OpenAI, Anthropic, Gemini格式的输入输出转换
- **智能路由**: 基于模型类别(default, background, thinking, longcontext, search)的智能路由
- **多供应商**: 支持AWS CodeWhisperer、第三方OpenAI等多个AI服务提供商
- **负载均衡**: 同一路由多实例的动态负载均衡
- **Hook系统**: 完整的调试日志和数据注入测试系统

## EXAMPLES:

### Use Case 1: Claude Code → CodeWhisperer 一键重映射
```bash
# 一键启动CodeWhisperer代理服务器
ccr start --config=claude-to-codewhisperer.json

# 自动设置环境变量劫持Claude Code
export ANTHROPIC_BASE_URL=http://localhost:3456
export ANTHROPIC_API_KEY=any-string-is-ok

# Claude Code正常使用，所有请求自动路由到CodeWhisperer
claude-code "帮我写一个React组件"
```

### Use Case 2: 多CodeWhisperer供应商模型分离
```bash
# 两个CodeWhisperer供应商，不同模型路由到不同供应商
ccr start --config=multi-codewhisperer-providers.json

# 高优先级任务 -> Primary Provider
claude-code "分析这个复杂算法" # -> codewhisperer-primary

# 后台任务 -> Secondary Provider  
claude-code "整理这些文件" # -> codewhisperer-secondary
```

### Use Case 3: CodeWhisperer供应商负载均衡
```bash
# 两个CodeWhisperer供应商负载均衡
ccr start --config=codewhisperer-load-balancing.json

# 自动负载均衡和故障转移
claude-code "写一个函数" # -> 自动选择最优供应商
```

### Use Case 4: 混合供应商路由 (CodeWhisperer + OpenAI)
```bash
# CodeWhisperer + OpenAI混合路由
ccr start --config=mixed-providers-routing.json

# 代码生成 -> CodeWhisperer
claude-code "写一个React组件" # -> codewhisperer-primary

# 创意写作 -> OpenAI
claude-code "写一个科幻小说开头" # -> openai-shuaihong

# 复杂推理 -> OpenAI
claude-code "分析这个算法复杂度" # -> openai-shuaihong
```

### 基础路由示例
```javascript
// Anthropic输入 -> OpenAI格式输出到Shuaihong
{
  "input": "anthropic",
  "model": "claude-3.7",
  "category": "default",
  "output": "openai",
  "provider": "shuaihong"
}

// Anthropic输入 -> Anthropic格式输出到CodeWhisperer  
{
  "input": "anthropic", 
  "model": "claude-4",
  "category": "longcontext",
  "output": "anthropic",
  "provider": "codewhisperer"
}
```

### Claude Code → CodeWhisperer 配置示例
```json
{
  "name": "Claude Code to CodeWhisperer",
  "input": {"format": "anthropic", "defaultInstance": true},
  "routing": {
    "rules": {
      "default": {"provider": "codewhisperer", "model": "CLAUDE_SONNET_4_20250514_V1_0"},
      "background": {"provider": "codewhisperer", "model": "CLAUDE_3_7_SONNET_20250219_V1_0"},
      "thinking": {"provider": "codewhisperer", "model": "CLAUDE_SONNET_4_20250514_V1_0"},
      "longcontext": {"provider": "codewhisperer", "model": "CLAUDE_SONNET_4_20250514_V1_0"}
    }
  },
  "output": {"format": "anthropic"},
  "providers": {
    "codewhisperer": {
      "type": "aws",
      "authMethod": "kiro-token",
      "tokenPath": "~/.aws/sso/cache/kiro-auth-token.json",
      "loadBalance": true
    }
  },
  "server": {"port": 3456, "host": "127.0.0.1"}
}
```

### 通用路由配置示例
```json
{
  "routes": {
    "claude-4": {
      "default": {"provider": "codewhisperer", "format": "anthropic"},
      "thinking": {"provider": "shuaihong", "format": "openai"},
      "longcontext": {"provider": "codewhisperer", "format": "anthropic"}
    },
    "claude-3.7": {
      "default": {"provider": "shuaihong", "format": "openai"},
      "background": {"provider": "codewhisperer", "format": "anthropic"}
    }
  },
  "providers": {
    "codewhisperer": {
      "type": "aws",
      "tokens": ["token1", "token2"],
      "loadBalance": true
    },
    "shuaihong": {
      "type": "openai",
      "apiKey": "sk-xxx",
      "baseUrl": "https://api.shuaihong.com"
    }
  }
}
```

### 一键启动脚本示例
```bash
#!/bin/bash
# 一键启动Claude Code → CodeWhisperer路由器

# 检查Kiro token
kiro2cc refresh

# 启动路由服务器
ccr start --config=claude-to-codewhisperer.json &

# 设置环境变量劫持Claude Code
export ANTHROPIC_BASE_URL=http://localhost:3456
export ANTHROPIC_API_KEY=any-string-is-ok

echo "✅ Claude Code现在将使用CodeWhisperer作为后端"
```

### Hook系统示例
```javascript
// 调试模式启动
ccr start --debug --config=claude-to-codewhisperer.json

// 数据注入测试
router.injectData('routing', mockRoutingData);
router.testFromNode('output');
```

## DOCUMENTATION:

### 参考实现
- **examples/demo1 (claude-code-router)**: 模型分层基础概念，路由逻辑，多提供商架构
- **examples/demo2 (kiro2cc)**: CodeWhisperer完整实现，格式转换，SSE解析，Token管理

### Use Cases实现方案
- **use-cases/claude-code-to-codewhisperer.md**: Use Case 1 - 单一CodeWhisperer重映射
- **use-cases/multi-codewhisperer-providers.md**: Use Case 2 - 多CodeWhisperer供应商分离
- **use-cases/codewhisperer-load-balancing.md**: Use Case 3 - CodeWhisperer负载均衡
- **use-cases/mixed-providers-routing.md**: Use Case 4 - 混合供应商路由

### 技术文档
- **Anthropic API**: Claude模型的API格式和调用方式
- **OpenAI API**: GPT模型的API格式和兼容性
- **AWS CodeWhisperer**: AWS AI编程助手的集成方式
- **Node.js Express**: 路由服务器的实现框架

### 环境配置
- **ANTHROPIC_BASE_URL**: 劫持Claude Code的请求到本地路由器
- **ANTHROPIC_API_KEY**: 认证密钥配置
- **端口配置**: 开发端口3456，生产端口3457

## OTHER CONSIDERATIONS:

### 架构设计考虑
- **模块化**: 严格按照输入→路由→输出→提供商的四层架构设计
- **透明代理**: Claude Code用户无需修改配置，一键启动即可使用CodeWhisperer
- **智能路由**: 基于请求类型(default/background/thinking/longcontext/search)自动选择最优模型
- **可扩展性**: 新增格式和提供商时只需添加对应模块，不影响现有功能
- **容错性**: 单个提供商失败时自动切换到备用提供商，支持token自动刷新
- **性能**: 支持连接池和请求缓存，提高响应速度

### 开发注意事项
- **端口冲突**: 启动时自动检测并杀掉占用端口的进程
- **多实例管理**: 最后启动的实例会替代之前的实例，但不影响进行中的对话
- **测试覆盖**: 每个节点都要有独立的单元测试和集成测试
- **错误处理**: 完善的错误处理和日志记录，便于问题排查

### 部署和发布
- **NPM包**: 支持全局安装和项目依赖两种方式
- **GitHub Actions**: 自动化测试和发布流程
- **版本管理**: 语义化版本控制，向后兼容
- **文档维护**: 保持README和API文档的及时更新

### 安全考虑
- **API密钥**: 安全存储和传输各提供商的API密钥
- **请求验证**: 验证输入请求的合法性，防止恶意攻击
- **日志脱敏**: 调试日志中不包含敏感信息
- **访问控制**: 可选的访问控制和速率限制功能