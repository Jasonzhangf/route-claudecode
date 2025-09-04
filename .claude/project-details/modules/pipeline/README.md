# 流水线模块 (Pipeline Modules)

## 模块概述

流水线模块包含RCC v4.0系统的核心处理链，由四个层级组成：
1. Transformer层 - 协议格式转换
2. Protocol层 - 协议控制处理
3. ServerCompatibility层 - 服务器兼容性处理
4. Server层 - 实际服务器通信

## 目录结构

```
pipeline-modules/
├── README.md                           # 流水线模块文档
├── index.ts                            # 模块入口
├── base-pipeline-module.ts             # 基础流水线模块类
├── protocol/                           # 协议层
│   ├── README.md                       # 协议层文档
│   ├── openai-protocol.ts              # OpenAI协议处理器
│   ├── gemini-protocol.ts              # Gemini协议处理器
│   └── gemini-native-protocol.ts       # Gemini原生协议处理器
├── server-compatibility/               # 服务器兼容层
│   ├── README.md                       # 服务器兼容层文档
│   ├── adaptive-compatibility.ts       # 智能自适应兼容性模块
│   ├── lmstudio-compatibility.ts       # LM Studio兼容性处理器
│   ├── modelscope-compatibility.ts     # ModelScope兼容性处理器
│   ├── qwen-compatibility.ts           # Qwen兼容性处理器
│   ├── ollama-compatibility.ts         # Ollama兼容性处理器
│   ├── vllm-compatibility.ts           # vLLM兼容性处理器
│   ├── iflow-compatibility.ts          # IFlow兼容性处理器
│   ├── passthrough-compatibility.ts    # 透传兼容性处理器
│   ├── response-compatibility-fixer.ts # 响应兼容性修复器
│   ├── parameter-adapter.ts            # 参数适配器
│   ├── error-response-normalizer.ts    # 错误响应标准化器
│   ├── debug-integration.ts            # Debug集成模块
│   └── types/
│       └── compatibility-types.ts      # 兼容性类型定义
└── server/                             # 服务器层
    ├── README.md                       # 服务器层文档
    ├── openai-server.ts                # OpenAI服务器处理器
    └── __tests__/
        └── openai-server.test.ts       # OpenAI服务器测试
```

## 核心功能

### 四层处理链
1. **Transformer层** - 处理Anthropic ↔ OpenAI等协议格式转换
2. **Protocol层** - 处理流式 ↔ 非流式等协议控制转换
3. **ServerCompatibility层** - 处理不同AI服务商的兼容性问题
4. **Server层** - 处理与AI服务商的实际通信

### 模块化设计
- 每个层级都是独立的模块，可单独开发和测试
- 支持多种AI服务商的实现
- 严格遵循ModuleInterface接口规范
- 支持API化管理和动态加载