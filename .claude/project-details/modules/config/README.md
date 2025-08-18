# 配置模块 (Config Module)

## 模块概述

配置模块是RCC v4.0系统的配置管理中心，负责系统配置的加载、验证、管理和动态更新。

## 模块职责

1. **配置加载**: 从文件系统加载系统配置
2. **配置验证**: 验证配置文件的格式和内容正确性
3. **配置管理**: 管理配置的生命周期和变更
4. **动态更新**: 支持配置的动态更新和重载
5. **环境适配**: 支持环境变量替换和配置覆盖

## 模块结构

```
config/
├── README.md                          # 本模块设计文档
├── index.ts                           # 模块入口和导出
├── config-manager.ts                   # 配置管理器
├── config-validator.ts                # 配置验证器
├── config-loader.ts                   # 配置加载器
├── config-watcher.ts                  # 配置监视器
├── config-encryptor.ts                # 配置加密器
├── environment-processor.ts            # 环境变量处理器
└── schemas/                           # 配置Schema定义
    ├── provider-config-schema.ts      # Provider配置Schema
    ├── routing-config-schema.ts      # 路由配置Schema
    └── debug-config-schema.ts        # Debug配置Schema
```

## 核心组件

### 配置管理器 (ConfigManager)
负责配置的完整生命周期管理，是模块的主入口点。

### 配置加载器 (ConfigLoader)
负责从文件系统加载配置文件，支持多种配置格式。

### 配置验证器 (ConfigValidator)
验证配置文件的格式和内容正确性，确保配置有效。

### 配置监视器 (ConfigWatcher)
监视配置文件变化，支持动态配置更新。

### 配置加密器 (ConfigEncryptor)
处理敏感配置信息的加密和解密。

### 环境变量处理器 (EnvironmentProcessor)
处理环境变量替换和配置覆盖。

## 配置文件结构

```
~/.route-claudecode/
├── config/
│   ├── providers.json                 # Provider配置
│   ├── routing.json                   # 路由配置
│   ├── debug.json                      # Debug配置
│   ├── security.json                  # 安全配置
│   └── generated/                      # 动态生成的配置
│       ├── routing-table.json          # 生成的路由表
│       └── provider-status.json        # Provider状态
├── debug/                              # Debug记录目录
└── logs/                               # 日志目录
```

## 配置类型

### Provider配置
```json
{
  "providers": [
    {
      "name": "openai",
      "protocol": "openai",
      "baseUrl": "https://api.openai.com/v1",
      "apiKey": "${OPENAI_API_KEY}",
      "models": ["gpt-4", "gpt-3.5-turbo"],
      "maxTokens": 4096,
      "availability": true
    }
  ]
}
```

### 路由配置
```json
{
  "routes": [
    {
      "category": "default",
      "rules": [
        {
          "provider": "openai",
          "model": "gpt-4",
          "weight": 0.7
        },
        {
          "provider": "anthropic", 
          "model": "claude-3",
          "weight": 0.3
        }
      ]
    }
  ]
}
```

### Debug配置
```json
{
  "debug": {
    "enabled": true,
    "level": "info",
    "saveRequests": true,
    "captureLevel": "full"
  }
}
```

## 接口定义

```typescript
interface ConfigModuleInterface {
  initialize(): Promise<void>;
  loadConfig(): Promise<RCCConfig>;
  validateConfig(config: RCCConfig): boolean;
  watchConfig(): void;
  getConfig(): RCCConfig;
  updateConfig(config: RCCConfig): Promise<void>;
  reloadConfig(): Promise<void>;
}

interface ConfigManagerInterface {
  loadProviderConfig(): Promise<ProviderConfig[]>;
  loadRoutingConfig(): Promise<RoutingConfig>;
  loadDebugConfig(): Promise<DebugConfig>;
  validateProviderConfig(config: ProviderConfig[]): boolean;
  validateRoutingConfig(config: RoutingConfig): boolean;
  generateRoutingTable(): Promise<GeneratedRoutingTable>;
}
```

## 依赖关系

- 被所有其他模块依赖以获取配置信息
- 依赖文件系统进行配置文件读写
- 依赖环境变量进行配置覆盖

## 设计原则

1. **安全性**: 敏感信息加密存储，防止配置信息泄露
2. **灵活性**: 支持多种配置来源和格式
3. **可靠性**: 完善的配置验证机制，防止错误配置导致系统故障
4. **动态性**: 支持配置的动态更新和重载
5. **可维护性**: 清晰的配置结构和文档
6. **标准化**: 使用JSON Schema验证配置格式