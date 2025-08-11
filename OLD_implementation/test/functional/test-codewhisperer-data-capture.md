# CodeWhisperer Data Capture Test

## 测试用例
验证 CodeWhisperer provider 的完整数据捕获系统是否正常工作

## 测试目标
- 验证数据捕获模块的正确安装和配置
- 测试多阶段数据捕获功能（认证、转换、HTTP、解析、工具调用）
- 验证数据存储和文件组织结构
- 测试分析工具的基本功能
- 确保捕获的数据完整性和可用性

## 测试步骤
1. **模块检查**: 验证数据捕获和分析模块是否存在
2. **目录结构**: 检查和创建必要的存储目录
3. **API请求**: 发送测试请求触发数据捕获
4. **文件生成**: 验证捕获文件是否正确生成
5. **内容分析**: 分析捕获文件的内容和结构
6. **分析工具**: 测试分析工具的基本功能
7. **清理测试**: 验证文件清理功能
8. **结果汇总**: 提供测试结果摘要

## 验证点
- ✅ 数据捕获模块文件存在
- ✅ 存储目录结构正确
- ✅ API请求成功执行
- ✅ 捕获文件正确生成
- ✅ 各阶段数据完整捕获
- ✅ 文件命名约定正确
- ✅ JSON格式有效
- ✅ 分析工具可用

## 最近执行记录

### 执行时间: [待测试]
- **状态**: [待执行]
- **执行时长**: [待测试]
- **日志文件**: [将在执行时生成]
- **捕获文件数量**: [待测试]
- **覆盖阶段**: [待测试]

## 历史执行记录
[待添加执行历史]

## 相关文件
- **测试脚本**: `test/functional/test-codewhisperer-data-capture.js`
- **数据捕获模块**: `src/providers/codewhisperer/data-capture.ts`
- **分析工具**: `src/providers/codewhisperer/analysis-tools.ts`
- **调试CLI**: `src/providers/codewhisperer/debug-cli.ts`

## 预期输出
```
🧪 CodeWhisperer Data Capture Test
=====================================
Request ID: test-capture-[timestamp]
Base URL: http://localhost:3456
Log file: /tmp/test-codewhisperer-data-capture-[timestamp].log

🔍 Step 1: Checking data capture module imports
✅ Data capture modules found

🔍 Step 2: Checking capture directory structure  
✅ Capture directory ready

🔍 Step 3: Testing basic API request with data capture
✅ API request successful

🔍 Step 4: Waiting for capture files to be written
🔍 Step 5: Checking for generated capture files
✅ Capture files generated

🔍 Step 6: Analyzing capture file contents
✅ Capture analysis complete

🔍 Step 7: Testing analysis tools
✅ Analysis tools test

🔍 Step 8: Testing capture cleanup (dry run)
✅ Cleanup test complete

🎉 All tests passed!
```

## 失败诊断
如果测试失败，检查以下内容：
1. **服务状态**: 确保 claude-code-router 服务正在运行
2. **端口配置**: 验证服务监听在正确端口 (3456)
3. **权限问题**: 检查文件系统写入权限
4. **模块依赖**: 确保所有必要的模块已正确安装
5. **网络连接**: 验证本地API请求可达性

## 数据捕获类型说明
- **AuthCaptureData**: 认证相关事件（token刷新、验证、失败）
- **ConversionCaptureData**: 格式转换数据（请求/响应转换）
- **HttpCaptureData**: HTTP层原始数据（请求/响应）
- **ParsingCaptureData**: 解析层中间数据（SSE解析、缓冲转换）
- **ToolCallCaptureData**: 工具调用修复数据（检测、修复、处理）

## 文件组织结构
```
~/.route-claude-code/database/captures/codewhisperer/
├── cw-auth-token_validation-[timestamp]-[requestId].json
├── cw-conversion-request_conversion-[timestamp]-[requestId].json  
├── cw-http-request_sent-[timestamp]-[requestId].json
├── cw-http-response_received-[timestamp]-[requestId].json
├── cw-parsing-sse_parsing-[timestamp]-[requestId].json
├── cw-parsing-buffered_conversion-[timestamp]-[requestId].json
└── cw-tool_processing-tool_call_detected-[timestamp]-[requestId].json
```