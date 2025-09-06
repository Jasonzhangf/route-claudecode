#!/bin/bash

# RCC v4.0 测试环境管理脚本
# 用于管理测试环境的启动、停止和状态检查

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

# 检查服务状态
check_service_status() {
    local port=$1
    local service_name=$2
    
    if curl -s http://localhost:$port/health >/dev/null 2>/dev/null; then
        log_success "$service_name 服务运行中"
        return 0
    else
        log_warning "$service_name 服务未运行"
        return 1
    fi
}

# 显示当前状态
show_status() {
    log "检查测试环境状态..."
    
    echo "========================================="
    echo "RCC v4.0 测试环境状态"
    echo "========================================="
    
    # 检查RCC v4.0
    if check_service_status 5511 "RCC v4.0"; then
        echo "  端口: 5511"
        echo "  状态: $(curl -s http://localhost:5511/health 2>/dev/null || echo '未知')"
        echo ""
    fi
    
    # 检查Claude Code Router
    if check_service_status 5510 "Claude Code Router"; then
        echo "  端口: 5510"
        echo "  状态: $(curl -s http://localhost:5510/health 2>/dev/null || echo '未知')"
        echo ""
    fi
    
    # 检查数据捕获状态
    if check_service_status 5511 "RCC v4.0"; then
        local capture_status=$(curl -s http://localhost:5511/api/v1/test/capture/status 2>/dev/null | jq -r '.status' 2>/dev/null || echo "unknown")
        echo "  数据捕获状态: $capture_status"
    fi
    
    echo "========================================="
}

# 启动测试环境
start_environment() {
    log "启动测试环境..."
    
    # 检查是否已经在运行
    if check_service_status 5511 "RCC v4.0" && check_service_status 5510 "Claude Code Router"; then
        log_warning "测试环境已在运行"
        return 0
    fi
    
    # 执行启动脚本
    if [ -f "./scripts/start-test-environment.sh" ]; then
        ./scripts/start-test-environment.sh
    else
        log_error "启动脚本未找到: ./scripts/start-test-environment.sh"
        exit 1
    fi
}

# 停止测试环境
stop_environment() {
    log "停止测试环境..."
    
    # 执行停止脚本
    if [ -f "./scripts/stop-test-environment.sh" ]; then
        ./scripts/stop-test-environment.sh
    else
        log_error "停止脚本未找到: ./scripts/stop-test-environment.sh"
        exit 1
    fi
}

# 运行测试套件
run_tests() {
    log "运行测试套件..."
    
    # 检查环境是否运行
    if ! check_service_status 5511 "RCC v4.0" || ! check_service_status 5510 "Claude Code Router"; then
        log_error "测试环境未运行，请先启动环境"
        exit 1
    fi
    
    # 执行测试脚本
    if [ -f "./scripts/run-test-suite.sh" ]; then
        ./scripts/run-test-suite.sh
    else
        log_error "测试脚本未找到: ./scripts/run-test-suite.sh"
        exit 1
    fi
}

# 执行自动修复
run_auto_fix() {
    log "执行自动修复..."
    
    # 检查环境是否运行
    if ! check_service_status 5511 "RCC v4.0"; then
        log_error "RCC v4.0服务未运行"
        exit 1
    fi
    
    # 执行修复脚本
    if [ -f "./scripts/auto-fix.sh" ]; then
        ./scripts/auto-fix.sh
    else
        log_error "修复脚本未找到: ./scripts/auto-fix.sh"
        exit 1
    fi
}

# 显示使用信息
show_usage() {
    echo "使用方法: $0 [命令]"
    echo "命令:"
    echo "  start         启动测试环境"
    echo "  stop          停止测试环境"
    echo "  status        显示环境状态"
    echo "  test          运行测试套件"
    echo "  fix           执行自动修复"
    echo "  help          显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 start"
    echo "  $0 status"
    echo "  $0 test"
}

# 主函数
main() {
    # 解析命令行参数
    if [ $# -eq 0 ]; then
        show_usage
        exit 1
    fi
    
    case $1 in
        start)
            start_environment
            ;;
        stop)
            stop_environment
            ;;
        status)
            show_status
            ;;
        test)
            run_tests
            ;;
        fix)
            run_auto_fix
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            log_error "未知命令: $1"
            show_usage
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"