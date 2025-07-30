# CodeWhisperer多token轮询系统测试

## 测试用例
验证CodeWhisperer provider的多token自动轮询、负载均衡和故障切换机制

## 测试目标
1. **多token配置验证**: 确认系统正确加载多个token配置
2. **轮询策略验证**: 验证health_based策略的token选择逻辑
3. **负载均衡验证**: 多并发请求的token分配是否均匀
4. **故障切换验证**: Token失效时自动切换到其他可用token
5. **统计信息验证**: Token使用统计和健康状态监控

## 测试配置
```json
{
  "tokenRotation": {
    "strategy": "health_based",
    "cooldownMs": 5000,
    "maxRetriesPerToken": 2,
    "tempDisableCooldownMs": 300000,
    "maxRefreshFailures": 3,
    "refreshRetryIntervalMs": 60000
  },
  "authentication": {
    "credentials": {
      "tokenPath": [
        "~/.aws/sso/cache/kiro-auth-token_zcam.json",
        "~/.aws/sso/cache/kiro-auth-token.json"
      ]
    }
  }
}
```

## 最近执行记录

### 执行时间: [待更新]
- **状态**: [待执行]
- **执行时长**: [待更新]
- **日志文件**: `/tmp/test-codewhisperer-token-rotation.log`
- **报告文件**: [待生成]

## 历史执行记录

### 2025-07-30 23:32:00
- **状态**: 创建测试用例
- **说明**: 新建CodeWhisperer多token轮询系统测试，包含4个子测试用例
- **相关修改**: 
  - 集成TokenRotationManager到CodeWhispererClient
  - 更新配置文件支持多token数组格式
  - 添加tokenRotation配置项到ProviderConfig类型

## 相关文件
- **测试脚本**: `test/functional/test-codewhisperer-token-rotation.js`
- **Token管理器**: `src/providers/codewhisperer/token-rotation-manager.ts`
- **Client集成**: `src/providers/codewhisperer/client.ts`
- **配置文件**: `~/.route-claude-code/config.json`
- **类型定义**: `src/types/index.ts`

## 预期结果
- ✅ 基础请求成功：验证单个请求的token获取和使用
- ✅ 工具调用成功：验证复杂请求的token rotation
- ✅ 负载均衡正常：多并发请求的token分配均匀
- ✅ 统计信息可获取：Token使用情况和健康状态可监控

## 故障排查
如果测试失败，检查以下项目：
1. **Token文件存在性**: 确认配置的token文件路径存在且可读
2. **Token有效性**: 验证token未过期且有效
3. **ProfileArn正确性**: 确认profileArn配置与token匹配
4. **网络连接**: 检查到CodeWhisperer API的网络连接
5. **配置格式**: 验证tokenRotation配置格式正确