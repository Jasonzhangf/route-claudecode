# Multi-Provider Routing Documentation

## 概述 (Overview)

Claude Code Router 现已支持完整的多Provider路由系统，包括主备路由、负载均衡、错误优先级回退和Provider健康监控。本文档详细介绍如何配置和使用这些高级路由功能。

## 核心功能特性

### ✅ 已实现功能

1. **主备路由 (Primary/Backup Routing)**
   - 支持传统的单主多备配置
   - 基于权重的优先级控制
   - 自动failover到健康的备用Provider

2. **多Provider负载均衡 (Multi-Provider Load Balancing)**
   - Round Robin轮询策略
   - 基于权重的选择策略
   - 基于健康状态的智能选择

3. **错误优先级回退 (Error Priority Fallback)**
   - 连续错误计数触发
   - HTTP错误代码识别 
   - 网络超时检测
   - 认证失败监控

4. **Provider健康监控 (Provider Health Monitoring)**
   - 实时错误计数和成功率跟踪
   - 自动健康状态评估
   - 冷却期机制防止频繁切换

## 配置格式详解

### 1. 传统主备配置 (Legacy Backup Configuration)

```json
{
  "routing": {
    "default": {
      "provider": "kiro-zcam",
      "model": "CLAUDE_SONNET_4_20250514_V1_0",
      "backup": [
        {
          "provider": "kiro-gmail",
          "model": "CLAUDE_SONNET_4_20250514_V1_0",
          "weight": 2
        }
      ]
    }
  }
}
```

**特点：**
- 简单的主备切换模式
- 主Provider失败时自动切换到备用
- 支持多个备用Provider和权重控制

### 2. 多Provider配置 (Multi-Provider Configuration)

```json
{
  "routing": {
    "default": {
      "providers": [
        {
          "provider": "kiro-zcam",
          "model": "CLAUDE_SONNET_4_20250514_V1_0",
          "weight": 1
        },
        {
          "provider": "kiro-gmail",
          "model": "CLAUDE_SONNET_4_20250514_V1_0",
          "weight": 1
        },
        {
          "provider": "kiro-backup1",
          "model": "CLAUDE_SONNET_4_20250514_V1_0",
          "weight": 3
        }
      ],
      "loadBalancing": {
        "enabled": true,
        "strategy": "round_robin",
        "healthCheckInterval": 60
      },
      "failover": {
        "enabled": true,
        "triggers": [
          {
            "type": "consecutive_errors",
            "threshold": 3
          },
          {
            "type": "auth_failed",
            "threshold": 2,
            "timeWindow": 300,
            "httpCodes": [401, 403]
          }
        ],
        "cooldown": 120
      }
    }
  }
}
```

**特点：**
- 支持多个Provider同时工作
- 灵活的负载均衡策略
- 高级的错误监控和回退机制

## 负载均衡策略

### 1. Round Robin (轮询)
```json
{
  "loadBalancing": {
    "enabled": true,
    "strategy": "round_robin"
  }
}
```
- 按顺序轮流选择Provider
- 确保负载均匀分布
- 适合Provider性能相似的场景

### 2. Weighted (加权)
```json
{
  "loadBalancing": {
    "enabled": true,
    "strategy": "weighted"
  }
}
```
- 根据权重优先选择低权重Provider
- 权重越低优先级越高
- 适合有明确优先级的场景

### 3. Health-based (健康状态)
```json
{
  "loadBalancing": {
    "enabled": true,
    "strategy": "health_based"
  }
}
```
- 根据历史成功率选择Provider
- 自动选择表现最好的Provider
- 适合Provider性能差异较大的场景

## Failover触发条件

### 1. 连续错误 (Consecutive Errors)
```json
{
  "type": "consecutive_errors",
  "threshold": 3
}
```
- 当Provider连续出现指定次数的错误时触发
- 最直接的健康状态指标

### 2. HTTP错误 (HTTP Errors)
```json
{
  "type": "http_error",
  "threshold": 3,
  "timeWindow": 300,
  "httpCodes": [500, 502, 503, 504]
}
```
- 监控特定HTTP错误代码
- 在时间窗口内累计错误次数
- 适合API服务器错误监控

### 3. 网络超时 (Network Timeout)
```json
{
  "type": "network_timeout",
  "threshold": 2,
  "timeWindow": 600
}
```
- 监控网络连接超时
- 检测网络连接质量问题

### 4. 认证失败 (Authentication Failed)
```json
{
  "type": "auth_failed",
  "threshold": 2,
  "timeWindow": 300,
  "httpCodes": [401, 403]
}
```
- 监控认证相关错误
- 自动处理token过期等问题

## 使用方法

### 1. 基本启动
```bash
# 构建并启动服务
./start-dev.sh

# 指定端口启动
./start-dev.sh --port 3457

# 调试模式启动
./start-dev.sh --debug
```

### 2. 测试路由功能
```bash
# 运行多Provider路由测试
node test/functional/test-multi-provider-unit.js

# 运行备份路由测试
node test-backup-routing.js
```

### 3. 监控Provider健康状态
通过API查询当前Provider健康状态：
```bash
curl http://localhost:3456/stats
```

## 配置示例

### 场景1：简单主备配置
适合有明确主备关系的场景：
```json
{
  "routing": {
    "default": {
      "provider": "primary-provider",
      "model": "primary-model",
      "backup": [
        {
          "provider": "backup-provider",
          "model": "backup-model",
          "weight": 1
        }
      ]
    }
  }
}
```

### 场景2：多Provider负载均衡
适合需要分摊负载的高并发场景：
```json
{
  "routing": {
    "default": {
      "providers": [
        { "provider": "provider-1", "model": "model-a", "weight": 1 },
        { "provider": "provider-2", "model": "model-a", "weight": 1 },
        { "provider": "provider-3", "model": "model-a", "weight": 1 }
      ],
      "loadBalancing": {
        "enabled": true,
        "strategy": "round_robin"
      }
    }
  }
}
```

### 场景3：智能故障转移
适合需要高可用性的生产环境：
```json
{
  "routing": {
    "default": {
      "providers": [
        { "provider": "high-performance", "model": "fast-model", "weight": 1 },
        { "provider": "standard", "model": "standard-model", "weight": 2 },
        { "provider": "fallback", "model": "basic-model", "weight": 3 }
      ],
      "loadBalancing": {
        "enabled": true,
        "strategy": "health_based"
      },
      "failover": {
        "enabled": true,
        "triggers": [
          { "type": "consecutive_errors", "threshold": 2 },
          { "type": "http_error", "threshold": 3, "timeWindow": 300, "httpCodes": [500, 502, 503] }
        ],
        "cooldown": 60
      }
    }
  }
}
```

## 最佳实践

### 1. Provider配置
- 确保各Provider的认证配置正确
- 设置合理的超时时间
- 监控token有效期和自动刷新

### 2. 负载均衡策略选择
- **开发环境**：使用round_robin进行均匀测试
- **生产环境**：使用health_based确保最优性能
- **有优先级需求**：使用weighted策略

### 3. Failover配置
- 设置适中的错误阈值（3-5次）
- 合理的时间窗口（5-10分钟）
- 足够的冷却期（1-2分钟）

### 4. 监控建议
- 定期检查Provider健康状态
- 监控错误日志和失败模式
- 设置告警机制

## 故障排除

### 常见问题

1. **Provider始终选择同一个**
   - 检查负载均衡是否启用
   - 确认其他Provider健康状态
   - 查看权重配置是否合理

2. **Failover不生效**
   - 检查failover配置是否启用
   - 确认触发条件阈值设置
   - 查看Provider是否在冷却期

3. **认证失败频繁**
   - 检查token有效期
   - 确认自动刷新机制工作
   - 验证认证配置正确性

### 调试工具

```bash
# 查看详细日志
tail -f /tmp/ccr-dev.log

# 检查Provider状态
curl http://localhost:3456/stats

# 运行健康检查
node debug-provider-health.js
```

## 版本兼容性

- **向后兼容**：支持原有的单provider配置
- **渐进升级**：可以逐步从backup配置迁移到多provider配置
- **配置验证**：启动时自动验证配置格式

## 技术实现

### 关键组件
- `RoutingEngine`: 核心路由逻辑
- `ProviderHealth`: 健康状态管理
- `LoadBalancer`: 负载均衡实现
- `FailoverTrigger`: 故障转移条件

### 性能特点
- O(1)路由决策时间复杂度
- 低内存占用的健康状态跟踪
- 异步非阻塞的Provider选择

### 扩展性
- 易于添加新的负载均衡策略
- 可扩展的Failover触发条件
- 模块化的Provider健康检查

---

## 总结

多Provider路由系统为Claude Code Router提供了企业级的高可用性和负载分发能力。通过灵活的配置选项，用户可以根据具体需求构建适合的路由策略，确保服务的稳定性和性能。

如有问题或需要支持，请参考项目的test目录中的示例和测试用例，或者查看详细的日志输出进行排错。