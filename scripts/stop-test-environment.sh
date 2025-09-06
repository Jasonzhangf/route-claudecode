#!/bin/bash

# RCC v4.0 测试环境停止脚本
# 用于停止测试环境中所有运行的服务

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

# 停止RCC v4.0服务
stop_rcc4() {
    log "停止RCC v4.0服务..."
    
    # 通过PID文件停止服务
    if [ -f "./test-debug-logs/port-5511/rcc4.pid" ]; then
        local rcc4_pid=$(cat "./test-debug-logs/port-5511/rcc4.pid")
        if kill -0 $rcc4_pid 2>/dev/null; then
            kill $rcc4_pid
            log_success "RCC v4.0服务已停止 (PID: $rcc4_pid)"
        else
            log_warning "RCC v4.0进程已不存在 (PID: $rcc4_pid)"
        fi
        rm -f "./test-debug-logs/port-5511/rcc4.pid"
    else
        # 通过端口查找并停止服务
        local rcc4_pids=$(lsof -ti :5511 2>/dev/null || true)
        if [ -n "$rcc4_pids" ]; then
            kill $rcc4_pids
            log_success "RCC v4.0服务已停止 (PIDs: $rcc4_pids)"
        else
            log_warning "未找到运行在端口5511的RCC v4.0服务"
        fi
    fi
}

# 停止Claude Code Router服务
stop_ccr() {
    log "停止Claude Code Router服务..."
    
    # 通过PID文件停止服务
    if [ -f "./test-debug-logs/port-5510/ccr.pid" ]; then
        local ccr_pid=$(cat "./test-debug-logs/port-5510/ccr.pid")
        if kill -0 $ccr_pid 2>/dev/null; then
            kill $ccr_pid
            log_success "Claude Code Router服务已停止 (PID: $ccr_pid)"
        else
            log_warning "Claude Code Router进程已不存在 (PID: $ccr_pid)"
        fi
        rm -f "./test-debug-logs/port-5510/ccr.pid"
    else
        # 通过端口查找并停止服务
        local ccr_pids=$(lsof -ti :5510 2>/dev/null || true)
        if [ -n "$ccr_pids" ]; then
            kill $ccr_pids
            log_success "Claude Code Router服务已停止 (PIDs: $ccr_pids)"
        else
            log_warning "未找到运行在端口5510的Claude Code Router服务"
        fi
    fi
}

# 清理测试数据
cleanup_test_data() {
    log "清理测试数据..."
    
    # 清理PID文件
    rm -f ./test-debug-logs/port-*/rcc4.pid ./test-debug-logs/port-*/ccr.pid 2>/dev/null || true
    
    # 清理临时文件
    rm -f ./test-debug-logs/port-*/server.log ./test-debug-logs/port-*/ccr.log 2>/dev/null || true
    
    log_success "测试数据清理完成"
}

# 显示使用信息
show_usage() {
    echo "使用方法: $0 [选项]"
    echo "选项:"
    echo "  --help, -h    显示此帮助信息"
    echo "  --no-cleanup  停止服务但不清理测试数据"
    echo ""
    echo "示例:"
    echo "  $0"
    echo "  $0 --no-cleanup"
}

# 主函数
main() {
    log "========================================="
    log "RCC v4.0 测试环境停止脚本"
    log "========================================="
    
    # 解析命令行参数
    local no_cleanup=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_usage
                exit 0
                ;;
            --no-cleanup)
                no_cleanup=true
                shift
                ;;
            *)
                log_error "未知参数: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # 停止服务
    stop_rcc4
    stop_ccr
    
    # 清理测试数据
    if [ "$no_cleanup" = false ]; then
        cleanup_test_data
    else
        log_warning "跳过测试数据清理"
    fi
    
    log_success "测试环境已停止！"
}

# 执行主函数
main "$@"