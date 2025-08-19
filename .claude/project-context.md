# 🎯 RCC v4.0 项目路径提醒

## 📁 关键路径
- **源码目录**: `src/` (仅修改此目录下的.ts文件)
- **编译目录**: `dist/` (禁止直接修改)
- **配置文件**: `~/.route-claudecode/config/v4/single-provider/lmstudio-v4-5506.json`
- **Debug日志**: `~/.route-claudecode/debug-logs/port-5506/`

## 🛠️ 标准脚本路径提醒 (使用现有脚本，不要创建新脚本)

### 📦 编译和构建
- **TypeScript编译**: 使用 `npm run build` (等同于 `tsc --noEmit && tsc`)
- **类型检查**: 使用 `npm run type-check` 或 `npm run type-check-strict`
- **开发模式**: 使用 `npm run dev` (监听文件变化自动编译)
- **清理编译**: 使用 `npm run clean` (清理dist目录)

### 🧪 测试脚本路径
- **完整测试**: `./test-all-providers.sh` (测试所有Provider)
- **CLI测试**: `./test-rcc-cli-providers.sh` (测试CLI功能)
- **工作流测试**: `./test-full-rcc-workflow.sh` (完整工作流测试)
- **快速测试**: `./quick-test-claude.sh` (快速Claude测试)
- **交互测试**: `./test-claude-interactive.sh` (交互式测试)

### ⚙️ 安装和部署
- **全局安装**: `./install-rcc4-global.sh` 或 `./user-rcc4-installer.sh`
- **简单安装**: `./simple-rcc4-installer.sh`
- **NPM全局**: `./npm-global-install.sh`

### 🚨 重要提醒
- **禁止创建新脚本**: 优先使用上述现有脚本
- **一次性测试命令**: 修改现有的 `./quick-test-claude.sh` 或相关测试脚本
- **编译使用**: `npm run build` 而不是手动tsc命令
- **测试脚本**: 在根目录查找现有的test-*.sh文件

## 🏗️ 当前架构状态
- ✅ 4层Pipeline正常工作: Router→Transformer→Protocol→Server-Compatibility
- ✅ Router层模型映射: claude-3-5-sonnet-20241022 → gpt-oss-20b-mlx
- ✅ Transformer层只做格式转换，不做模型映射
- ⏳ Server层需要最终调试完成