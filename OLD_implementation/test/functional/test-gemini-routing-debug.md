# test-gemini-routing-debug

## 测试用例
验证请求是否正确路由到Gemini provider而不是被错误路由到CodeWhisperer

## 测试目标
1. 分析当前的路由配置文件，检查Gemini provider是否存在
2. 测试search类别请求（包含WebSearch工具）的路由行为
3. 测试longcontext类别请求（超长内容）的路由行为
4. 诊断路由配置问题的根本原因
5. 提供具体的修复建议

## 测试方法
1. **配置分析**: 读取~/.route-claude-code/config.json，检查providers和routing配置
2. **Search路由测试**: 发送包含WebSearch工具的请求，验证是否路由到Gemini
3. **LongContext路由测试**: 发送超长内容请求，验证是否路由到Gemini
4. **响应分析**: 解析SSE响应中的model字段，推断实际使用的provider
5. **问题诊断**: 对比预期路由和实际路由，识别配置问题

## 最近执行记录
- **时间**: 2025-07-31
- **状态**: 脚本已更新，待执行
- **执行时长**: N/A
- **日志文件**: 待生成

## 历史执行记录
- **初版**: 2025-07-31 - 创建完整的路由诊断脚本

## 相关文件
- **测试脚本**: `/Users/fanzhang/Documents/github/claude-code-router/test/functional/test-gemini-routing-debug.js`
- **配置文件**: `~/.route-claude-code/config.json`
- **路由引擎**: `/Users/fanzhang/Documents/github/claude-code-router/src/routing/engine.ts`

## 预期发现
基于当前配置分析，预期会发现：
1. **根本问题**: 所有路由类别（default、background、thinking、longcontext、search）都配置为路由到`codewhisperer-primary`
2. **缺失配置**: 配置中没有Gemini provider或者有Gemini provider但routing配置没有指向它
3. **路由错误**: search和longcontext请求被错误路由到CodeWhisperer，导致400错误

## 修复建议
1. **添加Gemini provider**: 如果配置中缺少Gemini provider，需要添加相应配置
2. **更新路由映射**: 将routing.search和routing.longcontext指向Gemini provider
3. **验证修复**: 重新运行测试确认路由正确

## 诊断流程
```
Step 1: 分析配置文件
├── 检查providers中是否有Gemini相关配置
├── 检查routing配置的映射关系
└── 识别配置问题

Step 2: 测试Search路由
├── 发送包含WebSearch工具的请求
├── 验证路由类别判断
└── 检查实际使用的provider

Step 3: 测试LongContext路由  
├── 发送超长内容请求（>45K tokens）
├── 验证路由类别判断
└── 检查实际使用的provider

Step 4: 问题总结
├── 对比预期vs实际路由结果
├── 提供具体的修复建议
└── 输出诊断报告
```