# RCC v4.0 统一CLI和配置格式模板 - 永久规则

**版本**: v4.0-final  
**状态**: 强制执行  
**变更政策**: 永不变更，向后兼容  

## 1. 统一CLI入口点规则

### 1.1 主CLI文件结构
```
src/
├── cli.ts                    # 主CLI入口（永久固定）
├── cli/
│   ├── unified-cli.ts        # 统一CLI实现
│   ├── config-loader.ts      # 统一配置加载器  
│   └── template-validator.ts # 配置模板验证器
```

### 1.2 CLI命令格式（永久不变）
```bash
# 标准命令格式
rcc4 <command> [options]

# 支持的命令（永久固定）
rcc4 start --config <path> --port <port> [--debug]
rcc4 stop --port <port> [--force]
rcc4 status --port <port> [--detailed]
rcc4 code --proxy-port <port>
```

### 1.3 CLI参数规则（永久固定）
| 参数 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `--config` | string | 是 | `./config.json` | 配置文件路径 |
| `--port` | number | 否 | `5506` | 服务器端口 |
| `--host` | string | 否 | `0.0.0.0` | 服务器主机 |
| `--debug` | boolean | 否 | `false` | 调试模式 |
| `--proxy-port` | number | 否 | `5506` | 代理端口 |

## 2. 统一配置格式模板

### 2.1 配置文件结构（永久固定）
```json
{
  "// RCC v4.0 统一配置模板 - 永不变更": "",
  "version": "4.0",
  "templateVersion": "1.0.0",
  
  "// 虚拟模型配置 - 用户友好格式": "",
  "virtualModels": {
    "default": {
      "providers": [
        {
          "name": "provider-type",
          "model": "specific-model-name", 
          "weight": 100,
          "apiKeys": ["key1", "key2"]
        }
      ]
    }
  },
  
  "// 错误处理配置": "",
  "blacklistSettings": {
    "timeout429": 60000,
    "timeoutError": 300000
  },
  
  "// 服务器配置": "",
  "server": {
    "port": 5506,
    "host": "0.0.0.0", 
    "debug": false
  }
}
```

### 2.2 虚拟模型类型（永久固定）
| 虚拟模型 | 用途 | 权重分配 |
|----------|------|----------|
| `default` | 默认模型（必需） | 用户定义 |
| `premium` | 高质量模型 | 可选 |
| `coding` | 编程专用 | 可选 |
| `reasoning` | 推理专用 | 可选 |
| `longContext` | 长上下文 | 可选 |
| `webSearch` | 网络搜索 | 可选 |
| `background` | 后台任务 | 可选 |

### 2.3 Provider类型规范（永久固定）
| Provider | 协议 | 端点格式 | 认证方式 |
|----------|------|----------|----------|
| `modelscope` | OpenAI | `https://api-inference.modelscope.cn/v1/chat/completions` | Bearer Token |
| `dashscope` | OpenAI | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | Bearer Token |
| `openrouter` | OpenAI | `https://openrouter.ai/api/v1/chat/completions` | Bearer Token |
| `anthropic` | Anthropic | `https://api.anthropic.com/v1/messages` | Bearer Token |
| `deepseek` | OpenAI | `https://api.deepseek.com/chat/completions` | Bearer Token |
| `gemini` | Gemini | `https://generativelanguage.googleapis.com/v1beta/models/` | API Key |
| `ollama` | OpenAI | `http://localhost:11434/v1/chat/completions` | 无需认证 |

## 3. 配置加载规则

### 3.1 配置文件查找顺序（永久固定）
1. `--config` 参数指定的路径
2. `./config.json` (当前目录)
3. `~/.rcc4/config.json` (用户目录)
4. `/etc/rcc4/config.json` (系统目录)

### 3.2 配置合并策略
```typescript
// 配置合并优先级（永久固定）
const mergedConfig = {
  ...defaultConfig,      // 系统默认配置（最低优先级）
  ...systemConfig,       // 系统配置文件
  ...userConfig,         // 用户配置文件  
  ...cliArgs            // CLI参数（最高优先级）
};
```

### 3.3 配置验证规则（永久固定）
```typescript
interface ConfigValidationRules {
  required: string[];              // 必需字段
  virtualModels: {
    requiredModels: ["default"];   // 必需的虚拟模型
    providerFields: ["name", "model", "apiKeys"]; // Provider必需字段
  };
  server: {
    portRange: [1024, 65535];     // 端口范围
    allowedHosts: ["0.0.0.0", "localhost", "127.0.0.1"];
  };
}
```

## 4. 系统配置模板（内置固定）

### 4.1 系统配置结构
```json
{
  "providerTypes": {
    "modelscope": {
      "endpoint": "https://api-inference.modelscope.cn/v1/chat/completions",
      "protocol": "openai",
      "transformer": "modelscope-enhancer",
      "timeout": 30000,
      "maxRetries": 2
    }
  },
  "transformers": {
    "modelscope-enhancer": {
      "maxTokens": 65536,
      "enhanceTools": true
    }
  },
  "pipelineLayers": {
    "client": { "module": "http-client", "validation": true },
    "router": { "module": "simple-router", "cacheEnabled": false },
    "transformer": { "module": "anthropic-to-openai-transformer" },
    "protocol": { "module": "openai-protocol", "streamSupport": true },
    "server-compatibility": { "module": "adaptive-compatibility" },
    "server": { "module": "openai-server", "multiKeySupport": true }
  },
  "connectionHandshake": {
    "enabled": true,
    "healthCheckInterval": 300000,
    "validateApiKeys": true,
    "timeoutMs": 10000
  }
}
```

## 5. CLI实现规范

### 5.1 统一CLI类结构
```typescript
export class UnifiedCLI {
  private pipelineManager: PipelineLifecycleManager;
  private configLoader: UnifiedConfigLoader;
  
  // 标准方法（永久固定）
  async start(options: StartOptions): Promise<void>
  async stop(options: StopOptions): Promise<void>
  async status(options: StatusOptions): Promise<ServerStatus>
  async code(options: CodeOptions): Promise<void>
}
```

### 5.2 配置加载器接口
```typescript
export interface UnifiedConfigLoader {
  // 加载和合并配置（永久固定）
  loadConfig(userConfigPath?: string, systemConfigPath?: string): Promise<MergedConfig>
  
  // 验证配置模板（永久固定）
  validateTemplate(config: any): ValidationResult
  
  // 创建默认配置（永久固定）
  createDefaultConfig(outputPath: string): Promise<string>
}
```

## 6. 向后兼容规则

### 6.1 旧配置格式支持
```typescript
// 自动检测和转换旧格式（永久支持）
if (config.providers && Array.isArray(config.providers)) {
  // 转换为新的virtualModels格式
  config.virtualModels = {
    default: {
      providers: config.providers
    }
  };
  delete config.providers;
}
```

### 6.2 配置迁移工具
```bash
# 配置迁移命令（永久提供）
rcc4 migrate --from <old-config> --to <new-config>
rcc4 validate --config <config-file>
rcc4 template --create <output-path>
```

## 7. 错误处理标准

### 7.1 配置错误分类
```typescript
enum ConfigErrorType {
  MISSING_FILE = "MISSING_FILE",
  INVALID_JSON = "INVALID_JSON", 
  MISSING_REQUIRED = "MISSING_REQUIRED",
  INVALID_FORMAT = "INVALID_FORMAT",
  PROVIDER_ERROR = "PROVIDER_ERROR"
}
```

### 7.2 错误消息模板
```typescript
const ERROR_MESSAGES = {
  MISSING_FILE: "Configuration file not found: {path}. Use 'rcc4 template --create {path}' to create a default config.",
  INVALID_JSON: "Invalid JSON in config file: {path}. Error: {error}",
  MISSING_REQUIRED: "Missing required field: {field} in config file",
  INVALID_FORMAT: "Invalid config format. Expected virtualModels structure.",
  PROVIDER_ERROR: "Invalid provider configuration: {provider}. Check name, model, and apiKeys fields."
};
```

## 8. 实施强制要求

### 8.1 破坏性变更禁止
- ✅ **允许**: 添加新的可选字段
- ✅ **允许**: 添加新的虚拟模型类型
- ✅ **允许**: 添加新的Provider类型
- ❌ **禁止**: 修改现有字段名称
- ❌ **禁止**: 删除现有字段
- ❌ **禁止**: 改变配置文件结构

### 8.2 版本兼容性保证
```json
{
  "// 版本兼容性规则": "",
  "minimumVersion": "4.0.0",
  "supportedVersions": ["4.0.x", "4.1.x", "4.2.x"],
  "deprecatedFeatures": [],
  "removedFeatures": []
}
```

### 8.3 模板更新流程
1. **新增功能**: 只能添加到`optionalFields`
2. **功能废弃**: 标记为`deprecated`但继续支持
3. **重大更新**: 需要新的主版本号 (5.0)
4. **向后兼容**: 永远支持4.0配置格式

## 9. 强制验证脚本

```bash
#!/bin/bash
# 配置模板合规检查（永久执行）

# 验证CLI命令格式
if ! rcc4 --help | grep -q "start\|stop\|status\|code"; then
  echo "❌ CLI命令格式不符合模板规范"
  exit 1
fi

# 验证配置文件格式
if ! jq '.virtualModels.default' config.json > /dev/null; then
  echo "❌ 配置文件缺少required default虚拟模型"
  exit 1
fi

echo "✅ CLI和配置格式符合永久模板规范"
```

## 10. 执行时间表

- **立即执行**: 统一当前CLI入口点
- **本周内**: 实现UnifiedConfigLoader
- **永久生效**: 模板规则不再变更
- **持续维护**: 只增加可选功能，不破坏现有格式