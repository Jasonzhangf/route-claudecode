#!/bin/bash

# RCC v4.0 测试修复检查脚本
echo "🔧 RCC v4.0 测试修复检查开始..."

# 检查修复文件
echo "📁 检查修复文件..."
if [ -f "src/modules/error-handler/src/types/error.ts" ]; then
    echo "✅ error types 已创建"
else
    echo "❌ error types 缺失"
fi

if [ -f "src/interfaces/core/error-coordination-center.ts" ]; then
    echo "✅ error interfaces 已创建"
else
    echo "❌ error interfaces 缺失"
fi

# 检查Jest配置
if grep -q "moduleNameMapper" jest.config.js; then
    echo "✅ Jest配置已修复"
else
    echo "❌ Jest配置未修复"
fi

# 检查TypeScript依赖
if grep -q '"typescript"' package.json; then
    echo "✅ TypeScript依赖已添加"
else
    echo "❌ TypeScript依赖缺失"
fi

echo "🎉 基础修复检查完成"