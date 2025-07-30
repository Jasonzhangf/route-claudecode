# CodeWhisperer Data Capture System

## 概述
CodeWhisperer Data Capture System 是一个完整的数据捕获和分析系统，用于调试和优化 CodeWhisperer provider 的性能。该系统在请求处理的每个阶段捕获详细数据，并提供强大的分析工具。

## 功能特性
- **多阶段数据捕获**: 认证、转换、HTTP、解析、工具调用
- **自动化存储**: 结构化的文件组织和命名约定
- **性能分析**: 详细的时间统计和性能指标
- **对比分析**: 与 OpenAI provider 的性能对比
- **问题诊断**: 自动识别和分类性能问题
- **清理管理**: 自动化的旧文件清理机制

## 数据捕获类型

### 1. 认证数据 (AuthCaptureData)
捕获 token 管理相关的事件：
- `token_validation`: Token 有效性检查
- `token_refresh`: Token 刷新操作
- `token_expired`: Token 过期事件
- `auth_failure`: 认证失败事件

### 2. 转换数据 (ConversionCaptureData)
捕获格式转换过程：
- `request_conversion`: 请求格式转换
- `response_conversion`: 响应格式转换
- `history_building`: 对话历史构建

### 3. HTTP 数据 (HttpCaptureData)
捕获 HTTP 层原始数据：
- `request_sent`: HTTP 请求发送
- `response_received`: HTTP 响应接收
- `request_retry`: 请求重试
- `http_error`: HTTP 错误

### 4. 解析数据 (ParsingCaptureData)
捕获响应解析过程：
- `sse_parsing`: SSE 事件解析
- `buffered_conversion`: 缓冲响应转换
- `stream_reconstruction`: 流事件重构
- `tool_detection`: 工具调用检测
- `parsing_error`: 解析错误

### 5. 工具调用数据 (ToolCallCaptureData)
捕获工具调用处理：
- `tool_call_detected`: 工具调用检测
- `tool_call_fixed`: 工具调用修复
- `tool_result_processed`: 工具结果处理
- `tool_error`: 工具处理错误

## 文件组织结构
```
~/.route-claude-code/database/
├── captures/
│   └── codewhisperer/
│       ├── cw-auth-token_validation-[timestamp]-[requestId].json
│       ├── cw-conversion-request_conversion-[timestamp]-[requestId].json
│       ├── cw-http-request_sent-[timestamp]-[requestId].json
│       ├── cw-parsing-sse_parsing-[timestamp]-[requestId].json
│       └── cw-tool_processing-tool_call_detected-[timestamp]-[requestId].json
└── reports/
    └── analysis-report-[requestId]-[timestamp].json
```

## 使用方法

### 1. 基本集成
数据捕获系统已集成到 CodeWhisperer provider 中，无需额外配置即可使用：

```typescript
import { CodeWhispererClient } from '@/providers/codewhisperer';

// 数据捕获自动启用
const client = new CodeWhispererClient(config);
const response = await client.sendRequest(request);
```

### 2. 手动数据捕获
如需手动捕获特定事件：

```typescript
import { captureAuthEvent, captureHttpEvent } from '@/providers/codewhisperer';

// 捕获认证事件
captureAuthEvent('request-123', 'token_validation', {
  tokenValid: true,
  timeTaken: 150
});

// 捕获 HTTP 事件
captureHttpEvent('request-123', 'response_received', {
  responseStatus: 200,
  responseSize: 1024,
  timeTaken: 500
});
```

### 3. 数据分析
生成完整的分析报告：

```typescript
import { generateAnalysisReport, saveAnalysisReport } from '@/providers/codewhisperer';

// 生成分析报告
const report = generateAnalysisReport('request-123');

// 保存报告
const savedPath = saveAnalysisReport(report);
console.log(`Report saved to: ${savedPath}`);
```

### 4. 命令行工具
使用内置的 CLI 工具进行分析：

```bash
# 显示捕获统计
node src/providers/codewhisperer/debug-cli.js stats

# 列出捕获文件
node src/providers/codewhisperer/debug-cli.js list --stage=auth

# 分析特定请求
node src/providers/codewhisperer/debug-cli.js analyze --request-id=req-123

# 显示最近摘要
node src/providers/codewhisperer/debug-cli.js summary --days=7

# 清理旧文件
node src/providers/codewhisperer/debug-cli.js cleanup --days=30
```

## 测试验证

### 运行测试套件
```bash
# 运行数据捕获测试
node test/functional/test-codewhisperer-data-capture.js
```

### 测试输出示例
```
🧪 CodeWhisperer Data Capture Test
=====================================
✅ Data capture modules found
✅ Capture directory ready  
✅ API request successful
✅ Capture files generated
✅ Capture analysis complete
🎉 All tests passed!

📊 Test Summary:
✅ Success: true
📁 Capture files: 5
🏗️ Stages captured: auth, conversion, http, parsing
📝 Events captured: token_validation, request_conversion, request_sent, response_received, sse_parsing
```

## 分析报告示例

### 性能指标
```json
{
  "requestId": "req-123",
  "codewhisperer": {
    "performance": {
      "totalTime": 1250,
      "authTime": 150,
      "conversionTime": 50,
      "httpTime": 800,
      "parsingTime": 200,
      "toolProcessingTime": 50,
      "errorCount": 0,
      "successRate": 100
    }
  }
}
```

### 问题识别
```json
{
  "issues": [
    {
      "severity": "medium",
      "category": "http",
      "description": "Slow HTTP operation (1200ms)",
      "recommendations": [
        "Optimize processing logic",
        "Check network conditions",
        "Consider timeout adjustments"
      ]
    }
  ]
}
```

### 对比分析
```json
{
  "comparison": {
    "performanceDifference": -15.5,
    "reliabilityDifference": 2.1,
    "dataLosses": [],
    "formatDifferences": ["tool_call_format"],
    "toolCallAccuracy": 0.95
  }
}
```

## 配置选项

### 环境变量
- `CAPTURE_DISABLED`: 设置为 'true' 禁用数据捕获
- `CAPTURE_VERBOSE`: 设置为 'true' 启用详细日志
- `CAPTURE_MAX_FILES`: 最大捕获文件数量 (默认: 1000)

### 自动清理
系统会自动清理超过 7 天的捕获文件。可通过以下方式自定义：

```typescript
import { cleanupOldCaptures } from '@/providers/codewhisperer';

// 清理超过 30 天的文件
const deletedCount = cleanupOldCaptures(30);
```

## 最佳实践

### 1. 性能监控
- 定期检查平均响应时间
- 监控错误率变化
- 对比不同时间段的性能

### 2. 问题诊断
- 使用 requestId 跟踪完整请求链路
- 分析失败请求的捕获数据
- 对比成功和失败请求的差异

### 3. 容量管理
- 定期清理旧的捕获文件
- 监控存储空间使用
- 在生产环境中考虑采样策略

### 4. 数据分析
- 建立基准性能指标
- 跟踪性能趋势
- 识别性能回归

## 故障排除

### 常见问题
1. **捕获文件未生成**
   - 检查目录权限
   - 验证模块导入正确
   - 确认服务正在运行

2. **分析工具失败**
   - 检查文件格式完整性
   - 验证 requestId 匹配
   - 确认依赖模块可用

3. **性能影响**
   - 数据捕获对性能影响 < 5%
   - 在高负载时考虑禁用详细捕获
   - 使用异步写入减少阻塞

### 调试步骤
1. 检查服务日志
2. 验证捕获目录权限
3. 运行测试套件
4. 检查网络连接
5. 确认配置正确

## 扩展开发

### 添加新的捕获类型
```typescript
// 定义新的捕获接口
export interface CustomCaptureData {
  timestamp: string;
  requestId: string;
  stage: 'custom';
  event: 'custom_event';
  data: {
    customField: any;
    timeTaken?: number;
  };
}

// 实现捕获函数
export function captureCustomEvent(requestId: string, data: any) {
  const captureData: CustomCaptureData = {
    timestamp: new Date().toISOString(),
    requestId,
    stage: 'custom',
    event: 'custom_event',
    data
  };
  
  saveCaptureData(captureData);
}
```

### 自定义分析工具
```typescript
export function generateCustomReport(captures: CaptureData[]): CustomReport {
  // 自定义分析逻辑
  return {
    // 自定义报告结构
  };
}
```

## 版本历史
- **v1.0.0**: 初始版本，基本数据捕获功能
- **v1.1.0**: 添加分析工具和 CLI 界面
- **v1.2.0**: 支持对比分析和自动清理

## 贡献指南
请参考项目的 CONTRIBUTING.md 文件，并确保：
- 所有新功能都有对应的测试
- 保持向后兼容性
- 更新相关文档
- 遵循项目的编码规范