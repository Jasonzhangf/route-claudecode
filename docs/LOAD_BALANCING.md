# 🚀 负载均衡功能详解 - Claude Code Router Enhanced

## 📋 功能概述

Claude Code Router现在支持**真正的负载均衡**，允许每个模型类别配置多个provider，并按权重进行智能分配。这大大提升了系统的**可用性、性能和容错能力**。

## 🆚 **新架构 vs 旧架构对比**

| 特性 | 旧架构 (故障转移) | 新架构 (负载均衡) |
|-----|-------------|-------------|
| **provider选择** | 主provider → backup | 多provider权重分配 |
| **流量分配** | 100% → 0% (二元) | 按权重比例分配 |
| **容错机制** | 故障时切换 | 持续分散风险 |
| **性能优化** | 单点性能限制 | 多点并行处理 |
| **配置复杂度** | 简单 primary+backup | 灵活的权重配置 |

## 🏗️ **配置结构详解**

### 📝 **新配置格式**

```json
{
  "routing": {
    "default": {
      "providers": [
        {
          "provider": "kiro-zcam",
          "model": "CLAUDE_SONNET_4_20250514_V1_0",
          "weight": 70
        },
        {
          "provider": "kiro-gmail", 
          "model": "CLAUDE_SONNET_4_20250514_V1_0",
          "weight": 30
        }
      ],
      "loadBalancing": {
        "enabled": true,
        "strategy": "weighted",
        "healthCheckInterval": 30000
      },
      "backup": [
        {
          "provider": "backup-provider",
          "model": "gpt-4o",
          "weight": 1
        }
      ]
    }
  }
}
```

### 🔧 **配置字段说明**

#### **providers 数组**
- **provider**: Provider ID (必须在providers中定义)
- **model**: 目标模型名称
- **weight**: 权重值，**数值越大流量占比越高**

#### **loadBalancing 配置**
- **enabled**: 是否启用负载均衡 (true/false)
- **strategy**: 负载均衡策略
  - `weighted`: 权重随机分配 (推荐)
  - `round_robin`: 轮询分配
  - `health_based`: 基于健康状态分配
- **healthCheckInterval**: 健康检查间隔 (毫秒)

## ⚖️ **负载均衡算法详解**

### 🎯 **1. Weighted (权重随机) - 推荐**

**工作原理:**
```javascript
// 权重配置: [A:70, B:30]
// 总权重: 100
// A选中概率: 70/100 = 70%
// B选中概率: 30/100 = 30%

const random = Math.random() * totalWeight; // 0-100
if (random < 70) return A;  // 0-70 选择A
else return B;              // 70-100 选择B
```

**适用场景:**
- 不同provider性能差异较大
- 需要精确控制流量比例
- 成本优化 (便宜provider高权重)

**权重设置建议:**
```json
// 主力分配 (7:3)
{ "provider": "primary", "weight": 70 }
{ "provider": "secondary", "weight": 30 }

// 极端分配 (95:5) - 主力+应急
{ "provider": "main", "weight": 95 }
{ "provider": "emergency", "weight": 5 }

// 均衡分配 (5:3:2) - 多provider
{ "provider": "fast", "weight": 50 }
{ "provider": "stable", "weight": 30 }
{ "provider": "backup", "weight": 20 }
```

### 🔄 **2. Round Robin (轮询)**

**工作原理:**
```
请求1 → Provider A
请求2 → Provider B  
请求3 → Provider A
请求4 → Provider B
...
```

**适用场景:**
- Provider性能相似
- 需要均匀分配负载
- 简单的负载均衡需求

### 🏥 **3. Health Based (健康状态)**

**工作原理:**
```javascript
// 健康分数计算
score = successRate - errorPenalty - cooldownPenalty
// 选择分数最高的provider
```

**健康指标:**
- **成功率**: `successCount / totalRequests`
- **错误惩罚**: `consecutiveErrors * 0.1`
- **冷却惩罚**: 处于冷却期时 `-0.5`

**适用场景:**
- Provider稳定性差异大
- 自动避开故障provider
- 自适应负载分配

## 📊 **实际使用示例**

### 🎯 **场景1: 双CodeWhisperer负载均衡**

```json
{
  "default": {
    "providers": [
      {
        "provider": "kiro-zcam",
        "model": "CLAUDE_SONNET_4_20250514_V1_0", 
        "weight": 70
      },
      {
        "provider": "kiro-gmail",
        "model": "CLAUDE_SONNET_4_20250514_V1_0",
        "weight": 30
      }
    ],
    "loadBalancing": {
      "enabled": true,
      "strategy": "weighted"
    }
  }
}
```

**结果:** 70%请求到kiro-zcam，30%到kiro-gmail

### 🔍 **场景2: 搜索混合Provider**

```json
{
  "search": {
    "providers": [
      {
        "provider": "shuaihong-openai",
        "model": "gemini-2.5-pro",
        "weight": 80
      },
      {
        "provider": "backup-gpt",
        "model": "gpt-4o",
        "weight": 20
      }
    ],
    "loadBalancing": {
      "enabled": true,
      "strategy": "weighted"
    }
  }
}
```

**结果:** 80%用Gemini，20%用GPT-4o

### 🧠 **场景3: Thinking健康状态分配**

```json
{
  "thinking": {
    "providers": [
      {
        "provider": "primary",
        "model": "claude-4-sonnet",
        "weight": 60
      },
      {
        "provider": "secondary", 
        "model": "claude-4-sonnet",
        "weight": 40
      }
    ],
    "loadBalancing": {
      "enabled": true,
      "strategy": "health_based"
    }
  }
}
```

**结果:** 自动选择健康状态最好的provider

## 🔧 **故障转移 vs 负载均衡**

### 📋 **配合使用**

```json
{
  "default": {
    "providers": [
      { "provider": "primary-1", "weight": 50 },
      { "provider": "primary-2", "weight": 50 }
    ],
    "loadBalancing": { "enabled": true, "strategy": "weighted" },
    "backup": [
      { "provider": "backup-1", "weight": 1 },
      { "provider": "backup-2", "weight": 1 }
    ]
  }
}
```

**工作流程:**
1. **负载均衡**: 在primary-1和primary-2间按权重分配
2. **故障转移**: 如果主providers都故障，切换到backup
3. **健康恢复**: 主providers恢复后自动切回

## 🧪 **测试验证**

运行负载均衡测试：
```bash
node test-load-balancing.js
```

**测试结果示例:**
```
双Provider权重分配 (70:30):
  kiro-zcam    | 权重: 70 | 期望:70.0% | 实际:67.6% | 偏差:2.4%
  kiro-gmail   | 权重: 30 | 期望:30.0% | 实际:32.4% | 偏差:2.4%
  质量评级: 🟡 良好
```

## ⚡ **性能优势**

### 🚀 **吞吐量提升**
- **并行处理**: 多provider同时服务
- **瓶颈分散**: 避免单点性能限制
- **资源利用**: 充分利用所有可用provider

### 🛡️ **可用性增强**
- **风险分散**: 不依赖单一provider
- **优雅降级**: 部分provider故障不影响服务
- **快速恢复**: 故障provider自动恢复后重新纳入

### 💰 **成本优化**
- **差异化计费**: 高权重配置便宜provider
- **弹性扩展**: 根据需要调整权重比例
- **资源均衡**: 避免某个provider超额使用

## 🔍 **监控和调试**

### 📊 **关键指标**

在debug日志中查看:
```
[DEBUG] Weighted selection: kiro-zcam
  weight: 70
  totalWeight: 100  
  randomValue: 45.234
  selectionProbability: 70.0%
```

### 🚨 **故障检测**

```
[WARN] Provider primary-1 marked unhealthy after 5 consecutive errors
  errorType: timeout
  httpCode: 504
  cooldownUntil: 2025-07-29T15:30:00Z
```

## 📋 **最佳实践**

### ✅ **推荐配置**

1. **主力双活** (推荐)
   ```json
   "providers": [
     { "provider": "main-1", "weight": 60 },
     { "provider": "main-2", "weight": 40 }
   ]
   ```

2. **主备模式**
   ```json
   "providers": [
     { "provider": "primary", "weight": 90 },
     { "provider": "standby", "weight": 10 }
   ]
   ```

3. **多点均衡**
   ```json
   "providers": [
     { "provider": "fast", "weight": 50 },
     { "provider": "stable", "weight": 30 },
     { "provider": "cheap", "weight": 20 }
   ]
   ```

### ⚠️ **注意事项**

1. **权重总和**: 无限制，系统自动计算比例
2. **最小权重**: 建议 ≥ 5，避免过低概率
3. **健康检查**: 定期检查provider状态
4. **渐进调整**: 生产环境逐步调整权重

## 🎯 **迁移指南**

### 从旧配置迁移:

**旧格式:**
```json
{
  "default": {
    "provider": "primary",
    "model": "claude-4",
    "backup": [
      { "provider": "backup", "model": "gpt-4", "weight": 1 }
    ]
  }
}
```

**新格式:**
```json
{
  "default": {
    "providers": [
      { "provider": "primary", "model": "claude-4", "weight": 100 }
    ],
    "loadBalancing": { "enabled": false },
    "backup": [
      { "provider": "backup", "model": "gpt-4", "weight": 1 }
    ]
  }
}
```

**系统自动兼容旧格式，无需立即迁移！**

---

🎉 **现在您可以充分利用负载均衡功能，实现更高的可用性和性能！**