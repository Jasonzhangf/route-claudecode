# Server层 - 双向HTTP API通信模块

## 模块概述

**位置**: 流水线第4层 (Server Layer)
**职责**: HTTP API调用和双向响应处理
**架构**: 预配置 + 双向处理 + HTTP通信

Server层是流水线的第四层，负责与AI服务提供商的实际HTTP API通信。通过预配置的HTTP客户端和连接池，执行API调用并处理响应。采用官方SDK优先策略，确保通信的可靠性和兼容性。

## 目录结构

```
server/
├── README.md                    # 服务器模块文档
├── openai-server.ts             # OpenAI服务器实现
└── __tests__/
    └── openai-server.test.ts    # OpenAI服务器测试
```

## 核心功能

### 1. 网络通信
- **官方SDK优先**: 使用官方提供的SDK进行通信
- **认证处理**: 根据服务商要求设置正确的认证
- **健康检查**: 发送轻量级请求验证服务可用性
- **多Key认证支持**: 支持轮询和随机策略的多API Key认证

### 2. 支持的服务商
- **OpenAI**: 使用官方OpenAI SDK
- **LMStudio**: 使用OpenAI SDK + 自定义baseURL
- *(其他服务商将在后续版本中支持)*

## 接口定义

```typescript
interface ModuleInterface {
  // 基础信息
  getId(): string;
  getName(): string;
  getType(): ModuleType;
  getVersion(): string;
  
  // 状态管理
  getStatus(): ModuleStatus;
  getMetrics(): ModuleMetrics;
  
  // 生命周期
  configure(config: any): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  process(input: any): Promise<any>;
  reset(): Promise<void>;
  cleanup(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; details: any }>;
  
  // 模块间通信
  addConnection(module: ModuleInterface): void;
  removeConnection(moduleId: string): void;
  getConnection(moduleId: string): ModuleInterface | undefined;
  getConnections(): ModuleInterface[];
  sendToModule(targetModuleId: string, message: any, type?: string): Promise<any>;
  broadcastToModules(message: any, type?: string): Promise<void>;
  onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void): void;
}
```

## 服务商实现

### OpenAI服务器实现
```typescript
export class OpenAIServerModule extends EventEmitter implements ModuleInterface {
  async process(input: ServerRequest): Promise<ServerResponse> {
    // 验证请求
    this.validateServerRequest(input);
    
    // 发送请求到OpenAI
    const response = await this.sendRequest(input);
    
    return response;
  }
  
  private async sendRequest(request: ServerRequest): Promise<ServerResponse> {
    // 使用OpenAI SDK发送请求
    const response = await this.openaiClient.chat.completions.create({
      model: request.model,
      messages: request.messages as any,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      // ...其他参数
    });
    
    return response as ServerResponse;
  }
  
  async authenticate(): Promise<boolean> {
    // 测试认证
    const models = await this.openaiClient.models.list();
    return true;
  }
  
  async checkHealth(): Promise<{ healthy: boolean; responseTime: number; error?: string }> {
    // 健康检查
    await this.authenticate();
    return { healthy: true, responseTime: 0 };
  }
}
```

### LMStudio服务器实现
LMStudio使用OpenAI SDK实现，通过自定义baseURL连接到本地服务：

```typescript
// LMStudio配置示例
const config: OpenAIServerConfig = {
  baseURL: 'http://localhost:1234/v1', // LMStudio默认端点
  apiKey: 'lm-studio', // LMStudio不需要真实API Key
  timeout: 30000,
  maxRetries: 3
};
```

## 多Key认证支持

服务器模块支持多API Key认证，提高服务可用性：

```typescript
interface OpenAIServerConfig {
  multiKeyAuth?: {
    enabled: boolean;
    strategy: 'round-robin' | 'random';
    apiKeys: string[];
  };
}
```

## 错误处理

统一的错误处理机制确保所有异常都能被正确捕获和处理：

```typescript
// 使用统一的第三方服务错误处理器
const { standardizedError } = handleOpenAIError(
  error,
  request.model,
  this.config.baseURL,
  {
    requestId: `openai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    moduleId: this.id,
    operation: 'sendRequest',
  },
  false // 服务器错误，保持原状态码
);
```

## 性能优化

### 连接管理
- 复用HTTP连接
- 合理的连接超时设置
- 连接数限制

### 请求优化
- 请求参数验证缓存
- 及时释放已处理的数据
- 内存使用监控

## 质量要求

- ✅ 无静默失败
- ✅ 无mockup网络请求
- ✅ 无重复网络代码
- ✅ 无硬编码API端点
- ✅ 完整的网络错误处理
- ✅ 官方SDK优先使用
- ✅ 完整的健康检查
- ✅ 标准认证处理
- ✅ API化管理支持
- ✅ 模块化接口实现