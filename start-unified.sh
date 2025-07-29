#!/bin/bash

# Claude Code Router 统一启动脚本
# 支持开发和生产环境配置
# Owner: Jason Zhang

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认配置
DEFAULT_ENV="dev"
DEFAULT_PORT=3456
DEFAULT_HOST="0.0.0.0"
DEFAULT_CONFIG=""
DEBUG_MODE=false
AUTOSTART=false

# 函数：显示帮助信息
show_help() {
    echo -e "${BLUE}Claude Code Router 统一启动脚本${NC}"
    echo "使用方法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -e, --env <环境>          选择环境配置 (dev|prod|release) [默认: dev]"
    echo "  -p, --port <端口>         指定服务器端口"
    echo "  -h, --host <主机>         指定服务器主机地址 [默认: 0.0.0.0]"
    echo "  -c, --config <配置文件>   指定配置文件路径"
    echo "  -d, --debug              启用调试模式"
    echo "  -a, --autostart          启用开机自启动"
    echo "      --stop               停止所有RCC服务器"
    echo "      --status             检查服务器状态"
    echo "      --help               显示此帮助信息"
    echo ""
    echo "环境说明:"
    echo "  dev     - 开发环境 (端口3456, config.json)"
    echo "  prod    - 生产环境 (端口3457, config.json)"  
    echo "  release - 发布环境 (端口8888, config.release.json)"
    echo ""
    echo "示例:"
    echo "  $0                       # 启动开发环境"
    echo "  $0 -e prod               # 启动生产环境"
    echo "  $0 -e release -d         # 启动发布环境并开启调试"
    echo "  $0 -e dev -a             # 启动开发环境并配置开机自启动"
    echo "  $0 --stop                # 停止所有服务"
    echo "  $0 --status              # 检查服务状态"
}

# 函数：检查RCC是否安装
check_rcc() {
    if ! command -v rcc &> /dev/null; then
        echo -e "${RED}❌ 错误: rcc 命令未找到${NC}"
        echo -e "${YELLOW}请先运行 npm install -g rcc-*.tgz 进行安装${NC}"
        exit 1
    fi
}

# 函数：停止所有RCC服务
stop_all_services() {
    echo -e "${BLUE}🛑 停止所有RCC服务...${NC}"
    
    # 查找并停止所有RCC进程
    local pids=$(ps aux | grep -E "(rcc|route-claude)" | grep -v grep | awk '{print $2}')
    
    if [ -z "$pids" ]; then
        echo -e "${YELLOW}⚠️  没有找到运行中的RCC服务${NC}"
        return 0
    fi
    
    echo "找到以下进程:"
    ps aux | grep -E "(rcc|route-claude)" | grep -v grep
    
    echo -e "${BLUE}📤 发送停止信号...${NC}"
    for pid in $pids; do
        echo "停止进程 $pid"
        kill -TERM "$pid" 2>/dev/null || true
    done
    
    # 等待进程优雅退出
    sleep 2
    
    # 检查是否还有进程运行
    local remaining=$(ps aux | grep -E "(rcc|route-claude)" | grep -v grep | awk '{print $2}')
    if [ ! -z "$remaining" ]; then
        echo -e "${YELLOW}⚠️  强制停止剩余进程...${NC}"
        for pid in $remaining; do
            kill -KILL "$pid" 2>/dev/null || true
        done
    fi
    
    echo -e "${GREEN}✅ 所有RCC服务已停止${NC}"
}

# 函数：检查服务状态
check_status() {
    echo -e "${BLUE}📊 检查RCC服务状态...${NC}"
    
    local pids=$(ps aux | grep -E "(rcc|route-claude)" | grep -v grep)
    
    if [ -z "$pids" ]; then
        echo -e "${YELLOW}⚠️  没有运行中的RCC服务${NC}"
        return 0
    fi
    
    echo -e "${GREEN}✅ 运行中的RCC服务:${NC}"
    echo "$pids"
    
    # 尝试检查各端口的健康状态
    for port in 3456 3457 8888; do
        echo -e "\n${BLUE}检查端口 $port:${NC}"
        if curl -s --connect-timeout 2 "http://localhost:$port/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ 端口 $port 服务正常${NC}"
        else
            echo -e "${YELLOW}⚠️  端口 $port 无响应${NC}"
        fi
    done
}

# 函数：获取环境配置
get_env_config() {
    local env=$1
    case $env in
        "dev")
            DEFAULT_PORT=3456
            DEFAULT_CONFIG="$HOME/.route-claude-code/config.json"
            ;;
        "prod")
            DEFAULT_PORT=3457
            DEFAULT_CONFIG="$HOME/.route-claude-code/config.json"
            ;;
        "release")
            DEFAULT_PORT=8888
            DEFAULT_CONFIG="$HOME/.route-claude-code/config.release.json"
            ;;
        *)
            echo -e "${RED}❌ 错误: 不支持的环境 '$env'${NC}"
            echo -e "${YELLOW}支持的环境: dev, prod, release${NC}"
            exit 1
            ;;
    esac
}

# 函数：启动服务器
start_server() {
    local env=$1
    local port=$2
    local host=$3
    local config=$4
    local debug=$5
    local autostart=$6
    
    echo -e "${BLUE}🚀 启动Claude Code Router...${NC}"
    echo -e "${BLUE}环境: $env${NC}"
    echo -e "${BLUE}端口: $port${NC}"
    echo -e "${BLUE}主机: $host${NC}"
    echo -e "${BLUE}配置: $config${NC}"
    
    # 检查配置文件是否存在
    if [ ! -f "$config" ]; then
        echo -e "${RED}❌ 错误: 配置文件不存在: $config${NC}"
        exit 1
    fi
    
    # 构建启动命令
    local cmd="rcc start --config \"$config\" --port $port --host $host"
    
    if [ "$debug" = true ]; then
        cmd="$cmd --debug"
        echo -e "${BLUE}📝 调试模式已启用${NC}"
    fi
    
    if [ "$autostart" = true ]; then
        cmd="$cmd --autostart"
        echo -e "${BLUE}🔧 开机自启动已启用${NC}"
    fi
    
    echo -e "${BLUE}📤 执行命令: $cmd${NC}"
    echo ""
    
    # 启动服务器
    eval $cmd
}

# 解析命令行参数
ENV=$DEFAULT_ENV
PORT=""
HOST=$DEFAULT_HOST
CONFIG=""
STOP_SERVICES=false
CHECK_STATUS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENV="$2"
            shift 2
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -h|--host)
            HOST="$2"
            shift 2
            ;;
        -c|--config)
            CONFIG="$2"
            shift 2
            ;;
        -d|--debug)
            DEBUG_MODE=true
            shift
            ;;
        -a|--autostart)
            AUTOSTART=true
            shift
            ;;
        --stop)
            STOP_SERVICES=true
            shift
            ;;
        --status)
            CHECK_STATUS=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}❌ 错误: 未知选项 '$1'${NC}"
            show_help
            exit 1
            ;;
    esac
done

# 检查RCC安装
check_rcc

# 处理特殊操作
if [ "$STOP_SERVICES" = true ]; then
    stop_all_services
    exit 0
fi

if [ "$CHECK_STATUS" = true ]; then
    check_status
    exit 0
fi

# 获取环境配置
get_env_config "$ENV"

# 使用命令行参数覆盖默认值
if [ -n "$PORT" ]; then
    DEFAULT_PORT=$PORT
fi

if [ -n "$CONFIG" ]; then
    DEFAULT_CONFIG=$CONFIG
fi

# 启动前先停止已有服务(可选)
echo -e "${YELLOW}⚠️  检查已有服务...${NC}"
existing_pids=$(ps aux | grep -E "(rcc|route-claude)" | grep -v grep | awk '{print $2}')
if [ ! -z "$existing_pids" ]; then
    echo -e "${YELLOW}发现已有RCC服务运行，是否停止？ (y/N)${NC}"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        stop_all_services
        sleep 1
    fi
fi

# 启动服务器
start_server "$ENV" "$DEFAULT_PORT" "$HOST" "$DEFAULT_CONFIG" "$DEBUG_MODE" "$AUTOSTART"