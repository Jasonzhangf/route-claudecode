# Gemini多API key轮询系统测试

## 测试用例
验证Gemini provider的多API key自动轮询、负载均衡和故障切换机制

## 测试目标
1. **多API key配置验证**: 确认系统正确加载多个API key配置
2. **轮询策略验证**: 验证round_robin/health_based策略的API key选择逻辑
3. **负载均衡验证**: 多并发请求的API key分配是否均匀
4. **故障切换验证**: API key失效或rate limit时自动切换到其他可用key
5. **统计信息验证**: API key使用统计和健康状态监控

## 测试配置
```json
{
  "keyRotation": {
    "strategy": "round_robin",
    "cooldownMs": 1000,
    "maxRetriesPerKey": 2,
    "rateLimitCooldownMs": 30000
  },
  "authentication": {
    "credentials": {
      "apiKey": [
        "key1",
        "key2", 
        "key3"
      ]
    }
  }
}
```

## 最近执行记录

### 执行时间: [待更新]
- **状态**: [待执行]
- **执行时长**: [待更新]
- **日志文件**: `/tmp/test-gemini-api-key-rotation.log`
- **报告文件**: [待生成]

## 历史执行记录

### 2025-07-30 23:40:00
- **状态**: 创建测试用例
- **说明**: 新建Gemini多API key轮询系统测试，包含5个子测试用例
- **相关修改**: 
  - 为GeminiClient集成ApiKeyRotationManager
  - 添加API key轮询、重试和故障切换逻辑
  - 更新类型系统支持keyRotation配置

## 相关文件
- **测试脚本**: `test/functional/test-gemini-api-key-rotation.js`
- **Gemini Client**: `src/providers/gemini/client.ts`
- **API Key管理器**: `src/providers/openai/api-key-rotation.ts`
- **配置文件**: `~/.route-claude-code/config.json`
- **类型定义**: `src/types/index.ts`

## 预期结果
- ✅ Rotation Manager初始化成功：验证多API key轮询管理器正常创建
- ✅ Gemini Client配置成功：验证客户端正确集成轮询功能
- ✅ Key轮询策略正常：验证不同策略的API key选择和负载均衡
- ✅ 并发请求均衡：多并发请求的API key分配均匀
- ✅ 错误处理和故障切换：API key失效时正确切换到备用key

## 故障排查
如果测试失败，检查以下项目：
1. **API Key有效性**: 确认配置的API key有效且未过期
2. **网络连接**: 检查到Gemini API的网络连接
3. **Rate Limit**: 验证API key的rate limit状态
4. **配置格式**: 验证keyRotation配置格式正确
5. **依赖模块**: 确认ApiKeyRotationManager模块正确导入