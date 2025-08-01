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

#### 🔄 强制记忆工作流 (MANDATORY MEMORY WORKFLOW)
1. **问题遇到** → 先查阅项目记忆目录相关文件
2. **方案制定** → 参考现有记忆中的解决方案
3. **架构变更** → 变更前调用记忆专家总结
4. **执行完成** → 成功/失败经验必须保存到记忆
5. **🆕 总结创建** → 调用 project-memory-manager agent 保存总结到项目记忆目录
6. **文档更新** → 更新架构相关文档

## 🏗️ 项目架构概览 (Project Architecture)

### 基本信息
- **项目名称**: Claude Code Output Router v2.6.0
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

#### 🚀 调试使用示例
```bash
# 启动CodeWhisperer主账号服务 (端口5501)
./rcc start config-codewhisperer-primary-5501.json

# 启动Gemini服务 (端口5502) 
./rcc start config-google-gemini-5502.json

# 启动ModelScope服务 (端口5507)
./rcc start config-openai-modelscope-5507.json

# 检查特定端口服务状态
curl http://localhost:5502/health
```

#### 📁 配置文件位置
- **单provider配置**: `~/.route-claude-code/config/single-provider/`
- **多provider配置**: `~/.route-claude-code/config/load-balancing/`
- **生产环境配置**: `~/.route-claude-code/config/production-ready/`

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

### 当前版本: v2.6.0
- ✅ **生产就绪**: 已发布npm，完整功能验证
- ✅ **多Provider支持**: CodeWhisperer、OpenAI、Gemini、Anthropic
- ✅ **Round Robin**: 多账号负载均衡和故障切换
- ✅ **完整测试**: 174个测试文件，100%核心功能覆盖
- ✅ **零硬编码**: 完全消除硬编码，配置驱动
- ✅ **工具调用**: 100%修复率，所有Provider支持工具调用

### 近期重大修复
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
**📊 项目版本**: v2.6.0  
**🔒 规则架构**: v1.2.0 (记忆管理强化版)  
**👤 项目所有者**: Jason Zhang  
**📅 最后更新**: 2025-08-01  
**⚡ 强制执行**: ACTIVE - 所有规则均为强制性  
**🧠 记忆管理**: ACTIVE - 记忆优先原则生效