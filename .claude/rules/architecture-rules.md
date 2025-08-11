# 🏗️ 架构设计规则 (Architecture Design Rules)

## 🔄 六层清晰分离架构 (Six-Layer Clear Separation Architecture)

### 架构概览
```
客户端 ↔ 路由器 ↔ 后处理器 ↔ Transformer ↔ Provider ↔ 预处理器 ↔ 具体服务器
```

### 🔄 各层职责明确分离

#### 1. **客户端 ↔ 路由器**: **请求接收层**
**职责**: API请求接收和初始化处理
- 接收来自客户端的HTTP请求
- 请求验证和基础解析
- **目录位置**: `src/server.ts` 中的请求处理部分
- **核心功能**: HTTP路由、请求解析、基础验证

**设计原则**:
- 统一API接口
- 请求标准化
- 错误边界设置

#### 2. **路由器 ↔ 后处理器**: **路由决策层**
**职责**: 路由决策和Provider选择
- 类别驱动的路由判断
- Provider和Model映射
- **目录位置**: `src/routing/`
- **核心组件**: `RoutingEngine`, `SimpleProviderManager`

**路由类别**:
- `default`: 默认路由 → CodeWhisperer
- `background`: 后台任务 → Gemini Flash
- `thinking`: 思考模式 → Claude Sonnet
- `longcontext`: 长上下文 → Gemini Pro
- `search`: 工具调用 → Gemini Flash

#### 3. **后处理器 ↔ Transformer**: **响应后处理层**
**职责**: 响应后处理和统一输出
- 响应格式统一和错误处理
- 输出数据清理和包装
- **目录位置**: `src/output/`, `src/server.ts` 中的响应处理部分
- **核心功能**: 统一响应格式、错误包装、日志记录

**设计原则**:
- 响应标准化
- 错误统一处理
- 日志记录完整

#### 4. **Transformer ↔ Provider**: **协议转换层**
**职责**: 协议标准化和格式转换
- Transformer负责协议转换 (Anthropic ↔ OpenAI ↔ Gemini等)
- 处理不同AI服务的协议标准化
- **目录位置**: `src/transformers/`
- **核心模块**: `openai.ts`, `gemini.ts`, `response-converter.ts`

**设计原则**:
- 每个协议独立转换器
- 双向转换支持
- 无状态转换逻辑

#### 5. **Provider ↔ 预处理器**: **统一标准协议连接层**  
**职责**: Provider管理和API调用
- 与实际AI服务的连接通信
- Provider选择和负载均衡
- **目录位置**: `src/providers/`
- **核心组件**: 各Provider实现 (`CodeWhispererProvider`, `GeminiProvider`, `OpenAIProvider`)

**Provider类型**:
- `CodeWhisperer`: AWS CodeWhisperer服务
- `Gemini`: Google Gemini API
- `OpenAI-Compatible`: OpenAI兼容服务
- `Anthropic`: Anthropic Claude API

#### 6. **预处理器 ↔ 服务器**: **标准协议与具体服务器兼容层**
**职责**: 服务器兼容性和特定修夏
- 处理标准协议和具体服务器的兼容性
- Patch系统和服务器特定修复
- **目录位置**: `src/preprocessing/`, `src/patches/`
- **核心模块**: `UnifiedPatchPreprocessor`, `PatchManager`

**预处理类型**:
- 请求预处理：格式修复、参数适配
- 响应预处理：结果解析、错误修复
- 流式预处理：实时数据处理


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
1. 客户端: HTTP请求接收和验证
2. 路由器: 类别判断和Provider选择  
3. 后处理器: 响应后处理和统一输出
4. Transformer: 协议转换和格式标准化
5. Provider: 实际AI服务调用
6. 预处理器: 服务器兼容性处理
7. 具体服务器: AI服务API调用
```

### 数据捕获系统
- **Debug模式**: `--debug` 启用完整数据捕获
- **存储路径**: `~/.route-claude-code/database/`
- **分类存储**: 按Provider和日期分类存储
- **重放能力**: 支持数据重放和问题复现

## 🚨 流水线跨节点耦合约束 (CRITICAL - Pipeline Cross-Node Coupling Constraints)

⚠️ **高优先级强制约束 - 违反将导致立即无条件修改**

### 🔒 核心约束规则
**绝对禁令**: **不可以在流水线上跨节点耦合**

### 📋 具体实施要求

#### 1. **功能开发/修复审核约束**
- **单点实现原则**: 每次功能开发或修复时，必须审核流水线上实现该功能**最适合的单一节点**
- **职责边界检查**: 确认功能实现位置是否符合节点职责范围
- **架构合规验证**: 验证实现方案不违反六层架构设计

#### 2. **避免重复实现约束**  
- **现有实现检查**: 检查已有实现，严格避免：
  - 重复实现同一功能
  - 多次实现相同逻辑
  - 多点修复同一问题
- **去重合并要求**: 发现重复实现时必须合并到最适合的单一节点

#### 3. **节点严格隔离约束**
- **视野限制**: 每个节点只能看到和操作自己职责范围内的组件
  - `transformer` **看不到**预处理器节点，不可对其进行修复
  - `路由器` 层不可直接操作 `预处理器` 层
  - `后处理器` 层不可直接处理协议转换
- **接口通信**: 节点间只能通过定义的接口进行通信
- **依赖单向性**: 严格遵循六层架构的单向依赖关系

#### 4. **强制执行机制**
- **代码检查必须项**: 每次代码检查都需要验证此约束
- **零容忍政策**: 发现违规立即无条件修改，不允许任何例外
- **实时监控**: 通过架构验证工具持续监控跨节点耦合

### 🔍 违规检测要点
- **跨层直接调用**: 检测是否有跨架构层的直接函数调用
- **状态共享**: 检测是否有节点间的状态共享
- **职责越界**: 检测是否有节点执行了其他节点的职责
- **重复逻辑**: 检测是否有相同逻辑在多个节点实现

### ⚡ 违规处理流程
1. **即时停止**: 发现违规立即停止当前开发工作
2. **架构审查**: 重新审查功能实现的合适节点位置
3. **重构修复**: 将违规实现重构到正确的单一节点
4. **验证测试**: 确保修复后的实现符合架构约束

## 🧪 架构验证规则

### 模块独立性检查
- [ ] 每个模块可以独立测试
- [ ] 模块间耦合度最小化
- [ ] 接口定义清晰稳定
- [ ] **新增**: 不存在跨节点耦合实现

### 路由正确性验证
- [ ] 路由类别判断准确
- [ ] 模型映射关系正确  
- [ ] Provider选择逻辑无误
- [ ] **新增**: 路由逻辑集中在routing层，无跨层路由决策

### 扩展性评估
- [ ] 新增Provider成本最小
- [ ] 新增路由规则简单
- [ ] 配置驱动易于维护
- [ ] **新增**: 新功能可在单一节点内完整实现

### 🚨 跨节点耦合检查 (新增必检项)
- [ ] **功能单点实现**: 每个功能只在最适合的单一节点实现
- [ ] **无重复实现**: 相同逻辑不在多个节点出现
- [ ] **节点职责纯净**: 每个节点严格遵循职责边界
- [ ] **接口通信规范**: 节点间只通过定义接口通信
- [ ] **依赖关系正确**: 严格遵循六层架构的单向依赖

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
**架构版本**: v2.8.0 (流水线跨节点耦合约束版)  
**设计者**: Jason Zhang  
**最后更新**: 2025-08-10  
**重大更新**: 新增流水线跨节点耦合约束规则 - 高优先级强制执行