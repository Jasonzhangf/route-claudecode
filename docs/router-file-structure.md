# RCC4 路由器文件结构和组织规范

## 📁 推荐目录结构

### 完整文件组织架构

```
src/modules/router/
├── README.md                    # 路由器模块总体说明
├── index.ts                     # 统一导出入口
├── types/                       # 共享类型定义
│   ├── index.ts                 # 类型统一导出
│   ├── routing-types.ts         # 路由相关类型
│   ├── config-types.ts          # 配置相关类型
│   ├── health-types.ts          # 健康检查类型
│   ├── metrics-types.ts         # 监控指标类型
│   └── error-types.ts           # 错误类型定义
├── core/                        # 核心路由器模块
│   ├── README.md                # 核心路由器说明
│   ├── index.ts                 # 核心模块导出
│   ├── core-router.ts           # 主路由器实现
│   ├── routing-engine.ts        # 路由决策引擎
│   ├── route-matcher.ts         # 路由规则匹配器
│   └── __tests__/               # 核心模块测试
│       ├── core-router.test.ts
│       ├── routing-engine.test.ts
│       └── route-matcher.test.ts
├── load-balancer/               # 负载均衡模块
│   ├── README.md                # 负载均衡器说明
│   ├── index.ts                 # 负载均衡模块导出
│   ├── load-balancer.ts         # 负载均衡器接口
│   ├── load-balance-manager.ts  # 负载均衡管理器
│   ├── strategies/              # 负载均衡策略
│   │   ├── index.ts             # 策略统一导出
│   │   ├── base-strategy.ts     # 基础策略抽象类
│   │   ├── round-robin.ts       # 轮询策略
│   │   ├── weighted.ts          # 加权策略
│   │   ├── least-connections.ts # 最少连接策略
│   │   ├── health-aware.ts      # 健康感知策略
│   │   └── adaptive.ts          # 自适应策略
│   └── __tests__/               # 负载均衡测试
│       ├── load-balancer.test.ts
│       ├── load-balance-manager.test.ts
│       └── strategies/
│           ├── round-robin.test.ts
│           ├── weighted.test.ts
│           └── least-connections.test.ts
├── health-checker/              # 健康检查模块
│   ├── README.md                # 健康检查器说明
│   ├── index.ts                 # 健康检查模块导出
│   ├── health-checker.ts        # 健康检查器接口
│   ├── provider-health-monitor.ts # Provider健康监控
│   ├── health-status-manager.ts # 健康状态管理
│   ├── recovery-manager.ts      # 恢复状态管理
│   ├── health-evaluator.ts      # 健康评估器
│   └── __tests__/               # 健康检查测试
│       ├── health-checker.test.ts
│       ├── provider-health-monitor.test.ts
│       ├── health-status-manager.test.ts
│       └── recovery-manager.test.ts
├── config-manager/              # 配置管理模块
│   ├── README.md                # 配置管理器说明
│   ├── index.ts                 # 配置管理模块导出
│   ├── config-manager.ts        # 配置管理器接口
│   ├── config-loader.ts         # 配置加载器
│   ├── config-validator.ts      # 配置验证器
│   ├── config-watcher.ts        # 配置监听器
│   ├── config-transformer.ts    # 配置转换器
│   ├── schemas/                 # 配置Schema定义
│   │   ├── index.ts             # Schema统一导出
│   │   ├── router-config.ts     # 路由器配置Schema
│   │   ├── provider-config.ts   # Provider配置Schema
│   │   ├── load-balance-config.ts # 负载均衡配置Schema
│   │   └── health-config.ts     # 健康检查配置Schema
│   └── __tests__/               # 配置管理测试
│       ├── config-manager.test.ts
│       ├── config-loader.test.ts
│       ├── config-validator.test.ts
│       └── config-watcher.test.ts
├── key-manager/                 # API Key管理模块
│   ├── README.md                # Key管理器说明
│   ├── index.ts                 # Key管理模块导出
│   ├── key-manager.ts           # Key管理器接口
│   ├── key-selector.ts          # Key选择器
│   ├── key-rotation.ts          # Key轮询管理
│   ├── rate-limit-handler.ts    # 速率限制处理
│   ├── key-pool-manager.ts      # Key池管理器
│   ├── quota-tracker.ts         # 配额跟踪器
│   └── __tests__/               # Key管理测试
│       ├── key-manager.test.ts
│       ├── key-selector.test.ts
│       ├── key-rotation.test.ts
│       └── rate-limit-handler.test.ts
├── metrics/                     # 监控指标模块
│   ├── README.md                # 指标收集器说明
│   ├── index.ts                 # 指标模块导出
│   ├── metrics-collector.ts     # 指标收集器接口
│   ├── request-tracker.ts       # 请求跟踪器
│   ├── performance-monitor.ts   # 性能监控器
│   ├── error-tracker.ts         # 错误跟踪器
│   ├── metrics-aggregator.ts    # 指标聚合器
│   ├── exporters/               # 指标导出器
│   │   ├── index.ts             # 导出器统一导出
│   │   ├── console-exporter.ts  # 控制台导出器
│   │   ├── json-exporter.ts     # JSON文件导出器
│   │   └── prometheus-exporter.ts # Prometheus导出器
│   └── __tests__/               # 指标收集测试
│       ├── metrics-collector.test.ts
│       ├── request-tracker.test.ts
│       ├── performance-monitor.test.ts
│       └── error-tracker.test.ts
├── factory/                     # 工厂模块
│   ├── README.md                # 工厂模式说明
│   ├── index.ts                 # 工厂模块导出
│   ├── router-factory.ts        # 路由器工厂
│   ├── load-balancer-factory.ts # 负载均衡器工厂
│   ├── health-checker-factory.ts # 健康检查器工厂
│   └── __tests__/               # 工厂测试
│       ├── router-factory.test.ts
│       ├── load-balancer-factory.test.ts
│       └── health-checker-factory.test.ts
├── utils/                       # 工具函数模块
│   ├── README.md                # 工具函数说明
│   ├── index.ts                 # 工具函数导出
│   ├── router-utils.ts          # 路由工具函数
│   ├── validation-utils.ts      # 验证工具函数
│   ├── timing-utils.ts          # 时间工具函数
│   ├── math-utils.ts            # 数学工具函数
│   └── __tests__/               # 工具函数测试
│       ├── router-utils.test.ts
│       ├── validation-utils.test.ts
│       └── timing-utils.test.ts
└── __tests__/                   # 集成测试
    ├── integration/             # 集成测试
    │   ├── router-integration.test.ts
    │   ├── load-balancer-integration.test.ts
    │   └── health-check-integration.test.ts
    ├── e2e/                     # 端到端测试
    │   ├── full-routing-flow.test.ts
    │   ├── failover-scenarios.test.ts
    │   └── performance-benchmarks.test.ts
    └── fixtures/                # 测试夹具
        ├── sample-configs/
        ├── mock-providers/
        └── test-data/
```

## 📝 文件命名约定

### TypeScript文件命名规则

1. **接口文件**: `{module-name}.ts`
   - 例如: `health-checker.ts`, `load-balancer.ts`

2. **实现文件**: `{module-name}-{type}.ts`
   - 例如: `provider-health-monitor.ts`, `round-robin-strategy.ts`

3. **类型定义**: `{category}-types.ts`
   - 例如: `routing-types.ts`, `config-types.ts`

4. **工具函数**: `{purpose}-utils.ts`
   - 例如: `validation-utils.ts`, `timing-utils.ts`

5. **测试文件**: `{target}.test.ts`
   - 例如: `core-router.test.ts`, `load-balancer.test.ts`

### 目录命名规则

1. **功能模块**: 使用`kebab-case`
   - 例如: `load-balancer/`, `health-checker/`, `config-manager/`

2. **类型目录**: 使用复数形式
   - 例如: `types/`, `strategies/`, `exporters/`

3. **测试目录**: 固定使用`__tests__`
   - 遵循Jest测试框架约定

## 🏗️ 模块组织原则

### 1. 单一职责原则

每个模块/文件只负责一个明确的功能：

```typescript
// ✅ 正确：单一职责
// file: core-router.ts
export class CoreRouter implements RouterInterface {
  // 只负责路由决策逻辑
}

// ❌ 错误：多重职责
// file: router-with-everything.ts
export class RouterWithEverything {
  // 路由 + 负载均衡 + 健康检查 + 配置管理
}
```

### 2. 接口隔离原则

定义细粒度的接口，避免大而全的接口：

```typescript
// ✅ 正确：细粒度接口
export interface HealthChecker {
  checkHealth(providerId: string): Promise<HealthStatus>;
}

export interface HealthStatusManager {
  getHealthStatus(providerId: string): HealthStatus;
  updateHealthStatus(providerId: string, status: HealthStatus): void;
}

// ❌ 错误：大而全接口
export interface MonolithicInterface {
  checkHealth(...): Promise<HealthStatus>;
  loadBalance(...): Provider;
  routeRequest(...): Decision;
  manageConfig(...): void;
}
```

### 3. 依赖方向原则

依赖关系应该从具体到抽象：

```
Core Router (具体)
    ↓ depends on
Load Balancer Interface (抽象)
    ↑ implemented by
Weighted Strategy (具体)
```

### 4. 配置外部化原则

所有配置通过外部注入，不在代码中硬编码：

```typescript
// ✅ 正确：依赖注入
export class CoreRouter {
  constructor(
    private config: RouterConfig,
    private loadBalancer: LoadBalancer,
    private healthChecker: HealthChecker
  ) {}
}

// ❌ 错误：硬编码依赖
export class BadRouter {
  private loadBalancer = new WeightedLoadBalancer();
  private healthChecker = new SimpleHealthChecker();
}
```

## 📊 导入/导出规范

### 统一导出模式

每个模块都应该有清晰的导出结构：

```typescript
// src/modules/router/core/index.ts
export { CoreRouter } from './core-router';
export { RoutingEngine } from './routing-engine';
export { RouteMatcher } from './route-matcher';
export * from './types';

// src/modules/router/index.ts
export * from './core';
export * from './load-balancer';
export * from './health-checker';
export * from './config-manager';
export * from './key-manager';
export * from './metrics';
export * from './types';
```

### 导入规范

```typescript
// ✅ 正确：分层导入
import { CoreRouter } from '../core';
import { LoadBalancer } from '../load-balancer';
import { HealthChecker } from '../health-checker';
import { RouterConfig } from '../types';

// ✅ 正确：相对导入同模块内文件
import { RoutingEngine } from './routing-engine';
import { RouteMatcher } from './route-matcher';

// ❌ 错误：跨模块内部导入
import { WeightedStrategy } from '../load-balancer/strategies/weighted';
```

## 🧪 测试组织规范

### 测试文件结构

```typescript
// 测试文件模板
describe('ModuleName', () => {
  describe('constructor', () => {
    // 构造函数测试
  });

  describe('publicMethod', () => {
    describe('when valid input', () => {
      it('should return expected result', () => {
        // 正常情况测试
      });
    });

    describe('when invalid input', () => {
      it('should throw specific error', () => {
        // 错误情况测试
      });
    });
  });

  describe('edge cases', () => {
    // 边界情况测试
  });
});
```

### 测试文件命名

1. **单元测试**: `{target}.test.ts`
2. **集成测试**: `{feature}-integration.test.ts`
3. **端到端测试**: `{scenario}-e2e.test.ts`

### Mock和Fixture组织

```
__tests__/
├── fixtures/
│   ├── configs/                 # 测试配置文件
│   ├── responses/               # 模拟响应数据
│   └── requests/                # 模拟请求数据
├── mocks/
│   ├── providers/               # Provider模拟
│   ├── services/                # 服务模拟
│   └── utils/                   # 工具函数模拟
└── helpers/
    ├── test-setup.ts           # 测试环境设置
    ├── assertion-helpers.ts    # 断言辅助函数
    └── mock-builders.ts        # Mock构建器
```

## 📚 文档组织规范

### README文档结构

每个模块的README应包含：

1. **模块概述**
2. **核心功能**
3. **API文档**
4. **使用示例**
5. **配置说明**
6. **故障排除**

### README模板

```markdown
# {Module Name}

## 概述
{模块的核心职责和作用}

## 核心功能
- 功能1：{描述}
- 功能2：{描述}

## API文档
### {Interface Name}
{接口说明和方法文档}

## 使用示例
```typescript
// 示例代码
```

## 配置说明
{配置选项说明}

## 测试
{如何运行测试}

## 故障排除
{常见问题和解决方案}
```

## 🔧 构建和打包组织

### TypeScript配置

```json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@router/*": ["modules/router/*"],
      "@router/core": ["modules/router/core"],
      "@router/types": ["modules/router/types"],
      "@router/load-balancer": ["modules/router/load-balancer"],
      "@router/health-checker": ["modules/router/health-checker"]
    }
  }
}
```

### 包导出结构

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./core": "./dist/core/index.js",
    "./load-balancer": "./dist/load-balancer/index.js",
    "./health-checker": "./dist/health-checker/index.js",
    "./config-manager": "./dist/config-manager/index.js",
    "./key-manager": "./dist/key-manager/index.js",
    "./metrics": "./dist/metrics/index.js",
    "./types": "./dist/types/index.js"
  }
}
```

---

**组织原则确认**:
- ✅ 清晰的模块边界和职责分离
- ✅ 统一的命名约定和文件结构
- ✅ 合理的依赖关系和导入导出规范
- ✅ 完整的测试组织和文档结构
- ✅ 支持渐进式开发和独立测试