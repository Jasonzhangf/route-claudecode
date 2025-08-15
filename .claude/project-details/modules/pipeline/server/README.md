# Server模块

## 模块概述

Server模块负责与AI服务提供商的实际通信，优先使用官方SDK，在SDK不可用时回退到HTTP客户端，确保最佳的兼容性和性能。

## 目录结构

```
src/pipeline/modules/server/
├── README.md                    # Server模块总体说明
├── index.ts                     # 模块入口
├── server-module.ts             # 基础Server模块类
├── openai/                      # OpenAI实现
│   ├── README.md                # OpenAI模块说明
│   ├── openai-server.ts         # OpenAI服务实现
│   ├── openai-types.ts          # OpenAI类型定义
│   └── docs/                    # OpenAI SDK文档
│       ├── openai-sdk-guide.md  # SDK使用指南
│       └── api-reference.md     # API参考文档
├── gemini/                      # Gemini实现
│   ├── README.md
│   ├── gemini-server.ts
│   ├── gemini-auth.ts           # OAuth认证处理
│   ├── gemini-types.ts
│   └── docs/
│       ├── gemini-sdk-guide.md
│       └── oauth-setup.md
├── anthropic/                   # Anthropic实现
│   ├── README.md
│   ├── anthropic-server.ts
│   ├── anthropic-types.ts
│   └── docs/
├── lmstudio/                    # LMStudio实现
│   ├── README.md
│   ├── lmstudio-server.ts
│   ├── lmstudio-types.ts
│   └── docs/
├── ollama/                      # Ollama实现
│   ├── README.md
│   ├── ollama-server.ts
│   ├── ollama-types.ts
│   └── docs/
└── codewhisperer/               # CodeWhisperer实现
    ├── README.md
    ├── codewhisperer-server.ts
    ├── codewhisperer-auth.ts    # AWS IAM认证
    ├── codewhisperer-types.ts
    └── docs/
```

## 核心功能

### 1. 网络通信
- **官方SDK优先**: 优先使用官方提供的SDK
- **HTTP回退**: SDK不可用时使用HTTP客户端
- **认证处理**: 根据服务商要求设置正确的认证
- **健康检查**: 发送轻量级请求验证服务可用性

### 2. 支持的服务商
- **OpenAI**: 使用官方OpenAI SDK
- **Anthropic**: 使用官方Anthropic SDK
- **Gemini**: 使用官方Google AI SDK
- **LMStudio**: 使用OpenAI SDK + 自定义baseURL
- **Ollama**: 使用官方Ollama SDK
- **CodeWhisperer**: 使用AWS SDK

## 接口定义

```typescript
interface ServerModule extends PipelineModule {
  name: 'server';
  serverType: string;
  sdk?: any;
  
  sendRequest(request: ServerRequest): Promise<ServerResponse>;
  authenticate(): Promise<boolean>;
  checkHealth(): Promise<boolean>;
}
```

## 服务商实现

### OpenAI服务器实现
```typescript
// src/pipeline/modules/server/openai/openai-server.ts
import OpenAI from 'openai';

export class OpenAIServer implements ServerModule {
  name = 'server' as const;
  serverType = 'openai';
  private client: OpenAI;
  
  constructor(config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://api.openai.com/v1',
    });
  }
  
  async sendRequest(request: OpenAIRequest): Promise<OpenAIResponse> {
    try {
      return await this.client.chat.completions.create(request);
    } catch (error) {
      throw new NetworkError('OpenAI API request failed', error);
    }
  }
  
  async authenticate(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
  
  async checkHealth(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}
```

### Gemini服务器实现
```typescript
// src/pipeline/modules/server/gemini/gemini-server.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OAuth2Client } from 'google-auth-library';

export class GeminiServer implements ServerModule {
  name = 'server' as const;
  serverType = 'gemini';
  private genAI: GoogleGenerativeAI;
  private authClient: OAuth2Client;
  
  constructor(config: ProviderConfig) {
    this.authClient = new OAuth2Client(
      config.clientId,
      config.clientSecret
    );
    this.genAI = new GoogleGenerativeAI(config.apiKey);
  }
  
  async sendRequest(request: GeminiRequest): Promise<GeminiResponse> {
    try {
      const model = this.genAI.getGenerativeModel({ 
        model: request.model 
      });
      
      if (request.stream) {
        return await model.generateContentStream(request);
      } else {
        return await model.generateContent(request);
      }
    } catch (error) {
      throw new NetworkError('Gemini API request failed', error);
    }
  }
  
  async authenticate(): Promise<boolean> {
    try {
      const tokens = await this.authClient.getAccessToken();
      return !!tokens.token;
    } catch {
      return false;
    }
  }
}
```

### LMStudio服务器实现
```typescript
// src/pipeline/modules/server/lmstudio/lmstudio-server.ts
import OpenAI from 'openai';

export class LMStudioServer implements ServerModule {
  name = 'server' as const;
  serverType = 'lmstudio';
  private client: OpenAI;
  
  constructor(config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: 'lm-studio', // LMStudio不需要真实API Key
      baseURL: config.baseUrl || 'http://localhost:1234/v1',
    });
  }
  
  async sendRequest(request: LMStudioRequest): Promise<LMStudioResponse> {
    try {
      return await this.client.chat.completions.create(request);
    } catch (error) {
      throw new NetworkError('LMStudio API request failed', error);
    }
  }
  
  async checkHealth(): Promise<boolean> {
    try {
      // 检查本地端口是否可用
      const response = await fetch(`${this.client.baseURL}/models`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### Anthropic服务器实现
```typescript
// src/pipeline/modules/server/anthropic/anthropic-server.ts
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicServer implements ServerModule {
  name = 'server' as const;
  serverType = 'anthropic';
  private client: Anthropic;
  
  constructor(config: ProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }
  
  async sendRequest(request: AnthropicRequest): Promise<AnthropicResponse> {
    try {
      if (request.stream) {
        return await this.client.messages.stream(request);
      } else {
        return await this.client.messages.create(request);
      }
    } catch (error) {
      throw new NetworkError('Anthropic API request failed', error);
    }
  }
  
  async checkHealth(): Promise<boolean> {
    try {
      // Anthropic没有专门的健康检查端点，使用轻量级请求
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      });
      return true;
    } catch {
      return false;
    }
  }
}
```

### CodeWhisperer服务器实现
```typescript
// src/pipeline/modules/server/codewhisperer/codewhisperer-server.ts
import { 
  CodeWhispererRuntimeClient, 
  GenerateCompletionsCommand 
} from '@aws-sdk/client-codewhisperer-runtime';

export class CodeWhispererServer implements ServerModule {
  name = 'server' as const;
  serverType = 'codewhisperer';
  private client: CodeWhispererRuntimeClient;
  
  constructor(config: ProviderConfig) {
    this.client = new CodeWhispererRuntimeClient({
      region: config.region || 'us-east-1',
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  
  async sendRequest(request: CodeWhispererRequest): Promise<CodeWhispererResponse> {
    try {
      const command = new GenerateCompletionsCommand(request);
      return await this.client.send(command);
    } catch (error) {
      throw new NetworkError('CodeWhisperer API request failed', error);
    }
  }
  
  async authenticate(): Promise<boolean> {
    try {
      // 测试AWS凭据是否有效
      const testCommand = new GenerateCompletionsCommand({
        fileContext: { filename: 'test.js', programmingLanguage: { languageName: 'javascript' } },
        maxResults: 1
      });
      await this.client.send(testCommand);
      return true;
    } catch {
      return false;
    }
  }
}
```

## SDK文档管理

### 文档结构
每个服务商的docs目录包含：
- **SDK使用指南**: 官方SDK的使用方法
- **API参考文档**: 完整的API文档
- **认证设置**: 认证配置说明
- **错误处理**: 常见错误和解决方案

### 文档更新策略
- 定期同步官方文档
- 记录版本变更
- 保持文档的时效性

## 认证处理

### 认证类型
- **Bearer Token**: OpenAI, Anthropic, DeepSeek
- **API Key**: 大多数服务商
- **OAuth2**: Gemini (Google)
- **AWS IAM**: CodeWhisperer
- **无认证**: LMStudio (本地服务)

### 认证实现
```typescript
interface AuthenticationHandler {
  authenticate(): Promise<boolean>;
  refreshToken?(): Promise<void>;
  getAuthHeaders(): Record<string, string>;
}
```

## 健康检查

### 检查策略
- **轻量级请求**: 使用最小的API调用
- **定期检查**: 按配置间隔执行
- **故障检测**: 连续失败时标记为不健康
- **自动恢复**: 健康检查恢复时重新启用

### 检查实现
```typescript
class HealthChecker {
  async checkHealth(server: ServerModule): Promise<HealthStatus> {
    try {
      const isHealthy = await server.checkHealth();
      return {
        isHealthy,
        lastCheck: Date.now(),
        consecutiveFailures: isHealthy ? 0 : this.incrementFailures(server)
      };
    } catch (error) {
      return {
        isHealthy: false,
        lastCheck: Date.now(),
        error: error.message,
        consecutiveFailures: this.incrementFailures(server)
      };
    }
  }
}
```

## 错误处理

### 网络错误
```typescript
class NetworkError extends Error {
  constructor(message: string, originalError?: any) {
    super(message);
    this.name = 'NetworkError';
    this.originalError = originalError;
  }
}
```

### 认证错误
```typescript
class AuthenticationError extends Error {
  constructor(serverType: string, message: string) {
    super(`Authentication failed for ${serverType}: ${message}`);
    this.name = 'AuthenticationError';
  }
}
```

## 性能优化

### 连接池
- 复用HTTP连接
- 合理的连接超时
- 连接数限制

### 请求优化
- 请求压缩
- 响应缓存（可选）
- 并发控制

## 质量要求

- ✅ 无静默失败
- ✅ 无mockup网络请求
- ✅ 无重复网络代码
- ✅ 无硬编码API端点
- ✅ 完整的网络错误处理
- ✅ 官方SDK优先使用
- ✅ 完整的健康检查
- ✅ 标准认证处理