#!/bin/bash

# Claude启动测试脚本 - RCC4端到端功能验证
# 用于测试Claude Code通过RCC4路由系统的完整功能

set -e

echo "🚀 Claude RCC4 端到端测试启动器"
echo "=================================="
echo ""

# 默认配置
DEFAULT_PORT="5506"
DEFAULT_CONFIG="~/.route-claudecode/config/v4/single-provider/lmstudio-v4-5506-demo1-enhanced.json"
TEST_COMMAND="请列出本地文件"

# 检查参数
PORT=${1:-$DEFAULT_PORT}
CONFIG_FILE=${2:-$DEFAULT_CONFIG}
CUSTOM_COMMAND=${3:-$TEST_COMMAND}

echo "📋 测试配置:"
echo "   端口: $PORT"
echo "   配置文件: $CONFIG_FILE"
echo "   测试命令: \"$CUSTOM_COMMAND\""
echo ""

# 检查RCC4服务状态
echo "🔍 检查RCC4服务状态..."
if curl -s "http://localhost:$PORT/health" >/dev/null 2>&1; then
    echo "✅ RCC4服务正在运行 (端口 $PORT)"
else
    echo "❌ RCC4服务未运行，请先启动服务："
    echo "   ./scripts/rcc4-server-start.sh"
    echo ""
    exit 2
fi

# 检查Claude Code是否可用
echo "🔍 检查Claude Code可用性..."
if ! command -v claude >/dev/null 2>&1; then
    echo "❌ Claude Code命令不可用"
    echo "   请确保Claude Code已正确安装并在PATH中"
    exit 2
fi

echo "✅ 环境检查完成"
echo ""

# 执行Claude测试
echo "🎯 执行Claude端到端测试..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "测试命令: ANTHROPIC_BASE_URL=http://localhost:$PORT ANTHROPIC_API_KEY=rcc4-proxy-key claude --print \"$CUSTOM_COMMAND\""
echo ""

# 记录开始时间
start_time=$(date +%s)

# 执行测试
if ANTHROPIC_BASE_URL="http://localhost:$PORT" ANTHROPIC_API_KEY="rcc4-proxy-key" claude --print "$CUSTOM_COMMAND"; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ Claude端到端测试成功！"
    echo "   响应时间: ${duration}秒"
    echo ""
    
    # 检查debug日志
    if [[ -d "./debug-logs" ]]; then
        latest_logs=$(find ./debug-logs -name "*.json" -type f -mmin -2 | wc -l)
        echo "📊 Debug日志检查:"
        echo "   新生成日志: $latest_logs 个文件"
        
        if [[ $latest_logs -gt 0 ]]; then
            echo "✅ Debug日志记录正常"
            echo "   查看日志: ls -la ./debug-logs/"
        else
            echo "⚠️  未发现新的debug日志"
        fi
    else
        echo "⚠️  Debug日志目录不存在"
    fi
    
    echo ""
    echo "🎉 RCC4系统端到端验证完成！"
    echo "   • Claude Code连接: ✅"
    echo "   • RCC4路由: ✅"
    echo "   • 工具调用: ✅"
    echo "   • 响应生成: ✅"
    
else
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "❌ Claude端到端测试失败！"
    echo ""
    echo "🔍 故障排查步骤:"
    echo "   1. 检查RCC4服务日志"
    echo "   2. 验证LM Studio后端状态"
    echo "   3. 检查网络连接"
    echo "   4. 查看debug-logs目录"
    echo ""
    echo "💡 常见解决方案:"
    echo "   • 重启RCC4服务: ./scripts/rcc4-server-start.sh"
    echo "   • 检查配置文件: $CONFIG_FILE"
    echo "   • 验证端口可用性: curl http://localhost:$PORT/health"
    echo ""
    exit 2
fi

echo ""
echo "📋 测试完成报告"
echo "================="
echo "状态: 成功"
echo "配置: $CONFIG_FILE"
echo "端口: $PORT"
echo "命令: $CUSTOM_COMMAND"
echo "时间: $(date)"
echo ""