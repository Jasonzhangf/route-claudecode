#!/bin/bash

# 🛑 Claude Code Router 停止脚本
# 作者: Jason Zhang

echo "🛑 停止 Claude Code Router 服务器..."
echo "=================================="

# 查找并终止所有相关进程
PROCESSES=$(pgrep -f "node.*cli.js.*server" || true)

if [ -z "$PROCESSES" ]; then
    echo "ℹ️  未找到正在运行的服务器进程"
else
    echo "🔍 发现进程: $PROCESSES"
    echo "$PROCESSES" | xargs kill -9
    echo "✅ 服务器进程已终止"
fi

# 清理端口占用
PORTS="3456 3457"
for PORT in $PORTS; do
    if lsof -i :$PORT >/dev/null 2>&1; then
        echo "🔧 清理端口 $PORT..."
        lsof -ti :$PORT | xargs kill -9 >/dev/null 2>&1 || true
    fi
done

echo "✅ 清理完成"
echo ""
echo "📊 当前端口状态:"
echo "   - 3456: $(lsof -i :3456 >/dev/null 2>&1 && echo "占用" || echo "空闲")"
echo "   - 3457: $(lsof -i :3457 >/dev/null 2>&1 && echo "占用" || echo "空闲")"