# Claude Code Router - 更新日志

## [2.1.0] - 2025-07-26

### 🛠️ 重大修复 (Major Fixes)

#### 工具调用文本转换问题修复
- **问题描述**: CodeWhisperer返回的工具调用在unknown事件类型中被错误处理为text_delta事件
- **影响**: 工具调用显示为普通文本而非正确的工具调用界面
- **修复位置**: `src/providers/codewhisperer/parser.ts:309-361`
- **修复内容**:
  - 在parser的default case中添加工具调用文本检测逻辑
  - 支持自动识别"Tool call: ToolName({...})"格式
  - 使用正则表达式解析工具名称和参数
  - 转换为标准的tool_use事件结构
  - 解析失败时优雅降级为原始文本处理

#### TypeScript编译错误修复
- **问题**: catch块中的error类型处理不当
- **修复**: 使用正确的类型注解和可选链操作符
- **影响**: 确保构建过程的稳定性

### 🧪 测试改进 (Testing Improvements)

#### 新增功能测试
1. **test-tool-call-as-text-real-data.js**
   - 使用真实日志数据模拟问题复现
   - 验证parser处理逻辑的准确性
   - 提供详细的修复建议

2. **test-fixed-tool-call-parsing.js**
   - 真实API请求验证修复效果
   - 端到端测试工具调用处理流程
   - 确保修复在生产环境中生效

#### 测试规范增强
- 新增"真实数据测试"原则
- 新增"修复验证测试"要求
- 完善测试文档管理系统

### 📊 监控增强 (Monitoring Enhancements)

#### 流水线日志改进
- **位置**: `src/server.ts:371`
- **内容**: 添加每个chunk的详细日志记录
- **格式**: `[PIPELINE-NODE] Raw chunk ${chunkCount} from provider`
- **包含信息**: 事件类型、数据类型、数据状态

#### 工具调用监控
- 专门的工具调用事件跟踪
- Token计算的详细日志
- 工具调用完成状态监控

### 🔧 架构改进 (Architecture Improvements)

#### 事件解析增强
- 支持未知事件类型的智能处理
- 工具调用文本的自动检测和转换
- 更好的错误恢复机制

#### 会话管理优化
- 工具调用完成后移除停止信号
- 保持对话的连续性
- 优化token计算逻辑

### 📚 文档更新 (Documentation Updates)

#### CLAUDE.md增强
- 新增工具调用处理专门章节
- 更新调试和监控功能说明
- 添加最近重大修复记录
- 完善测试管理系统规范

#### 测试文档
- 为所有新测试创建对应的MD文档
- 详细记录测试执行历史
- 提供修复验证的完整记录

### 🏗️ 技术细节 (Technical Details)

#### 修复实现细节
```javascript
// 检测工具调用文本
if (Data.text.startsWith('Tool call:')) {
  // 解析工具调用格式
  const toolCallMatch = Data.text.match(/Tool call:\s*(\w+)\s*\((.+)\)$/);
  if (toolCallMatch) {
    const toolName = toolCallMatch[1];
    const toolArgsStr = toolCallMatch[2];
    
    // 返回正确的tool_use事件
    return {
      event: 'content_block_start',
      data: {
        type: 'content_block_start',
        index: 1,
        content_block: {
          type: 'tool_use',
          id: `parsed_tool_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name: toolName,
          input: toolInput
        }
      }
    };
  }
}
```

#### 测试验证结果
- ✅ 构建成功，无TypeScript错误
- ✅ 功能测试通过，问题成功复现
- ✅ 修复验证测试通过，修复生效
- ✅ 端到端测试正常，无工具调用转文本问题

### 📈 性能影响 (Performance Impact)
- 修复对性能影响微小
- 仅在处理包含"Tool call:"文本的未知事件时触发
- 正则表达式匹配开销可忽略
- 整体响应时间无明显变化

### 🔄 向后兼容性 (Backward Compatibility)
- ✅ 完全向后兼容
- ✅ 不影响现有工具调用处理
- ✅ 不影响其他事件类型处理
- ✅ 解析失败时优雅降级

### 🎯 用户体验改进 (User Experience)
- 工具调用现在正确显示为工具调用界面
- 不再出现工具调用文本显示问题
- 工具调用后对话可以正常继续
- Token计算更加准确

---

## 贡献者 (Contributors)
- Jason Zhang - 工具调用解析修复实现
- 测试用例设计和验证