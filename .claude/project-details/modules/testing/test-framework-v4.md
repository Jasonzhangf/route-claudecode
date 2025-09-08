# RCC v4.0 测试框架文档

## 概述

RCC v4.0 测试框架是一个完整的自动化测试系统，用于验证 Claude Code Router v4.0 的功能正确性、性能表现和与 Claude Code Router 的兼容性。该框架包括测试用例、自动化脚本和比较验证机制。

## 测试架构

### 六层测试架构

```
测试客户端 → 测试运行器 → RCC v4.0 服务 → 转换验证 → 比较分析 → 报告生成
     ↓           ↓           ↓           ↓         ↓         ↓
   Jest      Shell脚本    Transformer   CCR对比   差异分析    Markdown报告
```

### 核心组件

1. **测试用例** - 覆盖所有转换场景的 Jest 测试文件
2. **测试运行器** - 自动化执行测试的 Shell 脚本
3. **比较系统** - RCC v4.0 与 Claude Code Router 结果对比
4. **修复验证** - 自动修复功能验证机制
5. **报告生成** - 详细的测试和比较报告

## 测试用例

### 基本转换测试 (basic-transformer.test.ts)

验证基础的 Anthropic 到 OpenAI 格式转换功能：

- 简单消息转换
- 系统消息处理
- 多轮对话转换
- 参数保留验证

### 工具调用转换测试 (tool-calling-transformer.test.ts)

验证工具调用相关的转换功能：

- 工具定义转换 (tools → functions)
- 工具使用转换 (tool_use → tool_calls)
- 工具结果转换 (tool_result → tool)

### 流式协议测试 (streaming-protocol.test.ts)

验证流式传输相关的转换功能：

- 流式请求处理
- 流式参数保留
- 流式工具调用支持

### 复杂场景测试 (complex-scenarios.test.ts)

验证复杂场景的转换功能：

- 嵌套内容块处理
- 混合内容与工具调用
- 复杂工具使用序列
- 边缘情况处理

## 自动化脚本

### 测试套件运行器 (run-test-suite.sh)

执行完整的测试套件并生成报告：

```bash
npm run test:all
```

功能：
- 检查依赖和服务状态
- 运行所有测试用例
- 生成测试报告
- 错误处理和状态反馈

### 比较报告生成器 (generate-comparison-report.sh)

比较 RCC v4.0 与 Claude Code Router 的转换结果：

```bash
npm run test:compare
```

功能：
- 验证两个服务的可用性
- 执行测试用例并收集结果
- 生成详细的比较报告
- 差异分析和匹配率统计

### 修复验证器 (verify-fixes.sh)

验证自动修复功能的正确性：

```bash
npm run test:verify
```

功能：
- 运行修复验证模式
- 生成修复建议
- 验证修复效果

## 使用方法

### 运行测试

```bash
# 运行所有测试
npm run test:all

# 运行特定测试
npm run test:basic
npm run test:tools
npm run test:streaming
npm run test:complex

# 生成比较报告
npm run test:compare

# 验证修复功能
npm run test:verify
```

### 启动测试环境

```bash
# 启动测试环境
./scripts/start-test-environment.sh

# 停止测试环境
./scripts/stop-test-environment.sh

# 统一测试环境管理
./scripts/test-environment.sh [start|stop|status|restart]
```

### 自动修复

```bash
# 应用自动修复
npm run fix:auto

# 验证修复（不应用）
npm run fix:verify

# 预览修复（dry-run）
npm run fix:dry-run
```

## 测试配置

### 端口配置

- RCC v4.0 服务端口: 5511
- Claude Code Router 端口: 5510

### 环境变量

```bash
# 测试环境配置
export TEST_RCC_PORT=5511
export TEST_CCR_PORT=5510
export TEST_OUTPUT_DIR=test-results
export TEST_REPORT_FORMAT=markdown
```

## 报告格式

### 测试报告

生成位置: `test-results/test-report-YYYYMMDD-HHMMSS.md`

内容包括：
- 测试环境信息
- 各项测试结果状态
- 详细测试结果摘要

### 比较报告

生成位置: `test-results/comparison/comparison-report-YYYYMMDD-HHMMSS.md`

内容包括：
- 测试用例输入
- RCC v4.0 和 CCR 输出对比
- 差异分析
- 匹配率统计

### 修复报告

生成位置: `test-results/fixes/fix-report-YYYYMMDD-HHMMSS.md`

内容包括：
- 修复建议
- 修复前后对比
- 修复效果验证

## 集成开发流程

### 开发循环

1. **编写代码** - 实现新功能或修复
2. **运行测试** - 验证基本功能
3. **比较验证** - 与 CCR 对比结果
4. **应用修复** - 使用自动修复机制
5. **验证修复** - 确认修复效果
6. **生成报告** - 记录测试结果

### 持续集成

在 CI/CD 流程中集成：

```yaml
# GitHub Actions 示例
- name: Run RCC v4.0 Tests
  run: |
    npm run test:all
    npm run test:compare
    npm run test:verify
```

## 最佳实践

### 测试编写

1. **覆盖所有场景** - 确保测试用例覆盖所有转换场景
2. **验证数据完整性** - 确保转换过程中数据不丢失
3. **边界条件测试** - 测试边缘情况和错误处理
4. **性能基准测试** - 监控转换性能

### 报告分析

1. **定期生成报告** - 持续监控转换质量
2. **差异分析** - 深入分析不匹配的原因
3. **趋势跟踪** - 跟踪匹配率的变化趋势
4. **问题修复** - 及时修复发现的问题

## 故障排除

### 常见问题

1. **服务未启动**
   - 确保 RCC v4.0 和 CCR 服务正在运行
   - 使用 `test-environment.sh` 管理服务

2. **端口冲突**
   - 检查端口配置
   - 修改 `package.json` 中的端口设置

3. **权限问题**
   - 确保脚本具有执行权限
   - 使用 `chmod +x` 设置权限

### 调试技巧

1. **手动测试**
   ```bash
   curl -X POST http://localhost:5511/transform \
     -H "Content-Type: application/json" \
     -d '{"model":"claude-3-opus-20240229","messages":[{"role":"user","content":"Hello"}]}'
   ```

2. **查看详细日志**
   ```bash
   # 查看测试输出
   cat test-results/comparison/*.json
   ```

3. **运行单个测试**
   ```bash
   npx jest src/__tests__/basic-transformer.test.ts --verbose
   ```

## 扩展开发

### 添加新测试用例

1. 创建新的测试文件
2. 在 `package.json` 中添加测试脚本
3. 更新 `run-test-suite.sh` 以包含新测试

### 添加新比较维度

1. 修改 `generate-comparison-report.sh`
2. 添加新的测试用例
3. 更新报告生成逻辑

### 增强修复功能

1. 修改 `auto-fix.sh` 脚本
2. 添加新的修复规则
3. 更新验证逻辑