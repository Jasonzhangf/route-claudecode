# 错误处理模块 (Error Handler Module) - 统一错误协调重构版

## 模块概述

错误处理模块是RCC v4.0系统的统一错误管理中心，负责捕获、处理、记录和报告系统中的所有错误。采用增强的错误协调中心设计，提供统一的错误处理流程和分类管理。

## 核心设计理念

### ✅ 统一错误协调中心
- **集中管理**: 所有错误通过统一的协调中心处理
- **分类处理**: 不同类型的错误采用不同的处理策略
- **上下文保留**: 完整的错误上下文信息保留和传递
- **链式追踪**: 支持完整的错误链追踪机制

### 🔒 安全性原则
- **敏感信息过滤**: 自动过滤和保护敏感错误信息
- **安全日志**: 安全日志记录和审计机制
- **权限控制**: 错误处理的权限控制和访问限制

## 模块结构

```
error-handler/
├── README.md                          # 本模块设计文档
├── index.ts                           # 模块入口和导出
├── enhanced-error-handler.ts           # 增强错误处理器
├── error-classifier.ts                # 错误分类器
├── error-log-cli.ts                   # 错误日志CLI
├── error-log-manager.ts               # 错误日志管理器
├── error-logger.ts                    # 错误记录器
├── unified-error-coordinator.ts       # 统一错误协调器
├── unified-error-processing-flow.ts   # 统一错误处理流程
├── unified-error-response-normalizer.ts # 统一错误响应标准化器
├── server-compatibility-error-adapter.ts # 服务器兼容性错误适配器
├── error-coordination-center-factory.ts # 错误协调中心工厂
├── utils/                             # 工具目录
│   ├── secure-logger.ts               # 安全日志记录器
│   └── jq-json-handler.ts             # JSON处理工具
└── types/                             # 类型定义目录
    ├── error-types.ts                 # 错误类型定义
    └── error-handler-types.ts         # 错误处理器类型定义
```

## 核心组件

### 统一错误协调器 (UnifiedErrorCoordinator) - 核心协调组件
负责错误处理的统一协调和分发：

#### 功能特性
- **错误接收**: 接收系统中所有类型的错误
- **分类处理**: 根据错误类型进行分类处理
- **策略执行**: 执行预定义的错误处理策略
- **日志记录**: 统一的错误日志记录机制
- **响应生成**: 生成标准化的错误响应

#### 接口定义
```typescript
class UnifiedErrorCoordinator {
  // 错误处理主方法
  async handleError(error: any, context?: ErrorContext): Promise<ErrorHandlingResult>;
  
  // 错误分类
  classifyError(error: any): ErrorClassification;
  
  // 策略执行
  executeStrategy(error: any, classification: ErrorClassification): Promise<ErrorHandlingResult>;
  
  // 日志记录
  logError(error: any, context?: ErrorContext): void;
  
  // 响应生成
  generateResponse(error: any, classification: ErrorClassification): ErrorResponse;
}
```

### 增强错误处理器 (EnhancedErrorHandler) - 增强处理组件
提供增强的错误处理功能：

#### 功能特性
- **多层处理**: 支持多层错误处理机制
- **重试机制**: 自动重试和错误恢复
- **降级处理**: 优雅的错误降级处理
- **监控集成**: 与系统监控集成

### 错误分类器 (ErrorClassifier) - 智能分类组件
智能分类各种错误类型：

#### 功能特性
- **自动识别**: 自动识别错误类型和严重程度
- **上下文分析**: 分析错误上下文信息
- **模式匹配**: 基于模式匹配的错误分类
- **动态更新**: 支持分类规则的动态更新

### 安全日志记录器 (SecureLogger) - 安全日志组件
提供安全的日志记录功能：

#### 功能特性
- **敏感信息过滤**: 自动过滤敏感信息
- **结构化日志**: 结构化的日志格式
- **安全存储**: 安全日志存储机制
- **审计追踪**: 完整的审计追踪功能

## 错误分类体系

### 客户端错误 (ClientError)
- CLI命令错误
- 用户输入错误
- 客户端配置错误

### 路由器错误 (RouterError)
- 路由配置错误
- 路由决策错误
- 负载均衡错误

### 流水线错误 (PipelineError)
- 流水线创建错误
- 流水线执行错误
- 模块处理错误

### 配置错误 (ConfigError)
- 配置文件格式错误
- 配置内容验证错误
- 环境变量错误

### 网络错误 (NetworkError)
- 连接超时
- DNS解析错误
- SSL/TLS错误

### 验证错误 (ValidationError)
- 输入数据验证错误
- 输出数据验证错误
- 格式验证错误

### 服务器兼容性错误 (ServerCompatibilityError)
- 协议不兼容错误
- 参数适配错误
- 响应格式错误

## 统一错误处理流程

```
错误发生
    ↓
错误捕获 (try-catch)
    ↓
错误包装 (RCCError)
    ↓
统一错误协调器
    ↓
错误分类和优先级评估
    ↓
敏感信息过滤
    ↓
错误记录到安全日志系统
    ↓
执行预定义处理策略
    ↓
生成标准化错误响应
    ↓
错误统计和监控上报
```

## 错误处理策略

### 重试策略
- **网络错误重试**: 自动重试网络相关错误
- **配置错误重试**: 配置更新后的自动重试
- **服务错误重试**: 服务暂时不可用时的重试

### 降级策略
- **功能降级**: 部分功能不可用时的优雅降级
- **性能降级**: 高负载时的性能降级处理
- **响应降级**: 响应时间过长时的降级处理

### 通知策略
- **实时通知**: 严重错误的实时通知机制
- **定期报告**: 定期错误统计报告
- **阈值告警**: 错误数量超过阈值时的告警

## 接口定义

```typescript
interface ErrorHandlerModuleInterface {
  initialize(): Promise<void>;
  handleError(error: RCCError): Promise<ErrorHandlingResult>;
  formatError(error: RCCError): string;
  logError(error: RCCError): void;
  reportError(error: RCCError): void;
  getErrorStats(): ErrorStatistics;
}

interface UnifiedErrorCoordinatorInterface {
  handleClientError(error: ClientError, context?: ErrorContext): Promise<ErrorHandlingResult>;
  handleRouterError(error: RouterError, context?: ErrorContext): Promise<ErrorHandlingResult>;
  handlePipelineError(error: PipelineError, context?: ErrorContext): Promise<ErrorHandlingResult>;
  handleConfigError(error: ConfigError, context?: ErrorContext): Promise<ErrorHandlingResult>;
  handleNetworkError(error: NetworkError, context?: ErrorContext): Promise<ErrorHandlingResult>;
  handleValidationError(error: ValidationError, context?: ErrorContext): Promise<ErrorHandlingResult>;
}

interface ErrorFormatterInterface {
  formatClientError(error: ClientError): string;
  formatRouterError(error: RouterError): string;
  formatPipelineError(error: PipelineError): string;
  formatGenericError(error: RCCError): string;
  formatDetailedError(error: RCCError): string;
}

interface ErrorLoggerInterface {
  logClientError(error: ClientError, context?: ErrorContext): void;
  logRouterError(error: RouterError, context?: ErrorContext): void;
  logPipelineError(error: PipelineError, context?: ErrorContext): void;
  logConfigError(error: ConfigError, context?: ErrorContext): void;
  logNetworkError(error: NetworkError, context?: ErrorContext): void;
  logValidationError(error: ValidationError, context?: ErrorContext): void;
}
```

## 依赖关系

- **被所有其他模块依赖**以处理错误
- **依赖安全日志模块**进行错误记录
- **依赖配置模块**获取错误处理配置
- **依赖调试模块**获取调试信息

## 设计原则

1. **零静默失败**: 所有错误必须被显式处理和报告
2. **统一接口**: 提供统一的错误处理接口
3. **详细信息**: 提供详细的错误上下文信息
4. **安全性**: 过滤敏感信息，防止信息泄露
5. **可追溯性**: 完整的错误链追踪
6. **可配置性**: 支持灵活的错误处理策略
7. **监控集成**: 与监控系统集成，支持告警
8. **性能优化**: 高效的错误处理和记录机制

## 使用示例

### 基本错误处理
```typescript
import { UnifiedErrorCoordinator } from '@rcc/error-handler';

// 创建错误协调器实例
const errorCoordinator = new UnifiedErrorCoordinator();

// 处理错误
try {
  // 可能出错的代码
  await someOperation();
} catch (error) {
  // 统一错误处理
  await errorCoordinator.handleError(error, {
    module: 'example-module',
    operation: 'someOperation',
    context: { additionalInfo: 'example' }
  });
}
```

### 错误分类处理
```typescript
// 分类处理不同类型错误
const classification = errorCoordinator.classifyError(error);
switch (classification.type) {
  case 'NETWORK_ERROR':
    // 网络错误处理
    await handleNetworkError(error);
    break;
  case 'CONFIG_ERROR':
    // 配置错误处理
    await handleConfigError(error);
    break;
  default:
    // 默认错误处理
    await errorCoordinator.handleError(error);
}
```

### 自定义错误处理策略
```typescript
// 注册自定义处理策略
errorCoordinator.registerStrategy('CUSTOM_ERROR', async (error) => {
  // 自定义处理逻辑
  await customErrorHandling(error);
  return { handled: true, recovery: true };
});
```

## 测试策略

### 单元测试覆盖
- **错误分类**: 测试各种错误类型的正确分类
- **处理策略**: 验证不同错误处理策略的正确执行
- **日志记录**: 确保错误日志的正确记录和过滤
- **响应生成**: 验证错误响应的标准化生成

### 集成测试
- **模块集成**: 验证与其他模块的错误处理集成
- **性能测试**: 验证大规模错误处理的性能
- **安全测试**: 验证敏感信息的正确过滤和保护

## 性能指标

- **错误处理延迟**: < 5ms
- **日志记录性能**: < 1ms
- **内存使用**: < 10MB
- **并发处理**: 支持 1000+ 并发错误处理

## 版本历史

- **v4.1.0** (当前): 统一错误协调中心重构
- **v4.0.0**: 增强错误处理功能
- **v3.x**: 基础错误处理机制