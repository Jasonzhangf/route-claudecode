#!/bin/bash

# CodeWhisperer 数据捕获系统演示运行器
# 
# 功能：
# 1. 启动 Claude Code Router 服务
# 2. 运行完整的数据捕获系统测试
# 3. 展示测试结果和分析报告
# 
# 作者: Jason Zhang
# 日期: 2025-01-30

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_requirements() {
    log_info "检查系统要求..."
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装，请先安装 Node.js"
        exit 1
    fi
    
    # 检查项目构建状态
    if [ ! -d "dist" ]; then
        log_warning "项目未构建，正在构建..."
        if ! ./build.sh; then
            log_error "项目构建失败"
            exit 1
        fi
    fi
    
    # 检查配置文件
    local config_file="$HOME/.route-claude-code/config.json"
    if [ ! -f "$config_file" ]; then
        log_warning "配置文件不存在: $config_file"
        log_info "将使用默认配置继续测试"
    fi
    
    log_success "系统要求检查完成"
}

# 启动服务
start_service() {
    log_info "启动 Claude Code Router 服务..."
    
    # 检查端口是否被占用
    if lsof -Pi :3456 -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warning "端口 3456 已被占用，正在停止现有服务..."
        pkill -f "claude-code-router" || true
        sleep 2
    fi
    
    # 启动服务（后台运行）
    log_info "在后台启动服务..."
    nohup node dist/cli.js start --port 3456 > /tmp/ccr-demo.log 2>&1 &
    local service_pid=$!
    
    # 等待服务启动
    log_info "等待服务启动..."
    local retry_count=0
    local max_retries=10
    
    while [ $retry_count -lt $max_retries ]; do
        if curl -s http://localhost:3456/health > /dev/null 2>&1; then
            log_success "服务启动成功 (PID: $service_pid)"
            echo $service_pid > /tmp/ccr-demo.pid
            return 0
        fi
        
        sleep 1
        retry_count=$((retry_count + 1))
        echo -n "."
    done
    
    echo ""
    log_error "服务启动失败或超时"
    log_info "查看日志: tail -f /tmp/ccr-demo.log"
    exit 1
}

# 运行数据捕获测试
run_data_capture_test() {
    log_info "运行完整数据捕获系统测试..."
    
    # 创建输出目录
    mkdir -p /tmp/data-capture-demo
    
    # 运行测试
    if node test/functional/test-complete-data-capture-system.js; then
        log_success "数据捕获系统测试完成"
        return 0
    else
        log_error "数据捕获系统测试失败"
        return 1
    fi
}

# 展示结果
show_results() {
    log_info "展示测试结果..."
    
    # 查找最新的测试报告
    local report_dir="/tmp/complete-system-test"
    if [ -d "$report_dir" ]; then
        local latest_report=$(find "$report_dir" -name "comprehensive-test-report-*.json" -type f -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)
        
        if [ -n "$latest_report" ] && [ -f "$latest_report" ]; then
            log_success "找到测试报告: $latest_report"
            
            # 提取关键指标
            local total_requests=$(jq -r '.totalRequests' "$latest_report" 2>/dev/null || echo "N/A")
            local capture_success=$(jq -r '.successfulCaptures' "$latest_report" 2>/dev/null || echo "N/A")
            local comparison_success=$(jq -r '.successfulComparisons' "$latest_report" 2>/dev/null || echo "N/A")
            local correction_success=$(jq -r '.successfulCorrections' "$latest_report" 2>/dev/null || echo "N/A")
            local reliability_score=$(jq -r '.qualityMetrics.systemReliabilityScore' "$latest_report" 2>/dev/null || echo "N/A")
            
            echo ""
            echo "=========================================="
            echo "📊 测试结果摘要"
            echo "=========================================="
            echo "总请求数: $total_requests"
            echo "数据捕获成功: $capture_success"
            echo "对比分析成功: $comparison_success"
            echo "修正处理成功: $correction_success"
            echo "系统可靠性评分: ${reliability_score}/100"
            echo ""
            echo "详细报告: $latest_report"
            echo "=========================================="
        else
            log_warning "未找到测试报告文件"
        fi
    else
        log_warning "测试输出目录不存在: $report_dir"
    fi
    
    # 显示日志位置
    local log_file="/tmp/test-complete-data-capture-system.log"
    if [ -f "$log_file" ]; then
        log_info "测试日志: $log_file"
        
        # 显示最后几行日志
        echo ""
        echo "最近的日志条目:"
        echo "------------------------------------------"
        tail -5 "$log_file" 2>/dev/null || echo "无法读取日志文件"
        echo "------------------------------------------"
    fi
}

# 清理资源
cleanup() {
    log_info "清理资源..."
    
    # 停止服务
    if [ -f /tmp/ccr-demo.pid ]; then
        local pid=$(cat /tmp/ccr-demo.pid)
        if ps -p $pid > /dev/null 2>&1; then
            log_info "停止服务 (PID: $pid)..."
            kill $pid 2>/dev/null || true
            sleep 2
            
            # 强制杀死如果还在运行
            if ps -p $pid > /dev/null 2>&1; then
                kill -9 $pid 2>/dev/null || true
            fi
        fi
        rm -f /tmp/ccr-demo.pid
    fi
    
    # 清理临时文件（可选）
    if [ "$1" = "--clean-temp" ]; then
        log_info "清理临时文件..."
        rm -rf /tmp/complete-system-test
        rm -f /tmp/test-complete-data-capture-system.log
        rm -f /tmp/ccr-demo.log
    fi
    
    log_success "资源清理完成"
}

# 信号处理
trap cleanup EXIT
trap 'log_warning "收到中断信号，正在清理..."; cleanup; exit 130' INT

# 显示帮助
show_help() {
    echo "CodeWhisperer 数据捕获系统演示运行器"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --help          显示此帮助信息"
    echo "  --clean-temp    运行后清理临时文件"
    echo "  --skip-service  跳过服务启动（假设服务已运行）"
    echo "  --quick         快速模式（缩短测试时间）"
    echo ""
    echo "示例:"
    echo "  $0                    # 标准运行"
    echo "  $0 --clean-temp       # 运行后清理临时文件"
    echo "  $0 --skip-service     # 跳过服务启动"
    echo "  $0 --quick            # 快速测试模式"
}

# 主函数
main() {
    local skip_service=false
    local clean_temp=false
    local quick_mode=false
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help)
                show_help
                exit 0
                ;;
            --clean-temp)
                clean_temp=true
                shift
                ;;
            --skip-service)
                skip_service=true
                shift
                ;;
            --quick)
                quick_mode=true
                shift
                ;;
            *)
                log_error "未知参数: $1"
                echo "使用 --help 查看帮助信息"
                exit 1
                ;;
        esac
    done
    
    echo ""
    echo "🚀 CodeWhisperer 数据捕获系统演示"
    echo "======================================"
    echo ""
    
    # 设置快速模式环境变量
    if [ "$quick_mode" = true ]; then
        export TEST_DURATION=10000  # 10秒
        export TEST_INTERVAL=2000   # 2秒间隔
        log_info "启用快速模式（10秒测试）"
    fi
    
    # 检查要求
    check_requirements
    
    # 启动服务（如果需要）
    if [ "$skip_service" = false ]; then
        start_service
    else
        log_info "跳过服务启动，假设服务已运行在端口 3456"
        
        # 验证服务是否可用
        if ! curl -s http://localhost:3456/health > /dev/null 2>&1; then
            log_error "服务不可用，请先启动服务或移除 --skip-service 参数"
            exit 1
        fi
        log_success "确认服务可用"
    fi
    
    # 运行测试
    if run_data_capture_test; then
        show_results
        log_success "演示完成！"
        
        if [ "$clean_temp" = true ]; then
            cleanup --clean-temp
        fi
        
        exit 0
    else
        log_error "演示失败"
        exit 1
    fi
}

# 检查是否在项目根目录
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    log_error "请在项目根目录运行此脚本"
    exit 1
fi

# 运行主函数
main "$@"