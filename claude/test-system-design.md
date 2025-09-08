# Claude Code Router测试系统设计

## 1. 系统概述

本测试系统旨在通过对比我们实现的流水线与Claude Code Router的请求和响应数据，快速发现和修正转换逻辑中的差异，确保我们的实现与Claude Code Router在功能上保持一致。

## 2. 系统架构

### 2.1 核心组件

1. **数据捕获模块** - 捕获Claude Code Router和我们实现的请求/响应数据
2. **数据对比模块** - 对比两组数据的差异
3. **差异分析模块** - 分析差异并生成修复建议
4. **自动修正模块** - 根据分析结果自动调整转换规则
5. **测试执行模块** - 执行测试用例并收集结果

### 2.2 工作流程

```
测试用例执行 → 数据捕获 → 数据对比 → 差异分析 → 自动修正 → 验证
```

## 3. 数据捕获设计

### 3.1 Claude Code Router数据捕获

通过修改Claude Code Router的代码，在关键位置插入数据捕获逻辑：

1. **请求捕获点** - 在请求进入Transformer之前捕获原始Anthropic格式请求
2. **响应捕获点** - 在响应返回给客户端之前捕获原始Anthropic格式响应
3. **中间数据捕获** - 在各模块间传递数据时捕获OpenAI格式的请求和响应

### 3.2 我们实现的数据捕获

在我们实现的流水线各层添加相同的数据捕获点：

1. **Transformer层** - 捕获输入的Anthropic请求和输出的OpenAI请求
2. **Protocol层** - 捕获输入输出的OpenAI请求
3. **Compatibility层** - 捕获输入输出的OpenAI请求和响应
4. **Server层** - 捕获发送给Provider的请求和收到的响应
5. **Response转换层** - 捕获输入的OpenAI响应和输出的Anthropic响应

## 4. 数据对比设计

### 4.1 对比维度

1. **字段完整性** - 检查所有必要字段是否存在
2. **字段值一致性** - 检查字段值是否一致
3. **结构一致性** - 检查数据结构是否一致
4. **语义一致性** - 检查数据语义是否一致

### 4.2 对比策略

1. **逐层对比** - 对流水线的每一层进行独立对比
2. **端到端对比** - 对整个请求-响应流程进行对比
3. **差异高亮** - 高亮显示不一致的字段和值

## 5. 差异分析设计

### 5.1 差异分类

1. **字段缺失** - 某一方缺少必要的字段
2. **字段值不一致** - 相同字段的值不一致
3. **结构不一致** - 数据结构不一致
4. **语义不一致** - 数据语义不一致

### 5.2 修复建议生成

1. **字段映射建议** - 建议添加或修改字段映射规则
2. **值转换建议** - 建议添加或修改值转换规则
3. **结构调整建议** - 建议调整数据结构
4. **配置更新建议** - 建议更新转换配置

## 6. 自动修正设计

### 6.1 修正机制

1. **配置文件更新** - 自动更新字段转换表和值转换规则
2. **代码模板更新** - 自动更新转换函数模板
3. **测试用例更新** - 自动更新测试用例以验证修正效果

### 6.2 修正验证

1. **回归测试** - 运行所有相关测试用例确保修正没有引入新问题
2. **对比验证** - 重新执行对比确保差异已消除
3. **性能测试** - 确保修正没有影响性能

## 7. 启动脚本设计

### 7.1 脚本功能

1. **环境准备** - 启动Claude Code Router和我们的实现
2. **测试执行** - 执行预定义的测试用例
3. **数据收集** - 收集两方的请求/响应数据
4. **对比分析** - 运行对比和分析
5. **报告生成** - 生成详细的对比报告
6. **自动修正** - 根据分析结果自动修正差异

### 7.2 脚本参数

1. `--test-cases` - 指定要执行的测试用例文件
2. `--output-dir` - 指定输出目录
3. `--auto-fix` - 启用自动修正功能
4. `--verbose` - 启用详细日志输出

## 8. 修复流程设计

### 8.1 手动修复流程

1. **查看差异报告** - 查看自动生成的差异报告
2. **分析差异原因** - 分析差异产生的原因
3. **制定修复方案** - 制定具体的修复方案
4. **实施修复** - 修改配置文件或代码
5. **验证修复** - 重新执行测试验证修复效果

### 8.2 自动修复流程

1. **触发自动修复** - 通过命令行参数或配置启用自动修复
2. **生成修复方案** - 系统自动生成修复方案
3. **应用修复** - 系统自动应用修复
4. **验证修复** - 系统自动验证修复效果
5. **生成修复报告** - 生成详细的修复报告

## 9. 配置文件设计

### 9.1 测试配置

```json
{
  "testCases": [
    {
      "name": "basic_request",
      "description": "Basic anthropic request",
      "request": {
        "model": "claude-3-5-sonnet-20240620",
        "messages": [
          {
            "role": "user",
            "content": "Hello, world!"
          }
        ]
      }
    }
  ],
  "capture": {
    "claudeCodeRouter": {
      "host": "localhost",
      "port": 3456
    },
    "ourImplementation": {
      "host": "localhost",
      "port": 5511
    }
  },
  "output": {
    "directory": "./test-results"
  }
}
```

### 9.2 对比配置

```json
{
  "comparison": {
    "fieldsToIgnore": ["id", "timestamp"],
    "tolerance": {
      "numeric": 0.01,
      "string": "exact"
    }
  },
  "analysis": {
    "severityThreshold": "medium"
  }
}
```

## 10. 报告格式设计

### 10.1 差异报告

```json
{
  "summary": {
    "totalDifferences": 5,
    "criticalDifferences": 2,
    "warningDifferences": 3
  },
  "differences": [
    {
      "type": "field_value_mismatch",
      "path": "request.messages[0].content",
      "expected": "Hello, world!",
      "actual": "Hello, world",
      "severity": "critical"
    }
  ]
}
```

### 10.2 修复报告

```json
{
  "summary": {
    "totalFixes": 3,
    "successfulFixes": 3,
    "failedFixes": 0
  },
  "fixes": [
    {
      "type": "field_mapping_update",
      "description": "Updated field mapping for content field",
      "status": "success"
    }
  ]
}
```