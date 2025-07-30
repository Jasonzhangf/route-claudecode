# Provider Comparison Test

## 测试用例
对比 CodeWhisperer 与 OpenAI 两个 provider 的响应差异，并验证修正机制的效果

## 测试目标
1. 发送相同请求到两个不同的 provider
2. 分析响应数据的完整性和准确性
3. 识别响应格式、内容和结构的差异
4. 验证自动修正机制的效果
5. 生成详细的质量评估报告

## 测试场景
- **简单文本生成**: 测试基础响应质量
- **复杂推理**: 测试长文本响应的一致性
- **工具调用**: 验证工具调用格式的差异处理
- **长上下文**: 测试大文本处理能力

## 最近执行记录

### 执行时间: 2025-07-30 (初始创建)
- **状态**: 🆕 新建
- **执行时长**: N/A
- **测试结果**: 待执行
- **日志文件**: N/A

## 历史执行记录
*暂无历史记录*

## 相关文件
- **测试脚本**: `/Users/fanzhang/Documents/github/claude-code-router/test/functional/test-provider-comparison.js`
- **测试文档**: `/Users/fanzhang/Documents/github/claude-code-router/test/functional/test-provider-comparison.md`
- **输出目录**: `/tmp/provider-comparison-test/`

## 测试配置
```json
{
  "localRouterUrl": "http://localhost:3456",
  "testCases": 4,
  "outputDir": "/tmp/provider-comparison-test",
  "timeout": 30000
}
```

## 预期输出
1. **对比分析报告**: 每个测试用例的详细差异分析
2. **修正结果**: 应用修正机制后的改进效果
3. **质量评分**: 0-100 的响应质量评分
4. **性能对比**: 两个 provider 的响应时间对比
5. **改进建议**: 基于分析结果的具体改进建议

## 测试指标
- **成功率**: 所有测试用例的通过率
- **平均质量分数**: 响应质量的平均评分
- **差异数量**: 发现的响应差异总数
- **修正数量**: 成功应用的修正总数
- **性能对比**: CodeWhisperer vs OpenAI 响应时间

## 执行方法
```bash
# 直接执行
node test/functional/test-provider-comparison.js

# 或使用测试运行器
./test-runner.sh test/functional/test-provider-comparison.js
```

## 注意事项
1. 确保本地路由服务器在端口 3456 运行
2. 确保 CodeWhisperer 和 OpenAI provider 都已正确配置
3. 测试结果保存在 `/tmp/provider-comparison-test/` 目录
4. 每次运行会生成带时间戳的详细报告文件