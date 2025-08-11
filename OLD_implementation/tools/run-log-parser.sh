#!/bin/bash

# Claude Code Router - Log Parser Runner Script
# 
# 快速运行日志解析数据库工具的启动脚本
# 
# 使用方法:
#   ./tools/run-log-parser.sh [log_pattern]
#   ./tools/run-log-parser.sh ccr-session-*.log
#
# @author Jason Zhang
# @version 1.0.0
# @created 2025-08-07

set -e  # 遇到错误立即退出

# 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 颜色输出
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

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示帮助信息
show_help() {
    cat << EOF
🔧 Claude Code Router - Log Parser Runner

用法: $0 [OPTIONS] [LOG_PATTERN]

选项:
  -h, --help     显示此帮助信息
  -v, --verbose  详细输出模式
  -d, --debug    调试模式
  -c, --clean    清理旧数据后运行

参数:
  LOG_PATTERN    日志文件匹配模式 (默认: ccr-*.log)

示例:
  $0                           # 处理所有 ccr-*.log 文件
  $0 ccr-session-*.log         # 处理特定会话日志
  $0 --clean ccr-*.log         # 清理后处理所有日志
  $0 --verbose --debug         # 详细调试模式

数据输出位置:
  ~/.route-claude-code/providers/
EOF
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖环境..."
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装或不在 PATH 中"
        exit 1
    fi
    
    # 检查工具文件
    if [[ ! -f "${SCRIPT_DIR}/log-parser/log-parser-database.js" ]]; then
        log_error "日志解析工具未找到: ${SCRIPT_DIR}/log-parser/log-parser-database.js"
        exit 1
    fi
    
    # 检查配置文件
    if [[ ! -f "${SCRIPT_DIR}/config.json" ]]; then
        log_error "配置文件未找到: ${SCRIPT_DIR}/config.json"
        exit 1
    fi
    
    log_success "依赖检查通过"
}

# 清理旧数据
clean_old_data() {
    local providers_dir="$HOME/.route-claude-code/providers"
    
    if [[ -d "$providers_dir" ]]; then
        log_warn "清理旧的Provider数据..."
        
        # 备份现有数据
        local backup_dir="$HOME/.route-claude-code/providers-backup-$(date +%Y%m%d-%H%M%S)"
        log_info "备份现有数据到: $backup_dir"
        cp -r "$providers_dir" "$backup_dir"
        
        # 清理目录
        rm -rf "$providers_dir"
        log_success "旧数据已清理并备份"
    fi
}

# 检查日志文件
check_log_files() {
    local log_pattern="$1"
    local logs_dir="$HOME/.route-claude-code/logs"
    
    log_info "检查日志文件: $logs_dir/$log_pattern"
    
    if [[ ! -d "$logs_dir" ]]; then
        log_error "日志目录不存在: $logs_dir"
        log_info "请确保 Claude Code Router 服务已运行并生成了日志"
        exit 1
    fi
    
    # 检查匹配的日志文件
    local log_files=($(ls "$logs_dir"/$log_pattern 2>/dev/null || true))
    
    if [[ ${#log_files[@]} -eq 0 ]]; then
        log_error "未找到匹配的日志文件: $logs_dir/$log_pattern"
        log_info "可用的日志文件:"
        ls -la "$logs_dir"/ | grep -E "\\.log$" || log_warn "  没有 .log 文件"
        exit 1
    fi
    
    log_success "找到 ${#log_files[@]} 个日志文件待处理"
    for file in "${log_files[@]}"; do
        log_info "  - $(basename "$file")"
    done
}

# 运行日志解析器
run_log_parser() {
    local log_pattern="$1"
    local verbose_flag="$2"
    local debug_flag="$3"
    
    log_info "启动日志解析器..."
    log_info "工作目录: $PROJECT_ROOT"
    log_info "工具路径: ${SCRIPT_DIR}/log-parser/log-parser-database.js"
    log_info "日志模式: $log_pattern"
    
    # 构建命令
    local cmd="node ${SCRIPT_DIR}/log-parser/log-parser-database.js"
    
    # 添加参数
    if [[ -n "$log_pattern" ]]; then
        cmd="$cmd $log_pattern"
    fi
    
    # 设置环境变量
    if [[ "$verbose_flag" == "true" ]]; then
        export LOG_LEVEL="info"
    fi
    
    if [[ "$debug_flag" == "true" ]]; then
        export LOG_LEVEL="debug"
        export NODE_ENV="development"
    fi
    
    # 执行命令
    log_info "执行命令: $cmd"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if eval "$cmd"; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        log_success "日志解析完成!"
        show_results
    else
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        log_error "日志解析失败"
        exit 1
    fi
}

# 显示结果
show_results() {
    local providers_dir="$HOME/.route-claude-code/providers"
    
    if [[ ! -d "$providers_dir" ]]; then
        log_warn "Provider数据目录未创建"
        return
    fi
    
    log_success "📊 解析结果概览:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    for provider_dir in "$providers_dir"/*/; do
        if [[ -d "$provider_dir" ]]; then
            local provider=$(basename "$provider_dir")
            log_info "🔹 Provider: $provider"
            
            for category_dir in "$provider_dir"/*/; do
                if [[ -d "$category_dir" ]]; then
                    local category=$(basename "$category_dir")
                    local file_count=$(ls -1 "$category_dir"/*.json 2>/dev/null | wc -l || echo "0")
                    printf "   %-15s: %3d files\n" "$category" "$file_count"
                fi
            done
        fi
    done
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info "📁 数据存储位置: $providers_dir"
    log_info "📖 查看各Provider的README.md获取详细信息"
    echo ""
    log_success "🎯 下一步: 运行时序图生成器"
    log_info "   ./tools/run-timeline-visualizer.sh"
}

# 主函数
main() {
    local log_pattern="ccr-*.log"
    local clean_flag="false"
    local verbose_flag="false"
    local debug_flag="false"
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -c|--clean)
                clean_flag="true"
                shift
                ;;
            -v|--verbose)
                verbose_flag="true"
                shift
                ;;
            -d|--debug)
                debug_flag="true"
                verbose_flag="true"  # debug 模式隐含 verbose
                shift
                ;;
            -*)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
            *)
                log_pattern="$1"
                shift
                ;;
        esac
    done
    
    # 显示开始信息
    echo ""
    log_info "🚀 Claude Code Router - Log Parser Database"
    log_info "================================================"
    log_info "日志模式: $log_pattern"
    log_info "清理模式: $clean_flag"
    log_info "详细输出: $verbose_flag"
    log_info "调试模式: $debug_flag"
    echo ""
    
    # 执行步骤
    check_dependencies
    
    if [[ "$clean_flag" == "true" ]]; then
        clean_old_data
    fi
    
    check_log_files "$log_pattern"
    run_log_parser "$log_pattern" "$verbose_flag" "$debug_flag"
}

# 运行主函数
main "$@"