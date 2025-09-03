# API测试接口规范

## 概述

本文档定义了RCC v4.1测试框架中各模块需要实现的标准化API测试接口规范。所有模块都必须按照此规范提供测试端点，以确保测试系统的统一性和可扩展性。

## 通用规范

### 1. API版本
所有测试API都应使用`/api/v1/`作为基础路径。

### 2. 响应格式
所有API响应必须遵循统一的格式：

```json
{
  "success": true,
  "data": {},
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": {}
  },
  "metadata": {
    "timestamp": "2025-01-01T00:00:00Z",
    "duration": 123,
    "requestId": "unique-request-id"
  }
}
```

### 3. 错误处理
- HTTP状态码：200表示API调用成功，错误信息在响应体中
- 业务错误：通过`error`字段返回具体错误信息
- 系统错误：通过HTTP状态码表示（如500内部服务器错误）

### 4. 认证授权
- 测试API应支持测试专用的认证令牌
- 认证头：`Authorization: Bearer test-token`
- 不同环境使用不同的测试令牌

## 核心测试接口

### 1. 健康检查接口

#### 接口定义
```
GET /api/v1/{module}/health
```

#### 响应示例
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "dependencies": [
      {
        "name": "database",
        "status": "connected"
      }
    ],
    "metrics": {
      "uptime": 3600,
      "memoryUsage": 128
    }
  },
  "metadata": {
    "timestamp": "2025-01-01T00:00:00Z",
    "duration": 5,
    "requestId": "health-check-123"
  }
}
```

### 2. 功能测试接口

#### 接口定义
```
POST /api/v1/{module}/test/functional
```

#### 请求参数
```json
{
  "testCase": {
    "name": "test_case_name",
    "description": "Test case description",
    "input": {},
    "expected": {},
    "timeout": 5000
  }
}
```

#### 响应示例
```json
{
  "success": true,
  "data": {
    "testCase": "test_case_name",
    "passed": true,
    "actual": {},
    "details": "Test passed successfully",
    "executionTime": 120
  },
  "metadata": {
    "timestamp": "2025-01-01T00:00:00Z",
    "duration": 125,
    "requestId": "functional-test-123"
  }
}
```

### 3. 性能测试接口

#### 接口定义
```
POST /api/v1/{module}/test/performance
```

#### 请求参数
```json
{
  "config": {
    "concurrentUsers": 100,
    "duration": 60,
    "rampUp": 10,
    "testCase": {
      "name": "performance_test",
      "input": {}
    }
  }
}
```

#### 响应示例
```json
{
  "success": true,
  "data": {
    "testName": "performance_test",
    "metrics": {
      "totalRequests": 10000,
      "successfulRequests": 9995,
      "failedRequests": 5,
      "averageResponseTime": 45,
      "percentile95": 65,
      "percentile99": 85,
      "throughput": 166.67
    },
    "resourceUsage": {
      "cpu": 45.2,
      "memory": 256,
      "network": 1024
    }
  },
  "metadata": {
    "timestamp": "2025-01-01T00:00:00Z",
    "duration": 60000,
    "requestId": "performance-test-123"
  }
}
```

### 4. 错误处理测试接口

#### 接口定义
```
POST /api/v1/{module}/test/error-handling
```

#### 请求参数
```json
{
  "errorScenario": {
    "type": "network_error",
    "description": "Simulate network timeout",
    "parameters": {
      "timeout": 5000
    }
  }
}
```

#### 响应示例
```json
{
  "success": true,
  "data": {
    "scenario": "network_error",
    "handled": true,
    "errorResponse": {
      "code": "NETWORK_ERROR",
      "message": "Request timeout"
    },
    "recovery": {
      "attempted": true,
      "successful": true
    }
  },
  "metadata": {
    "timestamp": "2025-01-01T00:00:00Z",
    "duration": 5000,
    "requestId": "error-handling-test-123"
  }
}
```

### 5. 配置验证接口

#### 接口定义
```
POST /api/v1/{module}/test/config/validate
```

#### 请求参数
```json
{
  "config": {
    // 模块特定配置
  }
}
```

#### 响应示例
```json
{
  "success": true,
  "data": {
    "valid": true,
    "errors": [],
    "warnings": [],
    "suggestions": []
  },
  "metadata": {
    "timestamp": "2025-01-01T00:00:00Z",
    "duration": 15,
    "requestId": "config-validation-123"
  }
}
```

### 6. 模块元数据接口

#### 接口定义
```
GET /api/v1/{module}/metadata
```

#### 响应示例
```json
{
  "success": true,
  "data": {
    "name": "client-module",
    "version": "1.0.0",
    "description": "RCC Client Module",
    "dependencies": [
      "http-client",
      "session-manager"
    ],
    "capabilities": [
      "cli-commands",
      "http-proxy",
      "session-management"
    ],
    "testCoverage": 85.5
  },
  "metadata": {
    "timestamp": "2025-01-01T00:00:00Z",
    "duration": 3,
    "requestId": "metadata-123"
  }
}
```

## 各模块特定接口

### 客户端模块测试接口

#### CLI命令测试
```
POST /api/v1/client/test/cli/command
```

请求参数：
```json
{
  "command": "start",
  "args": ["--port", "5506"],
  "expectedOutput": "Server started on port 5506"
}
```

#### HTTP客户端测试
```
POST /api/v1/client/test/http/request
```

请求参数：
```json
{
  "request": {
    "method": "GET",
    "url": "/test",
    "headers": {},
    "body": null
  },
  "expected": {
    "status": 200,
    "responseTime": "<100ms"
  }
}
```

### 路由器模块测试接口

#### 路由功能测试
```
POST /api/v1/router/test/route
```

请求参数：
```json
{
  "request": {
    "model": "claude-3-sonnet",
    "messages": []
  },
  "expected": {
    "provider": "anthropic",
    "pipeline": "coding"
  }
}
```

#### 负载均衡测试
```
POST /api/v1/router/test/loadbalancer
```

请求参数：
```json
{
  "requests": 100,
  "providers": ["openai", "anthropic"],
  "expectedDistribution": {
    "openai": 50,
    "anthropic": 50
  }
}
```

### 流水线模块测试接口

#### 流水线执行测试
```
POST /api/v1/pipeline/test/execute
```

请求参数：
```json
{
  "pipeline": {
    "modules": ["transformer", "protocol", "server-compatibility", "server"],
    "input": {}
  },
  "expected": {
    "layersProcessed": 4,
    "executionTime": "<100ms"
  }
}
```

#### 子模块测试
```
POST /api/v1/pipeline/test/module
```

请求参数：
```json
{
  "module": "transformer",
  "input": {
    "type": "anthropic",
    "data": {}
  },
  "expected": {
    "type": "openai",
    "converted": true
  }
}
```

## 测试数据接口

### 测试数据生成
```
POST /api/v1/test-data/generate
```

请求参数：
```json
{
  "schema": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string"
      },
      "age": {
        "type": "number"
      }
    }
  },
  "count": 100
}
```

### 测试数据验证
```
POST /api/v1/test-data/validate
```

请求参数：
```json
{
  "data": {},
  "schema": {}
}
```

## 安全考虑

1. **访问控制**：测试API仅在测试环境中启用
2. **认证机制**：使用专用测试令牌进行认证
3. **数据隔离**：测试数据与生产数据完全隔离
4. **资源限制**：限制测试API的资源使用
5. **日志记录**：记录所有测试API调用日志

## 版本管理

1. **向后兼容**：新版本API应保持向后兼容
2. **版本标识**：通过URL路径标识API版本
3. **废弃策略**：明确废弃旧版本API的时间表
4. **迁移指南**：提供从旧版本到新版本的迁移指南