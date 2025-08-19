# 路由器模块 (Router Module)

## 模块概述

路由器模块负责请求路由、配置管理和负载均衡。它是RCC v4.0系统的核心路由组件，决定请求如何被处理和转发。

## 模块职责

1. **请求路由**: 根据请求特征将请求路由到适当的流水线
2. **配置管理**: 管理和验证系统配置
3. **负载均衡**: 在多个可用的Provider之间分配请求负载
4. **会话流控**: 管理会话级别的流控和队列管理

## 模块结构

```
router/
├── README.md                        # 本模块设计文档
├── index.ts                         # 模块入口和导出
├── config/                          # 配置管理子模块
│   ├── config-manager.ts            # 配置管理器
│   ├── config-validator.ts          # 配置验证器
│   └── config-loader.ts             # 配置加载器
├── routing/                         # 路由管理子模块
│   ├── request-router.ts            # 请求路由器
│   ├── routing-strategy.ts          # 路由策略管理器
│   └── route-selector.ts            # 路由选择器
├── flow-control/                    # 流控管理子模块
│   ├── session-flow-controller.ts   # 会话流控管理器
│   ├── queue-manager.ts             # 队列管理器
│   └── priority-scheduler.ts        # 优先级调度器
└── load-balancing/                  # 负载均衡子模块
    ├── load-balancer.ts             # 负载均衡器
    ├── health-monitor.ts            # 健康监控器
    └── failover-manager.ts          # 故障切换管理器
```

## 接口定义

### RouterInterface

```typescript
interface RouterInterface {
  initialize(): Promise<void>;
  routeRequest(request: any): Promise<RouteResult>;
  getConfig(): RouterConfig;
  updateConfig(config: RouterConfig): Promise<void>;
  getRouteStats(): RouteStatistics;
}
```

### ConfigManagerInterface

```typescript
interface ConfigManagerInterface {
  loadConfig(): Promise<RouterConfig>;
  validateConfig(config: RouterConfig): boolean;
  watchConfig(): void;
  getConfig(): RouterConfig;
}
```

## 子模块详细说明

### 配置管理子模块

负责加载、验证和监控配置文件的变化，确保系统配置的正确性和实时性。

### 路由管理子模块

实现智能请求路由功能，根据请求特征选择最优的处理路径。

### 流控管理子模块

实现基于会话的流控机制，确保请求按顺序处理，防止系统过载。

### 负载均衡子模块

在多个可用Provider之间智能分配请求，提高系统可用性和性能。

## 依赖关系

- 依赖配置模块获取路由配置
- 依赖流水线模块执行路由决策
- 依赖Debug模块记录路由过程

## 设计原则

1. **智能路由**: 根据请求特征和系统状态智能选择路由路径
2. **高可用性**: 通过负载均衡和故障切换确保服务可用性
3. **可配置性**: 支持灵活的路由策略配置
4. **可观测性**: 提供详细的路由统计和监控信息
