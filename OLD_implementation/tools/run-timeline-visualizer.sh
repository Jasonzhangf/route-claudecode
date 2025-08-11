#!/bin/bash

# Claude Code Router - Timeline Visualizer Runner Script
# 
# 快速运行时序图生成工具的启动脚本
# 
# 使用方法:
#   ./tools/run-timeline-visualizer.sh [log_pattern] [output_file]
#   ./tools/run-timeline-visualizer.sh ccr-session-*.log timeline-report.html
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
PURPLE='\033[0;35m'
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

log_highlight() {
    echo -e "${PURPLE}[HIGHLIGHT]${NC} $1"
}

# 显示帮助信息
show_help() {
    cat << EOF
🕒 Claude Code Router - Timeline Visualizer Runner

用法: $0 [OPTIONS] [LOG_PATTERN] [OUTPUT_FILE]

选项:
  -h, --help     显示此帮助信息
  -v, --verbose  详细输出模式
  -d, --debug    调试模式
  -o, --open     生成后自动打开HTML文件
  -p, --preview  生成前预览将处理的日志文件

参数:
  LOG_PATTERN    日志文件匹配模式 (默认: ccr-*.log)
  OUTPUT_FILE    输出HTML文件名 (默认: timeline.html)

示例:
  $0                                    # 基础用法
  $0 --open ccr-session-*.log          # 生成后自动打开
  $0 --preview                         # 预览模式
  $0 ccr-*.log custom-timeline.html    # 自定义输出文件
  $0 --verbose --debug --open          # 完整调试模式

输出位置:
  当前目录/[OUTPUT_FILE]
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
    if [[ ! -f "${SCRIPT_DIR}/visualization/timeline-visualizer.js" ]]; then
        log_error "时序图生成工具未找到: ${SCRIPT_DIR}/visualization/timeline-visualizer.js"
        exit 1
    fi
    
    # 检查配置文件
    if [[ ! -f "${SCRIPT_DIR}/config.json" ]]; then
        log_error "配置文件未找到: ${SCRIPT_DIR}/config.json"
        exit 1
    fi
    
    log_success "依赖检查通过"
}

# 检查和预览日志文件
check_and_preview_logs() {
    local log_pattern="$1"
    local preview_flag="$2"
    local logs_dir="$HOME/.route-claude-code/logs"
    
    log_info "检查日志文件: $logs_dir/$log_pattern"
    
    if [[ ! -d "$logs_dir" ]]; then
        log_error "日志目录不存在: $logs_dir"
        log_info "请确保 Claude Code Router 服务已运行并生成了日志"
        exit 1
    fi
    
    # 获取匹配的日志文件
    local log_files=($(ls "$logs_dir"/$log_pattern 2>/dev/null || true))
    
    if [[ ${#log_files[@]} -eq 0 ]]; then
        log_error "未找到匹配的日志文件: $logs_dir/$log_pattern"
        log_info "可用的日志文件:"
        ls -la "$logs_dir"/ | grep -E "\\.log$" || log_warn "  没有 .log 文件"
        exit 1
    fi
    
    log_success "找到 ${#log_files[@]} 个日志文件待处理"
    
    # 预览模式
    if [[ "$preview_flag" == "true" ]]; then
        echo ""
        log_highlight "📋 日志文件预览:"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        local total_size=0
        for file in "${log_files[@]}"; do
            local file_size=$(stat -f%z "$file" 2>/dev/null || echo "0")
            local file_time=$(stat -f%Sm -t%Y-%m-%d\ %H:%M "$file" 2>/dev/null || echo "Unknown")
            local readable_size=$(numfmt --to=iec --suffix=B "$file_size" 2>/dev/null || echo "${file_size}B")
            
            printf "  %-40s %10s  %s\n" "$(basename "$file")" "$readable_size" "$file_time"
            total_size=$((total_size + file_size))
        done
        
        local total_readable=$(numfmt --to=iec --suffix=B "$total_size" 2>/dev/null || echo "${total_size}B")
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        printf "  %-40s %10s\n" "总计 ${#log_files[@]} 个文件" "$total_readable"
        echo ""
        
        # 预览第一个文件的内容结构
        log_info "📄 预览文件结构 (${log_files[0]##*/}):"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        head -5 "${log_files[0]}" | while IFS= read -r line; do
            echo "  $line"
        done
        echo "  ..."
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        read -p "是否继续生成时序图? [Y/n]: " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Nn]$ ]]; then
            log_info "用户取消操作"
            exit 0
        fi
    else
        for file in "${log_files[@]}"; do
            log_info "  - $(basename "$file")"
        done
    fi
}

# 运行时序图生成器
run_timeline_generator() {
    local log_pattern="$1"
    local output_file="$2"
    local verbose_flag="$3"
    local debug_flag="$4"
    
    log_info "启动时序图生成器..."
    log_info "工作目录: $PROJECT_ROOT"
    log_info "工具路径: ${SCRIPT_DIR}/visualization/timeline-visualizer.js"
    log_info "日志模式: $log_pattern"
    log_info "输出文件: $output_file"
    
    # 构建命令
    local cmd="node ${SCRIPT_DIR}/visualization/timeline-visualizer.js"
    
    # 添加参数
    if [[ -n "$log_pattern" ]]; then
        cmd="$cmd \"$log_pattern\""
    fi
    
    if [[ -n "$output_file" ]]; then
        cmd="$cmd \"$output_file\""
    fi
    
    # 设置环境变量
    if [[ "$verbose_flag" == "true" ]]; then
        export LOG_LEVEL="info"
    fi
    
    if [[ "$debug_flag" == "true" ]]; then
        export LOG_LEVEL="debug"
        export NODE_ENV="development"
    fi
    
    # 显示开始时间
    local start_time=$(date +%s)
    
    # 执行命令
    log_info "执行命令: $cmd"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if eval "$cmd"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        log_success "时序图生成完成! (耗时: ${duration}秒)"
        show_results "$output_file"
        return 0
    else
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        log_error "时序图生成失败"
        return 1
    fi
}

# 显示结果并可选打开文件
show_results() {
    local output_file="$1"
    local full_path="$(pwd)/$output_file"
    
    if [[ ! -f "$output_file" ]]; then
        log_error "输出文件未生成: $output_file"
        return 1
    fi
    
    # 获取文件信息
    local file_size=$(stat -f%z "$output_file" 2>/dev/null || echo "0")
    local readable_size=$(numfmt --to=iec --suffix=B "$file_size" 2>/dev/null || echo "${file_size}B")
    local file_time=$(stat -f%Sm -t%Y-%m-%d\ %H:%M:%S "$output_file" 2>/dev/null || echo "Unknown")
    
    echo ""
    log_success "🎯 时序图生成完成!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info "📁 文件位置: $full_path"
    log_info "📊 文件大小: $readable_size"
    log_info "🕒 生成时间: $file_time"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    log_highlight "🌐 使用说明:"
    log_info "  1. 用浏览器打开: $output_file"
    log_info "  2. 使用过滤器筛选Provider和事件类型"
    log_info "  3. 点击时序点查看详细信息"
    log_info "  4. 调整时间范围滑块控制显示范围"
    echo ""
    
    # 检查是否有浏览器可用
    local browser_cmd=""
    if command -v open &> /dev/null; then
        browser_cmd="open"
    elif command -v xdg-open &> /dev/null; then
        browser_cmd="xdg-open"
    elif command -v firefox &> /dev/null; then
        browser_cmd="firefox"
    elif command -v chrome &> /dev/null; then
        browser_cmd="chrome"
    fi
    
    if [[ -n "$browser_cmd" ]]; then
        log_info "💡 快速打开命令: $browser_cmd $output_file"
    fi
}

# 打开HTML文件
open_html_file() {
    local output_file="$1"
    
    if [[ ! -f "$output_file" ]]; then
        log_error "输出文件不存在: $output_file"
        return 1
    fi
    
    log_info "尝试打开HTML文件..."
    
    # macOS
    if command -v open &> /dev/null; then
        open "$output_file"
        log_success "已在默认浏览器中打开"
        return 0
    fi
    
    # Linux
    if command -v xdg-open &> /dev/null; then
        xdg-open "$output_file"
        log_success "已在默认浏览器中打开"
        return 0
    fi
    
    # 尝试直接调用浏览器
    for browser in firefox chrome chromium safari; do
        if command -v $browser &> /dev/null; then
            $browser "$output_file" &
            log_success "已使用 $browser 打开"
            return 0
        fi
    done
    
    log_warn "无法自动打开浏览器，请手动打开: $output_file"
    return 1
}

# 主函数
main() {
    local log_pattern="ccr-*.log"
    local output_file="timeline.html"
    local verbose_flag="false"
    local debug_flag="false"
    local open_flag="false"
    local preview_flag="false"
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
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
            -o|--open)
                open_flag="true"
                shift
                ;;
            -p|--preview)
                preview_flag="true"
                shift
                ;;
            -*)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
            *)
                if [[ "$log_pattern" == "ccr-*.log" ]]; then
                    log_pattern="$1"
                elif [[ "$output_file" == "timeline.html" ]]; then
                    output_file="$1"
                else
                    log_error "过多参数: $1"
                    show_help
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # 显示开始信息
    echo ""
    log_info "🕒 Claude Code Router - Timeline Visualizer"
    log_info "=============================================="
    log_info "日志模式: $log_pattern"
    log_info "输出文件: $output_file"
    log_info "详细输出: $verbose_flag"
    log_info "调试模式: $debug_flag"
    log_info "自动打开: $open_flag"
    log_info "预览模式: $preview_flag"
    echo ""
    
    # 执行步骤
    check_dependencies
    check_and_preview_logs "$log_pattern" "$preview_flag"
    
    if run_timeline_generator "$log_pattern" "$output_file" "$verbose_flag" "$debug_flag"; then
        if [[ "$open_flag" == "true" ]]; then
            echo ""
            open_html_file "$output_file"
        fi
        
        echo ""
        log_success "✨ 时序图可视化完成！"
    else
        log_error "时序图生成失败"
        exit 1
    fi
}

# 运行主函数
main "$@"