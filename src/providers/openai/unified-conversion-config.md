# 统一转换层配置说明

## 环境变量配置

### 核心功能控制

```bash
# 统一转换层总开关（默认启用）
RCC_UNIFIED_CONVERSION=true|false

# 降级到传统客户端（默认禁用）
RCC_FALLBACK_LEGACY=false|true

# 调试转换流水线（默认禁用）
RCC_DEBUG_PIPELINE=false|true
```

### 预处理阶段控制

```bash
# 统一预处理开关（默认启用）
RCC_UNIFIED_PREPROCESSING=true|false

# 强制所有输入进入预处理（默认禁用）
RCC_FORCE_ALL_INPUTS=false|true

# 缓存预处理结果（默认禁用）
RCC_CACHE_PREPROCESSING=false|true

# 严格finish reason验证（默认禁用）
RCC_STRICT_FINISH_REASON=false|true
```

### 日志和监控控制

```bash
# 预处理调试日志（默认禁用）
RCC_PREPROCESSING_DEBUG=false|true

# 转换路径详细记录（默认启用）
RCC_TRANSFORMATION_LOGGING=true|false

# 性能统计收集（默认启用）
RCC_PERFORMANCE_STATS=true|false
```

## 配置组合推荐

### 生产环境推荐配置
```bash
# 启用统一转换层，关闭调试
RCC_UNIFIED_CONVERSION=true
RCC_FALLBACK_LEGACY=false
RCC_DEBUG_PIPELINE=false
RCC_TRANSFORMATION_LOGGING=true
RCC_PERFORMANCE_STATS=true
```

### 开发/调试环境配置
```bash
# 启用所有调试功能
RCC_UNIFIED_CONVERSION=true
RCC_DEBUG_PIPELINE=true
RCC_PREPROCESSING_DEBUG=true
RCC_TRANSFORMATION_LOGGING=true
RCC_FORCE_ALL_INPUTS=true
```

### 传统模式配置（回退）
```bash
# 禁用统一转换层，使用传统客户端
RCC_UNIFIED_CONVERSION=false
RCC_FALLBACK_LEGACY=true
```

## 特性说明

### 统一转换层核心功能

1. **流式到非流式转换**：所有请求统一转为非流式发送到供应商
2. **集中流式响应模拟**：根据需要模拟流式响应返回给客户端
3. **统一finish reason记录**：只在一个地方记录，避免重复
4. **完整转换路径记录**：每个模块一个记录点，便于调试
5. **后处理guard机制**：transformer后的一致性验证

### 解决的问题

1. **重复响应问题**：消除多点记录导致的重复finish_reason
2. **静默停止问题**：避免流式处理中的竞态条件
3. **架构复杂性**：统一处理逻辑，简化Provider接口
4. **调试困难**：提供完整的转换路径追踪

## 监控和统计

启用统一转换层后，可通过以下方式查看统计信息：

```bash
# 检查转换层状态
curl http://localhost:3456/unified-conversion/stats

# 检查特定provider转换情况
curl http://localhost:3456/unified-conversion/provider/{providerId}
```

## 故障排除

### 常见问题

1. **转换失败**：检查RCC_FALLBACK_LEGACY是否启用
2. **性能问题**：关闭RCC_DEBUG_PIPELINE和详细日志
3. **兼容性问题**：设置RCC_UNIFIED_CONVERSION=false回退

### 调试模式

启用调试模式查看详细转换过程：

```bash
RCC_DEBUG_PIPELINE=true
RCC_PREPROCESSING_DEBUG=true
RCC_TRANSFORMATION_LOGGING=true
```

## 版本兼容性

- **v2.8.0+**：完全支持统一转换层
- **v2.7.x**：部分支持，建议升级
- **v2.6.x及以下**：不支持，需要升级