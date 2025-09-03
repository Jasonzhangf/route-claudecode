#!/bin/bash

# Claude Code工具调用测试脚本
# 用于验证RCC4 shuaihong provider的可用性和代码逻辑

set -e

echo "🧪 Claude Code工具调用测试脚本"
echo "=================================="

# 配置参数
RCC4_PORT=5507
CONFIG_FILE="config/fixed-shuaihong-config.json"
ANTHROPIC_API_KEY="rcc4-proxy-key"
ANTHROPIC_BASE_URL="http://localhost:${RCC4_PORT}"

echo "📋 测试配置:"
echo "  - RCC4端口: ${RCC4_PORT}"
echo "  - 配置文件: ${CONFIG_FILE}"
echo "  - API密钥: ${ANTHROPIC_API_KEY}"
echo "  - 基础URL: ${ANTHROPIC_BASE_URL}"
echo ""

# 检查RCC4服务状态
echo "🔍 检查RCC4服务状态..."
if ! curl -s "http://localhost:${RCC4_PORT}/health" > /dev/null; then
    echo "❌ RCC4服务未运行在端口${RCC4_PORT}"
    echo "请先启动RCC4服务:"
    echo "  rcc4 start --config ${CONFIG_FILE} --port ${RCC4_PORT}"
    exit 1
fi
echo "✅ RCC4服务运行正常"
echo ""

# 执行Claude Code工具调用测试
echo "🚀 执行Claude Code工具调用测试..."
echo "请求: 列出本项目下文件列表"
echo ""

# 使用Claude Code的官方命令进行测试
export ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL}"
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}"

echo "🔧 环境变量设置:"
echo "  ANTHROPIC_BASE_URL=${ANTHROPIC_BASE_URL}"
echo "  ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}"
echo ""

echo "📝 执行Claude Code命令..."
echo "命令: claude --print \"列出本项目下文件列表\""
echo ""

# 执行Claude Code命令并捕获输出
if claude --print "列出本项目下文件列表" 2>&1; then
    echo ""
    echo "✅ Claude Code工具调用测试成功"
else
    echo ""
    echo "❌ Claude Code工具调用测试失败"
    exit 1
fi

echo ""
echo "🔍 查看最新的调试日志..."

# 查找最新的调试日志文件
DEBUG_DIR="/Users/fanzhang/.route-claudecode/debug-logs/port-${RCC4_PORT}"
if [ -d "${DEBUG_DIR}" ]; then
    LATEST_LOG=$(ls -t "${DEBUG_DIR}"/*.json 2>/dev/null | head -1)
    if [ -n "${LATEST_LOG}" ]; then
        echo "📄 最新调试日志: ${LATEST_LOG}"
        echo ""
        echo "🔧 Transformer层输出检查:"
        cat "${LATEST_LOG}" | jq '.pipelineSteps[] | select(.layer == "transformer") | .output'
        echo ""
        echo "🔧 Server层状态检查:"
        cat "${LATEST_LOG}" | jq '.pipelineSteps[] | select(.layer == "server") | {success: .success, error: .error}'
        echo ""
        echo "📊 完整流水线状态:"
        cat "${LATEST_LOG}" | jq '.pipelineSteps[] | {layer: .layer, success: .success, duration: .duration}'
    else
        echo "⚠️  未找到调试日志文件"
    fi
else
    echo "⚠️  调试日志目录不存在: ${DEBUG_DIR}"
fi

echo ""
echo "🏁 测试完成"