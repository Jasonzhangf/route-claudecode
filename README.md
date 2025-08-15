# Route Claude Code (RCC) v4.0 🚀

高性能、模块化的多AI提供商路由转换系统 - 完全重构版

## 🎯 项目概述

RCC v4.0 是一个基于 TypeScript 的现代化AI路由代理系统，支持多种AI提供商的无缝集成和智能路由。采用严格模块化架构，提供企业级的可靠性和性能。

### 核心特性

- 🏗️ **严格模块化架构** - 11模块标准流水线，职责清晰分离
- 🔄 **智能路由系统** - 基于权重、负载均衡的动态路由
- 🚀 **高性能设计** - <100ms 处理延迟，<200MB 内存占用
- 🛡️ **零失败容忍** - 无静默失败，完整错误追踪链
- 🧪 **真实流水线测试** - Debug系统支持数据捕获和回放
- 🎛️ **双模式CLI** - Server模式和Client模式灵活切换

### 支持的AI提供商

- ✅ **LM Studio** (优先支持) - OpenAI兼容协议
- 🔄 **OpenAI** (计划支持) - 官方API
- 🔄 **Anthropic** (计划支持) - Claude API
- 🔄 **Google Gemini** (计划支持) - Gemini API

## 🚀 快速开始

### 系统要求

- Node.js >= 18.0.0
- TypeScript >= 5.5.0
- 内存 >= 512MB

### 安装

```bash
# 克隆项目
git clone https://github.com/fanzhang16/route-claudecode.git
cd route-claudecode/workspace/main-development

# 安装依赖
npm install

# 构建项目
npm run build

# 复制配置文件
cp .env.example .env
cp config/examples/config.example.json ~/.route-claudecode/config/config.json
```

### 基础使用

```bash
# 启动服务器模式 (独立运行)
rcc4 start

# 启动客户端模式 (透明代理Claude Code)
rcc4 code

# 查看状态
rcc4 status

# 停止服务
rcc4 stop
```

## 🏗️ 架构设计

### 四大核心模块

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client        │────│    Router       │────│   Pipeline      │────│    Debug        │
│                 │    │                 │    │    Worker       │    │    System       │
│ • CLI System    │    │ • Config Mgmt   │    │ • Transformer   │    │ • Data Capture  │
│ • Error Handler │    │ • Request Route │    │ • Protocol      │    │ • Replay System │
│ • User Interface│    │ • Load Balance  │    │ • Server-Compat │    │ • Unit Testing  │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 11模块流水线架构

每个Provider都有独立的流水线实例：

1. **Router** - 路由决策和Provider选择
2. **Input Transformer** - 输入格式转换 (Anthropic → Standard)
3. **Format Normalizer** - 消息和工具格式统一
4. **Provider Preprocessor** - Provider特定预处理
5. **Protocol Interface** - 协议层接口 (OpenAI/Anthropic/etc)
6. **Response Interceptor** - 响应拦截和验证
7. **Provider Postprocessor** - Provider特定后处理
8. **Output Transformer** - 输出格式转换 (Standard → Anthropic)
9. **Debug Module** - 调试数据记录 (可选)
10. **Error Capture** - 错误捕获系统 (可选)
11. **Unit Test** - 单元测试支持 (可选)

## 📁 项目结构

```
src/
├── types/              # 核心类型定义
├── client/             # 客户端模块 (CLI, 服务器管理)
├── router/             # 路由器模块 (配置, 路由, 负载均衡)
├── pipeline/           # 流水线Worker (动态管理, 11模块流水线)
├── debug/              # Debug系统 (数据记录, 回放测试)
├── utils/              # 通用工具函数
├── interfaces/         # 接口定义
├── modules/            # 可复用模块
└── __tests__/          # 单元测试

config/
├── examples/           # 示例配置文件
├── providers/          # Provider配置
├── routing/            # 路由配置
└── generated/          # 动态生成的配置

tests/
├── unit/               # 单元测试
├── integration/        # 集成测试
├── e2e/                # 端到端测试
└── fixtures/           # 测试数据
```

## 🧪 开发和测试

### 开发模式

```bash
# 开发模式运行 (自动重建)
npm run dev

# 代码检查
npm run lint

# 自动修复代码格式
npm run lint:fix
```

### 测试

```bash
# 运行所有测试
npm test

# 监听模式测试
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

### 验收标准

根据 `tasks.md` 中的要求，每个任务必须满足：

- ✅ **代码质量**: TypeScript严格模式编译通过，ESLint无错误
- ✅ **测试覆盖**: 单元测试≥80%，集成测试≥90%，端到端测试=100%
- ✅ **真实API测试**: 与LM Studio的真实API调用测试通过
- ✅ **性能基准**: 响应延迟<100ms，内存使用<200MB
- ✅ **文档更新**: 代码注释、API文档、用户文档同步更新
- ✅ **安全检查**: 无安全漏洞，输入验证完整

## 📋 开发计划

当前处于 **Phase 1: 核心架构设计与实现** 阶段

### 完成状态

- ✅ **Task 1.1**: 项目初始化和结构设置
- ⏳ **Task 1.2**: 核心接口定义和类型系统
- ⏳ **Task 1.3**: CLI框架和命令系统
- ⏳ **Task 1.4**: 基础模块管理器实现

详细任务计划请参考 [tasks.md](./tasks.md)

## 🤝 开发规范

### 强制执行规则

根据 `CLAUDE.md` 中的规定：

1. **任务执行前检查** - 必须检查 `tasks.md` 中的任务状态和依赖
2. **开发过程约束** - 零代码重复，接口优先，测试驱动
3. **完成前验证** - 单元测试80%+，真实API测试，性能基准
4. **任务完成确认** - 更新状态，记录测试报告，代码审查

### 模块边界

- 严格模块化：每个模块只能在职责范围内工作
- 接口通信：模块间只能通过定义的接口通信
- 不允许跨模块：不能直接调用其他模块的内部方法

### 错误处理

- 不允许静默失败：所有错误必须抛出
- 统一错误格式：使用RCCError类型
- 完整错误链：保持错误追踪链完整

## 📚 文档

- [项目规格书](.claude/project-details/rcc-v4-specification.md)
- [详细设计](.claude/project-details/rcc-v4-detailed-design.md)
- [项目结构](.claude/project-details/rcc-v4-project-structure.md)
- [任务计划](./tasks.md)
- [开发规范](./CLAUDE.md)

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 👥 贡献

欢迎提交 Issue 和 Pull Request！

请确保：
1. 遵循项目的代码规范
2. 添加适当的测试
3. 更新相关文档
4. 通过所有质量检查

---

**项目版本**: v4.0.0-alpha.1  
**最后更新**: 2025-08-15  
**开发状态**: 🚧 开发中 - Phase 1