# RCC v4.0 测试系统概述

## 系统组件

### 测试用例文件
- `src/__tests__/basic-transformer.test.ts` - 基本转换测试
- `src/__tests__/tool-calling-transformer.test.ts` - 工具调用转换测试
- `src/__tests__/streaming-protocol.test.ts` - 流式协议转换测试
- `src/__tests__/complex-scenarios.test.ts` - 复杂场景测试

### 自动化脚本
- `scripts/run-test-suite.sh` - 测试套件运行器
- `scripts/generate-comparison-report.sh` - 比较报告生成器
- `scripts/verify-fixes.sh` - 修复验证器
- `scripts/start-test-environment.sh` - 测试环境启动器
- `scripts/stop-test-environment.sh` - 测试环境停止器
- `scripts/test-environment.sh` - 统一测试环境管理器

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

## 使用流程

### 1. 启动测试环境
```bash
./scripts/start-test-environment.sh
# 或
./scripts/test-environment.sh start
```

### 2. 运行测试
```bash
# 运行所有测试
npm run test:all

# 运行特定测试
npm run test:basic
npm run test:tools
npm run test:streaming
npm run test:complex
```

### 3. 生成比较报告
```bash
npm run test:compare
```

### 4. 验证修复
```bash
npm run test:verify
```

### 5. 停止测试环境
```bash
./scripts/stop-test-environment.sh
# 或
./scripts/test-environment.sh stop
```

## 文档参考

- [测试模块设计文档](project-details/modules/testing/README.md)
- [RCC v4.0 测试框架文档](project-details/modules/testing/test-framework-v4.md)
- [测试用例源代码](../src/__tests/)
- [自动化脚本](../scripts/)

## 端口配置

- RCC v4.0 服务: http://localhost:5511
- Claude Code Router: http://localhost:5510

## 报告位置

- 测试报告: `test-results/test-report-*.md`
- 比较报告: `test-results/comparison/comparison-report-*.md`
- 修复报告: `test-results/fixes/fix-report-*.md`