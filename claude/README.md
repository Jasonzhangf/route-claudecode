# Claude Code Router 设计文档

## 概述

本文档包含了Claude Code Router v4.0的核心设计和实现细节，包括四层流水线架构、双向转换机制、协议兼容性处理和测试计划。

## 目录结构

```
claude/
├── pipeline-system-design.md          # 流水线系统设计
├── bidirectional-conversion-design.md # 双向转换机制设计
├── bidirectional-conversion-config.json # 双向转换配置
├── protocol-conversion-analysis.md    # 协议转换字段分析
├── openai-protocol-compatibility.md   # OpenAI协议兼容性处理
├── bidirectional-conversion-test-plan.md # 双向转换测试计划
scripts/
├── rcc-test-runner.sh                 # 测试系统启动脚本
test/
├── test-cases.json                    # 测试用例
```

## 核心文档

### 1. 流水线系统设计
文件：`pipeline-system-design.md`

详细描述了Claude Code Router的四层流水线架构：
- Transformer层：Anthropic ↔ OpenAI协议转换
- Protocol层：协议内控制和流式处理
- ServerCompatibility层：Provider特定兼容性处理
- Server层：HTTP请求处理

### 2. 双向转换机制设计
文件：`bidirectional-conversion-design.md`

描述了各层的双向转换实现：
- Transformer模块：请求和响应的双向转换
- ServerCompatibility模块：Provider特定的双向兼容性处理
- Protocol模块：协议内控制的双向处理

### 3. 协议转换分析
文件：`protocol-conversion-analysis.md`

详细分析了Anthropic到OpenAI的字段映射规则：
- 基本字段转换规则
- 消息格式转换
- 工具格式转换
- Provider特定处理

### 4. 协议兼容性处理
文件：`openai-protocol-compatibility.md`

描述了各Provider的兼容性处理实现：
- iFlow兼容性处理
- Qwen兼容性处理
- ModelScope兼容性处理

### 5. 测试计划
文件：`bidirectional-conversion-test-plan.md`

完整的测试计划，包括：
- 各层单元测试
- 集成测试
- 端到端测试
- 性能测试
- 错误处理测试

## 配置文件

### 双向转换配置
文件：`bidirectional-conversion-config.json`

定义了各层的转换规则和方法。

## 测试系统

### 启动脚本
文件：`scripts/rcc-test-runner.sh`

用于启动完整的测试系统。

### 测试用例
文件：`test/test-cases.json`

包含各种测试场景的测试用例。

## 使用说明

### 查看设计文档
直接打开相应的Markdown文件查看详细设计。

### 运行测试
```bash
chmod +x scripts/rcc-test-runner.sh
./scripts/rcc-test-runner.sh
```

### 配置管理
修改`bidirectional-conversion-config.json`来调整转换规则。