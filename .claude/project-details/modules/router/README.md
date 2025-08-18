# 路由器模块 (Router Module)

## 模块概述

路由器模块是RCC v4.0系统的核心调度中心，负责配置管理、请求路由、负载均衡和流水线生命周期管理。

## 模块职责

1. **配置管理**: 读取、验证和管理系统配置文件
2. **请求路由**: 根据配置和请求特征将请求路由到合适的流水线
3. **负载均衡**: 在多个可用Provider之间智能分配请求负载
4. **会话流控**: 管理会话级别的请求队列和顺序处理
5. **流水线管理**: 动态创建、销毁和监控流水线实例

## 模块结构

```
router/
├── README.md                        # 本模块设计文档
├── index.ts                         # 模块入口和导出
├── router-manager.ts                # 路由器管理器
├── config/                          # 配置管理子模块
│   └── config-manager.ts            # 配置管理器
├── routing/                         # 路由管理子模块
│   └── request-router.ts            # 请求路由器
├── flow-control/                    # 流控管理子模块
│   └── session-flow-controller.ts   # 会话流控管理器
├── load-balancing/                  # 负载均衡子模块
│   └── load-balancer.ts             # 负载均衡器
└── pipeline/                        # 流水线管理子模块
    └── pipeline-manager.ts          # 流水线管理器
```

## 核心组件

### 路由器管理器 (RouterManager)
协调路由器模块的所有功能，是模块的主入口点。

### 配置管理器 (ConfigManager)
负责加载、验证和监控系统配置文件的变化。

### 请求路由器 (RequestRouter)
实现智能请求路由逻辑，根据请求特征选择合适的处理流水线。

### 会话流控管理器 (SessionFlowController)
实现基于会话的流控机制，确保请求按顺序处理。

### 负载均衡器 (LoadBalancer)
在多个可用Provider之间智能分配请求负载。

### 流水线管理器 (PipelineManager)
管理流水线实例的生命周期，包括创建、销毁和监控。

## 接口定义

```typescript
interface RouterModuleInterface {
  initialize(): Promise<void>;
  routeRequest(request: RCCRequest): Promise<RCCResponse>;
  getConfig(): Promise<RouterConfig>;
  updateConfig(config: RouterConfig): Promise<void>;
  getRouteStats(): Promise<RouteStatistics>;
}
```

## 依赖关系

- 依赖配置模块获取路由配置
- 依赖流水线模块执行路由决策
- 被客户端模块调用以处理请求路由

## 设计原则

1. **智能路由**: 根据请求特征和系统状态智能选择路由路径
2. **高可用性**: 通过负载均衡和故障切换确保服务可用性
3. **可配置性**: 支持灵活的路由策略配置
4. **可观测性**: 提供详细的路由统计和监控信息
5. **会话一致性**: 确保同一对话内请求的顺序处理