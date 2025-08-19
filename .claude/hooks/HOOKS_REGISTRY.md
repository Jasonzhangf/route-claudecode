# RCC v4.0 Project Hooks Registry

## 🎯 项目特定Hooks

此目录只包含RCC v4.0项目特定的Claude Code hooks，全局hooks保存在`~/.claude/hooks/`中。

### 📋 项目Hooks清单

#### PreToolUse Hooks
- **`pre_bash_e2e_verification_enforcer_hook.sh`**
  - **功能**: E2E验证强制检查 - 检测关键部署/构建命令时强制要求先执行E2E验证
  - **触发**: Bash命令匹配关键模式(npm run build, docker build, ./dist/cli.js start等)
  - **行为**: 阻塞操作并要求执行`./scripts/verify-e2e-debug-system.sh`
  - **退出码**: 0(允许) / 2(阻塞)

#### Stop Hooks
- **`stop_universal_build_reminder_hook.sh`**  
  - **功能**: 构建测试提醒清单 - 在停止时提醒完整的构建验证流程
  - **触发**: Stop事件
  - **内容**: TypeScript编译、全局安装、端到端测试检查清单

- **`stop_universal_debug_enforcer_hook.sh`**
  - **功能**: Debug验证强制提醒 - 强制要求执行RCC debug系统验证
  - **触发**: Stop事件  
  - **验证脚本**: `./scripts/verify-e2e-debug-system.sh`
  - **核心命令**: RCC端到端验证命令

### 🔧 验证脚本集成

项目hooks与验证脚本紧密集成：

```bash
# E2E验证脚本
./scripts/verify-e2e-debug-system.sh
  ├── 检查RCC服务器状态 (端口5506)  
  ├── 执行Claude客户端连接测试
  ├── 验证工具调用功能 (文件列表)
  ├── 检查debug日志生成
  └── 输出完整验证报告
```

### 🎯 项目配置

这些hooks在项目的`.claude/settings.json`中配置：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash", 
        "hooks": [{"command": "bash .claude/hooks/pre_bash_e2e_verification_enforcer_hook.sh"}]
      }
    ],
    "Stop": [
      {
        "matcher": ".*",
        "hooks": [
          {"command": "bash .claude/hooks/stop_universal_build_reminder_hook.sh"},
          {"command": "bash .claude/hooks/stop_universal_debug_enforcer_hook.sh"}
        ]
      }
    ]
  }
}
```

### 📊 与全局Hooks的关系

- **全局Hooks**: 通用开发规则(代码质量、安全检查、文件组织等)
- **项目Hooks**: RCC v4.0特定的验证和构建要求
- **协同工作**: 全局hooks先执行通用检查，项目hooks执行特定验证

---
**更新时间**: 2025-08-18  
**版本**: v2.0 - 项目特定hooks版本

## Path Configuration Update (v2.1)

**Date**: 2025-08-19 16:56:22  
**Update**: Hook path configuration fix

### Issue Resolved
Hook execution was failing with 'No such file or directory' error when using relative paths:
```
bash: .claude/hooks/pre_bash_e2e_verification_enforcer_hook.sh: No such file or directory
```

### Solution Applied
Updated `.claude/settings.json` to use absolute paths instead of relative paths:

**Before (v2.0)**:
```json
"command": "bash .claude/hooks/pre_bash_e2e_verification_enforcer_hook.sh"
```

**After (v2.1)**:
```json
"command": "bash /Users/fanzhang/Documents/github/route-claudecode/workspace/main-development/.claude/hooks/pre_bash_e2e_verification_enforcer_hook.sh"
```

### Verification
All hooks now execute correctly from any working directory:
✅ PreToolUse hooks: E2E verification, anti-fraud detection
✅ PostToolUse hooks: Compliance scanning
✅ Stop hooks: Build reminder, debug enforcement

**Status**: RESOLVED - Hook system fully operational



## Configuration Conflict Resolution (v2.2)

**Date**: 2025-08-19 16:59:35  
**Update**: settings.local.json configuration conflict resolved

### Issue Identified
Even after fixing absolute paths in `.claude/settings.json`, hooks were still failing:
```
bash: .claude/hooks/stop_universal_build_reminder_hook.sh: No such file or directory
```

### Root Cause Analysis
Found conflicting hook configuration in `.claude/settings.local.json`:
```json
{
  "hooks": {
    "pre_bash": "hooks/local-projects/...",
    "stop_universal_build_reminder": "hooks/local-projects/...",
    "stop_universal_debug_enforcer": "hooks/local-projects/..."
  }
}
```

This old-format configuration was overriding the corrected main settings.

### Solution Applied
Removed conflicting hook configuration from `.claude/settings.local.json`, keeping only:
```json
{
  "permissions": {
    "allow": ["Bash(git init:*)"],
    "deny": [],
    "additionalDirectories": ["/Users/fanzhang/.route-claudecode"]
  }
}
```

### Final Status
✅ All hooks now execute correctly with absolute paths
✅ No configuration conflicts between settings files
✅ Stop hooks functioning properly
✅ Hook system fully operational

**Status**: RESOLVED - Configuration conflicts eliminated, all hooks working

