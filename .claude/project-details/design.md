# RCC v4.0 模块化路由代理系统 - 设计文档

## 概述

RCC v4.0 采用严格的模块化架构设计，每个模块职责单一、物理隔离、通过标准接口通信。系统禁止mockup响应，所有错误通过标准API error handler处理，确保无静默失败。

> **注意**: 本文档是RCC v4.0的主设计文档。模块化架构的详细设计请参见 [/claude/project-details/modules/](./modules/) 目录，其中包含了按目录结构拆分的各个模块详细设计文档。

RCC v4.0 采用严格的模块化架构设计，每个模块职责单一、物理隔离、通过标准接口通信。系统禁止mockup响应，所有错误通过标准API error handler处理，确保无静默失败。

### 核心特性
- **双模式CLI**: Server模式和Client模式，支持独立运行和透明代理
- **会话流控**: 基于session.conversationID.requestID的分层流控管理
- **智能路由**: 支持多Provider负载均衡和健康检查
- **完整调试**: 端口分组的日志系统和回放测试
- **自动化管理**: Provider自动更新和模型发现

## 架构设计

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
                    │                   │
                    ▼                   ▼
        ┌─────────────────┐   ┌─────────────────┐
        │  HTTP服务器      │   │  进程管理器      │
        │(server-manager) │   │(process-manager)│
        └─────────────────┘   └─────────────────┘
```

### 路由器框图架构

```
Claude Code Request (Anthropic格式)
        │
        ▼
┌─────────────────┐
│   客户端模块     │ ── HTTP Server (Port 3456)
│   - 请求接收     │ ── 标准API error handler
│   - 错误统一处理 │ ── 数据校验
└─────────────────┘
        │ (RCCRequest)
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                        路由器模块                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   配置管理器     │  │   请求路由器     │  │  流水线管理器    │  │
│  │                 │  │                 │  │                 │  │
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │
│  │ │Provider配置 │ │  │ │请求分类逻辑 │ │  │ │流水线注册表 │ │  │
│  │ │routing.json │ │  │ │- default    │ │  │ │- 活跃流水线 │ │  │
│  │ └─────────────┘ │  │ │- think      │ │  │ │- 健康状态   │ │  │
│  │ ┌─────────────┐ │  │ │- longContext│ │  │ │- 负载信息   │ │  │
│  │ │动态路由表   │ │  │ │- background │ │  │ └─────────────┘ │  │
│  │ │generated/   │ │  │ │- webSearch  │ │  │ ┌─────────────┐ │  │
│  │ └─────────────┘ │  │ └─────────────┘ │  │ │流水线工厂   │ │  │
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ │- 动态创建   │ │  │
│  │ │配置监听器   │ │  │ │负载均衡器   │ │  │ │- 动态销毁   │ │  │
│  │ │- 文件变化   │ │  │ │- 权重算法   │ │  │ │- 生命周期   │ │  │
│  │ │- 自动重载   │ │  │ │- 健康检查   │ │  │ └─────────────┘ │  │
│  │ └─────────────┘ │  │ └─────────────┘ │  └─────────────────┘  │
│  └─────────────────┘  └─────────────────┘                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    会话流控管理器                            │ │
│  │                                                             │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │ │
│  │  │   会话队列       │  │   对话管理       │  │  优先级调度  │ │ │
│  │  │                 │  │                 │  │             │ │ │
│  │  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────┐ │ │ │
│  │  │ │Session A    │ │  │ │Conversation │ │  │ │高优先级 │ │ │ │
│  │  │ │- Conv1: Q1  │ │  │ │排队管理     │ │  │ │- think  │ │ │ │
│  │  │ │- Conv2: Q1  │ │  │ │- 串行处理   │ │  │ │- default│ │ │ │
│  │  │ └─────────────┘ │  │ │- 顺序保证   │ │  │ └─────────┘ │ │ │
│  │  │ ┌─────────────┐ │  │ └─────────────┘ │  │ ┌─────────┐ │ │ │
│  │  │ │Session B    │ │  │ ┌─────────────┐ │  │ │低优先级 │ │ │ │
│  │  │ │- Conv1: Q1→Q2│ │  │ │请求状态跟踪 │ │  │ │- background│ │ │
│  │  │ └─────────────┘ │  │ │- 队列状态   │ │  │ │- longContext│ │ │
│  │  └─────────────────┘  │ │- 处理进度   │ │  │ └─────────┘ │ │ │
│  │                       │ └─────────────┘ │  └─────────────┘ │ │
│  │                       └─────────────────┘                │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
        │ (选中的Pipeline)
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      流水线Worker池                              │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ openai_gpt-4    │  │ gemini_2.5-pro  │  │deepseek_chat    │  │
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │
│  │ │Transformer  │ │  │ │Transformer  │ │  │ │Transformer  │ │  │
│  │ │Protocol     │ │  │ │Protocol     │ │  │ │Protocol     │ │  │
│  │ │Server-Comp  │ │  │ │Server-Comp  │ │  │ │Server-Comp  │ │  │
│  │ │Server       │ │  │ │Server       │ │  │ │Server       │ │  │
│  │ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘ │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │lmstudio_llama   │  │codewhisperer    │  │ anthropic_claude│  │
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │
│  │ │Transformer  │ │  │ │Transformer  │ │  │ │Transformer  │ │  │
│  │ │Protocol     │ │  │ │Protocol     │ │  │ │Protocol     │ │  │
│  │ │Server-Comp  │ │  │ │Server-Comp  │ │  │ │Server-Comp  │ │  │
│  │ │Server       │ │  │ │Server       │ │  │ │Server       │ │  │
│  │ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘ │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
        │ (AI Service Response)
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      响应管理层                                  │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   响应收集器     │  │   数据校正器     │  │   格式统一器     │  │
│  │                 │  │                 │  │                 │  │
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │
│  │ │多流水线响应 │ │  │ │数据验证     │ │  │ │Anthropic格式│ │  │
│  │ │- 并发处理   │ │  │ │- 格式检查   │ │  │ │- 统一输出   │ │  │
│  │ │- 响应聚合   │ │  │ │- 数据修复   │ │  │ │- 错误格式化 │ │  │
│  │ └─────────────┘ │  │ │- 缺失补全   │ │  │ │- 流式处理   │ │  │
│  │ ┌─────────────┐ │  │ └─────────────┘ │  │ └─────────────┘ │  │
│  │ │错误处理     │ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │
│  │ │- 异常捕获   │ │  │ │内容过滤     │ │  │ │质量保证     │ │  │
│  │ │- 重试机制   │ │  │ │- 敏感信息   │ │  │ │- 响应完整性 │ │  │
│  │ └─────────────┘ │  │ │- 有害内容   │ │  │ │- 格式正确性 │ │  │
│  └─────────────────┘  │ │- 合规检查   │ │  │ │- 性能指标   │ │  │
│                       │ └─────────────┘ │  │ └─────────────┘ │  │
│                       └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
        │ (统一处理后的Anthropic格式响应)
        ▼
    返回Claude Code客户端
```

### 流水线动态注册架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    流水线动态注册系统                            │
│                                                                 │
│  ┌─────────────────┐                    ┌─────────────────┐     │
│  │   注册触发器     │                    │   注册管理器     │     │
│  │                 │                    │                 │     │
│  │ ┌─────────────┐ │   配置变化事件      │ ┌─────────────┐ │     │
│  │ │配置文件监听 │ │ ──────────────────▶ │ │注册调度器   │ │     │
│  │ │- providers  │ │                    │ │- 创建队列   │ │     │
│  │ │- routing    │ │                    │ │- 销毁队列   │ │     │
│  │ └─────────────┘ │                    │ │- 优先级管理 │ │     │
│  │ ┌─────────────┐ │   可用性变化事件    │ └─────────────┘ │     │
│  │ │健康检查器   │ │ ──────────────────▶ │ ┌─────────────┐ │     │
│  │ │- 定时检查   │ │                    │ │生命周期管理 │ │     │
│  │ │- 状态变化   │ │                    │ │- 创建流程   │ │     │
│  │ └─────────────┘ │                    │ │- 销毁流程   │ │     │
│  │ ┌─────────────┐ │   手动触发事件      │ │- 状态跟踪   │ │     │
│  │ │API触发器    │ │ ──────────────────▶ │ └─────────────┘ │     │
│  │ │- 管理接口   │ │                    └─────────────────┘     │
│  │ │- 强制重载   │ │                                            │
│  │ └─────────────┘ │                                            │
│  └─────────────────┘                                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    流水线工厂系统                            │ │
│  │                                                             │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │ │
│  │  │   模块工厂       │  │   流水线构建器   │  │  注册表     │ │ │
│  │  │                 │  │                 │  │             │ │ │
│  │  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────┐ │ │ │
│  │  │ │Transformer  │ │  │ │模块组装     │ │  │ │活跃列表 │ │ │ │
│  │  │ │工厂         │ │  │ │- 依赖注入   │ │  │ │- ID映射 │ │ │ │
│  │  │ └─────────────┘ │  │ │- 配置注入   │ │  │ │- 状态   │ │ │ │
│  │  │ ┌─────────────┐ │  │ │- 接口验证   │ │  │ └─────────┘ │ │ │
│  │  │ │Protocol     │ │  │ └─────────────┘ │  │ ┌─────────┐ │ │ │
│  │  │ │工厂         │ │  │ ┌─────────────┐ │  │ │健康状态 │ │ │ │
│  │  │ └─────────────┘ │  │ │初始化器     │ │  │ │- 可用性 │ │ │ │
│  │  │ ┌─────────────┐ │  │ │- 模块初始化 │ │  │ │- 错误率 │ │ │ │
│  │  │ │Server-Comp  │ │  │ │- 连接测试   │ │  │ │- 响应时间│ │ │ │
│  │  │ │工厂         │ │  │ │- 健康检查   │ │  │ └─────────┘ │ │ │
│  │  │ └─────────────┘ │  │ └─────────────┘ │  └─────────────┘ │ │
│  │  │ ┌─────────────┐ │  └─────────────────┘                │ │
│  │  │ │Server       │ │                                      │ │
│  │  │ │工厂         │ │                                      │ │
│  │  │ └─────────────┘ │                                      │ │
│  │  └─────────────────┘                                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

流水线动态注册流程:
1. 配置变化检测 → 2. 差异分析 → 3. 注册计划生成 → 4. 流水线创建/销毁 → 5. 状态更新
```

### 流水线生命周期管理

```
┌─────────────────────────────────────────────────────────────────┐
│                    流水线生命周期状态机                          │
│                                                                 │
│     [配置加载]                                                   │
│         │                                                       │
│         ▼                                                       │
│    ┌─────────┐     创建请求      ┌─────────┐                     │
│    │ PENDING │ ─────────────────▶│CREATING │                     │
│    └─────────┘                   └─────────┘                     │
│                                       │                         │
│                                   初始化完成                     │
│                                       ▼                         │
│    ┌─────────┐     健康检查失败  ┌─────────┐     健康检查通过     │
│    │ FAILED  │ ◀─────────────── │ ACTIVE  │ ◀─────────────────┐ │
│    └─────────┘                   └─────────┘                   │ │
│         │                             │                       │ │
│         │ 重试/修复                    │ 处理请求               │ │
│         ▼                             ▼                       │ │
│    ┌─────────┐                   ┌─────────┐                   │ │
│    │ RETRY   │                   │PROCESSING│                   │ │
│    └─────────┘                   └─────────┘                   │ │
│         │                             │                       │ │
│         └─────────────────────────────┘                       │ │
│                                                               │ │
│    ┌─────────┐     可用性=false   ┌─────────┐                   │ │
│    │DESTROYING│ ◀─────────────── │INACTIVE │ ◀─────────────────┘ │
│    └─────────┘                   └─────────┘                     │
│         │                                                       │
│         ▼                                                       │
│    ┌─────────┐                                                  │
│    │DESTROYED│                                                  │
│    └─────────┘                                                  │
└─────────────────────────────────────────────────────────────────┘

状态转换触发条件:
- PENDING → CREATING: 配置中provider.model.availability=true
- CREATING → ACTIVE: 所有模块初始化成功且健康检查通过
- CREATING → FAILED: 初始化失败或健康检查失败
- ACTIVE → PROCESSING: 接收到处理请求
- PROCESSING → ACTIVE: 请求处理完成
- ACTIVE → INACTIVE: 健康检查连续失败
- INACTIVE → ACTIVE: 健康检查恢复
- INACTIVE → DESTROYING: provider.model.availability=false
- FAILED → RETRY: 重试机制触发
- RETRY → CREATING: 重新尝试创建
- DESTROYING → DESTROYED: 清理完成
```

## AI服务架构设计

### 1. OpenAI + LMStudio 模块流水线架构

#### 1.1 OpenAI标准流水线
```
Anthropic Request
        │
        ▼
┌─────────────────┐
│  Transformer    │ ── Anthropic → OpenAI格式转换
│  - 消息格式转换  │ ── 工具调用格式适配
│  - 参数映射     │ ── 流式标志处理
└─────────────────┘
        │
        ▼
┌─────────────────┐
│  Protocol       │ ── 流式 → 非流式转换
│  - 流式控制     │ ── OpenAI协议验证
│  - 协议标准化   │ ── 请求体校验
└─────────────────┘
        │
        ▼
┌─────────────────┐
│Server-Compat    │ ── OpenAI标准格式
│  - 工具调用优化  │ ── 模型名称映射
│  - 参数调整     │ ── 兼容性处理
└─────────────────┘
        │
        ▼
┌─────────────────┐
│  Server         │ ── 使用官方OpenAI SDK
│  - SDK: 'openai'│ ── import OpenAI from 'openai'
│  - 认证处理     │ ── Bearer Token认证
│  - 健康检查     │ ── /v1/models端点检查
└─────────────────┘
        │
        ▼
OpenAI API (https://api.openai.com/v1/chat/completions)
```

#### 1.2 LMStudio流水线 (OpenAI兼容)
```
Anthropic Request
        │
        ▼
┌─────────────────┐
│  Transformer    │ ── Anthropic → OpenAI格式转换
│  - 同OpenAI转换  │ ── 相同的转换逻辑
└─────────────────┘
        │
        ▼
┌─────────────────┐
│  Protocol       │ ── OpenAI协议处理
│  - 同OpenAI协议  │ ── 相同的协议逻辑
└─────────────────┘
        │
        ▼
┌─────────────────┐
│Server-Compat    │ ── LMStudio特定适配
│  - 本地模型名称  │ ── 模型路径处理
│  - 工具调用格式  │ ── 特殊工具调用处理
│  - 参数限制     │ ── 本地模型参数限制
└─────────────────┘
        │
        ▼
┌─────────────────┐
│  Server         │ ── 使用OpenAI SDK + 自定义baseURL
│  - SDK: 'openai'│ ── new OpenAI({baseURL: 'http://localhost:1234'})
│  - 本地认证     │ ── 无需API Key或使用占位符
│  - 健康检查     │ ── 本地端口检查
└─────────────────┘
        │
        ▼
LMStudio Local Server (http://localhost:1234/v1/chat/completions)
```

### 2. OpenAI + 第三方服务器架构

#### 2.1 DeepSeek (OpenAI兼容)
```
┌─────────────────┐
│Server-Compat    │ ── DeepSeek特定优化
│  - tool_choice   │ ── 自动设置为"auto"
│  - 推理模式     │ ── deepseek-reasoner特殊处理
│  - 参数调整     │ ── max_tokens限制调整
└─────────────────┘
        │
        ▼
┌─────────────────┐
│  Server         │ ── 使用OpenAI SDK + DeepSeek URL
│  - SDK: 'openai'│ ── new OpenAI({baseURL: 'https://api.deepseek.com'})
│  - API Key认证  │ ── Bearer sk-xxx
│  - 模型映射     │ ── deepseek-chat, deepseek-reasoner
└─────────────────┘
```

#### 2.2 其他OpenAI兼容服务
```
支持的第三方服务:
- Groq: https://api.groq.com/openai/v1
- Together AI: https://api.together.xyz/v1
- Perplexity: https://api.perplexity.ai
- Mistral AI: https://api.mistral.ai/v1
- 自部署OpenAI兼容服务

统一架构模式:
Transformer(相同) → Protocol(相同) → Server-Compat(服务商特定) → Server(OpenAI SDK + 自定义baseURL)
```

### 3. Gemini服务器架构

#### 3.1 Gemini完整流水线
```
Anthropic Request
        │
        ▼
┌─────────────────┐
│  Transformer    │ ── Anthropic → Gemini格式转换
│  - messages转换  │ ── role: user/assistant → user/model
│  - content转换   │ ── 文本内容 → parts: [{text: "..."}]
│  - 工具调用转换  │ ── Anthropic tools → Gemini function_declarations
└─────────────────┘
        │
        ▼
┌─────────────────┐
│  Protocol       │ ── Gemini协议处理
│  - 流式处理     │ ── streamGenerateContent vs generateContent
│  - 协议验证     │ ── contents数组验证
│  - 参数映射     │ ── generationConfig处理
└─────────────────┘
        │
        ▼
┌─────────────────┐
│Server-Compat    │ ── Gemini特定适配
│  - OAuth处理    │ ── Google OAuth2认证
│  - 项目ID管理   │ ── Project ID自动发现
│  - 模型选择     │ ── gemini-2.5-flash, gemini-2.5-pro
│  - 安全设置     │ ── safetySettings配置
└─────────────────┘
        │
        ▼
┌─────────────────┐
│  Server         │ ── 使用官方Google AI SDK
│  - SDK: '@google/generative-ai' │
│  - OAuth认证    │ ── GoogleAuth + OAuth2Client
│  - 项目管理     │ ── 自动项目发现和配置
│  - 流式支持     │ ── generateContentStream
└─────────────────┘
        │
        ▼
Google AI API (https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent)
```

#### 3.2 Gemini认证架构
```
┌─────────────────┐
│  认证管理器      │
│  - OAuth2Client │ ── Google OAuth2认证
│  - Token管理    │ ── 访问令牌自动刷新
│  - 凭据存储     │ ── ~/.gemini/oauth_creds.json
└─────────────────┘
        │
        ▼
┌─────────────────┐
│  项目发现       │
│  - 项目ID获取   │ ── 自动发现Google Cloud项目
│  - 权限验证     │ ── AI Platform权限检查
│  - 模型列表     │ ── 可用模型枚举
└─────────────────┘
```

### 4. Code Whisperer架构

#### 4.1 AWS Code Whisperer流水线
```
Anthropic Request
        │
        ▼
┌─────────────────┐
│  Transformer    │ ── Anthropic → AWS格式转换
│  - 代码上下文    │ ── 代码补全请求格式
│  - 语言检测     │ ── 编程语言自动识别
│  - 文件上下文   │ ── 文件路径和内容处理
└─────────────────┘
        │
        ▼
┌─────────────────┐
│  Protocol       │ ── AWS协议处理
│  - IAM认证协议  │ ── AWS Signature V4
│  - 区域处理     │ ── AWS区域选择
│  - 服务端点     │ ── CodeWhisperer服务端点
└─────────────────┘
        │
        ▼
┌─────────────────┐
│Server-Compat    │ ── CodeWhisperer特定适配
│  - 代码建议格式  │ ── 代码补全建议处理
│  - 安全扫描     │ ── 代码安全检查
│  - 许可证检查   │ ── 开源许可证验证
│  - 上下文优化   │ ── 代码上下文优化
└─────────────────┘
        │
        ▼
┌─────────────────┐
│  Server         │ ── 使用AWS SDK
│  - SDK: '@aws-sdk/client-codewhisperer-runtime'
│  - IAM认证      │ ── AWS访问密钥认证
│  - 区域配置     │ ── us-east-1等区域
│  - 服务调用     │ ── GenerateCompletions API
└─────────────────┘
        │
        ▼
AWS CodeWhisperer API (https://codewhisperer-runtime.us-east-1.amazonaws.com)
```

#### 4.2 CodeWhisperer认证架构
```
┌─────────────────┐
│  AWS认证管理     │
│  - IAM凭据      │ ── AWS Access Key + Secret Key
│  - 临时凭据     │ ── STS临时令牌支持
│  - 配置文件     │ ── ~/.aws/credentials
│  - 环境变量     │ ── AWS_ACCESS_KEY_ID等
└─────────────────┘
        │
        ▼
┌─────────────────┐
│  权限验证       │
│  - CodeWhisperer权限 │ ── codewhisperer:GenerateCompletions
│  - 区域权限     │ ── 指定区域访问权限
│  - 配额检查     │ ── API调用配额验证
└─────────────────┘
```

## 服务器模块详细设计

### 1. OpenAI服务器实现
```typescript
// src/pipeline/modules/server/openai/openai-server.ts
import OpenAI from 'openai';

export class OpenAIServer implements ServerModule {
  private client: OpenAI;
  
  constructor(config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl, // 支持自定义baseURL用于第三方服务
    });
  }
  
  async sendRequest(request: OpenAIRequest): Promise<OpenAIResponse> {
    return await this.client.chat.completions.create(request);
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}
```

### 2. Gemini服务器实现
```typescript
// src/pipeline/modules/server/gemini/gemini-server.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OAuth2Client } from 'google-auth-library';

export class GeminiServer implements ServerModule {
  private genAI: GoogleGenerativeAI;
  private authClient: OAuth2Client;
  
  constructor(config: ProviderConfig) {
    this.authClient = new OAuth2Client(CLIENT_ID, CLIENT_SECRET);
    this.genAI = new GoogleGenerativeAI(config.apiKey);
  }
  
  async sendRequest(request: GeminiRequest): Promise<GeminiResponse> {
    const model = this.genAI.getGenerativeModel({ model: request.model });
    return await model.generateContent(request);
  }
}
```

### 3. CodeWhisperer服务器实现
```typescript
// src/pipeline/modules/server/codewhisperer/codewhisperer-server.ts
import { CodeWhispererRuntimeClient, GenerateCompletionsCommand } from '@aws-sdk/client-codewhisperer-runtime';

export class CodeWhispererServer implements ServerModule {
  private client: CodeWhispererRuntimeClient;
  
  constructor(config: ProviderConfig) {
    this.client = new CodeWhispererRuntimeClient({
      region: config.region || 'us-east-1',
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  
  async sendRequest(request: CodeWhispererRequest): Promise<CodeWhispererResponse> {
    const command = new GenerateCompletionsCommand(request);
    return await this.client.send(command);
  }
}
```

## AI服务架构对比

### 架构复杂度对比

| 服务商 | 认证方式 | 协议类型 | SDK支持 | 特殊处理 | 复杂度 |
|--------|----------|----------|---------|----------|--------|
| OpenAI | Bearer Token | OpenAI标准 | 官方SDK | 无 | 低 |
| LMStudio | 无需认证 | OpenAI兼容 | OpenAI SDK | 本地端口 | 低 |
| DeepSeek | Bearer Token | OpenAI兼容 | OpenAI SDK | 工具调用优化 | 中 |
| Anthropic | x-api-key | Anthropic标准 | 官方SDK | 直通处理 | 中 |
| Gemini | OAuth2 | Gemini专有 | 官方SDK | 项目管理+OAuth | 高 |
| CodeWhisperer | AWS IAM | AWS专有 | AWS SDK | 代码上下文 | 高 |

### 流水线模块差异

#### Transformer模块差异
```typescript
// OpenAI系列 (OpenAI, LMStudio, DeepSeek)
AnthropicRequest → OpenAIRequest
- messages格式相同
- 工具调用格式转换
- 参数名映射 (max_tokens等)

// Gemini
AnthropicRequest → GeminiRequest  
- messages → contents
- role映射: assistant → model
- content → parts: [{text: "..."}]
- tools → function_declarations

// CodeWhisperer
AnthropicRequest → CodeWhispererRequest
- 提取代码上下文
- 语言检测
- 文件路径处理
- 补全位置确定
```

#### Server-Compatibility模块差异
```typescript
// OpenAI标准
class OpenAICompatibility {
  adaptRequest(request) {
    return request; // 无需适配
  }
}

// DeepSeek优化
class DeepSeekCompatibility {
  adaptRequest(request) {
    if (request.tools) {
      request.tool_choice = "auto"; // 自动工具选择
    }
    return request;
  }
}

// Gemini特殊处理
class GeminiCompatibility {
  adaptRequest(request) {
    return {
      contents: this.convertMessages(request.messages),
      generationConfig: this.convertConfig(request),
      safetySettings: this.getDefaultSafetySettings()
    };
  }
}

// CodeWhisperer代码处理
class CodeWhispererCompatibility {
  adaptRequest(request) {
    return {
      fileContext: this.extractFileContext(request),
      language: this.detectLanguage(request),
      cursorPosition: this.findCursorPosition(request)
    };
  }
}
```

#### Server模块实现差异
```typescript
// OpenAI系列统一实现
class OpenAIBasedServer {
  constructor(config) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl // 关键差异点
    });
  }
}

// 具体配置差异
const configs = {
  openai: { baseURL: "https://api.openai.com/v1" },
  lmstudio: { baseURL: "http://localhost:1234/v1" },
  deepseek: { baseURL: "https://api.deepseek.com" },
  groq: { baseURL: "https://api.groq.com/openai/v1" }
};

// Gemini独立实现
class GeminiServer {
  constructor(config) {
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.authClient = new OAuth2Client();
  }
}

// CodeWhisperer独立实现  
class CodeWhispererServer {
  constructor(config) {
    this.client = new CodeWhispererRuntimeClient({
      region: config.region,
      credentials: config.credentials
    });
  }
}
```

## 配置文件扩展

### 扩展的Provider配置 (支持负载均衡)
```json
{
  "providers": [
    {
      "name": "openai",
      "protocol": "openai",
      "baseUrl": "https://api.openai.com/v1",
      "serverType": "openai",
      "models": ["gpt-4", "gpt-3.5-turbo"],
      
      // 单Provider多Key配置
      "apiKeys": [
        {
          "keyId": "openai-key-1",
          "key": "${OPENAI_API_KEY_1}",
          "weight": 0.5,
          "rateLimits": {
            "requestsPerMinute": 3500,
            "tokensPerDay": 1000000
          }
        },
        {
          "keyId": "openai-key-2", 
          "key": "${OPENAI_API_KEY_2}",
          "weight": 0.3,
          "rateLimits": {
            "requestsPerMinute": 2000,
            "tokensPerDay": 500000
          }
        },
        {
          "keyId": "openai-key-3",
          "key": "${OPENAI_API_KEY_3}",
          "weight": 0.2,
          "rateLimits": {
            "requestsPerMinute": 1000,
            "tokensPerDay": 200000
          }
        }
      ],
      
      // 负载均衡配置
      "loadBalance": {
        "keySelectionStrategy": "quota_aware",
        "rotationPolicy": {
          "rotateOnError": true,
          "rotateOnRateLimit": true,
          "cooldownPeriod": 60
        }
      }
    },
    
    {
      "name": "deepseek",
      "protocol": "openai",
      "baseUrl": "https://api.deepseek.com",
      "serverType": "deepseek",
      "models": ["deepseek-chat", "deepseek-reasoner"],
      
      // 单密钥配置 (向后兼容)
      "apiKey": "${DEEPSEEK_API_KEY}",
      
      // 或者多密钥配置
      "apiKeys": [
        {
          "keyId": "deepseek-key-1",
          "key": "${DEEPSEEK_API_KEY_1}",
          "weight": 1.0
        }
      ]
    },
    
    {
      "name": "gemini",
      "protocol": "gemini",
      "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
      "serverType": "gemini",
      "models": ["gemini-2.5-flash", "gemini-2.5-pro"],
      "authType": "oauth2",
      "projectId": "${GOOGLE_PROJECT_ID}",
      
      // Gemini使用OAuth，不需要多密钥
      "apiKey": "${GEMINI_API_KEY}"
    }
  ],
  
  // 路由配置 (支持多Provider负载均衡)
  "routes": [
    {
      "category": "default",
      "rules": [
        {
          "provider": "openai",
          "model": "gpt-4",
          "weight": 0.6,
          "priority": 1
        },
        {
          "provider": "deepseek", 
          "model": "deepseek-chat",
          "weight": 0.4,
          "priority": 2
        }
      ],
      "loadBalance": {
        "strategy": "health_aware",
        "failoverEnabled": true,
        "healthCheckInterval": 30
      }
    },
    
    {
      "category": "code",
      "rules": [
        {
          "provider": "codewhisperer",
          "model": "default",
          "weight": 0.7,
          "priority": 1
        },
        {
          "provider": "openai",
          "model": "gpt-4",
          "weight": 0.3,
          "priority": 2
        }
      ]
    }
  ],
  
  // 全局负载均衡配置
  "globalLoadBalance": {
    "healthCheckEnabled": true,
    "healthCheckInterval": 30,
    "failureThreshold": 3,
    "recoveryThreshold": 2,
    "circuitBreakerEnabled": true,
    "circuitBreakerTimeout": 60
  }
}
```

### 负载均衡配置说明

#### 1. 单Provider多Key配置
```json
{
  "apiKeys": [
    {
      "keyId": "unique-identifier",
      "key": "actual-api-key",
      "weight": 0.5,                    // 权重 (0-1)
      "rateLimits": {
        "requestsPerMinute": 3500,
        "requestsPerHour": 200000,
        "tokensPerDay": 1000000
      },
      "quotaLimits": {
        "dailyQuota": 1000000,
        "monthlyQuota": 30000000
      },
      "status": "active"                // active/suspended/rate_limited
    }
  ],
  "loadBalance": {
    "keySelectionStrategy": "quota_aware",  // round_robin/least_used/quota_aware/error_rate_aware
    "rotationPolicy": {
      "rotateOnError": true,
      "rotateOnRateLimit": true,
      "rotateOnQuotaExceeded": true,
      "cooldownPeriod": 60
    }
  }
}
```

#### 2. 多Provider配置
```json
{
  "rules": [
    {
      "provider": "openai",
      "model": "gpt-4", 
      "weight": 0.6,
      "priority": 1,                    // 优先级 (1最高)
      "costPerToken": 0.00003,          // 成本因子
      "capabilities": ["text", "code", "reasoning"]
    }
  ],
  "loadBalance": {
    "strategy": "health_aware",         // weighted_round_robin/least_connections/response_time_based/health_aware
    "failoverEnabled": true,
    "healthCheckInterval": 30,
    "maxRetries": 3
  }
}
```

#### 3. 失效处理配置
```json
{
  "globalLoadBalance": {
    "healthCheckEnabled": true,
    "healthCheckInterval": 30,          // 健康检查间隔(秒)
    "failureThreshold": 3,              // 失败阈值
    "recoveryThreshold": 2,             // 恢复阈值
    "circuitBreakerEnabled": true,      // 熔断器
    "circuitBreakerTimeout": 60,        // 熔断超时(秒)
    "backoffStrategy": "exponential",   // linear/exponential
    "maxBackoffTime": 300               // 最大退避时间(秒)
  }
}
```

## CLI双模式设计

### Server模式 (`rcc start`)

Server模式用于启动独立的RCC路由服务器，适用于服务器部署和开发调试场景。

#### 特性
- **独立运行**: 作为独立的HTTP服务器运行
- **阻塞式**: CLI进程保持运行，监控服务器状态
- **优雅退出**: 支持Ctrl+C优雅关闭，清理所有资源
- **状态监控**: 实时监控服务器健康状态，异常时自动退出
- **配置驱动**: 根据配置文件启动，支持多端口部署

### Client模式 (`rcc code`)

Client模式用于透明代理Claude Code，为用户提供无感知的代理体验。

#### 特性
- **透明代理**: 自动配置环境变量，用户无需手动设置
- **进程管理**: 管理Claude Code和RCC服务器的生命周期
- **自动启动**: 可选自动启动RCC服务器
- **生命周期绑定**: Claude Code退出时自动关闭RCC服务
- **输入输出透明**: 不干扰Claude Code的正常输入输出

## 会话流控系统设计

### 流控架构层次

```
Session Level (会话级别)
├── sessionId: "session_abc123"
├── 创建时间: 2024-08-15 14:30:22 CST
├── 最后活动: 2024-08-15 14:35:10 CST
└── Conversation Level (对话级别)
    ├── conversationId: "conv_xyz789"
    ├── Request Queue (请求队列) - 严格串行处理
    │   ├── requestID_001 (处理中)
    │   ├── requestID_002 (排队)
    │   └── requestID_003 (排队)
    └── Processing State (处理状态)
        ├── 队列长度: 3
        ├── 处理中: 1
        └── 优先级: 5 (default)
```

### 流控处理流程

```
1. 请求到达 → 提取sessionId和conversationId
2. 会话管理 → 获取或创建会话队列
3. 对话排队 → 将请求加入对话队列
4. 优先级调度 → 根据请求类型设置优先级
5. 串行处理 → 同一对话内请求严格按顺序处理
6. 并发控制 → 不同会话和对话可以并行处理
7. 状态跟踪 → 实时更新队列和处理状态
8. 资源清理 → 自动清理过期会话和队列
```

## 组件设计

### 1. 客户端模块 (src/client/)

### 重试机制与处理流程关系图

```
客户端请求 (Anthropic格式)
        │
        ▼
┌─────────────────┐
│   路由器模块     │ ── 选择主要流水线
│   - 流水线选择   │ ── 根据负载均衡选择
│   - 备用流水线   │ ── 准备备用选项
└─────────────────┘
        │ (主要流水线)
        ▼
┌─────────────────┐
│  流水线Worker   │ ── 尝试处理请求
│  - 正常处理     │ ── 成功 → 返回响应
│  - 处理失败     │ ── 失败 → 抛出错误
└─────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      响应收集器                                  │
│                                                                 │
│  成功路径:                     失败路径:                         │
│  ┌─────────────┐               ┌─────────────┐                   │
│  │ 收集成功响应 │               │ 检测到错误   │                   │
│  │ - 验证响应   │               │ - 分析错误类型│                   │
│  │ - 记录指标   │               │ - 判断可重试性│                   │
│  └─────────────┘               └─────────────┘                   │
│         │                              │                        │
│         ▼                              ▼                        │
│  ┌─────────────┐               ┌─────────────┐                   │
│  │ 继续处理     │               │ 重试决策     │                   │
│  └─────────────┘               │ - 选择备用   │                   │
│                                │ - 计算延迟   │                   │
│                                │ - 检查次数   │                   │
│                                └─────────────┘                   │
│                                       │                         │
│                                       ▼                         │
│                                ┌─────────────┐                   │
│                                │ 重试处理     │                   │
│                                │ - 备用流水线 │ ──────────────────┐│
│                                │ - 延迟执行   │                   ││
│                                │ - 重试计数   │                   ││
│                                └─────────────┘                   ││
└─────────────────────────────────────────────────────────────────┘│
                                                                   │
        ┌──────────────────────────────────────────────────────────┘
        │ (重新进入流水线处理)
        ▼
┌─────────────────┐
│ 备用流水线Worker │ ── 使用不同的provider/model
│ - 不同的实现     │ ── 例如: openai失败 → 切换到deepseek
│ - 相同的接口     │ ── 保持相同的处理接口
└─────────────────┘
        │
        ▼
    重新进入响应收集器 (最多重试N次)
```

### 重试机制详细说明

```
重试触发条件:
1. 网络错误 (NETWORK_ERROR)
2. 服务器临时错误 (5xx状态码)
3. 速率限制错误 (429状态码)
4. 超时错误 (TIMEOUT_ERROR)

不重试的条件:
1. 认证错误 (401, 403)
2. 请求格式错误 (400)
3. 配置错误 (CONFIG_ERROR)
4. 验证错误 (VALIDATION_ERROR)

重试策略:
1. 同流水线重试: 网络临时问题
2. 备用流水线重试: 服务商问题
3. 延迟重试: 速率限制问题
4. 放弃重试: 达到最大次数或不可重试错误
```

### 响应管理层处理流程

```
AI Service Response (各种格式) 或 重试响应
        │
        ▼
┌─────────────────┐
│  响应收集器      │ ── 收集来自不同流水线的响应
│  - 并发响应处理  │ ── 处理多个流水线的并发响应
│  - 错误响应处理  │ ── 处理失败的流水线响应
│  - 重试机制     │ ── 自动重试失败的请求
└─────────────────┘
        │ (CollectedResponse)
        ▼
┌─────────────────┐
│  数据校正器      │ ── 验证和修复响应数据
│  - 格式验证     │ ── 检查响应格式是否正确
│  - 缺失字段补全  │ ── 补全缺失的必需字段
│  - 数据类型修复  │ ── 修复错误的数据类型
│  - 元数据补充   │ ── 添加缺失的元数据
└─────────────────┘
        │ (CorrectedResponse)
        ▼
┌─────────────────┐
│  内容过滤器      │ ── 过滤和检查响应内容
│  - 敏感信息过滤  │ ── 移除敏感信息
│  - 有害内容检测  │ ── 检测有害内容
│  - 合规性检查   │ ── 确保内容合规
│  - 内容清理     │ ── 清理不当内容
└─────────────────┘
        │ (FilteredResponse)
        ▼
┌─────────────────┐
│  格式统一器      │ ── 统一响应格式
│  - Anthropic转换 │ ── 转换为Anthropic格式
│  - 流式处理     │ ── 处理流式响应
│  - 元数据保留   │ ── 保留原始元数据
│  - 系统元数据   │ ── 添加系统元数据
└─────────────────┘
        │ (UnifiedResponse)
        ▼
┌─────────────────┐
│  质量保证器      │ ── 最终质量检查
│  - 完整性验证   │ ── 验证响应完整性
│  - 正确性检查   │ ── 检查格式正确性
│  - 质量评估     │ ── 评估响应质量
│  - 质量报告     │ ── 生成质量报告
└─────────────────┘
        │ (QualityAssuredResponse)
        ▼
    标准Anthropic格式响应返回Claude Code
```

## 组件设计

### 1. 客户端模块 (src/client/)

#### 1.1 CLI管理器 (cli.ts)
```typescript
interface CLIManager {
  setupCommands(): Command;
  handleError(error: RCCError): void;
}

// 支持的命令
- rcc start [--port 3456] [--config path] [--debug]
- rcc stop
- rcc code [--port 3456]
- rcc status
```

#### 1.2 服务器管理器 (server-manager.ts)
```typescript
interface ServerManager {
  startServer(port: number): Promise<void>;
  stopServer(): Promise<void>;
  getServerStatus(): Promise<ServerStatus>;
  setupRoutes(): void;
}

// 路由端点
- GET /health - 健康检查
- POST /v1/messages - Anthropic兼容的聊天完成端点
```

#### 1.3 错误处理器 (error-handler.ts)
```typescript
interface ErrorHandler {
  handleError(error: RCCError): void;
  formatError(error: RCCError): string;
  logError(error: RCCError): void;
  reportToUser(error: RCCError): void;
}

// 错误处理流程
Error发生 → 包装成RCCError → 记录日志 → 用户友好显示 → 程序退出(如需要)
```

### 2. 路由器模块 (src/router/)

#### 2.1 配置管理器 (config-manager.ts)
```typescript
interface ConfigManager {
  loadConfigurations(): Promise<void>;
  generateRoutingTable(): Promise<void>;
  getProviderConfigs(): ProviderConfig[];
  getRoutingConfig(): RoutingConfig;
  watchConfigChanges(callback: () => Promise<void>): void;
}

// 配置文件结构
~/.route-claudecode/config/
├── providers.json          # Provider配置
├── routing.json            # 路由规则
└── generated/              # 动态生成
    └── routing-table.json  # 实际路由表
```

#### 2.2 路由器模块化设计

```typescript
// 路由器由三个独立模块组成
interface RouterSystem {
  inputAnalyzer: InputAnalyzer;      // 输入分析模块
  routingStrategy: RoutingStrategy;  // 策略决策模块  
  outputSelector: OutputSelector;    // 输出选择模块
}

// 1. 输入分析模块
interface InputAnalyzer {
  analyzeRequest(request: RCCRequest): Promise<RequestAnalysis>;
  extractFeatures(request: RCCRequest): RequestFeatures;
  categorizeRequest(features: RequestFeatures): string;
  updateCategorizationRules(rules: CategorizationRule[]): void;
}

interface RequestAnalysis {
  category: string;
  features: RequestFeatures;
  metadata: AnalysisMetadata;
  confidence: number;
}

interface RequestFeatures {
  contentLength: number;
  hasCode: boolean;
  hasTools: boolean;
  language: string;
  keywords: string[];
  complexity: 'low' | 'medium' | 'high';
  urgency: 'low' | 'normal' | 'high';
  domain: string[];  // ['code', 'math', 'creative', 'analysis']
}

// 2. 策略决策模块
interface RoutingStrategy {
  makeRoutingDecision(analysis: RequestAnalysis): Promise<RoutingDecision>;
  evaluateProviders(candidates: ProviderRule[], analysis: RequestAnalysis): Promise<ScoredProvider[]>;
  updateStrategyRules(rules: StrategyRule[]): void;
  getDecisionPath(): DecisionPath[];
}

interface RoutingDecision {
  selectedProvider: ProviderRule;
  alternativeProviders: ProviderRule[];
  decisionReason: string;
  confidence: number;
  decisionPath: DecisionPath[];
}

interface DecisionPath {
  step: string;
  condition: string;
  result: string;
  timestamp: number;
}

// 3. 输出选择模块
interface OutputSelector {
  selectPipeline(decision: RoutingDecision): Promise<Pipeline>;
  validatePipelineAvailability(pipelineId: string): Promise<boolean>;
  handlePipelineUnavailable(pipelineId: string, alternatives: ProviderRule[]): Promise<Pipeline>;
}
```

### 动态分类规则更新系统

```typescript
class DynamicCategorizationSystem {
  private rules: Map<string, CategorizationRule> = new Map();
  private ruleEngine: RuleEngine;
  
  // 动态添加新分类
  async addCategory(category: string, rule: CategorizationRule): Promise<void> {
    this.rules.set(category, rule);
    await this.persistRules();
    await this.reloadRuleEngine();
  }
  
  // 更新现有分类规则
  async updateCategory(category: string, rule: CategorizationRule): Promise<void> {
    if (!this.rules.has(category)) {
      throw new Error(`Category ${category} does not exist`);
    }
    this.rules.set(category, rule);
    await this.persistRules();
    await this.reloadRuleEngine();
  }
  
  // 删除分类
  async removeCategory(category: string): Promise<void> {
    this.rules.delete(category);
    await this.persistRules();
    await this.reloadRuleEngine();
  }
  
  // 从配置文件加载规则
  async loadRulesFromConfig(): Promise<void> {
    const configPath = path.join(this.configDir, 'categorization-rules.json');
    const rulesData = await fs.readFile(configPath, 'utf-8');
    const rulesConfig = JSON.parse(rulesData);
    
    for (const [category, rule] of Object.entries(rulesConfig.rules)) {
      this.rules.set(category, rule as CategorizationRule);
    }
    
    await this.reloadRuleEngine();
  }
}

interface CategorizationRule {
  name: string;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  enabled: boolean;
  version: string;
}

interface RuleCondition {
  field: string;           // 'content', 'length', 'keywords', 'tools'
  operator: string;        // 'contains', 'equals', 'greater_than', 'matches'
  value: any;
  weight: number;
}

interface RuleAction {
  type: 'set_category' | 'add_metadata' | 'set_priority';
  value: any;
}

// 可扩展的分类规则配置
const categorizationRulesConfig = {
  "version": "1.0",
  "rules": {
    "code": {
      "name": "Code Generation",
      "priority": 10,
      "conditions": [
        { "field": "content", "operator": "contains", "value": ["function", "class", "import", "def"], "weight": 0.8 },
        { "field": "content", "operator": "contains", "value": ["```", "code", "programming"], "weight": 0.6 },
        { "field": "tools", "operator": "contains", "value": ["code_execution"], "weight": 0.9 }
      ],
      "actions": [
        { "type": "set_category", "value": "code" },
        { "type": "add_metadata", "value": { "domain": "programming" } }
      ],
      "enabled": true,
      "version": "1.0"
    },
    "math": {
      "name": "Mathematical Analysis", 
      "priority": 9,
      "conditions": [
        { "field": "content", "operator": "contains", "value": ["calculate", "equation", "formula"], "weight": 0.7 },
        { "field": "content", "operator": "matches", "value": "\\d+[+\\-*/]\\d+", "weight": 0.8 },
        { "field": "tools", "operator": "contains", "value": ["calculator"], "weight": 0.9 }
      ],
      "actions": [
        { "type": "set_category", "value": "math" }
      ],
      "enabled": true,
      "version": "1.0"
    },
    "creative": {
      "name": "Creative Writing",
      "priority": 5,
      "conditions": [
        { "field": "content", "operator": "contains", "value": ["story", "poem", "creative", "imagine"], "weight": 0.6 },
        { "field": "length", "operator": "greater_than", "value": 500, "weight": 0.3 }
      ],
      "actions": [
        { "type": "set_category", "value": "creative" }
      ],
      "enabled": true,
      "version": "1.0"
    }
  }
};
```

### 流水线可视化系统

```typescript
class PipelineVisualizationSystem {
  private traceCollector: TraceCollector;
  private visualizationGenerator: VisualizationGenerator;
  
  // 开始追踪请求
  async startTracing(requestId: string): Promise<void> {
    await this.traceCollector.initializeTrace(requestId);
  }
  
  // 记录流水线步骤
  async recordStep(requestId: string, step: PipelineStep): Promise<void> {
    await this.traceCollector.recordStep(requestId, step);
  }
  
  // 生成可视化HTML
  async generateVisualization(requestId: string): Promise<string> {
    const trace = await this.traceCollector.getTrace(requestId);
    return await this.visualizationGenerator.generateHTML(trace);
  }
  
  // 获取实时流水线状态
  async getLiveVisualization(requestId: string): Promise<LiveVisualization> {
    const trace = await this.traceCollector.getTrace(requestId);
    return {
      requestId,
      currentStep: trace.currentStep,
      completedSteps: trace.completedSteps,
      totalSteps: trace.totalSteps,
      elapsedTime: Date.now() - trace.startTime,
      visualization: await this.generateVisualization(requestId)
    };
  }
}

interface PipelineStep {
  stepId: string;
  stepName: string;
  module: string;
  startTime: number;
  endTime?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input?: any;
  output?: any;
  error?: RCCError;
  metadata: StepMetadata;
}

interface StepMetadata {
  provider?: string;
  model?: string;
  processingTime?: number;
  tokenCount?: number;
  retryCount?: number;
  decisionReason?: string;
}

interface PipelineTrace {
  requestId: string;
  startTime: number;
  endTime?: number;
  status: 'running' | 'completed' | 'failed';
  steps: PipelineStep[];
  currentStep?: string;
  completedSteps: number;
  totalSteps: number;
  metadata: TraceMetadata;
}

interface TraceMetadata {
  category: string;
  selectedProvider: string;
  selectedModel: string;
  routingDecision: RoutingDecision;
  totalProcessingTime?: number;
  totalTokens?: number;
}

// HTML可视化生成器
class VisualizationGenerator {
  async generateHTML(trace: PipelineTrace): Promise<string> {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Pipeline Visualization - ${trace.requestId}</title>
    <style>
        ${this.getCSS()}
    </style>
    <script src="https://d3js.org/d3.v7.min.js"></script>
</head>
<body>
    <div class="container">
        <h1>Pipeline Flow Visualization</h1>
        <div class="request-info">
            <h2>Request: ${trace.requestId}</h2>
            <p>Category: ${trace.metadata.category}</p>
            <p>Provider: ${trace.metadata.selectedProvider}</p>
            <p>Model: ${trace.metadata.selectedModel}</p>
            <p>Status: ${trace.status}</p>
            <p>Processing Time: ${trace.metadata.totalProcessingTime || 'In Progress'}ms</p>
        </div>
        
        <div class="pipeline-flow">
            ${this.generateFlowDiagram(trace)}
        </div>
        
        <div class="step-details">
            ${this.generateStepDetails(trace.steps)}
        </div>
        
        <div class="routing-decision">
            <h3>Routing Decision Path</h3>
            ${this.generateDecisionPath(trace.metadata.routingDecision)}
        </div>
    </div>
    
    <script>
        ${this.getJavaScript(trace)}
    </script>
</body>
</html>`;
    
    return html;
  }
  
  private generateFlowDiagram(trace: PipelineTrace): string {
    const steps = trace.steps;
    let diagram = '<div class="flow-diagram">';
    
    steps.forEach((step, index) => {
      const statusClass = this.getStatusClass(step.status);
      const isActive = step.status === 'running';
      
      diagram += `
        <div class="step ${statusClass} ${isActive ? 'active' : ''}" data-step="${step.stepId}">
          <div class="step-header">
            <span class="step-number">${index + 1}</span>
            <span class="step-name">${step.stepName}</span>
            <span class="step-status">${step.status}</span>
          </div>
          <div class="step-module">${step.module}</div>
          ${step.metadata.provider ? `<div class="step-provider">${step.metadata.provider}/${step.metadata.model}</div>` : ''}
          ${step.metadata.processingTime ? `<div class="step-time">${step.metadata.processingTime}ms</div>` : ''}
        </div>`;
      
      if (index < steps.length - 1) {
        diagram += '<div class="arrow">→</div>';
      }
    });
    
    diagram += '</div>';
    return diagram;
  }
  
  private generateStepDetails(steps: PipelineStep[]): string {
    let details = '<h3>Step Details</h3>';
    
    steps.forEach(step => {
      details += `
        <div class="step-detail" id="detail-${step.stepId}">
          <h4>${step.stepName} (${step.module})</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <label>Status:</label>
              <span class="${this.getStatusClass(step.status)}">${step.status}</span>
            </div>
            <div class="detail-item">
              <label>Start Time:</label>
              <span>${new Date(step.startTime).toLocaleTimeString()}</span>
            </div>
            ${step.endTime ? `
            <div class="detail-item">
              <label>End Time:</label>
              <span>${new Date(step.endTime).toLocaleTimeString()}</span>
            </div>
            <div class="detail-item">
              <label>Duration:</label>
              <span>${step.endTime - step.startTime}ms</span>
            </div>` : ''}
            ${step.metadata.tokenCount ? `
            <div class="detail-item">
              <label>Tokens:</label>
              <span>${step.metadata.tokenCount}</span>
            </div>` : ''}
            ${step.metadata.retryCount ? `
            <div class="detail-item">
              <label>Retries:</label>
              <span>${step.metadata.retryCount}</span>
            </div>` : ''}
          </div>
          ${step.error ? `
          <div class="error-details">
            <h5>Error Details</h5>
            <pre>${JSON.stringify(step.error, null, 2)}</pre>
          </div>` : ''}
        </div>`;
    });
    
    return details;
  }
  
  private generateDecisionPath(decision: RoutingDecision): string {
    let path = '<div class="decision-path">';
    
    decision.decisionPath.forEach((pathStep, index) => {
      path += `
        <div class="decision-step">
          <div class="decision-number">${index + 1}</div>
          <div class="decision-content">
            <div class="decision-step-name">${pathStep.step}</div>
            <div class="decision-condition">${pathStep.condition}</div>
            <div class="decision-result">${pathStep.result}</div>
          </div>
        </div>`;
      
      if (index < decision.decisionPath.length - 1) {
        path += '<div class="decision-arrow">↓</div>';
      }
    });
    
    path += '</div>';
    return path;
  }
}

// 实时可视化API端点
class VisualizationAPI {
  // GET /api/visualization/:requestId
  async getVisualization(requestId: string): Promise<string> {
    return await this.visualizationSystem.generateVisualization(requestId);
  }
  
  // GET /api/visualization/:requestId/live
  async getLiveVisualization(requestId: string): Promise<LiveVisualization> {
    return await this.visualizationSystem.getLiveVisualization(requestId);
  }
  
  // WebSocket endpoint for real-time updates
  setupWebSocket(): void {
    this.wsServer.on('connection', (ws) => {
      ws.on('message', (message) => {
        const { requestId } = JSON.parse(message);
        
        // 订阅实时更新
        this.subscribeToUpdates(requestId, (update) => {
          ws.send(JSON.stringify(update));
        });
      });
    });
  }
}

interface LiveVisualization {
  requestId: string;
  currentStep: string;
  completedSteps: number;
  totalSteps: number;
  elapsedTime: number;
  visualization: string;
}
```

### Web管理界面设计

#### 1. 路由管理Web服务器
```typescript
class RouterManagementServer {
  private app: Express;
  private routerManager: RouterManager;
  private statisticsCollector: StatisticsCollector;
  private configManager: ConfigManager;
  
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }
  
  private setupRoutes(): void {
    // 静态文件服务
    this.app.use('/static', express.static(path.join(__dirname, 'web-ui')));
    
    // 主管理页面
    this.app.get('/', this.renderDashboard.bind(this));
    this.app.get('/routing', this.renderRoutingManagement.bind(this));
    this.app.get('/statistics', this.renderStatistics.bind(this));
    this.app.get('/visualization', this.renderVisualization.bind(this));
    
    // API端点
    this.setupAPIRoutes();
  }
  
  private setupAPIRoutes(): void {
    const router = express.Router();
    
    // 配置管理API
    router.get('/api/config/providers', this.getProviders.bind(this));
    router.post('/api/config/providers', this.updateProviders.bind(this));
    router.get('/api/config/routing', this.getRoutingRules.bind(this));
    router.post('/api/config/routing', this.updateRoutingRules.bind(this));
    
    // 实时状态API
    router.get('/api/status/pipelines', this.getPipelineStatus.bind(this));
    router.post('/api/control/pipeline/:id/enable', this.enablePipeline.bind(this));
    router.post('/api/control/pipeline/:id/disable', this.disablePipeline.bind(this));
    
    // 统计数据API
    router.get('/api/statistics/categories', this.getCategoryStatistics.bind(this));
    router.get('/api/statistics/providers', this.getProviderStatistics.bind(this));
    router.get('/api/statistics/errors', this.getErrorStatistics.bind(this));
    router.get('/api/statistics/performance', this.getPerformanceStatistics.bind(this));
    
    this.app.use(router);
  }
  
  // 渲染主仪表板
  private async renderDashboard(req: Request, res: Response): Promise<void> {
    const dashboardData = {
      systemStatus: await this.getSystemStatus(),
      recentRequests: await this.statisticsCollector.getRecentRequests(10),
      activeProviders: await this.getActiveProviders(),
      errorSummary: await this.statisticsCollector.getErrorSummary()
    };
    
    res.render('dashboard', dashboardData);
  }
  
  // 渲染路由管理页面
  private async renderRoutingManagement(req: Request, res: Response): Promise<void> {
    const routingData = {
      providers: await this.configManager.getProviderConfigs(),
      routingRules: await this.configManager.getRoutingConfig(),
      pipelineStatus: await this.getPipelineStatusData(),
      categories: await this.getAvailableCategories()
    };
    
    res.render('routing-management', routingData);
  }
}
```

#### 2. 动态配置管理系统
```typescript
class DynamicConfigManager extends ConfigManager {
  private webSocketServer: WebSocketServer;
  
  // 动态更新Provider配置
  async updateProviderConfig(providerName: string, newConfig: ProviderConfig): Promise<void> {
    // 1. 验证配置
    await this.validateProviderConfig(newConfig);
    
    // 2. 更新内存配置
    const currentConfigs = this.getProviderConfigs();
    const updatedConfigs = currentConfigs.map(p => 
      p.name === providerName ? newConfig : p
    );
    
    // 3. 保存到文件
    await this.saveProviderConfigs(updatedConfigs);
    
    // 4. 重新加载配置
    await this.loadConfigurations();
    
    // 5. 更新流水线
    await this.pipelineManager.updateConfiguration(updatedConfigs);
    
    // 6. 通知Web客户端
    this.broadcastConfigUpdate('provider', { provider: providerName, config: newConfig });
  }
  
  // 动态更新路由规则
  async updateRoutingRule(category: string, newRule: RoutingRule): Promise<void> {
    // 1. 验证路由规则
    await this.validateRoutingRule(newRule);
    
    // 2. 更新路由配置
    const currentRouting = this.getRoutingConfig();
    const updatedRules = currentRouting.rules.map(r => 
      r.category === category ? newRule : r
    );
    
    // 3. 保存配置
    await this.saveRoutingConfig({ rules: updatedRules });
    
    // 4. 重新生成路由表
    await this.generateRoutingTable();
    
    // 5. 通知路由器更新
    await this.requestRouter.updateConfiguration({ rules: updatedRules });
    
    // 6. 广播更新
    this.broadcastConfigUpdate('routing', { category, rule: newRule });
  }
  
  // 实时启用/禁用Provider
  async toggleProviderAvailability(providerName: string, modelName: string, available: boolean): Promise<void> {
    const pipelineId = `${providerName}_${modelName}`;
    
    if (available) {
      await this.pipelineManager.enablePipeline(pipelineId);
    } else {
      await this.pipelineManager.disablePipeline(pipelineId);
    }
    
    // 更新配置文件
    await this.updateProviderAvailability(providerName, modelName, available);
    
    // 广播状态变化
    this.broadcastStatusUpdate('pipeline', { 
      pipelineId, 
      provider: providerName, 
      model: modelName, 
      available 
    });
  }
  
  private broadcastConfigUpdate(type: string, data: any): void {
    this.webSocketServer.broadcast({
      type: 'config_update',
      subtype: type,
      data,
      timestamp: Date.now()
    });
  }
}
```

#### 3. 统计数据收集系统
```typescript
class StatisticsCollector {
  private metricsStore: MetricsStore;
  private realTimeMetrics: RealTimeMetrics;
  
  constructor() {
    this.metricsStore = new MetricsStore();
    this.realTimeMetrics = new RealTimeMetrics();
  }
  
  // 记录请求统计
  async recordRequest(request: RCCRequest, category: string, provider: string, model: string): Promise<void> {
    const requestMetric: RequestMetric = {
      requestId: request.id,
      timestamp: Date.now(),
      category,
      provider,
      model,
      contentLength: this.estimateContentLength(request.body),
      hasTools: this.hasTools(request.body)
    };
    
    await this.metricsStore.saveRequestMetric(requestMetric);
    this.realTimeMetrics.incrementRequestCount(category, provider, model);
  }
  
  // 记录响应统计
  async recordResponse(requestId: string, response: RCCResponse, processingTime: number): Promise<void> {
    const responseMetric: ResponseMetric = {
      requestId,
      timestamp: Date.now(),
      status: response.status,
      processingTime,
      tokenCount: this.extractTokenCount(response.body),
      success: response.status < 400
    };
    
    await this.metricsStore.saveResponseMetric(responseMetric);
    
    // 更新实时指标
    const requestMetric = await this.metricsStore.getRequestMetric(requestId);
    if (requestMetric) {
      this.realTimeMetrics.recordResponse(
        requestMetric.category,
        requestMetric.provider,
        requestMetric.model,
        responseMetric.success,
        processingTime
      );
    }
  }
  
  // 记录错误统计
  async recordError(requestId: string, error: RCCError): Promise<void> {
    const errorMetric: ErrorMetric = {
      requestId,
      timestamp: Date.now(),
      errorType: error.type,
      errorModule: error.module,
      errorMessage: error.message,
      errorDetails: error.details
    };
    
    await this.metricsStore.saveErrorMetric(errorMetric);
    
    // 更新实时错误统计
    const requestMetric = await this.metricsStore.getRequestMetric(requestId);
    if (requestMetric) {
      this.realTimeMetrics.recordError(
        requestMetric.category,
        requestMetric.provider,
        requestMetric.model,
        error.type
      );
    }
  }
  
  // 获取分类统计
  async getCategoryStatistics(timeRange: TimeRange): Promise<CategoryStatistics[]> {
    return await this.metricsStore.getCategoryStatistics(timeRange);
  }
  
  // 获取Provider统计
  async getProviderStatistics(timeRange: TimeRange): Promise<ProviderStatistics[]> {
    return await this.metricsStore.getProviderStatistics(timeRange);
  }
  
  // 获取错误统计
  async getErrorStatistics(timeRange: TimeRange): Promise<ErrorStatistics[]> {
    return await this.metricsStore.getErrorStatistics(timeRange);
  }
  
  // 获取性能统计
  async getPerformanceStatistics(timeRange: TimeRange): Promise<PerformanceStatistics> {
    return await this.metricsStore.getPerformanceStatistics(timeRange);
  }
}

interface RequestMetric {
  requestId: string;
  timestamp: number;
  category: string;
  provider: string;
  model: string;
  contentLength: number;
  hasTools: boolean;
}

interface ResponseMetric {
  requestId: string;
  timestamp: number;
  status: number;
  processingTime: number;
  tokenCount: number;
  success: boolean;
}

interface ErrorMetric {
  requestId: string;
  timestamp: number;
  errorType: string;
  errorModule: string;
  errorMessage: string;
  errorDetails: any;
}

interface CategoryStatistics {
  category: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageProcessingTime: number;
  totalTokens: number;
  errorRate: number;
}

interface ProviderStatistics {
  provider: string;
  model: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageProcessingTime: number;
  totalTokens: number;
  errorsByType: Record<string, number>;
  availability: number;
}
```

#### 4. Web UI组件设计
```html
<!-- 路由管理页面模板 -->
<div id="routing-management">
  <!-- Provider配置面板 -->
  <div class="provider-panel">
    <h2>Provider Configuration</h2>
    <div class="provider-list">
      {{#each providers}}
      <div class="provider-card" data-provider="{{name}}">
        <div class="provider-header">
          <h3>{{name}}</h3>
          <div class="provider-status {{#if availability}}active{{else}}inactive{{/if}}">
            {{#if availability}}Active{{else}}Inactive{{/if}}
          </div>
        </div>
        
        <div class="provider-details">
          <div class="detail-row">
            <label>Base URL:</label>
            <input type="text" value="{{baseUrl}}" data-field="baseUrl">
          </div>
          <div class="detail-row">
            <label>Models:</label>
            <div class="model-list">
              {{#each models}}
              <div class="model-item">
                <span>{{this}}</span>
                <button class="toggle-model" data-model="{{this}}">
                  Toggle
                </button>
              </div>
              {{/each}}
            </div>
          </div>
        </div>
        
        <div class="provider-actions">
          <button class="save-provider" data-provider="{{name}}">Save</button>
          <button class="test-provider" data-provider="{{name}}">Test</button>
        </div>
      </div>
      {{/each}}
    </div>
  </div>
  
  <!-- 路由规则面板 -->
  <div class="routing-panel">
    <h2>Routing Rules</h2>
    <div class="routing-rules">
      {{#each routingRules}}
      <div class="rule-card" data-category="{{category}}">
        <div class="rule-header">
          <h3>{{category}}</h3>
          <button class="edit-rule">Edit</button>
        </div>
        
        <div class="rule-providers">
          {{#each providers}}
          <div class="provider-rule">
            <span>{{provider}}/{{model}}</span>
            <span class="weight">Weight: {{weight}}</span>
            <input type="range" min="0" max="1" step="0.1" value="{{weight}}" 
                   data-provider="{{provider}}" data-model="{{model}}">
          </div>
          {{/each}}
        </div>
      </div>
      {{/each}}
    </div>
  </div>
</div>

<!-- 统计仪表板 -->
<div id="statistics-dashboard">
  <div class="stats-grid">
    <!-- 分类统计 -->
    <div class="stats-card">
      <h3>Category Statistics</h3>
      <canvas id="category-chart"></canvas>
      <div class="stats-table">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Requests</th>
              <th>Success Rate</th>
              <th>Avg Time</th>
            </tr>
          </thead>
          <tbody id="category-stats-body">
            <!-- 动态填充 -->
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- Provider统计 -->
    <div class="stats-card">
      <h3>Provider Performance</h3>
      <canvas id="provider-chart"></canvas>
      <div class="provider-metrics">
        <!-- 动态填充 -->
      </div>
    </div>
    
    <!-- 错误统计 -->
    <div class="stats-card">
      <h3>Error Analysis</h3>
      <canvas id="error-chart"></canvas>
      <div class="error-breakdown">
        <!-- 动态填充 -->
      </div>
    </div>
  </div>
</div>
```

#### 5. 实时更新JavaScript
```javascript
class RouterManagementUI {
  constructor() {
    this.websocket = new WebSocket(`ws://${location.host}/ws`);
    this.setupWebSocket();
    this.setupEventHandlers();
    this.loadInitialData();
  }
  
  setupWebSocket() {
    this.websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleRealtimeUpdate(message);
    };
  }
  
  handleRealtimeUpdate(message) {
    switch (message.type) {
      case 'config_update':
        this.updateConfigUI(message.subtype, message.data);
        break;
      case 'status_update':
        this.updateStatusUI(message.subtype, message.data);
        break;
      case 'statistics_update':
        this.updateStatisticsUI(message.data);
        break;
    }
  }
  
  // 保存Provider配置
  async saveProviderConfig(providerName) {
    const providerCard = document.querySelector(`[data-provider="${providerName}"]`);
    const config = this.extractProviderConfig(providerCard);
    
    try {
      const response = await fetch('/api/config/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerName, config })
      });
      
      if (response.ok) {
        this.showNotification('Provider configuration saved successfully', 'success');
      } else {
        throw new Error('Failed to save configuration');
      }
    } catch (error) {
      this.showNotification('Failed to save provider configuration', 'error');
    }
  }
  
  // 更新路由权重
  async updateRoutingWeight(category, provider, model, weight) {
    try {
      const response = await fetch('/api/config/routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          provider,
          model,
          weight: parseFloat(weight)
        })
      });
      
      if (response.ok) {
        this.showNotification('Routing weight updated', 'success');
      }
    } catch (error) {
      this.showNotification('Failed to update routing weight', 'error');
    }
  }
  
  // 加载统计数据
  async loadStatistics(timeRange = '1h') {
    try {
      const [categories, providers, errors, performance] = await Promise.all([
        fetch(`/api/statistics/categories?range=${timeRange}`).then(r => r.json()),
        fetch(`/api/statistics/providers?range=${timeRange}`).then(r => r.json()),
        fetch(`/api/statistics/errors?range=${timeRange}`).then(r => r.json()),
        fetch(`/api/statistics/performance?range=${timeRange}`).then(r => r.json())
      ]);
      
      this.updateCategoryChart(categories);
      this.updateProviderChart(providers);
      this.updateErrorChart(errors);
      this.updatePerformanceMetrics(performance);
      
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  }
}

// 初始化UI
document.addEventListener('DOMContentLoaded', () => {
  window.routerUI = new RouterManagementUI();
});
```

### 使用示例

```typescript
// 1. 启动Web管理服务器
const managementServer = new RouterManagementServer();
await managementServer.start(8080);

// 2. 动态更新Provider配置
await configManager.updateProviderConfig('openai', {
  name: 'openai',
  protocol: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'new-api-key',
  models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'],
  availability: true
});

// 3. 实时切换Provider可用性
await configManager.toggleProviderAvailability('openai', 'gpt-4', false);

// 4. 获取统计数据
const stats = await statisticsCollector.getCategoryStatistics({ 
  start: Date.now() - 3600000, // 1小时前
  end: Date.now() 
});
```

### 流控系统设计

#### 1. 请求顺序控制系统
```typescript
class RequestFlowController {
  private requestQueue: RequestQueue;
  private responseBuffer: ResponseBuffer;
  private orderingEnabled: boolean = false;
  private timeoutManager: TimeoutManager;
  
  constructor(config: FlowControlConfig) {
    this.requestQueue = new RequestQueue(config.queueConfig);
    this.responseBuffer = new ResponseBuffer(config.bufferConfig);
    this.timeoutManager = new TimeoutManager(config.timeoutConfig);
    this.orderingEnabled = config.enableOrdering;
  }
  
  // 请求入队
  async enqueueRequest(request: RCCRequest): Promise<void> {
    if (!this.orderingEnabled) {
      // 流控关闭，直接处理
      return this.processRequestDirectly(request);
    }
    
    // 分配序列号
    const sequenceNumber = this.requestQueue.getNextSequence();
    const orderedRequest: OrderedRequest = {
      ...request,
      sequenceNumber,
      enqueuedAt: Date.now()
    };
    
    await this.requestQueue.enqueue(orderedRequest);
    
    // 设置超时处理
    this.timeoutManager.setRequestTimeout(request.id, orderedRequest.sequenceNumber);
  }
  
  // 响应排序处理
  async handleResponse(requestId: string, response: RCCResponse): Promise<void> {
    if (!this.orderingEnabled) {
      // 流控关闭，直接返回
      return this.sendResponseDirectly(response);
    }
    
    const request = await this.requestQueue.getRequestById(requestId);
    if (!request) {
      throw new Error(`Request ${requestId} not found in queue`);
    }
    
    // 将响应放入缓冲区
    await this.responseBuffer.bufferResponse(request.sequenceNumber, response);
    
    // 尝试按顺序发送响应
    await this.tryFlushResponses();
  }
  
  // 处理请求失败
  async handleRequestFailure(requestId: string, error: RCCError): Promise<void> {
    const request = await this.requestQueue.getRequestById(requestId);
    if (!request) return;
    
    // 创建错误响应
    const errorResponse: RCCResponse = {
      id: requestId,
      timestamp: Date.now(),
      status: 500,
      body: { error },
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (this.orderingEnabled) {
      await this.responseBuffer.bufferResponse(request.sequenceNumber, errorResponse);
      await this.tryFlushResponses();
    } else {
      await this.sendResponseDirectly(errorResponse);
    }
    
    // 清理超时
    this.timeoutManager.clearRequestTimeout(requestId);
  }
  
  // 按顺序刷新响应
  private async tryFlushResponses(): Promise<void> {
    const nextSequence = this.responseBuffer.getNextExpectedSequence();
    const bufferedResponses = this.responseBuffer.getConsecutiveResponses(nextSequence);
    
    for (const response of bufferedResponses) {
      await this.sendResponseDirectly(response.response);
      this.responseBuffer.removeResponse(response.sequenceNumber);
      this.requestQueue.markCompleted(response.sequenceNumber);
    }
  }
}

interface OrderedRequest extends RCCRequest {
  sequenceNumber: number;
  enqueuedAt: number;
}

interface BufferedResponse {
  sequenceNumber: number;
  response: RCCResponse;
  bufferedAt: number;
}

interface FlowControlConfig {
  enableOrdering: boolean;
  queueConfig: QueueConfig;
  bufferConfig: BufferConfig;
  timeoutConfig: TimeoutConfig;
}
```

#### 2. 请求队列管理
```typescript
class RequestQueue {
  private queue: Map<number, OrderedRequest> = new Map();
  private sequenceCounter: number = 0;
  private completedSequences: Set<number> = new Set();
  private maxQueueSize: number;
  
  constructor(config: QueueConfig) {
    this.maxQueueSize = config.maxSize;
  }
  
  getNextSequence(): number {
    return ++this.sequenceCounter;
  }
  
  async enqueue(request: OrderedRequest): Promise<void> {
    if (this.queue.size >= this.maxQueueSize) {
      throw new Error('Request queue is full');
    }
    
    this.queue.set(request.sequenceNumber, request);
  }
  
  async getRequestById(requestId: string): Promise<OrderedRequest | null> {
    for (const request of this.queue.values()) {
      if (request.id === requestId) {
        return request;
      }
    }
    return null;
  }
  
  markCompleted(sequenceNumber: number): void {
    this.queue.delete(sequenceNumber);
    this.completedSequences.add(sequenceNumber);
    
    // 清理旧的完成记录
    this.cleanupCompletedSequences();
  }
  
  private cleanupCompletedSequences(): void {
    const cutoff = this.sequenceCounter - 1000; // 保留最近1000个
    for (const seq of this.completedSequences) {
      if (seq < cutoff) {
        this.completedSequences.delete(seq);
      }
    }
  }
}

interface QueueConfig {
  maxSize: number;
  cleanupInterval: number;
}
```

#### 3. 响应缓冲区
```typescript
class ResponseBuffer {
  private buffer: Map<number, BufferedResponse> = new Map();
  private nextExpectedSequence: number = 1;
  private maxBufferSize: number;
  private maxWaitTime: number;
  
  constructor(config: BufferConfig) {
    this.maxBufferSize = config.maxSize;
    this.maxWaitTime = config.maxWaitTime;
  }
  
  async bufferResponse(sequenceNumber: number, response: RCCResponse): Promise<void> {
    if (this.buffer.size >= this.maxBufferSize) {
      // 缓冲区满，强制刷新最旧的响应
      await this.forceFlushOldest();
    }
    
    const bufferedResponse: BufferedResponse = {
      sequenceNumber,
      response,
      bufferedAt: Date.now()
    };
    
    this.buffer.set(sequenceNumber, bufferedResponse);
  }
  
  getNextExpectedSequence(): number {
    return this.nextExpectedSequence;
  }
  
  getConsecutiveResponses(startSequence: number): BufferedResponse[] {
    const consecutive: BufferedResponse[] = [];
    let currentSequence = startSequence;
    
    while (this.buffer.has(currentSequence)) {
      consecutive.push(this.buffer.get(currentSequence)!);
      currentSequence++;
    }
    
    return consecutive;
  }
  
  removeResponse(sequenceNumber: number): void {
    this.buffer.delete(sequenceNumber);
    if (sequenceNumber === this.nextExpectedSequence) {
      this.nextExpectedSequence++;
    }
  }
  
  private async forceFlushOldest(): Promise<void> {
    // 找到最旧的响应并强制发送
    let oldestSequence = Number.MAX_SAFE_INTEGER;
    let oldestTime = Date.now();
    
    for (const [seq, buffered] of this.buffer) {
      if (buffered.bufferedAt < oldestTime) {
        oldestTime = buffered.bufferedAt;
        oldestSequence = seq;
      }
    }
    
    if (oldestSequence !== Number.MAX_SAFE_INTEGER) {
      const oldestResponse = this.buffer.get(oldestSequence)!;
      await this.sendResponseDirectly(oldestResponse.response);
      this.removeResponse(oldestSequence);
    }
  }
}

interface BufferConfig {
  maxSize: number;
  maxWaitTime: number; // 最大等待时间(毫秒)
}
```

#### 4. 超时管理器
```typescript
class TimeoutManager {
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  private sequenceTimeouts: Map<number, NodeJS.Timeout> = new Map();
  private defaultTimeout: number;
  private onTimeout: (requestId: string, sequenceNumber: number) => Promise<void>;
  
  constructor(config: TimeoutConfig) {
    this.defaultTimeout = config.defaultTimeout;
    this.onTimeout = config.onTimeout;
  }
  
  setRequestTimeout(requestId: string, sequenceNumber: number): void {
    // 清理现有超时
    this.clearRequestTimeout(requestId);
    
    const timeout = setTimeout(async () => {
      await this.handleTimeout(requestId, sequenceNumber);
    }, this.defaultTimeout);
    
    this.timeouts.set(requestId, timeout);
    this.sequenceTimeouts.set(sequenceNumber, timeout);
  }
  
  clearRequestTimeout(requestId: string): void {
    const timeout = this.timeouts.get(requestId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(requestId);
    }
  }
  
  private async handleTimeout(requestId: string, sequenceNumber: number): Promise<void> {
    console.warn(`Request ${requestId} (sequence ${sequenceNumber}) timed out`);
    
    // 创建超时错误响应
    const timeoutError: RCCError = {
      id: Date.now().toString(),
      type: ErrorType.PIPELINE_ERROR,
      module: 'flow-controller',
      message: 'Request processing timeout',
      details: { requestId, sequenceNumber, timeout: this.defaultTimeout },
      timestamp: Date.now()
    };
    
    await this.onTimeout(requestId, sequenceNumber);
    
    // 清理
    this.timeouts.delete(requestId);
    this.sequenceTimeouts.delete(sequenceNumber);
  }
}

interface TimeoutConfig {
  defaultTimeout: number; // 默认超时时间(毫秒)
  onTimeout: (requestId: string, sequenceNumber: number) => Promise<void>;
}
```

#### 5. 流控配置和控制
```typescript
// 流控配置
const flowControlConfig: FlowControlConfig = {
  enableOrdering: false, // 默认关闭
  queueConfig: {
    maxSize: 1000,
    cleanupInterval: 60000 // 1分钟清理一次
  },
  bufferConfig: {
    maxSize: 100,
    maxWaitTime: 30000 // 最大等待30秒
  },
  timeoutConfig: {
    defaultTimeout: 60000, // 60秒超时
    onTimeout: async (requestId, sequenceNumber) => {
      await flowController.handleRequestFailure(requestId, timeoutError);
    }
  }
};

// 动态控制流控
class FlowControlManager {
  private flowController: RequestFlowController;
  
  // 启用流控
  async enableOrdering(): Promise<void> {
    this.flowController.setOrderingEnabled(true);
    console.log('Request ordering enabled');
  }
  
  // 禁用流控
  async disableOrdering(): Promise<void> {
    this.flowController.setOrderingEnabled(false);
    console.log('Request ordering disabled');
  }
  
  // 获取流控状态
  getFlowControlStatus(): FlowControlStatus {
    return {
      orderingEnabled: this.flowController.isOrderingEnabled(),
      queueSize: this.flowController.getQueueSize(),
      bufferSize: this.flowController.getBufferSize(),
      pendingRequests: this.flowController.getPendingRequests(),
      averageWaitTime: this.flowController.getAverageWaitTime()
    };
  }
  
  // 强制刷新所有缓冲响应
  async forceFlushAll(): Promise<void> {
    await this.flowController.forceFlushAllResponses();
  }
}

interface FlowControlStatus {
  orderingEnabled: boolean;
  queueSize: number;
  bufferSize: number;
  pendingRequests: number;
  averageWaitTime: number;
}
```

#### 6. 集成到路由器系统
```typescript
class EnhancedRouterManager extends RouterManager {
  private flowController: RequestFlowController;
  
  constructor(config: RouterConfig) {
    super(config);
    this.flowController = new RequestFlowController(config.flowControl);
  }
  
  public async processRequest(request: RCCRequest): Promise<RCCResponse> {
    // 1. 请求入队（如果启用流控）
    await this.flowController.enqueueRequest(request);
    
    try {
      // 2. 正常处理请求
      const response = await super.processRequest(request);
      
      // 3. 响应排序处理
      await this.flowController.handleResponse(request.id, response);
      
      return response;
      
    } catch (error) {
      // 4. 处理请求失败
      const rccError = this.createError('PIPELINE_ERROR', '请求处理失败', error, request.id);
      await this.flowController.handleRequestFailure(request.id, rccError);
      throw rccError;
    }
  }
}
```

#### 7. 流控API端点
```typescript
// 流控管理API
class FlowControlAPI {
  // GET /api/flow-control/status
  async getStatus(): Promise<FlowControlStatus> {
    return this.flowControlManager.getFlowControlStatus();
  }
  
  // POST /api/flow-control/enable
  async enableOrdering(): Promise<{ success: boolean }> {
    await this.flowControlManager.enableOrdering();
    return { success: true };
  }
  
  // POST /api/flow-control/disable  
  async disableOrdering(): Promise<{ success: boolean }> {
    await this.flowControlManager.disableOrdering();
    return { success: true };
  }
  
  // POST /api/flow-control/flush
  async forceFlush(): Promise<{ success: boolean, flushedCount: number }> {
    const flushedCount = await this.flowControlManager.forceFlushAll();
    return { success: true, flushedCount };
  }
}
```

### 负载均衡设计

#### 1. 负载均衡器架构
```typescript
interface LoadBalancer {
  // 核心负载均衡接口
  selectPipeline(availablePipelines: Pipeline[], strategy: LoadBalanceStrategy): Pipeline;
  
  // 单Provider多Key处理
  selectApiKey(provider: string, model: string): ApiKeyInfo;
  rotateApiKey(provider: string, model: string, failedKey: string): ApiKeyInfo;
  
  // 多Provider处理
  selectProvider(providers: ProviderRule[], request: RCCRequest): ProviderRule;
  
  // 失效处理
  markPipelineUnavailable(pipelineId: string, reason: string, duration?: number): void;
  checkPipelineHealth(pipelineId: string): Promise<HealthStatus>;
  
  // 负载均衡策略
  weightedRoundRobin(pipelines: Pipeline[]): Pipeline;
  leastConnections(pipelines: Pipeline[]): Pipeline;
  responseTimeBased(pipelines: Pipeline[]): Pipeline;
  healthAware(pipelines: Pipeline[]): Pipeline;
}

// 负载均衡策略
enum LoadBalanceStrategy {
  WEIGHTED_ROUND_ROBIN = 'weighted_round_robin',
  LEAST_CONNECTIONS = 'least_connections',
  RESPONSE_TIME_BASED = 'response_time_based',
  HEALTH_AWARE = 'health_aware',
  RANDOM_WEIGHTED = 'random_weighted'
}

// API密钥信息
interface ApiKeyInfo {
  keyId: string;
  key: string;
  provider: string;
  model?: string;
  usage: KeyUsageInfo;
  status: KeyStatus;
  rateLimits: RateLimitInfo;
}

interface KeyUsageInfo {
  requestCount: number;
  tokenCount: number;
  errorCount: number;
  lastUsed: number;
  dailyUsage: number;
  monthlyUsage: number;
}

enum KeyStatus {
  ACTIVE = 'active',
  RATE_LIMITED = 'rate_limited',
  QUOTA_EXCEEDED = 'quota_exceeded',
  INVALID = 'invalid',
  SUSPENDED = 'suspended'
}

interface RateLimitInfo {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  tokensPerMinute: number;
  tokensPerDay: number;
  resetTime: number;
}
```

#### 2. 单Provider多Key处理
```typescript
class SingleProviderMultiKeyBalancer {
  private keyPools: Map<string, ApiKeyPool> = new Map();
  
  constructor() {
    // 为每个provider.model组合创建密钥池
  }
  
  async selectApiKey(provider: string, model: string): Promise<ApiKeyInfo> {
    const poolKey = `${provider}_${model}`;
    const keyPool = this.keyPools.get(poolKey);
    
    if (!keyPool) {
      throw new Error(`No API key pool found for ${provider}/${model}`);
    }
    
    // 1. 过滤可用的密钥
    const availableKeys = keyPool.keys.filter(key => 
      key.status === KeyStatus.ACTIVE && 
      !this.isRateLimited(key) &&
      !this.isQuotaExceeded(key)
    );
    
    if (availableKeys.length === 0) {
      throw new Error(`No available API keys for ${provider}/${model}`);
    }
    
    // 2. 根据负载均衡策略选择密钥
    return this.selectKeyByStrategy(availableKeys, keyPool.strategy);
  }
  
  private selectKeyByStrategy(keys: ApiKeyInfo[], strategy: KeySelectionStrategy): ApiKeyInfo {
    switch (strategy) {
      case KeySelectionStrategy.ROUND_ROBIN:
        return this.roundRobinSelection(keys);
      
      case KeySelectionStrategy.LEAST_USED:
        return keys.reduce((least, current) => 
          current.usage.requestCount < least.usage.requestCount ? current : least
        );
      
      case KeySelectionStrategy.QUOTA_AWARE:
        return keys.reduce((best, current) => {
          const bestQuotaUsage = this.calculateQuotaUsage(best);
          const currentQuotaUsage = this.calculateQuotaUsage(current);
          return currentQuotaUsage < bestQuotaUsage ? current : best;
        });
      
      case KeySelectionStrategy.ERROR_RATE_AWARE:
        return keys.reduce((best, current) => {
          const bestErrorRate = best.usage.errorCount / best.usage.requestCount;
          const currentErrorRate = current.usage.errorCount / current.usage.requestCount;
          return currentErrorRate < bestErrorRate ? current : best;
        });
      
      default:
        return keys[Math.floor(Math.random() * keys.length)];
    }
  }
  
  async rotateApiKey(provider: string, model: string, failedKey: string): Promise<ApiKeyInfo> {
    // 1. 标记失败的密钥
    await this.markKeyFailed(provider, model, failedKey);
    
    // 2. 选择新的密钥
    return await this.selectApiKey(provider, model);
  }
}

enum KeySelectionStrategy {
  ROUND_ROBIN = 'round_robin',
  LEAST_USED = 'least_used',
  QUOTA_AWARE = 'quota_aware',
  ERROR_RATE_AWARE = 'error_rate_aware',
  RANDOM = 'random'
}

interface ApiKeyPool {
  provider: string;
  model: string;
  keys: ApiKeyInfo[];
  strategy: KeySelectionStrategy;
  healthCheck: boolean;
  rotationPolicy: RotationPolicy;
}

interface RotationPolicy {
  rotateOnError: boolean;
  rotateOnRateLimit: boolean;
  rotateOnQuotaExceeded: boolean;
  cooldownPeriod: number; // 密钥冷却时间(秒)
}
```

#### 3. 多Provider处理
```typescript
class MultiProviderBalancer {
  async selectProvider(providers: ProviderRule[], request: RCCRequest): Promise<ProviderRule> {
    // 1. 过滤可用的Provider
    const availableProviders = await this.filterAvailableProviders(providers);
    
    if (availableProviders.length === 0) {
      throw new Error('No available providers');
    }
    
    // 2. 根据请求特征选择Provider
    const scoredProviders = await this.scoreProviders(availableProviders, request);
    
    // 3. 根据权重和分数选择最佳Provider
    return this.selectBestProvider(scoredProviders);
  }
  
  private async filterAvailableProviders(providers: ProviderRule[]): Promise<ProviderRule[]> {
    const availableProviders: ProviderRule[] = [];
    
    for (const provider of providers) {
      const pipelineId = `${provider.provider}_${provider.model}`;
      const pipeline = await this.pipelineManager.getPipeline(provider.provider, provider.model);
      
      if (pipeline && pipeline.isActive) {
        // 检查健康状态
        const healthStatus = await this.checkProviderHealth(provider);
        if (healthStatus.isHealthy) {
          availableProviders.push(provider);
        }
      }
    }
    
    return availableProviders;
  }
  
  private async scoreProviders(providers: ProviderRule[], request: RCCRequest): Promise<ScoredProvider[]> {
    const scoredProviders: ScoredProvider[] = [];
    
    for (const provider of providers) {
      const score = await this.calculateProviderScore(provider, request);
      scoredProviders.push({ provider, score });
    }
    
    return scoredProviders.sort((a, b) => b.score - a.score);
  }
  
  private async calculateProviderScore(provider: ProviderRule, request: RCCRequest): Promise<number> {
    let score = provider.weight; // 基础权重
    
    // 1. 响应时间因子
    const avgResponseTime = await this.getAverageResponseTime(provider);
    score *= (1000 / (avgResponseTime + 100)); // 响应时间越短分数越高
    
    // 2. 错误率因子
    const errorRate = await this.getErrorRate(provider);
    score *= (1 - errorRate); // 错误率越低分数越高
    
    // 3. 可用性因子
    const availability = await this.getAvailability(provider);
    score *= availability; // 可用性越高分数越高
    
    // 4. 成本因子
    const costFactor = this.getCostFactor(provider);
    score *= costFactor; // 成本越低分数越高
    
    // 5. 特殊能力匹配
    const capabilityScore = this.getCapabilityScore(provider, request);
    score *= capabilityScore;
    
    return score;
  }
  
  private getCapabilityScore(provider: ProviderRule, request: RCCRequest): number {
    let score = 1.0;
    
    // 根据请求类型调整分数
    const requestCategory = this.determineRequestCategory(request);
    
    switch (requestCategory) {
      case 'code':
        // 代码相关请求，CodeWhisperer和专门的代码模型得分更高
        if (provider.provider === 'codewhisperer') score *= 1.5;
        if (provider.model.includes('code')) score *= 1.3;
        break;
        
      case 'longContext':
        // 长上下文请求，支持长上下文的模型得分更高
        if (provider.model.includes('claude')) score *= 1.4;
        if (provider.model.includes('gemini')) score *= 1.3;
        break;
        
      case 'multimodal':
        // 多模态请求，支持图像的模型得分更高
        if (provider.model.includes('vision')) score *= 1.5;
        if (provider.provider === 'gemini') score *= 1.3;
        break;
        
      case 'reasoning':
        // 推理请求，推理能力强的模型得分更高
        if (provider.model.includes('reasoner')) score *= 1.5;
        if (provider.model.includes('o1')) score *= 1.4;
        break;
    }
    
    return score;
  }
}

interface ScoredProvider {
  provider: ProviderRule;
  score: number;
}
```

#### 4. 模型失效处理
```typescript
class ModelFailureHandler {
  private failedPipelines: Map<string, FailureInfo> = new Map();
  private healthCheckInterval: number = 30000; // 30秒
  
  async markPipelineUnavailable(pipelineId: string, reason: string, duration?: number): Promise<void> {
    const failureInfo: FailureInfo = {
      pipelineId,
      reason,
      failedAt: Date.now(),
      recoverAt: duration ? Date.now() + duration * 1000 : undefined,
      retryCount: 0,
      lastRetryAt: 0
    };
    
    this.failedPipelines.set(pipelineId, failureInfo);
    
    // 通知流水线管理器
    await this.pipelineManager.updatePipelineStatus(pipelineId, PipelineStatus.FAILED);
    
    // 启动恢复检查
    this.scheduleRecoveryCheck(pipelineId);
  }
  
  private scheduleRecoveryCheck(pipelineId: string): void {
    setTimeout(async () => {
      await this.attemptRecovery(pipelineId);
    }, this.healthCheckInterval);
  }
  
  private async attemptRecovery(pipelineId: string): Promise<void> {
    const failureInfo = this.failedPipelines.get(pipelineId);
    if (!failureInfo) return;
    
    // 1. 检查是否到了恢复时间
    if (failureInfo.recoverAt && Date.now() < failureInfo.recoverAt) {
      this.scheduleRecoveryCheck(pipelineId);
      return;
    }
    
    // 2. 执行健康检查
    const isHealthy = await this.performHealthCheck(pipelineId);
    
    if (isHealthy) {
      // 恢复成功
      this.failedPipelines.delete(pipelineId);
      await this.pipelineManager.updatePipelineStatus(pipelineId, PipelineStatus.ACTIVE);
      console.log(`Pipeline ${pipelineId} recovered successfully`);
    } else {
      // 恢复失败，增加重试计数
      failureInfo.retryCount++;
      failureInfo.lastRetryAt = Date.now();
      
      // 指数退避
      const backoffDelay = Math.min(this.healthCheckInterval * Math.pow(2, failureInfo.retryCount), 300000); // 最大5分钟
      setTimeout(() => this.attemptRecovery(pipelineId), backoffDelay);
    }
  }
  
  private async performHealthCheck(pipelineId: string): Promise<boolean> {
    try {
      const pipeline = await this.pipelineManager.getPipelineById(pipelineId);
      if (!pipeline) return false;
      
      return await pipeline.validate();
    } catch (error) {
      console.error(`Health check failed for pipeline ${pipelineId}:`, error);
      return false;
    }
  }
  
  // 故障转移逻辑
  async handlePipelineFailure(failedPipelineId: string, request: RCCRequest): Promise<Pipeline> {
    // 1. 标记失败的流水线
    await this.markPipelineUnavailable(failedPipelineId, 'request_failed');
    
    // 2. 寻找备用流水线
    const fallbackPipeline = await this.findFallbackPipeline(failedPipelineId, request);
    
    if (!fallbackPipeline) {
      throw new Error(`No fallback pipeline available for ${failedPipelineId}`);
    }
    
    return fallbackPipeline;
  }
  
  private async findFallbackPipeline(failedPipelineId: string, request: RCCRequest): Promise<Pipeline | null> {
    // 1. 获取相同类别的其他流水线
    const category = this.requestRouter.determineCategory(request);
    const routingRule = await this.configManager.getRoutingRule(category);
    
    if (!routingRule) return null;
    
    // 2. 排除失败的流水线
    const availableProviders = routingRule.providers.filter(p => 
      `${p.provider}_${p.model}` !== failedPipelineId
    );
    
    if (availableProviders.length === 0) return null;
    
    // 3. 选择最佳备用流水线
    const selectedProvider = await this.multiProviderBalancer.selectProvider(availableProviders, request);
    return await this.pipelineManager.getPipeline(selectedProvider.provider, selectedProvider.model);
  }
}

interface FailureInfo {
  pipelineId: string;
  reason: string;
  failedAt: number;
  recoverAt?: number;
  retryCount: number;
  lastRetryAt: number;
}
```

#### 2.3 流水线管理器 (pipeline-manager.ts)
```typescript
interface PipelineManager {
  // 核心管理接口
  initialize(providerConfigs: ProviderConfig[]): Promise<void>;
  createPipeline(provider: string, model: string): Promise<Pipeline>;
  destroyPipeline(pipelineId: string): Promise<void>;
  getPipeline(provider: string, model: string): Promise<Pipeline>;
  
  // 动态注册接口
  registerPipeline(pipeline: Pipeline): void;
  unregisterPipeline(pipelineId: string): void;
  updatePipelineStatus(pipelineId: string, status: PipelineStatus): void;
  
  // 生命周期管理
  monitorAvailability(): void;
  handleConfigChange(newConfigs: ProviderConfig[]): Promise<void>;
  getActivePipelines(): Pipeline[];
  getPipelineStatus(pipelineId: string): PipelineStatus;
  
  // 负载均衡
  selectHealthyPipeline(pipelines: Pipeline[]): Pipeline;
  updatePipelineMetrics(pipelineId: string, metrics: PipelineMetrics): void;
}

// 流水线状态枚举
enum PipelineStatus {
  PENDING = 'pending',
  CREATING = 'creating', 
  ACTIVE = 'active',
  PROCESSING = 'processing',
  INACTIVE = 'inactive',
  FAILED = 'failed',
  RETRY = 'retry',
  DESTROYING = 'destroying',
  DESTROYED = 'destroyed'
}

// 流水线注册表
interface PipelineRegistry {
  pipelines: Map<string, Pipeline>;
  status: Map<string, PipelineStatus>;
  metrics: Map<string, PipelineMetrics>;
  healthStatus: Map<string, HealthStatus>;
}

// 动态注册流程
interface RegistrationProcess {
  1. 配置差异分析: analyzeDifferences(oldConfig, newConfig)
  2. 注册计划生成: generateRegistrationPlan(differences)
  3. 流水线创建: createPipelines(createList)
  4. 流水线销毁: destroyPipelines(destroyList)
  5. 状态同步: syncPipelineStatus()
}
```

### 3. 流水线Worker (src/pipeline/)

#### 3.1 流水线框架 (pipeline-framework.ts)
```typescript
interface PipelineFramework {
  id: string;
  provider: string;
  model: string;
  modules: PipelineModule[];
  
  initialize(): Promise<void>;
  process(input: any): Promise<any>;
  validate(): Promise<boolean>;
  destroy(): Promise<void>;
}

// 处理流程
Input → 数据校验 → Module1 → 校验 → Module2 → 校验 → Module3 → 校验 → Module4 → Output
```

#### 3.2 Transformer模块 (modules/transformer/)
```typescript
interface TransformerModule extends PipelineModule {
  name: 'transformer';
  targetProtocol: string;
  
  transformRequest(anthropicRequest: AnthropicRequest): Promise<ProtocolRequest>;
  transformResponse(protocolResponse: ProtocolResponse): Promise<AnthropicResponse>;
  validateAnthropicRequest(request: AnthropicRequest): boolean;
  validateProtocolResponse(response: ProtocolResponse): boolean;
  
  // 长上下文处理
  handleLongContext(request: AnthropicRequest, maxTokens: number): Promise<AnthropicRequest>;
  compressContext(messages: Message[], strategy: ContextCompressionStrategy): Promise<Message[]>;
  estimateTokenCount(content: string): number;
}

// 支持的转换
- Anthropic → OpenAI
- Anthropic → Gemini  
- Anthropic → Anthropic (直通)

// 长上下文处理策略
enum ContextCompressionStrategy {
  SLIDING_WINDOW = 'sliding_window',           // 滑动窗口
  DYNAMIC_COMPRESSION = 'dynamic_compression', // 动态压缩
  HIERARCHICAL_SUMMARY = 'hierarchical_summary', // 分层摘要
  SMART_TRUNCATION = 'smart_truncation'        // 智能截断
}
```

### 长上下文处理设计

#### 1. 长上下文检测和处理流程
```typescript
class LongContextHandler {
  private tokenEstimator: TokenEstimator;
  private contextCompressor: ContextCompressor;
  private modelCapabilities: Map<string, ModelCapability>;
  
  async handleLongContext(
    request: AnthropicRequest, 
    targetModel: string, 
    maxTokens: number
  ): Promise<AnthropicRequest> {
    
    // 1. 估算当前请求的token数量
    const estimatedTokens = await this.estimateRequestTokens(request);
    
    // 2. 检查是否超出模型限制
    const modelCapability = this.modelCapabilities.get(targetModel);
    const contextLimit = modelCapability?.contextWindow || maxTokens;
    
    if (estimatedTokens <= contextLimit) {
      return request; // 无需处理
    }
    
    // 3. 选择处理策略
    const strategy = await this.selectCompressionStrategy(request, targetModel, estimatedTokens, contextLimit);
    
    // 4. 执行上下文处理
    return await this.executeCompressionStrategy(request, strategy, contextLimit);
  }
  
  private async selectCompressionStrategy(
    request: AnthropicRequest,
    targetModel: string, 
    currentTokens: number,
    contextLimit: number
  ): Promise<ContextProcessingPlan> {
    
    const overflowRatio = currentTokens / contextLimit;
    const hasTools = request.tools && request.tools.length > 0;
    const hasSystemPrompt = request.messages.some(m => m.role === 'system');
    
    // 策略选择逻辑
    if (overflowRatio < 1.5 && !hasTools) {
      // 轻微超出，使用滑动窗口
      return {
        strategy: ContextCompressionStrategy.SLIDING_WINDOW,
        preserveRatio: 0.8,
        preserveSystem: true,
        preserveTools: true
      };
    } else if (overflowRatio < 2.0) {
      // 中等超出，使用智能截断
      return {
        strategy: ContextCompressionStrategy.SMART_TRUNCATION,
        preserveRatio: 0.7,
        preserveSystem: true,
        preserveTools: true,
        preserveRecent: true
      };
    } else {
      // 严重超出，使用动态压缩或切换模型
      const longContextModel = await this.findLongContextModel(targetModel);
      
      if (longContextModel) {
        return {
          strategy: ContextCompressionStrategy.DYNAMIC_COMPRESSION,
          fallbackModel: longContextModel,
          compressionRatio: 0.5
        };
      } else {
        return {
          strategy: ContextCompressionStrategy.HIERARCHICAL_SUMMARY,
          preserveRatio: 0.6,
          summaryRatio: 0.3
        };
      }
    }
  }
}

interface ContextProcessingPlan {
  strategy: ContextCompressionStrategy;
  preserveRatio?: number;        // 保留比例
  preserveSystem?: boolean;      // 保留系统提示词
  preserveTools?: boolean;       // 保留工具定义
  preserveRecent?: boolean;      // 保留最近消息
  compressionRatio?: number;     // 压缩比例
  summaryRatio?: number;         // 摘要比例
  fallbackModel?: string;        // 备用长上下文模型
}

interface ModelCapability {
  contextWindow: number;         // 上下文窗口大小
  supportsLongContext: boolean;  // 是否支持长上下文
  compressionCapable: boolean;   // 是否支持压缩
  costPerToken: number;          // 每token成本
}
```

#### 2. 滑动窗口策略 (Option 1)
```typescript
class SlidingWindowProcessor {
  async process(
    messages: Message[], 
    preserveRatio: number = 0.8,
    preserveSystem: boolean = true,
    preserveTools: boolean = true
  ): Promise<Message[]> {
    
    const processedMessages: Message[] = [];
    
    // 1. 保留系统提示词
    if (preserveSystem) {
      const systemMessages = messages.filter(m => m.role === 'system');
      processedMessages.push(...systemMessages);
    }
    
    // 2. 保留工具定义 (通常在第一条用户消息中)
    if (preserveTools) {
      const toolMessages = messages.filter(m => 
        m.role === 'user' && this.containsToolDefinitions(m)
      );
      processedMessages.push(...toolMessages.slice(0, 1));
    }
    
    // 3. 计算可用于历史对话的token预算
    const reservedTokens = this.estimateTokens(processedMessages);
    const totalBudget = this.calculateTokenBudget(messages, preserveRatio);
    const historyBudget = totalBudget - reservedTokens;
    
    // 4. 从最新消息开始，向前滑动窗口
    const conversationMessages = messages.filter(m => 
      m.role !== 'system' && 
      !(m.role === 'user' && this.containsToolDefinitions(m))
    );
    
    const selectedHistory = await this.selectRecentMessages(
      conversationMessages, 
      historyBudget
    );
    
    // 5. 组合最终消息
    processedMessages.push(...selectedHistory);
    
    return this.sortMessagesByTimestamp(processedMessages);
  }
  
  private async selectRecentMessages(messages: Message[], budget: number): Promise<Message[]> {
    const selected: Message[] = [];
    let currentTokens = 0;
    
    // 从最新消息开始向前选择
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const messageTokens = this.estimateTokens([message]);
      
      if (currentTokens + messageTokens <= budget) {
        selected.unshift(message); // 保持时间顺序
        currentTokens += messageTokens;
      } else {
        break;
      }
    }
    
    return selected;
  }
}
```

#### 3. 动态压缩策略 (Option 2)
```typescript
class DynamicCompressionProcessor {
  private compressionModel: string = 'claude-3-haiku'; // 用于压缩的模型
  
  async process(
    messages: Message[],
    compressionRatio: number = 0.5,
    fallbackModel?: string
  ): Promise<Message[] | ModelSwitchResult> {
    
    // 1. 如果有长上下文模型可用，优先切换模型
    if (fallbackModel) {
      return {
        switchToModel: fallbackModel,
        originalMessages: messages,
        reason: 'long_context_model_available'
      };
    }
    
    // 2. 否则进行动态压缩
    const compressedMessages = await this.compressMessages(messages, compressionRatio);
    return compressedMessages;
  }
  
  private async compressMessages(messages: Message[], ratio: number): Promise<Message[]> {
    // 1. 识别需要压缩的消息段
    const segments = this.segmentMessages(messages);
    
    // 2. 对每个段进行压缩
    const compressedSegments: Message[] = [];
    
    for (const segment of segments) {
      if (segment.shouldCompress) {
        const compressed = await this.compressSegment(segment.messages, ratio);
        compressedSegments.push(compressed);
      } else {
        compressedSegments.push(...segment.messages);
      }
    }
    
    return compressedSegments;
  }
  
  private async compressSegment(messages: Message[], ratio: number): Promise<Message> {
    // 使用压缩模型生成摘要
    const compressionPrompt = this.buildCompressionPrompt(messages, ratio);
    
    const compressionRequest = {
      model: this.compressionModel,
      messages: [
        {
          role: 'system',
          content: 'You are a context compression assistant. Summarize the conversation while preserving key information, decisions, and context needed for future responses.'
        },
        {
          role: 'user', 
          content: compressionPrompt
        }
      ],
      max_tokens: Math.floor(this.estimateTokens(messages) * ratio)
    };
    
    // 调用压缩模型
    const compressionResponse = await this.callCompressionModel(compressionRequest);
    
    return {
      role: 'system',
      content: `[Compressed Context Summary]\n${compressionResponse.content}`,
      metadata: {
        compressed: true,
        originalMessageCount: messages.length,
        compressionRatio: ratio
      }
    };
  }
}

interface ModelSwitchResult {
  switchToModel: string;
  originalMessages: Message[];
  reason: string;
}
```

#### 4. 长上下文处理流水线路径
```typescript
// 在Transformer模块中集成长上下文处理
class EnhancedTransformerModule extends TransformerModule {
  private longContextHandler: LongContextHandler;
  
  async transformRequest(anthropicRequest: AnthropicRequest): Promise<ProtocolRequest> {
    // 1. 获取目标模型信息
    const targetModel = this.getTargetModel();
    const modelCapability = this.getModelCapability(targetModel);
    
    // 2. 检查是否需要长上下文处理
    const processedRequest = await this.longContextHandler.handleLongContext(
      anthropicRequest,
      targetModel,
      modelCapability.contextWindow
    );
    
    // 3. 检查是否需要切换模型
    if (processedRequest.switchToModel) {
      // 通知路由器切换到长上下文模型
      throw new ModelSwitchRequired(processedRequest.switchToModel, processedRequest.originalMessages);
    }
    
    // 4. 继续正常的格式转换
    return await super.transformRequest(processedRequest);
  }
}

// 路由器处理模型切换
class EnhancedRequestRouter extends RequestRouter {
  async route(request: RCCRequest): Promise<Pipeline> {
    try {
      return await super.route(request);
    } catch (error) {
      if (error instanceof ModelSwitchRequired) {
        // 切换到长上下文模型
        const longContextPipeline = await this.findLongContextPipeline(error.targetModel);
        if (longContextPipeline) {
          // 更新请求以使用原始消息
          request.body = { ...request.body, messages: error.originalMessages };
          return longContextPipeline;
        }
      }
      throw error;
    }
  }
  
  private async findLongContextPipeline(preferredModel: string): Promise<Pipeline | null> {
    // 查找支持长上下文的模型
    const longContextModels = [
      'claude-3-sonnet',
      'gemini-2.5-pro', 
      'gpt-4-turbo',
      preferredModel
    ];
    
    for (const model of longContextModels) {
      const pipeline = await this.findPipelineByModel(model);
      if (pipeline && pipeline.isActive) {
        return pipeline;
      }
    }
    
    return null;
  }
}

class ModelSwitchRequired extends Error {
  constructor(
    public targetModel: string,
    public originalMessages: Message[]
  ) {
    super(`Model switch required to ${targetModel} for long context`);
  }
}
```

#### 5. 配置支持
```json
{
  "longContextHandling": {
    "enabled": true,
    "defaultStrategy": "sliding_window",
    "compressionModel": "claude-3-haiku",
    "strategies": {
      "sliding_window": {
        "preserveRatio": 0.8,
        "preserveSystem": true,
        "preserveTools": true
      },
      "dynamic_compression": {
        "compressionRatio": 0.5,
        "enableModelSwitch": true,
        "preferredLongContextModels": [
          "claude-3-sonnet",
          "gemini-2.5-pro",
          "gpt-4-turbo"
        ]
      }
    }
  },
  
  "modelCapabilities": {
    "gpt-4": { "contextWindow": 8192, "supportsLongContext": false },
    "gpt-4-turbo": { "contextWindow": 128000, "supportsLongContext": true },
    "claude-3-sonnet": { "contextWindow": 200000, "supportsLongContext": true },
    "gemini-2.5-pro": { "contextWindow": 1000000, "supportsLongContext": true }
  }
}
```

#### 3.3 Protocol模块 (modules/protocol.ts)
```typescript
interface ProtocolModule extends PipelineModule {
  name: 'protocol';
  protocol: string;
  
  convertToNonStreaming(streamRequest: StreamRequest): Promise<NonStreamRequest>;
  convertToStreaming(nonStreamResponse: NonStreamResponse): Promise<StreamResponse>;
  validateProtocolRequest(request: ProtocolRequest): boolean;
  validateProtocolResponse(response: ProtocolResponse): boolean;
}

// 协议处理
流式请求 → 非流式请求 → 下游处理 → 非流式响应 → 流式响应
```

#### 3.4 Server-Compatibility模块 (modules/server-compatibility.ts)
```typescript
interface ServerCompatibilityModule extends PipelineModule {
  name: 'server-compatibility';
  serverType: string;
  
  adaptRequest(standardRequest: StandardRequest): Promise<ServerRequest>;
  adaptResponse(serverResponse: ServerResponse): Promise<StandardResponse>;
  detectServerFeatures(config: ProviderConfig): Promise<ServerFeatures>;
}

// 基于特征的服务商适配
interface ServerFeatures {
  protocol: 'openai' | 'anthropic' | 'gemini' | 'aws';
  supportsStreaming: boolean;
  supportsTools: boolean;
  toolCallFormat: 'openai' | 'anthropic' | 'custom';
  authMethod: 'bearer' | 'api-key' | 'oauth' | 'aws-iam';
  messageFormat: 'openai' | 'anthropic' | 'gemini' | 'custom';
  specialFeatures: string[];
}

// 特征检测器
class ServerFeatureDetector {
  async detectFeatures(config: ProviderConfig): Promise<ServerFeatures> {
    const features: ServerFeatures = {
      protocol: 'openai', // 默认
      supportsStreaming: true,
      supportsTools: true,
      toolCallFormat: 'openai',
      authMethod: 'bearer',
      messageFormat: 'openai',
      specialFeatures: []
    };
    
    // 基于baseURL特征检测
    const urlFeatures = this.detectFromURL(config.baseUrl);
    Object.assign(features, urlFeatures);
    
    // 基于配置特征检测
    const configFeatures = this.detectFromConfig(config);
    Object.assign(features, configFeatures);
    
    // 运行时特征检测
    const runtimeFeatures = await this.detectFromRuntime(config);
    Object.assign(features, runtimeFeatures);
    
    return features;
  }
  
  private detectFromURL(baseUrl: string): Partial<ServerFeatures> {
    const features: Partial<ServerFeatures> = {};
    
    // OpenAI兼容服务检测
    if (baseUrl.includes('openai.com')) {
      features.protocol = 'openai';
      features.authMethod = 'bearer';
    } else if (baseUrl.includes('deepseek.com')) {
      features.protocol = 'openai';
      features.specialFeatures = ['tool_choice_auto', 'reasoning_mode'];
    } else if (baseUrl.includes('anthropic.com')) {
      features.protocol = 'anthropic';
      features.authMethod = 'api-key';
      features.messageFormat = 'anthropic';
      features.toolCallFormat = 'anthropic';
    } else if (baseUrl.includes('generativelanguage.googleapis.com')) {
      features.protocol = 'gemini';
      features.authMethod = 'api-key';
      features.messageFormat = 'gemini';
    } else if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      // 本地服务，可能是LMStudio、Ollama等
      features.protocol = 'openai'; // 大多数本地服务使用OpenAI兼容接口
      features.authMethod = 'bearer';
      features.specialFeatures = ['local_service'];
    } else if (baseUrl.includes('amazonaws.com') || baseUrl.includes('codewhisperer')) {
      features.protocol = 'aws';
      features.authMethod = 'aws-iam';
      features.messageFormat = 'custom';
    }
    
    return features;
  }
  
  private detectFromConfig(config: ProviderConfig): Partial<ServerFeatures> {
    const features: Partial<ServerFeatures> = {};
    
    // 从配置中检测特征
    if (config.authType) {
      switch (config.authType) {
        case 'oauth2':
          features.authMethod = 'oauth';
          break;
        case 'aws-iam':
          features.authMethod = 'aws-iam';
          break;
        case 'api-key':
          features.authMethod = 'api-key';
          break;
        default:
          features.authMethod = 'bearer';
      }
    }
    
    // 从serverType检测
    if (config.serverType) {
      switch (config.serverType) {
        case 'deepseek':
          features.specialFeatures = ['tool_choice_auto', 'reasoning_mode'];
          break;
        case 'lmstudio':
          features.specialFeatures = ['local_service', 'model_path_support'];
          break;
        case 'ollama':
          features.specialFeatures = ['local_service', 'custom_models'];
          break;
        case 'gemini':
          features.protocol = 'gemini';
          features.messageFormat = 'gemini';
          break;
      }
    }
    
    return features;
  }
  
  private async detectFromRuntime(config: ProviderConfig): Promise<Partial<ServerFeatures>> {
    const features: Partial<ServerFeatures> = {};
    
    try {
      // 发送探测请求检测服务特征
      const probeResponse = await this.sendProbeRequest(config);
      
      // 分析响应头检测特征
      if (probeResponse.headers['x-ratelimit-limit-requests']) {
        features.specialFeatures = [...(features.specialFeatures || []), 'rate_limit_headers'];
      }
      
      if (probeResponse.headers['anthropic-version']) {
        features.protocol = 'anthropic';
      }
      
      // 检测工具调用支持
      const toolSupport = await this.detectToolSupport(config);
      features.supportsTools = toolSupport.supported;
      features.toolCallFormat = toolSupport.format;
      
    } catch (error) {
      // 探测失败，使用默认特征
      console.warn('Runtime feature detection failed, using defaults:', error);
    }
    
    return features;
  }
}
```

### 统一Schema转换设计

#### 1. 统一中间Schema
```typescript
// 统一的中间表示格式
interface UnifiedRequest {
  id: string;
  messages: UnifiedMessage[];
  tools?: UnifiedTool[];
  parameters: UnifiedParameters;
  metadata: RequestMetadata;
}

interface UnifiedMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: UnifiedContent[];
  toolCalls?: UnifiedToolCall[];
  toolResults?: UnifiedToolResult[];
}

interface UnifiedContent {
  type: 'text' | 'image' | 'file' | 'code';
  text?: string;
  imageUrl?: string;
  fileData?: any;
  codeLanguage?: string;
}

interface UnifiedTool {
  name: string;
  description: string;
  parameters: JSONSchema;
  required?: string[];
}

interface UnifiedParameters {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
  stopSequences?: string[];
}

interface RequestMetadata {
  originalFormat: string;
  targetFormat: string;
  features: ServerFeatures;
  transformationHints: TransformationHint[];
}
```

#### 2. 特征驱动的转换器
```typescript
class FeatureDrivenTransformer {
  private converters: Map<string, FormatConverter> = new Map();
  
  constructor() {
    this.registerConverters();
  }
  
  async transform(
    input: any, 
    sourceFormat: string, 
    targetFeatures: ServerFeatures
  ): Promise<any> {
    
    // 1. 转换为统一Schema
    const unifiedRequest = await this.toUnifiedSchema(input, sourceFormat);
    
    // 2. 基于目标特征进行适配
    const adaptedRequest = await this.adaptToFeatures(unifiedRequest, targetFeatures);
    
    // 3. 转换为目标格式
    const targetFormat = this.determineTargetFormat(targetFeatures);
    const finalRequest = await this.fromUnifiedSchema(adaptedRequest, targetFormat);
    
    return finalRequest;
  }
  
  private async toUnifiedSchema(input: any, sourceFormat: string): Promise<UnifiedRequest> {
    const converter = this.converters.get(sourceFormat);
    if (!converter) {
      throw new Error(`No converter found for source format: ${sourceFormat}`);
    }
    
    return await converter.toUnified(input);
  }
  
  private async adaptToFeatures(
    request: UnifiedRequest, 
    features: ServerFeatures
  ): Promise<UnifiedRequest> {
    
    const adapted = { ...request };
    
    // 工具调用格式适配
    if (adapted.tools && features.supportsTools) {
      adapted.tools = await this.adaptToolFormat(adapted.tools, features.toolCallFormat);
    } else if (adapted.tools && !features.supportsTools) {
      // 服务不支持工具调用，转换为文本描述
      adapted.messages = await this.convertToolsToText(adapted.messages, adapted.tools);
      delete adapted.tools;
    }
    
    // 消息格式适配
    adapted.messages = await this.adaptMessageFormat(adapted.messages, features.messageFormat);
    
    // 参数适配
    adapted.parameters = await this.adaptParameters(adapted.parameters, features);
    
    // 特殊特征处理
    if (features.specialFeatures.includes('tool_choice_auto') && adapted.tools) {
      adapted.parameters.toolChoice = 'auto';
    }
    
    if (features.specialFeatures.includes('reasoning_mode')) {
      adapted.parameters.enableReasoning = true;
    }
    
    return adapted;
  }
  
  private async adaptToolFormat(
    tools: UnifiedTool[], 
    format: string
  ): Promise<UnifiedTool[]> {
    
    switch (format) {
      case 'openai':
        return tools.map(tool => ({
          ...tool,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }
        }));
        
      case 'anthropic':
        return tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters
        }));
        
      default:
        return tools;
    }
  }
  
  private async adaptMessageFormat(
    messages: UnifiedMessage[], 
    format: string
  ): Promise<UnifiedMessage[]> {
    
    switch (format) {
      case 'gemini':
        return this.convertToGeminiFormat(messages);
      case 'anthropic':
        return this.convertToAnthropicFormat(messages);
      case 'openai':
      default:
        return this.convertToOpenAIFormat(messages);
    }
  }
  
  private convertToGeminiFormat(messages: UnifiedMessage[]): UnifiedMessage[] {
    return messages.map(msg => ({
      ...msg,
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: msg.content.map(content => ({
        text: content.text || ''
      }))
    }));
  }
  
  private convertToAnthropicFormat(messages: UnifiedMessage[]): UnifiedMessage[] {
    // 处理system消息的特殊格式
    const processedMessages = [];
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        // Anthropic的system消息处理
        processedMessages.push({
          ...msg,
          content: msg.content
        });
      } else {
        processedMessages.push(msg);
      }
    }
    
    return processedMessages;
  }
  
  private convertToOpenAIFormat(messages: UnifiedMessage[]): UnifiedMessage[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content.map(c => c.text).join('\n'),
      tool_calls: msg.toolCalls?.map(tc => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments)
        }
      }))
    }));
  }
}
```

#### 3. 格式转换器注册
```typescript
class FormatConverterRegistry {
  private converters: Map<string, FormatConverter> = new Map();
  
  registerConverter(format: string, converter: FormatConverter): void {
    this.converters.set(format, converter);
  }
  
  getConverter(format: string): FormatConverter | null {
    return this.converters.get(format) || null;
  }
}

// OpenAI格式转换器
class OpenAIFormatConverter implements FormatConverter {
  async toUnified(input: any): Promise<UnifiedRequest> {
    return {
      id: input.id || generateId(),
      messages: input.messages.map(this.convertMessage),
      tools: input.tools?.map(this.convertTool),
      parameters: {
        maxTokens: input.max_tokens,
        temperature: input.temperature,
        topP: input.top_p,
        stream: input.stream,
        stopSequences: input.stop
      },
      metadata: {
        originalFormat: 'openai',
        targetFormat: 'unified',
        features: {} as ServerFeatures,
        transformationHints: []
      }
    };
  }
  
  async fromUnified(unified: UnifiedRequest): Promise<any> {
    return {
      model: unified.metadata.targetModel || 'gpt-3.5-turbo',
      messages: unified.messages.map(this.convertFromUnified),
      tools: unified.tools?.map(this.convertToolFromUnified),
      max_tokens: unified.parameters.maxTokens,
      temperature: unified.parameters.temperature,
      top_p: unified.parameters.topP,
      stream: unified.parameters.stream,
      stop: unified.parameters.stopSequences
    };
  }
}

// Anthropic格式转换器
class AnthropicFormatConverter implements FormatConverter {
  async toUnified(input: any): Promise<UnifiedRequest> {
    return {
      id: input.id || generateId(),
      messages: input.messages.map(this.convertAnthropicMessage),
      tools: input.tools?.map(this.convertAnthropicTool),
      parameters: {
        maxTokens: input.max_tokens,
        temperature: input.temperature,
        topP: input.top_p,
        stream: input.stream
      },
      metadata: {
        originalFormat: 'anthropic',
        targetFormat: 'unified',
        features: {} as ServerFeatures,
        transformationHints: []
      }
    };
  }
}
```

这个设计的优势：
1. **特征驱动**：基于服务器特征而不是名称进行适配
2. **统一Schema**：所有格式都转换为统一的中间表示
3. **灵活扩展**：新的服务商只需要实现特征检测
4. **智能适配**：根据服务器能力自动调整请求格式
5. **运行时检测**：支持运行时特征发现和适配

#### 3.5 Server模块 (modules/server/)
```typescript
interface ServerModule extends PipelineModule {
  name: 'server';
  serverType: string;
  sdk?: any;
  
  sendRequest(request: ServerRequest): Promise<ServerResponse>;
  authenticate(): Promise<boolean>;
  healthCheck(): Promise<boolean>;
}

// 官方SDK优先实现
src/pipeline/modules/server/
├── openai/
│   ├── openai-server.ts        # 使用 'openai' SDK
│   └── docs/openai-sdk.md      # OpenAI SDK文档
├── anthropic/
│   ├── anthropic-server.ts     # 使用 '@anthropic-ai/sdk'
│   └── docs/anthropic-sdk.md   # Anthropic SDK文档
├── gemini/
│   ├── gemini-server.ts        # 使用 '@google/generative-ai'
│   └── docs/gemini-sdk.md      # Gemini SDK文档
├── lmstudio/
│   ├── lmstudio-server.ts      # 使用 LMStudio SDK
│   └── docs/lmstudio-sdk.md    # LMStudio SDK文档
├── ollama/
│   ├── ollama-server.ts        # 使用 'ollama' SDK
│   └── docs/ollama-sdk.md      # Ollama SDK文档
└── codewhisperer/
    ├── codewhisperer-server.ts # 使用 '@aws-sdk/client-codewhisperer-runtime'
    └── docs/codewhisperer-sdk.md # CodeWhisperer SDK文档
```

### 4. 响应管理层 (src/response/)

#### 4.1 响应管理器 (response-manager.ts)
```typescript
interface ResponseManager {
  processResponse(response: any, pipeline: Pipeline): Promise<AnthropicResponse>;
  validateResponse(response: any): ValidationResult;
  correctData(response: any): any;
  filterContent(response: any): any;
  unifyFormat(response: any, targetFormat: string): any;
}

// 响应处理流程
AI Service Response → 响应收集 → 数据校正 → 内容过滤 → 格式统一 → 质量保证 → Anthropic Response
```

#### 4.2 响应收集器 (response-collector.ts)
```typescript
interface ResponseCollector {
  collectResponse(pipelineId: string, response: any): Promise<CollectedResponse>;
  handleMultipleResponses(responses: PipelineResponse[]): Promise<AggregatedResponse>;
  handleError(pipelineId: string, error: RCCError): Promise<ErrorResponse>;
  retryFailedResponse(pipelineId: string, originalRequest: any): Promise<any>;
}

// 重试机制与处理流程的关系说明:
/*
正常流程:
1. 客户端请求 → 路由器选择流水线 → 流水线处理 → 响应收集器收集结果 → 返回客户端

重试流程:
1. 客户端请求 → 路由器选择流水线 → 流水线处理失败 → 响应收集器检测到错误
2. 响应收集器判断是否可重试 → 选择备用流水线 → 重新处理 → 收集结果 → 返回客户端

重试不是在同一个流水线内重试，而是:
- 选择不同的流水线(不同provider或model)
- 或者等待原流水线恢复后重试
- 重试是响应管理层的职责，不是流水线内部的职责
*/

// 并发响应处理
interface PipelineResponse {
  pipelineId: string;
  provider: string;
  model: string;
  response: any;
  timestamp: number;
  processingTime: number;
  error?: RCCError;
  retryCount?: number;        // 重试次数
  isRetry?: boolean;          // 是否为重试请求
}

// 重试策略
interface RetryStrategy {
  maxRetries: number;         // 最大重试次数
  retryDelay: number;         // 重试延迟(毫秒)
  backoffMultiplier: number;  // 退避倍数
  retryableErrors: string[];  // 可重试的错误类型
  fallbackPipelines: string[]; // 备用流水线列表
}

// 响应聚合策略
enum AggregationStrategy {
  FIRST_SUCCESS = 'first_success',    // 第一个成功响应
  BEST_QUALITY = 'best_quality',      // 质量最高响应
  FASTEST = 'fastest',                // 最快响应
  CONSENSUS = 'consensus',            // 多数一致响应
  RETRY_FALLBACK = 'retry_fallback'   // 重试备用流水线
}

// 重试决策逻辑
interface RetryDecision {
  shouldRetry: boolean;
  retryPipelineId?: string;   // 重试使用的流水线ID
  retryDelay: number;         // 重试延迟时间
  reason: string;             // 重试原因
}
```

#### 4.3 数据校正器 (data-corrector.ts)
```typescript
interface DataCorrector {
  validateResponseFormat(response: any, expectedFormat: string): ValidationResult;
  correctMissingFields(response: any): any;
  fixDataTypes(response: any): any;
  repairCorruptedData(response: any): any;
  supplementMetadata(response: any): any;
}

// 数据校正规则
interface CorrectionRule {
  field: string;
  validator: (value: any) => boolean;
  corrector: (value: any) => any;
  required: boolean;
  defaultValue?: any;
}

// 常见校正场景
const correctionRules: CorrectionRule[] = [
  {
    field: 'choices',
    validator: (value) => Array.isArray(value) && value.length > 0,
    corrector: (value) => value || [{ message: { content: '', role: 'assistant' }, finish_reason: 'error' }],
    required: true
  },
  {
    field: 'usage',
    validator: (value) => value && typeof value.total_tokens === 'number',
    corrector: (value) => ({ input_tokens: 0, output_tokens: 0, total_tokens: 0, ...value }),
    required: false
  },
  {
    field: 'id',
    validator: (value) => typeof value === 'string' && value.length > 0,
    corrector: () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    required: true
  }
];
```

#### 4.4 内容过滤器 (content-filter.ts)
```typescript
interface ContentFilter {
  filterSensitiveInfo(content: string): string;
  checkHarmfulContent(content: string): ContentSafetyResult;
  validateCompliance(content: string): ComplianceResult;
  sanitizeOutput(content: string): string;
}

// 内容安全检查
interface ContentSafetyResult {
  isSafe: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  categories: string[];
  filteredContent?: string;
  warnings: string[];
}

// 合规性检查
interface ComplianceResult {
  isCompliant: boolean;
  violations: ComplianceViolation[];
  recommendations: string[];
}

interface ComplianceViolation {
  type: string;
  severity: 'info' | 'warning' | 'error';
  description: string;
  location?: string;
}
```

#### 4.5 格式统一器 (format-unifier.ts)
```typescript
interface FormatUnifier {
  unifyToAnthropicFormat(response: any, sourceFormat: string): AnthropicResponse;
  convertStreamingResponse(response: any): AsyncIterable<AnthropicStreamChunk>;
  preserveOriginalMetadata(response: any): any;
  addSystemMetadata(response: any): any;
}

// 格式转换映射
const formatConverters = {
  openai: (response: OpenAIResponse) => ({
    id: response.id,
    type: 'message',
    role: 'assistant',
    content: response.choices[0]?.message?.content ? [{ type: 'text', text: response.choices[0].message.content }] : [],
    model: response.model,
    stop_reason: mapFinishReason(response.choices[0]?.finish_reason),
    usage: {
      input_tokens: response.usage?.prompt_tokens || 0,
      output_tokens: response.usage?.completion_tokens || 0
    }
  }),
  
  gemini: (response: GeminiResponse) => ({
    id: `msg_${Date.now()}`,
    type: 'message', 
    role: 'assistant',
    content: response.candidates?.[0]?.content?.parts?.map(part => ({ type: 'text', text: part.text })) || [],
    model: 'gemini',
    stop_reason: 'end_turn',
    usage: {
      input_tokens: response.usageMetadata?.promptTokenCount || 0,
      output_tokens: response.usageMetadata?.candidatesTokenCount || 0
    }
  }),
  
  codewhisperer: (response: CodeWhispererResponse) => ({
    id: `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant', 
    content: response.completions?.map(comp => ({ type: 'text', text: comp.content })) || [],
    model: 'codewhisperer',
    stop_reason: 'end_turn',
    usage: { input_tokens: 0, output_tokens: 0 }
  })
};
```

#### 4.6 质量保证器 (quality-assurance.ts)
```typescript
interface QualityAssurance {
  validateResponseCompleteness(response: AnthropicResponse): QualityResult;
  checkFormatCorrectness(response: AnthropicResponse): QualityResult;
  measureResponseQuality(response: AnthropicResponse): QualityMetrics;
  generateQualityReport(response: AnthropicResponse): QualityReport;
}

// 质量指标
interface QualityMetrics {
  completeness: number;      // 响应完整性 (0-1)
  correctness: number;       // 格式正确性 (0-1)
  relevance: number;         // 内容相关性 (0-1)
  safety: number;           // 内容安全性 (0-1)
  performance: number;       // 处理性能 (0-1)
  overall: number;          // 总体质量 (0-1)
}

// 质量报告
interface QualityReport {
  responseId: string;
  pipelineId: string;
  metrics: QualityMetrics;
  issues: QualityIssue[];
  recommendations: string[];
  timestamp: number;
}

interface QualityIssue {
  type: 'format' | 'content' | 'safety' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestion?: string;
}
```

### 5. Debug系统 (src/debug/)

#### 4.1 Debug管理器 (debug-manager.ts)
```typescript
interface DebugManager {
  initialize(port: number): Promise<void>;
  registerPipeline(pipelineId: string, provider: string, model: string): void;
  enableDebug(pipelineId: string): void;
  disableDebug(pipelineId: string): void;
  recordInput(pipelineId: string, requestId: string, input: any): void;
  recordOutput(pipelineId: string, requestId: string, output: any): void;
  recordModuleInput(pipelineId: string, requestId: string, moduleName: string, input: any): void;
  recordModuleOutput(pipelineId: string, requestId: string, moduleName: string, output: any): void;
  recordError(pipelineId: string, requestId: string, error: RCCError): void;
}
```

#### 4.2 记录系统 (debug-recorder.ts)
```typescript
interface DebugRecorder {
  createSession(port: number): Promise<string>;
  recordInput(pipelineId: string, requestId: string, input: any): void;
  recordOutput(pipelineId: string, requestId: string, output: any): void;
  saveRecord(record: DebugRecord): Promise<void>;
  loadRecord(requestId: string): Promise<DebugRecord>;
}

// 存储结构
~/.route-claudecode/debug/
├── port-3456/
│   ├── session-2024-08-15-14-30-22/
│   │   ├── requests/
│   │   │   ├── req_xxx.json
│   │   │   └── ...
│   │   ├── session.json
│   │   └── summary.json
│   └── ...
└── ...
```

#### 4.3 回放系统 (replay-system.ts)
```typescript
interface ReplaySystem {
  replayRequest(requestId: string): Promise<any>;
  createUnitTest(requestId: string): Promise<string>;
  validateReplay(original: DebugRecord, replayed: DebugRecord): boolean;
}
```

## 数据模型

### 核心数据类型

```typescript
// 请求对象
interface RCCRequest {
  id: string;
  timestamp: number;
  body: any;                    // Anthropic格式请求体
  headers: Record<string, string>;
  method: string;
  url: string;
}

// 响应对象
interface RCCResponse {
  id: string;
  timestamp: number;
  status: number;
  body: any;                    // Anthropic格式响应体
  headers: Record<string, string>;
}

// 错误对象
interface RCCError {
  id: string;
  type: ErrorType;
  module: string;               // 发生错误的模块名
  message: string;
  details: any;
  timestamp: number;
  requestId?: string;
  stack?: string;
}

// Provider配置
interface ProviderConfig {
  name: string;                 // 如: "openai", "anthropic"
  protocol: string;             // 如: "openai", "anthropic"
  baseUrl: string;
  apiKey: string;
  models: string[];
  maxTokens?: number;
  availability: boolean;
}

// 路由规则
interface RoutingRule {
  category: string;             // 如: "default", "think"
  providers: Array<{
    provider: string;
    model: string;
    weight: number;             // 负载均衡权重
  }>;
}

// 流水线接口
interface Pipeline {
  id: string;                   // 如: "openai_gpt-4"
  provider: string;
  model: string;
  modules: PipelineModule[];
  isActive: boolean;
  process(input: any): Promise<any>;
  validate(): Promise<boolean>;
  destroy(): Promise<void>;
}

// 响应管理层类型
interface CollectedResponse {
  pipelineId: string;
  provider: string;
  model: string;
  response: any;
  timestamp: number;
  processingTime: number;
  error?: RCCError;
}

interface CorrectedResponse {
  originalResponse: any;
  correctedResponse: any;
  corrections: CorrectionApplied[];
  validationResult: ValidationResult;
}

interface FilteredResponse {
  response: any;
  filterResults: FilterResult[];
  safetyCheck: ContentSafetyResult;
  complianceCheck: ComplianceResult;
}

interface UnifiedResponse {
  response: AnthropicResponse;
  originalFormat: string;
  conversionMetadata: ConversionMetadata;
  preservedData: any;
}

interface QualityAssuredResponse {
  response: AnthropicResponse;
  qualityMetrics: QualityMetrics;
  qualityReport: QualityReport;
  finalValidation: ValidationResult;
}
```

### 配置文件Schema

#### providers.json
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "providers": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {"type": "string"},
          "protocol": {"type": "string", "enum": ["openai", "anthropic", "gemini"]},
          "baseUrl": {"type": "string", "format": "uri"},
          "apiKey": {"type": "string"},
          "models": {"type": "array", "items": {"type": "string"}},
          "maxTokens": {"type": "number", "minimum": 1},
          "availability": {"type": "boolean"}
        },
        "required": ["name", "protocol", "baseUrl", "apiKey", "models"]
      }
    }
  }
}
```

#### routing.json
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "routes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "category": {"type": "string"},
          "rules": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "provider": {"type": "string"},
                "model": {"type": "string"},
                "weight": {"type": "number", "minimum": 0, "maximum": 1}
              },
              "required": ["provider", "model", "weight"]
            }
          }
        },
        "required": ["category", "rules"]
      }
    }
  }
}
```

## 错误处理设计

### 标准API Error Handler

```typescript
interface StandardAPIErrorHandler {
  handleError(error: RCCError): APIErrorResponse;
  formatError(error: RCCError): APIErrorResponse;
  filterSensitiveData(error: RCCError): RCCError;
  setHttpStatusCode(errorType: ErrorType): number;
  
  // 特殊错误处理
  handleRateLimitError(error: RateLimitError): APIErrorResponse;
  handleServerError(error: ServerError): APIErrorResponse;
  handleLocalServerError(error: LocalServerError): APIErrorResponse;
  
  // 错误Hook系统
  registerErrorHook(errorType: string, handler: ErrorHookHandler): void;
  executeErrorHooks(error: RCCError): Promise<RCCError>;
}

// 标准错误响应格式
interface APIErrorResponse {
  error: {
    type: string;               // 错误类型
    code: string;               // 具体错误代码
    message: string;            // 用户友好的错误信息
    module: string;             // 发生错误的模块
    provider?: string;          // 服务提供商 (如果是服务器错误)
    model?: string;             // 模型名称 (如果是服务器错误)
    summary?: string;           // 错误摘要 (前100字符)
    details: any;               // 错误详细信息(已过滤敏感数据)
    timestamp: number;          // 错误发生时间
    retryable: boolean;         // 是否可重试
    retryAfter?: number;        // 重试延迟时间(秒)
  };
}

// 扩展的错误类型
interface RateLimitError extends RCCError {
  type: 'RATE_LIMIT_ERROR';
  provider: string;
  model: string;
  retryAfter: number;          // 建议重试时间(秒)
  quotaType: 'requests' | 'tokens' | 'daily' | 'monthly';
  currentUsage?: number;
  limit?: number;
}

interface ServerError extends RCCError {
  type: 'SERVER_ERROR';
  provider: string;
  model: string;
  httpStatus: number;
  serverMessage: string;
  summary: string;             // 错误摘要(前100字符)
}

interface LocalServerError extends RCCError {
  type: 'LOCAL_SERVER_ERROR';
  module: string;
  component: string;
  problemDetails: string;
  stackTrace?: string;
}

// 错误Hook处理器
interface ErrorHookHandler {
  (error: RCCError): Promise<RCCError | null>;
}

// HTTP状态码映射
const HTTP_STATUS_MAPPING = {
  // 客户端错误
  CLIENT_ERROR: 400,
  VALIDATION_ERROR: 400,
  
  // 服务器错误 (外部)
  SERVER_ERROR: 502,           // 上游服务器错误
  NETWORK_ERROR: 502,          // 网络连接错误
  RATE_LIMIT_ERROR: 429,       // 速率限制
  
  // 服务器错误 (本地)
  LOCAL_SERVER_ERROR: 500,     // 本地服务器错误
  CONFIG_ERROR: 500,           // 配置错误
  PIPELINE_ERROR: 500,         // 流水线错误
  ROUTER_ERROR: 500            // 路由器错误
};
```

### 特殊错误处理机制

#### 1. 速率限制错误处理 (429)
```typescript
class RateLimitHandler {
  async handle(error: RateLimitError): Promise<APIErrorResponse> {
    // 1. 解析Retry-After头
    const retryAfter = this.parseRetryAfter(error);
    
    // 2. 更新流水线状态
    await this.updatePipelineStatus(error.provider, error.model, 'rate_limited', retryAfter);
    
    // 3. 尝试备用流水线
    const fallbackPipeline = await this.findFallbackPipeline(error.provider, error.model);
    
    // 4. 返回详细错误信息
    return {
      error: {
        type: 'rate_limit_exceeded',
        code: 'RATE_LIMIT_429',
        message: `Rate limit exceeded for ${error.provider}/${error.model}`,
        module: 'server',
        provider: error.provider,
        model: error.model,
        summary: error.serverMessage.substring(0, 100),
        details: {
          quotaType: error.quotaType,
          retryAfter: retryAfter,
          fallbackAvailable: !!fallbackPipeline
        },
        timestamp: Date.now(),
        retryable: true,
        retryAfter: retryAfter
      }
    };
  }
}
```

#### 2. 服务器错误处理 (非429)
```typescript
class ServerErrorHandler {
  async handle(error: ServerError): Promise<APIErrorResponse> {
    // 1. 分析错误类型
    const errorCategory = this.categorizeServerError(error.httpStatus);
    
    // 2. 决定重试策略
    const retryable = this.isRetryable(error.httpStatus);
    
    // 3. 执行错误Hook
    const processedError = await this.executeErrorHooks(error);
    
    // 4. 返回标准化错误
    return {
      error: {
        type: 'server_error',
        code: `SERVER_${error.httpStatus}`,
        message: `Server error from ${error.provider}`,
        module: 'server',
        provider: error.provider,
        model: error.model,
        summary: error.serverMessage.substring(0, 100),
        details: {
          httpStatus: error.httpStatus,
          category: errorCategory,
          originalMessage: error.serverMessage
        },
        timestamp: Date.now(),
        retryable: retryable
      }
    };
  }
  
  private categorizeServerError(status: number): string {
    if (status >= 500) return 'server_internal_error';
    if (status === 429) return 'rate_limit';
    if (status === 401 || status === 403) return 'authentication_error';
    if (status === 400) return 'bad_request';
    return 'unknown_error';
  }
  
  private isRetryable(status: number): boolean {
    // 5xx错误可重试，4xx错误(除429外)不可重试
    return status >= 500 || status === 429;
  }
}
```

#### 3. 本地服务器错误处理 (500)
```typescript
class LocalServerErrorHandler {
  async handle(error: LocalServerError): Promise<APIErrorResponse> {
    // 1. 记录详细错误信息
    await this.logDetailedError(error);
    
    // 2. 通知监控系统
    await this.notifyMonitoring(error);
    
    // 3. 返回安全的错误信息
    return {
      error: {
        type: 'internal_server_error',
        code: `LOCAL_${error.module.toUpperCase()}_ERROR`,
        message: 'Internal server error occurred',
        module: error.module,
        details: {
          component: error.component,
          problemSummary: error.problemDetails.substring(0, 100),
          errorId: error.id,
          // 不包含敏感的堆栈信息
        },
        timestamp: Date.now(),
        retryable: false
      }
    };
  }
}
```

### 错误Hook系统

```typescript
// 错误Hook注册示例
errorHandler.registerErrorHook('RATE_LIMIT_ERROR', async (error: RCCError) => {
  // 自定义速率限制处理逻辑
  if (error.provider === 'openai') {
    // OpenAI特定的速率限制处理
    return await handleOpenAIRateLimit(error as RateLimitError);
  }
  return error;
});

errorHandler.registerErrorHook('SERVER_ERROR', async (error: RCCError) => {
  // 自定义服务器错误处理逻辑
  const serverError = error as ServerError;
  if (serverError.httpStatus === 503) {
    // 服务不可用，标记流水线为临时不可用
    await markPipelineTemporarilyUnavailable(serverError.provider, serverError.model);
  }
  return error;
});

// 通用错误Hook
errorHandler.registerErrorHook('*', async (error: RCCError) => {
  // 所有错误都会经过这个Hook
  // 可以用于统计、监控、告警等
  await recordErrorMetrics(error);
  await sendErrorAlert(error);
  return error;
});
```

### 错误处理流程

```
错误发生 → 错误分类 → 特殊处理器 → 错误Hook执行 → 标准化格式 → 返回客户端

具体流程:
1. 捕获原始错误
2. 识别错误类型 (429/5xx/4xx/本地错误)
3. 调用对应的特殊处理器
4. 执行注册的错误Hook
5. 生成标准化的API错误响应
6. 记录错误日志和指标
7. 返回给客户端

错误不会被静默处理:
- 所有错误都必须返回明确的错误响应
- 重试失败后必须返回最后的错误信息
- 本地错误必须包含模块和问题详情
- 服务器错误必须包含provider和model信息
```

### 错误处理流程

```
错误发生 → 模块捕获 → 创建RCCError → 标准API Error Handler → 过滤敏感数据 → 设置HTTP状态码 → 返回标准格式 → 记录日志 → 客户端接收
```

## 测试策略

### 测试层级

1. **单元测试**: 每个模块独立测试
   - 使用真实的输入输出数据
   - 验证数据校验逻辑
   - 测试错误处理路径

2. **集成测试**: 模块间接口测试
   - 测试模块间数据传递
   - 验证接口契约
   - 测试错误传播

3. **流水线测试**: 完整流水线端到端测试
   - 使用真实的AI服务调用
   - 测试完整的请求响应流程
   - 验证格式转换正确性

4. **回放测试**: 基于Debug记录的测试
   - 使用Debug系统记录的真实数据
   - 验证系统行为一致性
   - 支持回归测试

### 测试数据管理

```typescript
interface TestDataManager {
  createAnthropicRequest(type: string): AnthropicRequest;
  createOpenAIRequest(type: string): OpenAIRequest;
  validateResponse(expected: any, actual: any): boolean;
  loadTestCase(testId: string): TestCase;
}

// 测试用例结构
interface TestCase {
  id: string;
  name: string;
  description: string;
  input: {
    format: string;
    data: any;
  };
  expected: {
    format: string;
    data: any;
  };
  metadata: {
    provider: string;
    model: string;
    category: string;
  };
}
```

## 性能设计

### 性能目标

- **请求处理延迟**: < 100ms (不含AI服务响应时间)
- **并发处理能力**: 支持100个并发请求
- **内存使用**: < 200MB (包含所有流水线)
- **流水线创建时间**: < 50ms
- **配置重载时间**: < 100ms

### 性能优化策略

1. **缓存策略**
   - 配置文件缓存
   - 流水线实例复用
   - SDK客户端连接池

2. **异步处理**
   - 所有I/O操作异步化
   - 流水线并行处理
   - 非阻塞错误处理

3. **资源管理**
   - 及时清理不用的流水线
   - 内存使用监控
   - 连接池管理

### 监控指标

```typescript
interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  errorRate: number;
  activePipelines: number;
  memoryUsage: number;
  cpuUsage: number;
}
```

## 安全设计

### 数据安全

1. **敏感数据过滤**
   - API密钥不出现在日志中
   - 错误响应中过滤敏感信息
   - Debug记录中脱敏处理

2. **配置安全**
   - 环境变量支持 (${VAR_NAME})
   - 配置文件权限控制
   - 密钥轮转支持

3. **网络安全**
   - HTTPS强制使用
   - 请求头验证
   - 速率限制

### 访问控制

```typescript
interface SecurityManager {
  validateRequest(request: RCCRequest): boolean;
  filterSensitiveData(data: any): any;
  checkRateLimit(clientId: string): boolean;
  auditLog(action: string, details: any): void;
}
```

## 部署架构

### 单机部署

```
Claude Code → RCC Server (localhost:3456) → AI Providers
```

### 配置文件位置

```
~/.route-claudecode/
├── config/
│   ├── providers.json
│   ├── routing.json
│   └── generated/
├── debug/
├── logs/
└── cache/
```

### 环境要求

- **Node.js**: >= 16.0.0
- **内存**: >= 512MB
- **磁盘**: >= 1GB (用于日志和调试记录)
- **网络**: 能访问AI服务提供商API

这个设计文档提供了RCC v4.0系统的完整技术架构，确保每个组件都有明确的职责边界、标准的接口定义和严格的质量保证机制。