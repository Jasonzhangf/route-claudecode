# OpenAI API Key轮询系统

## 概述

Claude Code Router的OpenAI API Key轮询系统允许为单个provider配置多个API key，系统会自动轮询使用这些key来避免rate limit问题。当某个key遇到429错误时，系统会自动切换到下一个可用的key。

## 功能特性

### ✅ 已实现功能
- **多key配置**: 支持为单个provider配置多个API key
- **自动轮询**: 按配置的策略自动轮换API key使用
- **Rate limit检测**: 自动检测429错误并标记key为临时不可用
- **错误追踪**: 跟踪每个key的成功率和连续错误次数
- **策略选择**: 支持多种轮询策略 (round_robin, health_based, rate_limit_aware)
- **冷却机制**: key使用后的冷却时间，避免过于频繁使用
- **优雅降级**: 所有key不可用时自动重置状态尝试恢复

### 🎯 核心原则
按照用户要求："这个轮询系统目前采用最简单的方式，依次发送，平均发送"

## 配置方法

### 基本配置
```json
{
  "providers": {
    "provider-name": {
      "type": "openai",
      "endpoint": "https://api.openai.com/v1/chat/completions",
      "authentication": {
        "type": "bearer",
        "credentials": {
          "apiKey": [
            "sk-key1-xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            "sk-key2-yyyyyyyyyyyyyyyyyyyyyyyyyyyy", 
            "sk-key3-zzzzzzzzzzzzzzzzzzzzzzzzzzzz"
          ]
        }
      },
      "keyRotation": {
        "enabled": true,
        "strategy": "round_robin",
        "cooldownMs": 5000,
        "maxRetriesPerKey": 3
      }
    }
  }
}
```

### 配置参数说明

#### `authentication.credentials.apiKey`
- **类型**: `string | string[]`
- **说明**: 单个API key（字符串）或多个API key（数组）
- **示例**: 
  ```json
  "apiKey": "sk-single-key"  // 单个key
  "apiKey": ["sk-key1", "sk-key2", "sk-key3"]  // 多个key
  ```

#### `keyRotation` (可选)
当配置多个API key时，可以设置轮询参数：

- **`enabled`** (boolean, 默认: true)
  - 是否启用key轮询，设为false时使用第一个key
  
- **`strategy`** (string, 默认: "round_robin")
  - `"round_robin"`: 简单轮询，依次使用每个key
  - `"health_based"`: 基于成功率选择最健康的key
  - `"rate_limit_aware"`: 优先使用最久未使用的key，避免rate limit

- **`cooldownMs`** (number, 默认: 5000)
  - 单个key使用后的冷却时间（毫秒）
  - 在冷却期内该key不会被选择

- **`maxRetriesPerKey`** (number, 默认: 3) 
  - 单个key连续失败多少次后暂时禁用
  - 当所有key都被禁用时会自动重置

## 轮询策略详解

### Round Robin (轮询)
- **特点**: 最简单的策略，按顺序依次使用每个key
- **适用场景**: key质量相近，希望平均分配负载
- **实现**: 维护一个索引，每次请求后递增到下一个key

### Health Based (基于健康度)
- **特点**: 优先选择成功率高、错误少的key
- **适用场景**: key质量不同，希望优先使用稳定的key
- **实现**: 按成功率和错误次数排序选择最佳key

### Rate Limit Aware (避免rate limit)
- **特点**: 优先选择最久未使用的key，有效避免rate limit
- **适用场景**: 频繁请求场景，需要最大化避免429错误
- **实现**: 按最后使用时间和错误次数综合排序

## 工作流程

### 1. 初始化阶段
```
配置多个API key → 初始化ApiKeyRotationManager → 设置轮询策略
```

### 2. 请求处理阶段
```
收到请求 → 选择可用key → 发送请求 → 处理响应/错误
```

### 3. 错误处理阶段
```
检测到429错误 → 标记key为rate limited → 选择下一个key → 重试
连续错误达到阈值 → 暂时禁用key → 尝试其他key
所有key不可用 → 重置所有key状态 → 继续尝试
```

## 状态管理

### Key状态
每个API key维护以下状态信息：
- `isActive`: 是否可用
- `lastUsed`: 最后使用时间
- `consecutiveErrors`: 连续错误次数
- `successfulRequests`: 成功请求数
- `totalRequests`: 总请求数
- `rateLimitUntil`: Rate limit结束时间

### 自动恢复机制
- **Rate limit自动清除**: 成功请求后自动清除rate limit状态
- **错误状态重置**: 所有key不可用时自动重置错误状态
- **健康度更新**: 实时更新每个key的成功率和健康度

## 日志监控

### 关键日志事件
- **Key选择**: 记录选择的key（脱敏显示末4位）
- **Rate limit检测**: 记录429错误和冷却时间
- **Key状态变更**: 记录key禁用/启用事件
- **轮询统计**: 定期输出各key的使用统计

### 示例日志
```
[INFO] API key rotation manager initialized: keyCount=3, strategy=round_robin
[DEBUG] API key selected for use: keyIndex=1, consecutiveErrors=0
[WARN] API key marked with rate limit: keyIndex=1, rateLimitUntil=2025-07-30T13:45:30Z
[INFO] API key rate limit cleared due to successful request: keyIndex=1
```

## 最佳实践

### 1. Key配置建议
- 建议配置2-5个key，过多key会增加管理复杂度
- 确保所有key都有足够的rate limit额度
- 定期轮换key以保持安全性

### 2. 策略选择建议
- **开发测试**: 使用`round_robin`策略，简单可预测
- **生产环境**: 使用`rate_limit_aware`策略，最大化避免429错误
- **混合环境**: 使用`health_based`策略，自动适应key质量差异

### 3. 参数调优建议
- **cooldownMs**: 根据API提供商的rate limit政策调整，一般5-10秒
- **maxRetriesPerKey**: 设置为2-3次，避免过度重试单个key
- **定期监控**: 查看日志中的key使用统计，及时发现异常

## 兼容性

### 向后兼容
- 单个API key配置完全兼容现有配置
- 不配置`keyRotation`时使用默认轮询设置
- 现有provider（Anthropic, CodeWhisperer等）不受影响

### Provider支持
- ✅ **EnhancedOpenAIClient**: 完全支持key轮询
- ✅ **OpenAIClient**: 兼容多key配置（使用第一个key）
- ❌ **其他provider**: 暂不支持（使用第一个key）

## 故障排除

### 常见问题

**Q: 配置了多个key但只使用第一个？**
A: 检查provider类型是否为`openai`且使用`EnhancedOpenAIClient`

**Q: Key轮询频率太高？**  
A: 增加`cooldownMs`参数，建议5000ms以上

**Q: 所有key都显示rate limited？**
A: 检查API key额度，或等待系统自动重置状态

**Q: 轮询统计在哪里查看？**
A: 查看provider日志，包含详细的key使用统计

### 调试方法
1. 启用debug日志：`"logLevel": "debug"`
2. 查看key选择日志确认轮询是否正常
3. 监控429错误和重试情况
4. 检查各key的成功率统计

## 示例配置文件

完整的配置示例请参考：`docs/api-key-rotation-config-example.json`