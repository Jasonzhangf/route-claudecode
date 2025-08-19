# TypeScript-Only 规则索引

## 🔷 TypeScript-Only 强制政策完整实施

**实施日期**: 2025-08-16  
**状态**: ✅ 已完成并强制执行

### 📋 规则文档索引

#### 核心政策文档
- **`typescript-only-policy.md`** - TypeScript-Only强制执行政策
- **`typescript-development-workflow.md`** - TypeScript开发工作流程规范

#### 执行脚本工具
- **`scripts/typescript-only-check.sh`** - TypeScript-Only合规检查
- **`scripts/dist-protection.sh`** - 编译文件保护设置
- **`scripts/automated-compliance-check.sh`** - 全面自动化合规检查
- **`scripts/compliance-monitor.sh`** - 持续合规监控系统

### 🛠️ 快速执行命令

#### 日常开发检查
```bash
# TypeScript-Only规范检查
bash .claude/rules/scripts/typescript-only-check.sh

# 类型覆盖率检查
npx type-coverage --at-least 95

# 编译验证
npm run build
```

#### 全面合规验证
```bash
# 完整合规检查 (推荐)
bash .claude/rules/scripts/automated-compliance-check.sh

# 设置Git hooks保护
bash .claude/rules/scripts/dist-protection.sh
```

#### 持续监控
```bash
# 定期监控报告
bash .claude/rules/scripts/compliance-monitor.sh monitor

# 快速状态检查
bash .claude/rules/scripts/compliance-monitor.sh quick
```

### 🚨 强制执行要求

#### 绝对禁止的操作
- ❌ 修改任何 `.js` 文件
- ❌ 创建新的 `.js` 文件  
- ❌ 直接修改 `dist/` 目录文件
- ❌ 使用 `@ts-ignore` 绕过错误
- ❌ 创建自定义编译脚本

#### 强制要求的操作
- ✅ 所有源代码必须使用 `.ts` 扩展名
- ✅ TypeScript编译必须无错误
- ✅ 类型覆盖率必须 ≥95%
- ✅ 使用固定编译脚本 (`./install.sh` 或 `./build.sh`)
- ✅ 提交前通过所有TypeScript检查

### 📊 合规标准

#### 质量指标要求
- **类型覆盖率**: ≥95%
- **编译错误**: 0个
- **ESLint错误**: 0个
- **any类型使用**: ≤5处
- **JavaScript文件**: 0个 (仅限src目录)

#### 检查通过标准
- 运行 `bash .claude/rules/scripts/automated-compliance-check.sh` 必须返回退出码0
- 所有检查项必须显示 "✅ 通过" 状态
- 合规得分必须达到100%

### 🔧 集成到CLAUDE.md

TypeScript-Only规则已完全集成到项目的主要执行规范中：

#### 开发流程集成
- **任务执行前**: 必须运行TypeScript-Only检查
- **开发过程中**: 禁止创建JavaScript文件，强制类型检查
- **完成前验证**: 必须通过自动化合规检查

#### 强制执行机制
- **Git Pre-commit Hooks**: 自动阻止违规提交
- **持续监控**: 定期检查和报告
- **自动化检查**: 集成到CI/CD流程

### ⚠️ 违规处理

#### 自动拒绝触发条件
1. 检测到JavaScript文件修改
2. TypeScript编译失败
3. 类型覆盖率低于95%
4. 直接修改dist目录
5. 绕过强制检查

#### 错误恢复流程
```bash
# 1. 运行诊断检查
bash .claude/rules/scripts/typescript-only-check.sh

# 2. 查看详细错误
npm run build
npx type-coverage --detail

# 3. 修复TypeScript错误
# 编辑相关.ts文件，添加类型定义

# 4. 重新验证
bash .claude/rules/scripts/automated-compliance-check.sh
```

---

**📝 使用说明**: 本索引提供了TypeScript-Only规则的快速参考。开发过程中请随时查阅相关文档和执行对应的检查命令，确保严格遵循TypeScript-Only开发规范。