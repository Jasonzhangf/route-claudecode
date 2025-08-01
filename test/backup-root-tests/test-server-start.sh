#!/bin/bash

# 测试服务启动脚本
# 用途：使用测试配置在端口3457启动claude-code-router服务，供流水线测试使用
# 作者：Jason Zhang

set -e

# 配置变量
TEST_CONFIG="/tmp/test-config.json"
TEST_PORT=3457
LOG_DIR="/tmp/pipeline-test-logs"
PID_FILE="/tmp/ccr-test-server.pid"
SERVICE_NAME="ccr-test-server"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Claude Code Router 测试服务启动器 ===${NC}"
echo "配置文件: $TEST_CONFIG"
echo "端口: $TEST_PORT"
echo "日志目录: $LOG_DIR"

# 创建日志目录
mkdir -p "$LOG_DIR"

# 检查测试配置文件是否存在
if [ ! -f "$TEST_CONFIG" ]; then
    echo -e "${RED}错误: 测试配置文件 $TEST_CONFIG 不存在${NC}"
    echo "请先创建测试配置文件，包含以下基本结构："
    echo '{
  "port": 3457,
  "routing": {
    "default": { "provider": "codewhisperer-primary", "model": "CLAUDE_SONNET_4_20250514_V1_0" },
    "background": { "provider": "shuaihong-openai", "model": "gemini-2.5-flash" },
    "thinking": { "provider": "codewhisperer-primary", "model": "CLAUDE_SONNET_4_20250514_V1_0" },
    "longcontext": { "provider": "shuaihong-openai", "model": "gemini-2.5-pro" },
    "search": { "provider": "shuaihong-openai", "model": "gemini-2.5-flash" }
  }
}'
    exit 1
fi

# 检查项目是否已构建
if [ ! -f "dist/server.js" ]; then
    echo -e "${YELLOW}警告: 项目未构建，正在构建...${NC}"
    npm run build
    if [ $? -ne 0 ]; then
        echo -e "${RED}错误: 项目构建失败${NC}"
        exit 1
    fi
fi

# 检查端口是否被占用，如果被占用则停止旧进程
if lsof -Pi :$TEST_PORT -sTCP:LISTEN -t >/dev/null; then
    echo -e "${YELLOW}警告: 端口 $TEST_PORT 已被占用，正在停止旧进程...${NC}"
    
    # 尝试通过PID文件停止
    if [ -f "$PID_FILE" ]; then
        OLD_PID=$(cat "$PID_FILE")
        if kill -0 "$OLD_PID" 2>/dev/null; then
            echo "停止进程 PID: $OLD_PID"
            kill "$OLD_PID"
            sleep 2
        fi
        rm -f "$PID_FILE"
    fi
    
    # 强制停止占用端口的进程
    PIDS=$(lsof -Pi :$TEST_PORT -sTCP:LISTEN -t)
    if [ -n "$PIDS" ]; then
        echo "强制停止端口 $TEST_PORT 上的进程: $PIDS"
        kill -9 $PIDS 2>/dev/null || true
        sleep 1
    fi
fi

# 生成时间戳用于日志文件名
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
LOG_FILE="$LOG_DIR/ccr-test-$TIMESTAMP.log"

echo -e "${BLUE}启动测试服务...${NC}"
echo "日志文件: $LOG_FILE"

# 启动服务（后台运行）
export CONFIG_PATH="$TEST_CONFIG"
nohup node dist/server.js > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

# 保存PID
echo $SERVER_PID > "$PID_FILE"

echo -e "${GREEN}测试服务已启动${NC}"
echo "PID: $SERVER_PID"
echo "配置: $TEST_CONFIG"
echo "端口: $TEST_PORT"
echo "日志: $LOG_FILE"

# 等待服务启动
echo -e "${BLUE}等待服务启动...${NC}"
sleep 3

# 验证服务状态
MAX_ATTEMPTS=10
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    if curl -s "http://localhost:$TEST_PORT/health" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ 测试服务启动成功！${NC}"
        echo "健康检查: http://localhost:$TEST_PORT/health"
        echo "API端点: http://localhost:$TEST_PORT/v1/messages"
        echo
        echo -e "${BLUE}服务管理命令:${NC}"
        echo "  查看日志: tail -f $LOG_FILE"
        echo "  停止服务: ./test-server-stop.sh"
        echo "  检查状态: curl http://localhost:$TEST_PORT/health"
        echo
        exit 0
    fi
    
    echo "尝试 $ATTEMPT/$MAX_ATTEMPTS: 等待服务响应..."
    sleep 2
    ATTEMPT=$((ATTEMPT + 1))
done

# 服务启动失败
echo -e "${RED}❌ 测试服务启动失败${NC}"
echo "请检查日志文件: $LOG_FILE"
echo "最后几行日志:"
tail -10 "$LOG_FILE" 2>/dev/null || echo "无法读取日志文件"

# 清理失败的进程
if kill -0 $SERVER_PID 2>/dev/null; then
    echo "清理失败的进程 PID: $SERVER_PID"
    kill $SERVER_PID 2>/dev/null || kill -9 $SERVER_PID 2>/dev/null
fi
rm -f "$PID_FILE"

exit 1