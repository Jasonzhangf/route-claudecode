#!/bin/bash

# RCC v4.0 正确的构建和全局安装脚本
# 本地全面编译构建，然后npm install -g安装

set -e  # 遇到错误立即退出

echo "🚀 RCC v4.0 构建和全局安装"
echo "========================"
echo ""

# 1. 确保在正确的目录
if [[ ! -f "package.json" ]]; then
    echo "❌ 错误：请在项目根目录运行此脚本"
    exit 1
fi

# 2. 清理之前的构建
echo "🧹 清理之前的构建..."
rm -rf dist/
rm -f *.tgz

# 3. 安装依赖
echo "📦 安装依赖..."
npm install

# 4. TypeScript编译构建
echo "🔨 TypeScript编译构建..."
npm run build

# 5. 验证构建输出
if [[ ! -f "dist/cli.js" ]]; then
    echo "❌ 构建失败：dist/cli.js 不存在"
    exit 1
fi

echo "✅ 构建完成，验证输出文件..."
echo "   - dist/cli.js: $(ls -lh dist/cli.js | awk '{print $5}')"
echo "   - dist目录总大小: $(du -sh dist | awk '{print $1}')"

# 6. 准备npm包
echo "📦 创建npm包..."
npm pack

# 7. 获取包文件名
PACKAGE_FILE=$(ls -t *.tgz | head -n1)
if [[ -z "$PACKAGE_FILE" ]]; then
    echo "❌ 错误：未找到npm包文件"
    exit 1
fi

echo "   - 包文件: $PACKAGE_FILE"

# 8. 卸载旧版本
echo "🗑️ 卸载旧版本..."
npm uninstall -g route-claude-code 2>/dev/null || true
npm uninstall -g rcc4 2>/dev/null || true

# 9. 全局安装
echo "🔧 全局安装npm包..."
npm install -g "./$PACKAGE_FILE"

# 10. 验证安装
echo ""
echo "✅ 验证安装..."

# 检查CLI命令是否可用
if command -v rcc4 >/dev/null 2>&1; then
    echo "✅ rcc4命令已全局安装: $(which rcc4)"
    
    # 验证版本
    RCC_VERSION=$(rcc4 --version 2>/dev/null || echo "无法获取版本")
    echo "   - 版本: $RCC_VERSION"
    
else
    echo "❌ 安装失败，rcc4命令未找到"
    echo ""
    echo "请检查："
    echo "1. npm全局目录是否在PATH中: $(npm bin -g)"
    echo "2. 是否有权限安装全局包"
    echo "3. package.json中的bin配置是否正确"
    exit 1
fi

# 11. 测试基本功能
echo ""
echo "🧪 测试基本功能..."
rcc4 --help >/dev/null 2>&1 && echo "✅ --help 命令正常" || echo "❌ --help 命令失败"

# 12. 清理临时文件
echo ""
echo "🧹 清理临时文件..."
rm -f *.tgz

echo ""
echo "🎉 构建和安装成功！"
echo ""
echo "现在可以在任何位置使用："
echo "  rcc4 start --config <config> --port <port>"
echo "  rcc4 stop --port <port>"
echo ""
echo "示例："
echo "  rcc4 start --config ~/.route-claudecode/config/v4/single-provider/lmstudio-v4-5506.json --port 5506"
echo ""