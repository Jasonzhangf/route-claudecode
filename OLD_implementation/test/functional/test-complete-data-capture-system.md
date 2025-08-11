# 完整数据捕获系统集成测试

## 测试用例
验证 CodeWhisperer 数据捕获系统的完整性，测试与 OpenAI 的对比修正机制，评估数据质量和修正效果。

## 测试目标
1. **数据捕获完整性**: 验证所有处理阶段的数据都能被正确捕获和存储
2. **对比分析准确性**: 测试与 OpenAI 响应的对比分析功能
3. **修正机制有效性**: 验证基于对比结果的自动修正效果
4. **系统可靠性**: 评估整个系统的稳定性和性能表现
5. **数据质量评估**: 生成数据质量报告和改进建议

## 测试配置

### 基础配置
- **测试持续时间**: 30秒
- **请求间隔**: 5秒
- **测试场景**: 简单文本、复杂推理、工具调用
- **输出目录**: `/tmp/complete-system-test`
- **日志文件**: `/tmp/test-complete-data-capture-system.log`

### 测试场景详情

#### 1. 简单文本测试 (`simple`)
- **请求内容**: "解释什么是机器学习"
- **测试重点**: 基础数据捕获和响应质量
- **预期结果**: 100% 数据捕获成功率

#### 2. 复杂推理测试 (`complex`)
- **请求内容**: 代码性能分析和优化建议
- **测试重点**: 复杂响应的数据完整性
- **预期结果**: 高质量的分析和修正建议

#### 3. 工具调用测试 (`tool-calling`)
- **请求内容**: 包含 web_search 工具的请求
- **测试重点**: 工具调用数据的捕获和修正
- **预期结果**: 工具调用格式的正确处理

## 评估指标

### 成功率指标
- **数据捕获成功率**: 目标 ≥ 95%
- **对比分析成功率**: 目标 ≥ 90%
- **修正处理成功率**: 目标 ≥ 85%

### 性能指标
- **平均数据捕获时间**: 目标 ≤ 100ms
- **平均对比分析时间**: 目标 ≤ 200ms
- **平均修正处理时间**: 目标 ≤ 150ms

### 质量指标
- **数据完整性评分**: 目标 ≥ 85/100
- **修正效果评分**: 目标 ≥ 80/100
- **系统可靠性评分**: 目标 ≥ 90/100

## 测试步骤

### 1. 环境准备
```bash
# 确保服务器运行在端口 3456
./rcc start

# 确保数据捕获目录存在
mkdir -p ~/.route-claude-code/database/captures/codewhisperer
```

### 2. 运行集成测试
```bash
# 执行完整系统测试
node test/functional/test-complete-data-capture-system.js

# 或者使用测试运行器
./test-runner.sh test/functional/test-complete-data-capture-system.js
```

### 3. 结果分析
测试完成后会生成：
- **综合报告**: `/tmp/complete-system-test/comprehensive-test-report-{timestamp}.json`
- **详细日志**: `/tmp/test-complete-data-capture-system.log`
- **控制台摘要**: 实时显示测试进度和结果

## 最近执行记录

### 2025-01-30 执行记录
- **执行时间**: 2025-01-30 14:30:00
- **执行状态**: 待执行
- **执行时长**: N/A
- **日志文件**: `/tmp/test-complete-data-capture-system-20250130-1430.log`

**测试结果**:
```json
{
  "totalRequests": 0,
  "successfulCaptures": 0,
  "successfulComparisons": 0,
  "successfulCorrections": 0,
  "performanceStats": {
    "avgCaptureTime": 0,
    "avgComparisonTime": 0,
    "avgCorrectionTime": 0
  },
  "qualityMetrics": {
    "dataCompletenessScore": 0,
    "correctionEffectivenessScore": 0,
    "systemReliabilityScore": 0
  },
  "issues": [],
  "recommendations": []
}
```

**发现问题**: 
- 尚未执行首次测试

**解决方案**:
- 需要先启动 Claude Code Router 服务
- 确保 CodeWhisperer 和 OpenAI provider 都已正确配置

## 历史执行记录

### 执行历史将在首次运行后记录

## 相关文件
- **测试脚本**: `/Users/fanzhang/Documents/github/claude-code-router/test/functional/test-complete-data-capture-system.js`
- **数据捕获模块**: `/Users/fanzhang/Documents/github/claude-code-router/src/providers/codewhisperer/data-capture.ts`
- **对比分析引擎**: `/Users/fanzhang/Documents/github/claude-code-router/src/providers/comparison/analysis-engine.ts`
- **修正机制**: `/Users/fanzhang/Documents/github/claude-code-router/src/providers/comparison/correction-engine.ts`
- **配置文件**: `/Users/fanzhang/Documents/github/claude-code-router/config/comparison-config.json`

## 故障排除

### 常见问题

1. **数据捕获失败**
   - 检查数据捕获目录权限
   - 验证 CodeWhisperer client 是否正确集成数据捕获钩子
   - 查看详细错误日志

2. **对比分析失败**
   - 确认 OpenAI provider 可用
   - 检查对比分析配置参数
   - 验证捕获数据的完整性

3. **修正机制异常**
   - 检查修正规则配置
   - 验证修正置信度阈值设置
   - 查看修正策略的执行日志

4. **性能问题**
   - 监控系统资源使用情况
   - 调整并发处理参数
   - 优化数据存储和访问策略

### 调试建议

1. **启用详细日志**
   ```bash
   # 设置环境变量启用调试模式
   export DEBUG=true
   export LOG_LEVEL=debug
   ```

2. **单独测试各组件**
   ```bash
   # 测试数据捕获
   node test/functional/test-codewhisperer-data-capture.js
   
   # 测试对比分析
   node test/functional/test-provider-comparison.js
   ```

3. **检查配置文件**
   ```bash
   # 验证配置文件格式
   node -e "console.log(JSON.parse(require('fs').readFileSync('config/comparison-config.json', 'utf8')))"
   ```

## 预期改进

### 短期改进 (1-2 周)
- [ ] 增加更多测试场景覆盖
- [ ] 优化数据捕获的性能开销
- [ ] 完善错误处理和重试机制

### 中期改进 (1-2 月)
- [ ] 实现智能修正规则学习
- [ ] 添加实时监控和告警功能
- [ ] 支持自定义测试场景配置

### 长期改进 (3-6 月)
- [ ] 建立完整的数据分析仪表板
- [ ] 实现跨 provider 的性能基准测试
- [ ] 开发自动化的系统优化建议

## 总结

这个完整数据捕获系统集成测试为 CodeWhisperer provider 提供了全面的质量保证机制，通过持续的监控、对比和修正，确保系统能够提供高质量、可靠的服务。测试结果将为系统优化和改进提供数据支持。