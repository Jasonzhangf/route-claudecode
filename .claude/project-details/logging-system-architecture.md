# 统一日志系统架构设计

## 📋 项目概述

### 背景
Claude Code Router v2.7.0 项目中存在多种分散的日志系统，包括传统Logger、UnifiedDebugLogger、PipelineDebugger等，造成代码冗余、维护困难和功能重复。

### 目标
建立统一的日志系统，整合所有现有日志功能，提供模块化、自包含的日志解决方案。

## 🏗️ 架构设计

### 核心原则
- **统一入口**: 项目唯一日志入口点
- **模块化设计**: 功能分离，职责明确
- **自包含模块**: 无耦合，无冗余
- **细菌式编程**: 小巧、模块化、自包含

### 系统架构

```
src/logging/
├── index.ts              # 统一导出入口
├── unified-logger.ts     # 核心日志引擎
├── logger-manager.ts     # 全局日志实例管理
├── request-tracker.ts    # 请求生命周期跟踪
└── error-tracker.ts      # 错误跟踪和分析
```

## 📦 模块详细设计

### 1. UnifiedLogger (核心日志引擎)
**文件**: `src/logging/unified-logger.ts`

**功能**:
- 基于端口的日志组织
- 北京时区时间戳
- 按类别分类日志 (request/response/pipeline/error/performance/system/tool_call/streaming)
- 时间轮转机制 (5分钟轮转)
- 控制台和文件双输出

**接口**:
```typescript
class UnifiedLogger {
  log(category: LogCategory, level: LogLevel, message: string, data?: any, requestId?: string, stage?: string, duration?: number): void
  error(message: string, data?: any, requestId?: string, stage?: string): void
  warn(message: string, data?: any, requestId?: string, stage?: string): void
  info(message: string, data?: any, requestId?: string, stage?: string): void
  debug(message: string, data?: any, requestId?: string, stage?: string): void
  logRequest(requestId: string, method: string, path: string, data?: any): void
  logResponse(requestId: string, status: number, data?: any, duration?: number): void
  logPipeline(stage: string, message: string, data?: any, requestId?: string): void
  logPerformance(operation: string, duration: number, data?: any, requestId?: string): void
  logToolCall(message: string, data?: any, requestId?: string, stage?: string): void
  logStreaming(message: string, data?: any, requestId?: string, stage?: string): void
}
```

### 2. LoggerManager (全局实例管理)
**文件**: `src/logging/logger-manager.ts`

**功能**:
- 单例模式的日志器管理
- 基于端口的日志器实例化
- 生命周期管理

**接口**:
```typescript
function getLogger(port?: number): UnifiedLogger
function setDefaultPort(port: number): void
```

### 3. RequestTracker (请求跟踪)
**文件**: `src/logging/request-tracker.ts`

**功能**:
- 请求生命周期跟踪
- 阶段性日志记录
- 工具调用跟踪
- 流式响应跟踪

**接口**:
```typescript
class RequestTracker {
  startRequest(requestId: string, port: number, provider?: string, model?: string, data?: any): void
  logStage(requestId: string, stage: string, data?: any, duration?: number): void
  logToolCall(requestId: string, toolName: string, data?: any, error?: any): void
  logStreaming(requestId: string, chunkIndex: number, data?: any): void
  completeRequest(requestId: string, status?: number, data?: any): void
}
```

### 4. ErrorTracker (错误跟踪)
**文件**: `src/logging/error-tracker.ts`

**功能**:
- 工具调用错误检测
- 标准化错误记录
- 错误统计分析
- 文本中工具调用检测

**接口**:
```typescript
class ErrorTracker {
  logToolCallError(error: ToolCallError): void
  logStandardizedError(error: StandardizedError): void
  logGeneralError(message: string, error: Error, requestId?: string, stage?: string, context?: any): void
  detectToolCallInText(text: string, requestId: string, transformationStage: string, provider: string, model: string): boolean
}
```

## 🔄 迁移策略

### 现有系统映射

| 原系统 | 新系统 | 迁移方式 |
|--------|--------|----------|
| `logger.ts` | `UnifiedLogger` | 直接替换 |
| `unified-debug-logger.ts` | `UnifiedLogger` | 功能整合 |
| `pipeline-debugger.ts` | `RequestTracker` + `ErrorTracker` | 功能分离 |
| `request-based-logger.ts` | `RequestTracker` | 功能整合 |
| `port-log-directory-manager.ts` | `LoggerManager` | 简化管理 |
| Console日志 | `UnifiedLogger` | 统一接口 |

### 迁移步骤

1. **创建新日志系统** ✅
   - 实现 UnifiedLogger 核心引擎
   - 实现 LoggerManager 全局管理
   - 实现 RequestTracker 请求跟踪
   - 实现 ErrorTracker 错误跟踪

2. **更新主要文件** ✅
   - 更新 server.ts 导入和使用
   - 替换旧日志调用

3. **清理旧系统** (待执行)
   - 删除冗余日志文件
   - 清理未使用的导入
   - 更新测试文件

4. **构建和验证** (待执行)
   - 构建项目
   - 运行测试
   - 验证日志功能

## 📊 预期收益

### 代码质量提升
- **文件数量减少**: 从7个日志相关文件减少到4个核心文件
- **代码重复消除**: 消除90%以上的重复日志代码
- **维护复杂度降低**: 统一接口，单一职责

### 功能增强
- **统一时间戳**: 北京时区统一时间格式
- **分类日志**: 8种日志类别，便于分析
- **性能优化**: 减少文件I/O操作
- **错误检测**: 增强的工具调用错误检测

### 开发体验改善
- **简化使用**: 单一导入入口
- **类型安全**: 完整的TypeScript类型定义
- **调试友好**: 结构化日志输出

## 🧪 测试策略

### 单元测试
- UnifiedLogger 核心功能测试
- LoggerManager 实例管理测试
- RequestTracker 生命周期测试
- ErrorTracker 错误检测测试

### 集成测试
- 与现有系统集成测试
- 多端口日志隔离测试
- 并发请求日志测试

### 性能测试
- 日志写入性能测试
- 内存使用测试
- 文件轮转测试

## 📁 文件组织

### 目录结构
```
src/logging/
├── index.ts              # 统一导出，便捷函数
├── unified-logger.ts     # 核心日志引擎 (500行以内)
├── logger-manager.ts     # 全局实例管理 (200行以内)
├── request-tracker.ts    # 请求跟踪 (300行以内)
├── error-tracker.ts      # 错误跟踪 (400行以内)
└── README.md            # 使用文档
```

### 命名规范
- **类名**: PascalCase (UnifiedLogger, RequestTracker)
- **文件名**: kebab-case (unified-logger.ts, request-tracker.ts)
- **函数名**: camelCase (getLogger, logRequest)
- **常量**: UPPER_SNAKE_CASE (LOG_LEVELS, CATEGORIES)

## 🔧 使用示例

### 基本使用
```typescript
import { getLogger, createRequestTracker, createErrorTracker } from './logging';

// 获取日志器
const logger = getLogger(5505);

// 记录基本日志
logger.info('Server started', { port: 5505 });
logger.error('Connection failed', { error: 'timeout' });

// 请求跟踪
const requestTracker = createRequestTracker(5505);
requestTracker.startRequest('req-123', 5505, 'anthropic', 'claude-3');
requestTracker.logStage('req-123', 'routing', { provider: 'anthropic' });
requestTracker.completeRequest('req-123', 200);

// 错误跟踪
const errorTracker = createErrorTracker(5505);
errorTracker.logToolCallError({
  requestId: 'req-123',
  errorMessage: 'Tool call parsing failed',
  transformationStage: 'output',
  provider: 'anthropic',
  model: 'claude-3',
  context: { rawData: '...' },
  port: 5505
});
```

### 服务器集成
```typescript
// server.ts
import { getLogger, setDefaultPort, createRequestTracker, createErrorTracker } from './logging';

export class RouterServer {
  private logger: UnifiedLogger;
  private requestTracker: RequestTracker;
  private errorTracker: ErrorTracker;

  constructor(config: RouterConfig) {
    setDefaultPort(config.server.port);
    this.logger = getLogger(config.server.port);
    this.requestTracker = createRequestTracker(config.server.port);
    this.errorTracker = createErrorTracker(config.server.port);
  }

  async sendRequest(request: BaseRequest): Promise<any> {
    const requestId = uuidv4();
    
    // 开始请求跟踪
    this.requestTracker.startRequest(requestId, this.config.server.port);
    
    try {
      // 处理请求...
      this.logger.logPipeline('routing', 'Route selected', { provider: 'anthropic' }, requestId);
      
      // 完成请求
      this.requestTracker.completeRequest(requestId, 200);
      
    } catch (error) {
      this.errorTracker.logGeneralError('Request failed', error, requestId, 'processing');
      throw error;
    }
  }
}
```

## 🚀 部署和维护

### 构建要求
- TypeScript 编译无错误
- 所有测试通过
- ESLint 检查通过
- 文档完整

### 监控指标
- 日志写入延迟
- 文件大小增长
- 错误检测准确率
- 内存使用情况

### 维护计划
- 定期清理旧日志文件
- 监控磁盘使用情况
- 优化日志格式
- 更新错误检测规则

---

**项目所有者**: Jason Zhang  
**创建时间**: 2025-08-05  
**版本**: v1.0  
**状态**: 实施中