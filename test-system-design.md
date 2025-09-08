# RCC v4.0 测试系统设计文档

## 1. 系统概述

本测试系统旨在通过对比RCC v4.0与Claude Code Router的请求和响应数据，快速调整和修正RCC v4.0的实现。系统包含数据捕获、数据对比、启动脚本和修复流程四个核心组件。

## 2. 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    测试客户端层                              │
├─────────────────────────────────────────────────────────────┤
│  数据捕获客户端  │  数据对比客户端  │  修复流程客户端        │
├─────────────────────────────────────────────────────────────┤
│                    测试API网关层                              │
├─────────────────────────────────────────────────────────────┤
│  数据捕获API    │  数据对比API    │  启动脚本API  │  修复API  │
├─────────────────────────────────────────────────────────────┤
│                    被测系统层                                │
├─────────────────────────────────────────────────────────────┤
│  Transformer模块 │  Protocol模块  │  ServerCompatibility模块 │
└─────────────────────────────────────────────────────────────┘
```

## 3. 核心组件

### 3.1 数据捕获模块

#### 功能描述
捕获RCC v4.0和Claude Code Router的请求和响应数据，用于后续对比分析。

#### 接口定义
```
GET    /api/v1/test/capture/start                    # 开始数据捕获
POST   /api/v1/test/capture/stop                     # 停止数据捕获
GET    /api/v1/test/capture/status                   # 获取捕获状态
GET    /api/v1/test/capture/data                     # 获取捕获数据
DELETE /api/v1/test/capture/data                     # 清除捕获数据
```

#### 数据结构
```typescript
interface CaptureData {
  id: string;
  timestamp: string;
  source: 'rcc4' | 'claude-code-router';
  type: 'request' | 'response';
  data: any;
  metadata: {
    provider: string;
    model: string;
    endpoint: string;
  };
}

interface CaptureSession {
  id: string;
  startTime: string;
  endTime?: string;
  status: 'running' | 'stopped' | 'error';
  dataCount: number;
  sources: string[];
}
```

### 3.2 数据对比模块

#### 功能描述
对比RCC v4.0和Claude Code Router的请求和响应数据，识别差异并生成报告。

#### 接口定义
```
POST   /api/v1/test/compare/run                      # 执行数据对比
GET    /api/v1/test/compare/results                  # 获取对比结果
GET    /api/v1/test/compare/report                   # 获取对比报告
POST   /api/v1/test/compare/config                   # 配置对比规则
```

#### 数据结构
```typescript
interface CompareResult {
  id: string;
  timestamp: string;
  sessionId: string;
  status: 'success' | 'failed' | 'partial';
  differences: Difference[];
  summary: {
    totalComparisons: number;
    passed: number;
    failed: number;
    errorRate: number;
  };
}

interface Difference {
  type: 'field_missing' | 'field_mismatch' | 'value_mismatch' | 'structure_mismatch';
  path: string;
  expected: any;
  actual: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}
```

### 3.3 启动脚本模块

#### 功能描述
提供完整的测试环境启动脚本，包括RCC v4.0和Claude Code Router的启动。

#### 脚本列表
1. `start-test-environment.sh` - 启动完整测试环境
2. `start-rcc4.sh` - 启动RCC v4.0
3. `start-ccr.sh` - 启动Claude Code Router
4. `run-test-suite.sh` - 运行测试套件
5. `stop-all.sh` - 停止所有服务

#### 脚本功能
- 环境检查和依赖验证
- 服务启动和健康检查
- 测试数据准备
- 自动化测试执行
- 结果收集和报告生成

### 3.4 修复流程模块

#### 功能描述
基于对比结果自动生成修复策略，并执行修复操作。

#### 接口定义
```
POST   /api/v1/test/fix/generate                     # 生成修复策略
POST   /api/v1/test/fix/apply                        # 应用修复策略
GET    /api/v1/test/fix/status                       # 获取修复状态
GET    /api/v1/test/fix/report                       # 获取修复报告
```

#### 数据结构
```typescript
interface FixStrategy {
  id: string;
  timestamp: string;
  targetModule: string;
  targetType: 'transformer' | 'protocol' | 'compatibility';
  actions: FixAction[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedTime: number; // minutes
}

interface FixAction {
  type: 'field_mapping' | 'value_conversion' | 'structure_transformation' | 'code_update';
  description: string;
  target: string; // 文件路径或函数名
  changes: any;
  validation: {
    before: any;
    after: any;
  };
}
```

## 4. 工作流程

### 4.1 测试准备阶段
1. 启动测试环境
2. 配置数据捕获
3. 准备测试数据集

### 4.2 数据捕获阶段
1. 同时向RCC v4.0和Claude Code Router发送相同请求
2. 捕获双方的请求和响应数据
3. 存储捕获数据用于后续对比

### 4.3 数据对比阶段
1. 执行数据对比分析
2. 识别数据差异
3. 生成对比报告

### 4.4 修复执行阶段
1. 基于对比结果生成修复策略
2. 应用修复策略
3. 验证修复效果

### 4.5 报告生成阶段
1. 汇总测试结果
2. 生成详细报告
3. 提供改进建议

## 5. 部署和配置

### 5.1 环境要求
- Node.js >= 18.0.0
- TypeScript >= 5.0.0
- Docker (可选，用于服务隔离)
- 至少4GB内存

### 5.2 配置文件
```json
{
  "test": {
    "capture": {
      "enabled": true,
      "outputDir": "./test-capture-data",
      "maxFileSize": "100MB"
    },
    "compare": {
      "rules": [
        {
          "type": "field",
          "path": "model",
          "tolerance": "exact"
        }
      ]
    },
    "fix": {
      "autoApply": false,
      "backupBeforeFix": true
    }
  },
  "services": {
    "rcc4": {
      "port": 5511,
      "host": "localhost"
    },
    "claudeCodeRouter": {
      "port": 5510,
      "host": "localhost"
    }
  }
}
```

## 6. 使用指南

### 6.1 启动测试环境
```bash
./scripts/start-test-environment.sh
```

### 6.2 运行测试套件
```bash
./scripts/run-test-suite.sh
```

### 6.3 查看测试结果
```bash
./scripts/view-test-results.sh
```

### 6.4 应用修复
```bash
./scripts/apply-fixes.sh
```

## 7. 维护和扩展

### 7.1 系统维护
- 定期清理测试数据
- 更新对比规则
- 监控系统性能

### 7.2 功能扩展
- 支持更多Provider的对比
- 增加性能测试功能
- 集成CI/CD流程