# Claude Code Output Router

一个结构化设计的路由转换器，用于将Claude Code的输出转换并路由到不同的AI模型提供商。支持多格式输入输出、智能模型路由、负载均衡和完整的调试监控系统。

## 🎯 项目背景

本项目受到以下两个优秀项目的启发：

- **[claude-code-router](https://github.com/musistudio/claude-code-router)** - 提供了模型分层基础概念、路由逻辑和多提供商架构的完整实现
- **[kiro2cc](https://github.com/bestK/kiro2cc)** - 提供了AWS CodeWhisperer的完整实现，包括格式转换、SSE解析和Token管理

希望整合这两个项目的功能优势，创建一个更加结构化、模块化且功能完整的Claude Code输出路由系统。

## ✨ 核心功能

- **🔄 多格式支持**: OpenAI, Anthropic, Gemini格式的输入输出转换
- **🧠 智能路由**: 基于模型类别(default, background, thinking, longcontext, search)的智能路由
- **🏢 多供应商**: 支持AWS CodeWhisperer、第三方OpenAI等多个AI服务提供商
- **⚖️ 负载均衡**: 同一路由多实例的动态负载均衡
- **🔧 Hook系统**: 完整的调试日志和数据注入测试系统
- **🚀 一键启动**: 透明代理Claude Code，无需修改用户配置

## 🏗️ 架构设计

### 四层架构
```
输入格式模块 → 模型路由模块 → 输出格式模块 → 提供商模块
```

- **输入格式模块**: 处理Anthropic、OpenAI、Gemini等不同格式的输入
- **模型路由模块**: 基于请求特征智能选择目标模型和供应商
- **输出格式模块**: 转换响应格式以匹配客户端期望
- **提供商模块**: 与具体AI服务提供商的集成实现

### 支持的供应商
- **AWS CodeWhisperer**: 基于kiro2cc的完整实现
- **OpenAI兼容API**: 支持各种第三方OpenAI格式提供商
- **扩展性**: 易于添加新的供应商支持

## 🚀 快速开始

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

## 📋 详细用例

详细的使用场景和配置说明请参考：

- **[Use Case 1](use-cases/claude-code-to-codewhisperer.md)** - 单一CodeWhisperer重映射
- **[Use Case 2](use-cases/multi-codewhisperer-providers.md)** - 多CodeWhisperer供应商分离
- **[Use Case 3](use-cases/codewhisperer-load-balancing.md)** - CodeWhisperer负载均衡
- **[Use Case 4](use-cases/mixed-providers-routing.md)** - 混合供应商路由

## 🔧 配置示例

### 基础配置
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

## 🛠️ 开发指南

### 项目结构
```
src/
├── input/          # 输入格式模块
│   ├── anthropic/  # Anthropic格式处理
│   ├── openai/     # OpenAI格式处理
│   └── gemini/     # Gemini格式处理
├── routing/        # 模型路由模块
│   ├── index.ts    # 路由主逻辑
│   ├── rules.ts    # 路由规则
│   └── custom.ts   # 自定义路由支持
├── output/         # 输出格式模块
│   ├── anthropic/  # Anthropic格式输出
│   └── openai/     # OpenAI格式输出
└── providers/      # 提供商模块
    ├── codewhisperer/  # AWS CodeWhisperer
    │   ├── auth.ts     # Token管理
    │   ├── converter.ts # 格式转换
    │   ├── parser.ts   # SSE解析
    │   └── client.ts   # HTTP客户端
    └── openai/         # OpenAI兼容提供商
```

### 开发环境设置
```bash
# 安装依赖
npm install

# 开发模式启动
npm run dev

# 构建项目
npm run build

# 运行测试
npm test
```

## 📚 技术文档

### 参考实现
- **claude-code-router**: 模型分层基础概念，路由逻辑，多提供商架构
- **kiro2cc**: CodeWhisperer完整实现，格式转换，SSE解析，Token管理

### 核心技术
- **Node.js/TypeScript**: 主要开发语言
- **Express**: HTTP服务器框架
- **SSE (Server-Sent Events)**: 流式响应处理
- **AWS SDK**: CodeWhisperer集成
- **OpenAI SDK**: OpenAI兼容API集成

### 环境配置
- **ANTHROPIC_BASE_URL**: 劫持Claude Code的请求到本地路由器
- **ANTHROPIC_API_KEY**: 认证密钥配置
- **端口配置**: 开发端口3456，生产端口3457

## 🔍 特性亮点

### 透明代理
- Claude Code用户体验完全不变
- 一键启动即可使用不同的AI供应商
- 自动环境变量设置和请求劫持

### 智能路由
- 基于请求内容和特征的智能分类
- 支持token数量、模型类型、工具使用等多维度路由
- 可配置的自定义路由规则

### 负载均衡
- 多种负载均衡策略：轮询、加权、最少连接、响应时间
- 健康监控和故障自动切换
- 熔断保护机制

### 格式转换
- 无缝的API格式转换
- 支持流式和非流式响应
- 完整的工具调用支持

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

特别感谢以下项目的启发和参考：

- [claude-code-router](https://github.com/musistudio/claude-code-router) by @musistudio
- [kiro2cc](https://github.com/bestK/kiro2cc) by @bestK

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 [Issue](../../issues)
- 发起 [Discussion](../../discussions)

---

**让AI模型路由变得简单而强大！** 🚀