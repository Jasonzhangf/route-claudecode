# Claude Code Router V3.0 Final Architecture

## 🏛️ 六层架构设计

### 层级定义与职责

#### 1. **Client Layer (客户端层)**
- **职责**: 接收Anthropic格式请求，进行基本验证
- **输入**: HTTP请求 (Anthropic API格式)
- **输出**: 标准化BaseRequest对象
- **隔离原则**: 与其他层完全隔离，只处理HTTP协议转换

#### 2. **Router Layer (路由层)**
- **职责**: 根据路由表决定请求流向，管理认证和负载均衡
- **输入**: BaseRequest对象
- **输出**: 路由决策 (TargetProvider + TargetModel)
- **隔离原则**: 包含认证管理器、负载均衡器，但不直接调用下层

#### 3. **Client-Layer-Processor (客户端层处理器)**
- **职责**: 对最终响应进行格式化，转换回Anthropic格式供客户端使用
- **输入**: Provider响应对象
- **输出**: Anthropic格式响应
- **隔离原则**: 只处理客户端响应格式转换，不涉及业务逻辑

#### 4. **Transformer Layer (转换层)**
- **职责**: 协议转换，Anthropic ↔ Provider格式双向转换
- **输入**: 标准化请求/响应
- **输出**: Provider特定格式请求/响应
- **隔离原则**: 每个Provider的Transformer彼此完全隔离

#### 5. **Provider-Protocol Layer (协议层)**
- **职责**: 与第三方API通信，实现具体协议
- **输入**: Provider格式请求
- **输出**: Provider格式响应
- **隔离原则**: 物理隔离，每个Provider独立进程或模块

#### 6. **Server-Layer-Processor (服务器层处理器)**
- **职责**: 请求预处理，特殊格式修正，为服务器端API调用做准备
- **输入**: Provider格式请求
- **输出**: 最终API请求
- **隔离原则**: 与Provider-Protocol连接，其他层不可见

## 🔧 架构原则

### A. 层级隔离原则
1. **严禁跨层调用**: 每层只能调用相邻下层
2. **物理隔离**: Transformer开始各Provider彼此完全隔离
3. **API隔离**: 层间通过标准接口通信，内部实现不可见

### B. Provider隔离原则
1. **配置隔离**: 每个Provider独立配置文件和实例
2. **认证隔离**: 认证信息仅在Router层管理，不传播到下层
3. **故障隔离**: 单个Provider故障不影响其他Provider

### C. 路由管理原则
1. **配置驱动**: 所有路由规则存储在配置文件中
2. **动态生成**: 路由表根据认证结果和配置动态生成
3. **按需初始化**: 只初始化路由表中的Provider

## 📁 配置管理架构

### 配置文件结构
```
config/
├── routing-table.json          # 主路由表
├── model-mapping.json          # 模型映射配置  
├── provider-auth.json          # 认证配置
├── load-balancing.json         # 负载均衡规则
└── generated/
    └── active-routing.json     # 动态生成的路由表
```

### 路由表规范
```json
{
  "categories": {
    "default": {
      "required": true,
      "providers": [
        {
          "provider": "anthropic-direct",
          "model": "claude-3-5-sonnet-20241022",
          "weight": 0.7
        },
        {
          "provider": "codewhisperer-primary", 
          "model": "CLAUDE_SONNET_4_20250514_V1_0",
          "weight": 0.3
        }
      ]
    },
    "background": {
      "providers": [
        {
          "provider": "gemini-api",
          "model": "gemini-1.5-flash-8b",
          "weight": 1.0
        }
      ]
    }
  }
}
```

## 🔄 请求流程

### 正向流程 (Request)
1. **Client Layer**: HTTP → BaseRequest
2. **Router Layer**: BaseRequest → RoutingDecision
3. **Transformer Layer**: BaseRequest → ProviderRequest
4. **Provider-Protocol Layer**: ProviderRequest → APICall
5. **Server-Layer-Processor**: ProviderRequest → FinalAPICall

### 反向流程 (Response)  
1. **Server-Layer-Processor**: APIResponse → ProviderResponse
2. **Provider-Protocol Layer**: ProviderResponse → StandardResponse
3. **Transformer Layer**: StandardResponse → AnthropicResponse
4. **Client-Layer-Processor**: AnthropicResponse → FormattedResponse
5. **Client Layer**: FormattedResponse → HTTP Response

## 🛡️ 架构保护机制

### 编译时检查
- TypeScript接口强制层级边界
- 依赖注入确保单向依赖
- 模块导入限制

### 运行时检查
- 层级调用监控
- 跨层调用拦截和报警
- 性能边界监控

### 故障隔离
- Provider级别的断路器
- 层级故障不向上传播
- 自动故障转移

## 📊 监控和调试

### 层级监控
- 每层独立性能指标
- 层间调用链追踪
- 资源使用监控

### Provider监控
- 独立健康检查
- 认证状态监控
- 负载均衡效果监控

---

**项目所有者**: Jason Zhang  
**架构版本**: v3.0-final  
**最后更新**: 2025-08-14