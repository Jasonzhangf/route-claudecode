# RCC v4.0 项目规格书

## 项目概述

**项目名称**: Route Claude Code (RCC) v4.0  
**项目类型**: 模块化路由代理系统  
**开发语言**: TypeScript/Node.js  
**架构模式**: 六层平行流水线架构  
**设计规范**: [RCC v4.0 六层平行架构规范](./rcc-v4-six-layer-parallel-architecture.md)  

## 核心需求

### 1. 功能需求

#### 1.1 客户端模块 (Client Module)
- **CLI双模式系统**
  - **Server模式**: `rcc start` - 启动独立路由服务器，阻塞式运行，支持Ctrl+C优雅退出
  - **Client模式**: `rcc code` - 启动Claude Code并透明代理，自动配置环境变量，进程生命周期绑定
  - **管理命令**: `rcc stop`, `rcc status`, `rcc provider update` - 服务器管理和Provider自动更新
- **用户交互界面**
  - 处理用户输入输出
  - 错误信息展示
  - 系统状态显示
- **统一错误处理**
  - 所有模块错误的最终出口
  - 不允许静默失败

#### 1.2 路由器模块 (Router Module)
- **配置管理**
  - 读取 `~/.route-claudecode/config` 下的配置
  - Provider List 管理
  - Routing Table 管理
- **请求路由**
  - 根据routing table进行请求分发
  - 动态生成路由分发表 (`~/.route-claudecode/config/generated/`)
- **会话流控系统**
  - 基于session.conversationID.requestID的分层流控
  - 同一对话内请求严格串行处理
  - 不同会话和对话可以并行处理
  - 优先级调度和队列管理
- **负载均衡**
  - 多key和多token负载均衡
  - 流水线worker调用管理
- **路由服务器**
  - 接受客户端输入
  - 返回处理结果

#### 1.3 流水线Worker (Pipeline Worker)
- **动态管理**
  - 动态初始化和注册
  - 动态销毁
  - 根据provider.model.availability管理生命周期
- **流水线组成**
  - Transformer模块
  - Protocol模块  
  - Server-Compatibility模块
  - Server模块
- **隔离性**
  - 每个provider.model一个独立流水线
  - 流水线间完全隔离

#### 1.4 Debug系统
- **全局调试**
  - 接受各模块的debug注册
  - 可控制任意端口的debug开关
- **数据记录**
  - 记录每个模块的输入输出
  - 基于requestID的流水线记录
  - 按端口分组存储: `~/.route-claudecode/debug/port-xxxx/`
  - 使用可读时区时间命名: `session-2024-08-15_14-30-22/`
- **回放测试**
  - 支持动态回放
  - 单元测试支持

### 2. 技术需求

#### 2.1 架构约束
- **严格模块化**: 每个模块只能在职责范围内工作
- **不允许跨模块处理**: 模块间只能通过定义接口通信
- **不允许静默失败**: 所有错误必须通过error handler报告
- **不允许fallback**: 错误不能被掩盖，必须明确处理

#### 2.2 流水线模块详细设计

##### Transformer模块
- **职责**: Anthropic ↔ Protocol 请求转换
- **输入验证**: Anthropic request标准格式
- **输出验证**: 目标protocol格式
- **命名规则**: 以目标protocol命名

##### Protocol模块  
- **职责**: 协议控制转换
- **流式处理**: 流式请求 → 非流式请求 → 流式响应
- **协议校验**: 输入输出都做协议标准校验

##### Server-Compatibility模块
- **职责**: 第三方服务器兼容处理
- **输入**: 标准protocol协议
- **输出**: 第三方特定格式
- **重点**: OpenAI变种和扩展处理

##### Server模块
- **职责**: 标准服务器协议处理
- **SDK优先**: 有SDK就使用标准SDK
- **协议标准**: 严格按照服务器协议标准

#### 2.3 配置系统设计

##### Provider List配置
```json
{
  "providers": [
    {
      "name": "openai",
      "protocol": "openai",
      "baseUrl": "https://api.openai.com/v1",
      "apiKey": "${OPENAI_API_KEY}",
      "models": ["gpt-4", "gpt-3.5-turbo"],
      "maxTokens": 4096,
      "availability": true
    }
  ]
}
```

##### Routing Table配置
```json
{
  "routes": [
    {
      "category": "default",
      "rules": [
        {
          "provider": "openai",
          "model": "gpt-4",
          "weight": 0.7
        },
        {
          "provider": "anthropic", 
          "model": "claude-3",
          "weight": 0.3
        }
      ]
    }
  ]
}
```

### 3. 质量需求

#### 3.1 可靠性
- 错误处理覆盖率: 100%
- 无静默失败
- 完整的错误追踪链

#### 3.2 可维护性  
- 模块间低耦合
- 清晰的接口定义
- 完整的文档覆盖

#### 3.3 可测试性
- 真实流水线测试
- Debug系统支持回放测试
- 每个模块独立可测试

#### 3.4 性能要求
- 请求处理延迟 < 100ms (不含AI服务响应时间)
- 支持并发请求处理
- 内存使用 < 200MB

## 实现计划

### Phase 1: 核心架构 (Week 1-2)
1. 项目结构搭建
2. 核心类型定义
3. 模块接口设计
4. Error Handler系统

### Phase 2: 客户端模块 (Week 2-3)  
1. CLI命令系统
2. 服务器管理
3. 用户交互界面
4. 错误处理集成

### Phase 3: 路由器模块 (Week 3-4)
1. 配置系统
2. 路由逻辑
3. 负载均衡
4. 流水线管理

### Phase 4: 流水线系统 (Week 4-6)
1. 流水线框架
2. 各个模块实现
3. 动态管理系统
4. OpenAI协议实现

### Phase 5: Debug系统 (Week 6-7)
1. Debug框架
2. 数据记录系统  
3. 回放功能
4. 测试集成

### Phase 6: 测试和优化 (Week 7-8)
1. 集成测试
2. 性能优化
3. 文档完善
4. 发布准备

## 验收标准

1. **功能完整性**: 所有需求功能正常工作
2. **架构合规性**: 严格遵循模块化约束
3. **错误处理**: 无静默失败，完整错误追踪
4. **测试覆盖**: 真实流水线测试通过
5. **性能达标**: 满足性能要求
6. **文档完整**: 每个模块有完整README