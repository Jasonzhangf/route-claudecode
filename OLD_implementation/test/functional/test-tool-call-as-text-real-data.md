# 基于真实日志数据复现工具调用转文本问题

## 测试用例
使用真实日志数据模拟重现工具调用被误认为文本的问题

## 测试目标
- 验证parser.ts中default case的处理逻辑
- 重现工具调用文本被错误转换为text_delta事件的问题
- 提供修复建议和解决方案

## 最近执行记录

### 2025-07-26 23:57:18 - FAILED - 问题成功复现
- **执行时长**: ~1s
- **日志文件**: `/tmp/tool-call-real-data-test.log`
- **测试状态**: FAILED (预期结果)
- **发现问题**: 1个高优先级问题
- **问题详情**: Parser default case将工具调用文本错误转换为text_delta事件
- **位置**: `src/providers/codewhisperer/parser.ts:308-320`
- **原始数据**: `"Tool call: Grep({"pattern": "ProviderConfig|settings"})"`

## 历史执行记录
- 2025-07-26 23:57:18: FAILED - 成功复现问题，生成修复建议

## 相关文件
- **测试脚本**: `test/functional/test-tool-call-as-text-real-data.js`
- **日志文件**: `/tmp/tool-call-real-data-test.log`
- **修复位置**: `src/providers/codewhisperer/parser.ts:309-361`

## 测试数据结构
```javascript
problematicEvent: {
  Event: 'unknownEventType', // 触发default case
  Data: {
    text: 'Tool call: Grep({"pattern": "ProviderConfig|settings"})' // 真实日志数据
  }
}
```

## 修复建议
在parser.ts的default case中添加工具调用文本检测逻辑:
1. 检测Data.text是否包含"Tool call:"
2. 使用正则表达式解析工具名称和参数
3. 返回正确的tool_use事件而非text_delta事件
4. 解析失败时优雅降级为文本处理

## 测试价值
- 提供了问题的准确复现
- 基于真实日志数据，具有高度可信性
- 为修复实现提供了明确的指导方向