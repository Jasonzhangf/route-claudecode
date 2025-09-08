# RCC v4.0 测试系统完整文档索引

## 文档结构

### 核心测试文档
1. [测试模块设计文档](modules/testing/README.md) - 测试模块的整体设计和架构
2. [RCC v4.0 测试框架文档](modules/testing/test-framework-v4.md) - 专门针对V4版本的测试框架详细说明
3. [重构后的测试框架设计](modules/testing/refactored-test-framework.md) - 测试框架的重构设计和实现

### 测试用例源代码
- [基本转换测试](../../src/__tests__/basic-transformer.test.ts)
- [工具调用转换测试](../../src/__tests__/tool-calling-transformer.test.ts)
- [流式协议测试](../../src/__tests__/streaming-protocol.test.ts)
- [复杂场景测试](../../src/__tests__/complex-scenarios.test.ts)

### 自动化脚本
- [测试套件运行器](../../scripts/run-test-suite.sh)
- [比较报告生成器](../../scripts/generate-comparison-report.sh)
- [修复验证器](../../scripts/verify-fixes.sh)
- [测试环境管理器](../../scripts/test-environment.sh)

### npm 脚本命令
```bash
# 测试执行
npm run test:basic          # 运行基本转换测试
npm run test:tools          # 运行工具调用测试
npm run test:streaming      # 运行流式协议测试
npm run test:complex        # 运行复杂场景测试
npm run test:all            # 运行所有测试

# 比较和验证
npm run test:compare        # 生成 RCC v4.0 与 CCR 比较报告
npm run test:verify         # 验证自动修复功能

# 自动修复
npm run fix:auto            # 应用自动修复
npm run fix:verify          # 验证修复（不应用）
npm run fix:dry-run         # 预览修复
```

## 系统架构

### 测试类型覆盖
1. **单元测试** - 模块功能验证
2. **集成测试** - 模块间接口验证
3. **转换测试** - Anthropic到OpenAI格式转换验证
4. **端到端测试** - 完整请求处理流程验证
5. **性能测试** - 系统性能和响应时间评估
6. **比较测试** - 与Claude Code Router结果对比

### 核心功能
1. **自动化测试执行** - 一键运行所有测试
2. **结果比较验证** - RCC v4.0 与 CCR 兼容性验证
3. **自动修复机制** - 基于差异的自动修复建议
4. **详细报告生成** - Markdown格式的测试和比较报告
5. **环境管理** - 测试环境的启动、停止和管理

## 使用指南

### 快速开始
```bash
# 1. 启动测试环境
./scripts/test-environment.sh start

# 2. 运行所有测试
npm run test:all

# 3. 生成比较报告
npm run test:compare

# 4. 验证修复功能
npm run test:verify

# 5. 停止测试环境
./scripts/test-environment.sh stop
```

### 详细使用
请参考以下文档获取详细信息：
- [RCC v4.0 测试框架文档](modules/testing/test-framework-v4.md) - 完整的使用说明
- [测试模块设计文档](modules/testing/README.md) - 架构设计和接口定义

## 报告和输出

### 报告位置
- 测试报告: `test-results/test-report-*.md`
- 比较报告: `test-results/comparison/comparison-report-*.md`
- 修复报告: `test-results/fixes/fix-report-*.md`

### 输出验证
所有测试输出都经过严格验证，确保：
- 数据完整性
- 格式正确性
- 与预期结果的一致性
- 与Claude Code Router的兼容性

## 维护和扩展

### 添加新测试
1. 创建新的测试文件在 `src/__tests__/` 目录
2. 在 `package.json` 中添加相应的npm脚本
3. 更新 `run-test-suite.sh` 脚本
4. 更新相关文档

### 扩展比较维度
1. 修改 `generate-comparison-report.sh` 脚本
2. 添加新的测试用例
3. 更新报告生成逻辑

这个文档索引提供了RCC v4.0测试系统的完整视图，帮助开发者快速理解和使用测试系统。