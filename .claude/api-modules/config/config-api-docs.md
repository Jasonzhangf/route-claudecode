# Configuration API模块文档

## 🎯 模块概述

Configuration API模块负责系统配置的管理、验证和虚拟目标生成，按照正确的协议分层架构实现。

**模块名称**: `configuration`  
**基础路径**: `/api/v1/config`  
**API版本**: `v1.0.0`  

## 🔗 API端点

### **核心端点**

#### **GET /api/v1/config/current**
获取当前系统配置

**请求参数**: 无

**响应格式**:
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "config": { /* 完整配置对象 */ },
    "metadata": {
      "generatedAt": 1693478400000,
      "loadedAt": 1693478200000,
      "configPath": "/path/to/config.json",
      "virtualTargetsCount": 14
    }
  },
  "metadata": {
    "requestId": "req_1693478400_abc123",
    "timestamp": 1693478400000,
    "processingTime": 5.23,
    "apiVersion": "v1.0.0"
  }
}
```

#### **POST /api/v1/config/load**
从文件加载配置

**请求体**:
```json
{
  "configPath": "/path/to/config.json",
  "validateConfig": true
}
```

**响应格式**:
```json
{
  "success": true,
  "data": {
    "loadedConfig": { /* 配置对象 */ },
    "validationResults": {
      "isValid": true,
      "errors": [],
      "warnings": []
    },
    "data": {
      "providersCount": 4,
      "routerRulesCount": 12,
      "loadedAt": 1693478400000,
      "configPath": "/path/to/config.json"
    }
  }
}
```

#### **POST /api/v1/config/update**
更新系统配置

**请求体**:
```json
{
  "configPath": "/path/to/config.json",
  "config": { /* 新配置对象 */ },
  "validate": true
}
```

#### **POST /api/v1/config/validate**
验证配置文件格式和内容

**请求体**:
```json
{
  "config": { /* 待验证的配置对象 */ }
}
```

**响应格式**:
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "errors": [],
    "warnings": ["Missing version field"]
  }
}
```

### **核心功能端点**

#### **POST /api/v1/config/virtual-targets/generate**
生成虚拟目标映射 - 替代直接调用`generateVirtualTargetsFromRouterConfig`

**请求体**:
```json
{
  "routingRules": {
    "virtualTargets": {
      "writing-assistant": ["qwen3-coder-plus", "llama-3.1-8b"],
      "code-analysis": ["qwen3-math-plus"]
    }
  },
  "standardProviders": {
    "qwen": {
      "name": "qwen",
      "enabled": true,
      "endpoint": "https://dashscope.aliyuncs.com",
      "models": ["qwen3-coder-plus", "qwen3-math-plus"],
      "connection": {
        "timeout": 30000,
        "maxTokens": 2097152
      }
    }
  }
}
```

**响应格式**:
```json
{
  "success": true,
  "data": {
    "virtualTargets": {
      "writing-assistant": [
        {
          "providerName": "qwen",
          "modelName": "qwen3-coder-plus",
          "providerId": "qwen_1",
          "connectionInfo": {
            "endpoint": "https://dashscope.aliyuncs.com",
            "protocol": "openai",
            "timeout": 30000,
            "maxRetries": 3,
            "maxTokens": 2097152
          }
        }
      ]
    },
    "statistics": {
      "generatedCount": 2,
      "categoriesCount": 2,
      "byCategory": {
        "writing-assistant": 1,
        "code-analysis": 1
      },
      "generatedAt": 1693478400000
    }
  }
}
```

### **查询端点**

#### **GET /api/v1/config/providers**
获取Provider配置列表

**查询参数**:
- `enabled` (boolean): 只返回启用的Provider
- `detailed` (boolean): 返回详细配置信息

**响应格式**:
```json
{
  "success": true,
  "data": {
    "providers": [
      {
        "id": "qwen",
        "name": "qwen",
        "status": "active",
        "modelsCount": 3,
        "endpoint": "https://dashscope.aliyuncs.com",
        "healthScore": 0.9
      }
    ],
    "totalCount": 4,
    "enabledCount": 3
  }
}
```

#### **GET /api/v1/config/stats**
获取配置统计信息

**响应格式**:
```json
{
  "success": true,
  "data": {
    "configurationInfo": {
      "version": "1.0.0",
      "loadedAt": 1693478400000,
      "configPath": "/path/to/config.json",
      "lastUpdated": 1693478500000
    },
    "providersStatistics": {
      "totalProviders": 4,
      "enabledProviders": 3,
      "disabledProviders": 1,
      "providersByType": {
        "local": 1,
        "qwen": 1,
        "modelscope": 1,
        "lmstudio": 1
      }
    },
    "routingStatistics": {
      "routerRulesCount": 12,
      "virtualTargetsCount": 14,
      "hasSecurityRouting": false
    },
    "validationInfo": {
      "hasValidationErrors": false,
      "validationErrorsCount": 0,
      "validationErrors": []
    },
    "serverConfiguration": {
      "port": 5506,
      "host": "0.0.0.0",
      "debug": false
    }
  }
}
```

## 🔐 协议验证机制

### **配置格式兼容性**

Configuration API支持多种配置格式：

#### **v1配置格式 (Providers数组)**
```json
{
  "version": "1.0.0",
  "Providers": [
    {
      "name": "qwen",
      "enabled": true,
      "baseURL": "https://dashscope.aliyuncs.com",
      "models": ["qwen3-coder-plus"],
      "timeout": 30000
    }
  ]
}
```

#### **v2配置格式 (standardProviders对象)**
```json
{
  "version": "2.0.0",
  "standardProviders": {
    "qwen": {
      "name": "qwen",
      "enabled": true,
      "endpoint": "https://dashscope.aliyuncs.com",
      "models": ["qwen3-coder-plus"],
      "connection": {
        "timeout": 30000,
        "maxTokens": 2097152
      }
    }
  }
}
```

### **验证规则**

1. **基础验证**:
   - 配置必须是有效的JSON对象
   - 必须包含Provider配置信息
   - 服务器端口配置可选（警告级别）

2. **Provider验证**:
   - 每个Provider必须有名称
   - 启用的Provider必须有有效端点
   - 模型列表不能为空

3. **路由验证**:
   - Router规则格式检查
   - 虚拟目标映射有效性

## 🎯 关键特性

1. **纯API服务**: 无外部依赖管理器，仅提供数据服务
2. **多格式兼容**: 支持v1和v2配置格式
3. **实时验证**: 配置加载时自动验证
4. **统计分析**: 提供详细的配置统计信息
5. **虚拟目标生成**: 核心功能，替代直接方法调用
6. **健康评分**: Provider健康状态评估
7. **类型分组**: 自动识别Provider类型

## ⚠️ 错误处理

### **常见错误代码**

- `CONFIG_NOT_LOADED`: 配置未加载
- `CONFIG_NOT_FOUND`: 配置文件不存在
- `CONFIG_INVALID`: 配置数据无效
- `CONFIG_PARSE_ERROR`: 配置解析失败
- `CONFIG_GENERATION_FAILED`: 虚拟目标生成失败

### **错误响应格式**
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CONFIG_NOT_FOUND",
    "message": "Configuration file not found: /path/to/config.json",
    "details": {
      "configPath": "/path/to/config.json"
    }
  },
  "metadata": {
    "requestId": "req_1693478400_abc123",
    "timestamp": 1693478400000,
    "processingTime": 2.15,
    "apiVersion": "v1.0.0"
  }
}
```

## 🚀 使用示例

### **SystemIntegrator API调用改造**

**原直接调用**:
```typescript
// ❌ 旧方式：直接方法调用
const virtualTargets = generateVirtualTargetsFromRouterConfig(config);
```

**新API调用**:
```typescript
// ✅ 新方式：API调用
const response = await internalAPIClient.post('/api/v1/config/virtual-targets/generate', {
  routingRules: config.routing?.routingRules,
  standardProviders: config.standardProviders
});

const virtualTargets = response.data.virtualTargets;
```

### **完整配置加载流程**
```typescript
// 1. 加载配置
const loadResponse = await internalAPIClient.post('/api/v1/config/load', {
  configPath: '~/.route-claudecode/config.json',
  validateConfig: true
});

// 2. 生成虚拟目标
const generateResponse = await internalAPIClient.post('/api/v1/config/virtual-targets/generate', {
  routingRules: loadResponse.data.loadedConfig.routing?.routingRules,
  standardProviders: loadResponse.data.loadedConfig.standardProviders
});

// 3. 获取配置统计
const statsResponse = await internalAPIClient.get('/api/v1/config/stats');
```

This Configuration API模块实现了完整的配置管理功能，支持多种配置格式，提供虚拟目标生成的API化调用，并确保了配置验证和统计分析的完整性。