# 流水线模块 (Pipeline Module) - 初始化时创建架构

## 模块概述

流水线模块是RCC v4.0系统的**预初始化处理引擎**。在服务器启动时，根据routing table一次性创建所有流水线，每条流水线完成握手连接后进入runtime状态。每个Provider-APIKey组合对应一条独立的流水线。

## 正确的架构原则

### ✅ 初始化时创建所有流水线
1. **服务器启动时**: 根据routing table创建所有流水线
2. **一个APIKey一条流水线**: 每个Provider-APIKey组合对应独立流水线
3. **完整4层架构**: 每条流水线 = Transformer → Protocol → ServerCompatibility → Server
4. **握手连接**: 每条流水线初始化时完成内部握手，确保连接就绪
5. **Runtime状态**: 初始化完成后，所有流水线处于活跃的runtime状态

## 模块结构

```
pipeline/
├── README.md                           # 本模块设计文档
├── index.ts                            # 模块入口和导出
├── pipeline-manager.ts                  # 流水线管理器
├── pipeline-factory.ts                  # 流水线工厂
├── standard-pipeline.ts                # 标准流水线实现
├── module-registry.ts                 # 模块注册表
└── modules/                            # 四层处理模块
    ├── transformer/                      # 转换器层
    │   ├── index.ts                     # 转换器模块入口
    │   ├── transformer-module.ts       # 基础转换器类
    │   ├── openai-transformer.ts        # OpenAI转换器
    │   └── anthropic-transformer.ts     # Anthropic转换器
    ├── protocol/                        # 协议层
    │   ├── protocol-module.ts          # 协议模块
    │   └── openai-protocol.ts          # OpenAI协议处理器
    ├── server-compatibility/           # 服务器兼容层
    │   ├── compatibility-module.ts     # 兼容性模块
    │   └── lmstudio-compatibility.ts   # LM Studio兼容性处理器
    └── server/                         # 服务器层
        ├── server-module.ts            # 服务器模块
        └── openai-server.ts            # OpenAI服务器处理器
```

## 核心组件

### 流水线管理器 (PipelineManager)
负责流水线实例的生命周期管理，包括创建、启动、停止和销毁。

### 流水线工厂 (PipelineFactory)
负责根据配置创建不同类型的流水线实例。

### 模块注册表 (ModuleRegistry)
管理所有处理模块的注册和发现，支持动态模块加载。

### 标准流水线实现 (StandardPipeline)
实现四层架构的标准流水线处理逻辑。

## 四层架构

### 1. Transformer层 (转换器层)
- **职责**: 格式转换 (Anthropic ↔ OpenAI ↔ Protocol)
- **输入验证**: Anthropic请求标准格式
- **输出验证**: 目标协议格式
- **命名规则**: 以目标协议命名

### 2. Protocol层 (协议层)
- **职责**: 协议控制 (流式 ↔ 非流式)
- **流式处理**: 流式请求 → 非流式请求 → 流式响应
- **协议校验**: 输入输出都做协议标准校验

### 3. Server-Compatibility层 (服务器兼容层)
- **职责**: 第三方服务器兼容处理
- **输入**: 标准协议协议
- **输出**: 第三方特定格式
- **重点**: OpenAI变种和扩展处理

### 4. Server层 (服务器层)
- **职责**: 标准服务器协议处理
- **SDK优先**: 有SDK就使用标准SDK
- **协议标准**: 严格按照服务器协议标准

## 核心接口定义

### Pipeline Manager接口
```typescript
interface PipelineManager {
  // ✅ 初始化时根据routing table创建所有流水线
  initializeFromRoutingTable(routingTable: RoutingTable): Promise<void>;
  
  // ✅ 获取已初始化的流水线（不创建新的）
  getPipeline(pipelineId: string): CompletePipeline | null;
  getAllPipelines(): Map<string, CompletePipeline>;
  
  // ✅ 流水线执行（直接使用已创建的流水线）
  executePipeline(pipelineId: string, request: any): Promise<any>;
  
  // ✅ 健康检查和debug信息
  getPipelinesDebugInfo(): PipelineDebugInfo[];
  validatePipelinesAgainstConfig(routingTable: RoutingTable): ValidationResult;
}
```

### 完整流水线接口  
```typescript
interface CompletePipeline {
  readonly pipelineId: string;
  readonly routeInfo: {
    virtualModel: string;
    provider: string;
    apiKey: string;
    endpoint: string;
  };
  
  // ✅ 4层架构组件（初始化时已创建并连接）
  readonly transformer: TransformerModule;
  readonly protocol: ProtocolModule; 
  readonly serverCompatibility: ServerCompatibilityModule;
  readonly server: ServerModule;
  
  // ✅ 流水线状态管理
  readonly status: 'initializing' | 'runtime' | 'error' | 'stopped';
  readonly lastHandshakeTime: Date;
  
  // ✅ 执行方法（直接通过4层链路处理）
  execute(request: any): Promise<any>;
  
  // ✅ 健康检查
  healthCheck(): Promise<boolean>;
}
```

### 初始化配置
```typescript
interface PipelineInitializationConfig {
  routingTable: RoutingTable;
  systemConfig: SystemConfig;
  debugMode: boolean;  // 启用详细的初始化日志
}

interface PipelineDebugInfo {
  pipelineId: string;
  status: 'runtime' | 'error' | 'initializing';
  routeInfo: {
    virtualModel: string;
    provider: string;
    apiKeyIndex: number;
  };
  layerStatus: {
    transformer: 'connected' | 'error';
    protocol: 'connected' | 'error'; 
    serverCompatibility: 'connected' | 'error';
    server: 'connected' | 'error';
  };
  lastExecutionTime?: Date;
  errorCount: number;
  successCount: number;
}
```

## 依赖关系

- 依赖配置模块获取流水线配置
- 依赖路由器模块接收路由决策
- 被Debug模块监控执行过程

## 设计原则

1. **严格四层架构**: 严格按照四层处理链执行，不允许跨层调用
2. **模块化**: 每个处理模块职责单一，可独立开发和测试
3. **可扩展**: 支持新的处理模块和流水线类型
4. **可观测性**: 提供详细的执行日志和性能监控
5. **容错性**: 完善的错误处理和恢复机制
6. **隔离性**: 每个Provider.Model有独立的流水线实例