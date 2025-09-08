# 数据捕获功能实现

## 1. Claude Code Router数据捕获实现

### 1.1 请求捕获点

在Claude Code Router的以下位置添加请求捕获逻辑：

```typescript
// src/index.ts - 在router函数中添加请求捕获
export const router = async (req: any, _res: any, config: any) => {
  // 添加请求捕获逻辑
  if (config.ENABLE_DATA_CAPTURE) {
    await captureRequestData('claude-code-router', 'request', req.body);
  }
  
  // 原有逻辑...
  // Parse sessionId from metadata.user_id
  if (req.body.metadata?.user_id) {
    const parts = req.body.metadata.user_id.split("_session_");
    if (parts.length > 1) {
      req.sessionId = parts[1];
    }
  }
  // ...其余代码
};
```

### 1.2 响应捕获点

在响应处理的适当位置添加响应捕获逻辑：

```typescript
// src/index.ts - 在响应处理中添加响应捕获
server.addHook("onSend", async (req, reply, payload) => {
  if (req.sessionId && req.url.startsWith("/v1/messages")) {
    // 添加响应捕获逻辑
    if (config.ENABLE_DATA_CAPTURE) {
      await captureResponseData('claude-code-router', 'response', payload);
    }
    
    // 原有逻辑...
    if (payload instanceof ReadableStream) {
      // ...SSE处理逻辑
    }
    // ...其余代码
  }
  return payload;
});
```

### 1.3 中间数据捕获

在关键转换点添加中间数据捕获：

```typescript
// 在Transformer、Protocol、Compatibility等模块的关键位置添加数据捕获
async function captureIntermediateData(system: string, stage: string, data: any, direction: 'request' | 'response') {
  if (!process.env.ENABLE_DATA_CAPTURE) return;
  
  const captureData = {
    system,
    stage,
    direction,
    timestamp: new Date().toISOString(),
    data: JSON.parse(JSON.stringify(data)) // 深拷贝避免引用问题
  };
  
  // 将数据写入文件或发送到专门的捕获服务
  await writeCaptureDataToFile(captureData);
}
```

## 2. 我们实现的数据捕获

### 2.1 Transformer层数据捕获

```typescript
// src/modules/pipeline-modules/transformers/secure-anthropic-openai-transformer.ts
export class SecureAnthropicOpenAITransformer implements BidirectionalTransformer {
  async transformRequest(anthropicRequest: any): Promise<any> {
    // 添加输入数据捕获
    await this.captureData('our-implementation', 'transformer-input', anthropicRequest, 'request');
    
    // 转换逻辑...
    const openAIRequest = this.convertAnthropicToOpenAI(anthropicRequest);
    
    // 添加输出数据捕获
    await this.captureData('our-implementation', 'transformer-output', openAIRequest, 'request');
    
    return openAIRequest;
  }
  
  async transformResponse(openAIResponse: any): Promise<any> {
    // 添加输入数据捕获
    await this.captureData('our-implementation', 'transformer-input', openAIResponse, 'response');
    
    // 转换逻辑...
    const anthropicResponse = this.convertOpenAIToAnthropic(openAIResponse);
    
    // 添加输出数据捕获
    await this.captureData('our-implementation', 'transformer-output', anthropicResponse, 'response');
    
    return anthropicResponse;
  }
  
  private async captureData(system: string, stage: string, data: any, direction: 'request' | 'response') {
    if (!process.env.ENABLE_DATA_CAPTURE) return;
    
    const captureEntry = {
      system,
      stage,
      direction,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      data: this.deepClone(data)
    };
    
    await this.dataCaptureService.capture(captureEntry);
  }
}
```

### 2.2 Protocol层数据捕获

```typescript
// src/modules/pipeline-modules/protocol/openai-protocol.ts
export class OpenAIProtocolModule implements ProtocolController {
  async processRequest(openAIRequest: any): Promise<any> {
    // 添加输入数据捕获
    await this.captureData('our-implementation', 'protocol-input', openAIRequest, 'request');
    
    // 协议处理逻辑...
    const processedRequest = this.handleProtocol(openAIRequest);
    
    // 添加输出数据捕获
    await this.captureData('our-implementation', 'protocol-output', processedRequest, 'request');
    
    return processedRequest;
  }
  
  // 类似地为响应处理添加数据捕获...
}
```

### 2.3 Compatibility层数据捕获

```typescript
// src/modules/pipeline-modules/server-compatibility/server-compatibility-base.ts
export abstract class ServerCompatibilityModule implements ModuleInterface, BidirectionalCompatibility {
  async processRequest(openAIRequest: any): Promise<any> {
    // 添加输入数据捕获
    await this.captureData('our-implementation', 'compatibility-input', openAIRequest, 'request');
    
    // 兼容性处理逻辑...
    const processedRequest = this.handleCompatibility(openAIRequest);
    
    // 添加输出数据捕获
    await this.captureData('our-implementation', 'compatibility-output', processedRequest, 'request');
    
    return processedRequest;
  }
  
  async processResponse(openAIResponse: any): Promise<any> {
    // 添加输入数据捕获
    await this.captureData('our-implementation', 'compatibility-input', openAIResponse, 'response');
    
    // 响应兼容性处理逻辑...
    const processedResponse = this.handleResponseCompatibility(openAIResponse);
    
    // 添加输出数据捕获
    await this.captureData('our-implementation', 'compatibility-output', processedResponse, 'response');
    
    return processedResponse;
  }
}
```

## 3. 数据捕获服务实现

### 3.1 捕获服务接口

```typescript
// src/services/data-capture-service.ts
export interface DataCaptureEntry {
  system: string;          // 系统标识 (claude-code-router | our-implementation)
  stage: string;           // 阶段标识 (transformer-input, protocol-output等)
  direction: 'request' | 'response';  // 数据方向
  timestamp: number;       // 时间戳
  sessionId?: string;      // 会话ID
  data: any;               // 捕获的数据
}

export interface DataCaptureService {
  capture(entry: DataCaptureEntry): Promise<void>;
  query(filter: DataQueryFilter): Promise<DataCaptureEntry[]>;
  clear(): Promise<void>;
}
```

### 3.2 文件存储实现

```typescript
// src/services/file-data-capture-service.ts
import { DataCaptureService, DataCaptureEntry, DataQueryFilter } from './data-capture-service';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export class FileDataCaptureService implements DataCaptureService {
  private readonly captureDir: string;
  
  constructor(captureDir: string = './captured-data') {
    this.captureDir = captureDir;
    if (!existsSync(this.captureDir)) {
      mkdirSync(this.captureDir, { recursive: true });
    }
  }
  
  async capture(entry: DataCaptureEntry): Promise<void> {
    const filename = `${entry.system}-${entry.stage}-${entry.direction}-${entry.timestamp}.json`;
    const filepath = join(this.captureDir, filename);
    
    writeFileSync(filepath, JSON.stringify(entry, null, 2));
  }
  
  async query(filter: DataQueryFilter): Promise<DataCaptureEntry[]> {
    // 实现查询逻辑，根据过滤条件读取和筛选捕获的数据文件
    // 这里简化实现，实际需要遍历目录并解析文件
    return [];
  }
  
  async clear(): Promise<void> {
    // 清空捕获目录
  }
}
```

### 3.3 内存存储实现（用于测试）

```typescript
// src/services/memory-data-capture-service.ts
export class MemoryDataCaptureService implements DataCaptureService {
  private readonly entries: DataCaptureEntry[] = [];
  
  async capture(entry: DataCaptureEntry): Promise<void> {
    this.entries.push(entry);
  }
  
  async query(filter: DataQueryFilter): Promise<DataCaptureEntry[]> {
    return this.entries.filter(entry => {
      // 根据过滤条件筛选数据
      return true;
    });
  }
  
  async clear(): Promise<void> {
    this.entries.length = 0;
  }
  
  getAllEntries(): DataCaptureEntry[] {
    return [...this.entries];
  }
}
```

## 4. 数据捕获配置

### 4.1 环境变量配置

```bash
# .env文件或环境变量
ENABLE_DATA_CAPTURE=true
DATA_CAPTURE_DIR=./captured-data
CAPTURE_SYSTEMS=claude-code-router,our-implementation
CAPTURE_STAGES=transformer,protocol,compatibility,server
```

### 4.2 配置文件

```json
// config/data-capture.json
{
  "enabled": true,
  "storage": {
    "type": "file",
    "directory": "./captured-data"
  },
  "systems": ["claude-code-router", "our-implementation"],
  "stages": ["transformer", "protocol", "compatibility", "server"],
  "directions": ["request", "response"],
  "filters": {
    "ignoreFields": ["id", "timestamp", "request_id"],
    "sessionFilter": null
  }
}
```

## 5. 数据捕获工具函数

### 5.1 数据克隆工具

```typescript
// src/utils/data-clone.ts
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item)) as any;
  }
  
  if (typeof obj === 'object') {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        (clonedObj as any)[key] = deepClone((obj as any)[key]);
      }
    }
    return clonedObj;
  }
  
  return obj;
}
```

### 5.2 数据写入工具

```typescript
// src/utils/data-writer.ts
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export async function writeCaptureDataToFile(data: any, baseDir: string = './captured-data'): Promise<void> {
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }
  
  const timestamp = Date.now();
  const filename = `capture-${timestamp}.json`;
  const filepath = join(baseDir, filename);
  
  writeFileSync(filepath, JSON.stringify(data, null, 2));
}
```

## 6. 集成到现有系统

### 6.1 在主应用中初始化数据捕获服务

```typescript
// src/index.ts
import { FileDataCaptureService } from './services/file-data-capture-service';

let dataCaptureService: FileDataCaptureService;

async function initializeApp() {
  // 初始化数据捕获服务
  if (process.env.ENABLE_DATA_CAPTURE === 'true') {
    dataCaptureService = new FileDataCaptureService(process.env.DATA_CAPTURE_DIR);
  }
  
  // 其余初始化逻辑...
}
```

### 6.2 在各模块中使用数据捕获服务

```typescript
// 在各模块的构造函数或初始化方法中注入数据捕获服务
constructor(private dataCaptureService: DataCaptureService) {}
```