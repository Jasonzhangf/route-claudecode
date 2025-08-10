# 🎯 Qwen Code Router - 项目规则总览

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

### 🔒 强制执行优先级 (ENFORCEMENT PRIORITIES)
1. **P0 - 立即拒绝**: 硬编码、Fallback、自主发布
2. **P1 - 强制查阅**: 架构违反、测试跳过、文档缺失、记忆缺失
3. **P2 - 警告纠正**: 命名不规范、注释缺失、性能问题

### 🧠 MEMORY MANAGEMENT - 记忆管理强制规则 (MANDATORY MEMORY)

⚠️ **AI记忆强制执行指令**:
- **MUST CHECK MEMORY FIRST**: 每次遇到问题必须先查阅 [📁 项目记忆](~/.claudecode/Users-fanzhang-Documents-github-claude-code-router/) 目录
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
- **主路径**: `~/.claudecode/Users-fanzhang-Documents-github-claude-code-router/`
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

**唯一正确的路径**: ✅ `~/.claudecode/Users-fanzhang-Documents-github-claude-code-router/`

**路径验证命令**:
```bash
# 验证记忆目录是否存在
ls -la ~/.claudecode/Users-fanzhang-Documents-github-claude-code-router/

# 检查最新记忆文件
ls -la ~/.claudecode/Users-fanzhang-Documents-github-claude-code-router/ | tail -5
```

#### 🔄 强制记忆工作流 (MANDATORY MEMORY WORKFLOW)
1. **问题遇到** → 先查阅项目记忆目录相关文件
2. **方案制定** → 参考现有记忆中的解决方案
3. **架构变更** → 变更前调用记忆专家总结
4. **执行完成** → 成功/失败经验必须保存到记忆
5. **🆕 总结创建** → 根据AI类型选择记忆保存方式：
   - **Claude Code用户**: 调用 `project-memory-manager` agent 保存总结到项目记忆目录
   - **其他AI**: 直接总结当前发现和细节为有条理的记忆，用一句话总结+日期时间命名保存到项目记忆目录
6. **🕒 记忆时效性管理** → 检查并处理记忆冲突：
   - **时间优先原则**: 发现冲突记忆时，优先信任较新的记忆内容
   - **自动清理过时记忆**: 创建新记忆时，如发现与旧记忆冲突且旧记忆已证明错误，必须删除过时记忆
   - **记忆验证**: 每次使用记忆前验证其时效性和准确性
7. **文档更新** → 更新架构相关文档

#### 📝 记忆保存格式规范 (MEMORY SAVING FORMAT)
- **文件命名**: `YYYYMMDD-HHMMSS-[descriptive-english-id].md`
- **一句话总结**: 文件开头必须包含问题/解决方案的一句话总结
- **时间戳**: 创建时间必须在文件名和内容中体现
- **结构化内容**: 包含问题背景、解决方案、技术细节、关键经验

## 🏗️ 项目架构概览 (Project Architecture)

### 基本信息
- **项目名称**: Claude Code Output Router v2.7.0
- **核心功能**: 多AI提供商路由转换系统
- **架构模式**: 四层模块化设计（输入-路由-输出-提供商）
- **支持Provider**: Anthropic, CodeWhisperer, OpenAI-Compatible, Gemini

### 四层架构设计
```
用户请求 → 输入层 → 路由层 → 输出层 → 提供商层 → AI服务
```

- **输入层** (`src/input/`): 处理Anthropic、OpenAI、Gemini格式请求
- **路由层** (`src/routing/`): 类别驱动的模型路由和Provider选择
- **输出层** (`src/output/`): 格式转换和响应处理  
- **提供商层** (`src/providers/`): 与实际AI服务的连接通信

### 路由机制核心
- **类别驱动映射**: `category → {provider, model}`
- **五种路由类别**: default, background, thinking, longcontext, search
- **零硬编码**: 模型名在路由阶段直接替换 `request.model = targetModel`
- **Round Robin**: 多Provider/多Account负载均衡

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
│   │   └── event-bus.md          # 事件总线设计
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
| **服务管理** | [📄 服务管理重要规则](#️-服务管理重要规则-critical-service-management-rules) | rcc start/code区分、配置只读检查 | **阻止破坏性操作** |
| **补丁系统** | [📄 补丁系统架构](.claude/project-details/patch-system-architecture.md) + [📁 src/patches/](src/patches/) | 非侵入式修复、条件匹配验证 | **拒绝硬编码修复** |

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

### STD-6-STEP-PIPELINE (标准测试流程)
适用于新功能开发或重大问题调试：
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

### 推荐启动方式
```bash
./rcc start              # 简化启动器，支持Ctrl+C退出
./rcc status             # 检查服务状态
./rcc stop               # 停止服务
```

### 开发工具集
- **完整开发流程**: `./fix-and-test.sh` (构建+启动+测试)
- **开发模式**: `./start-dev.sh` (自动构建+日志记录)
- **构建项目**: `./build.sh` (清理和构建)
- **本地安装**: `./install-local.sh` (打包+全局安装)

### 端口配置

#### 🌐 主服务端口
- **Development**: 3456 (开发环境)
- **Production**: 3457 (生产环境)
- **日志监控**: `~/.route-claude-code/logs/ccr-*.log`

#### 🔧 Single-Provider配置端口映射表
调试时使用以下端口和配置文件启动特定provider服务：

| 端口 | Provider类型 | 账号/服务 | 配置文件 | 主要模型 |
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

⚠️ **🔥 CRITICAL RULE - 绝对不可违反！**
**ALL rcc start 命令必须包含 --config 参数！**
**格式**: `rcc start --config <配置文件路径> --debug`
**违反此规则将导致服务启动失败或配置错误！**

```bash
# ✅ 正确格式 - 启动服务器的标准格式
rcc start --config ~/.route-claude-code/config/single-provider/config-openai-shuaihong-5508.json --debug

# ✅ 启动Claude Code连接到特定端口
rcc code --port 5508

# ✅ 具体启动命令示例 (所有命令都包含--config):
# 启动CodeWhisperer主账号服务 (端口5501)
rcc start --config ~/.route-claude-code/config/single-provider/config-codewhisperer-primary-5501.json --debug

# 启动Gemini服务 (端口5502) 
rcc start --config ~/.route-claude-code/config/single-provider/config-google-gemini-5502.json --debug

# 启动ModelScope GLM服务 (端口5509)
rcc start --config ~/.route-claude-code/config/single-provider/config-openai-modelscope-glm-5509.json --debug

# 启动ShuaiHong服务 (端口5508)
rcc start --config ~/.route-claude-code/config/single-provider/config-openai-shuaihong-5508.json --debug

# ❌ 错误示例 - 绝对不要这样写！
# rcc start ~/.route-claude-code/config/single-provider/config-google-gemini-5502.json --debug

# 检查特定端口服务状态
curl http://localhost:5502/health

# 连接Claude Code到特定端口进行交互
rcc code --port 5509  # 连接到ModelScope GLM服务
rcc code --port 5508  # 连接到ShuaiHong服务
```

#### 📁 配置文件位置
- **单provider配置**: `~/.route-claude-code/config/single-provider/`
- **多provider配置**: `~/.route-claude-code/config/load-balancing/`
- **生产环境配置**: `~/.route-claude-code/config/production-ready/`

#### ⚠️ 服务管理重要规则 (CRITICAL SERVICE MANAGEMENT RULES)

**🚨 强制执行服务管理约束 - 违反将导致系统不稳定**

##### 1. **服务类型区分**
- **`rcc start`服务**: API服务器，可以停止/重启/管理
- **`rcc code`服务**: Claude Code客户端会话，**绝对不可杀掉**

##### 2. **服务操作权限**
```bash
# ✅ 允许的操作 - 可以管理API服务器
pkill -f "rcc start"           # 只杀掉API服务器
ps aux | grep "rcc start"      # 查看API服务器状态

# ❌ 禁止的操作 - 不可杀掉客户端会话  
pkill -f "rcc code"           # 绝对禁止！会断掉用户会话
kill <rcc code的PID>          # 绝对禁止！
```

##### 3. **配置文件管理约束**
- **🔒 只读原则**: `~/.route-claude-code/config/single-provider/`下的配置文件为只读
- **🚫 禁止修改**: 不允许修改配置文件中的端口设置
- **🚫 禁止创建**: 不允许创建新的配置文件
- **✅ 使用现有**: 只能使用文件夹内现有的配置文件启动服务

##### 4. **端口管理规则**
- **端口固定**: 每个配置文件的端口由文件名和内容预定义
- **不可变更**: 配置文件中的端口设置不可修改
- **冲突处理**: 如端口被占用，停止冲突的`rcc start`服务，不修改配置

##### 5. **服务启动标准流程**
```bash
# 步骤1: 检查现有API服务器(只检查rcc start)
ps aux | grep "rcc start" | grep -v grep

# 步骤2: 停止冲突的API服务器(如果需要)
pkill -f "rcc start.*5508"  # 只停止特定端口的API服务器

# 步骤3: 使用现有配置启动服务
rcc start ~/.route-claude-code/config/single-provider/config-openai-shuaihong-5508.json --debug

# 注意: 绝不触碰 rcc code 进程！
```

##### 6. **调试和测试约束**
- **测试隔离**: 调试单个provider时使用single-provider配置
- **配置不变**: 测试过程中不修改任何配置文件
- **会话保护**: 调试期间保护用户的`rcc code`会话不被中断

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
- ✅ **多Provider支持**: CodeWhisperer、OpenAI、Gemini、Anthropic
- ✅ **Round Robin**: 多账号负载均衡和故障切换
- ✅ **完整测试**: 174个测试文件，100%核心功能覆盖
- ✅ **零硬编码**: 完全消除硬编码，配置驱动
- ✅ **工具调用**: 100%修复率，所有Provider支持工具调用
- ✅ **企业级监控**: 生产级错误捕获系统，100%工具调用错误监控
- ✅ **架构统一**: 简化OpenAI Provider路由，统一使用EnhancedOpenAIClient
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
  - **精确条件匹配**: 支持Provider、Model、Version多维度匹配
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

### 🚨 问题调试 - 强制程序 (MANDATORY DEBUGGING)
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
- **[MANDATORY]** 记忆时效性管理：优先信任较新记忆，删除已证明错误的过时记忆
- **[FORBIDDEN]** 忽略或跳过任何强制性检查步骤
- **[REQUIRED]** 对用户请求进行规则合规性验证
- **[REQUIRED]** 长任务执行必须进行记忆管理
- **[REQUIRED]** 使用记忆前验证其时效性和准确性

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

## ⚡ COMPLIANCE VERIFICATION - 合规验证检查 (FINAL CHECK)

### 🔍 AI自检清单 (AI SELF-CHECK REQUIRED)
在执行任何操作前，AI必须通过以下检查：

- [ ] **记忆优先检查** - 已查阅 [📁 项目记忆](~/.claudecode/Users-fanzhang-Documents-github-claude-code-router/) 目录相关文件
- [ ] **规则查阅完成** - 已查阅相关规则文件
- [ ] **架构合规验证** - 符合四层架构要求
- [ ] **编码规范检查** - 零硬编码、零Fallback确认
- [ ] **测试要求满足** - STD-6-STEP-PIPELINE或交付测试准备就绪
- [ ] **记忆专家准备** - 架构变更时记忆专家调用计划确认
- [ ] **文档更新计划** - 架构变更后文档更新方案确认
- [ ] **长任务记忆管理** - 长任务的记忆保存和提取机制确认
- [ ] **用户确认需求** - 识别需要用户确认的操作

**⚠️ 警告**: 未通过上述检查的操作将被自动拒绝执行！
**🧠 特别提醒**: 记忆优先原则 - 任何疑惑都必须先查阅项目记忆！

---
**📊 项目版本**: v2.7.0  
**🔒 规则架构**: v1.2.0 (记忆管理强化版)  
**👤 项目所有者**: Jason Zhang  
**📅 最后更新**: 2025-08-02  
**⚡ 强制执行**: ACTIVE - 所有规则均为强制性  
**🧠 记忆管理**: ACTIVE - 记忆优先原则生效