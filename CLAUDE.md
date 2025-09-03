# Claude Code Router v4.0 - 强制项目执行规范

## 🌟 RCC4六层流水线数据格式规范 (CRITICAL ARCHITECTURE SPEC)

### 📋 六层架构数据流向和格式要求

**严格的数据流向规范**：

```
Client → Router → Transformer → Protocol → ServerCompatibility → Server → ResponseTransformer
  ↓       ↓          ↓           ↓              ↓              ↓            ↓
Anthropic Model    Anthropic   OpenAI        OpenAI         OpenAI      Anthropic
Format   Mapping   →OpenAI     Format        Format         Format      Format
         Decision   Transform   (STRICT)      (STRICT)       (STRICT)    Transform
```

### 🔒 各层格式要求 (MANDATORY COMPLIANCE)

#### 1. **Client Layer**: Anthropic格式
- 输入：用户请求，标准Claude格式
- 输出：Anthropic API格式请求

#### 2. **Router Layer**: 模型映射
- 输入：Anthropic格式 + 模型名
- 输出：Anthropic格式 + 路由决策
- **职责**: 仅做模型映射和路由选择，不改变格式

#### 3. **Transformer Layer**: Anthropic → OpenAI转换
- 输入：Anthropic格式请求
- 输出：**纯OpenAI格式请求**
- **职责**: 
  - 协议格式转换：Anthropic → OpenAI
  - 工具调用格式转换：Anthropic tools → OpenAI tools
  - **严禁输出任何Anthropic格式数据**

#### 4. **Protocol Layer**: OpenAI格式处理 ⚠️ CRITICAL
- 输入：**仅OpenAI格式**
- 输出：**仅OpenAI格式**
- **严禁规则**: 
  - ❌ 禁止任何Anthropic格式数据
  - ❌ 禁止在metadata/internal中包含Anthropic协议信息
  - ❌ 禁止Anthropic相关的字段或配置
- **职责**: 
  - 模型名映射和端点配置
  - **只能添加OpenAI兼容的配置信息**

#### 5. **ServerCompatibility Layer**: OpenAI格式内转换
- 输入：**仅OpenAI格式**
- 输出：**仅OpenAI格式** (Provider特定调整)
- **严禁规则**:
  - ❌ 禁止接收或产生Anthropic格式
  - ❌ 禁止Anthropic协议转换
- **职责**:
  - OpenAI格式内的字段调整 (如模型名、参数)
  - Provider特定的工具格式微调 (仍保持OpenAI标准)
  - 请求大小限制和优化

#### 6. **Server Layer**: HTTP API调用
- 输入：**仅OpenAI格式**
- 输出：Provider响应 (通常OpenAI格式)
- **职责**: 纯HTTP请求，无格式转换

#### 7. **ResponseTransformer Layer**: OpenAI → Anthropic转换
- 输入：Provider响应 (OpenAI格式)
- 输出：**Anthropic格式响应**
- **职责**: 响应格式转换回Anthropic标准

---

### 📖 OpenAI协议格式示例

#### OpenAI请求格式 (Protocol → ServerCompatibility → Server)
```json
{
  "model": "gemini-2.5-pro",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user", 
      "content": "列出本地文件"
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "list_files",
        "description": "List files in directory",
        "parameters": {
          "type": "object",
          "properties": {
            "path": {"type": "string"}
          },
          "required": ["path"]
        }
      }
    }
  ],
  "temperature": 0.7,
  "max_tokens": 4096,
  "stream": false
}
```

#### OpenAI响应格式 (Server → ResponseTransformer)
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gemini-2.5-pro",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "",
        "tool_calls": [
          {
            "id": "call_123",
            "type": "function",
            "function": {
              "name": "list_files",
              "arguments": "{\"path\": \".\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ]
}
```

### 🔍 Gemini协议格式示例

#### Gemini特定调整 (ServerCompatibility层处理)
```json
{
  "model": "gemini-2.5-pro",
  "messages": [
    {
      "role": "user",
      "content": "列出本地文件"
    }
  ],
  "tools": [
    {
      "type": "function", 
      "function": {
        "name": "list_files",
        "description": "List files in directory",
        "parameters": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "description": "Directory path to list"
            }
          },
          "required": ["path"]
        }
      }
    }
  ],
  "temperature": 0.7,
  "max_tokens": 4096,
  "top_p": 0.9
}
```

### ⚠️ 格式验证规则

#### Protocol层验证 (CRITICAL)
- ✅ 输入必须是OpenAI格式
- ✅ 输出必须是OpenAI格式  
- ❌ 禁止任何Anthropic字段 (`tools.input_schema`, `system`, `max_tokens` in Anthropic style)
- ❌ 禁止在`__internal`或metadata中存储Anthropic协议信息

#### ServerCompatibility层验证
- ✅ 输入输出都必须是OpenAI格式
- ✅ 只允许OpenAI格式内的字段调整
- ❌ 禁止协议转换 (Anthropic ↔ OpenAI)

#### 工具格式统一规则
- **Protocol层之后统一使用OpenAI工具格式**
- **Tools数组结构**：`[{type: "function", function: {name, description, parameters}}]`
- **禁止在Protocol层后出现Anthropic工具格式**：`[{name, description, input_schema}]`

---

## 🚨 强制执行指令 - 不可违反 (MANDATORY COMPLIANCE)

### 🔷 TypeScript-Only 强制政策 - 已实施 (TYPESCRIPT-ONLY ENFORCED)

**状态**: ✅ 已完成TypeScript-Only强制政策实施 (2025-08-16)

本项目强制要求**100% TypeScript开发**，任何JavaScript文件修改都将被自动拒绝：

- ✅ **禁止JavaScript文件修改**: 严禁修改任何 `.js` 文件，包括创建新的JavaScript文件
- ✅ **源代码100%TypeScript**: 所有 `src/` 目录下的文件必须使用 `.ts` 扩展名
- ✅ **编译文件保护**: 严禁直接修改 `dist/` 目录下的编译产物
- ✅ **TypeScript错误零容忍**: 禁止忽略编译错误，禁止使用 `@ts-ignore` 绕过
- ✅ **正确构建系统**: 使用 `./build-and-install.sh` 进行完整的TypeScript编译构建和全局安装
- ✅ **自动化检查**: Git pre-commit hooks和持续监控确保规则执行

**核心原则**: 严格类型安全，零JavaScript容忍，完整的TypeScript开发环境。

**强制执行工具**:
- `.claude/rules/scripts/typescript-only-check.sh` - 强制检查脚本
- `.claude/rules/scripts/dist-protection.sh` - 编译文件保护
- `.claude/rules/scripts/automated-compliance-check.sh` - 自动化合规检查
- `.claude/rules/scripts/compliance-monitor.sh` - 持续监控系统

**参考文档**: 
- `.claude/rules/typescript-only-policy.md` - TypeScript-Only强制政策
- `.claude/rules/typescript-development-workflow.md` - TypeScript开发工作流程

**⚠️ 违规处理**: 任何违反TypeScript-Only政策的行为将导致开发工作被立即拒绝。

---

### ⚡ ZERO FALLBACK POLICY - 已实施 (IMPLEMENTED)

**状态**: ✅ 已完成零Fallback策略实施 (2025-08-16)

本项目已完全实施**零Fallback策略**，消除了所有架构冲突：

**🔍 零Fallback策略明确定义**：
1. **零Fallback策略** = 禁止**跨Provider的降级策略**（如Anthropic失败后用OpenAI）
2. **流水线调度** = **同Provider内的负载均衡策略**（如多个API密钥、多个端点的主动切换）
3. **明确区分**：流水线调度是主动负载均衡功能，不是fallback机制

**实施措施**：
- ✅ **废弃跨Provider fallback**: CrossProviderFallbackStrategy、ConditionalFallbackResolver等已标记废弃
- ✅ **保留流水线调度**: 同Provider内的多流水线轮询切换是正常负载均衡功能
- ✅ **强化配置验证**: 强制要求 `zeroFallbackPolicy: true`，拒绝跨Provider fallback配置
- ✅ **统一错误处理**: 实施ZeroFallbackError统一错误类型，跨Provider失败时立即抛出错误
- ✅ **重构路由逻辑**: hybrid-multi-provider-router仅使用主Provider，移除跨Provider fallback路径
- ✅ **项目治理规则**: 建立`.claude/rules/`强制规则，防止跨Provider fallback机制重新引入
- ✅ **合规检查工具**: 创建自动化检查脚本，确保持续合规

**核心原则**: 
- ❌ 禁止跨Provider的静默降级或备用路由
- ✅ 允许同Provider内的流水线调度和负载均衡
- ✅ 流水线失败是预期行为，应通过负载均衡调度处理

**参考文档**: 
- `.claude/rules/zero-fallback-policy.md` - 零Fallback策略规则
- `.claude/rules/zero-fallback-error-types.md` - 统一错误类型标准
- `src/interfaces/core/zero-fallback-errors.ts` - 错误类型实现

---

## 🧪 API驱动的解耦测试框架

### 🎯 设计目标

为RCC v4.1模块化架构设计的API驱动解耦测试框架，通过标准化API接口实现模块间的松耦合测试，支持：

1. **单元测试**：各模块独立功能测试
2. **集成测试**：模块间接口和数据流验证
3. **端到端测试**：完整请求处理流程测试
4. **性能测试**：系统性能和响应时间评估

### 🏗️ 架构设计

#### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    测试客户端层                              │
├─────────────────────────────────────────────────────────────┤
│  单元测试客户端  │  集成测试客户端  │  端到端测试客户端     │
├─────────────────────────────────────────────────────────────┤
│                    测试API网关层                              │
├─────────────────────────────────────────────────────────────┤
│  模块测试API    │  集成测试API    │  系统测试API            │
├─────────────────────────────────────────────────────────────┤
│                    被测系统层                                │
├─────────────────────────────────────────────────────────────┤
│  客户端模块API  │  路由器模块API  │  流水线模块API          │
└─────────────────────────────────────────────────────────────┘
```

### 🔌 API接口规范

#### 通用响应格式

```typescript
interface TestResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    timestamp: string;
    duration: number;
    requestId: string;
  };
}
```

#### 核心测试API端点

##### 客户端模块测试API
```
GET    /api/v1/client/health                    # 健康检查
POST   /api/v1/client/cli/command               # CLI命令测试
POST   /api/v1/client/http/request              # HTTP客户端测试
POST   /api/v1/client/session/create            # 会话管理测试
GET    /api/v1/client/stats                     # 统计信息测试
POST   /api/v1/client/proxy/connect             # 代理功能测试
```

##### 路由器模块测试API
```
GET    /api/v1/router/health                    # 健康检查
POST   /api/v1/router/config/load               # 配置加载测试
POST   /api/v1/router/route/request             # 路由功能测试
GET    /api/v1/router/pipeline/status           # 流水线状态测试
POST   /api/v1/router/loadbalancer/test         # 负载均衡测试
```

##### 流水线模块测试API
```
GET    /api/v1/pipeline/health                  # 健康检查
POST   /api/v1/pipeline/execute                 # 流水线执行测试
GET    /api/v1/pipeline/modules/list            # 模块列表测试
POST   /api/v1/pipeline/modules/test            # 子模块测试
GET    /api/v1/pipeline/stats                   # 性能统计测试
```

### 📊 测试执行流程

#### 1. 测试准备阶段
1. API注册：各模块启动时注册测试API端点
2. 配置加载：测试配置管理器加载测试环境配置
3. 数据准备：测试数据管理器准备测试数据
4. 资源初始化：测试执行器初始化所需资源

#### 2. 测试执行阶段
1. 独立测试：各模块独立运行单元测试
2. 集成测试：通过API网关执行模块间集成测试
3. 端到端测试：模拟真实请求执行完整流程测试
4. 性能测试：并发调用API评估系统性能

#### 3. 测试报告阶段
1. 结果收集：从各模块API收集测试结果
2. 数据分析：分析测试数据和性能指标
3. 报告生成：生成详细测试报告
4. 问题追踪：记录和追踪发现的问题

### 🔄 CI/CD集成

#### GitHub Actions工作流
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run unit tests
        run: npm run test:unit

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run integration tests
        run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run end-to-end tests
        run: npm run test:e2e

  performance-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run performance tests
        run: npm run test:performance
```

⚠️ **AI开发者必须严格遵循**: 本项目采用严格的任务驱动开发模式，所有开发工作必须按照`tasks.md`中的任务计划执行。违反者将被拒绝继续工作。

### 📋 强制执行的开发流程 (MANDATORY DEVELOPMENT WORKFLOW)

#### 1. **任务执行前检查 (PRE-TASK VALIDATION)**
在开始任何开发工作前，必须：
- [ ] 检查`tasks.md`中的任务状态和依赖关系
- [ ] 确认前置任务已100%完成且测试通过
- [ ] 验证当前任务的验收标准和测试要求
- [ ] 更新任务状态为"🚧 进行中"
- [ ] 阅读相关模块的开发指南 (`MODULE-DEVELOPMENT-GUIDE.md`)

#### 2. **开发过程约束 (DEVELOPMENT CONSTRAINTS)**
开发过程中必须：
- [ ] **TypeScript-Only合规**: 运行 `bash .claude/rules/scripts/typescript-only-check.sh` 确保TypeScript规范
- [ ] **零JavaScript文件**: 禁止创建或修改任何 `.js` 文件，只能使用 `.ts` 文件
- [ ] **编译前检查**: 使用 `npm run type-check` 确保无TypeScript错误
- [ ] **零代码重复**: 检查examples目录下的参考实现，复用可用组件
- [ ] **接口优先**: 根据`.claude/project-details/`中的设计文档定义接口
- [ ] **测试驱动**: 先写测试，再写实现代码
- [ ] **实时文档**: 同步更新代码注释和设计文档
- [ ] **模块化开发**: 严格按照`MODULE-DEVELOPMENT-GUIDE.md`进行模块开发

#### 3. **完成前验证 (PRE-COMPLETION VALIDATION)**
任务完成前必须：
- [ ] **TypeScript合规检查**: 运行 `bash .claude/rules/scripts/automated-compliance-check.sh` 通过所有检查
- [ ] **TypeScript编译**: 确保 `npm run build` 无错误
- [ ] **类型覆盖率**: 达到95%+类型覆盖率 (使用 `npx type-coverage`)
- [ ] **单元测试**: 达到80%+代码覆盖率
- [ ] **真实API测试**: 与LM Studio进行真实API调用测试
- [ ] **性能基准**: 满足延迟(<100ms)和内存(<200MB)要求
- [ ] **集成测试**: 通过端到端流水线测试
- [ ] **更新文档**: 同步更新相关设计文档和API文档
- [ ] **模块文档**: 确保模块README文档完整准确

#### 4. **任务完成确认 (TASK COMPLETION CONFIRMATION)**
完成任务时必须：
- [ ] 在`tasks.md`中更新任务状态为"✅ 已完成"
- [ ] 记录测试报告和API响应数据
- [ ] 提交代码审查请求
- [ ] 更新下一个任务的前置条件

### 🎯 项目总体目标 (PROJECT OBJECTIVES)

#### **核心目标**: 构建Claude Code Router v4.0
一个高性能、可扩展的多AI提供商路由转换系统，支持：
- **主要协议**: OpenAI兼容接口（优先LM Studio）
- **核心功能**: 请求路由、格式转换、负载均衡、错误处理
- **质量标准**: 零fallback、零静默失败、<100ms延迟
- **可扩展性**: 插件化架构，支持动态添加新的AI Provider

#### **开发优先级**: 渐进式实现策略
1. **Phase 1-2**: 核心架构和CLI系统 (Week 1-2)
2. **Phase 3-4**: LM Studio路由和流水线 (Week 3-4)  
3. **Phase 5-6**: Debug系统和性能优化 (Week 5-6)
4. **Phase 7+**: 扩展其他Provider (Anthropic/OpenAI/Gemini)

### 🔧 技术实现要求 (TECHNICAL REQUIREMENTS)

#### **架构约束 (ARCHITECTURE CONSTRAINTS)**
- **模块化设计**: 严格遵循12大核心模块架构
- **接口标准**: 严格按照模块开发指南和各模块README文档
- **零硬编码**: 所有配置通过配置文件管理
- **类型安全**: 使用TypeScript，严格类型检查

#### **构建和部署规范 (BUILD AND DEPLOYMENT STANDARDS)**
- **标准构建流程**: 必须使用 `./build-and-install.sh` 进行构建和全局安装
- **构建步骤**:
  1. 清理previous builds (`rm -rf dist/`)
  2. 安装依赖 (`npm install`)
  3. TypeScript编译 (`npm run build`)
  4. 验证编译输出 (`dist/cli.js` 存在)
  5. 创建npm包 (`npm pack`)
  6. 卸载旧版本 (`npm uninstall -g`)
  7. 全局安装 (`npm install -g <package>.tgz`)
  8. 验证安装 (`rcc4 --version`)
- **禁止使用**: 任何直接复制.js文件或跳过TypeScript编译的脚本
- **错误脚本**: 已删除 `install-rcc4-global.sh`, `npm-global-install.sh`, `rcc-simple.js` 等错误实现
- **全局命令**: 安装后必须提供 `rcc4` 全局命令

#### **质量标准 (QUALITY STANDARDS)**
- **代码覆盖率**: 单元测试80%+，集成测试90%+，端到端100%
- **性能基准**: 响应延迟<100ms，内存使用<200MB
- **错误处理**: 零静默失败，完整错误链追踪
- **日志记录**: 结构化日志，支持调试和监控
- **文档完整**: 每个模块必须有完整的README文档

#### **测试要求 (TESTING REQUIREMENTS)**
```typescript
// 每个任务必须包含以下测试类型：

// 1. 单元测试示例
describe('RouterModule', () => {
  it('should route request to correct provider', async () => {
    // 测试代码
  });
});

// 2. 真实API测试示例  
describe('LMStudio Integration', () => {
  it('should complete real API call within 100ms', async () => {
    const response = await router.route({
      provider: 'lmstudio',
      model: 'llama-3.1-8b',
      messages: [/* 测试消息 */]
    });
    expect(response.latency).toBeLessThan(100);
  });
});

// 3. 端到端测试示例
describe('End-to-End Pipeline', () => {
  it('should process complete request pipeline', async () => {
    // 完整流水线测试
  });
});
```

### 📊 进度跟踪和报告 (PROGRESS TRACKING)

#### **每日进度报告模板**
```markdown
## 日期: YYYY-MM-DD
### 当前任务: [任务ID] 任务名称
- **状态**: 🚧 进行中 / ✅ 已完成 / ❌ 阻塞
- **完成度**: X%
- **今日工作**: 具体完成的工作内容
- **测试结果**: 单元测试X个通过，API测试X个通过
- **遇到问题**: 具体问题描述和解决方案
- **明日计划**: 下一步工作计划
- **文档更新**: 更新的模块文档列表
```

#### **任务状态更新要求**
在`tasks.md`中实时更新任务状态：
- **⏳ 待开始**: 任务尚未开始
- **🚧 进行中**: 任务正在进行
- **✅ 已完成**: 任务已完成并通过所有测试
- **❌ 阻塞**: 任务遇到阻塞，需要解决
- **🔄 重做**: 任务需要重新执行

### 🔍 参考实现指南 (REFERENCE IMPLEMENTATION GUIDE)

#### **Examples目录结构和用途**
```
examples/
├── demo1/          # TypeScript实现参考 - 中间件和路由逻辑
├── demo2/          # Go语言实现参考 - SSE解析和并发处理  
├── demo3/          # JavaScript实现参考 - Provider策略模式
└── lmstudio-reference-pipeline.ts  # LM Studio专用流水线参考
```

#### **参考实现复用策略**
1. **demo1**: 借鉴中间件架构和路由策略实现
2. **demo2**: 参考SSE流解析和错误处理逻辑
3. **demo3**: 学习Provider策略模式和适配器设计
4. **lmstudio-pipeline**: 直接复用LM Studio集成逻辑

### ⚠️ 违规处理机制 (VIOLATION HANDLING)

#### **自动拒绝条件**
以下行为将导致开发工作被自动拒绝：
- 未检查`tasks.md`任务状态就开始编码
- 跳过测试要求或使用mock代替真实API测试
- 未更新任务进度和文档
- 违反架构设计约束
- 提交未通过质量检查的代码
- 未遵循模块开发指南

#### **质量控制检查清单**
在每次提交前，必须通过以下检查：
- [ ] 代码符合TypeScript严格模式要求
- [ ] 单元测试覆盖率达到80%+
- [ ] 真实API测试全部通过
- [ ] 性能基准测试达标
- [ ] 代码注释和文档完整
- [ ] 任务状态和进度已更新
- [ ] 模块README文档已更新
- [ ] 遵循`MODULE-DEVELOPMENT-GUIDE.md`开发规范

### 🎯 成功标准 (SUCCESS CRITERIA)

#### **阶段性里程碑**
- **Week 1**: 核心架构和CLI基础完成
- **Week 2**: 配置系统和模块管理实现
- **Week 3**: LM Studio路由器核心功能
- **Week 4**: 完整的LM Studio流水线集成
- **Week 5**: Debug系统和监控实现
- **Week 6**: 性能优化和最终测试

#### **最终交付标准**
- **功能完整性**: 支持LM Studio的完整请求-响应流水线
- **性能达标**: 平均响应时间<100ms，并发支持100+请求
- **质量保证**: 零已知bug，100%端到端测试覆盖
- **文档完整**: 完整的API文档、部署指南和用户手册
- **可扩展性**: 支持快速添加新的AI Provider
- **模块化**: 12大核心模块完整实现，每个模块有详细文档

---

## 📋 当前任务执行状态

**查看详细任务计划**: [tasks.md](./tasks.md)

**查看模块开发指南**: [MODULE-DEVELOPMENT-GUIDE.md](./MODULE-DEVELOPMENT-GUIDE.md)

**查看模块文档**: [README.md](./README.md)

**当前阶段**: Phase 1 - 核心架构设计与实现

**下一个任务**: 请查阅`tasks.md`确定当前需要执行的任务

---

**⚠️ 重要提醒**: 本项目采用严格的质量控制标准。任何偷工减料或跳过测试的行为都将导致工作被拒绝。请严格按照任务计划、质量要求和模块开发指南执行开发工作。