# 路由器模块 (Router Module) - 重构后设计

## 模块概述

路由器模块是RCC v4.0系统的**纯粹路由决策中心**，严格遵循单一职责原则，只负责路由决策，不包含协议转换、负载均衡或健康检查功能。

## 重构后的模块职责

### ✅ 核心职责（仅此三项）
1. **路由决策**: 根据请求信息选择目标Provider和Model
2. **路由规则管理**: 管理和更新路由规则配置
3. **路由状态查询**: 提供当前路由状态信息

### ❌ 移除的职责（已分离到其他模块）
- **协议转换** → 移至 `Transformer` 模块
- **负载均衡** → 移至 `LoadBalancer` 模块  
- **健康检查** → 移至 `HealthChecker` 模块
- **配置加载** → 移至 `ConfigManager` 模块
- **API调用** → 移至 `Provider` 模块

## 重构后的模块结构

```
modules/routing/
├── README.md                    # 本模块设计文档
├── index.ts                     # 模块入口和导出  
├── core-router.ts               # 核心路由器（唯一实现）
└── __tests__/
    └── core-router.test.ts      # 核心路由器单元测试
```

### 删除的重复文件
以下文件已被废弃，统一为核心路由器：
- ~~`hybrid-multi-provider-router.ts`~~ → 废弃
- ~~`intelligent-key-router.ts`~~ → 废弃  
- ~~`request-router.ts`~~ → 废弃
- ~~`demo1-enhanced-router.ts`~~ → 废弃
- ~~`simple-router.ts`~~ → 废弃
- ~~`provider-router.ts`~~ → 废弃

## 核心组件

### 核心路由器 (CoreRouter) - 唯一实现
统一的路由决策器，严格遵循以下设计：

#### 功能范围
```typescript
interface CoreRouter {
  // ✅ 纯粹路由决策
  route(request: RoutingRequest): Promise<RoutingDecision>;
  
  // ✅ 路由规则管理
  updateRoutingRules(rules: RoutingRules): void;
  updateAvailableRoutes(routes: RouteInfo[]): void;
  
  // ✅ 状态查询
  getAvailableRoutes(): RouteInfo[];
  getStatus(): RouterStatus;
  validateConfig(config: RouterConfig): ValidationResult;
}
```

#### 核心特性
- **零Fallback策略**: 失败时立即抛出错误，不做降级
- **严格类型安全**: 100% TypeScript，运行时数据验证
- **单一职责**: 只做路由决策，不越权处理其他功能
- **配置驱动**: 通过配置文件定义路由规则

## 接口定义

### 输入接口
```typescript
interface RoutingRequest {
  readonly id: string;
  readonly model: string;
  readonly priority: RequestPriority;
  readonly metadata: RequestMetadata;
  readonly timestamp: Date;
}

interface RequestMetadata {
  readonly originalFormat: 'anthropic' | 'openai';
  readonly targetFormat: 'anthropic' | 'openai';
  readonly userId?: string;
  readonly sessionId?: string;
}
```

### 输出接口
```typescript
interface RoutingDecision {
  readonly routeId: string;
  readonly providerId: string;
  readonly providerType: 'anthropic' | 'openai';
  readonly selectedModel: string;
  readonly reasoning: string;
  readonly estimatedLatency: number;
  readonly timestamp: Date;
}
```

### 路由信息
```typescript
interface RouteInfo {
  readonly id: string;
  readonly providerId: string;
  readonly providerType: 'anthropic' | 'openai';
  readonly supportedModels: string[];
  readonly available: boolean;
  readonly healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  readonly priority: number;
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
- **ConfigManager**: 提供路由配置
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

## 使用示例

### 基本用法
```typescript
import { CoreRouter, RouterConfig } from './modules/routing/core-router';

// 1. 创建配置
const config: RouterConfig = {
  id: 'main-router',
  routingRules: {
    defaultProvider: 'lmstudio',
    modelMappings: {
      'claude-3-5-sonnet': 'lmstudio:llama-3.1-8b',
      'gpt-4': 'lmstudio:llama-3.1-8b'
    }
  },
  zeroFallbackPolicy: {
    enabled: true,
    strictMode: true,
    errorOnFailure: true,
    maxRetries: 2
  }
};

// 2. 创建路由器
const router = new CoreRouter(config);

// 3. 更新可用路由
router.updateAvailableRoutes([
  {
    id: 'lmstudio-route',
    providerId: 'lmstudio',
    providerType: 'openai',
    supportedModels: ['llama-3.1-8b', '*'],
    available: true,
    healthStatus: 'healthy',
    priority: 1
  }
]);

// 4. 执行路由决策
try {
  const decision = await router.route({
    id: 'req-123',
    model: 'claude-3-5-sonnet',
    priority: 'normal',
    metadata: {
      originalFormat: 'anthropic',
      targetFormat: 'anthropic'
    },
    timestamp: new Date()
  });
  
  console.log('路由决策:', decision);
} catch (error) {
  if (error instanceof ProviderUnavailableError) {
    console.error('Provider不可用:', error.message);
  }
}
```

### 配置更新
```typescript
// 动态更新路由规则
router.updateRoutingRules({
  defaultProvider: 'anthropic',
  modelMappings: {
    'claude-3-5-sonnet': 'anthropic:claude-3-5-sonnet-20241022'
  }
});

// 更新可用路由状态
router.updateAvailableRoutes([
  {
    id: 'anthropic-route',
    providerId: 'anthropic',
    providerType: 'anthropic', 
    supportedModels: ['claude-3-5-sonnet-20241022'],
    available: true,
    healthStatus: 'healthy',
    priority: 1
  }
]);
```

## 测试策略

### 单元测试覆盖
- **路由决策逻辑**: 测试不同输入的路由选择
- **配置验证**: 测试配置格式和零Fallback策略
- **错误处理**: 测试各种错误场景
- **边界条件**: 测试空配置、无可用路由等情况

### 测试用例示例
```typescript
describe('CoreRouter', () => {
  it('should route to available provider', async () => {
    const decision = await router.route(mockRequest);
    expect(decision.providerId).toBe('lmstudio');
  });
  
  it('should throw error when no routes available', async () => {
    router.updateAvailableRoutes([]);
    await expect(router.route(mockRequest)).rejects.toThrow(ProviderUnavailableError);
  });
  
  it('should enforce zero fallback policy', () => {
    const config = { ...mockConfig, zeroFallbackPolicy: { enabled: false } };
    expect(() => new CoreRouter(config)).toThrow(ConfigurationError);
  });
});
```

## 性能指标

- **路由决策延迟**: < 10ms
- **内存使用**: < 50MB 
- **并发处理**: 支持 1000+ 并发路由请求
- **配置更新**: < 1ms 响应时间

## 版本历史

- **v4.0.0-beta.1** (当前): 重构为纯粹路由决策器，删除所有重复实现
- **v4.0.0-alpha.3** (废弃): 包含混合功能的多路由器设计
- **v3.x** (废弃): 旧版架构