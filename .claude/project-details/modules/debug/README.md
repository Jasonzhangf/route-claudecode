# Debug模块 (Debug Module) - 全链路调试重构版

## 模块概述

Debug模块是RCC v4.0系统的调试和监控中心，负责全链路数据记录、回放测试和调试支持。采用增强的调试架构设计，提供完整的调试信息收集和分析功能。

## 核心设计理念

### ✅ 全链路调试架构
- **端口分组**: 按端口分组记录全链路处理数据
- **事件追踪**: 完整的事件链追踪机制
- **性能分析**: 实时性能数据收集和分析
- **回放测试**: 基于记录数据的回放测试支持

### 🔒 安全性原则
- **敏感信息过滤**: 自动过滤和保护敏感调试信息
- **访问控制**: 调试信息的权限控制和访问限制
- **存储安全**: 调试数据的安全存储机制

## 模块结构

```
debug/
├── README.md                       # 本模块设计文档
├── index.ts                        # 模块入口和导出
├── debug-manager.ts                 # Debug管理器
├── debug-recorder.ts                # Debug记录器
├── debug-collector.ts              # Debug收集器
├── debug-storage.ts                # Debug存储器
├── debug-serializer.ts             # Debug序列化器
├── debug-filter.ts                 # Debug过滤器
├── debug-analyzer.ts               # Debug分析器
├── replay-system.ts                 # 回放系统
├── debug-integration.ts            # 调试集成器
├── request-test-system.ts          # 请求测试系统
├── pipeline-debug-recorder.ts      # 流水线调试记录器
├── pipeline-debug-system.ts        # 流水线调试系统
├── console-log-capture.ts          # 控制台日志捕获
├── error-log-cli.ts                # 错误日志CLI
├── error-log-manager.ts            # 错误日志管理器
├── server-startup-debug-example.ts # 服务器启动调试示例
├── tool-calling-flow-test.ts       # 工具调用流程测试
├── debug-serializer.ts             # 调试序列化器
├── enhanced-error-handler.ts       # 增强错误处理器
├── unified-error-coordinator.ts    # 统一错误协调器
├── types/                          # Debug相关类型定义
│   ├── debug-types.ts              # Debug类型定义
│   ├── replay-types.ts             # 回放类型定义
│   └── error-log-types.ts          # 错误日志类型定义
└── utils/                          # 调试工具
    ├── jq-json-handler.ts          # JSON处理工具
    └── secure-logger.ts            # 安全日志记录器
```

## 核心组件

### Debug管理器 (DebugManager) - 核心管理组件
协调Debug模块的所有功能，是模块的主入口点：

#### 功能特性
- **统一管理**: 统一管理所有调试功能
- **配置控制**: 调试配置的统一控制
- **生命周期管理**: 调试组件的生命周期管理
- **状态监控**: 调试系统状态的实时监控

#### 接口定义
```typescript
class DebugManager {
  // 初始化调试系统
  async initialize(config: DebugConfig): Promise<void>;
  
  // 启动记录
  startRecording(): void;
  
  // 停止记录
  stopRecording(): void;
  
  // 获取记录状态
  getRecordingStatus(): RecordingStatus;
  
  // 获取记录数据
  getRecordedData(filter?: DebugFilter): DebugRecord[];
  
  // 清除记录数据
  clearRecordedData(): void;
  
  // 导出数据
  async exportData(format: ExportFormat): Promise<string>;
  
  // 销毁调试系统
  async destroy(): Promise<void>;
}
```

### Debug记录器 (DebugRecorder) - 数据记录组件
负责实际的数据记录工作，按端口分组记录处理数据：

#### 功能特性
- **事件记录**: 记录系统中的各种事件
- **请求记录**: 记录请求和响应数据
- **性能记录**: 记录性能相关数据
- **错误记录**: 记录错误和异常信息

### Debug收集器 (DebugCollector) - 信息收集组件
收集各模块的调试信息和性能数据：

#### 功能特性
- **模块集成**: 与各模块的调试集成
- **数据聚合**: 调试数据的聚合和整理
- **实时收集**: 实时收集调试信息
- **过滤处理**: 调试信息的过滤和处理

### Debug存储器 (DebugStorage) - 数据存储组件
管理记录数据的存储和检索：

#### 功能特性
- **分组存储**: 按端口和会话分组存储
- **高效检索**: 高效的数据检索机制
- **存储优化**: 存储空间的优化管理
- **数据安全**: 调试数据的安全存储

### 回放系统 (ReplaySystem) - 测试回放组件
支持基于记录数据的回放测试，用于问题重现和测试验证：

#### 功能特性
- **数据回放**: 基于记录数据的回放执行
- **单元测试生成**: 自动生成单元测试代码
- **结果验证**: 回放结果的验证机制
- **差异分析**: 回放差异的分析功能

### 流水线调试系统 (PipelineDebugSystem) - 流水线调试组件
专门针对流水线处理的调试支持：

#### 功能特性
- **流水线追踪**: 流水线处理的完整追踪
- **模块监控**: 流水线模块的实时监控
- **性能分析**: 流水线性能的详细分析
- **错误定位**: 流水线错误的精确定位

## 接口定义

```typescript
interface DebugModuleInterface {
  initialize(): Promise<void>;
  startRecording(): void;
  stopRecording(): void;
  getRecordingStatus(): RecordingStatus;
  getRecordedData(filter?: DebugFilter): DebugRecord[];
  clearRecordedData(): void;
  exportData(format: ExportFormat): Promise<string>;
}

interface DebugRecorderInterface {
  recordEvent(event: DebugEvent): void;
  startSession(sessionId: string): void;
  endSession(sessionId: string): void;
  recordRequest(request: DebugRequest): void;
  recordResponse(response: DebugResponse): void;
}

interface ReplaySystemInterface {
  replayRequest(requestId: string): Promise<any>;
  createUnitTest(requestId: string): Promise<string>;
  validateReplay(original: DebugRecord, replayed: DebugRecord): boolean;
}

interface PipelineDebugInterface {
  startPipelineDebug(pipelineId: string): void;
  stopPipelineDebug(pipelineId: string): void;
  recordPipelineEvent(pipelineId: string, event: PipelineDebugEvent): void;
  getPiplineDebugData(pipelineId: string): PipelineDebugData[];
}
```

## 调试数据结构

### 调试记录
```typescript
interface DebugRecord {
  id: string;
  timestamp: Date;
  type: DebugRecordType;
  data: any;
  context: DebugContext;
  metadata: DebugMetadata;
}

interface DebugContext {
  sessionId: string;
  requestId: string;
  moduleId: string;
  moduleName: string;
  port: number;
}

interface DebugMetadata {
  recordingId: string;
  sequenceNumber: number;
  tags: string[];
  sensitive: boolean;
}
```

### 流水线调试数据
```typescript
interface PipelineDebugData {
  pipelineId: string;
  moduleId: string;
  moduleName: string;
  eventType: PipelineEventType;
  data: any;
  timestamp: Date;
  duration: number;
  memoryUsage: number;
  status: 'success' | 'error' | 'warning';
}
```

## 依赖关系

- **依赖配置模块**获取Debug配置
- **被所有其他模块调用**以记录调试信息
- **依赖文件系统**进行数据存储
- **依赖错误处理模块**获取错误调试信息

## 设计原则

1. **完整性**: 记录全链路处理数据，确保问题可追溯
2. **性能影响最小化**: Debug功能对系统性能的影响降到最低
3. **安全性**: 敏感信息过滤，确保记录数据安全
4. **可分析性**: 提供丰富的数据分析和可视化功能
5. **可配置性**: 支持灵活的记录策略和存储配置
6. **标准化**: 采用统一的数据格式和存储结构
7. **实时性**: 实时记录和监控调试信息
8. **可扩展性**: 支持调试功能的灵活扩展

## 使用示例

### 基本调试使用
```typescript
import { DebugManager } from '@rcc/debug';

// 创建调试管理器
const debugManager = new DebugManager();

// 初始化调试系统
await debugManager.initialize({
  enabled: true,
  level: 'full',
  storagePath: './debug-logs',
  maxFileSize: 100 * 1024 * 1024 // 100MB
});

// 启动记录
debugManager.startRecording();

// 在代码中记录调试信息
debugManager.recordEvent({
  type: 'REQUEST_START',
  data: { method: 'POST', url: '/api/chat' },
  context: { 
    sessionId: 'session-123',
    requestId: 'request-456',
    moduleId: 'router',
    moduleName: 'CoreRouter',
    port: 5506
  }
});

// 停止记录
debugManager.stopRecording();

// 导出调试数据
const debugData = await debugManager.exportData('json');
```

### 流水线调试使用
```typescript
// 启动流水线调试
debugManager.startPipelineDebug('pipeline-789');

// 记录流水线事件
debugManager.recordPipelineEvent('pipeline-789', {
  eventType: 'MODULE_PROCESS_START',
  moduleId: 'transformer-1',
  moduleName: 'AnthropicToOpenAITransformer',
  data: { input: 'transformer input data' }
});

// 停止流水线调试
debugManager.stopPipelineDebug('pipeline-789');
```

### 回放测试使用
```typescript
// 创建回放系统
const replaySystem = new ReplaySystem(debugManager);

// 回放请求
const replayResult = await replaySystem.replayRequest('request-456');

// 生成单元测试
const testCode = await replaySystem.createUnitTest('request-456');

// 验证回放结果
const isValid = replaySystem.validateReplay(originalRecord, replayResult);
```

## 测试策略

### 单元测试覆盖
- **数据记录**: 测试调试数据的正确记录
- **存储管理**: 验证调试数据的存储和检索
- **过滤处理**: 确保敏感信息的正确过滤
- **回放功能**: 验证回放测试的正确执行

### 集成测试
- **模块集成**: 验证与其他模块的调试集成
- **性能测试**: 验证大规模调试数据的处理性能
- **安全测试**: 验证敏感信息的正确保护
- **回放测试**: 验证复杂场景的回放测试功能

## 性能指标

- **记录延迟**: < 1ms
- **存储性能**: < 5ms
- **检索性能**: < 10ms
- **内存使用**: < 50MB
- **并发处理**: 支持 100+ 并发调试记录

## 配置选项

```typescript
interface DebugConfig {
  // 调试开关
  enabled: boolean;
  
  // 记录级别: none, basic, full
  level: DebugLevel;
  
  // 存储路径
  storagePath: string;
  
  // 最大文件大小
  maxFileSize: number;
  
  // 最大文件数量
  maxFiles: number;
  
  // 敏感信息过滤规则
  filterRules: FilterRule[];
  
  // 回放配置
  replay: {
    enabled: boolean;
    maxHistory: number;
  };
}
```

## 版本历史

- **v4.1.0** (当前): 全链路调试架构重构
- **v4.0.0**: 增强调试功能
- **v3.x**: 基础调试机制