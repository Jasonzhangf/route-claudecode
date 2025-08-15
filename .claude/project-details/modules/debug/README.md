# Debug系统模块

## 模块概述

Debug系统提供完整的调试和回放功能，记录系统运行状态，支持问题分析和回放测试。

## 目录结构

```
src/debug/
├── README.md                    # Debug系统文档
├── index.ts                     # Debug系统入口
├── debug-manager.ts             # Debug管理器
├── debug-recorder.ts            # Debug记录器
├── replay-system.ts             # 回放系统
└── types/
    ├── debug-types.ts           # Debug相关类型
    ├── record-types.ts          # 记录相关类型
    └── replay-types.ts          # 回放相关类型
```

## 核心功能

### 1. Debug管理
- **模块注册**: 接受各模块的debug注册
- **开关控制**: 可控制任意端口的debug开关
- **全局调试**: 统一的调试控制中心

### 2. 数据记录
- **输入输出记录**: 记录每个模块的输入输出数据
- **错误记录**: 记录完整的错误信息和堆栈
- **流水线记录**: 基于requestID的完整流水线记录
- **会话管理**: 按端口和会话组织存储

### 3. 回放系统
- **动态回放**: 支持重现原始请求的处理过程
- **单元测试生成**: 基于Debug记录创建可执行测试
- **验证回放**: 对比原始记录和回放结果

## 存储结构

### 目录组织
```
~/.route-claudecode/debug/
├── port-3456/                   # 按端口分组
│   ├── session-2024-08-15_14-30-22/  # 按会话分组 (使用可读时间格式)
│   │   ├── requests/            # 请求记录
│   │   │   ├── req_2024-08-15_14-30-22_001.json     # 单个请求记录
│   │   │   ├── req_2024-08-15_14-30-22_002.json
│   │   │   └── ...
│   │   ├── pipelines/           # 流水线记录
│   │   │   ├── openai_gpt-4/    # 按流水线分组
│   │   │   │   ├── pipeline_2024-08-15_14-30-22_001.json
│   │   │   │   └── ...
│   │   │   └── deepseek_chat/
│   │   ├── session.json         # 会话信息 (包含可读时间)
│   │   └── summary.json         # 会话摘要
│   └── ...
├── port-8080/
│   └── session-2024-08-15_15-45-10/
└── current/                     # 当前活跃会话的软链接
    ├── port-3456 -> ../port-3456/session-2024-08-15_14-30-22/
    └── port-8080 -> ../port-8080/session-2024-08-15_15-45-10/
```

## 接口定义

```typescript
export interface DebugManager {
  registerModule(moduleName: string, port: number): void;
  enableDebug(moduleName: string): void;
  disableDebug(moduleName: string): void;
  recordInput(moduleName: string, requestId: string, input: any): void;
  recordOutput(moduleName: string, requestId: string, output: any): void;
  recordError(moduleName: string, requestId: string, error: RCCError): void;
}

export interface DebugRecorder {
  createSession(port: number): DebugSession;
  recordPipelineExecution(requestId: string, pipeline: Pipeline, data: any): void;
  saveRecord(record: DebugRecord): Promise<void>;
  loadRecord(requestId: string): Promise<DebugRecord>;
}

export interface ReplaySystem {
  replayRequest(requestId: string): Promise<any>;
  createUnitTest(requestId: string): Promise<string>;
  validateReplay(original: DebugRecord, replayed: DebugRecord): boolean;
}
```

## Debug记录格式

### 请求记录
```typescript
interface DebugRecord {
  requestId: string;
  timestamp: number;
  readableTime: string;        // 可读的当前时区时间: "2024-08-15 14:30:22 CST"
  port: number;
  sessionId: string;
  
  // 请求信息
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: any;
  };
  
  // 流水线执行记录
  pipeline: {
    id: string;
    provider: string;
    model: string;
    modules: ModuleRecord[];
  };
  
  // 响应信息
  response: {
    status: number;
    headers: Record<string, string>;
    body: any;
    duration: number;
  };
  
  // 错误信息（如果有）
  error?: {
    type: string;
    message: string;
    module: string;
    stack: string;
  };
}
```

### 模块记录
```typescript
interface ModuleRecord {
  moduleName: string;
  startTime: number;
  startTimeReadable: string;   // 可读的开始时间
  endTime: number;
  endTimeReadable: string;     // 可读的结束时间
  duration: number;            // 处理时长(毫秒)
  input: any;
  output: any;
  error?: RCCError;
  metadata: {
    version: string;
    config: any;
  };
}
```

### 会话记录
```typescript
interface DebugSession {
  sessionId: string;
  port: number;
  startTime: number;
  startTimeReadable: string;   // 可读的开始时间: "2024-08-15 14:30:22 CST"
  endTime?: number;
  endTimeReadable?: string;    // 可读的结束时间
  duration?: number;           // 会话持续时间(毫秒)
  requestCount: number;
  errorCount: number;
  activePipelines: string[];
  metadata: {
    version: string;
    config: any;
    timezone: string;          // 时区信息
  };
}
```

## Debug管理器实现

```typescript
export class DebugManagerImpl implements DebugManager {
  private registeredModules: Map<string, ModuleDebugInfo> = new Map();
  private debugEnabled: Map<string, boolean> = new Map();
  private recorder: DebugRecorder;

  constructor() {
    this.recorder = new DebugRecorderImpl();
  }

  registerModule(moduleName: string, port: number): void {
    this.registeredModules.set(moduleName, {
      name: moduleName,
      port,
      registeredAt: Date.now()
    });
    
    // 默认启用debug
    this.debugEnabled.set(moduleName, true);
  }

  enableDebug(moduleName: string): void {
    if (!this.registeredModules.has(moduleName)) {
      throw new Error(`Module ${moduleName} not registered`);
    }
    this.debugEnabled.set(moduleName, true);
  }

  disableDebug(moduleName: string): void {
    this.debugEnabled.set(moduleName, false);
  }

  recordInput(moduleName: string, requestId: string, input: any): void {
    if (!this.isDebugEnabled(moduleName)) return;
    
    this.recorder.recordModuleInput(moduleName, requestId, input);
  }

  recordOutput(moduleName: string, requestId: string, output: any): void {
    if (!this.isDebugEnabled(moduleName)) return;
    
    this.recorder.recordModuleOutput(moduleName, requestId, output);
  }

  recordError(moduleName: string, requestId: string, error: RCCError): void {
    // 错误总是记录，不受debug开关影响
    this.recorder.recordModuleError(moduleName, requestId, error);
  }

  private isDebugEnabled(moduleName: string): boolean {
    return this.debugEnabled.get(moduleName) ?? false;
  }
}
```

## 回放系统实现

```typescript
export class ReplaySystemImpl implements ReplaySystem {
  private recorder: DebugRecorder;

  constructor() {
    this.recorder = new DebugRecorderImpl();
  }

  async replayRequest(requestId: string): Promise<any> {
    // 加载原始记录
    const originalRecord = await this.recorder.loadRecord(requestId);
    
    // 重建流水线环境
    const pipeline = await this.reconstructPipeline(originalRecord.pipeline);
    
    // 执行回放
    const replayResult = await pipeline.process(originalRecord.request.body);
    
    // 验证回放结果
    const isValid = this.validateReplay(originalRecord, {
      ...originalRecord,
      response: { ...originalRecord.response, body: replayResult }
    });
    
    return {
      original: originalRecord.response.body,
      replayed: replayResult,
      isValid,
      differences: this.findDifferences(originalRecord.response.body, replayResult)
    };
  }

  async createUnitTest(requestId: string): Promise<string> {
    const record = await this.recorder.loadRecord(requestId);
    
    return this.generateTestCode(record);
  }

  validateReplay(original: DebugRecord, replayed: DebugRecord): boolean {
    // 比较关键字段
    return this.compareResponses(original.response, replayed.response);
  }

  private generateTestCode(record: DebugRecord): string {
    return `
describe('Pipeline Replay Test - ${record.requestId}', () => {
  test('should reproduce original behavior', async () => {
    const pipeline = await createPipeline('${record.pipeline.provider}', '${record.pipeline.model}');
    
    const input = ${JSON.stringify(record.request.body, null, 2)};
    const expectedOutput = ${JSON.stringify(record.response.body, null, 2)};
    
    const result = await pipeline.process(input);
    
    expect(result).toMatchObject(expectedOutput);
  });
});
    `.trim();
  }
}
```

## 性能优化

### 异步记录
- 使用异步I/O避免阻塞主流程
- 批量写入提高性能
- 内存缓冲减少磁盘操作

### 存储优化
- 压缩大型记录文件
- 定期清理过期记录
- 索引文件加速查询

### 内存管理
- 限制内存中的记录数量
- 及时释放不用的记录
- 监控内存使用情况

## 配置管理

### Debug配置
```typescript
interface DebugConfig {
  enabled: boolean;
  maxRecordSize: number;
  maxSessionDuration: number;
  retentionDays: number;
  compressionEnabled: boolean;
  modules: {
    [moduleName: string]: {
      enabled: boolean;
      logLevel: 'debug' | 'info' | 'warn' | 'error';
    };
  };
}
```

### 默认配置
```typescript
const defaultDebugConfig: DebugConfig = {
  enabled: true,
  maxRecordSize: 10 * 1024 * 1024, // 10MB
  maxSessionDuration: 24 * 60 * 60 * 1000, // 24小时
  retentionDays: 7,
  compressionEnabled: true,
  modules: {
    'client': { enabled: true, logLevel: 'info' },
    'router': { enabled: true, logLevel: 'info' },
    'pipeline': { enabled: true, logLevel: 'debug' },
    'transformer': { enabled: true, logLevel: 'debug' },
    'protocol': { enabled: true, logLevel: 'debug' },
    'server-compatibility': { enabled: true, logLevel: 'debug' },
    'server': { enabled: true, logLevel: 'info' }
  }
};
```

## 错误处理

### Debug错误
```typescript
class DebugError extends Error {
  constructor(operation: string, message: string) {
    super(`Debug operation failed (${operation}): ${message}`);
    this.name = 'DebugError';
  }
}
```

### 记录错误
```typescript
class RecordError extends Error {
  constructor(recordId: string, message: string) {
    super(`Record operation failed for ${recordId}: ${message}`);
    this.name = 'RecordError';
  }
}
```

## 质量要求

- ✅ 无静默失败
- ✅ 无mockup调试
- ✅ 无重复调试代码
- ✅ 无硬编码调试路径
- ✅ 完整的记录验证
- ✅ 可靠的回放机制
- ✅ 性能优化设计