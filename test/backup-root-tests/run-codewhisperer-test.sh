#!/bin/bash

# CodeWhisperer重构验证测试脚本
# 项目所有者: Jason Zhang

echo "🚀 开始运行CodeWhisperer重构验证测试"
echo "📅 $(date)"
echo ""

# 设置测试目标服务器
TARGET_SERVER="http://localhost:3458"

echo "🎯 目标服务器: $TARGET_SERVER"
echo "🔍 检查服务器状态..."

# 检查服务器是否可达
if curl -s "$TARGET_SERVER/health" > /dev/null; then
    echo "✅ 服务器运行正常"
else
    echo "❌ 服务器不可达，请先启动服务器"
    exit 1
fi

echo ""
echo "🧪 执行标准测试：使用全部CodeWhisperer配置正常进行工具调用和完成多轮会话"
echo ""

# 运行测试脚本
node ./test-codewhisperer-refactor-validation.js

# 获取退出码
exit_code=$?

echo ""
if [ $exit_code -eq 0 ]; then
    echo "🎉 CodeWhisperer重构验证测试全部通过！"
    echo "✨ 重构成功，系统运行稳定"
else
    echo "⚠️  部分测试失败，请检查详细报告"
    echo "🔧 建议检查日志文件和错误报告"
fi

echo ""
echo "📁 测试结果文件位于: /tmp/"
echo "🔍 查看详细日志: ls -la /tmp/codewhisperer-refactor-*"
echo ""

exit $exit_code