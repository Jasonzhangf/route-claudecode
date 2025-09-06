# Transformer层 - 双向协议转换模块

## 模块概述

**位置**: 流水线第1层 (Transformer Layer)
**职责**: Anthropic ↔ Provider协议双向转换
**架构**: 预配置 + 双向处理 + 模板字段表转换

Transformer层是流水线的第一层，负责Anthropic格式与Provider协议（OpenAI/Gemini/etc）之间的双向转换。采用预配置模板和模板字段表转换，替代硬编码逻辑。

## 目录结构

```
transformers/
├── README.md                           # 转换器模块文档
├── index.ts                            # 模块入口
├── transformer-api.ts                  # Transformer API接口
├── transformer-factory.ts              # Transformer工厂
├── secure-anthropic-openai-transformer.ts  # 安全Anthropic→OpenAI转换器
├── secure-gemini-transformer.ts        # 安全Gemini转换器
├── anthropic-openai-converter.ts       # Anthropic↔OpenAI转换核心逻辑
└── __tests__/
    └── secure-transformer.test.ts      # 安全转换器测试
```

## 核心功能

### 1. 格式转换
- **Anthropic → Target Protocol**: 请求格式转换
- **Target Protocol → Anthropic**: 响应格式转换
- **双向验证**: 输入输出格式验证
- **工具调用转换**: 不同协议的工具调用格式适配

### 2. 支持的协议
- **OpenAI**: GPT系列模型协议
- **Anthropic**: Claude系列模型协议
- **Gemini**: Google Gemini协议
- **可扩展**: 支持新协议的插件式添加

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

## 转换规则

### OpenAI转换器
```typescript
// Anthropic → OpenAI
{
  "model": "claude-3-5-sonnet-20241022",
  "messages": [
    {
      "role": "user",
      "content": "Hello"
    }
  ]
}
↓
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "user", 
      "content": "Hello"
    }
  ]
}
```

### Gemini转换器
```typescript
// Anthropic → Gemini
{
  "messages": [
    {
      "role": "user",
      "content": "Hello"
    }
  ]
}
↓
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "Hello"
        }
      ]
    }
  ]
}
```

## 工具调用转换

### Anthropic工具格式
```json
{
  "tools": [
    {
      "name": "get_weather",
      "description": "Get weather information",
      "input_schema": {
        "type": "object",
        "properties": {
          "location": {"type": "string"}
        }
      }
    }
  ]
}
```

### OpenAI工具格式
```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get weather information",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {"type": "string"}
          }
        }
      }
    }
  ]
}
```

### Gemini工具格式
```json
{
  "function_declarations": [
    {
      "name": "get_weather",
      "description": "Get weather information",
      "parameters": {
        "type": "object",
        "properties": {
          "location": {"type": "string"}
        }
      }
    }
  ]
}
```

## 流式处理

### 流式响应转换
- 保持流式特性不变
- 逐块转换响应格式
- 处理不同协议的流式标记

### 错误处理
- 格式验证失败时抛出TransformerSecurityError
- 使用标准API error handler
- 包含具体的转换错误信息

## 实现示例

```typescript
export class SecureAnthropicToOpenAITransformer extends EventEmitter implements ModuleInterface {
  constructor(config?: Partial<SecureTransformerConfig>) {
    super();
  }

  async process(input: any): Promise<any> {
    if (this.status.status !== 'running') {
      throw new Error('Module is not running');
    }
    
    // 验证输入格式
    if (!input || typeof input !== 'object') {
      throw new TransformerSecurityError('Invalid input format', 'INVALID_INPUT');
    }

    // 执行转换
    const output = transformAnthropicToOpenAI(input);
    
    return output;
  }
}
```

## 质量要求

- ✅ 无静默失败
- ✅ 无mockup转换
- ✅ 无重复转换代码
- ✅ 无硬编码协议格式
- ✅ 完整的格式验证
- ✅ 双向转换支持
- ✅ 工具调用完整支持
- ✅ API化管理支持
- ✅ 模块化接口实现