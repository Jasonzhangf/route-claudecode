# RCC v4.0 模块化架构设计

## 概述

RCC v4.0 采用严格的模块化架构设计，包含多个核心模块和支撑系统：

## 模块架构图

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   客户端模块     │───▶│   路由器模块     │───▶│   流水线模块     │
│   (Client)      │    │   (Router)      │    │  (Pipeline)     │
│  CLI + HTTP     │    │ 路由 + 流控     │    │ 4层处理链      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              支撑系统模块 (Config + Debug + ErrorHandler)        │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────┐
                    │   核心类型定义   │
                    │   (Types)       │
                    └─────────────────┘
```

## 模块详细说明

### 1. 客户端模块 (src/client/)
处理CLI命令、用户交互和错误处理

### 2. 路由器模块 (src/router/)
处理配置管理、请求路由和负载均衡

### 3. 流水线模块 (src/modules/pipeline-modules/)
处理4层流水线的动态管理和执行，包括：
- Transformer层 (src/modules/transformers/)
- Protocol层 (src/modules/pipeline-modules/protocol/)
- ServerCompatibility层 (src/modules/pipeline-modules/server-compatibility/)
- Server层 (src/modules/pipeline-modules/server/)

### 4. 支撑模块
- Debug系统 (src/debug/) - 数据记录、回放测试和调试支持
- 配置系统 (src/config/) - 配置加载和管理
- 错误处理系统 (src/core/) - 统一错误处理
- CLI系统 (src/cli/) - 命令行接口处理
- API系统 (src/api/) - 内部API接口
- 中间件系统 (src/middleware/) - 请求处理中间件
- 服务系统 (src/services/) - 核心服务管理
- 工具系统 (src/utils/) - 通用工具函数
- 类型系统 (src/types/) - 核心类型定义
- 接口系统 (src/interfaces/) - 接口定义
- 测试系统 (src/test/) - 测试工具和框架
- 架构扫描系统 (src/arch-scanner/) - 架构分析工具
- 启动系统 (src/bootstrap/) - 应用启动管理

### 5. 核心模块组件
- 模块管理 (src/modules/core/) - 模块注册和管理
- 认证模块 (src/modules/auth/) - 认证处理
- 协议模块 (src/modules/protocol/) - 协议处理
- 转换模块 (src/modules/transformer/) - 数据格式转换
- 服务器兼容模块 (src/modules/server-compatibility/) - 服务器兼容性处理
- 服务器模块 (src/modules/server/) - 服务器通信
- 错误处理模块 (src/modules/error-handler/) - 模块化错误处理
- 路由模块 (src/modules/routing/) - 路由处理
- 提供商模块 (src/modules/providers/) - AI提供商管理
- 调度模块 (src/modules/scheduler/) - 任务调度