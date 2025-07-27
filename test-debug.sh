#!/bin/bash

# 测试调试脚本 - 构建并运行调试测试
# 项目所有者: Jason Zhang

echo "🔧 开始构建项目..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ 构建成功，运行调试测试..."
    node debug-response.js
else
    echo "❌ 构建失败，无法运行测试"
    exit 1
fi