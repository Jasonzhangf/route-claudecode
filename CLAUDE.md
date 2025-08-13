# 🎯 Claude Code Router - 项目规则总览

## 🚨 MANDATORY COMPLIANCE - 强制执行规则 (NON-NEGOTIABLE)

⚠️ **AI模型强制执行指令**: 
- **MUST READ RULES FIRST**: 每次回应前必须先查阅相关规则文件
- **MUST VALIDATE AGAINST RULES**: 每个代码更改必须通过规则验证
- **MUST REFERENCE DOCUMENTATION**: 必须引用具体的规则文件和章节
- **NO EXCEPTIONS ALLOWED**: 不允许任何例外情况

### ❌ 绝对禁令 - 违反即拒绝执行 (ABSOLUTE PROHIBITIONS)
1. **🚫 NO HARDCODING** - 发现任何硬编码立即拒绝，要求修复
2. **🚫 NO FALLBACK MECHANISMS** - 禁止任何形式的fallback或默认值降级
3. **🚫 NO AUTO-PUBLISHING** - 禁止自主发布，必须用户明确确认
4. **🚫 NO RULE VIOLATIONS** - 违反任何规则必须立即停止并要求规则查阅
5. **🚫 NO ARCHITECTURE VIOLATIONS** - 严禁违反架构的操作，详见架构保护规则

### 🔒 强制执行优先级 (ENFORCEMENT PRIORITIES)
1. **P0 - 立即拒绝**: 硬编码、Fallback、自主发布、架构违反
2. **P1 - 强制查阅**: 架构违反、测试跳过、文档缺失、记忆缺失
3. **P2 - 警告纠正**: 命名不规范、注释缺失、性能问题

### 🏛️ 架构保护规则 (ARCHITECTURE PROTECTION RULES) - P0级别强制执行

⚠️ **架构已确定 - 严禁违反** (ARCHITECTURE FINALIZED - VIOLATIONS FORBIDDEN)

**📐 当前架构状态**: v2.7.0生产稳定 + v3.0插件化基础完成
**🔒 保护级别**: 最高级 - 任何违反立即拒绝执行
**📋 架构确认**: 29个主要任务已100%完成，架构定型

#### ❌ 严格禁止的架构违反操作 (STRICTLY FORBIDDEN OPERATIONS)

**🚫 文件系统操作禁令**:
1. **禁止创建新文件** - 除非用户明确标注`[架构修复]`
2. **禁止创建新测试文件** - 不允许任何新的测试文件创建
3. **禁止创建新文件夹** - 现有目录结构已定型，严禁新增
4. **禁止跨节点修复** - 不允许跨组件/模块的修改操作

**🚫 代码结构操作禁令**:
1. **禁止新增模块** - src/目录结构已确定
2. **禁止新增插件** - 插件架构已完善
3. **禁止新增Provider** - Provider系统已标准化
4. **禁止新增测试类别** - 测试框架已完整

**🚫 配置架构操作禁令**:
1. **禁止新增配置文件** - 配置架构已标准化
2. **禁止修改目录结构** - 六层架构已确定
3. **禁止新增依赖项** - package.json依赖已锁定

#### ✅ 唯一例外条件 (ONLY EXCEPTION CONDITION)

**🔧 [架构修复] 标识符**:
- 只有当用户在请求中明确包含 `[架构修复]` 标识符时
- 才被允许执行可能违反架构保护的操作
- 此时必须：
  1. 先查阅项目记忆相关架构决策
  2. 调用记忆专家保存架构修复决策
  3. 详细说明修复原因和影响范围
  4. 更新相关文档

#### 🔍 架构合规检查清单 (ARCHITECTURE COMPLIANCE CHECKLIST)

每次操作前必须通过以下检查：
- [ ] 是否创建新文件？→ **如否则继续，如是则检查[架构修复]标识**
- [ ] 是否创建新目录？→ **如否则继续，如是则检查[架构修复]标识**
- [ ] 是否跨模块修改？→ **如否则继续，如是则检查[架构修复]标识**
- [ ] 是否新增依赖？→ **如否则继续，如是则检查[架构修复]标识**
- [ ] 用户是否明确标注[架构修复]？→ **如否则拒绝，如是则执行架构修复流程**

#### 🚨 违反处理程序 (VIOLATION HANDLING PROCEDURE)

**发现架构违反 → 执行以下步骤**:
1. **立即停止** - 停止当前所有操作
2. **明确拒绝** - 向用户说明违反了架构保护规则
3. **引用规则** - 引用此架构保护规则章节
4. **建议替代** - 如有可能，建议在现有架构内的替代方案
5. **要求标识** - 如确需修复，要求用户添加`[架构修复]`标识

#### 📝 架构保护声明 (ARCHITECTURE PROTECTION STATEMENT)

> **Claude Code Router架构已经过29个主要任务的系统性开发和验证，当前架构为生产级稳定状态。为保证系统稳定性和一致性，任何可能影响架构的操作都被严格禁止，除非明确标注为架构修复需求。此规则优先级为P0，违反将被立即拒绝执行。**

### 🧠 MEMORY MANAGEMENT - 记忆管理强制规则 (MANDATORY MEMORY)

⚠️ **AI记忆强制执行指令**:
- **MUST CHECK MEMORY FIRST**: 每次遇到问题必须先查阅 [📁 项目记忆](~/.claudecode/Users-fanzhang-Documents-github-route-claudecode/) 目录
- **MUST SAVE ARCHITECTURE CHANGES**: 架构变更后必须调用记忆专家保存经验
- **MUST TRACK LONG TASKS**: 长任务执行必须有记忆保存和提取机制
- **MUST UPDATE DOCS AFTER CHANGES**: 架构变更后必须更新相关文档
- **🆕 MUST USE MEMORY AGENT FOR SUMMARIES**: 创建总结文档时必须调用 project-memory-manager agent
- **🆕 NO DIRECT SUMMARY CREATION**: 禁止直接在项目目录创建总结文档，只能通过记忆agent保存到项目记忆目录

#### 📁 项目记忆目录检查 (MEMORY DIRECTORY CHECK)
**当前记忆文件** (必须定期查阅):
- `AI调试复杂系统时的认知偏差与纠正策略.md` - 调试方法论
- `CODEWHISPERER-REFACTOR-SUMMARY.md` - CodeWhisperer重构经验
- `硬编码模型名导致路由映射错误的根本问题.md` - 硬编码问题分析
- `系统性测试验证方法论在架构修复中的应用.md` - 测试方法论
- `零硬编码原则在系统设计中的重要性.md` - 设计原则
- `工具调用错误检测与捕获系统架构设计.md` - 工具调用错误检测系统
- `v2.7.0版本增强错误捕获系统和日志优化带来显著稳定性提升.md` - v2.7.0版本优化经验

#### 📁 项目记忆目录路径
- **主路径**: `~/.claudecode/Users-fanzhang-Documents-github-route-claudecode/`
- **正确路径格式**: `~/.claudecode/Users-{username}-{project-directory}/`
- **命名约定**: `YYYYMMDD-HHMMSS-[descriptive-english-id].md`
- **重要提醒**: 所有项目记忆都必须存储在此路径下，严禁在其他位置创建记忆文件
- **最新记忆**: `20250802-175031-concurrency-routing-rate-limiting-architecture.md`
- **路径验证**: 每次创建记忆文件前必须验证路径正确性

#### ⚠️ 记忆路径规范警告 (MEMORY PATH COMPLIANCE WARNING)
**绝对禁止的路径**: 
- ❌ `./memory/` - 项目相对路径
- ❌ `docs/memory/` - 文档目录路径
- ❌ `.claude/memory/` - 规则目录路径
- ❌ `~/Documents/` - 用户文档路径

**唯一正确的路径**: ✅ `~/.claudecode/Users-fanzhang-Documents-github-route-claudecode/`

**路径验证命令**:
```bash
# 验证记忆目录是否存在
ls -la ~/.claudecode/Users-fanzhang-Documents-github-route-claudecode/

# 检查最新记忆文件
ls -la ~/.claudecode/Users-fanzhang-Documents-github-route-claudecode/ | tail -5
```

#### 🔄 强制记忆工作流 (MANDATORY MEMORY WORKFLOW)
1. **问题遇到** → 先查阅项目记忆目录相关文件
2. **方案制定** → 参考现有记忆中的解决方案
3. **架构变更** → 变更前调用记忆专家总结
4. **执行完成** → 成功/失败经验必须保存到记忆
5. **🆕 总结创建** → 根据AI类型选择记忆保存方式：
   - **Claude Code用户**: 调用 `project-memory-manager` agent 保存总结到项目记忆目录
   - **其他AI**: 直接总结当前发现和细节为有条理的记忆，用一句话总结+日期时间命名保存到项目记忆目录
6. **文档更新** → 更新架构相关文档

#### 📝 记忆保存格式规范 (MEMORY SAVING FORMAT)
- **文件命名**: `YYYYMMDD-HHMMSS-[descriptive-english-id].md`
- **一句话总结**: 文件开头必须包含问题/解决方案的一句话总结
- **时间戳**: 创建时间必须在文件名和内容中体现
- **结构化内容**: 包含问题背景、解决方案、技术细节、关键经验

## 🔗 重要命名规范说明 (IMPORTANT NAMING CONVENTION CLARIFICATION)

### 📝 Provider vs Provider-Protocol 命名澄清

⚠️ **重要架构概念区分**:

- **Provider-Protocol (提供商协议)**: 
  - 我们实现的协议处理逻辑 (如 `src/provider/anthropic/`, `src/provider/openai/`)
  - 配置中的 `"type": "openai"` 字段指的是 Provider-Protocol 类型
  - 负责与第三方服务通信的协议实现层
  
- **Provider (第三方服务提供商)**:
  - 实际的AI服务提供商 (如 ShuaiHong, LM Studio, ModelScope, Google API等)
  - 配置中的 `providers` 对象中的键名代表第三方Provider (如 `"shuaihong-openai"`)
  - 提供实际AI模型服务的第三方服务器

### 📋 配置示例说明
```json
{
  "providers": {
    "shuaihong-openai": {                    // ← 第三方Provider名称
      "type": "openai",                      // ← Provider-Protocol类型
      "endpoint": "https://ai.shuaihong.fun/v1/chat/completions"
    },
    "google-gemini": {                       // ← 第三方Provider名称  
      "type": "gemini",                      // ← Provider-Protocol类型
      "endpoint": "https://generativelanguage.googleapis.com"
    }
  }
}
```

### 🔄 架构关系图
```
第三方Provider (ShuaiHong) → Provider-Protocol (OpenAI协议) → 路由系统
第三方Provider (Google API) → Provider-Protocol (Gemini协议) → 路由系统
```

## 🏗️ 项目架构概览 (Project Architecture)

### 基本信息
- **项目名称**: Claude Code Output Router v2.7.0 → v3.0 (重构进行中)
- **核心功能**: 多AI提供商路由转换系统
- **协作模式**: 与kiro共同开发项目
- **当前架构**: v2.7.0四层模块化设计（输入-路由-输出-提供商协议）
- **目标架构**: v3.0六层插件化架构（Client ↔ Router ↔ Post-processor ↔ Transformer ↔ Provider-Protocol ↔ Preprocessor ↔ Server）
- **支持Provider-Protocol**: Anthropic, CodeWhisperer, OpenAI-Compatible, Gemini
- **第三方Provider**: ShuaiHong, LM Studio, ModelScope, Google API等
- **配置路径**: `~/.route-claudecode/` (新重构项目)

### 四层架构设计
```
用户请求 → 输入层 → 路由层 → 输出层 → 提供商协议层 → AI服务提供商(Provider)
```

- **输入层** (`src/input/`): 处理Anthropic、OpenAI、Gemini格式请求
- **路由层** (`src/routing/`): 类别驱动的模型路由和Provider选择
- **输出层** (`src/output/`): 格式转换和响应处理  
- **提供商协议层** (`src/provider-protocol/`): 与实际AI服务提供商的连接通信协议

### 路由机制核心
- **类别驱动映射**: `category → {provider, model}`
- **五种路由类别**: default, background, thinking, longcontext, search
- **零硬编码**: 模型名在路由阶段直接替换 `request.model = targetModel`
- **Round Robin**: 多Provider/多Account负载均衡
- **Provider-Protocol分离**: 配置中明确区分第三方Provider和Protocol实现

## 🤝 Kiro协作项目管理 (Kiro Collaboration Project Management)

### 📁 Kiro项目管理文件 (MANDATORY KIRO PROJECT FILES)

⚠️ **协作项目强制执行指令**:
- **MUST CHECK KIRO FILES FIRST**: 每次执行新任务前必须先查阅`.kiro`目录下的三个关键文件
- **MUST UPDATE TASK PROGRESS**: 每次任务执行完成后必须更新tasks.md中的进度状态
- **MUST FOLLOW REQUIREMENTS**: 所有开发必须严格遵循requirements.md中的需求规范
- **MUST COMPLY WITH DESIGN**: 所有架构决策必须符合design.md中的设计标准

### 🔍 强制查阅的Kiro文件 (MANDATORY KIRO REFERENCE TABLE)
| 文件名 | **文件路径** | 用途描述 | **使用时机** |
|--------|-------------|----------|-------------|
| **需求文档** | `.kiro/specs/claude-architecture-refactor/requirements.md` | 14项重构需求规范 | **开发任何新功能前必须查阅** |
| **设计文档** | `.kiro/specs/claude-architecture-refactor/design.md` | 六层架构设计规范 | **架构设计和接口定义时必须查阅** |
| **任务进度** | `.kiro/specs/claude-architecture-refactor/tasks.md` | 15项主要任务进度跟踪 | **任务执行前后必须查阅和更新** |
| **项目规则** | `.kiro/steering/project-rules.md` | 项目协作规则总览 | **项目管理和规则执行时查阅** |

### 📋 v3.0重构任务进度总览 (V3.0 REFACTOR TASK OVERVIEW)

#### 当前任务状态 (Current Task Status)
- **总任务数**: 15个主要任务，部分包含子任务
- **当前状态**: 任务1已开始 ([-] 标记)，其余待开始 ([ ] 标记)
- **重构方式**: 完全重构 - 现有代码移动到OLD_implementation，重新构建

#### 主要任务分类 (Major Task Categories)
1. **📁 基础设施 (Tasks 1-5)**: Mockup实现、测试系统、动态注册、调试系统、配置管理
2. **🔌 Provider标准化 (Task 6)**: 统一接口、认证管理、格式转换 (4个子任务)
3. **🎭 Mock服务器 (Task 7)**: 数据重放、管理界面 (2个子任务)
4. **🧪 测试增强 (Task 8)**: 文档系统、8步流水线 (2个子任务)
5. **⚙️ 运行时管理 (Task 9)**: 配置界面、动态更新 (2个子任务)
6. **🛠️ 工具生态 (Task 10)**: 日志解析、可视化、告警 (4个子任务)
7. **📊 服务管理 (Task 11)**: 进程控制、配置隔离 (2个子任务)
8. **🧠 知识系统 (Task 12)**: 记忆架构、文档同步 (2个子任务)
9. **📚 文档架构 (Task 13)**: 综合架构文档
10. **🚀 构建部署 (Task 14)**: 零fallback构建、部署流水线 (2个子任务)
11. **✅ 系统验证 (Task 15)**: 集成测试和系统验证

### 🔄 Kiro协作工作流 (MANDATORY KIRO WORKFLOW)

#### 🚨 任务执行前强制检查 (PRE-TASK MANDATORY CHECK)
1. **查阅任务状态** → 检查 `.kiro/specs/claude-architecture-refactor/tasks.md` 当前任务完成度
2. **确认需求合规** → 查阅 `.kiro/specs/claude-architecture-refactor/requirements.md` 相关需求
3. **验证设计规范** → 查阅 `.kiro/specs/claude-architecture-refactor/design.md` 架构标准
4. **选择新任务** → 基于当前进度选择下一个适合的任务

#### 🎯 任务执行中规范 (IN-TASK COMPLIANCE)
1. **严格需求遵循** → 每个实现细节必须符合requirements.md的acceptance criteria
2. **设计标准检查** → 所有架构决策必须符合design.md的设计原则
3. **接口标准化** → 所有接口定义必须遵循design.md的Interface规范
4. **测试驱动开发** → 按照requirements.md的TDD要求先写测试文档

#### ✅ 任务完成后强制更新 (POST-TASK MANDATORY UPDATE)
1. **更新任务状态** → 将tasks.md中对应任务标记为完成 [x] 或进行中 [-]
2. **记录实现细节** → 调用project-memory-manager记录实现经验和决策
3. **验证需求满足** → 确认所有requirements.md的acceptance criteria都已满足
4. **文档同步更新** → 更新相关设计文档和接口说明

### ⚠️ Kiro协作违规处理 (KIRO VIOLATION HANDLING)
- **跳过Kiro文件查阅** → 立即停止，要求先查阅对应文件
- **未更新任务进度** → 拒绝继续新任务，要求先更新tasks.md
- **违反需求规范** → 要求重新设计以符合requirements.md
- **偏离设计标准** → 要求重新实现以符合design.md标准

## 🔄 Refactor目录 - v3.0插件化架构重构 (Refactor Directory - v3.0 Plugin Architecture)

### 📋 重构目标
Refactor目录包含Claude Code Router v3.0的完整重构计划，目标是：
- **🔌 插件化模块架构**: 将现有单体架构重构为完全插件化的模块系统
- **📡 动态模块注册**: 运行时动态加载和卸载模块，无需重启服务器
- **♻️ 代码复用最大化**: 消除重复实现，建立共享服务组件
- **🏭 企业级可维护性**: 支持大规模团队协作开发和独立部署

### 📁 Refactor目录结构
```
Refactor/
├── docs/                         # 架构设计和计划文档
│   ├── architecture/             # 架构设计文档
│   │   ├── system-overview.md    # 系统架构总览
│   │   ├── plugin-system.md      # 插件系统设计
│   │   ├── service-registry.md   # 服务注册发现
│   │   ├── event-bus.md          # 事件总线设计
│   │   └── di-container.md       # 依赖注入容器
│   └── planning/                # 重构计划和路线图
│       ├── refactoring-plan.md   # 详细实施计划
│       ├── migration-guide.md    # 迁移指南
│       ├── timeline.md           # 时间线规划
│       └── risk-assessment.md    # 风险评估
├── src/                          # 重构后的源代码架构
│   ├── core/                     # 核心系统框架
│   │   └── plugin-system/        # 插件系统核心
│   ├── shared/                   # 共享服务组件
│   │   ├── authentication/       # 统一认证服务
│   │   ├── transformation/       # 转换引擎服务
│   │   ├── monitoring/          # 监控告警服务
│   │   └── configuration/       # 配置管理服务
│   └── plugins/                 # 插件实现集合
│       ├── provider/            # Provider插件
│       ├── input-format/        # 输入格式插件
│       ├── output-format/       # 输出格式插件
│       ├── transformer/         # 转换器插件
│       └── monitoring/          # 监控插件
├── tests/                       # 测试框架和用例
├── tools/                       # 开发工具和脚本
└── examples/                    # 示例代码和演示
```

### 🚀 重构时间线
- **项目周期**: 12周（3个月）
- **开始时间**: 2025-08-05
- **预计结束**: 2025-10-31
- **团队规模**: 3-5人

### 🏛️ 核心架构特性
- **🔌 插件化系统**: 所有功能模块都是可插拔的插件
- **📡 服务注册发现**: 运行时动态服务发现和依赖管理
- **🔄 事件驱动通信**: 松耦合的模块间通信机制
- **🏭 依赖注入容器**: 统一的依赖管理和生命周期控制
- **♻️ 热插拔支持**: 运行时模块更新和配置重载

### 📊 预期收益
- **代码质量**: 代码重复率从40%降低到15%以下
- **开发效率**: 新Provider开发时间从2周减少到3-4天
- **系统性能**: 内存使用降低15%，并发处理能力提升20%
- **可维护性**: 模块独立性达到90%，故障恢复时间减少60%

### 📚 相关文档
- **系统架构总览**: [Refactor/docs/architecture/system-overview.md](Refactor/docs/architecture/system-overview.md)
- **重构实施计划**: [Refactor/docs/planning/refactoring-plan.md](Refactor/docs/planning/refactoring-plan.md)
- **插件系统设计**: [Refactor/docs/architecture/plugin-system.md](Refactor/docs/architecture/plugin-system.md)

### ⚠️ 重要提醒
Refactor目录包含的是v3.0的规划和设计文档，当前生产环境仍使用v2.7.0的四层架构。重构工作将按计划分阶段实施，确保向后兼容性和系统稳定性。

## 📋 MANDATORY RULE CONSULTATION - 强制规则查阅 (REQUIRED READING)

⚠️ **执行指令**: AI必须在每次相关操作前查阅对应规则文件，严禁跳过！

### 🔍 强制查阅规则表 (MANDATORY REFERENCE TABLE)
| 操作类型 | **必须查阅的规则文件** | 验证检查点 | **违反后果** |
|---------|---------------------|-----------|-------------|
| **编写代码** | [📄 核心编程规范](.claude/rules/programming-rules.md) | 零硬编码、细菌式编程检查 | **立即拒绝执行** |
| **架构设计** | [📄 架构设计规则](.claude/rules/architecture-rules.md) | 四层架构、Provider规范验证 | **强制重新设计** |
| **测试开发** | [📄 测试框架规范](.claude/rules/testing-system-rules.md) | STD-6-STEP-PIPELINE执行 | **拒绝无测试代码** |
| **文件操作** | [📄 文件组织规范](.claude/rules/file-structure-rules.md) | 目录结构、命名规范检查 | **拒绝错误命名** |
| **构建部署** | [📄 部署发布规则](.claude/rules/deployment-rules.md) | 构建验证、用户确认检查 | **阻止自动发布** |
| **配置管理** | [📄 配置管理规则](.claude/rules/configuration-management-rules.md) | 配置路径、命名规范、安全检查 | **拒绝无效配置** |
| **知识记录** | [📄 知识管理规则](.claude/rules/memory-system-rules.md) | 经验记录、ADR完整性 | **要求补充文档** |
| **交付测试** | [📄 交付测试标准](.claude/rules/delivery-testing-rules.md) | 5大核心标准验证 | **阻止未验证发布** |
| **记忆查询** | [📁 项目记忆目录](~/.claudecode/Users-fanzhang-Documents-github-claude-code-router/) | 检查现有记忆文件 | **要求先查阅记忆** |
| **架构变更** | [📄 知识管理规则](.claude/rules/memory-system-rules.md) + [📁 记忆目录](~/.claudecode/Users-fanzhang-Documents-github-claude-code-router/) | 变更后记忆保存 | **拒绝无记忆变更** |
| **问题疑惑** | [📁 项目记忆目录](~/.claudecode/Users-fanzhang-Documents-github-claude-code-router/) | 相关经验查阅 | **强制记忆优先** |
| **长任务执行** | [📄 知识管理规则](.claude/rules/memory-system-rules.md) | 任务记忆管理 | **要求记忆跟踪** |
| **服务管理** | [📄 服务管理重要规则](#️-服务管理重要规则-critical-service-management-rules) | rcc3 start/code区分、配置只读检查 | **阻止破坏性操作** |
| **补丁系统** | [📄 补丁系统架构](.claude/project-details/patch-system-architecture.md) + [📁 src/patches/](src/patches/) | 非侵入式修复、条件匹配验证 | **拒绝硬编码修复** |
| **🚨 所有操作** | [📄 架构保护规则](#️-架构保护规则-architecture-protection-rules---p0级别强制执行) | 创建文件、文件夹、跨节点操作检查 | **P0级立即拒绝** |

### 🚫 违规处理程序 (VIOLATION HANDLING)
1. **发现违规** → 立即停止当前操作
2. **强制查阅** → 要求查阅相关规则文件和记忆目录
3. **规则验证** → 根据规则重新执行操作
4. **文档引用** → 在回应中明确引用规则章节
5. **记忆调用** → 架构变更前强制调用记忆专家

### 📚 详细技术文档
| 技术领域 | 详细文档位置 | 内容概述 |
|---------|-------------|---------|
| **CodeWhisperer实现** | [📄 .claude/project-details/provider-implementations/](/.claude/project-details/provider-implementations/) | Demo2移植、多账号支持 |
| **路由策略** | [📄 .claude/project-details/routing-strategies/](/.claude/project-details/routing-strategies/) | 路由算法、负载均衡 |
| **测试策略** | [📄 .claude/project-details/testing-strategies/](/.claude/project-details/testing-strategies/) | 测试框架、验证方法 |
| **性能分析** | [📄 .claude/project-details/performance-analysis/](/.claude/project-details/performance-analysis/) | 性能基准、优化记录 |

## 🧪 测试开发规范 (Testing Standards)

### 核心测试原则
1. **测试脚本化**: 所有测试必须通过脚本执行
2. **语义明确**: 文件名用一句话表达测试目的
3. **文档同步**: 每个测试文件都有对应.md文档
4. **实时更新**: 每次测试后必须更新文档

### 📊 STD-DATA-CAPTURE-PIPELINE (标准数据捕获测试流程) - v3.0架构

**⚠️ 强制执行的新标准测试流程**，集成数据捕获和回放系统：

#### 🔄 四步标准流程 (MANDATORY 4-STEP PROCESS)

**步骤1: 端到端测试 + 数据捕获**
```bash
# 启用数据捕获模式运行端到端测试
rcc3 start config.json --debug
# 执行完整的端到端测试用例
# 系统自动捕获六层架构的所有I/O数据到 ~/.route-claudecode/database/
```

**步骤2: 错误数据链路分析**
```bash
# 分析捕获的数据，定位出错的流水线模块
ls ~/.route-claudecode/database/layers/     # 检查每层的I/O数据
cat ~/.route-claudecode/database/audit/trail-*.json  # 审计追踪分析
# 确定出错的具体层级: client/router/post-processor/transformer/provider-protocol/preprocessor/server
```

**步骤3: 数据回放复现问题**
```bash
# 使用回放系统精确复现问题
node test-replay-system-demo.js
# 或者从特定流水线步骤开始回放
# 验证问题确实存在并可重现
```

**步骤4: 修复验证循环**
```bash
# 修复代码逻辑
# 使用数据回放系统验证修复效果
# 重复直到问题完全解决
# 确保修复后的回放测试100%通过
```

#### 🎯 六层架构数据捕获点 (SIX-LAYER CAPTURE POINTS)
1. **Client Layer**: 用户输入验证和格式化
2. **Router Layer**: 模型路由和Provider选择  
3. **Post-processor Layer**: Provider响应处理
4. **Transformer Layer**: 数据格式转换
5. **Provider-Protocol Layer**: 第三方API通信
6. **Preprocessor Layer**: 工具调用处理
7. **Server Layer**: 最终响应发送

#### 📋 强制验证检查清单 (MANDATORY VALIDATION CHECKLIST)
- [ ] **数据捕获完整**: 所有六层的I/O数据均已记录
- [ ] **错误定位精确**: 明确识别出错的具体层级和操作
- [ ] **问题回放成功**: 可以通过回放系统重现问题
- [ ] **修复验证通过**: 修复后的回放测试达到100%成功率
- [ ] **审计追踪清晰**: 数据流转路径完全可追溯

#### ⛔ 测试流程违规处理 (TESTING VIOLATIONS)
- **跳过数据捕获** → 立即拒绝，要求重新执行完整流程
- **未定位具体层级** → 拒绝修复，要求精确的错误分析
- **回放验证失败** → 禁止提交，要求继续修复直到通过
- **缺失审计追踪** → 要求补充完整的数据流分析

### 🔄 传统STD-6-STEP-PIPELINE (向后兼容)
适用于v2.7.0架构或简单调试：
1. **Step1**: Input Processing - 验证API请求链路
2. **Step2**: Routing Logic - 验证模型路由逻辑
3. **Step3**: Transformation - 验证格式转换
4. **Step4**: Raw API Response - 测试真实API
5. **Step5**: Transformer Input - 验证数据接收
6. **Step6**: Transformer Output - 测试转换输出

### 测试工具
```bash
# 统一测试运行器
./test-runner.sh --list                    # 列出所有测试
./test-runner.sh --search <关键词>          # 搜索相关测试
./test-runner.sh test/functional/test-xxx.js # 运行单个测试
```

## 🚀 启动和部署 (Launch & Deployment)

### 🔄 版本共存启动方式 (v2.7.0 + v3.0)

**统一命令行工具**:
```bash
rcc3 start               # 简化启动器，支持Ctrl+C退出
rcc3 status              # 检查服务状态
rcc3 stop                # 停止服务
```

**v3.0 六层架构**:
```bash
rcc3 start [config-file] --debug    # 六层架构启动
rcc3 status                          # 检查v3.0服务状态
rcc3 stop                           # 停止v3.0服务
rcc3 sdk detect                     # 检查SDK集成状态
```

### 🛠️ 开发工具集

#### v3.0 标准脚本 (推荐)
- **v3.0 构建**: `./build.sh` (v3.0 六层架构构建+验证)
- **v3.0 本地安装**: `./install-local.sh` (安装为 rcc3 命令)
- **v3.0 专用安装**: `./scripts/install-v3.sh` (rcc3 命令独立安装)
- **v3.0 完整测试**: `./test-all-v3.sh` (六层架构+SDK集成验证)

#### 传统脚本 (保持兼容)
- **完整开发流程**: `./fix-and-test.sh` (构建+启动+测试，如存在)
- **开发模式**: `./start-dev.sh` (自动构建+日志记录，如存在)

### 🧪 测试和验证

#### v3.0 测试标准
```bash
# 完整v3.0架构测试 (推荐)
./test-all-v3.sh

# 特定组件测试
node test/functional/test-lmstudio-ollama-sdk-integration.js
node test/functional/test-provider-protocol-governance.js

# STD-8-STEP-PIPELINE 测试 (六层架构)
node test/pipeline/std-8-step-pipeline-framework.js
```

#### 构建验证标准
```bash
# v3.0 构建验证流程
./build.sh                    # 1. 构建项目
./test-all-v3.sh               # 2. 运行测试套件  
./scripts/install-v3.sh        # 3. 全局安装 (可选)
```

### 端口配置

#### 🌐 主服务端口
- **Development**: 3456 (开发环境)
- **Production**: 3457 (生产环境)
- **日志监控**: `~/.route-claudecode/logs/ccr-*.log`

#### 🔧 Single-Provider配置端口映射表
调试时使用以下端口和配置文件启动特定provider服务：

| 端口 | Provider-Protocol类型 | 第三方Provider | 配置文件 | 主要模型 |
|------|-------------|-----------|----------|----------|
| **5501** | CodeWhisperer | Primary Account | `config-codewhisperer-primary-5501.json` | CLAUDE_SONNET_4_20250514_V1_0 |
| **5502** | Google Gemini | API Keys | `config-google-gemini-5502.json` | gemini-2.5-pro, gemini-2.5-flash |
| **5503** | CodeWhisperer | Kiro-GitHub | `config-codewhisperer-kiro-github-5503.json` | CLAUDE_SONNET_4_20250514_V1_0 |
| **5504** | CodeWhisperer | Kiro-Gmail | `config-codewhisperer-kiro-gmail-5504.json` | CLAUDE_SONNET_4, CLAUDE_3_7_SONNET |
| **5505** | CodeWhisperer | Kiro-Zcam | `config-codewhisperer-kiro-zcam-5505.json` | CLAUDE_SONNET_4, CLAUDE_3_7_SONNET |
| **5506** | OpenAI Compatible | LM Studio | `config-openai-lmstudio-5506.json` | qwen3-30b, glm-4.5-air |
| **5507** | OpenAI Compatible | ModelScope | `config-openai-modelscope-5507.json` | Qwen3-Coder-480B |
| **5508** | OpenAI Compatible | ShuaiHong | `config-openai-shuaihong-5508.json` | claude-4-sonnet, gemini-2.5-pro |
| **5509** | OpenAI Compatible | ModelScope GLM | `config-openai-modelscope-glm-5509.json` | ZhipuAI/GLM-4.5 |

#### 🚀 调试使用示例

**统一使用 `rcc3` 命令** (支持所有配置格式):
```bash
# 启动指定配置文件的服务
rcc3 start ~/.route-claudecode/config/v3/single-provider/config-lmstudio-v3-5506.json --debug
rcc3 start ~/.route-claudecode/config/v3/single-provider/config-openai-shuaihong-v3-5508.json --debug
rcc3 start ~/.route-claudecode/config/v3/single-provider/config-google-gemini-v3-5502.json --debug

# 也支持v2.7.0配置文件
rcc3 start ~/.route-claude-code/config/single-provider/config-openai-shuaihong-5508.json --debug
rcc3 start ~/.route-claude-code/config/single-provider/config-google-gemini-5502.json --debug

# 连接Claude Code客户端
rcc3 code --port 5506
rcc3 code --port 5508
```

**具体启动示例**:
```bash
# 启动LM Studio服务 (端口5506)
rcc3 start ~/.route-claudecode/config/v3/single-provider/config-lmstudio-v3-5506.json --debug

# 启动ShuaiHong服务 (端口5508)  
rcc3 start ~/.route-claudecode/config/v3/single-provider/config-openai-shuaihong-v3-5508.json --debug

# 启动CodeWhisperer服务 (端口5501)
rcc3 start ~/.route-claudecode/config/v3/single-provider/config-codewhisperer-primary-v3-5501.json --debug

# 启动Gemini服务 (端口5502)
rcc3 start ~/.route-claudecode/config/v3/single-provider/config-google-gemini-v3-5502.json --debug

# 启动多Provider负载均衡服务 (端口3456)
rcc3 start ~/.route-claudecode/config/v3/load-balancing/config-multi-provider-v3-3456.json --debug

# 检查服务状态
curl http://localhost:5506/health
rcc3 sdk detect
rcc3 config list
```

#### 📁 配置文件位置
- **单Provider-Protocol配置**: `~/.route-claude-code/config/single-provider/`
- **多Provider-Protocol配置**: `~/.route-claude-code/config/load-balancing/`
- **生产环境配置**: `~/.route-claude-code/config/production-ready/`

#### ⚠️ 服务管理重要规则 (CRITICAL SERVICE MANAGEMENT RULES)

**🚨 强制执行服务管理约束 - 违反将导致系统不稳定**

##### 1. **服务类型区分**
- **`rcc3 start`服务**: API服务器，可以停止/重启/管理
- **`rcc3 code`服务**: Claude Code客户端会话，**绝对不可杀掉**

##### 2. **服务操作权限**
```bash
# ✅ 允许的操作 - 可以管理API服务器
pkill -f "rcc3 start"           # 只杀掉API服务器
ps aux | grep "rcc3 start"      # 查看API服务器状态

# ❌ 禁止的操作 - 不可杀掉客户端会话  
pkill -f "rcc3 code"           # 绝对禁止！会断掉用户会话
kill <rcc3 code的PID>          # 绝对禁止！
```

##### 3. **配置文件管理约束**
- **🔒 只读原则**: `~/.route-claude-code/config/single-provider/`下的配置文件为只读
- **🚫 禁止修改**: 不允许修改配置文件中的端口设置
- **🚫 禁止创建**: 不允许创建新的配置文件
- **✅ 使用现有**: 只能使用文件夹内现有的配置文件启动服务

##### 4. **端口管理规则**
- **端口固定**: 每个配置文件的端口由文件名和内容预定义
- **不可变更**: 配置文件中的端口设置不可修改
- **冲突处理**: 如端口被占用，停止冲突的`rcc3 start`服务，不修改配置

##### 5. **服务启动标准流程**
```bash
# 步骤1: 检查现有API服务器(只检查rcc3 start)
ps aux | grep "rcc3 start" | grep -v grep

# 步骤2: 停止冲突的API服务器(如果需要)
pkill -f "rcc3 start.*5508"  # 只停止特定端口的API服务器

# 步骤3: 使用现有配置启动服务
rcc3 start ~/.route-claudecode/config/v3/single-provider/config-openai-shuaihong-v3-5508.json --debug

# 注意: 绝不触碰 rcc3 code 进程！
```

##### 6. **调试和测试约束**
- **测试隔离**: 调试单个Provider-Protocol时使用single-provider配置
- **配置不变**: 测试过程中不修改任何配置文件
- **会话保护**: 调试期间保护用户的`rcc3 code`会话不被中断

## 🗄️ Provider数据分级分类系统 (Provider Data Classification System)

### 📊 三层分级架构
**Provider Protocol → Provider → Model** 的层级数据分类存储

#### 🏗️ 目录结构
```
~/.route-claudecode/database/captures/
├── openai-protocol/           # OpenAI兼容协议
│   ├── lmstudio/             # LM Studio第三方服务
│   │   ├── qwen3-30b/        # Qwen3 30B模型数据
│   │   └── glm-4.5-air/      # GLM 4.5 Air模型数据
│   ├── modelscope/           # ModelScope第三方服务
│   └── shuaihong/            # ShuaiHong第三方服务
├── codewhisperer-protocol/    # AWS CodeWhisperer协议
├── gemini-protocol/           # Google Gemini协议
└── anthropic-protocol/        # Anthropic直连协议
```

#### 🔧 关键工具脚本
```bash
# Provider数据分级分类系统设置
./database/setup-provider-classification.sh

# LM Studio数据提取和分析
node ./database/extract-lmstudio-tool-calls.js

# 深度格式问题分析
node ./database/analyze-lmstudio-tool-call-issues.js

# 自动分类规则配置
./database/auto-classification-rules.json
```

#### 📋 自动分类规则
- **LM Studio**: 识别`functions.`、`LM Studio`、`localhost:11`标识符
- **ModelScope**: 识别`modelscope`、`ModelScope`、`dashscope`标识符
- **ShuaiHong**: 识别`shuaihong`、`ShuaiHong`、`ai.shuaihong.fun`标识符
- **Model检测**: 基于内容关键字自动识别具体模型

#### 🚀 使用方法
```bash
# 查看特定Provider数据
ls -la ~/.route-claudecode/database/captures/openai-protocol/lmstudio/

# 分析工具调用问题
find ~/.route-claudecode/database/captures/openai-protocol/lmstudio/ -name "*.json" -exec grep -l "tool_calls" {} \;

# 运行数据分析
node ~/.route-claudecode/database/analyze-lmstudio-tool-call-issues.js
```

## 🔧 细菌式编程原则 (Bacterial Programming)

### Small (小巧)
- **文件限制**: 单文件不超过500行代码
- **函数限制**: 单函数不超过50行代码
- **能量效率**: 每一行代码都有明确目的

### Modular (模块化)
- **四层架构**: 功能组织成可插拔的模块
- **操纵子设计**: 相关功能组织成独立单元
- **标准接口**: 模块间通过标准接口交互

### Self-contained (自包含)
- **水平基因转移**: 支持模块级复用
- **上下文无关**: 使用模块无需理解整个系统
- **独立测试**: 每个模块可独立验证

## 📊 项目状态总览 (Project Status)

### 当前版本: v2.7.0
- ✅ **生产就绪**: 已发布npm，完整功能验证
- ✅ **多Provider-Protocol支持**: CodeWhisperer、OpenAI、Gemini、Anthropic协议实现
- ✅ **Round Robin**: 多账号负载均衡和故障切换
- ✅ **完整测试**: 174个测试文件，100%核心功能覆盖
- ✅ **零硬编码**: 完全消除硬编码，配置驱动
- ✅ **工具调用**: 100%修复率，所有Provider-Protocol支持工具调用
- ✅ **企业级监控**: 生产级错误捕获系统，100%工具调用错误监控
- ✅ **架构统一**: 简化OpenAI Provider-Protocol路由，统一使用EnhancedOpenAIClient
- ✅ **用户体验**: 清洁日志界面，移除verbose输出，保持强大调试能力
- ✅ **🩹 补丁系统**: 非侵入式模型兼容性修复，支持Anthropic、OpenAI、Gemini格式差异处理

### v2.7.0 重大特性
- **企业级错误监控**: 实时工具调用错误检测与捕获系统
- **架构统一优化**: OpenAI Provider路由简化，消除冗余实现
- **日志系统优化**: 移除噪音日志，保持清洁用户界面
- **稳定性大幅提升**: 工具调用成功率提升至99.9%+
- **🩹 补丁系统架构**: 非侵入式模型兼容性修复方案，四层补丁架构设计
  - **AnthropicToolCallTextFixPatch**: 修复ZhipuAI/GLM-4.5文本格式tool call问题
  - **OpenAIToolFormatFixPatch**: 标准化OpenAI兼容服务工具调用格式
  - **GeminiResponseFormatFixPatch**: 统一Gemini API响应格式
  - **精确条件匹配**: 支持Provider-Protocol、Model、Version多维度匹配
  - **性能监控**: 应用统计、超时保护、错误隔离机制

### 近期重大修复
- **2025-08-05**: 🩹 补丁系统架构完整优化，建立非侵入式模型兼容性修复方案，解决5508/5509端口tool call解析问题
- **2025-08-02**: 修复并发流式响应的竞态条件问题，通过引入`hasToolUse`状态锁存器，确保非阻塞模式下工具调用的稳定性和可靠性。
- **2025-08-02**: v2.7.0 企业级错误监控系统和架构统一优化
- **2025-07-28**: 完整路由架构重构，消除硬编码模型映射
- **2025-07-27**: 完全缓冲式解析，彻底解决工具调用问题
- **2025-08-01**: 规则架构重构，建立结构化规则管理系统

## 🎯 MANDATORY WORKFLOW - 强制执行工作流 (REQUIRED EXECUTION)

⚠️ **AI执行指令**: 必须严格按照以下流程执行，不允许跳步或简化！

### 🔒 新功能开发 - 强制流程 (MANDATORY STEPS)
1. **[REQUIRED]** 查阅规则 → [📄 规则系统导航](.claude/rules/README.md) ✅ 必须完成
2. **[REQUIRED]** 架构设计 → [📄 架构设计规则](.claude/rules/architecture-rules.md) ✅ 必须验证
3. **[REQUIRED]** 编码实现 → [📄 核心编程规范](.claude/rules/programming-rules.md) ✅ 必须检查
4. **[REQUIRED]** 测试验证 → [📄 测试框架规范](.claude/rules/testing-system-rules.md) ✅ 必须执行  
5. **[REQUIRED]** 构建部署 → [📄 部署发布规则](.claude/rules/deployment-rules.md) ✅ 必须确认
6. **[REQUIRED]** 经验记录 → [📄 知识管理规则](.claude/rules/memory-system-rules.md) ✅ 必须更新

### 🚨 问题调试 - 强制程序 (MANDATORY DEBUGGING) - v3.0版本

#### 📊 强制数据捕获调试流程 (MANDATORY DATA-CAPTURE DEBUGGING)
1. **[STEP 1]** 强制查阅相关规则和项目记忆 - **违反此步骤将拒绝继续**
2. **[STEP 2]** 强制运行STD-DATA-CAPTURE-PIPELINE - **跳过数据捕获将被拒绝**
   - 启用`--debug`模式进行端到端测试
   - 收集完整的六层架构I/O数据
   - 生成审计追踪和性能监控数据
3. **[STEP 3]** 强制进行错误链路分析 - **未定位具体层级将拒绝修复**
   - 分析`~/.route-claudecode/database/`中的数据
   - 精确定位出错的流水线模块
   - 确定数据流转中断点
4. **[STEP 4]** 强制数据回放验证 - **回放失败不允许提交**
   - 使用回放系统重现问题
   - 验证问题的可重现性
   - 建立修复验证基线
5. **[STEP 5]** 强制修复验证循环 - **未达到100%成功率不允许完成**
   - 修复代码逻辑
   - 使用数据回放验证修复效果
   - 重复直到回放测试100%通过
6. **[STEP 6]** 强制更新测试文档和记忆系统 - **缺失文档将被退回**

#### 🔄 传统调试流程 (向后兼容)
适用于v2.7.0架构或简单问题：
1. **[STEP 1]** 强制查阅相关规则和项目记忆 - **违反此步骤将拒绝继续**
2. **[STEP 2]** 强制运行STD-6-STEP-PIPELINE定位问题 - **跳过测试将被拒绝**
3. **[STEP 3]** 应用解决方案并强制验证修复 - **未验证不允许提交**
4. **[STEP 4]** 强制更新测试文档和记忆系统 - **缺失文档将被退回**

### ⛔ 工作流违规警告 (WORKFLOW VIOLATIONS)
- **跳过规则查阅** → 立即终止，要求重新开始
- **未进行架构验证** → 拒绝代码实现
- **缺失测试验证** → 拒绝接受代码
- **遗漏文档更新** → 要求补充后才能继续

## 📝 ABSOLUTE CONSTRAINTS - 绝对约束 (NON-NEGOTIABLE LIMITS)

### ⛔ 开发红线 - 不可越界 (HARD LIMITS)
- **[FORBIDDEN]** 创建冗余文件 → **立即拒绝**，必须优先编辑现有文件
- **[FORBIDDEN]** 主动创建文档 → **严格禁止**，除非用户明确要求
- **[MANDATORY]** 遵循命名规范 → **违反即拒绝**，所有文件必须符合规范
- **[REQUIRED]** 声明项目所有权 → 新文件所有者必须为 Jason Zhang

### 🔒 安全红线 - 不可触犯 (SECURITY BOUNDARIES)
- **[CRITICAL]** 环境保护 → **绝对禁止**覆盖全局配置文件
- **[CRITICAL]** 凭据分离 → **强制要求**敏感信息与代码完全分离
- **[CRITICAL]** 权限最小化 → **必须**以最小必要权限运行

### 🚨 AI执行约束 (AI EXECUTION CONSTRAINTS)
- **[MANDATORY]** 每次操作前必须查阅对应规则文件
- **[MANDATORY]** 遇到问题时必须先查阅 [📁 项目记忆](~/.claudecode/Users-fanzhang-Documents-github-claude-code-router/) 目录
- **[MANDATORY]** 违反规则时必须立即停止并报告
- **[MANDATORY]** 在回应中必须引用具体规则章节和记忆文件
- **[MANDATORY]** 架构变更前必须调用记忆专家保存经验
- **[FORBIDDEN]** 忽略或跳过任何强制性检查步骤
- **[REQUIRED]** 对用户请求进行规则合规性验证
- **[REQUIRED]** 长任务执行必须进行记忆管理

---

## 🔗 MANDATORY RESOURCES - 强制访问资源 (REQUIRED ACCESS)

⚠️ **AI使用指令**: 以下资源在相关操作时必须查阅，不得跳过！

### 📁 必须查阅的规则文件 (MANDATORY RULE FILES)
- **[REQUIRED]** 完整规则系统: [📁 .claude/rules/](.claude/rules/) - **每次编码前必读**
- **[REQUIRED]** 详细技术文档: [📁 .claude/project-details/](.claude/project-details/) - **架构设计必读**
- **[REQUIRED]** 测试框架: [📁 test/](test/) - **开发功能必读**
- **[REQUIRED]** 项目记忆: [📁 项目记忆目录](~/.claudecode/Users-fanzhang-Documents-github-claude-code-router/) - **问题调试必读**

### 🌐 项目链接 (PROJECT LINKS)
- **GitHub仓库**: https://github.com/fanzhang16/claude-code-router
- **NPM包**: https://www.npmjs.com/package/route-claudecode

---

## ⚡ COMPLIANCE VERIFICATION - 合规验证检查 (FINAL CHECK)

### 🔍 AI自检清单 (AI SELF-CHECK REQUIRED)
在执行任何操作前，AI必须通过以下检查：

- [ ] **🚨 架构保护检查** - 已确认不违反架构保护规则（P0级最高优先级）
- [ ] **记忆优先检查** - 已查阅 [📁 项目记忆](~/.claudecode/Users-fanzhang-Documents-github-claude-code-router/) 目录相关文件
- [ ] **规则查阅完成** - 已查阅相关规则文件
- [ ] **架构合规验证** - 符合四层架构要求
- [ ] **编码规范检查** - 零硬编码、零Fallback确认
- [ ] **测试要求满足** - STD-DATA-CAPTURE-PIPELINE（v3.0）或STD-6-STEP-PIPELINE（传统）准备就绪
- [ ] **记忆专家准备** - 架构变更时记忆专家调用计划确认

## 🧠 项目记忆存储路径
- **主路径**: `~/.claudecode/Users-fanzhang-Documents-github-route-claudecode/`
- **正确路径格式**: `~/.claudecode/Users-{username}-{project-directory}/`
- **命名约定**: `YYYYMMDD-HHMMSS-[descriptive-english-id].md`
- **重要提醒**: 所有项目记忆都必须存储在此路径下，严禁在其他位置创建记忆文件
- **最新记忆**: `20250802-175031-concurrency-routing-rate-limiting-architecture.md`
- **路径验证**: 每次创建记忆文件前必须验证路径正确性

#### ⚠️ 记忆路径规范警告 (MEMORY PATH COMPLIANCE WARNING)
**绝对禁止的路径**: 
- ❌ `./memory/` - 项目相对路径
- ❌ `docs/memory/` - 文档目录路径
- ❌ `.claude/memory/` - 规则目录路径
- ❌ `~/Documents/` - 用户文档路径

**唯一正确的路径**: ✅ `~/.claudecode/Users-fanzhang-Documents-github-route-claudecode/`

**路径验证命令**:
```bash
# 验证记忆目录是否存在
ls -la ~/.claudecode/Users-fanzhang-Documents-github-route-claudecode/

# 检查最新记忆文件
ls -la ~/.claudecode/Users-fanzhang-Documents-github-route-claudecode/ | tail -5
```
- [ ] **文档更新计划** - 架构变更后文档更新方案确认
- [ ] **长任务记忆管理** - 长任务的记忆保存和提取机制确认
- [ ] **用户确认需求** - 识别需要用户确认的操作

**⚠️ 警告**: 未通过上述检查的操作将被自动拒绝执行！
**🧠 特别提醒**: 记忆优先原则 - 任何疑惑都必须先查阅项目记忆！
**🚨 架构保护**: 架构保护检查为P0级最高优先级 - 违反将被立即拒绝！

---
**📊 项目版本**: v2.7.0  
**🔒 规则架构**: v1.3.0 (架构保护强化版)  
**👤 项目所有者**: Jason Zhang  
**📅 最后更新**: 2025-08-11  
**⚡ 强制执行**: ACTIVE - 所有规则均为强制性  
**🧠 记忆管理**: ACTIVE - 记忆优先原则生效  
**🏛️ 架构保护**: ACTIVE - P0级架构保护生效