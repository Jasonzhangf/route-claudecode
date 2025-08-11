# Universal Pipeline Debug Architecture for Gemini Tool Calling

## 测试用例
**一句话描述**: 实现Gemini工具调用流水线的通用调试架构，解决MALFORMED_FUNCTION_CALL和UNEXPECTED_TOOL_CALL错误

## 测试目标
通过建立完整的流水线调试基础设施，系统性地识别和修复Gemini API工具调用中的模式转换问题，特别是Anthropic `input_schema` → Gemini `parameters` 格式转换错误。

## 最近执行记录

### 2025-08-07 06:00:00 - 初始实现 - 状态：已完成
- **执行时长**: N/A (架构设计阶段)
- **状态**: 架构完成，待执行测试
- **日志文件**: `/test/debug/output/gemini-pipeline/debug-[timestamp]/`
- **关键发现**: 
  - 建立了7阶段通用流水线调试架构
  - 实现了层次化数据捕获系统
  - 创建了完整的测试矩阵生成器
  - 设计了阶段特定的回放机制

## 流水线调试架构详情

### 🏗️ 七阶段流水线设计
```
1. input-processing     → Anthropic格式输入验证
2. schema-conversion    → Anthropic → Gemini模式转换  
3. tool-config-setup   → Gemini toolConfig和functionDeclarations
4. api-request         → 原始Gemini API请求
5. api-response        → 原始Gemini API响应  
6. response-processing → 响应解析和错误处理
7. output-transformation → 最终输出格式化
```

### 🧪 测试矩阵覆盖范围

#### 基础转换测试 (basic_conversion)
- **simple-string-parameter**: 简单字符串参数转换
- **complex-nested-parameters**: 复杂嵌套参数结构

#### 模式清理测试 (schema_cleaning)  
- **remove-unsupported-fields**: 移除Gemini API不支持的字段
- 重点验证: `$schema`, `additionalProperties`, `minItems`, `maxItems` 的清理

#### 工具配置测试 (tool_config)
- **auto-mode-single-tool**: 单工具AUTO模式配置
- **auto-mode-multiple-tools**: 多工具配置验证

#### API请求格式测试 (api_request_format)
- **complete-gemini-request**: 完整Gemini请求结构验证

### 🔍 核心验证机制

#### 1. 模式转换验证 (`validateSchemaConversion`)
```javascript
// 模拟实际的convertTools方法逻辑
const converted = this.simulateConvertTools([tool]);
const validation = this.validateGeminiSchema(converted);
```

#### 2. JSON Schema清理验证 (`cleanJsonSchemaForGemini`)
```javascript
const supportedFields = ['type', 'properties', 'required', 'items', 'description', 'enum'];
// 递归清理不支持的字段
```

#### 3. 响应错误模式识别 (`validateApiResponse`)
```javascript
if (candidate.finishReason === 'MALFORMED_FUNCTION_CALL') {
  results.errorType = 'MALFORMED_FUNCTION_CALL';
  results.issues.push('Tool schema format is invalid for Gemini API');
}
```

### 🎬 回放系统设计

#### 阶段特定回放脚本
- `replay-input-processing.js` - 输入处理回放
- `replay-schema-conversion.js` - 模式转换回放  
- `replay-tool-config-setup.js` - 工具配置回放
- `replay-api-request.js` - API请求回放
- `replay-api-response.js` - API响应回放

#### 完整流水线回放
- `replay-full-pipeline.js` - 端到端流水线回放

### 📊 数据捕获机制

#### 层次化存储结构
```
/test/debug/output/gemini-pipeline/debug-[timestamp]/
├── input-processing/
├── schema-conversion/     ← 关键：模式转换数据
├── tool-config-setup/     ← 关键：工具配置数据
├── api-request/
├── api-response/          ← 关键：错误响应数据
├── response-processing/
├── output-transformation/
├── replay/                ← 回放脚本
├── test-matrix.json       ← 测试用例矩阵
├── problem-isolation-report.json ← 问题分析报告
└── EXECUTION-GUIDE.md     ← 使用指南
```

## 历史执行记录

### 待执行测试列表
1. **首次完整流水线测试** - 使用真实工具定义数据
2. **模式转换专项测试** - 重点验证`input_schema` → `parameters`转换
3. **错误模式重现测试** - 重现MALFORMED_FUNCTION_CALL场景
4. **修复验证测试** - 验证修复方案有效性

## 相关文件
- **测试脚本**: `/test/pipeline/test-gemini-tool-calling-pipeline-debug.js`
- **源代码分析**: `/src/providers/gemini/client.ts` (lines 1125-1198)
- **错误日志**: `/~/.route-claude-code/logs/port-5502/2025-08-07T06-57-19/system.log`

## 预期成果

### 🎯 问题定位精度
- 精确识别导致`MALFORMED_FUNCTION_CALL`的具体字段
- 确定`UNEXPECTED_TOOL_CALL`的配置问题根源
- 量化模式转换的兼容性问题

### 🔧 修复指导方案
1. **模式清理优化**: 完善`cleanJsonSchemaForGemini`方法
2. **工具配置调整**: 优化`toolConfig.functionCallingConfig`设置
3. **请求格式标准化**: 确保符合Gemini API规范
4. **错误处理增强**: 改进fallback机制

### 📈 测试覆盖率目标
- **模式转换**: 100%覆盖所有JSON Schema字段类型
- **工具配置**: 覆盖单/多工具、不同模式组合
- **错误模式**: 覆盖所有已知finishReason错误类型
- **回放验证**: 100%失败场景可重现

## 执行建议

### 优先级队列
1. **P0 - 立即执行**: 运行完整流水线测试，获取基线数据
2. **P1 - 关键分析**: 重点分析schema-conversion和tool-config-setup阶段
3. **P2 - 深度调试**: 使用回放脚本重现和验证修复方案
4. **P3 - 持续监控**: 建立长期监控机制，防止回归

### 执行命令
```bash
# 运行完整调试流水线
node test/pipeline/test-gemini-tool-calling-pipeline-debug.js

# 分析特定阶段
cd test/debug/output/gemini-pipeline/debug-[timestamp]/replay/
node replay-schema-conversion.js
node replay-tool-config-setup.js

# 查看问题分析报告
cat test/debug/output/gemini-pipeline/debug-[timestamp]/problem-isolation-report.json
```