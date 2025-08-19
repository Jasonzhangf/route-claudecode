# 流水线模块 (Pipeline Module)

## 模块概述

流水线模块是RCC v4.0的核心处理引擎，负责实现四层架构的请求处理流水线。每个Provider.Model都有独立的流水线实例。

## 模块职责

1. **流水线管理**: 创建、执行、监控和销毁流水线实例
2. **四层处理**: 实现Transformer、Protocol、Server-Compatibility、Server四层处理链
3. **模块注册**: 管理处理模块的注册和发现
4. **执行监控**: 监控流水线执行状态和性能指标

## 模块结构

```
pipeline/
├── README.md                           # 本模块设计文档
├── index.ts                            # 模块入口和导出
├── pipeline-manager.ts                 # 流水线管理器
├── pipeline-factory.ts                 # 流水线工厂
├── standard-pipeline.ts                # 标准流水线实现
├── module-registry.ts                  # 模块注册表
├── execution-context.ts                # 执行上下文管理
├── performance-monitor.ts              # 性能监控器
├── error-handler.ts                    # 流水线错误处理器
├── modules/                            # 四层处理模块
│   ├── transformer/                    # 转换器层
│   │   ├── anthropic-to-openai.ts     # Anthropic到OpenAI转换器
│   │   ├── openai-to-anthropic.ts     # OpenAI到Anthropic转换器
│   │   └── base-transformer.ts        # 基础转换器
│   ├── protocol/                       # 协议层
│   │   ├── openai-protocol.ts         # OpenAI协议处理器
│   │   ├── anthropic-protocol.ts      # Anthropic协议处理器
│   │   └── base-protocol.ts           # 基础协议处理器
│   ├── server-compatibility/           # 服务器兼容层
│   │   ├── lmstudio-compatibility.ts  # LM Studio兼容性处理器
│   │   ├── ollama-compatibility.ts    # Ollama兼容性处理器
│   │   ├── vllm-compatibility.ts      # vLLM兼容性处理器
│   │   └── base-compatibility.ts      # 基础兼容性处理器
│   └── server/                         # 服务器层
│       ├── openai-server.ts           # OpenAI服务器处理器
│       ├── anthropic-server.ts        # Anthropic服务器处理器
│       ├── gemini-server.ts           # Gemini服务器处理器
│       └── base-server.ts             # 基础服务器处理器
└── types/                              # 流水线相关类型定义
    ├── pipeline-types.ts              # 流水线类型定义
    ├── module-types.ts                # 模块类型定义
    └── execution-types.ts             # 执行类型定义
```

## 接口定义

### PipelineFramework

```typescript
interface PipelineFramework {
  id: string;
  spec: PipelineSpec;
  addModule(module: ModuleInterface): void;
  removeModule(moduleId: string): void;
  getModule(moduleId: string): ModuleInterface | null;
  getAllModules(): ModuleInterface[];
  setModuleOrder(moduleIds: string[]): void;
  executeModule(moduleId: string, input: any): Promise<any>;
  execute(input: any, context?: ExecutionContext): Promise<ExecutionResult>;
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): PipelineStatus;
  getExecutionHistory(): ExecutionRecord[];
  reset(): Promise<void>;
}
```

### ModuleInterface

```typescript
interface ModuleInterface {
  getId(): string;
  getName(): string;
  getType(): ModuleType;
  getVersion(): string;
  getStatus(): ModuleStatus;
  configure(config: any): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  process(input: any): Promise<any>;
  reset(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; details: any }>;
}
```

## 子模块详细说明

### 流水线管理器

负责流水线实例的生命周期管理，包括创建、启动、停止和销毁。

### 流水线工厂

负责根据配置创建不同类型的流水线实例。

### 模块注册表

管理所有处理模块的注册和发现，支持动态模块加载。

### 四层处理模块

实现具体的请求处理逻辑，每层有明确的职责：

- Transformer层：格式转换
- Protocol层：协议处理
- Server-Compatibility层：服务器兼容性处理
- Server层：实际API调用

## 依赖关系

- 依赖配置模块获取流水线配置
- 依赖Debug模块记录执行过程
- 依赖错误处理模块处理执行错误

## 设计原则

1. **严格四层架构**: 严格按照四层处理链执行，不允许跨层调用
2. **模块化**: 每个处理模块职责单一，可独立开发和测试
3. **可扩展**: 支持新的处理模块和流水线类型
4. **可观测性**: 提供详细的执行日志和性能监控
5. **容错性**: 完善的错误处理和恢复机制
