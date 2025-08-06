# CodeWhisperer测试套件

## 概述

这个目录包含了CodeWhisperer与demo3标准兼容性的完整测试套件，确保CodeWhisperer实现完全符合demo3的架构和接口标准。

## 测试文件

### 核心测试脚本
- `test-demo3-compatibility.js` - CodeWhisperer与demo3兼容性对比测试
- `test-pipeline-simulation.js` - CodeWhisperer流水线模拟测试

### 测试文档
- `test-demo3-compatibility.md` - 兼容性测试文档
- `test-pipeline-simulation.md` - 流水线测试文档

## 修复内容总结

### 🔧 Header一致性修复

#### 1. 增强HTTP客户端Header配置
```typescript
// 修复前：基础header
headers: {
  'Content-Type': 'application/json',
  'User-Agent': 'CodeWhisperer-Router/2.7.0'
}

// 修复后：完全符合demo3标准
headers: {
  'Content-Type': 'application/json',
  'User-Agent': 'CodeWhisperer-Router/2.7.0',
  'Accept': 'application/json',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive'
}
```

#### 2. 多种认证头支持
```typescript
// 修复前：单一Bearer Token
config.headers.Authorization = `Bearer ${token}`;

// 修复后：多种认证头，与demo3标准一致
config.headers.Authorization = `Bearer ${token}`;
if (profileArn) {
  config.headers['X-Profile-Arn'] = profileArn;
}
if (authMethod) {
  config.headers['X-Auth-Method'] = authMethod;
}
```

### 🔄 流水线集成修复

#### 1. 响应流水线集成
```typescript
// 修复前：直接使用parser处理
const events = this.parser.parseEvents(responseBuffer);
return this.parser.buildNonStreamResponse(events, anthropicReq.model);

// 修复后：集成响应流水线
const parsedResponse = this.parser.buildNonStreamResponse(events, anthropicReq.model);
const processedResponse = await this.responsePipeline.process(parsedResponse, pipelineContext);
return processedResponse;
```

#### 2. 流式响应流水线集成
```typescript
// 修复前：直接处理流式数据
this.processStreamLine(line, writeSSE);

// 修复后：通过流水线处理
const parsedData = this.parseStreamLine(line);
const processedData = await this.responsePipeline.process(parsedData, pipelineContext);
writeSSE('content_block_delta', { delta: { text: processedData.content } });
```

### 📋 对比模块测试创建

#### 1. 兼容性对比测试
- **功能**: 对比CodeWhisperer与demo3的响应差异
- **覆盖**: 基础文本、工具调用、流式处理、错误处理
- **评分**: 自动计算兼容性评分，识别主要差异

#### 2. 流水线模拟测试
- **功能**: 验证CodeWhisperer的完整流水线处理
- **阶段**: 6个流水线阶段的独立测试
- **场景**: 4种不同的处理场景测试

#### 3. 综合测试脚本
- **功能**: 统一执行所有测试并生成综合报告
- **分析**: 自动分析测试结果并提供改进建议
- **报告**: 生成详细的Markdown测试报告

## 执行方法

### 快速执行
```bash
# 执行综合测试
./scripts/test-codewhisperer-demo3-pipeline.js

# 单独执行兼容性测试
./tests/codewhisperer/test-demo3-compatibility.js

# 单独执行流水线测试
./tests/codewhisperer/test-pipeline-simulation.js
```

### 调试模式
```bash
# 启用详细日志
DEBUG=1 ./tests/codewhisperer/test-demo3-compatibility.js

# 指定日志级别
LOG_LEVEL=debug ./tests/codewhisperer/test-pipeline-simulation.js
```

## 测试结果

### 兼容性评分标准
- **90-100分**: 完全兼容，无需修改
- **80-89分**: 基本兼容，有小问题需要修复
- **70-79分**: 部分兼容，需要重要改进
- **<70分**: 兼容性不足，需要重大修复

### 流水线完整性标准
- **90-100分**: 流水线完整且高效
- **80-89分**: 基本完整，有性能问题
- **70-79分**: 部分完整，缺少关键阶段
- **<70分**: 流水线不完整，需要重大修复

## 日志和报告

### 日志目录
- `/tmp/codewhisperer-demo3-comparison/` - 兼容性测试日志
- `/tmp/codewhisperer-pipeline-simulation/` - 流水线测试日志
- `/tmp/codewhisperer-comprehensive-test/` - 综合测试日志

### 报告格式
- **兼容性报告**: `compatibility-report-[timestamp].md`
- **流水线报告**: `pipeline-report-[timestamp].md`
- **综合报告**: `comprehensive-report-[timestamp].md`

## 故障排除

### 常见问题
1. **demo3端点不可用**: 确保demo3服务正在运行在端口3000
2. **CodeWhisperer认证失败**: 检查Kiro认证token是否有效
3. **流水线阶段失败**: 检查是否实现了对应的调试端点
4. **测试超时**: 调整timeout配置或检查网络连接

### 调试建议
1. 查看详细日志文件了解具体错误
2. 使用DEBUG模式获取更多调试信息
3. 单独执行失败的测试用例
4. 检查服务器状态和配置

## 持续改进

### 定期执行
建议在以下情况执行测试：
- 修改CodeWhisperer相关代码后
- 更新demo3标准后
- 发布新版本前
- 定期健康检查

### 扩展测试
可以考虑添加的测试：
- 性能基准测试
- 并发处理测试
- 错误恢复测试
- 长时间运行测试

---
**创建时间**: 2025-08-06  
**维护者**: Jason Zhang  
**版本**: v1.0