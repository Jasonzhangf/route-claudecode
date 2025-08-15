# 配置系统模块

## 模块概述

配置系统负责管理所有的供应商和路由规则配置，支持动态重载、环境变量替换和配置验证。

## 目录结构

```
src/config/
├── README.md                    # 配置系统文档
├── index.ts                     # 配置系统入口
├── config-manager.ts            # 配置管理器
├── config-validator.ts          # 配置验证器
├── config-watcher.ts            # 配置文件监听器
└── types/
    ├── config-types.ts          # 配置相关类型
    ├── provider-types.ts        # Provider配置类型
    └── routing-types.ts         # 路由配置类型
```

## 配置文件结构

### 运行时配置目录
```
~/.route-claudecode/
├── config/
│   ├── providers.json           # Provider配置
│   ├── routing.json            # 路由表配置
│   ├── global.json             # 全局配置
│   └── generated/              # 动态生成的配置
│       ├── routing-table.json  # 生成的路由表
│       └── provider-status.json # Provider状态
├── debug/                      # Debug记录
└── logs/                       # 日志文件
```

## 核心功能

### 1. 配置管理
- **配置加载**: 读取和解析JSON配置文件
- **环境变量替换**: 自动替换${VAR_NAME}占位符
- **配置验证**: 检查配置格式和必需字段
- **动态重载**: 文件变化时自动重新加载

### 2. 配置监听
- **文件监听**: 监控配置文件变化
- **热重载**: 不中断服务的配置更新
- **变更通知**: 通知相关模块配置已更新

### 3. 配置生成
- **路由表生成**: 根据配置生成优化的路由表
- **状态文件**: 维护Provider和路由的状态信息

## 接口定义

```typescript
export interface ConfigManager {
  loadProviderConfig(): Promise<ProviderConfig[]>;
  loadRoutingConfig(): Promise<RoutingConfig>;
  loadGlobalConfig(): Promise<GlobalConfig>;
  generateRoutingTable(): Promise<GeneratedRoutingTable>;
  watchConfigChanges(): void;
  validateConfig(config: any, schema: ConfigSchema): boolean;
}

export interface ConfigValidator {
  validateProviderConfig(config: ProviderConfig[]): ValidationResult;
  validateRoutingConfig(config: RoutingConfig): ValidationResult;
  validateGlobalConfig(config: GlobalConfig): ValidationResult;
}

export interface ConfigWatcher {
  watchFile(filePath: string, callback: (event: string, filename: string) => void): void;
  stopWatching(): void;
}
```

## 配置格式

### Provider配置 (providers.json)
```json
{
  "providers": [
    {
      "name": "openai",
      "protocol": "openai",
      "baseUrl": "https://api.openai.com/v1",
      "serverType": "openai",
      "models": ["gpt-4", "gpt-3.5-turbo"],
      "availability": true,
      
      // 单密钥配置（向后兼容）
      "apiKey": "${OPENAI_API_KEY}",
      
      // 或多密钥配置（负载均衡）
      "apiKeys": [
        {
          "keyId": "openai-key-1",
          "key": "${OPENAI_API_KEY_1}",
          "weight": 0.6,
          "rateLimits": {
            "requestsPerMinute": 3500,
            "tokensPerDay": 1000000
          }
        },
        {
          "keyId": "openai-key-2",
          "key": "${OPENAI_API_KEY_2}",
          "weight": 0.4,
          "rateLimits": {
            "requestsPerMinute": 2000,
            "tokensPerDay": 500000
          }
        }
      ],
      
      // 负载均衡配置
      "loadBalance": {
        "keySelectionStrategy": "quota_aware",
        "rotationPolicy": {
          "rotateOnError": true,
          "rotateOnRateLimit": true,
          "cooldownPeriod": 60
        }
      }
    },
    
    {
      "name": "gemini",
      "protocol": "gemini",
      "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
      "serverType": "gemini",
      "models": ["gemini-2.5-flash", "gemini-2.5-pro"],
      "authType": "oauth2",
      "projectId": "${GOOGLE_PROJECT_ID}",
      "apiKey": "${GEMINI_API_KEY}",
      "availability": true
    }
  ]
}
```

### 路由配置 (routing.json)
```json
{
  "routes": [
    {
      "category": "default",
      "rules": [
        {
          "provider": "openai",
          "model": "gpt-4",
          "weight": 0.6,
          "priority": 1
        },
        {
          "provider": "deepseek",
          "model": "deepseek-chat",
          "weight": 0.4,
          "priority": 2
        }
      ],
      "loadBalance": {
        "strategy": "health_aware",
        "failoverEnabled": true,
        "healthCheckInterval": 30
      }
    },
    
    {
      "category": "think",
      "rules": [
        {
          "provider": "openai",
          "model": "gpt-4",
          "weight": 0.8
        },
        {
          "provider": "deepseek",
          "model": "deepseek-reasoner",
          "weight": 0.2
        }
      ]
    },
    
    {
      "category": "code",
      "rules": [
        {
          "provider": "codewhisperer",
          "model": "default",
          "weight": 0.7
        },
        {
          "provider": "openai",
          "model": "gpt-4",
          "weight": 0.3
        }
      ]
    }
  ]
}
```

### 全局配置 (global.json)
```json
{
  "server": {
    "defaultPort": 3456,
    "host": "127.0.0.1",
    "timeout": 60000,
    "maxConcurrentRequests": 100
  },
  
  "debug": {
    "enabled": true,
    "maxRecordSize": 10485760,
    "retentionDays": 7,
    "compressionEnabled": true
  },
  
  "logging": {
    "level": "info",
    "maxFileSize": "10m",
    "maxFiles": 5,
    "enableConsole": true
  },
  
  "loadBalance": {
    "healthCheckEnabled": true,
    "healthCheckInterval": 30,
    "failureThreshold": 3,
    "recoveryThreshold": 2,
    "circuitBreakerEnabled": true,
    "circuitBreakerTimeout": 60
  }
}
```

## 配置验证

### Provider配置验证
```typescript
const providerConfigSchema = {
  type: 'object',
  properties: {
    providers: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'protocol', 'baseUrl', 'models'],
        properties: {
          name: { type: 'string', minLength: 1 },
          protocol: { 
            type: 'string', 
            enum: ['openai', 'anthropic', 'gemini'] 
          },
          baseUrl: { type: 'string', format: 'uri' },
          models: { 
            type: 'array', 
            items: { type: 'string' },
            minItems: 1 
          },
          availability: { type: 'boolean' }
        }
      }
    }
  },
  required: ['providers']
};
```

### 路由配置验证
```typescript
const routingConfigSchema = {
  type: 'object',
  properties: {
    routes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['category', 'rules'],
        properties: {
          category: { 
            type: 'string',
            enum: ['default', 'think', 'longContext', 'background', 'code', 'webSearch']
          },
          rules: {
            type: 'array',
            items: {
              type: 'object',
              required: ['provider', 'model', 'weight'],
              properties: {
                provider: { type: 'string' },
                model: { type: 'string' },
                weight: { type: 'number', minimum: 0, maximum: 1 }
              }
            }
          }
        }
      }
    }
  },
  required: ['routes']
};
```

## 配置管理器实现

```typescript
export class ConfigManagerImpl implements ConfigManager {
  private configPath: string;
  private watcher: ConfigWatcher;
  private validator: ConfigValidator;
  private cache: Map<string, any> = new Map();

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(os.homedir(), '.route-claudecode', 'config');
    this.watcher = new ConfigWatcherImpl();
    this.validator = new ConfigValidatorImpl();
  }

  async loadProviderConfig(): Promise<ProviderConfig[]> {
    const configFile = path.join(this.configPath, 'providers.json');
    
    try {
      const content = await fs.readFile(configFile, 'utf-8');
      const config = JSON.parse(this.replaceEnvVariables(content));
      
      // 验证配置
      const validation = this.validator.validateProviderConfig(config.providers);
      if (!validation.isValid) {
        throw new ConfigError('Provider config validation failed', validation.errors);
      }
      
      // 缓存配置
      this.cache.set('providers', config.providers);
      
      return config.providers;
    } catch (error) {
      throw new ConfigError('Failed to load provider config', error);
    }
  }

  async loadRoutingConfig(): Promise<RoutingConfig> {
    const configFile = path.join(this.configPath, 'routing.json');
    
    try {
      const content = await fs.readFile(configFile, 'utf-8');
      const config = JSON.parse(this.replaceEnvVariables(content));
      
      // 验证配置
      const validation = this.validator.validateRoutingConfig(config);
      if (!validation.isValid) {
        throw new ConfigError('Routing config validation failed', validation.errors);
      }
      
      // 缓存配置
      this.cache.set('routing', config);
      
      return config;
    } catch (error) {
      throw new ConfigError('Failed to load routing config', error);
    }
  }

  async generateRoutingTable(): Promise<GeneratedRoutingTable> {
    const providers = await this.loadProviderConfig();
    const routing = await this.loadRoutingConfig();
    
    const routingTable: GeneratedRoutingTable = {
      timestamp: Date.now(),
      routes: []
    };
    
    for (const route of routing.routes) {
      const routeEntry = {
        category: route.category,
        pipelines: []
      };
      
      for (const rule of route.rules) {
        const provider = providers.find(p => p.name === rule.provider);
        if (provider && provider.availability) {
          routeEntry.pipelines.push({
            id: `${rule.provider}_${rule.model}`,
            provider: rule.provider,
            model: rule.model,
            weight: rule.weight,
            isActive: true
          });
        }
      }
      
      routingTable.routes.push(routeEntry);
    }
    
    // 保存生成的路由表
    const generatedPath = path.join(this.configPath, 'generated', 'routing-table.json');
    await fs.writeFile(generatedPath, JSON.stringify(routingTable, null, 2));
    
    return routingTable;
  }

  watchConfigChanges(): void {
    const configFiles = ['providers.json', 'routing.json', 'global.json'];
    
    configFiles.forEach(filename => {
      const filePath = path.join(this.configPath, filename);
      this.watcher.watchFile(filePath, (event, filename) => {
        if (event === 'change') {
          this.handleConfigChange(filename);
        }
      });
    });
  }

  private replaceEnvVariables(content: string): string {
    return content.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      return process.env[varName] || match;
    });
  }

  private async handleConfigChange(filename: string): void {
    try {
      // 清除缓存
      this.cache.clear();
      
      // 重新加载配置
      if (filename === 'providers.json') {
        await this.loadProviderConfig();
      } else if (filename === 'routing.json') {
        await this.loadRoutingConfig();
      }
      
      // 重新生成路由表
      await this.generateRoutingTable();
      
      // 通知其他模块配置已更新
      this.notifyConfigChange(filename);
      
    } catch (error) {
      console.error(`Failed to reload config ${filename}:`, error);
    }
  }
}
```

## 环境变量管理

### 支持的环境变量
```bash
# OpenAI
OPENAI_API_KEY=sk-xxx
OPENAI_API_KEY_1=sk-xxx
OPENAI_API_KEY_2=sk-xxx

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxx

# Gemini
GEMINI_API_KEY=xxx
GOOGLE_PROJECT_ID=xxx

# DeepSeek
DEEPSEEK_API_KEY=sk-xxx

# AWS CodeWhisperer
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1
```

### 环境变量验证
```typescript
class EnvironmentValidator {
  validateRequiredEnvVars(config: ProviderConfig[]): ValidationResult {
    const missing: string[] = [];
    
    for (const provider of config) {
      if (provider.apiKey && provider.apiKey.startsWith('${')) {
        const varName = provider.apiKey.slice(2, -1);
        if (!process.env[varName]) {
          missing.push(varName);
        }
      }
    }
    
    return {
      isValid: missing.length === 0,
      errors: missing.map(var => `Missing environment variable: ${var}`)
    };
  }
}
```

## 错误处理

### 配置错误
```typescript
class ConfigError extends Error {
  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ConfigError';
    this.details = details;
  }
}
```

### 验证错误
```typescript
class ValidationError extends Error {
  constructor(field: string, message: string) {
    super(`Validation failed for ${field}: ${message}`);
    this.name = 'ValidationError';
  }
}
```

## 质量要求

- ✅ 无静默失败
- ✅ 无mockup配置
- ✅ 无重复配置代码
- ✅ 无硬编码配置值
- ✅ 完整的配置验证
- ✅ 环境变量支持
- ✅ 动态重载机制
- ✅ 标准错误处理