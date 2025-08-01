# 🏗️ 架构设计规则 (Architecture Design Rules)

## 🔄 四层架构设计 (Four-Layer Architecture)

### 架构概览
```
用户请求 → 输入层 → 路由层 → 输出层 → 提供商层 → AI服务
```

### 1. 输入层 (Input Layer) - `src/input/`
**职责**: 处理不同格式的API请求输入
- **Anthropic输入**: 处理Claude Code的原生Anthropic格式请求
- **OpenAI输入**: 处理OpenAI格式的API请求 (Mock实现)
- **Gemini输入**: 处理Google Gemini格式请求 (Mock实现)

**设计原则**:
- 每个输入格式独立模块
- 统一的内部请求格式转换
- 输入验证和清理

### 2. 路由层 (Routing Layer) - `src/routing/`
**职责**: 类别驱动的模型路由和Provider选择

**核心组件**:
- **RoutingEngine**: 主路由引擎，执行类别判断和模型映射
- **ProviderManager**: Round Robin负载均衡和健康状态管理
- **ProviderExpander**: 多Key扩展为多Provider实例

**路由类别**:
- `default`: 默认路由 → CodeWhisperer
- `background`: 后台任务 → Gemini Flash
- `thinking`: 思考模式 → Claude Sonnet
- `longcontext`: 长上下文 → Gemini Pro
- `search`: 工具调用 → Gemini Flash

### 3. 输出层 (Output Layer) - `src/output/`
**职责**: 格式转换和响应处理
- **Anthropic输出**: 转换为Claude Code兼容的Anthropic格式
- **OpenAI输出**: 转换为OpenAI兼容的响应格式

### 4. 提供商层 (Provider Layer) - `src/providers/`
**职责**: 与实际AI服务的连接和通信

## 🔀 路由架构详解

### 类别驱动路由机制
```typescript
// 核心流程
1. 请求分析 → 确定路由类别
2. 配置查询 → 获取Provider+Model映射
3. 模型替换 → 直接修改request.model
4. 提供商调用 → 发送到对应Provider
```

### 模型映射时机
- **✅ 正确**: 在路由映射阶段直接替换 `request.model`
- **❌ 错误**: 在响应处理阶段进行模型名替换

### 配置驱动设计
```json
{
  "routing": {
    "default": { 
      "provider": "codewhisperer-primary", 
      "model": "CLAUDE_SONNET_4_20250514_V1_0" 
    },
    "background": { 
      "provider": "shuaihong-openai", 
      "model": "gemini-2.5-flash" 
    }
  }
}
```

## 🔌 Provider架构规范

### 统一Provider接口
```typescript
interface ProviderClient {
  // 核心方法
  processRequest(request: BaseRequest): Promise<BaseResponse>
  
  // 健康检查
  healthCheck(): Promise<boolean>
  
  // 认证管理
  authenticate(): Promise<void>
}
```

### Provider实现要求
1. **认证管理**: 独立的认证系统，支持Token刷新
2. **格式转换**: 请求/响应格式的双向转换
3. **错误处理**: 分类错误处理和故障切换
4. **流式处理**: 支持SSE流式响应转换
5. **健康监控**: 实时健康状态跟踪

### 四大Provider类型

#### 1. CodeWhisperer Provider
- **实现基础**: 基于Demo2 Go代码完全移植
- **认证方式**: AWS SSO Token管理
- **特殊处理**: 完全缓冲式解析避免工具调用片段化
- **多账号支持**: Round Robin负载均衡

#### 2. OpenAI-Compatible Provider
- **支持服务**: OpenAI、Shuaihong、ModelScope等
- **格式转换**: Anthropic ↔ OpenAI双向转换
- **密钥轮换**: 多API密钥自动轮换
- **智能缓存**: Smart Caching策略

#### 3. Gemini Provider
- **API版本**: Google Generative AI v1beta
- **Schema处理**: JSON Schema兼容性自动清理
- **流式转换**: Gemini → Anthropic流式事件转换
- **多Key管理**: API密钥轮换和配额管理

#### 4. Anthropic Provider
- **直接调用**: 官方Anthropic SDK
- **原生格式**: 无需格式转换
- **流式处理**: 完整SSE事件流支持

## ⚖️ 负载均衡架构

### Round Robin机制
```typescript
class SimpleProviderManager {
  // 核心算法
  selectProvider(availableProviders: string[]): string {
    const healthyProviders = this.filterHealthyProviders(availableProviders)
    return healthyProviders[this.roundRobinIndex % healthyProviders.length]
  }
}
```

### 健康状态管理
- **健康检查**: 自动检测Provider可用性
- **故障分类**: 认证失败、限流、网络错误等
- **自动恢复**: 定时器机制恢复不健康Provider
- **黑名单机制**: 临时和永久黑名单管理

### Provider扩展系统
- **多Key扩展**: 单Provider多API密钥自动扩展为多Provider
- **负载分散**: 请求自动分散到不同密钥
- **故障隔离**: 单个密钥失败不影响其他密钥

## 🗄️ 数据流架构

### 请求处理流程
```
1. Input Layer: 格式验证和转换
2. Routing Layer: 类别判断和Provider选择  
3. Provider Layer: 实际API调用
4. Output Layer: 响应格式转换
5. Response: 返回给用户
```

### 数据捕获系统
- **Debug模式**: `--debug` 启用完整数据捕获
- **存储路径**: `~/.route-claude-code/database/`
- **分类存储**: 按Provider和日期分类存储
- **重放能力**: 支持数据重放和问题复现

## 🧪 架构验证规则

### 模块独立性检查
- [ ] 每个模块可以独立测试
- [ ] 模块间耦合度最小化
- [ ] 接口定义清晰稳定

### 路由正确性验证
- [ ] 路由类别判断准确
- [ ] 模型映射关系正确  
- [ ] Provider选择逻辑无误

### 扩展性评估
- [ ] 新增Provider成本最小
- [ ] 新增路由规则简单
- [ ] 配置驱动易于维护

## 🔄 架构演进原则

### 向后兼容
- 新架构必须与现有配置兼容
- API接口保持稳定
- 渐进式迁移路径

### 性能优化
- O(1)路由决策复杂度
- 最小化内存占用
- 简化错误传播路径

### 维护性
- 单一职责原则
- 清晰的模块边界
- 完整的文档覆盖

---
**架构版本**: v2.6.0  
**设计者**: Jason Zhang  
**最后更新**: 2025-08-01