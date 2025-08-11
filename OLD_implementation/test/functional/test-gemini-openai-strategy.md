# Test: Gemini使用OpenAI缓冲流式策略

## 测试用例
验证 Gemini provider 使用 OpenAI 风格的缓冲流式策略而非直接流式策略

## 测试目标
- 修复 Gemini 返回 `outputTokens=0` 的问题
- 验证 Gemini 使用 OpenAI 缓冲处理器正确计算 token
- 确保流式事件和内容正常输出
- 确认不再使用直接流式策略（`direct-streaming`）

## 问题背景
从日志分析发现 Gemini 虽然能解析事件（`eventCount > 0`），但输出始终显示 `outputTokens=0`，导致用户感觉请求"卡住"。

### 问题分析
1. **事件解析正常**: `"eventCount":52` 和 `"eventCount":21` - 事件被正确解析
2. **但token计算错误**: `"outputTokens":0` - 流式转换有问题  
3. **策略选择错误**: 使用 `direct-streaming` 而非 `openai-buffered`

## 解决方案

### 架构改进
切换 Gemini 处理策略：
- **修改前**: 使用通用解析器的 `direct-streaming` 策略
- **修改后**: 使用 OpenAI 风格的 `buffered` 策略

### 实现步骤
1. **修改流式处理逻辑** (`src/providers/gemini/client.ts`)：
   ```typescript
   // 旧：使用通用优化解析器
   const optimizedEvents = await processGeminiResponse(fullResponseContent, requestId, ...);
   
   // 新：使用OpenAI缓冲处理器
   const { processOpenAIBufferedResponse } = await import('../openai/buffered-processor');
   const openaiEvents = this.convertToOpenAIEvents(openaiBufferedResponse, requestId);
   const streamEvents = processOpenAIBufferedResponse(openaiEvents, requestId, request.model);
   ```

2. **添加格式转换方法**：
   - `convertGeminiToOpenAIBuffered()`: Gemini事件 → OpenAI缓冲响应
   - `convertToOpenAIEvents()`: OpenAI缓冲响应 → OpenAI流式事件

3. **使用OpenAI处理器**: 复用经过验证的 OpenAI 缓冲流式转换逻辑

## 最近执行记录

### 2025-07-30T22:03:00 - ✅ PASS - 9952ms
- **状态**: 测试完全通过
- **关键指标**: 
  - 910 个流式事件
  - 44,074 字符内容
  - 334 个输出token（**解决了outputTokens=0问题**）
- **验证成功**:
  - ✅ HTTP 200 状态
  - ✅ 接收到大量流式事件
  - ✅ 接收到完整内容
  - ✅ **正确计算输出token**
- **策略确认**: 使用 `"OpenAI strategy"` 而非 `direct-streaming`
- **日志文件**: `/Users/fanzhang/.route-claude-code/logs/ccr-session-2025-07-30T22-01-59.log`

## 历史执行记录
暂无

## 相关文件
- **测试脚本**: `test/functional/test-gemini-openai-strategy.js`
- **修复文件**: `src/providers/gemini/client.ts`
- **参考实现**: `src/providers/openai/enhanced-client.ts`
- **处理器**: `src/providers/openai/buffered-processor.ts`

## 修复效果对比

### 修复前（direct-streaming策略）
```json
{
  "eventCount": 52,
  "outputTokens": 0,  // ❌ 问题：始终为0
  "strategy": "direct-streaming"
}
```

### 修复后（OpenAI缓冲策略）
```json
{
  "eventCount": 910,
  "outputTokens": 334,  // ✅ 正确计算token
  "strategy": "openai-buffered"
}
```

## 技术架构
- **策略模式**: 从通用解析器切换到OpenAI专用处理器
- **缓冲处理**: 完全缓冲Gemini响应，然后转换为OpenAI格式
- **格式转换**: Gemini JSON → OpenAI缓冲 → OpenAI流式 → Anthropic流式
- **Token计算**: 使用OpenAI处理器的经过验证的token计算逻辑

## 预期影响
此修复完全解决了用户反馈的 Gemini "卡住"问题。现在 Gemini requests 能正确显示处理进度（outputTokens > 0）和内容输出。