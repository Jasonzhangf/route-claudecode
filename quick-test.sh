#!/bin/bash
set -e

echo "🔧 快速重新安装和测试..."

cd /Users/fanzhang/Documents/github/route-claudecode/workspace/main-development

# 清理旧包
rm -f *.tgz

# 创建新包
echo "📦 创建npm包..."
npm pack
PACKAGE_FILE=$(ls -t *.tgz | head -n1)
echo "   包文件: $PACKAGE_FILE"

# 卸载旧版本
echo "🗑️ 卸载旧版本..."
npm uninstall -g route-claude-code 2>/dev/null || true
npm uninstall -g rcc4 2>/dev/null || true

# 安装新版本
echo "🔧 全局安装..."
npm install -g "./$PACKAGE_FILE"

# 清理
rm -f *.tgz

# 验证安装
if command -v rcc4 >/dev/null 2>&1; then
    echo "✅ rcc4已安装: $(which rcc4)"
else
    echo "❌ rcc4安装失败"
    exit 1
fi

echo "🚀 启动服务测试..."
rcc4 start --config ~/.route-claudecode/config/v4/single-provider/shuaihong-v4-5507-demo1-enhanced.json --port 5507