#!/bin/bash

# 标准连续对话测试执行脚本
# 项目所有者: Jason Zhang

set -e

echo "🎯 Claude Code Router 标准连续对话测试流程"
echo "================================================"

# 检查服务器状态
echo "🔍 1. 检查服务器状态..."
if curl -s http://127.0.0.1:6677/health > /dev/null 2>&1; then
    echo "✅ 服务器运行正常 (端口6677 - kiro-gmail配置)"
    SERVER_PORT=6677
elif curl -s http://127.0.0.1:8888/health > /dev/null 2>&1; then
    echo "✅ 服务器运行正常 (端口8888)"
    SERVER_PORT=8888
elif curl -s http://127.0.0.1:3456/health > /dev/null 2>&1; then
    echo "✅ 服务器运行正常 (端口3456)"
    SERVER_PORT=3456
else
    echo "❌ 服务器未运行，请先启动服务器:"
    echo "   ./rcc start --debug"
    exit 1
fi

echo "📋 2. 执行标准测试套件..."
echo "   - 基础对话测试"
echo "   - 多轮对话测试" 
echo "   - 工具调用测试"
echo "   - 复杂工具调用测试"
echo "   - 长连续对话测试"
echo ""

# 执行测试
node test-continuous-conversation.js

# 检查测试结果
if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 标准测试流程完成！"
    echo "📊 查看服务器日志: tail -f ~/.route-claude-code/logs/release/*.log"
    echo "📈 查看统计信息: curl http://127.0.0.1:$SERVER_PORT/stats"
else
    echo ""
    echo "⚠️  测试过程中发现问题，请查看详细日志"
    exit 1
fi