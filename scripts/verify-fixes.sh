#!/bin/bash

# 修复验证脚本
# 用于验证自动修复功能是否正常工作

set -e

echo "✅ 验证自动修复功能..."

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 检查依赖
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未找到 npm"
    exit 1
fi

# 检查修复脚本是否存在
if [ ! -f "scripts/auto-fix.sh" ]; then
    echo "❌ 错误: 未找到自动修复脚本"
    exit 1
fi

# 设置权限
chmod +x scripts/auto-fix.sh

# 运行验证模式的自动修复
echo "🔍 运行修复验证..."
if ./scripts/auto-fix.sh --verify-only; then
    echo "✅ 修复验证通过"
else
    echo "❌ 修复验证失败"
    exit 1
fi

# 检查是否有修复建议
echo "📋 检查修复建议..."
if ./scripts/auto-fix.sh --dry-run; then
    echo "✅ 修复建议生成成功"
else
    echo "❌ 修复建议生成失败"
    exit 1
fi

echo "🎉 修复功能验证完成！"