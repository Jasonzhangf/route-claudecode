#!/bin/bash

echo "🔧 RCC v4.0 编译检查 - 四层流水线架构"
echo "==============================================="

# 切换到项目根目录
cd "$(dirname "$0")"

echo "📁 当前目录: $(pwd)"
echo "🔍 检查 tsconfig.json..."

if [ ! -f "tsconfig.json" ]; then
    echo "❌ 错误: 找不到 tsconfig.json 文件"
    exit 1
fi

echo "✅ tsconfig.json 存在"
echo ""

echo "🏗️ 执行 TypeScript 编译检查..."
echo "命令: npx tsc --noEmit"
echo ""

# 运行 TypeScript 编译检查
npx tsc --noEmit

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ TypeScript 编译检查通过！"
    echo "🎉 四层流水线架构编译成功"
else
    echo ""
    echo "❌ TypeScript 编译检查失败"
    echo "🔍 请检查上述错误信息并修复"
    exit 1
fi