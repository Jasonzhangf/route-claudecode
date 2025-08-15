# 流水线Worker模块 (Pipeline Worker Module)

## 模块概述

流水线Worker是RCC v4.0的核心处理单元，每个provider.model组合都有独立的处理流水线，实现完全隔离的请求处理。

## 目录结构

```
src/pipeline/
├── README.md                    # 流水线模块文档
├── index.ts                     # 流水线模块入口
├── pipeline-framework.ts        # 流水线框架
└── modules/                     # 流水线子模块
    ├── transformer/             # Transformer模块
    │   ├── README.md
    │   ├── index.ts
    │   ├── transformer-module.ts
    │   ├── openai-transformer.ts
    │   └── anthropic-transformer.ts
    ├── protocol/                # Protocol模块
    │   ├── README.md
    │   ├── index.ts
    │   ├── protocol-module.ts
    │   ├── openai-protocol.ts
    │   └── anthropic-protocol.ts
    ├── server-compatibility/    # Server-Compatibility模块
    │   ├── README.md
    │   ├── index.ts
    │   ├── server-compatibility-module.ts
    │   ├── openai-compatibility.ts
    │   ├── deepseek-compatibility.ts
    │   └── gemini-compatibility.ts
    └── server/                  # Server模块
        ├── README.md
        ├── index.ts
        ├── server-module.ts
        ├── openai/
        │   ├── README.md
        │   ├── openai-server.ts
        │   └── docs/
        ├── gemini/
        │   ├── README.md
        │   ├── gemini-server.ts
        │   └── docs/
        └── anthropic/
            ├── README.md
            ├── anthropic-server.ts
            └── docs/
```

## 流水线架构

### 数据流向
```
Anthropic Request
        │
        ▼
┌─────────────────┐
│  Transformer    │ ── Anthropic ↔ Protocol 请求转换
└─────────────────┘
        │
        ▼
┌─────────────────┐
│  Protocol       │ ── 协议控制转换 (流式 ↔ 非流式)
└─────────────────┘
        │
        ▼
┌─────────────────┐
│Server-Compat    │ ── 第三方服务器兼容处理
└─────────────────┘
        │
        ▼
┌─────────────────┐
│  Server         │ ── 标准服务器协议处理
└─────────────────┘
        │
        ▼
AI Service Provider
```

### 流水线生命周期
1. **PENDING**: 等待创建
2. **CREATING**: 正在初始化
3. **ACTIVE**: 活跃可用
4. **PROCESSING**: 处理请求中
5. **INACTIVE**: 暂时不可用
6. **DESTROYING**: 正在销毁
7. **DESTROYED**: 已销毁

## 核心组件

### 1. 流水线框架
```typescript
interface PipelineFramework {
  id: string;
  provider: string;
  model: string;
  modules: PipelineModule[];
  
  process(input: any): Promise<any>;
  validate(): boolean;
  destroy(): Promise<void>;
}
```

### 2. 流水线模块接口
```typescript
interface PipelineModule {
  name: string;
  process(input: any): Promise<any>;
  validate(input: any): boolean;
  getSchema(): ValidationSchema;
}
```

## 模块职责

### Transformer模块
- **职责**: Anthropic ↔ Protocol 请求转换
- **输入验证**: Anthropic request标准格式
- **输出验证**: 目标protocol格式
- **命名规则**: 以目标protocol命名

### Protocol模块
- **职责**: 协议控制转换
- **流式处理**: 流式请求 → 非流式请求 → 流式响应
- **协议校验**: 输入输出都做协议标准校验

### Server-Compatibility模块
- **职责**: 第三方服务器兼容处理
- **输入**: 标准protocol协议
- **输出**: 第三方特定格式
- **重点**: OpenAI变种和扩展处理

### Server模块
- **职责**: 标准服务器协议处理
- **SDK优先**: 有SDK就使用标准SDK
- **协议标准**: 严格按照服务器协议标准

## 动态管理

### 流水线注册
- 根据provider.model.availability动态创建
- 配置变化时自动调整
- 健康检查失败时自动销毁

### 资源管理
- 及时清理不用的流水线
- 内存使用监控
- 连接池复用

## 错误处理

### 错误类型
- PIPELINE_ERROR: 流水线处理错误
- VALIDATION_ERROR: 数据验证错误
- NETWORK_ERROR: 网络请求错误

### 处理原则
- 任何模块处理失败立即停止流水线
- 使用标准API error handler
- 包含模块名和详细错误信息
- 不允许静默失败

## 质量要求

- ✅ 无静默失败
- ✅ 无mockup响应
- ✅ 无重复代码
- ✅ 无硬编码流水线逻辑
- ✅ 完整的数据校验
- ✅ 标准接口通信
- ✅ 真实流水线测试