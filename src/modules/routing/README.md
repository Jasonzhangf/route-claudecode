# 核心路由模块 (Core Routing Module)

## 概述

核心路由模块提供纯粹的路由决策功能，严格遵循单一职责原则和零Fallback策略。

## 设计原则

### 🎯 单一职责

- **只做路由决策**: 根据请求信息选择最合适的Provider和Model
- **不做协议转换**: 由Transformer模块负责
- **不做负载均衡**: 由LoadBalancer模块负责
- **不做健康检查**: 由HealthChecker模块负责

### 🚫 零Fallback策略

- **失败立即抛错**: 没有可用路由时立即抛出错误
- **不进行降级**: 不会自动选择备用Provider或模型
- **错误类型明确**: 提供清晰的错误类型和上下文

### 🛡️ 类型安全

- **100% TypeScript**: 严格的类型检查
- **完整验证**: 输入输出数据完全验证
- **接口规范**: 清晰的接口定义

## 核心组件

### CoreRouter 类

主要的路由决策器实现：

```typescript
import { CoreRouter, RouterConfig } from './core-router';

const config: RouterConfig = {
  id: 'main-router',
  name: 'Core Router',
  routingRules: {
    version: '1.0.0',
    defaultRule: {
      /* 默认规则 */
    },
    categoryRules: {
      /* 分类规则 */
    },
    modelRules: {
      /* 模型规则 */
    },
    customRules: [],
    rulePriority: ['model', 'category', 'default'],
  },
  defaults: {
    defaultPriority: 'normal',
    defaultTimeout: 5000,
    defaultRetries: 2,
    confidenceThreshold: 80,
  },
  performance: {
    maxConcurrentDecisions: 100,
    decisionCacheSize: 1000,
    decisionTimeout: 1000,
    historyRetention: 1000,
  },
  zeroFallbackPolicy: {
    enabled: true, // 必须为true
    strictMode: true,
    errorOnFailure: true,
    maxRetries: 2,
  },
};

const router = new CoreRouter(config);
```

## 基本用法

### 1. 创建路由请求

```typescript
import { RoutingRequest } from './core-router';

const request: RoutingRequest = {
  id: 'req-' + Date.now(),
  model: 'claude-3-5-sonnet',
  category: 'general',
  priority: 'normal',
  metadata: {
    originalFormat: 'anthropic',
    targetFormat: 'anthropic',
    sessionId: 'session-123',
    userId: 'user-456',
  },
  constraints: {
    preferredProviders: ['lmstudio'],
    maxLatency: 1000,
  },
  timestamp: new Date(),
};
```

### 2. 配置可用路由

```typescript
import { RouteInfo } from './core-router';

const routes: RouteInfo[] = [
  {
    id: 'lmstudio-route',
    providerId: 'lmstudio',
    providerType: 'openai',
    supportedModels: ['llama-3.1-8b', 'claude-3-5-sonnet', '*'],
    weight: 1.0,
    available: true,
    healthStatus: 'healthy',
    tags: ['local', 'fast'],
    metadata: {
      endpoint: 'http://localhost:1234',
      apiVersion: 'v1',
    },
  },
  {
    id: 'anthropic-route',
    providerId: 'anthropic',
    providerType: 'anthropic',
    supportedModels: ['claude-3-5-sonnet', 'claude-3-5-haiku'],
    weight: 0.8,
    available: true,
    healthStatus: 'healthy',
    tags: ['cloud', 'official'],
    metadata: {
      region: 'us-east-1',
    },
  },
];

router.updateAvailableRoutes(routes);
```

### 3. 执行路由决策

```typescript
try {
  const decision = await router.route(request);

  console.log('路由决策结果:', {
    selectedProvider: decision.selectedProvider,
    selectedModel: decision.selectedModel,
    confidence: decision.confidence,
    estimatedLatency: decision.estimatedLatency,
    reasoning: decision.reasoning,
  });
} catch (error) {
  if (error instanceof ProviderUnavailableError) {
    console.error('Provider不可用:', error.message);
  } else if (error instanceof ModelUnavailableError) {
    console.error('模型不可用:', error.message);
  } else if (error instanceof RoutingRuleNotFoundError) {
    console.error('路由规则未找到:', error.message);
  }
}
```

## 路由规则配置

### 默认规则

```typescript
const defaultRule: RoutingRule = {
  id: 'default-rule',
  name: 'Default Routing Rule',
  conditions: [],
  targetProviders: ['lmstudio', 'anthropic'],
  weights: {
    lmstudio: 1.0,
    anthropic: 0.8,
  },
  enabled: true,
  description: 'Fallback to any available provider',
};
```

### 模型特定规则

```typescript
const modelRules = {
  'claude-3-5-sonnet': {
    id: 'claude-sonnet-rule',
    name: 'Claude Sonnet Rule',
    conditions: [
      {
        field: 'model',
        operator: 'equals',
        value: 'claude-3-5-sonnet',
      },
    ],
    targetProviders: ['anthropic', 'lmstudio'],
    weights: {
      anthropic: 1.0,
      lmstudio: 0.7,
    },
    enabled: true,
  },
};
```

### 分类规则

```typescript
const categoryRules = {
  coding: {
    id: 'coding-rule',
    name: 'Coding Tasks Rule',
    conditions: [
      {
        field: 'category',
        operator: 'equals',
        value: 'coding',
      },
    ],
    targetProviders: ['lmstudio'],
    weights: {
      lmstudio: 1.0,
    },
    enabled: true,
  },
};
```

### 自定义规则

```typescript
const customRules: CustomRoutingRule[] = [
  {
    id: 'high-priority-rule',
    name: 'High Priority Rule',
    conditions: [
      {
        field: 'priority',
        operator: 'equals',
        value: 'high',
      },
    ],
    targetProviders: ['anthropic'],
    customMatcher: 'priority-matcher',
    matcherParams: {
      threshold: 0.9,
    },
    enabled: true,
  },
];
```

## 错误处理

### 错误类型

```typescript
import {
  ZeroFallbackError,
  ProviderUnavailableError,
  ModelUnavailableError,
  RoutingRuleNotFoundError,
} from '../../interfaces/core/zero-fallback-errors';

try {
  const decision = await router.route(request);
} catch (error) {
  switch (error.constructor) {
    case ProviderUnavailableError:
      // 所有目标Provider都不可用
      handleProviderUnavailable(error);
      break;

    case ModelUnavailableError:
      // 选中的Provider不支持请求的模型
      handleModelUnavailable(error);
      break;

    case RoutingRuleNotFoundError:
      // 没有匹配的路由规则
      handleNoMatchingRule(error);
      break;

    default:
      // 其他未知错误
      handleUnknownError(error);
  }
}
```

### 错误上下文

每个错误都包含丰富的上下文信息：

```typescript
const error = new ProviderUnavailableError(
  'lmstudio', // providerId
  'claude-3-5-sonnet', // modelName
  'Health check failed', // reason
  {
    // context
    requestId: 'req-123',
    category: 'general',
    availableProviders: [],
    timestamp: new Date(),
  }
);
```

## 性能监控

### 路由器状态

```typescript
const status = router.getRouterStatus();
console.log('路由器状态:', {
  routerId: status.routerId,
  rulesVersion: status.rulesVersion,
  availableRoutes: status.availableRoutes,
  healthyRoutes: status.healthyRoutes,
  decisionHistory: status.decisionHistory,
  lastDecision: status.lastDecision,
});
```

### 决策历史

```typescript
// 获取最近的决策历史
const history = router.getDecisionHistory(10);
history.forEach(decision => {
  console.log(`决策 ${decision.requestId}:`, {
    provider: decision.selectedProvider,
    model: decision.selectedModel,
    confidence: decision.confidence,
    processingTime: decision.processingTime,
  });
});
```

## 测试示例

### 单元测试

```typescript
describe('CoreRouter', () => {
  let router: CoreRouter;
  let testConfig: RouterConfig;

  beforeEach(() => {
    testConfig = {
      // 测试配置
    };
    router = new CoreRouter(testConfig);
  });

  it('应该成功路由到可用的Provider', async () => {
    // 设置测试路由
    const routes: RouteInfo[] = [
      {
        id: 'test-route',
        providerId: 'test-provider',
        providerType: 'openai',
        supportedModels: ['test-model'],
        weight: 1.0,
        available: true,
        healthStatus: 'healthy',
        tags: [],
        metadata: {},
      },
    ];
    router.updateAvailableRoutes(routes);

    // 创建测试请求
    const request: RoutingRequest = {
      id: 'test-req',
      model: 'test-model',
      priority: 'normal',
      metadata: {
        originalFormat: 'openai',
        targetFormat: 'openai',
      },
      timestamp: new Date(),
    };

    // 执行路由决策
    const decision = await router.route(request);

    // 验证结果
    expect(decision.selectedProvider).toBe('test-provider');
    expect(decision.selectedModel).toBe('test-model');
    expect(decision.confidence).toBeGreaterThan(0);
  });

  it('应该在没有可用Provider时抛出错误', async () => {
    const request: RoutingRequest = {
      id: 'test-req',
      model: 'test-model',
      priority: 'normal',
      metadata: {
        originalFormat: 'openai',
        targetFormat: 'openai',
      },
      timestamp: new Date(),
    };

    await expect(router.route(request)).rejects.toThrow(ProviderUnavailableError);
  });
});
```

### 集成测试

```typescript
describe('CoreRouter Integration', () => {
  it('应该与真实的LM Studio Provider集成', async () => {
    const config = loadRealConfig();
    const router = new CoreRouter(config);

    const routes = await discoverAvailableRoutes();
    router.updateAvailableRoutes(routes);

    const request = createRealRequest();
    const decision = await router.route(request);

    expect(decision.selectedProvider).toBeDefined();
    expect(decision.estimatedLatency).toBeLessThan(1000);
  });
});
```

## 配置验证

### 验证路由配置

```typescript
const validation = router.validateConfig(config);

if (!validation.isValid) {
  console.error('配置验证失败:');
  validation.errors.forEach(error => {
    console.error(`- ${error.path}: ${error.message}`);
  });
}

if (validation.warnings.length > 0) {
  console.warn('配置警告:');
  validation.warnings.forEach(warning => {
    console.warn(`- ${warning.path}: ${warning.message}`);
  });
}
```

### 必需配置检查

路由器会自动验证以下必需配置：

- `zeroFallbackPolicy.enabled` 必须为 `true`
- `routingRules.defaultRule` 必须存在
- `performance.maxConcurrentDecisions` 必须大于0

## 最佳实践

### 1. 路由规则设计

- **优先级明确**: 使用 `rulePriority` 明确规则优先级
- **条件具体**: 路由条件要具体和可测试
- **权重合理**: Provider权重要基于实际性能设置

### 2. 性能优化

- **缓存决策**: 启用决策缓存减少重复计算
- **限制并发**: 设置合理的并发决策数量限制
- **监控历史**: 保留适量的决策历史用于分析

### 3. 错误处理

- **分类处理**: 根据错误类型进行不同的处理
- **上下文记录**: 记录完整的错误上下文用于调试
- **优雅降级**: 在业务层实现优雅降级逻辑

### 4. 监控和调试

- **启用日志**: 在开发环境启用详细日志
- **性能监控**: 监控路由决策的延迟和成功率
- **状态检查**: 定期检查路由器和Provider状态

## 更新日志

### v4.0.0-beta.1

- 初始版本发布
- 实现核心路由决策功能
- 支持零Fallback策略
- 完整的TypeScript类型支持

## 贡献指南

1. 确保所有代码都有完整的TypeScript类型
2. 添加适当的单元测试覆盖
3. 遵循零Fallback策略原则
4. 更新相关文档

## 许可证

MIT License - 详见 LICENSE 文件
