#!/bin/bash
set -e

echo "🔨 重新构建和安装RCC4..."

# 1. 清理之前的构建
echo "🧹 清理之前的构建..."
rm -rf dist/
rm -f *.tgz

# 2. 安装依赖
echo "📦 安装依赖..."
npm install

# 3. TypeScript编译构建
echo "🔨 TypeScript编译构建..."
npm run build

# 4. 验证构建输出
if [[ ! -f "dist/cli.js" ]]; then
    echo "❌ 构建失败：dist/cli.js 不存在"
    exit 1
fi

echo "✅ 构建完成，验证输出文件..."
echo "   - dist/cli.js: $(ls -lh dist/cli.js | awk '{print $5}')"

# 5. 检查转换器编译
if [[ ! -f "dist/modules/transformers/anthropic-openai-converter.js" ]]; then
    echo "❌ 转换器编译失败：文件不存在"
    exit 1
fi
echo "   - transformer: $(ls -lh dist/modules/transformers/anthropic-openai-converter.js | awk '{print $5}')"

# 6. 准备npm包
echo "📦 创建npm包..."
npm pack

# 7. 获取包文件名
PACKAGE_FILE=$(ls -t *.tgz | head -n1)
echo "   - 包文件: $PACKAGE_FILE"

# 8. 卸载旧版本
echo "🗑️ 卸载旧版本..."
npm uninstall -g route-claude-code 2>/dev/null || true
npm uninstall -g rcc4 2>/dev/null || true

# 9. 全局安装
echo "🔧 全局安装npm包..."
npm install -g "./$PACKAGE_FILE" --verbose

# 10. 验证安装
echo "✅ 验证安装..."
if command -v rcc4 >/dev/null 2>&1; then
    echo "✅ rcc4命令已全局安装: $(which rcc4)"
    RCC_VERSION=$(rcc4 --version 2>/dev/null || echo "无法获取版本")
    echo "   - 版本: $RCC_VERSION"
else
    echo "❌ 安装失败，rcc4命令未找到"
    exit 1
fi

# 11. 清理临时文件
rm -f *.tgz

echo "🎉 构建和安装成功！"