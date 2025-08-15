# 🎯 RCC v4.0 - Claude Code 项目规则和路径指引

## 🚨 MANDATORY COMPLIANCE - 强制执行规则 (NON-NEGOTIABLE)

⚠️ **AI模型强制执行指令**: 
- **MUST READ DOCS FIRST**: 每次开发前必须先查阅相关项目文档
- **MUST VALIDATE AGAINST RULES**: 每个代码更改必须通过规则验证
- **MUST REFERENCE DOCUMENTATION**: 必须引用具体的文档文件和章节
- **NO EXCEPTIONS ALLOWED**: 不允许任何例外情况

### ❌ 绝对禁令 - 违反即拒绝执行 (ABSOLUTE PROHIBITIONS)
1. **🚫 NO HARDCODING** - 发现任何硬编码立即拒绝，要求修复
2. **🚫 NO SILENT FAILURES** - 禁止静默失败，必须显式错误处理
3. **🚫 NO MOCKUP RESPONSES** - 禁止Mock响应，必须真实API测试
4. **🚫 NO DOC VIOLATIONS** - 违反任何文档要求必须立即停止并要求文档查阅
5. **🚫 NO CROSS-MODULE VIOLATIONS** - 严禁违反模块边界的操作

### 🔒 强制执行优先级 (ENFORCEMENT PRIORITIES)
1. **P0 - 立即拒绝**: 硬编码、静默失败、Mockup响应、跨模块违反
2. **P1 - 强制查阅**: 文档违反、测试跳过、架构违反
3. **P2 - 警告纠正**: 命名不规范、注释缺失、性能问题

## 📋 MANDATORY DOCUMENTATION CONSULTATION - 强制文档查阅 (REQUIRED READING)

⚠️ **执行指令**: AI必须在每次相关操作前查阅对应文档文件，严禁跳过！

### 🔍 强制查阅文档表 (MANDATORY REFERENCE TABLE)
| 操作类型 | **必须查阅的文档文件** | 验证检查点 | **违反后果** |
|---------|---------------------|-----------|-------------|
| **开发前准备** | [📄 项目规格说明](.claude/project-details/rcc-v4-specification.md) | 项目需求、架构理解验证 | **立即拒绝开发** |
| **编写代码** | [📄 核心编程规范](.claude/rules/programming-rules.md) | 零硬编码、零静默失败检查 | **立即拒绝执行** |
| **架构设计** | [📄 架构设计规则](.claude/rules/architecture-rules.md) | 六层架构、模块边界验证 | **强制重新设计** |
| **模块开发** | [📄 模块设计文档](.claude/project-details/modules/README.md) | 模块接口、职责验证 | **拒绝跨模块操作** |
| **客户端开发** | [📄 客户端设计文档](.claude/project-details/client-module-design.md) | 客户端架构、接口验证 | **拒绝架构违反** |
| **脚本开发** | [📄 开发脚本规格](.claude/project-details/modules/development/README.md) | 脚本权限、执行规范检查 | **拒绝权限违反** |
| **测试开发** | [📄 测试框架规范](.claude/rules/testing-rules.md) | 真实流水线测试验证 | **拒绝Mock测试** |
| **项目结构** | [📄 项目结构设计](.claude/project-details/rcc-v4-project-structure.md) | 目录结构、文件组织检查 | **拒绝错误结构** |
| **快速查阅** | [📄 快速参考卡](.claude/rules/quick-reference.md) | P0级红线、常用规范 | **要求详细文档查阅** |

### 🚫 违规处理程序 (VIOLATION HANDLING)
1. **发现违规** → 立即停止当前操作
2. **强制查阅** → 要求查阅相关文档文件
3. **规则验证** → 根据文档重新执行操作
4. **文档引用** → 在回应中明确引用文档章节
5. **合规确认** → 验证操作符合所有相关文档要求

## 🏗️ 项目架构概览 (Project Architecture)

### 基本信息
- **项目名称**: Route Claude Code (RCC) v4.0
- **核心功能**: 模块化AI路由转换系统，支持多Provider智能切换
- **当前架构**: v4.0模块化六层架构
- **支持协议**: Anthropic, OpenAI-Compatible, Google Gemini, AWS CodeWhisperer
- **配置路径**: `~/.route-claudecode/` (v4.0项目)

### 🎯 v4.0模块化六层架构

基于**严格模块边界**和**零耦合原则**的六层架构：

```
Client Module ↔ Router Module ↔ Processor Module ↔ Transformer Module ↔ Provider Module ↔ Server Module
```

#### 📐 核心模块设计 (v4.0稳定版)

**🔄 请求处理流程**:
1. **Server Module** (`src/server/`): HTTP服务和请求分发
2. **Provider Module** (`src/provider/`): 第三方API通信管理
3. **Transformer Module** (`src/transformer/`): **格式转换核心**
4. **Processor Module** (`src/processor/`): 数据处理和验证
5. **Router Module** (`src/router/`): 智能路由和负载均衡
6. **Client Module** (`src/client/`): 客户端接口和SDK

#### 🚨 关键架构原则
- **零硬编码**: 所有配置外部化，严禁硬编码
- **零静默失败**: 显式错误处理和报告
- **零Mock测试**: 真实API流水线测试
- **严格模块边界**: 禁止跨模块直接调用
- **标准化接口**: 统一的模块间通信协议

## 🔄 MANDATORY WORKFLOW - 强制执行工作流 (REQUIRED EXECUTION)

⚠️ **AI执行指令**: 必须严格按照以下流程执行，不允许跳步或简化！

### 🔒 开发工作流 - 强制流程 (MANDATORY STEPS)
1. **[REQUIRED]** 文档查阅 → 查阅相关项目文档和规范 ✅ 必须完成
2. **[REQUIRED]** 架构验证 → 验证设计符合模块化架构 ✅ 必须验证
3. **[REQUIRED]** 编码实现 → 遵循编程规范进行开发 ✅ 必须检查
4. **[REQUIRED]** 真实测试 → 执行真实流水线测试 ✅ 必须执行
5. **[REQUIRED]** 文档同步 → 同步变更到相关文档 ✅ 必须更新
6. **[REQUIRED]** 构建验证 → 完整构建和部署验证 ✅ 必须确认

### 🚨 问题调试 - 强制程序 (MANDATORY DEBUGGING)
1. **[STEP 1]** 强制查阅相关文档和规范 - **违反此步骤将拒绝继续**
2. **[STEP 2]** 强制运行真实流水线测试 - **跳过真实测试将被拒绝**
3. **[STEP 3]** 强制进行错误链路分析 - **未定位具体模块将拒绝修复**
4. **[STEP 4]** 强制修复验证循环 - **未达到100%成功率不允许完成**
5. **[STEP 5]** 强制更新文档和规范 - **缺失文档将被退回**

### ⛔ 工作流违规警告 (WORKFLOW VIOLATIONS)
- **跳过文档查阅** → 立即终止，要求重新开始
- **未进行架构验证** → 拒绝代码实现
- **使用Mock测试** → 拒绝接受代码
- **遗漏文档同步** → 要求补充后才能继续

## 📋 TASK EXECUTION SYSTEM - 任务执行系统 (MANDATORY TASK MANAGEMENT)

⚠️ **任务执行强制指令**: 所有开发任务必须通过标准任务管理系统执行，严禁绕过！

### 🎯 项目实施状态 (PROJECT IMPLEMENTATION STATUS)

**当前阶段**: 📋 **规划完成，代码实施阶段**  
**整体进度**: **15%** (设计完成，开发未开始)  
**紧急优先级**: **P0级 - 立即开始Phase 1 Week 1任务**  

### 📊 强制查阅文件 (MANDATORY TASK FILES)

| 文件名 | **文件路径** | 用途描述 | **使用时机** |
|--------|-------------|----------|-------------|
| **实施计划** | `IMPLEMENTATION-PLAN.md` | 8周详细开发计划、15个核心模块 | **每次开发前必须查阅** |
| **任务跟踪** | `TASK-TRACKING.md` | 实时进度监控、每日任务状态 | **每日必须更新进度** |
| **质量清单** | `QUALITY-CHECKLIST.md` | P0/P1/P2质量标准、检查清单 | **每次提交前必须验证** |
| **项目状态** | `PROJECT-STATUS.md` | 完成度报告、差距分析 | **每周必须审查状态** |

### 🔥 当前紧急任务 (CURRENT URGENT TASKS) - P0级立即执行

⚠️ **立即开始**: 按照IMPLEMENTATION-PLAN.md Phase 1 Week 1 执行

#### 📅 Phase 1 Week 1: 项目基础 (立即开始)

**Day 1-2: 项目初始化** (P0级紧急)
- [ ] 创建项目目录结构: `mkdir -p src/{types,error-handler,config,debug,build,client,router,pipeline}`
- [ ] 配置TypeScript环境: `npm init -y && npm install typescript @types/node`
- [ ] 设置Jest测试框架: `npm install --save-dev jest @types/jest`
- [ ] 配置ESLint + Prettier: 建立代码规范检查
- [ ] 每日更新TASK-TRACKING.md进度状态

**Day 3-4: 核心类型定义模块** (P0级)
- [ ] 实现 `src/types/core-types.ts` (基于.claude/project-details/modules/types/README.md)
- [ ] 实现 `src/types/request-response-types.ts` - RCCRequest/RCCResponse接口
- [ ] 实现 `src/types/error-types.ts` - ErrorType枚举和RCCError接口
- [ ] 实现类型导出入口 `src/types/index.ts`
- [ ] 编写类型验证测试 `src/types/__tests__/`

**Day 5-7: 错误处理系统** (P0级)
- [ ] 实现 `src/error-handler/error-handler.ts` (基于.claude/project-details/modules/error-handler/README.md)
- [ ] 实现统一错误处理器类和错误分类机制
- [ ] 实现错误日志记录和格式化系统
- [ ] 编写错误处理测试，验证所有错误路径

### 🔄 任务执行工作流 (TASK EXECUTION WORKFLOW)

#### 每日执行流程 (DAILY EXECUTION)
1. **[08:00]** 查阅TASK-TRACKING.md确认今日任务
2. **[09:00]** 开始具体模块开发，遵循.claude/rules规范
3. **[12:00]** 中午进度检查，更新任务状态
4. **[17:00]** 晚间验证，运行质量检查清单
5. **[18:00]** 更新TASK-TRACKING.md，记录问题和进度

#### 每周审查流程 (WEEKLY REVIEW)
1. **周一**: 查阅IMPLEMENTATION-PLAN.md确认周目标
2. **周三**: 中期进度检查，识别风险和阻塞
3. **周五**: 里程碑验证，更新PROJECT-STATUS.md
4. **周日**: 准备下周任务，调整计划细节

### 🚨 任务执行强制约束 (MANDATORY TASK CONSTRAINTS)

#### P0级任务约束 (违反立即拒绝)
- **🚫 禁止跳过实施计划**: 所有开发必须按IMPLEMENTATION-PLAN.md执行
- **🚫 禁止忽略任务跟踪**: 每日必须更新TASK-TRACKING.md状态
- **🚫 禁止绕过质量检查**: 每次提交前必须通过QUALITY-CHECKLIST.md验证
- **🚫 禁止无文档开发**: 所有模块开发前必须查阅对应的.claude/project-details文档

#### P1级进度约束 (强制遵循)
- **📅 严格时间节点**: Phase 1必须在2周内完成所有基础模块
- **📊 每日进度更新**: 任务状态变更必须当天记录
- **🧪 真实测试验证**: 所有模块必须通过真实流水线测试
- **📚 文档同步更新**: 代码变更后必须同步更新相关文档

### ⚠️ 任务执行风险预警 (TASK EXECUTION RISKS)

#### 红色警报 (立即停止开发)
- Phase 1 Week 1任务未按计划启动
- 连续3天未更新任务跟踪状态
- P0级质量检查失败
- 关键模块开发严重偏离设计文档

#### 黄色预警 (需要关注)
- 单个任务执行时间超过预期50%
- 质量检查问题数量增加
- 团队成员分工不明确
- 文档更新滞后于代码变更

### 📈 成功执行指标 (SUCCESS METRICS)

- **每日任务完成率**: 目标100%
- **质量检查通过率**: 目标100%
- **文档同步及时率**: 目标100%
- **里程碑按时达成率**: 目标100%
- **团队协作效率**: 每日有效沟通

## 📁 项目文档路径指引 (Document Path Guide)

### 🔍 核心文档位置 (CORE DOCUMENTS)
```bash
# 项目规格和架构设计
.claude/project-details/rcc-v4-specification.md        # 项目需求规格
.claude/project-details/rcc-v4-detailed-design.md      # 详细设计文档
.claude/project-details/rcc-v4-project-structure.md    # 项目结构设计
.claude/project-details/client-module-design.md        # 客户端模块设计

# 开发规范和规则
.claude/rules/README.md                                # 规则总览
.claude/rules/programming-rules.md                     # 编程规范
.claude/rules/architecture-rules.md                    # 架构规则
.claude/rules/testing-rules.md                         # 测试规范
.claude/rules/quick-reference.md                       # 快速参考

# 模块化设计文档
.claude/project-details/modules/README.md              # 模块总览
.claude/project-details/modules/development/README.md  # 开发脚本规格
.claude/project-details/modules/client/README.md       # 客户端模块
.claude/project-details/modules/server/README.md       # 服务端模块
```

### 🚀 快速启动检查清单 (QUICK START CHECKLIST)
```bash
# 开发前强制检查
□ 阅读项目规格: .claude/project-details/rcc-v4-specification.md
□ 理解架构设计: .claude/rules/architecture-rules.md
□ 查看模块边界: .claude/project-details/modules/README.md
□ 了解编程规范: .claude/rules/programming-rules.md
□ 验证测试要求: .claude/rules/testing-rules.md

# 开发中检查
□ 零硬编码原则
□ 零静默失败原则
□ 零Mock测试原则
□ 严格模块边界
□ 标准化接口

# 完成后检查
□ 真实流水线测试通过
□ 文档同步完成
□ 构建验证成功
□ 规则验证通过
```

## 🧪 测试和验证标准 (Testing & Validation Standards)

### 🔄 真实流水线测试原则 (REAL PIPELINE TESTING)
- **禁止Mock响应**: 必须使用真实API进行测试
- **端到端验证**: 完整的六层架构流程测试
- **错误场景覆盖**: 包含所有错误处理路径
- **性能基准测试**: 响应时间和吞吐量验证

### 📊 质量门禁标准 (QUALITY GATES)
1. **代码质量**: 零硬编码、零静默失败
2. **架构合规**: 严格模块边界、标准化接口
3. **测试覆盖**: 真实API测试、错误场景覆盖
4. **文档同步**: 变更文档更新、规范遵循
5. **构建验证**: 完整构建成功、部署验证

## 🔧 开发工具和脚本 (Development Tools & Scripts)

### 📋 标准开发脚本 (Standard Development Scripts)
```bash
# 规则验证
.claude/rules/validate-rules.sh                        # 验证规则完整性

# 项目构建
./scripts/build.sh                                     # 构建项目
./scripts/test.sh                                      # 运行测试
./scripts/validate.sh                                  # 验证构建

# 开发辅助
./scripts/dev-setup.sh                                 # 开发环境设置
./scripts/module-template.sh                           # 模块模板生成
```

### 🛠️ 权限和执行规范 (Permission & Execution Standards)
- **脚本权限**: 遵循 `.claude/project-details/modules/development/README.md` 规格
- **命令标准化**: 避免权限审批的标准命令集
- **自动化执行**: 脚本化的开发和部署流程

## 📝 文档同步机制 (Documentation Sync Mechanism)

### 🔄 强制同步流程 (MANDATORY SYNC PROCESS)
1. **开发前**: 查阅相关文档，理解当前设计
2. **开发中**: 记录设计变更和决策
3. **开发后**: 同步变更到对应文档文件
4. **验证**: 确保文档和代码一致性

### 📋 文档更新检查清单 (DOC UPDATE CHECKLIST)
- [ ] **API文档**: 接口变更同步到模块文档
- [ ] **架构文档**: 架构决策更新到设计文档  
- [ ] **配置文档**: 配置变更更新到规格文档
- [ ] **测试文档**: 测试用例更新到测试规范
- [ ] **部署文档**: 部署流程更新到操作文档

## ⚡ COMPLIANCE VERIFICATION - 合规验证检查 (FINAL CHECK)

### 🔍 AI自检清单 (AI SELF-CHECK REQUIRED)
在执行任何操作前，AI必须通过以下检查：

- [ ] **文档查阅完成** - 已查阅相关项目文档和规范文件
- [ ] **架构合规验证** - 符合v4.0模块化架构要求
- [ ] **编程规范检查** - 零硬编码、零静默失败、零Mock确认
- [ ] **模块边界验证** - 严格模块边界、标准化接口确认
- [ ] **测试要求满足** - 真实流水线测试准备就绪
- [ ] **文档同步计划** - 变更文档更新方案确认
- [ ] **用户确认需求** - 识别需要用户确认的操作

**⚠️ 警告**: 未通过上述检查的操作将被自动拒绝执行！
**📚 特别提醒**: 文档优先原则 - 任何疑惑都必须先查阅项目文档！

---

## 🔗 MANDATORY RESOURCES - 强制访问资源 (REQUIRED ACCESS)

⚠️ **AI使用指令**: 以下资源在相关操作时必须查阅，不得跳过！

### 📁 必须查阅的文档文件 (MANDATORY DOCUMENT FILES)
- **[REQUIRED]** 项目详细设计: [📁 .claude/project-details/](.claude/project-details/) - **每次开发前必读**
- **[REQUIRED]** 开发规范规则: [📁 .claude/rules/](.claude/rules/) - **编码实现必读**
- **[REQUIRED]** 模块化架构: [📁 .claude/project-details/modules/](.claude/project-details/modules/) - **架构设计必读**

---

**📊 项目版本**: RCC v4.0  
**🔒 规则架构**: v1.0.0 (模块化强化版)  
**👤 项目所有者**: Route Claude Code Team  
**📅 最后更新**: 2025-08-15  
**⚡ 强制执行**: ACTIVE - 所有规则均为强制性  
**📚 文档驱动**: ACTIVE - 文档优先原则生效