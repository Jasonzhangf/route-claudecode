# RCC v4.0 模块化路由代理系统

## 项目概述

Route Claude Code (RCC) v4.0 是一个严格模块化的AI路由代理系统，采用三层架构设计：客户端模块 → 路由器模块 → 流水线Worker。系统禁止mockup响应，所有错误通过标准API error handler处理，确保无静默失败。

### 核心特性
- **双模式CLI**: Server模式和Client模式，支持独立运行和透明代理
- **会话流控**: 基于session.conversationID.requestID的分层流控管理
- **智能路由**: 支持多Provider负载均衡和健康检查
- **完整调试**: 端口分组的日志系统和回放测试
- **自动化管理**: Provider自动更新和模型发现

## 核心架构

### 整体架构图

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   客户端模块     │───▶│   路由器模块     │───▶│  流水线Worker   │
│   (Client)      │    │   (Router)      │    │  (Pipeline)     │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ CLI管理     │ │    │ │ 配置管理     │ │    │ │ Transformer │ │
│ │ 服务器管理   │ │    │ │ 请求路由     │ │    │ │ Protocol    │ │
│ │ 会话管理     │ │    │ │ 会话流控     │ │    │ │ Server-Comp │ │
│ │ 错误处理     │ │    │ │ 流水线管理   │ │    │ │ Server      │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    支撑系统模块                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Debug系统    │  │ 配置系统     │  │ 错误处理     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   核心类型定义   │
                    │   (Types)       │
                    └─────────────────┘
```

### CLI双模式架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI入口点                                │
│                      (src/cli.ts)                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   CLI管理器      │
                    │ (cli-manager.ts) │
                    └─────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
        ┌─────────────────┐   ┌─────────────────┐
        │   Server模式     │   │   Client模式     │
        │(cli-server.ts)  │   │(cli-client.ts)  │
        │                 │   │                 │
        │ rcc start       │   │ rcc code        │
        │ - 启动HTTP服务器 │   │ - 启动Claude Code│
        │ - 阻塞式运行     │   │ - 透明代理模式   │
        │ - Ctrl+C优雅退出 │   │ - 进程生命周期管理│
        │ - 服务器监控     │   │ - 自动服务管理   │
        └─────────────────┘   └─────────────────┘
```

## 核心模块设计

### 1. [客户端模块 (Client)](./src/client/README.md)
- **路径**: `src/client/`
- **职责**: CLI命令处理、HTTP服务器管理、统一错误处理、会话管理
- **核心功能**: 
  - CLI命令系统 (`rcc start`, `rcc stop`, `rcc code`, `rcc status`)
  - HTTP服务器管理
  - 统一错误处理
  - 会话和对话ID提取管理

### 2. [路由器模块 (Router)](./src/router/README.md)
- **路径**: `src/router/`
- **职责**: 配置管理、请求路由、流水线生命周期管理、会话流控
- **核心功能**:
  - 配置管理系统
  - 智能请求路由
  - 流水线动态管理
  - 负载均衡
  - 会话流控系统 (基于session.conversationID.requestID)

### 3. [流水线Worker模块 (Pipeline)](./src/pipeline/README.md)
- **路径**: `src/pipeline/`
- **职责**: 核心处理单元，每个provider.model独立流水线
- **核心功能**:
  - 流水线框架
  - 动态创建和销毁
  - 模块化处理链

## 流水线子模块

### [Transformer模块](./src/modules/pipeline-modules/transformer/README.md)
- **路径**: `src/modules/pipeline-modules/transformer/`
- **职责**: Anthropic格式与目标协议格式双向转换
- **支持协议**: OpenAI, Anthropic, Gemini
- **核心功能**: 格式转换、工具调用转换、流式处理

### [Protocol模块](./src/modules/pipeline-modules/protocol/README.md)
- **路径**: `src/modules/pipeline-modules/protocol/`
- **职责**: 协议控制转换，流式和非流式处理
- **核心功能**: 流式控制、协议验证、格式标准化

### [Server-Compatibility模块](./src/modules/pipeline-modules/server-compatibility/README.md)
- **路径**: `src/modules/pipeline-modules/server-compatibility/`
- **职责**: 第三方服务器兼容处理
- **支持服务**: OpenAI, DeepSeek, LMStudio, Gemini, Anthropic
- **核心功能**: 请求适配、响应适配、特殊处理

### [Server模块](./src/modules/pipeline-modules/server/README.md)
- **路径**: `src/modules/pipeline-modules/server/`
- **职责**: 与AI服务提供商的实际通信
- **SDK支持**: 优先使用官方SDK，回退到HTTP客户端
- **支持服务**: OpenAI, Anthropic, Gemini, LMStudio, Ollama, CodeWhisperer

## 支撑系统模块

### [Debug系统模块](./src/debug/README.md)
- **路径**: `src/debug/`
- **职责**: 完整的调试和回放功能
- **核心功能**:
  - Debug管理和控制
  - 数据记录和存储
  - 回放系统和单元测试生成

### [配置系统模块](./src/config/README.md)
- **路径**: `src/config/`
- **职责**: 配置管理、验证、动态重载
- **核心功能**:
  - 配置加载和验证
  - 环境变量替换
  - 动态重载和监听

### [错误处理系统](./src/middleware/error-handler.ts)
- **路径**: `src/middleware/`
- **职责**: 统一错误处理机制
- **核心功能**:
  - 标准错误格式
  - 错误分类和状态码映射
  - 敏感信息过滤

### [核心类型定义模块](./src/types/README.md)
- **路径**: `src/types/`
- **职责**: 系统中所有模块共享的类型定义
- **核心功能**:
  - 核心类型定义
  - AI服务类型定义
  - 模块接口类型

## 设计原则

### 核心质量标准
1. **严格模块化**: 每个模块职责单一、物理隔离、通过标准接口通信
2. **零静默失败**: 所有错误必须通过标准API error handler处理
3. **零Mockup响应**: 严禁mockup响应，必须真实流水线测试
4. **零重复代码**: 模块间不允许功能重叠
5. **零硬编码**: 所有配置可动态加载和更新

### 模块设计基本要求
1. **功能不重叠**: 每个模块的功能彼此不覆盖，职责单一明确
2. **标准接口**: 模块间通过标准接口连接，不允许直接调用内部方法
3. **物理隔离**: 每个模块物理上存在于独立的文件夹中
4. **文档完整**: 每个模块文件夹内必须有README说明功能和接口
5. **数据校验**: 每个模块的输入输出都有标准的数据校验方式
6. **错误处理**: 输入输出有问题时第一时间调用error handler处理

## 命令行接口

### 基本命令
```bash
# Server模式 - 启动HTTP服务器
rcc start [--port 3456] [--config path] [--debug]

# Client模式 - 启动Claude Code代理
rcc code [--provider lmstudio] [--model llama-3.1]

# 状态查询
rcc status

# 停止服务
rcc stop
```

### 高级命令
```bash
# Provider管理
rcc provider list
rcc provider update
rcc provider health

# 配置管理
rcc config validate
rcc config reload

# Debug功能
rcc debug enable
rcc debug replay [session-id]
```

## 开发指南

### 新模块开发流程
1. **需求分析**: 明确模块职责和边界
2. **接口设计**: 定义标准接口和类型
3. **文档编写**: 编写模块README文档
4. **实现开发**: 按照质量标准实现功能
5. **测试验证**: 进行真实流水线测试
6. **质量检查**: 通过模块交付检查标准
7. **集成测试**: 与其他模块集成测试

### 模块交付检查标准
每个模块完成交付时必须通过以下检查：
- ✅ 是否有静默失败？（必须无静默失败）
- ✅ 是否有mockup响应？（必须无mockup响应）
- ✅ 是否有重复代码？（必须无重复代码）
- ✅ 是否有硬编码实现？（必须无硬编码实现）

## 部署和运行

### 开发环境
```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 类型检查
npm run typecheck

# 测试
npm test
```

### 生产部署
```bash
# 构建
npm run build

# 启动服务器模式
npm start -- start --port 3456

# 启动客户端模式
npm start -- code
```

## 技术栈

- **TypeScript**: 主要开发语言，严格类型检查
- **Node.js**: 运行时环境
- **官方SDK**: 优先使用各AI服务商的官方SDK
  - `openai` - OpenAI SDK
  - `@anthropic-ai/sdk` - Anthropic SDK
  - `@google/generative-ai` - Gemini SDK
- **HTTP客户端**: LMStudio等第三方服务

## 许可证

MIT License - 详见 LICENSE 文件

## 维护指南

### 日常维护
- **配置更新**: 定期检查和更新配置文件
- **日志监控**: 监控错误日志和性能指标
- **健康检查**: 定期检查各模块健康状态
- **依赖更新**: 及时更新依赖包和SDK

### 故障排查
- **错误追踪**: 使用Debug系统追踪错误
- **日志分析**: 分析错误日志定位问题
- **回放测试**: 使用回放功能重现问题
- **模块隔离**: 逐个模块排查问题

这个模块化架构为RCC v4.0提供了清晰的结构和发展路径，确保系统的可维护性、可扩展性和可靠性。