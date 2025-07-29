#!/bin/bash

# 🚀 Claude Code Router 一键启动脚本
# 作者: Jason Zhang

set -e  # 遇到错误立即退出

echo "🚀 Claude Code Router 启动中..."
echo "==============================="

# 检查必要文件
echo "📋 检查必要文件..."
if [ ! -f "dist/cli.js" ]; then
    echo "❌ 未找到构建文件，正在构建项目..."
    npm run build
fi

if [ ! -f "/Users/fanzhang/.route-claude-code/config.json" ]; then
    echo "❌ 未找到配置文件 ~/.route-claude-code/config.json"
    echo "请先配置项目或复制示例配置文件"
    exit 1
fi

# 检查端口占用
echo "🔍 检查端口占用..."
PORT=3456
if lsof -i :$PORT >/dev/null 2>&1; then
    echo "⚠️  端口 $PORT 已被占用，正在终止..."
    lsof -ti :$PORT | xargs kill -9 >/dev/null 2>&1 || true
    sleep 2
fi

# 运行配置适配器确保兼容性
echo "🔧 运行配置适配器..."
node config-adapter.js

# 启动服务器
echo "🚀 启动 Claude Code Router 服务器..."
echo "    - 开发端口: 3456"
echo "    - 生产端口: 3457"
echo "    - 日志目录: ~/.route-claude-code/logs/"
echo "    - 状态检查: node dist/cli.js status"
echo ""

# 后台启动服务器并保存日志
LOG_FILE="/tmp/ccr-dev.log"
echo "📝 日志文件: $LOG_FILE"
echo ""

# 启动服务器
node dist/cli.js start --port 3456 --debug > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

# 等待服务器启动
echo "⏳ 等待服务器启动..."
sleep 3

# 检查服务器是否成功启动
if kill -0 $SERVER_PID 2>/dev/null; then
    echo "✅ 服务器启动成功！"
    echo ""
    echo "🌐 服务信息:"
    echo "   - 本地地址: http://127.0.0.1:3456"
    echo "   - 进程ID: $SERVER_PID"
    echo "   - 日志监控: tail -f $LOG_FILE"
    echo ""
    echo "🔧 设置 Claude Code 环境变量:"
    echo "   export ANTHROPIC_BASE_URL=http://127.0.0.1:3456"
    echo "   export ANTHROPIC_API_KEY=dummy-key"
    echo ""
    echo "📊 常用命令:"
    echo "   - 查看状态: node dist/cli.js status"
    echo "   - 查看日志: tail -f $LOG_FILE"
    echo "   - 停止服务: kill $SERVER_PID"
    echo ""
    echo "🎯 服务器正在后台运行中..."
    
    # 显示最近的日志
    echo ""
    echo "📄 最近日志:"
    echo "----------"
    tail -n 10 "$LOG_FILE" 2>/dev/null || echo "暂无日志输出"
    
else
    echo "❌ 服务器启动失败！"
    echo "请检查日志: cat $LOG_FILE"
    exit 1
fi