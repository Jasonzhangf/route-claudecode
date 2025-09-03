#!/bin/bash
set -e

echo "🔧 开始测试修复后的transformer..."

cd /Users/fanzhang/Documents/github/route-claudecode/workspace/main-development

# 1. 创建npm包
echo "📦 创建npm包..."
npm pack

# 2. 获取包文件名
PACKAGE_FILE=$(ls -t *.tgz | head -n1)
echo "   包文件: $PACKAGE_FILE"

# 3. 卸载旧版本
echo "🗑️ 卸载旧版本..."
npm uninstall -g route-claude-code 2>/dev/null || true
npm uninstall -g rcc4 2>/dev/null || true

# 4. 全局安装
echo "🔧 全局安装..."
npm install -g "./$PACKAGE_FILE"

# 5. 清理
rm -f *.tgz

# 6. 验证安装
if command -v rcc4 >/dev/null 2>&1; then
    echo "✅ rcc4已安装: $(which rcc4)"
    echo "📋 版本: $(rcc4 --version)"
else
    echo "❌ rcc4安装失败"
    exit 1
fi

echo ""
echo "✅ 安装完成！现在启动服务进行测试..."
echo ""

# 7. 启动服务
echo "🚀 启动服务（端口5507）..."
rcc4 start --config ~/.route-claudecode/config/v4/single-provider/shuaihong-v4-5507-demo1-enhanced.json --port 5507