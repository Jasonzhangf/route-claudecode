# Gemini工具调用流水线调试系统

## 测试用例
深度分析Anthropic → Gemini工具调用转换流程，定位空响应问题根本原因

## 测试目标
- 全面分析工具调用转换流水线的每个环节
- 对比当前实现与Gemini官方文档要求的差异
- 识别导致空响应的具体原因
- 提供完整的修复方案和验证机制

## 调试流水线设计

### 6阶段完整调试流程

#### Stage 1: Anthropic工具定义分析
- **目标**: 分析标准Anthropic工具格式和复杂JSON Schema
- **输出**: `anthropic-tools.json` - 包含不支持字段的完整工具定义
- **验证点**: 识别Gemini不支持的字段(`$schema`, `additionalProperties`, `minLength`)

#### Stage 2: 当前转换逻辑测试  
- **目标**: 测试现有`convertToGeminiFormat()`方法的转换结果
- **输出**: `gemini-conversion-analysis.json` - 转换前后对比和字段分析
- **验证点**: 工具格式是否为数组、`functionDeclarations`结构、字段清理效果

#### Stage 3: 官方格式对比分析
- **目标**: 将当前转换结果与Gemini官方文档格式进行精确对比
- **输出**: `format-comparison.json` - 详细差异分析和潜在问题
- **验证点**: 结构正确性、不支持字段残留、格式兼容性

#### Stage 4: 直接Gemini API测试
- **目标**: 使用官方格式直接调用Gemini API验证基础可用性
- **输出**: `direct-api-result.json` - 原始API响应和成功率
- **验证点**: API密钥有效性、工具格式接受度、响应内容完整性

#### Stage 5: 完整Router流程测试
- **目标**: 测试通过Claude Code Router的端到端工具调用流程
- **输出**: `full-pipeline-result.json` - 完整请求响应和问题诊断
- **验证点**: 路由正确性、转换完整性、响应内容完整性

#### Stage 6: 综合诊断报告
- **目标**: 汇总所有阶段发现，生成具体修复建议
- **输出**: `comprehensive-diagnosis.json` - 完整诊断报告和优先修复项
- **验证点**: 问题根因定位、修复优先级、行动计划

## 数据捕获机制

### 调试数据存储
- **路径**: `/tmp/gemini-tool-debug-{timestamp}/`
- **结构化保存**: 每个阶段独立JSON文件
- **完整追踪**: 从原始请求到最终响应的完整数据链

### 问题诊断矩阵
```javascript
// 问题类型与阶段映射
{
  "format_conversion": "Stage 2-3 差异分析",
  "api_integration": "Stage 4 直接API测试", 
  "response_handling": "Stage 5 完整流程",
  "conversion_logic": "Stage 2+4+5 对比分析"
}
```

## 自动化问题定位

### 智能诊断逻辑
1. **Stage 4成功 + Stage 5失败** → 转换逻辑问题
2. **Stage 3发现格式差异** → JSON Schema兼容性问题  
3. **Stage 4失败** → API密钥或基础配置问题
4. **所有阶段成功但响应为空** → Content Safety或配额问题

### 修复建议优先级
- **Critical**: 直接API成功但Router失败
- **High**: 格式转换错误、API调用失败、空响应
- **Medium**: 性能优化、错误处理改进

## 最近执行记录

### 执行状态
- **时间**: 待执行
- **状态**: 测试脚本已创建，等待执行
- **日志文件**: 执行时动态生成
- **输出目录**: `/tmp/gemini-tool-debug-{timestamp}/`

## 相关文件
- **测试脚本**: `test/functional/test-gemini-tool-call-pipeline-debug.js`
- **Gemini客户端**: `src/providers/gemini/client.ts`
- **工具转换方法**: `convertToGeminiFormat()`, `cleanJsonSchemaForGemini()`
- **响应转换**: `convertFromGeminiFormat()`

## 预期修复项

### 高优先级修复
1. **JSON Schema清理增强**
   ```typescript
   // 当前可能遗漏的不支持字段
   const unsupportedFields = ['$schema', 'additionalProperties', 'minLength', 'maxLength', 'format', 'minItems', 'maxItems'];
   ```

2. **空响应处理改进**
   ```typescript
   // 改进的默认响应
   if (content.length === 0) {
     content.push({
       type: 'text', 
       text: 'I apologize, but I cannot generate a response at the moment. Please try rephrasing your question.'
     });
   }
   ```

3. **工具调用ID生成修复**
   ```typescript
   // 确保唯一性和格式正确
   id: `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
   ```

### 验证测试计划
1. 执行完整6阶段调试流程
2. 根据诊断报告实施修复
3. 重新执行验证修复效果
4. 创建回归测试防止问题复现

## 扩展调试能力

### 数据重放机制
- 保存每阶段的原始数据用于问题重现
- 支持单独重放任意阶段进行问题定位
- 提供修复前后对比验证

### 测试矩阵扩展
- 简单工具调用测试（单个参数）
- 复杂工具调用测试（嵌套对象、数组）
- 多工具并发调用测试
- 错误场景测试（无效参数、API限制）