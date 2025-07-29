#!/bin/bash

# ⚡ Claude Code Router 快速启动脚本
# 最简化的启动方式

set -e

echo "⚡ Claude Code Router 快速启动"
echo "============================="

# 检查配置
if [ ! -f "/Users/fanzhang/.route-claude-code/config.json" ]; then
    echo "❌ 配置文件未找到: ~/.route-claude-code/config.json"
    exit 1
fi

# 检查构建
if [ ! -f "dist/cli.js" ]; then
    echo "🔨 构建项目..."
    npm run build
fi

# 清理端口
PORT=3456
if lsof -i :$PORT >/dev/null 2>&1; then
    echo "🔧 清理端口 $PORT..."
    lsof -ti :$PORT | xargs kill -9 >/dev/null 2>&1 || true
    sleep 1
fi

# 启动服务器
echo "🚀 启动服务器..."
node dist/cli.js start --port $PORT &
SERVER_PID=$!

# 等待启动
sleep 3

if kill -0 $SERVER_PID 2>/dev/null; then
    echo "✅ 启动成功！"
    echo ""
    echo "🌐 服务地址: http://127.0.0.1:$PORT"
    echo "📊 状态检查: curl http://127.0.0.1:$PORT/status"
    echo "🛑 停止服务: kill $SERVER_PID"
    echo ""
    echo "🔧 Claude Code 环境变量:"
    echo "   export ANTHROPIC_BASE_URL=http://127.0.0.1:$PORT"
    echo "   export ANTHROPIC_API_KEY=dummy-key"
    echo ""
    echo "💡 服务器正在后台运行 (PID: $SERVER_PID)"
else 
    echo "❌ 启动失败"
    exit 1
fi