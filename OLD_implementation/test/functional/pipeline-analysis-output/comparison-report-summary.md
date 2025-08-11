# Demo2 vs 当前实现 - 流水线对比分析报告

**生成时间**: 2025-08-04T05:46:35.217Z
**报告版本**: comparison-report-v1.0

## 📊 对比摘要

- **总测试用例**: 5
- **成功对比**: 5
- **失败对比**: 0
- **完全相同**: 0
- **存在差异**: 5

## 📋 详细对比结果

### 简单文本消息 (simple-text-message)

⚠️ **结果**: 存在差异

**Payload大小对比**:
- Demo2: 0.36 KB
- 当前实现: 0.36 KB
- 差异: -2 bytes

**主要差异**:
- `conversationState.conversationId`: Demo2="c4cec4cc-0430-4411-bcba-41756337fed7" vs 当前="0b9d4c35-2360-4002-9530-3dc3865a21e0"
- `conversationState.history`: Demo2="null" vs 当前=""

### 多轮对话 (multi-turn-conversation)

⚠️ **结果**: 存在差异

**Payload大小对比**:
- Demo2: 0.57 KB
- 当前实现: 0.57 KB
- 差异: 0 bytes

**主要差异**:
- `conversationState.conversationId`: Demo2="c3d35802-625c-42b9-b087-86659de5d750" vs 当前="95add2af-39a0-421c-bdb3-bfcc3150bcda"

### 带系统消息的对话 (system-message-conversation)

⚠️ **结果**: 存在差异

**Payload大小对比**:
- Demo2: 0.6 KB
- 当前实现: 0.6 KB
- 差异: 0 bytes

**主要差异**:
- `conversationState.conversationId`: Demo2="f8b9e700-0fc2-4799-ab30-7c76b6afb32f" vs 当前="01c3537e-2f15-4108-a674-e3493bf31253"

### 工具调用场景 (tool-calling-scenario)

⚠️ **结果**: 存在差异

**Payload大小对比**:
- Demo2: 0.65 KB
- 当前实现: 0.65 KB
- 差异: -2 bytes

**主要差异**:
- `conversationState.conversationId`: Demo2="11778678-cc4d-4834-8bdb-c144eb543242" vs 当前="663e5581-5654-4479-affc-bd59b0ee6f9c"
- `conversationState.history`: Demo2="null" vs 当前=""

### 长描述工具（测试截断） (complex-tool-with-long-description)

⚠️ **结果**: 存在差异

**Payload大小对比**:
- Demo2: 1.25 KB
- 当前实现: 1.17 KB
- 差异: -88 bytes

**主要差异**:
- `conversationState.conversationId`: Demo2="b33b27d2-b1da-48b3-9bed-07c3cc6a5184" vs 当前="3715556c-2169-4c52-af55-d7e2a85ddb80"
- `conversationState.currentMessage.userInputMessage.userInputMessageContext.tools.0.toolSpecification.description`: Demo2="This is a very comprehensive analysis tool that can perform multiple types of data analysis including statistical analysis, trend analysis, correlation analysis, regression analysis, time series analysis, and many other advanced analytical operations. It supports various data formats and can handle large datasets efficiently. The tool also provides visualization capabilities and can generate detailed reports with insights and recommendations based on the analysis results. It is designed to be user-friendly while maintaining high performance and accuracy in all analytical operations." vs 当前="This is a very comprehensive analysis tool that can perform multiple types of data analysis including statistical analysis, trend analysis, correlation analysis, regression analysis, time series analysis, and many other advanced analytical operations. It supports various data formats and can handle large datasets efficiently. The tool also provides visualization capabilities and can generate detailed reports with insights and recommendations based on the analysis results. It is designed to be us..."
- `conversationState.history`: Demo2="null" vs 当前=""

