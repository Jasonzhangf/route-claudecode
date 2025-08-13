# 自动化数据扫描和分析系统

## 测试用例
自动扫描捕获的数据文件夹，发现解析错误，生成修复建议的智能分析系统

## 测试目标
- 扫描所有配置的数据路径，发现相关文件
- 分析文件内容和工具调用模式
- 检测各种类型的解析问题
- 生成智能化的修复建议
- 创建自动化修复脚本
- 验证修复效果预期

## 核心功能

### 📁 数据扫描
- 递归扫描多个配置路径
- 智能过滤相关文件（JSON格式，包含lmstudio、openai、tool等关键字）
- 支持最大扫描深度控制，避免过度深入

### 🔬 模式分析
- 检测7种工具调用模式（standard, prefixed, function, json, bracket, openai_func, anthropic_tool）
- 统计模式分布和频率
- 识别模型和Provider信息
- 提取和分析响应文本内容

### 🚨 问题检测
支持5种解析问题检测：
1. **tool_calls_as_text**: 工具调用被错误处理为文本
2. **incomplete_parsing**: 不完整的解析（中断的JSON结构）
3. **format_mismatch**: 格式不匹配（请求与响应格式不一致）
4. **streaming_corruption**: 流式传输数据损坏
5. **json_structure_errors**: JSON结构错误

### 💡 智能建议
自动生成修复建议，包括：
- 优先级分类（critical, high, medium, low）
- 具体的解决方案描述
- 预期改善效果
- 估计工作量
- 实现文件路径

### 🔧 自动化修复
- 为每个建议生成对应的修复脚本
- 创建主修复脚本统一执行所有修复
- 支持修复效果验证和预测

## 配置路径
系统会扫描以下路径：
- `/Users/fanzhang/.route-claude-code/database/captures`
- `/Users/fanzhang/.route-claudecode/database/captures`
- `/Users/fanzhang/Documents/github/route-claudecode/test/output/functional/test-output`
- `/Users/fanzhang/Documents/github/route-claudecode/test/output/functional/test-lmstudio-data`

## 输出结果

### 📊 扫描报告
- **JSON详细报告**: 包含完整的分析数据和建议
- **Markdown可读报告**: 格式化的分析摘要，便于人工审阅
- **修复脚本集合**: 自动生成的修复脚本文件

### 📈 关键指标
- 扫描文件总数和相关文件数
- 工具调用模式分布统计
- 问题类型和频率统计
- 修复建议数量和优先级分布
- 预期修复效果评估

## 最近执行记录

### 执行时间: 待执行
- **状态**: 新建测试系统
- **执行时长**: 预计2-4分钟
- **日志文件**: 待生成

## 历史执行记录
- 无历史记录

## 相关文件
- **主测试脚本**: test/functional/test-automated-data-scanner.js
- **输出目录**: test/output/functional/
- **修复脚本目录**: test/output/functional/test-lmstudio-data/

## 使用方法

### 单独运行
```bash
node test/functional/test-automated-data-scanner.js
```

### 作为测试套件运行
```bash
node run-lmstudio-validation.js  # 包含此扫描器的完整验证
```

## 预期结果
- 成功扫描并分析所有可访问的数据文件
- 准确识别工具调用模式和解析问题
- 生成实用的修复建议和自动化脚本
- 提供清晰的可读性报告

## 故障排除
- **路径不可访问**: 检查数据库捕获目录是否存在
- **权限问题**: 确保有读取数据文件的权限
- **内存不足**: 大量文件时可能需要调整扫描限制
- **文件格式错误**: 会跳过无法解析的JSON文件并继续处理

## 扩展性
系统设计支持：
- 添加新的工具调用模式检测
- 扩展问题检测器类型
- 自定义修复建议逻辑
- 集成更多数据源路径