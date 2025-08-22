#!/bin/bash

# ModelScope Claude工具调用测试脚本
# 用于验证ModelScope配置的Claude Code router工具调用功能

echo "🚀 开始ModelScope Claude工具调用测试"
echo "================================================"

# 配置变量 - 使用环境变量，提供默认值
CONFIG_FILE="${RCC_MODELSCOPE_CONFIG:-$HOME/.route-claudecode/config/v4/single-provider/modelscope-v4-5508-demo1-enhanced.json}"
SERVER_PORT="${RCC_TEST_PORT:-5508}"
WORKSPACE_DIR="${RCC_WORKSPACE_DIR:-$(pwd)}"

# 设置测试环境变量
export RCC_TEST_PORT="$SERVER_PORT"
export RCC_TEST_MODEL="${RCC_TEST_MODEL:-claude-3-5-sonnet-20241022}"
export RCC_TEST_API_KEY="${RCC_TEST_API_KEY:-rcc4-proxy-key}"

echo "📋 使用配置："
echo "   配置文件: $CONFIG_FILE"
echo "   端口: $SERVER_PORT"
echo "   工作目录: $WORKSPACE_DIR"

# 1. 检查配置文件是否存在
echo ""
echo "1. 检查配置文件..."
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ 配置文件不存在: $CONFIG_FILE"
    echo "请设置环境变量 RCC_MODELSCOPE_CONFIG 指向正确的配置文件"
    exit 1
fi
echo "✅ 配置文件存在: $CONFIG_FILE"

# 2. 检查端口状态并处理
echo ""
echo "2. 检查端口$SERVER_PORT状态..."

# 检查端口是否被占用
PORT_PID=$(lsof -t -i:$SERVER_PORT 2>/dev/null)

if [ -n "$PORT_PID" ]; then
    echo "🔍 发现端口$SERVER_PORT被进程$PORT_PID占用"
    
    # 检查是否是RCC服务器
    if curl -s -f http://localhost:$SERVER_PORT/health > /dev/null 2>&1; then
        echo "✅ 端口上运行的是RCC服务器，继续使用"
    else
        echo "⚠️  端口上运行的不是RCC服务器，尝试停止..."
        
        # 尝试优雅地停止进程
        echo "📤 向进程$PORT_PID发送TERM信号..."
        kill -TERM $PORT_PID 2>/dev/null
        
        # 等待进程停止
        sleep 2
        
        # 检查进程是否还在运行
        if kill -0 $PORT_PID 2>/dev/null; then
            echo "⚡ 强制停止进程$PORT_PID..."
            kill -KILL $PORT_PID 2>/dev/null
            sleep 1
        fi
        
        echo "✅ 端口$SERVER_PORT已清理"
    fi
else
    echo "📭 端口$SERVER_PORT空闲"
fi

# 再次检查是否有RCC服务器运行
if curl -s -f http://localhost:$SERVER_PORT/health > /dev/null 2>&1; then
    echo "✅ RCC服务器正在端口$SERVER_PORT运行"
else
    echo "🚀 启动RCC服务器..."
    echo "执行命令: rcc4 start --config \"$CONFIG_FILE\" --port $SERVER_PORT"
    
    # 在后台启动服务器
    nohup rcc4 start --config "$CONFIG_FILE" --port $SERVER_PORT > /tmp/rcc4-modelscope.log 2>&1 &
    SERVER_PID=$!
    
    echo "⏳ 等待服务器启动 (PID: $SERVER_PID)..."
    
    # 等待服务器启动，最多等待30秒
    for i in {1..30}; do
        if curl -s -f http://localhost:$SERVER_PORT/health > /dev/null 2>&1; then
            echo "✅ 服务器启动成功"
            break
        fi
        if [ $i -eq 30 ]; then
            echo "❌ 服务器启动超时"
            echo "查看日志: tail -f /tmp/rcc4-modelscope.log"
            exit 1
        fi
        echo "⏳ 等待中... ($i/30)"
        sleep 1
    done
fi

# 3. 运行TypeScript测试
echo ""
echo "3. 执行ModelScope专用测试..."
cd "$WORKSPACE_DIR"
node dist/debug/tool-calling-flow-test.js --modelscope

# 4. 清理函数
cleanup() {
    echo ""
    echo "🧹 测试完成，清理资源..."
    
    # 如果是我们启动的服务器，询问是否需要停止
    if [ -n "$SERVER_PID" ] && kill -0 $SERVER_PID 2>/dev/null; then
        echo "❓ 是否停止测试启动的RCC服务器? (y/N)"
        read -t 10 -n 1 response
        echo ""
        
        if [[ "$response" =~ ^[Yy]$ ]]; then
            echo "🛑 停止RCC服务器 (PID: $SERVER_PID)..."
            kill -TERM $SERVER_PID 2>/dev/null
            sleep 2
            
            if kill -0 $SERVER_PID 2>/dev/null; then
                kill -KILL $SERVER_PID 2>/dev/null
            fi
            echo "✅ 服务器已停止"
        else
            echo "ℹ️  保持RCC服务器运行 (PID: $SERVER_PID)"
        fi
    fi
}

# 设置退出时清理
trap cleanup EXIT

echo ""
echo "================================================"
echo "测试完成"