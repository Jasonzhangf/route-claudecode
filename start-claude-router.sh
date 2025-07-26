#!/bin/bash

# Claude Code Router 一键启动脚本
# 启动路由器并设置环境变量，然后运行Claude Code

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置
PORT=3456
DEFAULT_CONFIG_DIR="$HOME/.claude-code-router"
CONFIG_FILE="$DEFAULT_CONFIG_DIR/config-router.json"
DEBUG=false
CLAUDE_COMMAND=""

# 解析命令行参数
while [[ $# -gt 0 ]]; do
  case $1 in
    -p|--port)
      PORT="$2"
      shift 2
      ;;
    -c|--config)
      CONFIG_FILE="$2"
      shift 2
      ;;
    -d|--debug)
      DEBUG=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS] [CLAUDE_COMMAND]"
      echo ""
      echo "Options:"
      echo "  -p, --port PORT        Router port (default: 3456)"
      echo "  -c, --config FILE      Configuration file (default: ~/.claude-code-router/config-router.json)"
      echo "  -d, --debug            Enable debug mode"
      echo "  -h, --help             Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                                    # 启动路由器并等待"
      echo "  $0 \"帮我写一个Python函数\"            # 启动路由器并运行Claude Code"
      echo "  $0 --debug \"解释这段代码\"            # 调试模式启动"
      exit 0
      ;;
    *)
      CLAUDE_COMMAND="$*"
      break
      ;;
  esac
done

echo -e "${CYAN}🚀 Claude Code Router 一键启动${NC}"
echo -e "${CYAN}==============================${NC}"

# 检查必要文件
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo -e "${RED}❌ 配置文件不存在: $CONFIG_FILE${NC}"
    echo -e "${YELLOW}💡 使用默认配置或指定正确的配置文件${NC}"
    exit 1
fi

if [[ ! -f "dist/cli.js" ]]; then
    echo -e "${BLUE}🔨 项目需要构建...${NC}"
    npm run build
fi

# 检查端口是否被占用
if lsof -i :$PORT > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  端口 $PORT 被占用，正在关闭占用进程...${NC}"
    lsof -ti :$PORT | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# 启动路由器
echo -e "${BLUE}🌐 启动 Claude Code Router (端口: $PORT)${NC}"

START_CMD="node dist/cli.js start --config $CONFIG_FILE --port $PORT"
if [[ "$DEBUG" == "true" ]]; then
    START_CMD="$START_CMD --debug"
fi

# 后台启动路由器
LOG_FILE="/tmp/ccr-$(date +%Y%m%d-%H%M%S).log"
$START_CMD > "$LOG_FILE" 2>&1 &
ROUTER_PID=$!

# 等待路由器启动
echo -e "${YELLOW}⏳ 等待路由器启动...${NC}"
sleep 5

# 检查路由器是否启动成功
if ! kill -0 $ROUTER_PID 2>/dev/null; then
    echo -e "${RED}❌ 路由器启动失败${NC}"
    echo -e "${RED}📋 检查日志: $LOG_FILE${NC}"
    cat "$LOG_FILE"
    exit 1
fi

# 验证路由器健康状态
if curl -s "http://127.0.0.1:$PORT/status" > /dev/null; then
    echo -e "${GREEN}✅ 路由器启动成功！${NC}"
else
    echo -e "${YELLOW}⚠️  路由器可能未完全就绪，但进程正在运行${NC}"
fi

# 设置环境变量（仅当前脚本）
export ANTHROPIC_BASE_URL="http://127.0.0.1:$PORT"
export ANTHROPIC_API_KEY="any-string-is-ok"

echo -e "${GREEN}🔧 环境变量已设置：${NC}"
echo -e "${GREEN}   ANTHROPIC_BASE_URL=$ANTHROPIC_BASE_URL${NC}"
echo -e "${GREEN}   ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY${NC}"

# 显示状态信息
echo -e "${CYAN}📊 路由器状态：${NC}"
curl -s "http://127.0.0.1:$PORT/status" | jq . 2>/dev/null || echo "无法获取详细状态"

# 如果提供了Claude命令，直接执行
if [[ -n "$CLAUDE_COMMAND" ]]; then
    echo -e "${BLUE}🤖 运行 Claude Code: $CLAUDE_COMMAND${NC}"
    echo -e "${CYAN}===============================================${NC}"
    
    if command -v claude-code >/dev/null 2>&1; then
        claude-code "$CLAUDE_COMMAND"
    else
        echo -e "${RED}❌ claude-code 命令未找到${NC}"
        echo -e "${YELLOW}💡 请确保 Claude Code 已安装并在 PATH 中${NC}"
        exit 1
    fi
else
    # 交互模式
    echo -e "${CYAN}🎉 路由器已启动！现在你可以：${NC}"
    echo ""
    echo -e "${GREEN}1. 直接使用 Claude Code (会自动路由):${NC}"
    echo -e "${BLUE}   claude-code \"你的问题\"${NC}"
    echo ""
    echo -e "${GREEN}2. 在新终端中设置环境变量:${NC}"
    echo -e "${BLUE}   export ANTHROPIC_BASE_URL=\"http://127.0.0.1:$PORT\"${NC}"
    echo -e "${BLUE}   export ANTHROPIC_API_KEY=\"any-string-is-ok\"${NC}"
    echo ""
    echo -e "${GREEN}3. 查看日志:${NC}"
    echo -e "${BLUE}   tail -f $LOG_FILE${NC}"
    echo ""
    echo -e "${GREEN}4. 停止路由器:${NC}"
    echo -e "${BLUE}   kill $ROUTER_PID${NC}"
    echo ""
    echo -e "${YELLOW}📋 路由器进程 ID: $ROUTER_PID${NC}"
    echo -e "${YELLOW}📋 日志文件: $LOG_FILE${NC}"
    
    # 等待用户中断
    echo -e "${CYAN}按 Ctrl+C 停止路由器...${NC}"
    
    # 捕获中断信号
    trap 'echo -e "\n${YELLOW}🛑 正在停止路由器...${NC}"; kill $ROUTER_PID 2>/dev/null; wait $ROUTER_PID 2>/dev/null; echo -e "${GREEN}✅ 路由器已停止${NC}"; exit 0' INT
    
    # 等待进程结束
    wait $ROUTER_PID
fi