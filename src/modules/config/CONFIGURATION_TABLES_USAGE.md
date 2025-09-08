# RCC v4.0 字段转换配置表使用文档

## 📋 概述

本文档详细说明了RCC v4.0中基于配置表的字段转换系统的使用方法。该系统通过定义标准化的转换规则配置表，实现了灵活、可维护的字段映射和转换功能。

## 🏗️ 系统架构

```
Anthropic格式输入 → Transformer层配置 → OpenAI格式 → ServerCompatibility层配置 → Provider特定格式
       ↓              ↓              ↓              ↓                  ↓
  字段提取    转换规则应用    字段映射    兼容性调整    HTTP请求生成
```

## 📁 配置文件结构

### 1. 核心配置文件
- `field-transform-config.ts` - 字段转换配置表定义
- `field-transform-core.ts` - 转换引擎核心实现
- `transform-functions.ts` - 通用转换函数库
- `routing-table-types.ts` - 类型定义

## 🔧 配置表详细说明

### 1. Transformer层配置表

#### 基础字段转换 (basicFields)
```typescript
const basicFields: FieldTransformRule[] = [
  {
    source: 'model',
    target: 'model',
    transform: (value: any) => value,
    required: true,
    description: '模型名称转换'
  },
  {
    source: 'temperature',
    target: 'temperature',
    transform: (value: any) => Math.min(Math.max(Number(value), 0), 2),
    defaultValue: 0.7,
    description: '温度参数转换 (0-2范围)'
  }
];
```

#### 消息字段转换 (messageFields)
```typescript
const messageFields: FieldTransformRule[] = [
  {
    source: 'system',
    target: 'messages[0]',
    transform: (system: string, context: any) => {
      if (!system) return context.messages || [];
      return [
        { role: 'system', content: system },
        ...(context.messages || [])
      ];
    },
    description: '系统消息转换为OpenAI格式'
  }
];
```

#### 工具字段转换 (toolFields)
```typescript
const toolFields: FieldTransformRule[] = [
  {
    source: 'tools',
    target: 'tools',
    transform: (tools: any[]) => {
      return tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema
        }
      }));
    },
    description: '工具定义格式转换'
  }
];
```

### 2. ServerCompatibility层配置表

#### Provider特定配置
```typescript
const qwenConfig: ProviderFieldConfig = {
  provider: 'qwen',
  supportsOpenAIPassthrough: true,
  requestTransforms: [
    {
      source: 'top_p',
      target: 'top_p',
      transform: (value: any) => Number(value) || 0.9,
      description: 'Qwen推荐Top-P值'
    }
  ],
  specialHandling: {
    tools: {
      inputFormat: 'openai',
      outputFormat: 'openai'
    },
    streaming: {
      supported: true,
      responseConversion: false
    },
    auth: {
      type: 'bearer',
      tokenSource: 'apiKey'
    }
  }
};
```

## 🚀 使用示例

### 1. 基本转换流程
```typescript
import { FieldTransformEngineCore } from './field-transform-core';
import { TRANSFORMER_FIELD_CONFIGS } from './field-transform-config';

// 输入数据 (Anthropic格式)
const anthropicInput = {
  model: 'claude-3-5-sonnet',
  system: 'You are a helpful assistant.',
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
  temperature: 0.7,
  tools: [
    {
      name: 'get_weather',
      description: 'Get weather information',
      input_schema: {
        type: 'object',
        properties: {
          location: { type: 'string' }
        }
      }
    }
  ]
};

// 应用转换规则
const openAIOutput = FieldTransformEngineCore.transform(
  [
    ...TRANSFORMER_FIELD_CONFIGS.basicFields,
    ...TRANSFORMER_FIELD_CONFIGS.messageFields,
    ...TRANSFORMER_FIELD_CONFIGS.toolFields
  ],
  anthropicInput,
  { provider: 'qwen', layer: 'transformer' }
);

console.log(openAIOutput);
// 输出: OpenAI兼容格式的数据
```

### 2. Provider兼容性调整
```typescript
import { COMPATIBILITY_FIELD_CONFIGS } from './field-transform-config';

// 应用Qwen特定的兼容性调整
const qwenCompatible = FieldTransformEngineCore.transform(
  COMPATIBILITY_FIELD_CONFIGS.providers.qwen.requestTransforms,
  openAIOutput,
  { provider: 'qwen', layer: 'server-compatibility' }
);

// 添加Qwen特定的HTTP头
qwenCompatible.headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${apiKey}`,
  'X-DashScope-Async': 'enable'
};
```

## 🛠️ 转换函数库使用

### 1. 通用类型转换
```typescript
import { typeTransforms } from './transform-functions';

// 字符串转换
const str = typeTransforms.toString(123); // "123"

// 数字转换
const num = typeTransforms.toNumber("42.5"); // 42.5

// 布尔值转换
const bool = typeTransforms.toBoolean("true"); // true
```

### 2. 验证和范围限制
```typescript
import { validationTransforms } from './transform-functions';

// 范围限制
const clamped = validationTransforms.clamp(0, 100)(150); // 100

// 默认值处理
const withDefault = validationTransforms.defaultValue("default")(null); // "default"
```

### 3. 格式特定转换
```typescript
import { anthropicToOpenAITransforms } from './transform-functions';

// 消息格式转换
const openAIMessages = anthropicToOpenAITransforms.messages([
  { role: 'user', content: 'Hello!' }
]);

// 工具定义转换
const openAITools = anthropicToOpenAITransforms.tools([
  {
    name: 'tool_name',
    description: 'Tool description',
    input_schema: { /* schema */ }
  }
]);
```

## 📊 配置表字段说明

### FieldTransformRule 接口
```typescript
interface FieldTransformRule {
  source: string;           // 源字段路径
  target: string;           // 目标字段路径
  transform: Function;      // 转换函数
  required?: boolean;       // 是否必需字段
  defaultValue?: any;       // 默认值
  fallbackValue?: any;      // 失败时的备选值
  description?: string;     // 描述信息
}
```

### ProviderFieldConfig 接口
```typescript
interface ProviderFieldConfig {
  provider: string;                    // Provider名称
  supportsOpenAIPassthrough: boolean;  // 是否支持直通模式
  requestTransforms: FieldTransformRule[];  // 请求转换规则
  responseTransforms: FieldTransformRule[]; // 响应转换规则
  specialHandling?: {                  // 特殊处理配置
    tools?: { inputFormat: string; outputFormat: string };
    streaming?: { supported: boolean; responseConversion: boolean };
    auth?: { type: string; tokenSource: string };
  };
}
```

## 🔧 扩展和自定义

### 1. 添加新的转换规则
```typescript
// 在field-transform-config.ts中添加
const customFields: FieldTransformRule[] = [
  {
    source: 'custom_field',
    target: 'mapped_field',
    transform: (value: any) => value.toUpperCase(),
    description: '自定义字段转换'
  }
];

// 使用自定义规则
const result = FieldTransformEngineCore.transform(
  customFields,
  inputData,
  context
);
```

### 2. 添加新的Provider配置
```typescript
// 在COMPATIBILITY_FIELD_CONFIGS.providers中添加
const newProviderConfig: ProviderFieldConfig = {
  provider: 'new-provider',
  supportsOpenAIPassthrough: false,
  requestTransforms: [
    // Provider特定的转换规则
  ],
  responseTransforms: [
    // 响应转换规则
  ]
};
```

## 📈 性能优化建议

### 1. 批量处理
```typescript
// 使用批量转换处理多个请求
const results = FieldTransformEngineCore.batchTransform(
  rules,
  dataArray,
  context
);
```

### 2. 条件转换
```typescript
// 根据条件应用不同的规则
const result = FieldTransformEngineCore.conditionalTransform(
  {
    'provider==qwen': qwenRules,
    'provider==lmstudio': lmstudioRules
  },
  inputData,
  context
);
```

## 🎯 最佳实践

### 1. 配置组织
- 按功能模块组织转换规则
- 使用描述性命名
- 保持配置的可读性

### 2. 错误处理
- 为必需字段设置默认值
- 提供合理的fallback值
- 记录转换过程中的错误

### 3. 测试验证
- 验证每个转换规则
- 测试边界条件
- 确保数据完整性

## 📚 相关文件

1. **类型定义**: `src/modules/config/src/routing-table-types.ts`
2. **配置表**: `src/modules/config/src/field-transform-config.ts`
3. **转换引擎**: `src/modules/config/src/field-transform-core.ts`
4. **函数库**: `src/modules/config/src/transform-functions.ts`

通过这套基于配置表的字段转换系统，RCC v4.0实现了高度灵活和可维护的字段映射功能，支持快速适配不同的Provider和格式要求。