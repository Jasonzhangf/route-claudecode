# 精准流水线拉黑机制设计

## 📋 项目概述

基于用户需求设计的精准流水线拉黑管理系统，确保在遇到各种API错误时采取合适的处理策略，避免过度拉黑和资源浪费。

## 🎯 核心设计原则

### 1. 手动配置优先
- **长期拉黑必须手动配置** - 禁止任何自动长期拉黑行为
- **销毁规则需显式启用** - 所有销毁规则默认disabled，需要管理员手动启用

### 2. 两种处理模式
- **立即销毁模式**: 402余额不足、401认证失败 → 立即销毁流水线，下次启动重建
- **短期拉黑模式**: 429流控 → 1分钟禁用，记录历史，连续3次后销毁

### 3. 精准错误识别
- **状态码 + 错误消息模式匹配** - 避免误判
- **可配置错误模式** - 支持灵活的错误识别规则

## 🔒 错误分类和处理策略

### 立即销毁错误 (需手动配置)

| 状态码 | 错误模式 | 处理策略 | 默认状态 |
|--------|----------|----------|----------|
| 402 | payment, balance, credit, quota | 立即销毁 | disabled |
| 401 | invalid api key, unauthorized, authentication | 立即销毁 | disabled |
| 403 | forbidden, banned, suspended, account disabled | 立即销毁 | disabled |

### 短期拉黑错误 (自动处理)

| 状态码 | 处理策略 | 拉黑时长 | 失败阈值 |
|--------|----------|----------|----------|
| 429 | 临时拉黑 | 1分钟 | 连续3次销毁 |

### 正常重试错误 (不拉黑)

| 状态码/错误 | 处理策略 |
|------------|----------|
| 500, 502, 503 | 正常重试机制 |
| ECONNRESET, ETIMEDOUT | 正常重试机制 |
| 其他网络错误 | 正常重试机制 |

## 🛠 技术架构

### 核心组件

1. **PrecisePipelineBlacklistManager** - 核心拉黑逻辑管理器
2. **BlacklistConfigValidator** - 配置验证器
3. **RateLimitCounter** - 429错误计数器
4. **PersistenceManager** - 持久化存储管理

### 数据结构

```typescript
interface BlacklistConfig {
  enabled: boolean;
  persistenceFile: string;
  destroyRules: DestroyRule[];
  rateLimitRule: RateLimitRule;
}

interface DestroyRule {
  statusCode: number;
  errorPatterns: string[];
  enabled: boolean; // 必须手动设置为true
  description: string;
}

interface RateLimitRule {
  statusCode: 429;
  blockDuration: number; // 毫秒
  maxConsecutiveFailures: number;
  resetInterval: number;
}
```

### 处理流程

1. **错误发生** → 错误分类识别
2. **匹配销毁规则** → 检查是否手动启用
3. **执行对应策略** → 销毁/临时拉黑/正常重试
4. **持久化状态** → 保存拉黑信息
5. **日志记录** → 完整的操作审计

## 📝 配置文件规范

```json
{
  "pipeline": {
    "blacklist": {
      "enabled": true,
      "persistenceFile": "./data/pipeline-blacklist.json",
      
      "destroyRules": [
        {
          "statusCode": 402,
          "errorPatterns": ["payment", "balance", "credit", "quota", "billing"],
          "enabled": false,
          "description": "账户余额不足或配额用尽 - 需要手动启用",
          "adminNote": "启用前请确认这是期望的行为"
        },
        {
          "statusCode": 401,
          "errorPatterns": ["invalid api key", "unauthorized", "authentication failed"],
          "enabled": false,
          "description": "认证失败或API Key无效 - 需要手动启用"
        },
        {
          "statusCode": 403,
          "errorPatterns": ["forbidden", "banned", "suspended", "account disabled"],
          "enabled": false,
          "description": "账户被封禁或暂停 - 需要手动启用"
        }
      ],

      "rateLimitRule": {
        "statusCode": 429,
        "blockDuration": 60000,
        "maxConsecutiveFailures": 3,
        "resetInterval": 300000,
        "description": "429流控处理：1分钟拉黑，3次后销毁"
      }
    }
  }
}
```

## 🔧 集成点

### 1. Pipeline请求处理器集成
- 在processServerLayer中检查流水线状态
- 根据错误类型执行相应策略
- 记录详细的操作日志

### 2. 流水线管理器集成
- 提供流水线销毁接口
- 支持流水线重建机制
- 状态查询和监控

### 3. CLI命令集成
- 配置管理命令
- 状态查询命令
- 手动干预命令

## 🎮 管理命令

```bash
# 查看拉黑配置状态
rcc4 blacklist config

# 启用销毁规则 (需要明确确认)
rcc4 blacklist enable-destroy 402 --confirm

# 禁用销毁规则
rcc4 blacklist disable-destroy 402

# 查看所有流水线拉黑状态
rcc4 blacklist status

# 查看特定流水线状态
rcc4 blacklist status <pipelineId>

# 手动解除临时拉黑
rcc4 blacklist unblock <pipelineId>

# 重置429计数器
rcc4 blacklist reset-counter <pipelineId>

# 清理过期条目
rcc4 blacklist cleanup

# 导入/导出拉黑数据
rcc4 blacklist export --file backup.json
rcc4 blacklist import --file backup.json
```

## 📊 监控和日志

### 关键日志事件
- 流水线销毁事件
- 临时拉黑事件
- 拉黑解除事件
- 配置变更事件

### 统计信息
- 各类错误的处理统计
- 流水线销毁原因分析
- 429错误恢复成功率

## 🚀 实现优先级

1. **Phase 1**: 核心拉黑管理器实现
2. **Phase 2**: 配置验证和持久化
3. **Phase 3**: 集成到pipeline处理器
4. **Phase 4**: CLI命令和管理接口
5. **Phase 5**: 监控和统计功能

## ⚠️ 安全注意事项

1. **配置安全**: 销毁规则必须显式启用，防止意外销毁
2. **数据持久化**: 确保拉黑状态在重启后正确恢复
3. **日志审计**: 记录所有拉黑相关操作，便于追溯
4. **权限控制**: 管理命令需要适当的权限检查

## 🎯 成功标准

- ✅ 402错误导致流水线立即销毁（手动启用后）
- ✅ 429错误实现1分钟临时拉黑
- ✅ 连续3次429错误销毁流水线
- ✅ 重启后保持拉黑状态
- ✅ 提供完整的CLI管理界面
- ✅ 详细的操作日志和审计记录

这个设计确保了流水线拉黑机制的精确性、可控性和安全性，满足了用户对手动配置和精准处理的要求。