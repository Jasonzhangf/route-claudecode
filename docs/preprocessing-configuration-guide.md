# 🚀 预处理模块配置指南 (Preprocessing Module Configuration Guide)

**项目**: Claude Code Router v2.8.0  
**功能**: Max Token预处理策略配置  
**所有者**: Jason Zhang  
**日期**: 2025-08-08

## 📋 新功能概述

Max Token预处理模块提供了三种策略来处理超过token限制的请求：

1. **🔄 路由重定向策略** - 自动重定向到长上下文模型
2. **✂️ 动态截断策略** - 智能截断历史记录
3. **📦 长上下文压缩策略** - 使用AI模型压缩对话历史

## 🔧 配置文件结构

### 基本配置结构

```json
{
  "preprocessing": {
    "maxTokenPreprocessor": {
      "enabled": true,
      "strategies": {
        "routeRedirection": { ... },
        "dynamicTruncation": { ... },
        "longContextCompression": { ... }
      }
    }
  }
}
```

### 完整配置示例

```json
{
  "name": "Enhanced Pipeline Configuration with Preprocessing",
  "description": "支持Max Token预处理策略的增强配置",
  "server": {
    "port": 3457,
    "host": "0.0.0.0"
  },
  "providers": {
    "shuaihong-openai": {
      "type": "openai",
      "clientType": "sdk",
      "endpoint": "https://ai.shuaihong.fun/v1/chat/completions",
      "authentication": {
        "type": "bearer",
        "credentials": {
          "apiKey": ["sk-your-api-key-here"]
        }
      },
      "models": ["gemini-2.5-pro", "gemini-2.5-flash", "DeepSeek-V3"],
      "defaultModel": "gemini-2.5-flash",
      "maxTokens": {
        "gemini-2.5-pro": 8192,
        "gemini-2.5-flash": 4096,
        "DeepSeek-V3": 8192
      },
      "timeout": 60000
    }
  },
  "routing": {
    "default": {
      "providers": [{
        "provider": "shuaihong-openai",
        "model": "gemini-2.5-flash",
        "weight": 100
      }]
    },
    "longcontext": {
      "providers": [{
        "provider": "shuaihong-openai",
        "model": "gemini-2.5-pro",
        "weight": 80
      }, {
        "provider": "shuaihong-openai",
        "model": "DeepSeek-V3",
        "weight": 20
      }]
    }
  },
  "preprocessing": {
    "maxTokenPreprocessor": {
      "enabled": true,
      "strategies": {
        "routeRedirection": {
          "name": "route_redirection",
          "enabled": true,
          "priority": 1,
          "longContextCategory": "longcontext",
          "tokenThreshold": 3000
        },
        "dynamicTruncation": {
          "name": "dynamic_truncation", 
          "enabled": true,
          "priority": 2,
          "truncatePosition": "head",
          "tokenRatio": 0.95,
          "preserveSystemPrompt": true,
          "preserveLatestMessages": 2,
          "enableSimplifiedTools": true
        },
        "longContextCompression": {
          "name": "long_context_compression",
          "enabled": false,
          "priority": 3,
          "compressionRatio": 0.7,
          "compressionModel": "gemini-2.5-pro"
        }
      }
    }
  }
}
```

## 📖 详细策略配置说明

### 1. 路由重定向策略 (Route Redirection Strategy)

将超过token阈值的请求自动重定向到长上下文模型类别。

```json
"routeRedirection": {
  "name": "route_redirection",          // 策略名称 (固定值)
  "enabled": true,                      // 是否启用
  "priority": 1,                        // 优先级 (数字越小优先级越高)
  "longContextCategory": "longcontext", // 重定向目标类别
  "tokenThreshold": 3000                // 触发重定向的token阈值
}
```

**参数说明:**
- `enabled`: 是否启用此策略
- `priority`: 策略执行优先级，推荐设为1（最高优先级）
- `longContextCategory`: 重定向的路由类别，必须在routing配置中存在
- `tokenThreshold`: 当请求token数超过此值时触发重定向

### 2. 动态截断策略 (Dynamic Truncation Strategy)

智能截断历史消息，保留重要内容。

```json
"dynamicTruncation": {
  "name": "dynamic_truncation",    // 策略名称 (固定值)
  "enabled": true,                 // 是否启用
  "priority": 2,                   // 优先级
  "truncatePosition": "head",      // 截断位置: "head" | "tail" | "middle" 
  "tokenRatio": 0.95,             // 截断比例 (0.0-1.0)
  "preserveSystemPrompt": true,    // 是否保留系统提示
  "preserveLatestMessages": 2,     // 保留最新N条消息
  "enableSimplifiedTools": true    // 是否使用简化工具定义
}
```

**参数说明:**
- `truncatePosition`: 截断位置
  - `"head"`: 从头部开始删除旧消息（推荐）
  - `"tail"`: 从尾部开始删除（保留最新消息）
  - `"middle"`: 从中间开始删除
- `tokenRatio`: 目标token比例，0.95表示截断到原来的95%
- `preserveSystemPrompt`: 是否始终保留系统消息
- `preserveLatestMessages`: 保留最新的N条用户/助手消息
- `enableSimplifiedTools`: 使用简化版工具定义以节省tokens

### 3. 长上下文压缩策略 (Long Context Compression Strategy)

使用AI模型压缩历史对话内容。

```json
"longContextCompression": {
  "name": "long_context_compression", // 策略名称 (固定值)
  "enabled": false,                   // 是否启用 (默认关闭)
  "priority": 3,                      // 优先级 (最低)
  "compressionRatio": 0.7,            // 压缩比例 (0.0-1.0)
  "compressionModel": "gemini-2.5-pro" // 用于压缩的模型
}
```

**参数说明:**
- `enabled`: 默认关闭，因为需要额外的API调用
- `compressionRatio`: 压缩目标比例，0.7表示压缩到70%长度
- `compressionModel`: 用于执行压缩的模型名称

## 🎯 策略执行顺序

策略按`priority`数值从小到大执行：

1. **Priority 1**: Route Redirection (优先重定向到长上下文模型)
2. **Priority 2**: Dynamic Truncation (如果重定向不够，进行截断)
3. **Priority 3**: Long Context Compression (最后选择，需要额外API调用)

## 📋 配置最佳实践

### 推荐配置 1: 基础配置

适用于大多数场景，平衡性能和功能：

```json
"preprocessing": {
  "maxTokenPreprocessor": {
    "enabled": true,
    "strategies": {
      "routeRedirection": {
        "enabled": true,
        "priority": 1,
        "tokenThreshold": 3000,
        "longContextCategory": "longcontext"
      },
      "dynamicTruncation": {
        "enabled": true,
        "priority": 2,
        "truncatePosition": "head",
        "tokenRatio": 0.95,
        "preserveLatestMessages": 2
      },
      "longContextCompression": {
        "enabled": false
      }
    }
  }
}
```

### 推荐配置 2: 高级配置

适用于复杂对话场景：

```json
"preprocessing": {
  "maxTokenPreprocessor": {
    "enabled": true,
    "strategies": {
      "routeRedirection": {
        "enabled": true,
        "priority": 1,
        "tokenThreshold": 2500,
        "longContextCategory": "longcontext"
      },
      "dynamicTruncation": {
        "enabled": true,
        "priority": 2,
        "truncatePosition": "head", 
        "tokenRatio": 0.90,
        "preserveLatestMessages": 4,
        "enableSimplifiedTools": true
      },
      "longContextCompression": {
        "enabled": true,
        "priority": 3,
        "compressionRatio": 0.6
      }
    }
  }
}
```

### 推荐配置 3: 性能优先

最小化处理延迟：

```json
"preprocessing": {
  "maxTokenPreprocessor": {
    "enabled": true,
    "strategies": {
      "routeRedirection": {
        "enabled": true,
        "priority": 1,
        "tokenThreshold": 4000,
        "longContextCategory": "longcontext"
      },
      "dynamicTruncation": {
        "enabled": false
      },
      "longContextCompression": {
        "enabled": false
      }
    }
  }
}
```

## 🔧 集成到现有配置

### 步骤 1: 确保有长上下文路由

在`routing`部分确保有`longcontext`类别：

```json
"routing": {
  "longcontext": {
    "providers": [{
      "provider": "your-provider",
      "model": "long-context-model",
      "weight": 100
    }]
  }
}
```

### 步骤 2: 添加预处理配置

在配置文件根级别添加`preprocessing`部分。

### 步骤 3: 调整provider的maxTokens

确保provider配置中的`maxTokens`设置合理：

```json
"providers": {
  "your-provider": {
    "maxTokens": {
      "short-context-model": 4096,
      "long-context-model": 32768
    }
  }
}
```

## ⚠️ 注意事项

### 性能影响

- **路由重定向**: 几乎无性能影响
- **动态截断**: 轻微性能影响（消息处理）
- **长上下文压缩**: 显著性能影响（需要额外API调用）

### 配置验证

系统会在启动时验证配置：

1. `longContextCategory`必须在routing中存在
2. `tokenRatio`必须在0-1之间  
3. `preserveLatestMessages`必须为正整数
4. `compressionModel`必须在provider的models列表中

### 错误处理

如果预处理失败，系统会：

1. 记录警告日志
2. 使用原始请求继续处理
3. 不会导致请求失败

## 🚀 启动配置示例

使用带预处理功能的配置启动服务：

```bash
# ✅ 正确格式
rcc start --config ~/.route-claude-code/config/enhanced-preprocessing-config.json --debug

# ✅ 使用测试配置
rcc start --config ./test-pipeline-config.json --debug
```

## 📊 监控和日志

预处理模块会生成详细日志：

```
[INFO] Request redirected due to token limit: originalCategory=default, redirectedCategory=longcontext, originalTokens=3500, processedTokens=3500
[INFO] Max token preprocessing applied: appliedStrategies=[route_redirection], reduction=0
[INFO] Max token preprocessing applied: appliedStrategies=[dynamic_truncation], reduction=1200
```

## 🧪 测试配置

使用单元测试验证配置：

```bash
# 运行预处理模块单元测试
node test/preprocessing/test-max-token-preprocessor.js

# 运行集成测试
node test-preprocessing-and-timeout-fix.js
```

---

**📝 配置文件示例位置**: 
- 基础配置: `test-pipeline-config.json`
- 完整配置: `docs/examples/enhanced-preprocessing-config.json`

**🔗 相关文档**:
- 项目架构: `CLAUDE.md`  
- 测试文档: `pipeline-test-analysis-report.md`