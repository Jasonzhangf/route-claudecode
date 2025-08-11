# 测试文件夹结构 - 2025-07-28 重构版

## 🎯 测试架构

根据新的路由架构，测试分为以下层次：

### 1. 单元测试 (unit/)
- **路由引擎测试**: `routing/engine.test.ts` - 测试新的类别路由逻辑
- **输入处理器测试**: `input/anthropic.test.ts` - 测试请求解析
- **Provider测试**: `providers/` - 测试各个provider的功能

### 2. 流水线测试 (pipeline/)
基于新的路由架构的完整流水线：

- **Step 1**: `test-step1-category-routing.js` - 测试类别判断逻辑
- **Step 2**: `test-step2-provider-mapping.js` - 测试provider+model映射  
- **Step 3**: `test-step3-live-api.js` - 测试实际API调用

### 3. 功能测试 (functional/)
- **工具调用测试**: 测试search类别的工具调用处理
- **长文本测试**: 测试longcontext类别的路由
- **思维模式测试**: 测试thinking类别的路由

### 4. 集成测试 (integration/)
- **端到端测试**: 完整的请求-响应流程
- **多供应商测试**: 测试不同provider之间的切换

## 🧹 清理状态 (2025-07-28)

### ✅ 已清理的废弃测试文件
以下基于旧架构的文件已被删除：
- `test/unit/routing/engine.test.ts` - 基于旧的rules和defaultProvider架构
- `test/test-stage2-routing.js` - 使用config.routing.defaultProvider结构
- `test/integration/codewhisperer-pipeline.test.ts.disabled` - 使用defaultProvider概念

### 📚 保留的测试文件
- **functional/**: 功能测试 (工具调用、多轮对话等)
- **integration/**: 集成测试 (端到端、供应商集成)
- **pipeline/**: 流水线测试 (当前3步骤流程)
- **archives/**: 历史数据参考 (不作为活跃测试使用)

## 🔄 新测试规范

### 测试命名
- `test-[功能描述].js` + `test-[功能描述].md`
- 每个测试都有对应的文档说明

### 测试内容
1. **明确的测试目标**
2. **预期输入输出**
3. **测试结果记录**
4. **相关日志文件路径**

### 运行方式
使用统一的测试运行器：`./test-runner.sh`