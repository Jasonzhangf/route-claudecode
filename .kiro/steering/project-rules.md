---
inclusion: always
---

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

## 🧠 MEMORY MANAGEMENT - 记忆管理强制规则 (MANDATORY MEMORY)

⚠️ **AI记忆强制执行指令**:
- **MUST CHECK MEMORY FIRST**: 每次遇到问题必须先查阅项目记忆目录
- **MUST SAVE ARCHITECTURE CHANGES**: 架构变更后必须调用记忆专家保存经验
- **MUST TRACK LONG TASKS**: 长任务执行必须有记忆保存和提取机制
- **MUST UPDATE DOCS AFTER CHANGES**: 架构变更后必须更新相关文档

### 📁 项目记忆目录检查 (MEMORY DIRECTORY CHECK)
**项目记忆路径**: `~/.claudecode/Users-fanzhang-Documents-github-claude-code-router/`

**路径验证命令**:
```bash
# 验证记忆目录是否存在
ls -la ~/.claudecode/Users-fanzhang-Documents-github-claude-code-router/

# 检查最新记忆文件
ls -la ~/.claudecode/Users-fanzhang-Documents-github-claude-code-router/ | tail -5
```

### 🔄 强制记忆工作流 (MANDATORY MEMORY WORKFLOW)
1. **问题遇到** → 先查阅项目记忆目录相关文件
2. **方案制定** → 参考现有记忆中的解决方案
3. **架构变更** → 变更前调用记忆专家总结
4. **执行完成** → 成功/失败经验必须保存到记忆
5. **总结创建** → 调用 project-memory-manager agent 保存总结到项目记忆目录
6. **文档更新** → 更新架构相关文档

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
| **服务管理** | [📄 服务管理规则](.claude/rules/service-management-rules.md) | rcc start/code区分、配置只读检查 | **阻止破坏性操作** |
| **知识记录** | [📄 知识管理规则](.claude/rules/memory-system-rules.md) | 经验记录、ADR完整性 | **要求补充文档** |

### 🚫 违规处理程序 (VIOLATION HANDLING)
1. **发现违规** → 立即停止当前操作
2. **强制查阅** → 要求查阅相关规则文件和记忆目录
3. **规则验证** → 根据规则重新执行操作
4. **文档引用** → 在回应中明确引用规则章节
5. **记忆调用** → 架构变更前强制调用记忆专家

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

## ⚡ COMPLIANCE VERIFICATION - 合规验证检查 (FINAL CHECK)

### 🔍 AI自检清单 (AI SELF-CHECK REQUIRED)
在执行任何操作前，AI必须通过以下检查：

- [ ] **记忆优先检查** - 已查阅项目记忆目录相关文件
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
**项目版本**: v2.7.0  
**规则架构**: v2.7.0 (记忆管理强化版)  
**项目所有者**: Jason Zhang  
**最后更新**: 2025-08-05  
**强制执行**: ACTIVE - 所有规则均为强制性  
**记忆管理**: ACTIVE - 记忆优先原则生效