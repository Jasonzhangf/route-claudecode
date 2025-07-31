#!/bin/bash

# 重启服务并测试模型名修复

echo "🔄 Restarting Claude Code Router..."

# 找到并杀掉现有的Node进程
pkill -f "claude-code-router" || true
pkill -f "node.*dist/server.js" || true
sleep 2

# 重新构建并启动
echo "🔨 Building project..."
npm run build

echo "🚀 Starting server in background..."
npm start > /tmp/ccr-restart.log 2>&1 &

# 等待服务启动
echo "⏳ Waiting for server to start..."
sleep 5

# 检查服务状态
if curl -s http://127.0.0.1:3456/health >/dev/null; then
    echo "✅ Server is running"
    
    echo "🧪 Running model name fix test..."
    node test-model-name-fix.js
else
    echo "❌ Server failed to start"
    echo "📋 Server logs:"
    tail -20 /tmp/ccr-restart.log
fi