# HTTP服务器模块

RCC v4.0 HTTP服务器模块采用组件化架构设计，将大型单体类拆分为多个专注的组件，提高了代码的可维护性和可测试性。

## 架构概览

模块被拆分为以下核心组件：

### 1. HTTPServer (主类)
- **职责**: 服务器生命周期管理、组件协调
- **功能**: 启动/停止服务器、状态管理、组件组合

### 2. HTTPContextManager
- **职责**: HTTP请求/响应上下文管理
- **功能**: 请求体解析、响应发送、上下文创建

### 3. HTTPRoutingSystemImpl
- **职责**: 路由系统管理
- **功能**: 路由注册、路径匹配、路由执行

### 4. HTTPRequestHandlersImpl
- **职责**: 内置请求处理
- **功能**: 健康检查、状态查询、版本信息

### 5. AnthropicMessageHandlerImpl
- **职责**: Anthropic消息处理
- **功能**: 消息路由、流水线执行、调试记录

### 6. HTTPErrorCenter
- **职责**: HTTP错误处理
- **功能**: 错误响应生成、与错误处理系统协同

## 设计原则

1. **单一职责**: 每个组件只负责一个明确的功能领域
2. **组合优于继承**: 通过组合实现功能，而非深层继承
3. **接口隔离**: 明确定义的组件接口，降低耦合度
4. **零接口暴露**: 内部实现细节完全封装
5. **高内聚低耦合**: 组件内部高度相关，组件间依赖最小化

## 使用方法

```typescript
import { HTTPServer } from './http-server';

// 创建服务器实例
const config = { port: 5506, host: '0.0.0.0' };
const server = new HTTPServer(config);

// 启动服务器
await server.start();

// 集成流水线
server.setPipelines(pipelineArray, true);

// 获取服务器状态
const status = server.getStatus();
```

## 组件交互

```
HTTPServer
├── HTTPContextManager (请求/响应处理)
├── HTTPRoutingSystemImpl (路由管理)
├── HTTPRequestHandlersImpl (内置请求处理)
├── AnthropicMessageHandlerImpl (Anthropic消息处理)
└── HTTPErrorCenter (错误处理)
```

## 优势

1. **可维护性**: 每个组件职责明确，易于理解和修改
2. **可测试性**: 组件可独立测试，提高测试覆盖率
3. **可扩展性**: 新功能可作为独立组件添加
4. **性能**: 减少不必要的代码加载和执行
5. **稳定性**: 组件间隔离降低错误传播风险