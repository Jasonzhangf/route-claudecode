#!/bin/bash

# RCC v4.0 Refactored Test Validation Execution Script
# 此脚本执行重构后测试架构的完整验证

echo "🧪 开始执行 RCC v4.0 重构后测试验证..."
echo "================================"

# 设置工作目录
cd /Users/fanzhang/Documents/github/route-claudecode/workspace/main-development

# 确保脚本可执行
chmod +x verify-refactored-tests.sh

# 执行验证脚本
echo "🚀 执行验证脚本..."
./verify-refactored-tests.sh

echo ""
echo "✅ 验证脚本执行完成"
echo "📊 查看测试结果和输出文件"