# Qwen-only 测试输出目录

此目录用于存储 Qwen Provider 专用测试的输出结果。

## 目录结构

- `startup-analysis/` - 启动流程分析测试输出
- `e2e-pipeline/` - 端到端流水线测试输出  
- `comparison-results/` - RCC v4.0 vs CLIPROXYAPI 对比测试结果
- `template-adjustments/` - 模板字段调整测试输出

## 测试文件说明

### 启动流程分析输出文件
- `01-qwen-config-input.json` - 原始Qwen配置输入
- `02-config-preprocessor-analysis.json` - ConfigPreprocessor深度分析
- `03-routing-table-analysis.json` - 路由表结构分析
- `04-multi-key-config-analysis.json` - 多密钥配置分析
- `05-router-preprocessor-analysis.json` - RouterPreprocessor处理分析
- `06-pipeline-configs-analysis.json` - 流水线配置详细分析
- `07-qwen-compatibility-analysis.json` - Qwen兼容性分析
- `qwen-startup-analysis-report.json` - 完整启动分析报告

### 端到端流水线测试输出文件
- `e2e-pipeline-request.json` - 端到端测试请求
- `transformer-layer-output.json` - Transformer层输出
- `protocol-layer-output.json` - Protocol层输出
- `server-compatibility-output.json` - ServerCompatibility层输出
- `server-layer-output.json` - Server层输出
- `response-transformer-output.json` - 响应转换器输出
- `multi-key-rotation-test.json` - 多密钥轮询测试
- `error-handling-test.json` - 错误处理测试
- `e2e-pipeline-report.json` - 端到端测试报告

### 对比测试结果输出文件
- `rcc-v4-responses.json` - RCC v4.0 响应结果
- `cliproxy-responses.json` - CLIPROXYAPI 对比结果
- `comparison-analysis.json` - 详细对比分析
- `performance-comparison.json` - 性能对比分析
- `field-mapping-analysis.json` - 字段映射分析
- `optimization-recommendations.json` - 优化建议
- `comparison-summary-report.json` - 对比测试总结报告

### 模板字段调整测试输出文件
- `field-mapping-test.json` - 字段映射测试
- `tool-format-adjustment.json` - 工具格式调整测试
- `parameter-optimization.json` - 参数优化测试
- `type-conversion-test.json` - 类型转换测试
- `compatibility-adjustment.json` - 兼容性调整测试
- `adjustment-recommendations.json` - 调整建议

## 使用说明

1. 运行测试后，相应的输出文件将自动生成在对应子目录中
2. 每个测试运行前会清理之前的输出文件
3. 所有输出文件为JSON格式，便于分析和处理
4. 测试报告包含详细的分析数据、性能指标和优化建议

## 测试验证

每个测试都会验证：
- 输出文件的存在性
- 数据结构的完整性
- 处理性能的合理性
- 转换准确性的有效性

## 注意事项

- 测试输出文件仅供分析使用，不应直接用于生产环境
- 所有敏感信息（如API密钥）在输出中会被脱敏处理
- 测试结果基于当前配置和系统状态，不同环境可能产生不同结果