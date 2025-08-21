#!/bin/bash

# RCC4服务器启动脚本
# 用于启动RCC4路由服务器，供Claude Code连接使用

set -e

echo "🚀 RCC4服务器启动器"
echo "==================="
echo ""

# 默认配置
DEFAULT_PORT="5506"
DEFAULT_CONFIG="/Users/fanzhang/.route-claudecode/config/v4/single-provider/lmstudio-v4-5506-demo1-enhanced.json"

# 检查参数
PORT=${1:-$DEFAULT_PORT}
CONFIG_FILE=${2:-$DEFAULT_CONFIG}
DEBUG_MODE=${3:-"--debug"}

echo "📋 服务器配置:"
echo "   端口: $PORT"
echo "   配置文件: $CONFIG_FILE"
echo "   调试模式: $DEBUG_MODE"
echo ""

# 检查配置文件是否存在
if [[ ! -f "${CONFIG_FILE/#\~/$HOME}" ]]; then
    echo "❌ 配置文件不存在: $CONFIG_FILE"
    echo ""
    echo "🔍 可用的配置文件:"
    find ~/.route-claudecode/config -name "*.json" -type f 2>/dev/null | head -5
    echo ""
    exit 2
fi

# 检查端口是否被占用
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  端口 $PORT 已被占用"
    echo ""
    echo "🔍 占用进程信息:"
    lsof -Pi :$PORT -sTCP:LISTEN
    echo ""
    echo "💡 解决方案:"
    echo "   1. 停止占用进程: kill \$(lsof -t -i:$PORT)"
    echo "   2. 使用其他端口: $0 <新端口号>"
    echo ""
    read -p "是否要停止占用进程并继续? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔧 停止占用进程..."
        kill $(lsof -t -i:$PORT) 2>/dev/null || true
        sleep 2
    else
        echo "❌ 用户取消操作"
        exit 2
    fi
fi

# 检查rcc4命令是否可用
if ! command -v rcc4 >/dev/null 2>&1; then
    echo "❌ rcc4命令不可用"
    echo ""
    echo "🔧 解决方案:"
    echo "   1. 构建和安装: ./build-and-install.sh"
    echo "   2. 验证安装: rcc4 --version"
    echo ""
    exit 2
fi

echo "✅ 环境检查完成"
echo ""

# 启动RCC4服务器
echo "🚀 启动RCC4服务器..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "启动命令: rcc4 start --config $CONFIG_FILE --port $PORT $DEBUG_MODE"
echo ""
echo "🔗 服务地址: http://localhost:$PORT"
echo "📋 健康检查: http://localhost:$PORT/health"
echo ""
echo "💡 使用提示:"
echo "   • 测试连接: ./scripts/claude-test-runner.sh"
echo "   • 停止服务: Ctrl+C"
echo "   • 查看日志: tail -f debug-logs/*.json"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 执行启动命令并捕获输出
echo "🔧 执行启动命令: rcc4 start --config $CONFIG_FILE --port $PORT $DEBUG_MODE"

# 创建临时日志文件来捕获输出
TEMP_LOG="/tmp/rcc4-startup-log-$$.txt"
echo "📝 临时日志文件: $TEMP_LOG"

# 启动服务并重定向输出到日志文件
rcc4 start --config "$CONFIG_FILE" --port "$PORT" $DEBUG_MODE > "$TEMP_LOG" 2>&1 &
RCC_PID=$!
echo "🆔 RCC4进程ID: $RCC_PID"

# 等待几秒让服务启动
sleep 3

# 检查进程是否还在运行
if kill -0 $RCC_PID 2>/dev/null; then
    echo "✅ RCC4进程正在运行"
    
    # 检查端口是否被监听
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "✅ 端口 $PORT 已正在监听"
        echo "🎯 服务启动成功！"
    else
        echo "❌ 端口 $PORT 未被监听，服务可能启动失败"
        echo "📋 当前监听的端口："
        lsof -Pi -sTCP:LISTEN | grep -E ":(5[0-9]{3}|[4-9][0-9]{3})" || echo "无相关端口监听"
    fi
    
    # 尝试健康检查
    echo "🔍 执行健康检查..."
    if curl -s "http://localhost:$PORT/health" >/dev/null 2>&1; then
        echo "✅ 健康检查通过"
    else
        echo "❌ 健康检查失败"
    fi
    
    # 保持前台运行
    wait $RCC_PID
else
    echo "❌ RCC4进程已退出，启动失败"
    echo ""
    echo "📋 启动日志内容:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if [[ -f "$TEMP_LOG" ]]; then
        cat "$TEMP_LOG"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    else
        echo "⚠️ 日志文件不存在"
    fi
    echo ""
    # 清理临时日志文件
    rm -f "$TEMP_LOG"
    exit 1
fi