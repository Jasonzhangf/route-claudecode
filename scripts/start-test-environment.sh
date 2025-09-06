#!/bin/bash

# RCC v4.0 测试环境启动脚本
# 用于启动完整的测试环境，包括RCC v4.0和Claude Code Router

set -e  # 遇到错误时退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        log_error "$1 is not installed. Please install it first."
        exit 1
    fi
}

# 检查Node.js和npm版本
check_node_version() {
    log "检查Node.js和npm版本..."
    
    local required_node_version="18.0.0"
    local required_npm_version="8.0.0"
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js未安装"
        exit 1
    fi
    
    local node_version=$(node --version | sed 's/v//')
    local npm_version=$(npm --version)
    
    log "Node.js版本: $node_version"
    log "npm版本: $npm_version"
}

# 检查端口是否被占用
check_port() {
    local port=$1
    local service=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warning "端口 $port 已被占用，正在停止现有服务..."
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# 构建项目
build_project() {
    log "构建项目..."
    
    # 检查是否存在build-and-install.sh脚本
    if [ ! -f "./build-and-install.sh" ]; then
        log_error "build-and-install.sh未找到"
        exit 1
    fi
    
    # 执行构建脚本
    if ! ./build-and-install.sh; then
        log_error "项目构建失败"
        exit 1
    fi
    
    log_success "项目构建成功"
}

# 启动RCC v4.0服务
start_rcc4() {
    local port=${1:-5511}
    local config_file=${2:-"./config/test-config.json"}
    
    log "启动RCC v4.0服务 (端口: $port)..."
    
    # 检查端口
    check_port $port "RCC v4.0"
    
    # 创建日志目录
    mkdir -p ./test-debug-logs/port-$port
    
    # 启动服务
    local rcc4_cmd="npx ts-node src/index.ts --port $port"
    
    if [ -f "$config_file" ]; then
        rcc4_cmd="$rcc4_cmd --config $config_file"
    fi
    
    # 在后台启动服务
    $rcc4_cmd > ./test-debug-logs/port-$port/server.log 2>&1 &
    local rcc4_pid=$!
    
    # 等待服务启动
    local retry_count=0
    local max_retries=30
    
    while [ $retry_count -lt $max_retries ]; do
        if curl -s http://localhost:$port/health >/dev/null 2>/dev/null; then
            log_success "RCC v4.0服务启动成功 (PID: $rcc4_pid)"
            echo $rcc4_pid > ./test-debug-logs/port-$port/rcc4.pid
            return 0
        fi
        
        sleep 1
        retry_count=$((retry_count + 1))
    done
    
    log_error "RCC v4.0服务启动超时"
    kill $rcc4_pid 2>/dev/null || true
    exit 1
}

# 启动Claude Code Router服务
start_ccr() {
    local port=${1:-5510}
    
    log "启动Claude Code Router服务 (端口: $port)..."
    
    # 检查端口
    check_port $port "Claude Code Router"
    
    # 创建日志目录
    mkdir -p ./test-debug-logs/port-$port
    
    # 进入Claude Code Router目录并启动服务
    local ccr_dir="../claude-code-router"
    if [ ! -d "$ccr_dir" ]; then
        log_error "Claude Code Router目录未找到: $ccr_dir"
        exit 1
    fi
    
    # 在后台启动服务
    (cd $ccr_dir && npm start -- --port $port) > ./test-debug-logs/port-$port/ccr.log 2>&1 &
    local ccr_pid=$!
    
    # 等待服务启动
    local retry_count=0
    local max_retries=30
    
    while [ $retry_count -lt $max_retries ]; do
        if curl -s http://localhost:$port/health >/dev/null 2>/dev/null; then
            log_success "Claude Code Router服务启动成功 (PID: $ccr_pid)"
            echo $ccr_pid > ./test-debug-logs/port-$port/ccr.pid
            return 0
        fi
        
        sleep 1
        retry_count=$((retry_count + 1))
    done
    
    log_error "Claude Code Router服务启动超时"
    kill $ccr_pid 2>/dev/null || true
    exit 1
}

# 创建必要的目录
create_directories() {
    log "创建必要目录..."
    mkdir -p ./test-debug-logs ./test-results ./test-capture-data
}

# 验证服务状态
verify_services() {
    log "验证服务状态..."
    
    # 检查RCC v4.0
    if curl -s http://localhost:5511/health >/dev/null; then
        log_success "RCC v4.0服务运行正常"
    else
        log_error "RCC v4.0服务未响应"
        exit 1
    fi
    
    # 检查Claude Code Router
    if curl -s http://localhost:5510/health >/dev/null; then
        log_success "Claude Code Router服务运行正常"
    else
        log_error "Claude Code Router服务未响应"
        exit 1
    fi
}

# 显示使用信息
show_usage() {
    echo "使用方法: $0 [选项]"
    echo "选项:"
    echo "  --help, -h    显示此帮助信息"
    echo "  --port-rcc4   指定RCC v4.0端口 (默认: 5511)"
    echo "  --port-ccr    指定Claude Code Router端口 (默认: 5510)"
    echo ""
    echo "示例:"
    echo "  $0"
    echo "  $0 --port-rcc4 5511 --port-ccr 5510"
}

# 主函数
main() {
    log "========================================="
    log "RCC v4.0 测试环境启动脚本"
    log "========================================="
    
    # 解析命令行参数
    local rcc4_port=5511
    local ccr_port=5510
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_usage
                exit 0
                ;;
            --port-rcc4)
                rcc4_port="$2"
                shift 2
                ;;
            --port-ccr)
                ccr_port="$2"
                shift 2
                ;;
            *)
                log_error "未知参数: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # 检查必要命令
    check_command "node"
    check_command "npm"
    check_command "curl"
    check_command "lsof"
    
    # 检查版本
    check_node_version
    
    # 创建必要目录
    create_directories
    
    # 构建项目
    build_project
    
    # 启动服务
    start_rcc4 $rcc4_port
    start_ccr $ccr_port
    
    # 验证服务
    verify_services
    
    log_success "测试环境启动完成！"
    log "RCC v4.0 API: http://localhost:$rcc4_port"
    log "Claude Code Router API: http://localhost:$ccr_port"
    log "调试日志目录: ./test-debug-logs/"
    log "测试结果目录: ./test-results/"
    log ""
    log "使用 Ctrl+C 停止所有服务"
    
    # 等待用户中断
    trap 'log "正在停止服务..."; kill $(cat ./test-debug-logs/port-*/rcc4.pid ./test-debug-logs/port-*/ccr.pid 2>/dev/null) 2>/dev/null || true; exit 0' INT
    while true; do sleep 1; done
}

# 执行主函数
main "$@"