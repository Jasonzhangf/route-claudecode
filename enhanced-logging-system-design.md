# 增强日志系统设计方案

## 目标
实现完整的模块输出文件保存机制，确保：
1. 启动阶段每个模块输出保存为独立文件
2. 执行阶段每个流水线请求/响应保存为独立文件

## 设计方案

### 1. 启动阶段模块输出文件保存

#### 1.1 配置预处理模块 (ConfigPreprocessor)
文件路径: `debug-logs/startup/config-preprocessor-result-[timestamp].json`
内容:
```json
{
  "timestamp": "2025-09-05T10:30:00Z",
  "module": "ConfigPreprocessor",
  "input": {
    "configPath": "/path/to/config.json"
  },
  "output": {
    "success": true,
    "routingTable": {
      "providers": [...],
      "routes": [...]
    },
    "metadata": {...}
  },
  "processingTime": 150,
  "errors": []
}
```

#### 1.2 路由预处理模块 (RouterPreprocessor)
文件路径: `debug-logs/startup/router-preprocessor-result-[timestamp].json`
内容:
```json
{
  "timestamp": "2025-09-05T10:30:01Z",
  "module": "RouterPreprocessor",
  "input": {
    "routingTable": {...}  // 来自ConfigPreprocessor的输出
  },
  "output": {
    "success": true,
    "routingTable": {...},  // 内部路由表
    "pipelineConfigs": [...],
    "stats": {...}
  },
  "processingTime": 120,
  "errors": []
}
```

#### 1.3 流水线组装模块 (PipelineAssembler)
文件路径: `debug-logs/startup/pipeline-assembler-result-[timestamp].json`
内容:
```json
{
  "timestamp": "2025-09-05T10:30:02Z",
  "module": "PipelineAssembler",
  "input": {
    "pipelineConfigs": [...]  // 来自RouterPreprocessor的输出
  },
  "output": {
    "success": true,
    "pipelinesByRouteModel": {...},
    "allPipelines": [...],
    "stats": {...}
  },
  "processingTime": 200,
  "errors": []
}
```

#### 1.4 自检模块 (SelfCheckService)
文件路径: `debug-logs/startup/self-check-result-[timestamp].json`
内容:
```json
{
  "timestamp": "2025-09-05T10:30:03Z",
  "module": "SelfCheckService",
  "input": {
    "action": "performSelfCheck"
  },
  "output": {
    "success": true,
    "state": {...},
    "apiKeyValidation": [...],
    "pipelineHealth": [...]
  },
  "processingTime": 180,
  "errors": []
}
```

#### 1.5 动态调度初始化
文件路径: `debug-logs/startup/dynamic-scheduler-result-[timestamp].json`
内容:
```json
{
  "timestamp": "2025-09-05T10:30:04Z",
  "module": "DynamicScheduler",
  "input": {
    "pipelines": [...]  // 已组装的流水线
  },
  "output": {
    "success": true,
    "routingIndex": {...},
    "loadBalancing": {...}
  },
  "processingTime": 50,
  "errors": []
}
```

### 2. 执行阶段流水线请求/响应文件保存

#### 2.1 流水线请求文件
文件路径: `debug-logs/pipeline/requests/pipeline-request-[pipelineId]-[requestId]-[timestamp].json`
内容:
```json
{
  "timestamp": "2025-09-05T10:30:10Z",
  "requestId": "req_123456789",
  "pipelineId": "pipeline_qwen_qwen3-coder-plus_0",
  "routeModel": "coding",
  "input": {
    // 完整的Anthropic格式请求
    "model": "claude-3-5-sonnet-20240620",
    "messages": [...],
    "tools": [...]
  },
  "pipelineLayers": [
    {
      "layer": "transformer",
      "input": {...},
      "output": {...}
    },
    {
      "layer": "protocol",
      "input": {...},
      "output": {...}
    },
    {
      "layer": "server-compatibility",
      "input": {...},
      "output": {...}
    },
    {
      "layer": "server",
      "input": {...},
      "output": {...}
    }
  ]
}
```

#### 2.2 流水线响应文件
文件路径: `debug-logs/pipeline/responses/pipeline-response-[pipelineId]-[requestId]-[timestamp].json`
内容:
```json
{
  "timestamp": "2025-09-05T10:30:12Z",
  "requestId": "req_123456789",
  "pipelineId": "pipeline_qwen_qwen3-coder-plus_0",
  "processingTime": 1850,
  "response": {
    // 完整的Anthropic格式响应
    "id": "chatcmpl_123456789",
    "type": "message",
    "role": "assistant",
    "content": [...],
    "model": "qwen3-coder-plus",
    "stop_reason": "end_turn",
    "stop_sequence": null,
    "usage": {...}
  },
  "layerOutputs": [
    {
      "layer": "server",
      "response": {...}  // OpenAI格式响应
    },
    {
      "layer": "server-compatibility",
      "response": {...}  // 转换后的响应
    },
    {
      "layer": "protocol",
      "response": {...}  // 协议层处理后的响应
    },
    {
      "layer": "transformer",
      "response": {...}  // 最终Anthropic格式响应
    }
  ]
}
```

### 3. 文件组织结构
```
debug-logs/
├── startup/
│   ├── config-preprocessor-result-20250905-103000.json
│   ├── router-preprocessor-result-20250905-103001.json
│   ├── pipeline-assembler-result-20250905-103002.json
│   ├── self-check-result-20250905-103003.json
│   └── dynamic-scheduler-result-20250905-103004.json
├── pipeline/
│   ├── requests/
│   │   ├── pipeline-request-pipeline_qwen_0-req_123456789-20250905-103010.json
│   │   └── pipeline-request-pipeline_iflow_0-req_987654321-20250905-103015.json
│   └── responses/
│       ├── pipeline-response-pipeline_qwen_0-req_123456789-20250905-103012.json
│       └── pipeline-response-pipeline_iflow_0-req_987654321-20250905-103018.json
└── metadata/
    ├── session-info-20250905-103000.json
    └── performance-stats-20250905-103000.json
```

### 4. 实现建议

#### 4.1 创建日志目录管理器
```typescript
class DebugLogManager {
  private baseDir: string;
  
  constructor(baseDir: string = 'debug-logs') {
    this.baseDir = baseDir;
    this.createDirectories();
  }
  
  private createDirectories(): void {
    const dirs = [
      path.join(this.baseDir, 'startup'),
      path.join(this.baseDir, 'pipeline', 'requests'),
      path.join(this.baseDir, 'pipeline', 'responses'),
      path.join(this.baseDir, 'metadata')
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }
  
  saveStartupModuleOutput(moduleName: string, input: any, output: any, processingTime: number, errors: string[] = []): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${moduleName.toLowerCase()}-result-${timestamp}.json`;
    const filepath = path.join(this.baseDir, 'startup', filename);
    
    const logData = {
      timestamp: new Date().toISOString(),
      module: moduleName,
      input,
      output,
      processingTime,
      errors
    };
    
    fs.writeFileSync(filepath, JSON.stringify(logData, null, 2));
  }
  
  savePipelineRequest(pipelineId: string, requestId: string, routeModel: string, input: any, layerInputs: any[]): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `pipeline-request-${pipelineId}-${requestId}-${timestamp}.json`;
    const filepath = path.join(this.baseDir, 'pipeline', 'requests', filename);
    
    const logData = {
      timestamp: new Date().toISOString(),
      requestId,
      pipelineId,
      routeModel,
      input,
      pipelineLayers: layerInputs
    };
    
    fs.writeFileSync(filepath, JSON.stringify(logData, null, 2));
  }
  
  savePipelineResponse(pipelineId: string, requestId: string, processingTime: number, response: any, layerOutputs: any[]): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `pipeline-response-${pipelineId}-${requestId}-${timestamp}.json`;
    const filepath = path.join(this.baseDir, 'pipeline', 'responses', filename);
    
    const logData = {
      timestamp: new Date().toISOString(),
      requestId,
      pipelineId,
      processingTime,
      response,
      layerOutputs
    };
    
    fs.writeFileSync(filepath, JSON.stringify(logData, null, 2));
  }
}
```

#### 4.2 在各模块中集成日志保存

##### ConfigPreprocessor集成
```typescript
// 在ConfigPreprocessor.preprocess方法中
const debugLogManager = new DebugLogManager();

// 在方法开始记录输入
const startTime = Date.now();
const inputRecord = { configPath };

// 在方法结束记录输出
const processingTime = Date.now() - startTime;
debugLogManager.saveStartupModuleOutput(
  'ConfigPreprocessor',
  inputRecord,
  result,
  processingTime,
  errors
);
```

##### RouterPreprocessor集成
```typescript
// 在RouterPreprocessor.preprocess方法中
const debugLogManager = new DebugLogManager();

// 在方法开始记录输入
const startTime = Date.now();
const inputRecord = { routingTable };

// 在方法结束记录输出
const processingTime = Date.now() - startTime;
debugLogManager.saveStartupModuleOutput(
  'RouterPreprocessor',
  inputRecord,
  result,
  processingTime,
  errors
);
```

##### PipelineAssembler集成
```typescript
// 在PipelineAssembler.assemble方法中
const debugLogManager = new DebugLogManager();

// 在方法开始记录输入
const startTime = Date.now();
const inputRecord = { pipelineConfigs: pipelineConfigs.length };

// 在方法结束记录输出
const processingTime = Date.now() - startTime;
debugLogManager.saveStartupModuleOutput(
  'PipelineAssembler',
  inputRecord,
  result,
  processingTime,
  errors
);
```

##### HTTPServer流水线执行集成
```typescript
// 在HTTPServer.handleChatCompletions方法中
const debugLogManager = new DebugLogManager();

// 记录请求
const layerInputs = []; // 收集各层输入
debugLogManager.savePipelineRequest(
  selectedPipeline.id,
  requestId,
  routeModel,
  anthropicRequest,
  layerInputs
);

// 记录响应
const layerOutputs = []; // 收集各层输出
debugLogManager.savePipelineResponse(
  selectedPipeline.id,
  requestId,
  processingTime,
  pipelineResult,
  layerOutputs
);
```

### 5. 配置选项

在配置文件中添加日志配置选项：
```json
{
  "debug": {
    "enabled": true,
    "logModuleOutputs": true,
    "logPipelineRequests": true,
    "logPipelineResponses": true,
    "logDirectory": "debug-logs",
    "maxLogFiles": 1000,
    "cleanupInterval": 3600000
  }
}
```

### 6. 性能考虑

1. **异步写入**：使用异步文件写入避免阻塞主流程
2. **文件轮转**：实现日志文件轮转机制防止磁盘空间耗尽
3. **批量处理**：对于高频请求，考虑批量写入机制
4. **压缩存储**：对历史日志文件进行压缩存储

这个设计方案将确保每个模块的输出都被完整记录并保存为独立文件，便于调试和分析系统的完整执行流程。