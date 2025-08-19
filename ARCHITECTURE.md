# RCC v4.0 完整架构设计文档

## 1. 概述

RCC v4.0 是一个高性能、严格模块化的多AI提供商路由转换系统。系统采用四模块架构设计，确保各组件职责清晰、接口标准、松耦合。

## 2. 核心架构图

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   客户端模块     │───▶│   路由器模块     │───▶│  流水线Worker   │
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

## 3. 模块详细设计

### 3.1 客户端模块 (Client)
**职责**: 处理CLI命令、用户交互和错误处理

**子模块**:
- CLI处理子模块
- 会话管理子模块
- HTTP客户端子模块

**接口**:
```typescript
interface ClientInterface {
  initialize(): Promise<void>;
  executeCommand(command: string, options: any): Promise<void>;
  handleUserInput(input: string): Promise<void>;
}
```

### 3.2 路由器模块 (Router)
**职责**: 请求路由、配置管理和负载均衡

**子模块**:
- 配置管理子模块
- 路由管理子模块
- 流控管理子模块
- 负载均衡子模块

**接口**:
```typescript
interface RouterInterface {
  initialize(): Promise<void>;
  routeRequest(request: any): Promise<RouteResult>;
  getConfig(): RouterConfig;
}
```

### 3.3 流水线模块 (Pipeline)
**职责**: 实现四层架构的请求处理流水线

**子模块**:
- 流水线管理器
- 流水线工厂
- 模块注册表
- 四层处理模块 (Transformer, Protocol, Server-Compatibility, Server)

**接口**:
```typescript
interface PipelineFramework {
  execute(input: any, context?: ExecutionContext): Promise<ExecutionResult>;
  start(): Promise<void>;
  stop(): Promise<void>;
}
```

### 3.4 Debug系统模块 (Debug)
**职责**: 全链路数据记录、回放测试和调试支持

**子模块**:
- Debug管理器
- Debug记录器
- 回放系统
- 性能分析器

**接口**:
```typescript
interface DebugManagerInterface {
  startRecording(): void;
  stopRecording(): void;
  getRecordedData(filter?: DebugFilter): DebugRecord[];
}
```

### 3.5 CLI模块 (CLI)
**职责**: 命令行接口处理

**子模块**:
- 命令解析器
- 参数验证器
- 命令执行器

**接口**:
```typescript
interface CLICommandsInterface {
  start(options: StartOptions): Promise<void>;
  stop(options: StopOptions): Promise<void>;
  code(options: CodeOptions): Promise<void>;
}
```

### 3.6 服务器模块 (Server)
**职责**: HTTP服务器管理和请求处理

**子模块**:
- HTTP服务器核心
- 流水线集成服务器
- 中间件管理器
- 安全子模块
- 监控子模块

**接口**:
```typescript
interface HTTPServerInterface {
  start(): Promise<void>;
  stop(): Promise<void>;
  addRoute(method: string, path: string, handler: RouteHandler): void;
}
```

### 3.7 配置模块 (Config)
**职责**: 配置管理

**子模块**:
- 配置加载器
- 配置验证器
- 配置监听器
- Provider配置子模块
- 路由配置子模块

**接口**:
```typescript
interface ConfigManagerInterface {
  loadConfig(): Promise<RCCv4Config>;
  validateConfig(config: RCCv4Config): boolean;
}
```

### 3.8 类型定义模块 (Types)
**职责**: 统一类型定义

**子模块**:
- 核心类型定义
- 请求响应类型定义
- 流水线类型定义
- 配置类型定义

### 3.9 工具模块 (Utils)
**职责**: 通用工具函数

**子模块**:
- 安全日志记录器
- 配置加密工具
- 数据验证器
- 性能监控器

### 3.10 中间件模块 (Middleware)
**职责**: HTTP请求处理中间件

**子模块**:
- 认证中间件
- CORS中间件
- 日志中间件
- 安全中间件
- 速率限制中间件

### 3.11 路由模块 (Routes)
**职责**: HTTP路由定义和管理

**子模块**:
- API路由定义
- 健康检查路由
- 调试路由
- 管理路由

### 3.12 模块系统 (Modules)
**职责**: 流水线处理模块管理

**子模块**:
- 模块注册表
- 流水线处理模块 (四层架构)
- Provider模块
- 验证模块

## 4. 四层流水线架构

### 🔄 重要架构提醒：双向转换处理
**核心原理**: 流水线各层都实现双向转换机制
- **请求方向**: 正向转换 (Client → Provider)
- **响应方向**: 逆向转换 (Provider → Client)
- **保证一致性**: 请求-响应配对，确保数据完整性和格式一致性

### 4.1 Transformer层
**职责**: 格式转换 (Anthropic ↔ OpenAI ↔ Gemini)
- **正向**: 将客户端格式转换为目标Provider格式
- **逆向**: 将Provider响应转换回客户端期望格式

### 4.2 Protocol层
**职责**: 协议控制 (流式 ↔ 非流式)
- **正向**: 根据配置处理流式/非流式请求转换
- **逆向**: 将Provider响应按协议要求返回给客户端

### 4.3 Server-Compatibility层
**职责**: 第三方服务器兼容处理
- **正向**: 适配第三方服务器特殊要求和限制
- **逆向**: 标准化第三方服务器响应格式

### 4.4 Server层
**职责**: 标准服务器协议 (SDK优先)
- **正向**: 最终请求发送和连接管理
- **逆向**: 原始响应接收和初步处理

## 5. 设计原则

### 5.1 模块化原则
- 严格模块化: 15个核心模块，物理隔离，标准接口通信
- 零跨模块处理: 模块间只能通过定义接口通信
- 零重复代码: 模块间不允许功能重叠

### 5.2 质量标准
- 零静默失败: 所有错误必须通过 error handler 报告
- 零Mockup响应: 严禁mockup，必须真实流水线
- 零硬编码: 所有配置可动态加载
- 100%数据校验: 每个模块输入输出标准校验

### 5.3 接口标准
- 标准接口通信: 模块间只能通过定义接口
- 完整的错误处理: 禁止 try-catch 空处理
- 标准化的接口定义

## 6. 会话流控架构

```
Client Request → 会话提取器 → 会话流控管理器 → 流水线Worker池

会话流控层级:
├── Session Level (用户会话)
│   ├── Conversation Level (对话)
│   │   ├── Request Queue (请求队列 - 串行处理)
│   │   │   ├── requestID_001 (按顺序)
│   │   │   ├── requestID_002 
│   │   │   └── requestID_003
│   │   └── Processing State (处理状态)
│   └── Resource Management (资源管理)

特点: 同一对话内请求严格串行，不同会话和对话可并行
```

## 7. 测试策略

### 7.1 测试层级
- 单元测试: 覆盖率 > 90%
- 集成测试: 覆盖所有模块接口
- 流水线测试: 端到端处理
- 回放测试: Debug数据回放

### 7.2 测试要求
- 真实流水线测试 (禁止 mockup)
- 性能基准测试
- 端到端测试覆盖主要用户场景

## 8. 安全考虑

### 8.1 数据安全
- API密钥加密存储
- 错误日志敏感信息过滤
- Debug记录敏感信息清理

### 8.2 网络安全
- HTTPS优先
- 证书验证
- 请求头验证

## 9. 性能优化

### 9.1 性能指标
- 请求处理延迟 < 100ms
- 支持并发请求 > 100 个
- 内存使用 < 200MB (空载)

### 9.2 优化策略
- 缓存机制: 配置文件缓存，流水线实例缓存
- 异步处理: 所有I/O操作异步化
- 内存管理: 及时清理无用资源

## 10. 部署和维护

### 10.1 部署要求
- Node.js 18.0+ (LTS版本)
- TypeScript 5.0+
- npm 9.0+ 或 pnpm 8.0+

### 10.2 维护计划
- 定期依赖更新
- 安全漏洞修复
- 性能优化
- 新AI服务支持