#!/bin/bash

# Claude Code Router - 统一工具运行器
# 
# 一键运行所有测试工具的统一入口脚本
# 
# 使用方法:
#   ./tools/run-tools.sh [OPTIONS]
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
CYAN='\033[0;36m'
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

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# 显示帮助信息
show_help() {
    cat << EOF
🔧 Claude Code Router - 统一工具运行器

这是一个一键运行所有测试工具的统一入口脚本。
它会按顺序执行日志解析和时序图生成，提供完整的分析流水线。

用法: $0 [OPTIONS] [LOG_PATTERN]

选项:
  -h, --help     显示此帮助信息
  -v, --verbose  详细输出模式
  -d, --debug    调试模式
  -c, --clean    清理旧数据后运行
  -o, --open     生成后自动打开时序图
  -p, --preview  预览模式，显示将处理的文件
  -s, --skip-parser    跳过日志解析，只生成时序图
  -t, --skip-timeline  只执行日志解析，跳过时序图

参数:
  LOG_PATTERN    日志文件匹配模式 (默认: ccr-*.log)

工具执行顺序:
  1. 📊 日志解析数据库工具 - 解析日志并按Provider分类存储
  2. 🕒 时序图生成工具     - 生成HTML交互式时序图

示例:
  $0                                    # 基础完整流程
  $0 --clean --open                    # 清理+生成+打开
  $0 --preview ccr-session-*.log       # 预览特定日志
  $0 --skip-parser                     # 只生成时序图
  $0 --verbose --debug                 # 完整调试模式

输出位置:
  - Provider数据: ~/.route-claude-code/providers/
  - 时序图文件: ./timeline.html
EOF
}

# 显示工具状态
show_tool_status() {
    echo ""
    log_highlight "🔧 Claude Code Router - 工具箱状态检查"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # 检查工具文件
    local tools=(
        "log-parser/log-parser-database.js:📊 日志解析数据库工具"
        "visualization/timeline-visualizer.js:🕒 时序图生成工具"
        "run-log-parser.sh:🚀 日志解析器启动脚本"
        "run-timeline-visualizer.sh:🚀 时序图生成器启动脚本"
        "config.json:⚙️ 工具配置文件"
    )
    
    for tool_info in "${tools[@]}"; do
        IFS=':' read -r tool_path tool_desc <<< "$tool_info"
        local full_path="${SCRIPT_DIR}/${tool_path}"
        
        if [[ -f "$full_path" ]]; then
            log_success "✅ $tool_desc"
        else
            log_error "❌ $tool_desc (未找到: $tool_path)"
        fi
    done
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# 运行日志解析器
run_log_parser() {
    local log_pattern="$1"
    local clean_flag="$2"
    local verbose_flag="$3"
    local debug_flag="$4"
    
    log_step "1️⃣ 执行日志解析数据库工具"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # 构建命令
    local cmd="${SCRIPT_DIR}/run-log-parser.sh"
    
    if [[ "$clean_flag" == "true" ]]; then
        cmd="$cmd --clean"
    fi
    
    if [[ "$verbose_flag" == "true" ]]; then
        cmd="$cmd --verbose"
    fi
    
    if [[ "$debug_flag" == "true" ]]; then
        cmd="$cmd --debug"
    fi
    
    if [[ -n "$log_pattern" ]]; then
        cmd="$cmd \"$log_pattern\""
    fi
    
    log_info "执行命令: $cmd"
    
    if eval "$cmd"; then
        log_success "日志解析完成"
        return 0
    else
        log_error "日志解析失败"
        return 1
    fi
}

# 运行时序图生成器
run_timeline_generator() {
    local log_pattern="$1"
    local verbose_flag="$2"
    local debug_flag="$3"
    local open_flag="$4"
    local preview_flag="$5"
    
    log_step "2️⃣ 执行时序图生成工具"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # 构建命令
    local cmd="${SCRIPT_DIR}/run-timeline-visualizer.sh"
    
    if [[ "$verbose_flag" == "true" ]]; then
        cmd="$cmd --verbose"
    fi
    
    if [[ "$debug_flag" == "true" ]]; then
        cmd="$cmd --debug"
    fi
    
    if [[ "$open_flag" == "true" ]]; then
        cmd="$cmd --open"
    fi
    
    if [[ "$preview_flag" == "true" ]]; then
        cmd="$cmd --preview"
    fi
    
    if [[ -n "$log_pattern" ]]; then
        cmd="$cmd \"$log_pattern\""
    fi
    
    # 添加自定义输出文件名
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local output_file="timeline-${timestamp}.html"
    cmd="$cmd \"$output_file\""
    
    log_info "执行命令: $cmd"
    
    if eval "$cmd"; then
        log_success "时序图生成完成: $output_file"
        return 0
    else
        log_error "时序图生成失败"
        return 1
    fi
}

# 显示最终结果
show_final_results() {
    local success_count="$1"
    local total_count="$2"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [[ "$success_count" -eq "$total_count" ]]; then
        log_success "🎉 所有工具执行成功！ ($success_count/$total_count)"
        
        log_highlight "📋 完成的任务:"
        if [[ "$total_count" -ge 1 ]]; then
            log_info "  ✅ 日志解析: Provider数据已分类存储"
        fi
        if [[ "$total_count" -ge 2 ]]; then
            log_info "  ✅ 时序图生成: HTML可视化文件已创建"
        fi
        
        log_highlight "📁 输出位置:"
        log_info "  🗂️  Provider数据: ~/.route-claude-code/providers/"
        log_info "  🌐 时序图文件: ./timeline-*.html"
        
        echo ""
        log_highlight "🎯 下一步建议:"
        log_info "  1. 浏览各Provider目录的README.md文件"
        log_info "  2. 在浏览器中打开时序图HTML文件"
        log_info "  3. 使用过滤器分析特定Provider或事件类型"
        
    else
        log_error "❌ 部分工具执行失败 ($success_count/$total_count)"
        log_info "请检查上方的错误信息并重试"
    fi
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# 主函数
main() {
    local log_pattern="ccr-*.log"
    local clean_flag="false"
    local verbose_flag="false"
    local debug_flag="false"
    local open_flag="false"
    local preview_flag="false"
    local skip_parser="false"
    local skip_timeline="false"
    
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
            -o|--open)
                open_flag="true"
                shift
                ;;
            -p|--preview)
                preview_flag="true"
                shift
                ;;
            -s|--skip-parser)
                skip_parser="true"
                shift
                ;;
            -t|--skip-timeline)
                skip_timeline="true"
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
    
    # 参数验证
    if [[ "$skip_parser" == "true" && "$skip_timeline" == "true" ]]; then
        log_error "不能同时跳过两个工具"
        exit 1
    fi
    
    # 显示开始信息
    echo ""
    log_info "🚀 Claude Code Router - 统一工具运行器"
    log_info "=========================================="
    log_info "日志模式: $log_pattern"
    log_info "清理模式: $clean_flag"
    log_info "详细输出: $verbose_flag"
    log_info "调试模式: $debug_flag"
    log_info "自动打开: $open_flag"
    log_info "预览模式: $preview_flag"
    log_info "跳过解析: $skip_parser"
    log_info "跳过时序: $skip_timeline"
    
    # 显示工具状态
    show_tool_status
    
    # 执行工具
    local success_count=0
    local total_count=0
    
    # 日志解析器
    if [[ "$skip_parser" != "true" ]]; then
        total_count=$((total_count + 1))
        echo ""
        if run_log_parser "$log_pattern" "$clean_flag" "$verbose_flag" "$debug_flag"; then
            success_count=$((success_count + 1))
        fi
    fi
    
    # 时序图生成器
    if [[ "$skip_timeline" != "true" ]]; then
        total_count=$((total_count + 1))
        echo ""
        if run_timeline_generator "$log_pattern" "$verbose_flag" "$debug_flag" "$open_flag" "$preview_flag"; then
            success_count=$((success_count + 1))
        fi
    fi
    
    # 显示最终结果
    show_final_results "$success_count" "$total_count"
    
    # 返回状态
    if [[ "$success_count" -eq "$total_count" ]]; then
        exit 0
    else
        exit 1
    fi
}

# 运行主函数
main "$@"