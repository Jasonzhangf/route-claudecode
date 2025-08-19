# 路由器重构迁移指南

## 概述

本文档描述了从多个重复路由器实现迁移到统一的 `CoreRouter` 的过程。

## 重构目标

1. **删除重复实现** - 消除6个重复的路由器文件
2. **统一接口** - 只保留一套清晰的路由接口
3. **纯粹职责** - 路由器只做路由决策，不做其他任何事情
4. **零Fallback策略** - 失败时立即抛出错误，不进行降级

## 迁移变更

### 新的统一路由器

**新文件**: `src/modules/routing/core-router.ts`
- 提供纯粹的路由决策功能
- 遵循零Fallback策略
- 严格的TypeScript类型安全
- 完整的数据验证

### 已废弃的文件

以下文件已标记为废弃，将在未来版本中删除：

1. `src/modules/providers/hybrid-multi-provider-router.ts`
2. `src/modules/providers/intelligent-key-router.ts`
3. `src/router/request-router.ts`
4. `src/router/demo1-enhanced-router.ts`
5. `src/router/simple-router.ts`
6. `src/provider-router.ts`
7. `src/interfaces/router/request-router.ts`

### 统一接口

**新接口文件**: `src/interfaces/router/core-router-interfaces.ts`
- 定义了完整的路由决策接口
- 包含所有必需的数据结构
- 支持零Fallback策略配置

## 迁移步骤

### 1. 更新导入语句

**旧方式**:
```typescript
import { HybridMultiProviderRouter } from './modules/providers/hybrid-multi-provider-router';
import { IntelligentKeyRouter } from './modules/providers/intelligent-key-router';
import { RequestRouter } from './router/request-router';
```

**新方式**:
```typescript
import { CoreRouter } from './modules/routing/core-router';
import { RoutingRequest, RoutingDecision } from './interfaces/router/core-router-interfaces';
```

### 2. 路由器实例化

**旧方式**:
```typescript
const router = new HybridMultiProviderRouter(config);
```

**新方式**:
```typescript
const routerConfig: RouterConfig = {
  id: 'main-router',
  name: 'Core Router',
  routingRules: {
    version: '1.0.0',
    defaultRule: { /* 规则配置 */ },
    categoryRules: { /* 分类规则 */ },
    modelRules: { /* 模型规则 */ },
    customRules: [],
    rulePriority: ['model', 'category', 'default']
  },
  defaults: {
    defaultPriority: 'normal',
    defaultTimeout: 5000,
    defaultRetries: 2,
    confidenceThreshold: 80
  },
  performance: {
    maxConcurrentDecisions: 100,
    decisionCacheSize: 1000,
    decisionTimeout: 1000,
    historyRetention: 1000
  },
  zeroFallbackPolicy: {
    enabled: true,
    strictMode: true,
    errorOnFailure: true,
    maxRetries: 2
  }
};

const router = new CoreRouter(routerConfig);
```

### 3. 路由决策调用

**旧方式**:
```typescript
const decision = await router.routeRequest('default', 'normal', context);
```

**新方式**:
```typescript
const request: RoutingRequest = {
  id: 'req-123',
  model: 'claude-3-5-sonnet',
  category: 'general',
  priority: 'normal',
  metadata: {
    originalFormat: 'anthropic',
    targetFormat: 'anthropic',
    sessionId: 'session-123'
  },
  timestamp: new Date()
};

const decision = await router.route(request);
```

### 4. 路由信息管理

**新功能**: 路由信息需要单独管理
```typescript
const routeInfo: RouteInfo[] = [
  {
    id: 'lmstudio-route',
    providerId: 'lmstudio',
    providerType: 'openai',
    supportedModels: ['llama-3.1-8b', '*'],
    weight: 1.0,
    available: true,
    healthStatus: 'healthy',
    tags: ['local', 'fast'],
    metadata: {}
  }
];

router.updateAvailableRoutes(routeInfo);
```

## 功能分离

### 路由器职责 (CoreRouter)

✅ **只负责**:
- 路由决策：选择目标Provider和Model
- 规则匹配：根据配置的路由规则进行匹配
- 状态查询：提供当前路由状态信息

❌ **不再负责**:
- 协议转换 (移至 Transformer 模块)
- 负载均衡 (移至 LoadBalancer 模块) 
- 健康检查 (移至 HealthChecker 模块)
- API调用 (移至 Provider 模块)
- 配置加载 (移至 ConfigManager 模块)

### 其他模块职责

- **Transformer**: 协议格式转换
- **LoadBalancer**: 负载均衡策略
- **HealthChecker**: 健康状态监控
- **KeyManager**: API密钥管理
- **Provider**: 具体的AI服务调用

## 零Fallback策略

新的 `CoreRouter` 严格遵循零Fallback策略：

- **失败立即抛错**: 没有可用路由时立即抛出 `ZeroFallbackError`
- **不进行降级**: 不会自动选择备用Provider或模型
- **错误类型明确**: 提供清晰的错误类型和上下文信息

```typescript
try {
  const decision = await router.route(request);
} catch (error) {
  if (error instanceof ProviderUnavailableError) {
    // 处理Provider不可用错误
  } else if (error instanceof ModelUnavailableError) {
    // 处理模型不可用错误
  } else if (error instanceof RoutingRuleNotFoundError) {
    // 处理路由规则未找到错误
  }
}
```

## 测试迁移

### 单元测试

确保为新的 `CoreRouter` 编写完整的单元测试：

```typescript
describe('CoreRouter', () => {
  it('should route request to correct provider', async () => {
    const router = new CoreRouter(testConfig);
    router.updateAvailableRoutes(testRoutes);
    
    const decision = await router.route(testRequest);
    
    expect(decision.selectedProvider).toBe('expected-provider');
    expect(decision.confidence).toBeGreaterThan(80);
  });
  
  it('should throw error when no routes available', async () => {
    const router = new CoreRouter(testConfig);
    // 不添加任何路由
    
    await expect(router.route(testRequest))
      .rejects.toThrow(ProviderUnavailableError);
  });
});
```

### 集成测试

验证与其他模块的集成：

```typescript
describe('CoreRouter Integration', () => {
  it('should work with real LM Studio provider', async () => {
    const router = new CoreRouter(realConfig);
    router.updateAvailableRoutes(realRoutes);
    
    const decision = await router.route(realRequest);
    
    expect(decision.selectedProvider).toBe('lmstudio');
    expect(decision.estimatedLatency).toBeLessThan(100);
  });
});
```

## 故障排除

### 常见问题

1. **编译错误**: 检查导入路径是否正确更新
2. **运行时错误**: 确保路由配置正确，特别是 `zeroFallbackPolicy.enabled = true`
3. **路由失败**: 验证 `RouteInfo` 数据正确，`available = true`

### 调试技巧

1. 启用调试日志：
```typescript
const routerConfig = {
  // ... 其他配置
  debug: {
    enabled: true,
    level: 'detailed',
    logTarget: 'console',
    performanceMonitoring: true
  }
};
```

2. 检查路由器状态：
```typescript
const status = router.getRouterStatus();
console.log('Router Status:', status);
```

3. 验证路由规则：
```typescript
const validation = router.validateConfig(routerConfig);
if (!validation.isValid) {
  console.error('Config errors:', validation.errors);
}
```

## 性能优化

### 推荐配置

```typescript
const performanceConfig = {
  maxConcurrentDecisions: 100,    // 根据负载调整
  decisionCacheSize: 1000,        // 缓存常用决策
  decisionTimeout: 1000,          // 1秒超时
  historyRetention: 1000          // 保留1000条历史记录
};
```

### 监控指标

- 路由决策延迟
- 决策成功率
- 缓存命中率
- 内存使用情况

## 后续步骤

1. **Phase 1**: 完成基本迁移，确保编译通过
2. **Phase 2**: 添加完整的单元测试覆盖
3. **Phase 3**: 进行集成测试和性能测试
4. **Phase 4**: 删除已废弃的文件
5. **Phase 5**: 优化性能和添加监控

## 联系方式

如有迁移问题，请联系：
- 技术负责人：RCC4 Core Router Team
- 文档更新：请参考 `src/modules/routing/README.md`