# 配置层与流水线层分离设计文档

## 🎯 **设计原则**

本文档定义了RCC4中配置层和流水线层的分离处理策略，确保配置保持静态（向后兼容），而流水线支持动态展开（多key支持、优先级路由）。

## 📋 **核心设计决策**

### 1. **配置层：保持静态**
- **目标**: 确保现有调度器不受影响，配置格式向后兼容
- **策略**: 配置文件和ConfigReader输出保持原有格式
- **多key处理**: 在配置中保持原样，不展开

### 2. **流水线层：支持动态展开**  
- **目标**: 支持复杂路由、多key负载均衡、可选安全路由
- **策略**: PipelineTableManager动态展开配置为多个pipeline实例
- **多key处理**: 每个API key生成独立pipeline，支持负载均衡

## 🔧 **技术实现架构**

### **数据流向**
```
配置文件 → ConfigReader → MergedConfig → PipelineTableManager → PipelineTable
  ↓           ↓              ↓              ↓                   ↓
静态格式    静态输出     +expandedRouting   动态展开        多pipeline实例
```

### **关键组件职责**

#### ConfigReader (已完成)
- **职责**: 解析复杂路由格式，生成expandedRouting
- **输出**: 静态MergedConfig + 可选expandedRouting
- **多key处理**: 保持原有配置格式，不展开

#### PipelineTableManager (待更新)  
- **职责**: 根据expandedRouting动态生成pipeline实例
- **输入**: MergedConfig.expandedRouting
- **多key处理**: 展开每个provider的多个API key为独立pipeline

## 📊 **具体示例**

### **配置层保持静态**
```json
// multi-provider-hybrid-v4.json (保持原样)
{
  "Providers": [
    {
      "name": "modelscope",
      "api_keys": ["key1", "key2", "key3"],  // 多key不展开
      "models": ["qwen3-480b", "llama3.1-405b-instruct"]
    }
  ],
  "router": {
    "coding": "modelscope,deepseek-v2.5-chat;qwen,qwen3-coder-plus"  // 复杂路由保持原样
  }
}
```

### **ConfigReader输出**
```typescript
// MergedConfig (静态格式 + 可选展开信息)
{
  providers: [...],      // 原有格式不变
  router: {...},         // 原有格式不变 
  expandedRouting: {     // 新增：展开后的路由信息
    primaryProviders: [
      {
        name: "modelscope",
        model: "deepseek-v2.5-chat", 
        category: "coding",
        priority: 1,
        originalProvider: { ... }
      },
      {
        name: "qwen",
        model: "qwen3-coder-plus",
        category: "coding", 
        priority: 2,
        originalProvider: { ... }
      }
    ],
    securityProviders: [...]
  }
}
```

### **PipelineTableManager展开**
```typescript
// Pipeline实例动态展开 (多key支持)
[
  // ModelScope的3个key展开为3个pipeline
  {
    id: "pipeline-coding-modelscope-key1-deepseek",
    provider: "modelscope",
    model: "deepseek-v2.5-chat",
    apiKey: "key1",
    priority: 1,
    category: "coding",
    isSecurityEnhanced: false
  },
  {
    id: "pipeline-coding-modelscope-key2-deepseek", 
    provider: "modelscope",
    model: "deepseek-v2.5-chat",
    apiKey: "key2", 
    priority: 2,
    category: "coding",
    isSecurityEnhanced: false
  },
  {
    id: "pipeline-coding-modelscope-key3-deepseek",
    provider: "modelscope", 
    model: "deepseek-v2.5-chat",
    apiKey: "key3",
    priority: 3,
    category: "coding",
    isSecurityEnhanced: false
  },
  // Qwen单key保持1个pipeline
  {
    id: "pipeline-coding-qwen-qwen3-coder-plus",
    provider: "qwen",
    model: "qwen3-coder-plus", 
    apiKey: "qwen-auth-3",
    priority: 4,
    category: "coding", 
    isSecurityEnhanced: false
  }
]
```

## 🎯 **关键技术要点**

### 1. **多key展开策略**
- **单key provider**: 生成1个pipeline实例
- **多key provider**: 每个key生成独立pipeline，优先级递增
- **API key管理**: 每个pipeline包含具体的API key引用

### 2. **优先级管理**
```typescript
// 优先级分配策略
主要路由: priority 1-N (按配置顺序)
├── 同provider多key: priority递增 (key1=1, key2=2, key3=3)  
└── 不同provider: priority按router顺序递增

安全路由: priority N+1-M (仅在有security配置时)
├── 同样支持多key展开
└── 优先级在所有主要路由之后
```

### 3. **Pipeline ID生成规则**
```typescript
// ID格式: pipeline-{category}-{provider}-{keyIndex}-{model}
"pipeline-coding-modelscope-key1-deepseek"
"pipeline-coding-qwen-single-qwen3-coder-plus"  
"pipeline-coding-shuaihong-security-gemini"  // security标记
```

### 4. **故障转移和负载均衡**
- **同provider多key**: 支持key-level故障转移
- **跨provider路由**: 按优先级依次尝试
- **安全路由**: 仅在主要路由全部失败时启用

## 🔍 **实现验证要点**

### **ConfigReader验证** ✅
- [x] 输出格式静态化，现有调度器无影响
- [x] 复杂路由正确展开为expandedRouting
- [x] 支持可选security字段
- [x] 向后兼容性测试通过

### **PipelineTableManager验证** (待实现)
- [ ] 支持expandedRouting输入
- [ ] 多key provider正确展开为多个pipeline
- [ ] 优先级分配正确
- [ ] Pipeline ID生成规范
- [ ] 安全路由正确标记和处理

## 🚨 **注意事项**

1. **配置兼容性**: 确保现有配置格式100%兼容
2. **多key安全**: 每个API key独立管理，避免key泄露
3. **性能考虑**: 多pipeline实例不应显著增加内存开销
4. **错误处理**: 每个pipeline的错误应独立处理，不影响其他实例
5. **监控支持**: Pipeline级别的监控和调试支持

## 📋 **下一步实现计划**

1. **更新PipelineTableManager** - 支持expandedRouting和多key展开
2. **增强Pipeline定义** - 添加多key支持和安全路由标记  
3. **更新路由逻辑** - 支持基于优先级的智能路由
4. **端到端测试** - 验证完整的多provider优先级路由功能

---

*此文档定义了RCC4配置与流水线分离的核心架构，确保系统既保持向后兼容性，又支持复杂的多provider路由需求。*