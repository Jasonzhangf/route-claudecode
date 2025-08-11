#!/bin/bash

# 测试服务停止脚本
# 用途：停止在端口3457上运行的claude-code-router测试服务
# 作者：Jason Zhang

set -e

# 配置变量
TEST_PORT=3457
PID_FILE="/tmp/ccr-test-server.pid"
LOG_DIR="/tmp/pipeline-test-logs"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Claude Code Router 测试服务停止器 ===${NC}"

# 检查是否有服务在运行
RUNNING=false

# 方法1: 通过PID文件停止
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo -e "${YELLOW}发现运行中的测试服务 PID: $PID${NC}"
        kill "$PID"
        
        # 等待进程正常退出
        echo "等待进程正常退出..."
        WAIT_COUNT=0
        while kill -0 "$PID" 2>/dev/null && [ $WAIT_COUNT -lt 10 ]; do
            sleep 1
            WAIT_COUNT=$((WAIT_COUNT + 1))
        done
        
        # 如果进程仍然存在，强制杀死
        if kill -0 "$PID" 2>/dev/null; then
            echo -e "${YELLOW}进程未正常退出，强制终止...${NC}"
            kill -9 "$PID" 2>/dev/null || true
        fi
        
        echo -e "${GREEN}✅ 测试服务已停止 (PID: $PID)${NC}"
        RUNNING=true
    else
        echo -e "${YELLOW}PID文件存在但进程已不存在，清理PID文件${NC}"
    fi
    
    # 清理PID文件
    rm -f "$PID_FILE"
fi

# 方法2: 通过端口查找并停止进程  
PIDS=$(lsof -Pi :$TEST_PORT -sTCP:LISTEN -t 2>/dev/null || true)
if [ -n "$PIDS" ]; then
    echo -e "${YELLOW}发现占用端口 $TEST_PORT 的进程: $PIDS${NC}"
    for PID in $PIDS; do
        # 检查是否是node进程（避免误杀其他服务）
        PROCESS_NAME=$(ps -p $PID -o comm= 2>/dev/null || echo "unknown")
        if [[ "$PROCESS_NAME" == *"node"* ]]; then
            echo "停止node进程 PID: $PID"
            kill "$PID" 2>/dev/null || true
            sleep 1
            
            # 如果进程仍然存在，强制杀死
            if kill -0 "$PID" 2>/dev/null; then
                echo "强制终止进程 PID: $PID"
                kill -9 "$PID" 2>/dev/null || true
            fi
            RUNNING=true
        else
            echo -e "${YELLOW}警告: 端口被非node进程占用 ($PROCESS_NAME)，跳过${NC}"
        fi
    done
fi

# 验证端口是否已释放
sleep 1
if lsof -Pi :$TEST_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${RED}❌ 警告: 端口 $TEST_PORT 仍被占用${NC}"
    echo "占用进程:"
    lsof -Pi :$TEST_PORT -sTCP:LISTEN 2>/dev/null || true
else
    if [ "$RUNNING" = true ]; then
        echo -e "${GREEN}✅ 端口 $TEST_PORT 已释放${NC}"
    fi
fi

# 显示状态
if [ "$RUNNING" = false ]; then
    echo -e "${GREEN}ℹ️  没有发现运行中的测试服务${NC}"
else
    echo -e "${GREEN}✅ 测试服务停止完成${NC}"
fi

# 显示日志信息
if [ -d "$LOG_DIR" ]; then
    LATEST_LOG=$(ls -t "$LOG_DIR"/ccr-test-*.log 2>/dev/null | head -1 || true)
    if [ -n "$LATEST_LOG" ]; then
        echo
        echo -e "${BLUE}最新日志文件: $LATEST_LOG${NC}"
        echo "查看日志: tail -f $LATEST_LOG"
        
        # 显示最后几行日志（如果日志文件不太大）
        LOG_SIZE=$(wc -l < "$LATEST_LOG" 2>/dev/null || echo 0)
        if [ "$LOG_SIZE" -gt 0 ] && [ "$LOG_SIZE" -lt 1000 ]; then
            echo
            echo -e "${BLUE}最后几行日志:${NC}"
            tail -5 "$LATEST_LOG" 2>/dev/null || echo "无法读取日志"
        fi
    fi
fi

echo
echo -e "${BLUE}重启测试服务: ./test-server-start.sh${NC}"