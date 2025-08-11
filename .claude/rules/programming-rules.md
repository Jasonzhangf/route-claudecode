# 🔥 核心编程规则 (Core Programming Rules)

## 🚨 最高优先级禁令 (Absolute Prohibitions)

### 1. 🚫 零硬编码原则 (NO HARDCODING)
- **绝对禁止**：任何模型名称、API端点、配置值的硬编码
- **实现要求**：所有常量必须通过配置文件、环境变量或参数传递
- **违例检查**：代码中不允许出现字面量字符串作为模型名或配置值

**❌ 违例示例：**
```typescript
model: 'claude-3-sonnet-20240229'  // 硬编码！
const endpoint = 'https://api.anthropic.com'  // 硬编码！
```

**✅ 正确示例：**
```typescript
model: modelName  // 通过参数传递
const endpoint = config.endpoints.anthropic  // 通过配置传递
```

### 2. 🚫 零Fallback原则 (NO FALLBACK)
- **绝对禁止**：任何形式的fallback逻辑或默认值降级
- **实现要求**：所有失败必须明确处理，不能自动降级到备用方案
- **错误处理**：明确的错误抛出和失败报告机制

**❌ 违例示例：**
```typescript
const model = request.model || 'default-model'  // Fallback！
const provider = selectedProvider || 'backup-provider'  // Fallback！
```

**✅ 正确示例：**
```typescript
if (!request.model) {
  throw new Error('Model name is required')
}
// 明确的错误处理和失败报告
```

### 3. 🚫 零沉默失败原则 (NO SILENT FAILURES)
- **绝对禁止**：任何错误被隐藏或不向客户端正确报告的情况
- **实现要求**：所有错误必须返回正确的HTTP状态码（非200）
- **特别重视**：流式请求在provider错误时不能返回HTTP 200状态码
- **错误可见性**：所有错误必须有console输出和日志记录

**❌ 违例示例：**
```typescript
// 🚨 最严重的沉默失败：HTTP 200但包含错误内容
reply.raw.writeHead(200, { ... }); // 设置状态码太早！
// ... provider请求失败但状态码已经是200
```

**✅ 正确示例：**
```typescript
// 先验证请求有效性，再设置HTTP状态码
const streamIterator = provider.sendStreamRequest(request);
const firstChunk = await streamIterator.next();
if (firstChunk.done && !firstChunk.value) {
  throw new Error('Streaming request failed'); // 抛出错误，不设置200状态
}
// 只有确认成功后才设置200状态码
reply.raw.writeHead(200, { ... });
```

## 🎯 架构原则优先级 (Architecture Priority)

1. **最高优先级**: 零硬编码 + 零Fallback + 零沉默失败
2. **高优先级**: 模块化、自包含、可测试
3. **中优先级**: 性能优化、用户体验
4. **低优先级**: 代码风格、注释完整性

## 🧬 细菌式编程原则 (Bacterial Programming)

### Small (小巧)
- **文件限制**: 单文件不超过500行代码
- **函数限制**: 单函数不超过50行代码
- **能量效率**: 每一行代码都有明确目的，杜绝冗余

### Modular (模块化)
- **六层架构**: 客户端→路由器→后处理器→Transformer→Provider→预处理器→服务器模块
- **可插拔设计**: 不同功能单元可以轻松组合或替换
- **操纵子组织**: 相关功能组织成独立的功能模块

### Self-contained (自包含)
- **标准接口**: 模块间通过标准接口交互
- **水平基因转移**: 支持模块级的"复制粘贴"复用
- **上下文无关**: 模块使用无需理解整个系统上下文

## 🔧 实现规范 (Implementation Standards)

### 代码组织
- **目录结构**: 严格按照六层架构组织代码
- **命名规范**: 文件名和函数名必须清晰表达功能
- **依赖管理**: 每个模块明确声明其依赖

### 错误处理
- **明确失败**: 所有错误必须明确处理，不允许静默失败
- **错误分类**: 按照错误类型进行分类处理
- **日志记录**: 所有错误必须记录详细日志

### 配置管理
- **外部配置**: 所有配置通过外部文件或环境变量管理
- **类型安全**: 配置项必须有明确的类型定义
- **验证机制**: 启动时验证所有必需配置项

## 📏 质量检查清单 (Quality Checklist)

- [ ] 代码中无任何硬编码字符串
- [ ] 无fallback或默认值降级逻辑
- [ ] 单文件代码行数 ≤ 500行
- [ ] 单函数代码行数 ≤ 50行
- [ ] 模块间依赖关系清晰
- [ ] 错误处理覆盖所有失败路径
- [ ] 配置项从外部文件获取
- [ ] 函数和变量命名清晰表意

## 🚀 最佳实践 (Best Practices)

### 模型名处理
```typescript
// ✅ 正确：路由阶段直接替换
request.model = targetModel  // 在路由映射阶段完成
request.metadata.originalModel = originalModel  // 保存原始模型用于追踪

// ❌ 错误：响应阶段处理
// 不在响应处理阶段进行模型名替换
```

### Provider选择
```typescript
// ✅ 正确：类别驱动映射
const routing = config.routing[category]  // default/background/thinking/search
const provider = routing.provider

// ❌ 错误：defaultProvider机制
// 不使用defaultProvider降级机制
```

### 配置管理
```typescript
// ✅ 正确：配置驱动
const modelMapping = config.models[requestModel]
if (!modelMapping) {
  throw new Error(`Unsupported model: ${requestModel}`)
}

// ❌ 错误：硬编码映射
// const modelMapping = MODEL_CONSTANTS[requestModel] || 'default-model'
```

---
**项目所有者**: Jason Zhang  
**最后更新**: 2025-08-01  
**适用版本**: v2.6.0+