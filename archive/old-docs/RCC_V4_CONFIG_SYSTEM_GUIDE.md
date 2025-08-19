# RCC v4.0 配置系统指南

## 🎉 配置系统重构完成

### ✅ 主要改进
- **移除hardcode默认配置**: 不再依赖特定路径的配置文件
- **逻辑化配置查找**: 按照标准软件配置惯例查找config.json
- **清晰的配置加载信息**: 用户可以清楚看到加载了哪个配置文件
- **详细的错误提示**: 告诉用户如何配置和解决问题

## 📂 配置文件查找逻辑

### 查找优先级 (按顺序)
1. **项目根目录**: `./config.json` (最高优先级)
2. **项目配置目录**: `./config/config.json`  
3. **用户全局配置**: `~/.route-claudecode/config.json`
4. **用户配置目录**: `~/.route-claudecode/config/config.json`

### 启动时的配置搜索过程
```bash
$ rcc4 start --port 5506

🚀 Starting RCC v4.0 Server...
📋 Startup Options: {
  port: '5506',
  host: 'auto-detect', 
  config: 'auto-detect',
  debug: false
}
🔍 No config file specified, searching for default config.json...
📂 Searching in order:
   ✅ ./config.json (project root config)
   ❌ ./config/config.json (project config directory)
   ❌ ~/.route-claudecode/config.json (user global config)
   ❌ ~/.route-claudecode/config/config.json (user config directory)

📄 Found and using: ./config.json

✅ Successfully loaded config: ./config.json
📊 Configuration Summary:
   🔧 Providers: 1
   🌐 Server: localhost:5506
   📋 Version: 4.0.0
   🚀 Available Providers:
      - LM Studio Local Server (openai) - Priority: 1
```

## 🛠️ 配置文件创建

### 方法1: 自动化创建工具
```bash
# 使用配置创建工具
node create-config.js

# 选择配置类型:
# 1. LM Studio (本地)
# 2. 混合Provider (多服务商)  
# 3. 自定义
```

### 方法2: 手动创建config.json
```json
{
  "configVersion": "4.0.0",
  "architecture": "four-layer-v4.0",
  "server": {
    "port": 5506,
    "host": "localhost",
    "name": "rcc-server"
  },
  "standardProviders": {
    "lmstudio": {
      "id": "lmstudio",
      "name": "LM Studio Local Server",
      "protocol": "openai",
      "type": "local",
      "priority": 1,
      "weight": 100,
      "connection": {
        "endpoint": "http://localhost:1234/v1/chat/completions",
        "authentication": {
          "type": "none"
        }
      },
      "models": {
        "supported": [
          "llama-3.1-8b-instruct",
          "qwen2.5-coder-32b-instruct"
        ]
      }
    }
  },
  "routing": {
    "strategy": "single-provider",
    "configuration": {
      "zeroFallbackPolicy": true,
      "strictErrorReporting": true
    }
  }
}
```

## 🚀 使用示例

### 基础使用 (自动配置)
```bash
# 自动查找并使用config.json
rcc4 start

# 或指定端口
rcc4 start --port 5506
```

### 指定配置文件
```bash
# 使用特定配置文件
rcc4 start --config /path/to/your/config.json --port 5506

# 使用已有的v4配置
rcc4 start --config ~/.route-claudecode/config/v4/hybrid-provider/comprehensive-hybrid-v4-5510.json
```

### 连接Claude Code
```bash
# 一键连接 (自动设置环境变量)
rcc4 code --port 5506
```

### 测试Provider连接
```bash
# 测试配置文件中的Provider
rcc4 test --config ./config.json
```

## ❌ 错误处理和故障排除

### 没有找到配置文件
```bash
❌ No configuration file found!

🛠️  Quick Setup Options:

1️⃣  Create a config file automatically:
   node create-config.js

2️⃣  Use existing config file:
   rcc4 start --config /path/to/your/config.json --port 5506

3️⃣  Expected default locations (in priority order):
   ./config.json                                    (highest priority)
   ./config/config.json                             (project config)
   ~/.route-claudecode/config.json                  (user global)
   ~/.route-claudecode/config/config.json           (user config dir)
```

### 配置文件格式错误
```bash
❌ Config file error: Unexpected token } in JSON at position 123
```

### Provider连接失败
```bash
❌ Provider routing failed: No API keys configured for OpenAI provider
```

## 📋 配置验证清单

### 基础配置检查
- [ ] config.json文件存在且格式正确
- [ ] server.port和server.host配置正确
- [ ] 至少配置了一个Provider

### Provider配置检查
- [ ] Provider的protocol类型正确 (openai/gemini)
- [ ] connection.endpoint URL可访问
- [ ] API密钥已配置 (如果需要)
- [ ] models.supported列表不为空

### 路由配置检查
- [ ] routing.strategy已设置
- [ ] modelMapping包含Claude模型映射
- [ ] routes配置了目标Provider

## 🔧 高级配置选项

### 多Provider混合配置
```json
{
  "standardProviders": {
    "lmstudio": { "priority": 1, "weight": 50 },
    "gemini": { "priority": 2, "weight": 30 },
    "openai": { "priority": 3, "weight": 20 }
  },
  "routing": {
    "strategy": "intelligent-hybrid",
    "routingRules": {
      "loadBalancing": {
        "enabled": true,
        "strategy": "weighted-round-robin"
      }
    }
  }
}
```

### Debug和监控配置
```json
{
  "debug": {
    "enabled": true,
    "logLevel": "info",
    "logDir": "~/.route-claudecode/logs",
    "enableRequestTracing": true
  },
  "monitoring": {
    "healthChecks": {
      "enabled": true,
      "interval": 30000
    }
  }
}
```

## 🎯 最佳实践

### 项目配置建议
1. **项目专用配置**: 在项目根目录创建`config.json`
2. **版本控制**: 将config.json加入git (移除敏感信息)
3. **环境变量**: 敏感的API密钥使用环境变量
4. **文档化**: 在README中说明如何配置

### 用户全局配置建议
1. **个人配置**: 在`~/.route-claudecode/config.json`设置个人偏好
2. **备份配置**: 定期备份配置文件
3. **模板化**: 创建不同场景的配置模板

## 🎉 总结

RCC v4.0现在具有了完善的配置系统:

✅ **逻辑化配置查找**: 遵循标准软件配置惯例  
✅ **清晰的加载过程**: 用户可以清楚看到配置加载详情  
✅ **详细的错误提示**: 告诉用户如何解决配置问题  
✅ **多种配置方式**: 支持自动创建、手动编写、指定路径  
✅ **灵活的Provider支持**: 单Provider、多Provider混合配置  

下一步可以开始进行多轮工具调用测试！