# 测试文件组织结构

本目录包含了Claude Code Router项目的所有测试文件，按功能模块进行组织。

## 目录结构

```
tests/
├── pipeline/           # 响应处理流水线测试
├── utils/             # 工具函数测试
├── integration/       # 集成测试和端到端测试
└── README.md          # 本文件
```

## 测试分类

### 🔧 Pipeline Tests (`pipeline/`)
响应处理流水线相关的测试，包括工具调用检测、格式转换等。

- `test-unified-tool-call-detection-stress.js` - 统一工具调用检测压力测试
  - 测试滑动窗口检测算法
  - 覆盖流式和非流式响应
  - 包含84,600个测试案例
  - 测试12种不同的工具调用格式
  - 8种边界情况测试

### 🛠️ Utils Tests (`utils/`)
工具函数和辅助模块的测试。

- `test-tool-call-parsing-from-logs.js` - 基于真实日志数据的工具调用解析测试
- `test-intelligent-discovery.js` - 智能模型发现系统测试

### 🔗 Integration Tests (`integration/`)
集成测试和端到端测试，包括错误处理、特定问题修复等。

- `test-500-error-response.js` - 500错误响应处理测试
- `test-6689-error-handling.js` - 6689端口错误处理测试
- `test-shuaihong-models.js` - ShuaiHong模型测试
- `test-shuaihong-endpoint.js` - ShuaiHong端点测试
- `debug-6689-streaming-error.js` - 6689流式错误调试
- `debug-actual-data-flow.js` - 实际数据流调试
- `debug-stop-reason-trace.js` - 停止原因追踪调试
- `fix-6689-config.js` - 6689配置修复脚本
- `fix-6689-model-names.js` - 6689模型名称修复脚本
- 以及其他历史测试文件...

## 运行测试

### 运行单个测试
```bash
# 运行压力测试
node tests/pipeline/test-unified-tool-call-detection-stress.js

# 运行工具调用解析测试
node tests/utils/test-tool-call-parsing-from-logs.js

# 运行错误处理测试
node tests/integration/test-500-error-response.js
```

### 运行所有测试
```bash
# 如果有测试脚本配置
npm test

# 或者手动运行所有测试
find tests -name "test-*.js" -exec node {} \;
```

## 测试数据

测试使用的数据来源：
- 真实的API响应日志
- 模拟的工具调用格式
- 边界情况和异常场景
- 性能压力测试数据

## 测试覆盖范围

### 功能覆盖
- ✅ 工具调用检测和解析
- ✅ 滑动窗口算法
- ✅ 错误处理机制
- ✅ 格式转换
- ✅ 流式响应处理
- ✅ 模型发现和配置

### 场景覆盖
- ✅ 正常工具调用
- ✅ 跨块分割的工具调用
- ✅ 混合格式内容
- ✅ 错误和异常情况
- ✅ 性能压力场景
- ✅ 边界情况

## 测试结果分析

最新的压力测试结果显示：
- **非流式检测率**: 25.00%
- **流式检测率**: 24.37%
- **边界情况通过率**: 25.00%
- **总体漏检率**: 75.63%

### 主要问题
1. 混合格式工具调用检测准确率需要提升
2. 跨块分割处理需要优化
3. 边界情况处理需要增强

### 优化方向
1. 改进正则表达式匹配逻辑
2. 优化滑动窗口参数配置
3. 增强边界情况处理能力

## 贡献指南

### 添加新测试
1. 根据功能模块选择合适的目录
2. 使用描述性的文件名（如 `test-feature-name.js`）
3. 包含详细的测试说明和预期结果
4. 更新本README文件

### 测试命名规范
- `test-*.js` - 功能测试
- `debug-*.js` - 调试脚本
- `fix-*.js` - 修复脚本

### 测试质量要求
- 包含足够的测试案例覆盖
- 有清晰的成功/失败判断标准
- 提供详细的错误信息和调试输出
- 性能测试需要包含时间和资源使用统计

---

**最后更新**: 2025-08-06  
**版本**: v2.7.0  
**维护者**: Claude Code Router Team