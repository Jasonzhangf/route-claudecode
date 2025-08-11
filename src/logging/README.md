# 统一日志系统

本项目的统一日志系统，整合了所有原有的debug和日志功能，提供简洁、模块化的日志解决方案。

## 架构设计

### 核心组件

1. **UnifiedLogger** (`unified-logger.ts`)
   - 核心日志引擎
   - 支持多种日志级别和分类
   - 自动时间轮转
   - 北京时区时间戳

2. **LoggerManager** (`logger-manager.ts`)
   - 全局日志实例管理
   - 基于端口的日志隔离
   - 单例模式管理

3. **RequestTracker** (`request-tracker.ts`)
   - 请求生命周期跟踪
   - 阶段性日志记录
   - 性能监控

4. **ErrorTracker** (`error-tracker.ts`)
   - 错误分类和跟踪
   - 工具调用错误检测
   - 错误统计分析

## 使用方法

### 基础日志记录

```typescript
import { getLogger } from './logging';

const logger = getLogger(5505); // 指定端口

// 基础日志
logger.info('操作完成', { userId: 'user123' });
logger.warn('警告信息', { warning: true });
logger.error('错误信息', { error: 'details' });
logger.debug('调试信息', { debug: true });

// 专用日志
logger.logRequest('req-123', 'POST', '/v1/messages', { data: 'test' });
logger.logResponse('req-123', 200, { success: true }, 150);
logger.logPipeline('routing', '路由完成', { provider: 'anthropic' }, 'req-123');
logger.logPerformance('operation', 150, { details: 'test' }, 'req-123');
```

### 请求跟踪

```typescript
import { createRequestTracker } from './logging';

const tracker = createRequestTracker(5505);

// 开始请求跟踪
tracker.startRequest('req-123', 5505, 'anthropic', 'claude-3', { metadata: 'test' });

// 记录处理阶段
tracker.logStage('req-123', 'input-processing', { stage: 'data' });
tracker.logStage('req-123', 'routing', { provider: 'selected' });

// 记录工具调用
tracker.logToolCall('req-123', 'search-tool', { query: 'test' });

// 记录流式数据
tracker.logStreaming('req-123', 1, { chunk: 'data' });

// 完成请求
tracker.completeRequest('req-123', 200, { result: 'success' });
```

### 错误跟踪

```typescript
import { createErrorTracker } from './logging';

const errorTracker = createErrorTracker(5505);

// 工具调用错误
errorTracker.logToolCallError({
  requestId: 'req-123',
  errorMessage: '工具调用解析失败',
  transformationStage: 'output',
  provider: 'anthropic',
  model: 'claude-3',
  context: { rawData: 'error-data' },
  port: 5505
});

// 标准化错误
errorTracker.logStandardizedError({
  port: 5505,
  provider: 'anthropic',
  model: 'claude-3',
  key: 'api-key-****',
  errorCode: 400,
  reason: '请求格式错误',
  requestId: 'req-123'
});

// 通用错误
errorTracker.logGeneralError('操作失败', new Error('详细错误'), 'req-123', 'processing');
```

### 快速日志

```typescript
import { quickLog } from './logging';

// 使用默认logger快速记录
quickLog('快速信息');
quickLog('警告信息', { data: 'test' }, 'warn');
quickLog('错误信息', { error: 'details' }, 'error');
```

## 日志分类

- **request**: 请求相关日志
- **response**: 响应相关日志  
- **pipeline**: 管道处理日志
- **error**: 错误日志
- **performance**: 性能监控日志
- **system**: 系统日志
- **tool_call**: 工具调用日志
- **streaming**: 流式处理日志

## 日志级别

- **error**: 错误信息
- **warn**: 警告信息
- **info**: 一般信息
- **debug**: 调试信息

## 文件组织

```
~/.route-claude-code/logs/
├── port-5505/
│   ├── 2025-08-05T15-30-45/
│   │   ├── request.log
│   │   ├── response.log
│   │   ├── pipeline.log
│   │   ├── error.log
│   │   ├── performance.log
│   │   ├── system.log
│   │   ├── tool_call.log
│   │   └── streaming.log
│   └── 2025-08-05T15-35-45/
│       └── ...
└── port-3456/
    └── ...
```

## 配置选项

```typescript
const logger = new UnifiedLogger({
  port: 5505,                    // 端口号
  logLevel: 'info',             // 日志级别
  enableConsole: true,          // 控制台输出
  enableFile: true,             // 文件输出
  baseDir: '~/.logs',           // 基础目录
  rotationMinutes: 5,           // 轮转间隔(分钟)
  maxRetentionDays: 7           // 保留天数
});
```

## 清理和维护

```typescript
// 清理旧日志
const cleanedCount = await logger.cleanup();

// 优雅关闭
await logger.shutdown();

// 管理器级别清理
import { loggerManager } from './logging';
await loggerManager.cleanupAll();
await loggerManager.shutdownAll();
```

## 迁移说明

原有的日志系统已完全整合到统一日志系统中：

- ✅ `logger.ts` → `UnifiedLogger`
- ✅ `unified-debug-logger.ts` → `UnifiedLogger`
- ✅ `pipeline-debugger.ts` → `RequestTracker` + `ErrorTracker`
- ✅ `request-based-logger.ts` → `RequestTracker`
- ✅ `port-log-directory-manager.ts` → `LoggerManager`
- ✅ `unified-logger-migration.ts` → 整合到核心系统
- ✅ 所有 `console.log` → `quickLog` 或专用方法

## 特性

- 🎯 **统一入口**: 单一导入点，简化使用
- 🔄 **自动轮转**: 基于时间的日志文件轮转
- 📊 **分类记录**: 按功能分类的日志文件
- 🌏 **北京时区**: 本地化时间戳
- 🚀 **高性能**: 异步写入，内存优化
- 🧹 **自动清理**: 自动清理过期日志
- 🔍 **错误检测**: 智能错误模式识别
- 📈 **性能监控**: 内置性能指标记录
- 🎛️ **灵活配置**: 可配置的日志级别和输出
- 🔒 **端口隔离**: 基于端口的日志隔离

## 最佳实践

1. **使用合适的日志级别**: 生产环境使用 `info`，开发环境使用 `debug`
2. **结构化数据**: 使用对象传递结构化的日志数据
3. **请求ID跟踪**: 始终传递requestId进行请求跟踪
4. **错误上下文**: 记录错误时提供足够的上下文信息
5. **性能监控**: 对关键操作记录性能指标
6. **定期清理**: 定期运行清理操作释放磁盘空间