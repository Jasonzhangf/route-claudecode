# 路由器模块 (Router Module) - 流水线选择架构 & 零接口暴露重构版

## 模块概述

路由器模块是RCC v4.0系统的**流水线选择器**，负责根据输入模型选择合适的流水线，而不是选择Provider。流水线在初始化时已经完全创建并握手连接完毕。采用严格的零接口暴露设计，确保模块的安全性和封装性。

## 核心架构原则

### ✅ 正确的设计理念
1. **路由选择流水线，不是Provider**: 每个Provider-APIKey组合对应一条独立流水线
2. **初始化时创建所有流水线**: 服务器启动时根据routing table创建所有流水线 
3. **流水线已完成握手**: 每条流水线包含完整的4层架构并已连接就绪
4. **负载均衡管理流水线选择**: 具体选择哪条流水线由负载均衡器决定

### ❌ 废弃的错误设计
- ~~**运行时选择Provider**~~ → 流水线初始化时已确定Provider
- ~~**动态组装Transformer/Protocol**~~ → 流水线初始化时已组装完毕
- ~~**运行时协议转换**~~ → 每条流水线包含固定的转换链

## 核心设计理念

### ✅ 零接口暴露设计模式
- **唯一入口**: 只暴露`RouterPreprocessor`门面类
- **静态方法**: 所有功能通过静态方法`preprocess()`访问
- **一次性生命周期**: 处理完成后立即销毁，不留任何引用
- **类型安全**: 严格的TypeScript类型定义和验证

### 🔒 安全性原则
- **输入验证**: 严格的输入数据验证和过滤
- **配置验证**: 完整的配置验证和错误处理机制
- **最小权限**: 模块只能访问必要数据，不能修改系统其他部分

## 模块结构

```
router/
├── README.md                          # 本模块设计文档
├── index.ts                           # 模块统一导出（零接口暴露）
├── router-preprocessor.ts             # 路由预处理器（唯一公开类）
├── routing-table-types.ts             # 路由表类型定义
└── __tests__/                         # 测试目录
    ├── router-preprocessor.test.ts    # 预处理器单元测试
    └── test-outputs/                  # 测试输出目录
```

## 核心组件

### 路由预处理器 (RouterPreprocessor) - 唯一公开组件
实现一次性预处理模式，严格遵循零接口暴露设计：

#### 生命周期
1. **实例化** → 系统启动时创建
2. **预处理** → `preprocess()`方法执行路由处理
3. **销毁** → 处理完成后自动销毁，无持久引用

#### 功能特性
- **内部路由表生成**: 根据配置生成内部路由表结构
- **流水线配置生成**: 为每个Provider-APIKey组合生成流水线配置
- **层配置生成**: 为流水线的每一层生成详细配置
- **验证机制**: 完善的输入验证和结果验证机制

#### 接口定义
```typescript
class RouterPreprocessor {
  // 唯一的公开方法 - 零接口暴露设计
  static async preprocess(routingTable: RoutingTable): Promise<RouterPreprocessResult>;
}

interface RouterPreprocessResult {
  success: boolean;
  routingTable?: _InternalRoutingTable;
  pipelineConfigs?: PipelineConfig[];
  errors: string[];
  warnings: string[];
  stats: {
    routesCount: number;
    pipelinesCount: number;
    processingTimeMs: number;
  };
}
```

## 正确的架构结构

### 删除的废弃文件
以下错误设计文件已删除：
- ~~`core-router.ts`~~ → 废弃（错误选择Provider的设计）
- ~~`simple-router.ts`~~ → 废弃（错误的运行时决策）
- ~~`hybrid-multi-provider-router.ts`~~ → 废弃
- ~~`request-router.ts`~~ → 废弃

## 核心数据结构

### 流水线路由信息
```typescript
interface PipelineRoute {
  routeId: string;              // 路由ID
  routeName: string;            // 路由名称(default/premium等)
  virtualModel: string;         // 虚拟模型名
  provider: string;             // Provider名称(lmstudio等)
  apiKeyIndex: number;          // API Key索引
  pipelineId: string;           // 对应的流水线ID
  isActive: boolean;            // 是否活跃
  health: 'healthy' | 'degraded' | 'unhealthy'; // 健康状态
}
```

### 路由表
```typescript
interface RoutingTable {
  providers: ProviderInfo[];
  routes: RouteMapping;
  server: ServerInfo;
  apiKey: string;
  version: string;
  description: string;
  lastUpdated: string;
}

interface _InternalRoutingTable {
  routes: Record<string, _PipelineRoute[]>; // virtualModel -> PipelineRoute[]
  defaultRoute: string;
  metadata: {
    configSource: string;
    generatedAt: string;
    preprocessorVersion: string;
  };
}
```

### 零Fallback配置
```typescript
interface RouterConfig {
  readonly id: string;
  readonly routingRules: RoutingRules;
  readonly zeroFallbackPolicy: {
    readonly enabled: true; // 强制为true
    readonly strictMode: boolean;
    readonly errorOnFailure: boolean;
    readonly maxRetries: number;
  };
}
```

## 路由决策逻辑

### 1. 请求验证
```typescript
// 1. 输入验证
@ValidateInput(ROUTING_REQUEST_SCHEMA)
async route(request: RoutingRequest): Promise<RoutingDecision>

// 2. 配置验证
if (!this.config.zeroFallbackPolicy.enabled) {
  throw new ConfigurationError('Zero fallback policy must be enabled');
}
```

### 2. 路由匹配
```typescript
// 3. 模型匹配
const matchingRoutes = this.availableRoutes.filter(route => 
  route.available && 
  route.healthStatus === 'healthy' &&
  this.modelMatches(request.model, route.supportedModels)
);

// 4. 优先级排序
const sortedRoutes = matchingRoutes.sort((a, b) => a.priority - b.priority);
```

### 3. 决策生成
```typescript
// 5. 选择最佳路由
const selectedRoute = sortedRoutes[0];
if (!selectedRoute) {
  throw new ProviderUnavailableError(
    `No available route for model: ${request.model}`,
    'ROUTE_NOT_FOUND',
    { requestedModel: request.model, availableRoutes: this.availableRoutes.length }
  );
}

// 6. 生成决策
return {
  routeId: `route-${Date.now()}`,
  providerId: selectedRoute.providerId,
  providerType: selectedRoute.providerType,
  selectedModel: request.model,
  reasoning: `Selected ${selectedRoute.providerId} based on priority ${selectedRoute.priority}`,
  estimatedLatency: 100,
  timestamp: new Date()
};
```

## 错误处理

### 零Fallback错误类型
```typescript
// 路由未找到
throw new ProviderUnavailableError(message, code, context);

// 模型不支持
throw new ModelUnavailableError(message, code, context);

// 配置错误
throw new ConfigurationError(message, code, context);

// 路由规则错误
throw new RoutingRuleNotFoundError(message, code, context);
```

## 依赖关系

### 上游依赖（Router接收）
- **ConfigManager**: 提供路由配置（通过ConfigPreprocessor处理后的结果）
- **HealthChecker**: 提供Provider健康状态
- **Pipeline**: 调用Router进行路由决策

### 下游依赖（Router调用）
- **无** - 路由器不直接调用其他模块，只返回路由决策

### 模块间协作
```
Pipeline → CoreRouter.route() → RoutingDecision
ConfigManager → CoreRouter.updateConfig() → void  
HealthChecker → CoreRouter.updateAvailableRoutes() → void
```

## 设计原则

1. **单一职责**: 只做路由决策，不做其他任何事情
2. **零Fallback**: 失败时立即抛出错误，不做降级或重试
3. **配置驱动**: 所有路由逻辑通过配置文件定义
4. **类型安全**: 100% TypeScript，严格的类型检查
5. **无状态**: 路由决策不依赖内部状态，只依赖配置和输入
6. **零接口暴露**: 严格封装内部实现，只暴露必要接口
7. **一次性处理**: 预处理器完成任务后立即销毁

## 使用示例

### 基本用法
```typescript
import { RouterPreprocessor } from '@rcc/router';

// 一次性预处理路由配置
const result = await RouterPreprocessor.preprocess(routingTable);

if (result.success) {
  // 使用生成的内部路由表和流水线配置
  const internalRoutingTable = result.routingTable;
  const pipelineConfigs = result.pipelineConfigs;
  // 传递给PipelineAssembler
} else {
  // 处理错误
  console.error('路由预处理失败:', result.errors);
}
```

### 配置更新
```typescript
// 注意：RouterPreprocessor是一次性使用的，更新配置需要重新创建实例
// 这是零接口暴露设计的一部分，确保配置处理的纯净性
```

## 测试策略

### 单元测试覆盖
- **路由表生成**: 测试内部路由表的正确生成
- **流水线配置**: 验证流水线配置的完整性和正确性
- **层配置生成**: 确保各层配置的正确生成
- **错误处理**: 验证各种错误场景的处理能力
- **边界条件**: 测试空配置、无可用路由等情况

### 集成测试
- **与ConfigPreprocessor集成**: 验证配置输入与路由处理的兼容性
- **与PipelineAssembler集成**: 验证路由输出与流水线组装的兼容性
- **性能测试**: 验证大规模路由配置的处理性能
- **安全测试**: 验证敏感信息的正确处理和保护

## 性能指标

- **路由决策延迟**: < 10ms
- **内存使用**: < 50MB 
- **并发处理**: 支持 1000+ 并发路由请求
- **配置更新**: < 1ms 响应时间

## 版本历史

- **v4.1.0** (当前): 零接口暴露重构，一次性预处理器设计
- **v4.0.0-beta.1**: 重构为纯粹路由决策器，删除所有重复实现
- **v4.0.0-alpha.3** (废弃): 包含混合功能的多路由器设计
- **v3.x** (废弃): 旧版架构