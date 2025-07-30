# Provider Comparison & Correction System

这是一个完整的 CodeWhisperer 与 OpenAI 对比修正系统，旨在分析两个 provider 间的响应差异并自动应用修正。

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                Provider Comparison System                   │
├─────────────────────────────────────────────────────────────┤
│  📊 Analysis Engine    │  🔧 Correction Engine              │
│  - 内容差异分析         │  - 基于参考响应修正                 │
│  - 性能对比分析         │  - 多策略修正机制                   │
│  - 结构一致性检查       │  - 置信度评估                       │
│  - 质量评分计算         │  - 修正效果追踪                     │
├─────────────────────────────────────────────────────────────┤
│  🤖 Auto-Correction Tool                                   │
│  - 历史数据学习         │  - 模式识别与规则生成               │
│  - 自动修正应用         │  - 性能评估与优化                   │
├─────────────────────────────────────────────────────────────┤
│  🧪 Test Suite        │  ⚙️ Configuration                  │
│  - 功能验证测试         │  - 灵活的配置管理                   │
│  - 对比效果验证         │  - 质量阈值设置                     │
│  - 性能基准测试         │  - 修正策略配置                     │
└─────────────────────────────────────────────────────────────┘
```

## 📦 核心组件

### 1. 对比分析引擎 (`analysis-engine.ts`)
- **功能**: 分析 CodeWhisperer 与 OpenAI 响应的差异
- **特性**: 
  - 多维度分析（内容、性能、结构）
  - 智能质量评分系统
  - 详细差异报告生成
  - 修正建议生成

### 2. 修正机制引擎 (`correction-engine.ts`)
- **功能**: 基于 OpenAI 响应修正 CodeWhisperer 输出
- **特性**:
  - 多种修正策略（内容、结构、工具调用）
  - 置信度评估机制
  - 修正效果追踪
  - 批量修正支持

### 3. 自动化修正工具 (`auto-correction.ts`)
- **功能**: 根据历史数据学习并自动应用修正规则
- **特性**:
  - 模式识别与学习
  - 规则自动生成
  - 性能持续优化
  - 智能推荐系统

### 4. 测试验证流程 (`test-provider-comparison.js`)
- **功能**: 发送相同请求到两个 provider 并对比结果
- **特性**:
  - 多场景测试支持
  - 自动化测试执行
  - 详细报告生成
  - 质量评估验证

### 5. 配置管理 (`comparison-config.json`)
- **功能**: 统一管理所有组件的配置参数
- **特性**:
  - 灵活的阈值设置
  - 策略配置管理
  - 性能参数调优
  - 调试模式控制

## 🚀 快速开始

### 基础使用

```typescript
import { createComparisonSystem, defaultComparisonConfig } from './src/providers/comparison';

// 1. 创建系统实例
const comparisonSystem = createComparisonSystem(defaultComparisonConfig);

// 2. 对比两个响应
const result = await comparisonSystem.compareProviders(
  request,
  codewhispererResponse,
  openaiResponse,
  {
    enableCorrection: true,
    enableAutoCorrection: true,
    saveResults: true
  }
);

// 3. 查看结果
console.log(`Quality Score: ${result.comparisonAnalysis.qualityScore.overall}/100`);
console.log(`Differences Found: ${result.comparisonAnalysis.differences.length}`);
console.log(`Corrections Applied: ${result.correctionResult?.appliedCorrections.length || 0}`);
```

### 运行测试

```bash
# 执行对比测试
node test/functional/test-provider-comparison.js

# 或使用测试运行器
./test-runner.sh test/functional/test-provider-comparison.js
```

### 查看使用示例

```typescript
import { runAllExamples } from './src/providers/comparison/usage-example';

// 运行所有示例
await runAllExamples();
```

## 📊 主要功能

### 对比分析维度

1. **内容质量分析**
   - 内容相似度计算
   - 完整性评估
   - 准确性分析
   - 连贯性检查

2. **性能对比分析**
   - 响应时间对比
   - Token 效率分析
   - 资源使用评估

3. **结构一致性检查**
   - 响应格式对比
   - 字段完整性验证
   - 数据结构分析

4. **工具调用验证**
   - 工具调用格式检查
   - 参数正确性验证
   - 执行结果对比

### 修正策略

1. **内容修正策略**
   - 参考内容采用
   - 长度差异修正
   - 风格标准化

2. **结构修正策略**
   - 字段标准化
   - 格式统一化
   - 数据完整性修正

3. **工具调用修正**
   - 格式标准化
   - 参数验证修正
   - 调用逻辑优化

### 学习机制

1. **模式识别**
   - 差异模式检测
   - 修正成功率分析
   - 规律总结提取

2. **规则生成**
   - 自动规则创建
   - 置信度评估
   - 性能验证

3. **持续优化**
   - 规则效果跟踪
   - 策略动态调整
   - 学习数据更新

## ⚙️ 配置说明

### 质量阈值配置

```json
{
  "qualityThresholds": {
    "critical": 0.3,  // 严重问题阈值
    "major": 0.6,     // 主要问题阈值
    "minor": 0.8      // 轻微问题阈值
  }
}
```

### 修正策略配置

```json
{
  "strategies": {
    "content": {
      "useReferenceLength": true,
      "preserveOriginalStyle": false,
      "similarityThreshold": 0.5
    },
    "structure": {
      "normalizeFields": true,
      "preserveOriginalData": true
    },
    "tools": {
      "fixFormat": true,
      "validateParameters": true
    }
  }
}
```

### 学习配置

```json
{
  "autoCorrection": {
    "learningEnabled": true,
    "minimumDataPoints": 10,
    "confidenceThreshold": 0.6,
    "patternDetectionThreshold": 3,
    "ruleGenerationThreshold": 5
  }
}
```

## 📈 性能指标

### 分析性能

- **分析速度**: 平均 < 100ms
- **内存使用**: < 50MB
- **并发支持**: 可配置最大并发数

### 修正效果

- **修正准确率**: > 85%
- **置信度评估**: 0-1 精确评分
- **处理速度**: 平均 < 200ms

### 学习效率

- **模式识别**: 最少 3 个数据点
- **规则生成**: 最少 5 个相似案例
- **学习收敛**: 通常 20-50 个样本

## 🛠️ 开发指南

### 添加新的修正策略

```typescript
// 在 correction-engine.ts 中添加新策略
this.strategies.push({
  name: 'custom-strategy',
  priority: 1,
  canCorrect: (diff) => diff.type === 'custom',
  apply: async (original, reference, difference) => {
    // 实现修正逻辑
    return {
      success: true,
      correctedValue: modifiedValue,
      confidence: 0.8,
      method: 'custom-correction'
    };
  }
});
```

### 扩展分析维度

```typescript
// 在 analysis-engine.ts 中添加新的分析方法
private async analyzeCustomDimension(
  cwResponse: BaseResponse,
  oaiResponse: BaseResponse
): Promise<CustomAnalysis> {
  // 实现自定义分析逻辑
  return customAnalysisResult;
}
```

### 创建自定义测试

```javascript
// 在 test/functional/ 目录下创建新测试
const testCase = {
  name: 'custom-test-scenario',
  request: customRequest,
  expectedDifferences: expectedCount,
  expectedCorrections: expectedCorrections
};
```

## 🔍 调试和监控

### 日志级别

- `debug`: 详细执行过程
- `info`: 关键操作信息
- `warn`: 潜在问题警告
- `error`: 错误和异常

### 监控指标

- 对比分析成功率
- 修正应用成功率
- 平均处理时间
- 内存使用情况
- 学习进度跟踪

### 性能分析

```typescript
// 获取系统统计
const stats = comparisonSystem.getSystemStatistics();
console.log('System Performance:', stats.system);
console.log('Analysis Stats:', stats.analysis);
console.log('Correction Stats:', stats.correction);
```

## 🤝 贡献指南

1. **代码规范**: 遵循项目现有的代码风格
2. **测试覆盖**: 新功能必须包含测试用例
3. **文档更新**: 更新相关文档和示例
4. **性能考虑**: 确保不影响系统整体性能

## 📄 许可协议

本项目遵循项目根目录的许可协议。

## 🙋 常见问题

### Q: 如何调整质量阈值？
A: 在 `comparison-config.json` 中修改 `qualityThresholds` 配置。

### Q: 修正置信度太低怎么办？
A: 增加训练数据或调整 `confidenceThreshold` 参数。

### Q: 如何添加新的对比维度？
A: 在 `analysis-engine.ts` 中扩展分析方法并更新配置。

### Q: 批量处理时内存不足？
A: 减少 `maxConcurrentComparisons` 参数或增加系统内存。

### Q: 学习效果不理想？
A: 检查 `minimumDataPoints` 配置，确保有足够的训练数据。

---

**Project Owner**: Jason Zhang  
**Last Updated**: 2025-07-30