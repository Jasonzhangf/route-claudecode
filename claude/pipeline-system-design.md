# Claude Code Router v4.0 流水线系统设计（修正版）

## 1. 整体架构

Claude Code Router v4.0采用四层流水线架构，严格按照数据流向和格式要求进行设计：

```
请求流向：
Client → Router → Transformer → Protocol → ServerCompatibility → Server

响应流向：
Server → ServerCompatibility → Protocol → Transformer → Client
```

## 2. 各层职责详解

### 2.1 Client Layer (客户端层)
- **输入**：用户请求，标准Claude格式
- **输出**：Anthropic API格式请求
- **职责**：接收用户请求，保持Anthropic格式

### 2.2 Router Layer (路由层)
- **输入**：Anthropic格式 + 模型名
- **输出**：Anthropic格式 + 路由决策
- **职责**：仅做模型映射和路由选择，不改变格式

### 2.3 Transformer Layer (转换层)
- **输入**：Anthropic格式请求 / OpenAI格式响应
- **输出**：OpenAI格式请求 / Anthropic格式响应
- **职责**：
  - 请求转换：Anthropic → OpenAI 协议格式转换
  - 响应转换：OpenAI → Anthropic 协议格式转换
  - 工具调用格式转换：Anthropic tools ↔ OpenAI tools

### 2.4 Protocol Layer (协议层)
- **输入**：OpenAI格式请求 / OpenAI格式响应
- **输出**：OpenAI格式请求 / OpenAI格式响应
- **职责**：
  - 流式 ↔ 非流式转换
  - 协议内控制和验证
  - 协议错误处理
  - 模型名映射和端点配置

### 2.5 ServerCompatibility Layer (服务器兼容层)
- **输入**：OpenAI格式请求 / OpenAI格式响应
- **输出**：OpenAI格式请求 / OpenAI格式响应
- **职责**：
  - 请求兼容性处理：Provider特定的字段调整
  - 响应兼容性处理：Provider特定的格式标准化
  - 参数范围限制和优化
  - Provider特定的错误处理

### 2.6 Server Layer (服务器层)
- **输入**：OpenAI格式请求
- **输出**：Provider响应 (通常OpenAI格式)
- **职责**：纯HTTP请求，无格式转换

## 3. 双向转换机制

### 3.1 Transformer模块双向转换
```typescript
interface BidirectionalTransformer {
  transformRequest(input: any): Promise<any>;  // Anthropic → OpenAI
  transformResponse(input: any): Promise<any>; // OpenAI → Anthropic
}
```

### 3.2 Protocol模块双向转换
```typescript
interface ProtocolController {
  processRequest(input: any): Promise<any>;  // 协议内请求控制
  processResponse(input: any): Promise<any>; // 协议内响应控制
}
```

### 3.3 ServerCompatibility模块双向转换
```typescript
interface BidirectionalCompatibility {
  processRequest(request: any, context: any): Promise<any>;  // 请求兼容性处理
  processResponse(response: any, context: any): Promise<any>; // 响应兼容性处理
}
```

## 4. 流水线组装和连接

### 4.1 模块连接机制
- 使用 `addConnection()` 方法建立模块间的双向连接
- 通过 `sendToModule()` 和 `broadcastToModules()` 实现模块间通信
- 每个模块维护一个连接映射表 `connections: Map<string, ModuleInterface>`

### 4.2 数据流向控制
```
请求流向：
1. Client → Router (Anthropic格式)
2. Router → Transformer (Anthropic格式)
3. Transformer → Protocol (OpenAI格式)
4. Protocol → ServerCompatibility (OpenAI格式)
5. ServerCompatibility → Server (OpenAI格式)
6. Server执行HTTP请求

响应流向：
1. Server → ServerCompatibility (OpenAI格式)
2. ServerCompatibility → Protocol (OpenAI格式)
3. Protocol → Transformer (OpenAI格式)
4. Transformer → Client (Anthropic格式)
```

### 4.3 流水线执行流程
1. **初始化**：各模块通过 `start()` 方法启动
2. **请求处理**：从第一个模块开始逐层传递数据
3. **响应处理**：从最后一个模块开始逐层返回数据
4. **错误处理**：各层独立处理错误，不影响其他层
5. **资源清理**：通过 `cleanup()` 方法释放资源

## 5. 模块接口标准化

### 5.1 统一模块接口
所有模块实现 `ModuleInterface` 接口：
- `getId()`: 获取模块ID
- `getName()`: 获取模块名称
- `getType()`: 获取模块类型
- `getVersion()`: 获取模块版本
- `getStatus()`: 获取模块状态
- `getMetrics()`: 获取性能指标
- `configure()`: 配置模块
- `start()`: 启动模块
- `stop()`: 停止模块
- `process()`: 处理数据
- `reset()`: 重置模块
- `cleanup()`: 清理资源
- `healthCheck()`: 健康检查

### 5.2 连接管理接口
- `addConnection(module: ModuleInterface)`: 添加连接
- `removeConnection(moduleId: string)`: 移除连接
- `getConnection(moduleId: string)`: 获取连接
- `getConnections()`: 获取所有连接
- `hasConnection(moduleId: string)`: 检查连接是否存在
- `clearConnections()`: 清空所有连接
- `getConnectionCount()`: 获取连接数量

### 5.3 模块间通信接口
- `sendToModule(targetModuleId: string, message: any, type?: string)`: 发送消息到指定模块
- `broadcastToModules(message: any, type?: string)`: 广播消息到所有连接的模块
- `onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void)`: 监听模块消息

## 6. 错误处理和日志记录

### 6.1 统一错误类型
- `TransformerSecurityError`: Transformer安全错误
- `ProtocolError`: 协议错误
- `ValidationError`: 验证错误
- `TransformError`: 转换错误
- `RCCError`: 通用RCC错误

### 6.2 日志记录机制
- 使用 `secureLogger` 进行结构化日志记录
- 包含请求ID、时间戳、模块ID等上下文信息
- 支持不同日志级别：debug、info、warn、error

## 7. 配置管理和上下文传递

### 7.1 配置驱动设计
- 所有配置通过配置文件管理
- 支持动态配置更新
- 配置验证和默认值处理

### 7.2 上下文传递
```typescript
interface ModuleProcessingContext {
  readonly requestId: string;
  readonly providerName?: string;
  readonly protocol?: string;
  readonly config?: {
    readonly endpoint?: string;
    readonly apiKey?: string;
    readonly timeout?: number;
    readonly maxRetries?: number;
    readonly actualModel?: string;
    readonly originalModel?: string;
    readonly serverCompatibility?: string;
  };
  metadata?: {
    architecture?: string;
    layer?: string;
    protocolConfig?: {
      endpoint?: string;
      apiKey?: string;
      protocol?: string;
      timeout?: number;
      maxRetries?: number;
      customHeaders?: Record<string, string>;
    };
    [key: string]: any;
  };
}
```

## 8. 性能优化和监控

### 8.1 性能指标
- `requestsProcessed`: 处理请求数量
- `averageProcessingTime`: 平均处理时间
- `errorRate`: 错误率
- `memoryUsage`: 内存使用量
- `cpuUsage`: CPU使用量

### 8.2 监控机制
- 实时性能指标收集
- 健康检查和状态报告
- 资源使用监控

这个流水线系统设计确保了Claude Code Router能够高效、可靠地处理Anthropic到OpenAI的双向协议转换，同时保持各层职责的清晰分离和系统的可扩展性。