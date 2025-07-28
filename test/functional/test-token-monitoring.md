# Token Monitoring Test

## 测试用例
验证监控式token管理系统的失效检测和API阻塞功能

## 测试目标
- 验证正常请求在token有效时能成功执行
- 验证token失效时是否正确阻塞API调用并返回500错误
- 验证10分钟冷却期机制是否生效
- 验证不同路由类别的token监控行为

## 最近执行记录

### 执行时间: 2025-07-28 待执行
**状态**: 待执行
**执行时长**: 待测试
**日志文件**: 待生成

**测试内容**:
1. 服务器健康检查
2. 状态检查确认providers可用
3. 正常请求测试 (claude-sonnet-4-20250514)
4. 后台路由请求测试 (claude-3-5-haiku-20241022)

**预期结果**:
- 服务器应正常响应健康检查
- token有效时请求应成功
- token失效达到3次后应返回500错误并阻塞后续调用
- 错误消息应包含"blocked due to consecutive authentication failures"

## 历史执行记录
暂无

## 相关文件
- 测试脚本: `test/functional/test-token-monitoring.js`
- 日志文件: `/tmp/test-token-monitoring-*.log` (执行后生成)
- 相关源码: `src/providers/codewhisperer/auth.ts`, `src/providers/codewhisperer/client.ts`