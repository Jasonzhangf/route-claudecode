# Claude Code Router 测试系统设计

## 1. 系统概述

测试系统用于验证Claude Code Router的双向转换机制，通过对比转换结果来修正和优化实现方案。系统支持捕获真实请求/响应数据，与参考实现进行对比分析，并提供自动化调整修正功能。

## 2. 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    测试客户端层                              │
├─────────────────────────────────────────────────────────────┤
│  数据捕获模块  │  对比分析模块  │  自动调整模块  │  报告生成模块 │
├─────────────────────────────────────────────────────────────┤
│                    测试API网关层                              │
├─────────────────────────────────────────────────────────────┤
│  模块测试API    │  集成测试API    │  系统测试API            │
├─────────────────────────────────────────────────────────────┤
│                    被测系统层                                │
├─────────────────────────────────────────────────────────────┤
│  Transformer模块  │  Protocol模块  │  Compatibility模块      │
└─────────────────────────────────────────────────────────────┘
```

## 3. 核心组件

### 3.1 数据捕获模块
- **功能**：捕获Claude Code Router和我们实现的请求/响应数据
- **实现**：
  - 请求捕获：记录输入数据和转换结果
  - 响应捕获：记录Provider响应和最终输出
  - 数据存储：JSON格式存储，按时间戳和请求ID组织

### 3.2 对比分析模块
- **功能**：对比参考实现和我们实现的转换结果
- **实现**：
  - 字段级对比：逐字段比较转换结果
  - 差异识别：标记不一致的字段和值
  - 相似度计算：计算结果相似度百分比

### 3.3 自动调整模块
- **功能**：基于差异自动调整转换规则
- **实现**：
  - 规则引擎：基于表格的转换规则
  - 动态调整：根据差异自动更新转换规则
  - 回归测试：调整后重新验证

### 3.4 报告生成模块
- **功能**：生成测试报告和修复建议
- **实现**：
  - 差异报告：详细列出所有差异点
  - 性能报告：处理时间和资源使用情况
  - 修复建议：针对差异提供修复方案

## 4. 测试流程

### 4.1 启动脚本
```bash
#!/bin/bash
# test-system-start.sh

echo "🚀 启动Claude Code Router测试系统"

# 1. 启动参考实现（Claude Code Router）
echo "🔄 启动参考实现..."
# 启动Claude Code Router服务

# 2. 启动被测系统
echo "🔄 启动被测系统..."
# 启动我们的实现

# 3. 启动数据捕获
echo "🔄 启动数据捕获..."
# 启动数据捕获服务

# 4. 运行测试用例
echo "🧪 运行测试用例..."
# 执行测试用例

# 5. 生成报告
echo "📊 生成测试报告..."
# 生成对比报告

echo "✅ 测试系统启动完成"
```

### 4.2 修复流程
1. **数据收集**：运行测试用例收集参考实现和我们实现的数据
2. **差异分析**：对比分析模块识别所有差异点
3. **修复建议**：报告生成模块提供修复建议
4. **规则调整**：自动调整模块根据建议更新转换规则
5. **回归测试**：重新运行测试验证修复效果

## 5. 测试用例设计

### 5.1 基础转换测试
- Anthropic请求 → OpenAI请求转换
- OpenAI响应 → Anthropic响应转换

### 5.2 工具调用测试
- 带工具调用的请求转换
- 工具调用响应处理

### 5.3 流式处理测试
- 流式请求 → 非流式请求转换
- 非流式响应 → 流式响应转换

### 5.4 兼容性测试
- 不同Provider的兼容性处理
- 特殊字段处理测试

## 6. 自动化调整机制

### 6.1 规则引擎
```typescript
interface ConversionRule {
  sourceField: string;
  targetField: string;
  transformFunction: string;
  condition?: string;
}

interface RuleTable {
  req_input_table: ConversionRule[];
  req_output_table: ConversionRule[];
  resp_input_table: ConversionRule[];
  resp_output_table: ConversionRule[];
}
```

### 6.2 动态调整
- 基于差异分析结果自动更新规则表
- 支持手动规则调整
- 规则版本管理和回滚

## 7. 启动脚本

### 7.1 主启动脚本
```bash
#!/bin/bash
# rcc-test-runner.sh

# 设置环境变量
export TEST_MODE=true
export CAPTURE_DATA=true
export REFERENCE_IMPL_URL="http://localhost:8080"
export TEST_IMPL_URL="http://localhost:8081"

# 启动测试系统
node dist/test/test-runner.js
```

### 7.2 数据捕获脚本
```bash
#!/bin/bash
# data-capture.sh

# 启动数据捕获服务
node dist/test/data-capture.js --port 8082
```

### 7.3 对比分析脚本
```bash
#!/bin/bash
# comparison-analysis.sh

# 运行对比分析
node dist/test/comparison-analyzer.js --report detailed
```

## 8. 修复流程

### 8.1 差异识别
1. 运行测试收集数据
2. 执行对比分析
3. 生成差异报告

### 8.2 修复执行
1. 根据差异报告生成修复建议
2. 更新转换规则
3. 重新运行测试验证

### 8.3 回归测试
1. 执行完整测试套件
2. 验证修复效果
3. 生成最终报告

## 9. 配置文件

### 9.1 测试配置
```json
{
  "testConfig": {
    "referenceEndpoint": "http://localhost:8080",
    "testEndpoint": "http://localhost:8081",
    "captureEndpoint": "http://localhost:8082",
    "testCases": [
      "basic-conversion",
      "tool-calling",
      "streaming",
      "compatibility"
    ],
    "captureData": true,
    "generateReport": true
  },
  "rules": {
    "autoAdjust": true,
    "maxRetries": 3,
    "tolerance": 0.95
  }
}
```

## 10. 报告格式

### 10.1 差异报告
```json
{
  "testId": "test-001",
  "timestamp": "2025-09-05T10:30:00Z",
  "differences": [
    {
      "field": "model",
      "referenceValue": "gpt-4",
      "testValue": "llama-3",
      "severity": "high"
    },
    {
      "field": "max_tokens",
      "referenceValue": 4096,
      "testValue": 2048,
      "severity": "medium"
    }
  ],
  "similarity": 0.85,
  "recommendations": [
    "Update model mapping rule",
    "Adjust max_tokens handling"
  ]
}
```

这个测试系统设计确保了我们能够有效地验证和优化Claude Code Router的双向转换机制，通过自动化的方式识别差异并提供修复建议。