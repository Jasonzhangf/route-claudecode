# 统一错误处理和日志系统

## 概述

本模块提供了RCC v4.0的统一错误处理和日志接口系统。该系统将错误处理接口简化为最多不超过三个接口，日志接口也简化为最多不超过三个接口，同时保持与现有RCCError和错误分类系统的兼容性。

## 统一错误处理接口

### 核心接口

1. **handleError** - 处理错误并记录
2. **classifyError** - 分类错误
3. **generateResponse** - 生成统一错误响应

### 接口定义

```typescript
interface UnifiedErrorHandlerInterface extends ModuleInterface {
  handleError(error: Error | RCCError, context?: ErrorContext): Promise<void>;
  classifyError(error: Error | RCCError, context?: ErrorContext): ErrorClassification;
  generateResponse(error: Error | RCCError, provider: string): UnifiedErrorResponse;
}
```

## 统一日志接口

### 核心接口

1. **log** - 记录日志
2. **setLogLevel** - 设置日志级别
3. **addRedactedField** - 添加需要脱敏的字段

### 接口定义

```typescript
interface UnifiedLoggerInterface extends ModuleInterface {
  log(level: LogLevel, message: string, metadata?: Record<string, any>, error?: Error): void;
  setLogLevel(level: LogLevel): void;
  addRedactedField(field: string): void;
}
```

## 实现类

### UnifiedErrorHandler
实现统一错误处理接口的具体类，集成了现有的错误处理功能。

### UnifiedLogger
实现统一日志接口的具体类，提供安全的日志记录功能。

### LogManager
实现日志管理功能，包括错误统计、报告生成和日志清理。

## 使用示例

```typescript
import { UnifiedErrorHandlerFactory, UnifiedLoggerFactory } from './error-handler';

// 创建错误处理器
const errorHandler = UnifiedErrorHandlerFactory.createErrorHandler(5506);

// 处理错误
await errorHandler.handleError(new Error('Test error'), {
  requestId: 'req-123',
  pipelineId: 'pipeline-456'
});

// 记录日志
const logger = UnifiedLoggerFactory.createLogger();
logger.log('info', 'Test message', { userId: 123 });
```

## 向后兼容性

- 保持与现有的RCCError和错误分类系统的完全兼容
- 与现有的模块接口(ModuleInterface)兼容
- 提供清晰的错误响应格式
- 保持安全日志记录功能(敏感信息脱敏)