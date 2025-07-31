# Test: Gemini Direct Parser Fix

## 测试用例
验证 GeminiDirectStrategy 能正确解析 Gemini API 返回的 JSON 数组格式响应

## 测试目标
- 修复 Gemini 返回 0 事件的问题，尽管收到了有效的 36KB 响应数据
- 验证解析器能正确处理 JSON 数组格式而非 SSE 格式
- 确保解析出的事件包含实际内容文本

## 问题背景
从日志 `/Users/fanzhang/.route-claude-code/logs/ccr-session-2025-07-30T21-32-25.log` 分析发现：
- Gemini API 返回了 36KB 有效数据，包含中文内容 `"好的，"`
- 使用 `direct-streaming` 策略进行解析
- **问题**：`GeminiDirectStrategy.parseGeminiStreamResponse()` 返回 `"eventCount":0`
- **原因**：解析器期望 SSE 格式 (`data: ...` 行)，但 Gemini 返回直接 JSON 数组格式

## 修复内容
在 `src/providers/gemini/universal-gemini-parser.ts` 的 `GeminiDirectStrategy.parseGeminiStreamResponse()` 方法中：

### 修复前
```typescript
// 只尝试解析 SSE 格式
const lines = content.split('\n');
for (const line of lines) {
  if (line.startsWith('data: ')) {
    // SSE 解析逻辑
  }
}
```

### 修复后  
```typescript
try {
  // 首先尝试解析为直接 JSON 数组格式（Gemini 的实际格式）
  const parsedContent = JSON.parse(content);
  
  if (Array.isArray(parsedContent)) {
    events = parsedContent;
  } else {
    events = [parsedContent];
  }
} catch (error) {
  // 降级：尝试解析为 SSE 格式（传统格式）
  // ... SSE 解析逻辑
}
```

## 最近执行记录

### 2025-07-30T21:42:00 - ✅ PASS - 16ms
- **状态**: 测试通过
- **直接解析器**: ✅ PASS - 成功解析 JSON 数组，提取了 2 个事件
- **API 集成**: ⚠️ SKIP - 服务器未运行
- **验证点**: 
  - JSON 数组解析成功
  - 事件数量正确 (2 个事件)
  - 内容提取正确 (`"好的，"`)
- **日志文件**: `/tmp/test-gemini-parser-fix-2025-07-30T21-42.log`

## 历史执行记录
暂无

## 相关文件
- **测试脚本**: `test/functional/test-gemini-direct-parser-fix.js`
- **修复文件**: `src/providers/gemini/universal-gemini-parser.ts`
- **问题日志**: `/Users/fanzhang/.route-claude-code/logs/ccr-session-2025-07-30T21-32-25.log`

## 测试覆盖
- ✅ JSON 数组格式解析
- ✅ 单个 JSON 对象格式解析  
- ✅ SSE 格式降级解析
- ✅ 事件内容验证
- ✅ 错误处理

## 预期影响
此修复应完全解决 Gemini 响应解析返回 0 事件的问题，使 Gemini provider 能正常工作并返回实际内容。