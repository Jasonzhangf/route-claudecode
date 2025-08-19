# 路由模块 (Routes Module)

## 模块概述

路由模块负责定义和管理RCC v4.0系统的HTTP路由规则，包括API端点、路由参数和路由处理函数。

## 模块职责

1. **路由定义**: 定义系统的HTTP API路由规则
2. **路由匹配**: 根据请求URL匹配相应的路由处理函数
3. **参数处理**: 处理路由参数和查询参数
4. **路由验证**: 验证路由的合法性和完整性

## 模块结构

```
routes/
├── README.md                           # 本模块设计文档
├── index.ts                            # 模块入口和导出
├── route-manager.ts                    # 路由管理器
├── api-routes.ts                       # API路由定义
├── health-routes.ts                    # 健康检查路由
├── debug-routes.ts                     # 调试路由
├── admin-routes.ts                     # 管理路由
├── pipeline-routes.ts                  # 流水线路由
├── provider-routes.ts                  # Provider路由
├── config-routes.ts                    # 配置路由
├── metrics-routes.ts                   # 指标路由
├── auth-routes.ts                      # 认证路由
├── proxy-routes.ts                     # 代理路由
├── webhook-routes.ts                   # Webhook路由
├── param-validator.ts                  # 参数验证器
├── route-matcher.ts                    # 路由匹配器
└── types/                              # 路由相关类型定义
    ├── route-types.ts                  # 路由类型定义
    └── handler-types.ts                # 处理函数类型定义
```

## 接口定义

### RouteManagerInterface

```typescript
interface RouteManagerInterface {
  addRoute(route: RouteDefinition): void;
  removeRoute(path: string, method: string): void;
  matchRoute(url: string, method: string): MatchedRoute | null;
  getAllRoutes(): RouteDefinition[];
}
```

### RouteHandler

```typescript
type RouteHandler = (req: RequestContext, res: ResponseContext) => void | Promise<void>;
```

## 子模块详细说明

### 路由管理器

负责路由的注册、管理和匹配。

### API路由定义

定义系统的主API端点，包括核心功能API。

### 健康检查路由

提供系统健康状态检查的端点。

### 调试路由

提供调试和测试相关的端点。

### 管理路由

提供系统管理和配置相关的端点。

### 流水线路由

处理与流水线管理相关的API请求。

### Provider路由

处理与AI Provider管理相关的API请求。

### 配置路由

处理系统配置管理相关的API请求。

### 指标路由

提供系统性能指标和监控数据。

### 认证路由

处理用户认证和授权相关的API请求。

### 代理路由

处理AI请求代理功能。

### Webhook路由

处理外部Webhook回调。

### 参数验证器

验证路由参数的合法性和完整性。

### 路由匹配器

根据请求URL匹配相应的路由定义。

## 依赖关系

- 依赖Server模块的HTTP处理功能
- 依赖Config模块获取路由配置
- 依赖Middleware模块处理请求预处理

## 设计原则

1. **RESTful设计**: 遵循RESTful API设计原则
2. **清晰性**: 路由结构清晰，易于理解和维护
3. **安全性**: 路由访问控制，防止未授权访问
4. **可扩展**: 易于添加新的路由和API端点
5. **一致性**: 保持路由命名和结构的一致性
