#!/bin/bash

# Claude Code Router - 测试套件运行器
# 
# 运行所有工具测试用例，验证工具功能正确性
# 
# 使用方法:
#   ./tools/run-tests.sh [OPTIONS]
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
🧪 Claude Code Router - 测试套件运行器

这是一个统一的测试运行器，用于验证所有工具的功能正确性。
它会按顺序执行各个工具的测试套件，并提供详细的测试报告。

用法: $0 [OPTIONS]

选项:
  -h, --help       显示此帮助信息
  -v, --verbose    详细输出模式
  -d, --debug      调试模式
  -f, --fail-fast  遇到失败时立即停止
  -t, --test NAME  只运行指定的测试套件
  -l, --list       列出可用的测试套件
  -c, --coverage   生成测试覆盖率报告
  -r, --report     生成详细测试报告

可用的测试套件:
  log-parser        - 日志解析数据库工具测试
  timeline          - 时序图生成工具测试  
  integration       - 集成测试
  all (default)     - 运行所有测试

示例:
  $0                        # 运行所有测试
  $0 --verbose              # 详细模式运行所有测试
  $0 --test log-parser      # 只运行日志解析器测试
  $0 --fail-fast --report  # 快速失败模式并生成报告
  $0 --list                 # 列出所有测试套件

输出:
  测试结果会显示在控制台，可选择生成HTML报告。
EOF
}

# 全局测试统计
GLOBAL_STATS=(
    [total_suites]=0
    [passed_suites]=0
    [failed_suites]=0
    [total_tests]=0
    [passed_tests]=0
    [failed_tests]=0
)

# 测试结果收集
TEST_RESULTS=()

# 列出可用的测试套件
list_test_suites() {
    echo ""
    log_highlight "🧪 可用的测试套件:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    local suites=(
        "log-parser:📊 日志解析数据库工具测试:${SCRIPT_DIR}/test/test-log-parser.js"
        "timeline:🕒 时序图生成工具测试:${SCRIPT_DIR}/test/test-timeline-visualizer.js"
    )
    
    for suite_info in "${suites[@]}"; do
        IFS=':' read -r suite_id suite_desc suite_path <<< "$suite_info"
        
        if [[ -f "$suite_path" ]]; then
            log_success "✅ $suite_id - $suite_desc"
            log_info "   路径: $suite_path"
        else
            log_error "❌ $suite_id - $suite_desc (文件不存在)"
            log_info "   路径: $suite_path"
        fi
        echo ""
    done
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# 检查测试环境
check_test_environment() {
    log_info "检查测试环境..."
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装或不在 PATH 中"
        exit 1
    fi
    
    local node_version=$(node --version)
    log_info "Node.js 版本: $node_version"
    
    # 检查测试目录
    if [[ ! -d "${SCRIPT_DIR}/test" ]]; then
        log_error "测试目录不存在: ${SCRIPT_DIR}/test"
        exit 1
    fi
    
    # 检查必要的测试文件
    local test_files=(
        "test-log-parser.js"
        "test-timeline-visualizer.js"
    )
    
    for test_file in "${test_files[@]}"; do
        local test_path="${SCRIPT_DIR}/test/$test_file"
        if [[ ! -f "$test_path" ]]; then
            log_error "测试文件不存在: $test_path"
            exit 1
        fi
    done
    
    log_success "测试环境检查通过"
}

# 运行单个测试套件
run_test_suite() {
    local suite_name="$1"
    local suite_path="$2"
    local verbose_flag="$3"
    local debug_flag="$4"
    
    log_step "🧪 运行测试套件: $suite_name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    GLOBAL_STATS[total_suites]=$((GLOBAL_STATS[total_suites] + 1))
    
    local start_time=$(date +%s)
    local temp_output=$(mktemp)
    local exit_code=0
    
    # 设置环境变量
    if [[ "$verbose_flag" == "true" ]]; then
        export LOG_LEVEL="info"
    fi
    
    if [[ "$debug_flag" == "true" ]]; then
        export LOG_LEVEL="debug"
        export NODE_ENV="development"
    fi
    
    # 运行测试
    log_info "执行: node $suite_path"
    
    if node "$suite_path" > "$temp_output" 2>&1; then
        exit_code=0
        GLOBAL_STATS[passed_suites]=$((GLOBAL_STATS[passed_suites] + 1))
    else
        exit_code=$?
        GLOBAL_STATS[failed_suites]=$((GLOBAL_STATS[failed_suites] + 1))
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # 显示输出
    if [[ "$verbose_flag" == "true" ]] || [[ $exit_code -ne 0 ]]; then
        cat "$temp_output"
    fi
    
    # 解析测试结果（简化版）
    local passed_tests=$(grep -c "✅ 通过" "$temp_output" 2>/dev/null || echo "0")
    local failed_tests=$(grep -c "❌ 失败" "$temp_output" 2>/dev/null || echo "0")
    
    GLOBAL_STATS[total_tests]=$((GLOBAL_STATS[total_tests] + passed_tests + failed_tests))
    GLOBAL_STATS[passed_tests]=$((GLOBAL_STATS[passed_tests] + passed_tests))
    GLOBAL_STATS[failed_tests]=$((GLOBAL_STATS[failed_tests] + failed_tests))
    
    # 记录结果
    TEST_RESULTS+=("$suite_name:$exit_code:$duration:$passed_tests:$failed_tests")
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [[ $exit_code -eq 0 ]]; then
        log_success "测试套件通过: $suite_name (${duration}秒, $passed_tests/$((passed_tests + failed_tests)) 测试通过)"
    else
        log_error "测试套件失败: $suite_name (${duration}秒, $passed_tests/$((passed_tests + failed_tests)) 测试通过)"
    fi
    
    # 清理临时文件
    rm -f "$temp_output"
    
    echo ""
    return $exit_code
}

# 运行日志解析器测试
run_log_parser_tests() {
    local verbose_flag="$1"
    local debug_flag="$2"
    
    run_test_suite "log-parser" "${SCRIPT_DIR}/test/test-log-parser.js" "$verbose_flag" "$debug_flag"
}

# 运行时序图生成器测试
run_timeline_tests() {
    local verbose_flag="$1"
    local debug_flag="$2"
    
    run_test_suite "timeline" "${SCRIPT_DIR}/test/test-timeline-visualizer.js" "$verbose_flag" "$debug_flag"
}

# 运行集成测试
run_integration_tests() {
    local verbose_flag="$1"
    local debug_flag="$2"
    
    log_step "🔗 运行集成测试"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    GLOBAL_STATS[total_suites]=$((GLOBAL_STATS[total_suites] + 1))
    
    # 简化的集成测试 - 验证工具链完整性
    local integration_passed=true
    
    # 检查工具文件存在性
    local tools=(
        "${SCRIPT_DIR}/log-parser/log-parser-database.js"
        "${SCRIPT_DIR}/visualization/timeline-visualizer.js"
        "${SCRIPT_DIR}/config.json"
        "${SCRIPT_DIR}/run-log-parser.sh"
        "${SCRIPT_DIR}/run-timeline-visualizer.sh"
        "${SCRIPT_DIR}/run-tools.sh"
    )
    
    for tool in "${tools[@]}"; do
        if [[ ! -f "$tool" ]]; then
            log_error "集成测试失败: 工具文件不存在 $tool"
            integration_passed=false
        fi
    done
    
    # 检查配置文件有效性
    if ! node -e "JSON.parse(require('fs').readFileSync('${SCRIPT_DIR}/config.json', 'utf8'))" 2>/dev/null; then
        log_error "集成测试失败: 配置文件无效"
        integration_passed=false
    fi
    
    # 检查脚本执行权限
    local scripts=(
        "${SCRIPT_DIR}/run-log-parser.sh"
        "${SCRIPT_DIR}/run-timeline-visualizer.sh"
        "${SCRIPT_DIR}/run-tools.sh"
    )
    
    for script in "${scripts[@]}"; do
        if [[ ! -x "$script" ]]; then
            log_error "集成测试失败: 脚本没有执行权限 $script"
            integration_passed=false
        fi
    done
    
    if [[ "$integration_passed" == "true" ]]; then
        GLOBAL_STATS[passed_suites]=$((GLOBAL_STATS[passed_suites] + 1))
        GLOBAL_STATS[passed_tests]=$((GLOBAL_STATS[passed_tests] + 5))
        GLOBAL_STATS[total_tests]=$((GLOBAL_STATS[total_tests] + 5))
        
        TEST_RESULTS+=("integration:0:1:5:0")
        log_success "集成测试通过: 所有工具和配置检查通过"
    else
        GLOBAL_STATS[failed_suites]=$((GLOBAL_STATS[failed_suites] + 1))
        GLOBAL_STATS[failed_tests]=$((GLOBAL_STATS[failed_tests] + 1))
        GLOBAL_STATS[total_tests]=$((GLOBAL_STATS[total_tests] + 1))
        
        TEST_RESULTS+=("integration:1:1:0:1")
        log_error "集成测试失败"
        return 1
    fi
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

# 显示最终测试报告
show_final_report() {
    local generate_report="$1"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_highlight "🏆 最终测试报告"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # 全局统计
    local suite_pass_rate=0
    local test_pass_rate=0
    
    if [[ ${GLOBAL_STATS[total_suites]} -gt 0 ]]; then
        suite_pass_rate=$(awk "BEGIN {printf \"%.2f\", ${GLOBAL_STATS[passed_suites]}/${GLOBAL_STATS[total_suites]}*100}")
    fi
    
    if [[ ${GLOBAL_STATS[total_tests]} -gt 0 ]]; then
        test_pass_rate=$(awk "BEGIN {printf \"%.2f\", ${GLOBAL_STATS[passed_tests]}/${GLOBAL_STATS[total_tests]}*100}")
    fi
    
    log_info "📊 测试套件统计:"
    log_info "   总测试套件: ${GLOBAL_STATS[total_suites]}"
    log_info "   通过套件: ${GLOBAL_STATS[passed_suites]}"
    log_info "   失败套件: ${GLOBAL_STATS[failed_suites]}"
    log_info "   套件通过率: ${suite_pass_rate}%"
    
    echo ""
    log_info "🧪 测试用例统计:"
    log_info "   总测试用例: ${GLOBAL_STATS[total_tests]}"
    log_info "   通过用例: ${GLOBAL_STATS[passed_tests]}"
    log_info "   失败用例: ${GLOBAL_STATS[failed_tests]}"
    log_info "   用例通过率: ${test_pass_rate}%"
    
    echo ""
    log_info "📝 详细结果:"
    for result in "${TEST_RESULTS[@]}"; do
        IFS=':' read -r suite_name exit_code duration passed failed <<< "$result"
        
        local status_icon="✅"
        local status_text="通过"
        
        if [[ $exit_code -ne 0 ]]; then
            status_icon="❌"
            status_text="失败"
        fi
        
        printf "   %s %-15s %s (%s秒, %s/%s测试通过)\n" \
            "$status_icon" "$suite_name" "$status_text" "$duration" "$passed" "$((passed + failed))"
    done
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # 最终结论
    if [[ ${GLOBAL_STATS[failed_suites]} -eq 0 ]]; then
        log_success "🎉 所有测试通过！工具箱运行正常。"
        
        if [[ ${GLOBAL_STATS[total_tests]} -gt 0 ]]; then
            log_highlight "✨ 质量保证: ${GLOBAL_STATS[total_tests]} 个测试用例全部通过，代码质量有保障。"
        fi
        
    else
        log_error "⚠️  存在 ${GLOBAL_STATS[failed_suites]} 个测试套件失败，请检查相关功能。"
        
        if [[ ${GLOBAL_STATS[failed_tests]} -gt 0 ]]; then
            log_error "🐛 需要修复 ${GLOBAL_STATS[failed_tests]} 个失败的测试用例。"
        fi
    fi
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # 生成HTML报告
    if [[ "$generate_report" == "true" ]]; then
        generate_html_report
    fi
}

# 生成HTML测试报告
generate_html_report() {
    local report_file="test-report-$(date +%Y%m%d-%H%M%S).html"
    
    log_info "生成HTML测试报告: $report_file"
    
    cat > "$report_file" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Claude Code Router - 测试报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .stats { display: flex; gap: 20px; margin-bottom: 20px; }
        .stat-box { background: #e9ecef; padding: 15px; border-radius: 5px; text-align: center; }
        .results { background: white; border: 1px solid #ddd; border-radius: 5px; padding: 20px; }
        .suite-result { margin-bottom: 15px; padding: 10px; border-left: 4px solid; }
        .suite-passed { border-color: #28a745; background: #d4edda; }
        .suite-failed { border-color: #dc3545; background: #f8d7da; }
        .footer { margin-top: 20px; text-align: center; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Claude Code Router - 测试报告</h1>
        <p>生成时间: $(date)</p>
    </div>
    
    <div class="stats">
        <div class="stat-box">
            <h3>${GLOBAL_STATS[total_suites]}</h3>
            <p>测试套件</p>
        </div>
        <div class="stat-box">
            <h3>${GLOBAL_STATS[passed_suites]}</h3>
            <p>通过套件</p>
        </div>
        <div class="stat-box">
            <h3>${GLOBAL_STATS[total_tests]}</h3>
            <p>测试用例</p>
        </div>
        <div class="stat-box">
            <h3>${GLOBAL_STATS[passed_tests]}</h3>
            <p>通过用例</p>
        </div>
    </div>
    
    <div class="results">
        <h2>测试结果详情</h2>
EOF

    for result in "${TEST_RESULTS[@]}"; do
        IFS=':' read -r suite_name exit_code duration passed failed <<< "$result"
        
        local class_name="suite-passed"
        local status_text="通过"
        
        if [[ $exit_code -ne 0 ]]; then
            class_name="suite-failed"
            status_text="失败"
        fi
        
        cat >> "$report_file" << EOF
        <div class="suite-result $class_name">
            <h3>$suite_name - $status_text</h3>
            <p>执行时间: ${duration}秒 | 通过: $passed | 失败: $failed</p>
        </div>
EOF
    done

    cat >> "$report_file" << 'EOF'
    </div>
    
    <div class="footer">
        <p>由 Claude Code Router 工具箱自动生成</p>
    </div>
</body>
</html>
EOF

    log_success "HTML报告已生成: $report_file"
}

# 主函数
main() {
    local verbose_flag="false"
    local debug_flag="false"
    local fail_fast="false"
    local test_name=""
    local list_flag="false"
    local generate_report="false"
    
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
                verbose_flag="true"
                shift
                ;;
            -f|--fail-fast)
                fail_fast="true"
                shift
                ;;
            -t|--test)
                test_name="$2"
                shift 2
                ;;
            -l|--list)
                list_flag="true"
                shift
                ;;
            -r|--report)
                generate_report="true"
                shift
                ;;
            -c|--coverage)
                log_warn "测试覆盖率功能暂未实现"
                shift
                ;;
            -*)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
            *)
                if [[ -z "$test_name" ]]; then
                    test_name="$1"
                else
                    log_error "过多参数: $1"
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # 列出测试套件
    if [[ "$list_flag" == "true" ]]; then
        list_test_suites
        exit 0
    fi
    
    # 显示开始信息
    echo ""
    log_info "🧪 Claude Code Router - 测试套件运行器"
    log_info "========================================"
    log_info "测试目标: ${test_name:-all}"
    log_info "详细输出: $verbose_flag"
    log_info "调试模式: $debug_flag"
    log_info "快速失败: $fail_fast"
    log_info "生成报告: $generate_report"
    
    # 检查测试环境
    check_test_environment
    
    echo ""
    log_highlight "🚀 开始执行测试..."
    
    local overall_success=true
    
    # 根据参数运行测试
    case "$test_name" in
        "log-parser")
            if ! run_log_parser_tests "$verbose_flag" "$debug_flag"; then
                overall_success=false
                [[ "$fail_fast" == "true" ]] && exit 1
            fi
            ;;
        "timeline")
            if ! run_timeline_tests "$verbose_flag" "$debug_flag"; then
                overall_success=false
                [[ "$fail_fast" == "true" ]] && exit 1
            fi
            ;;
        "integration")
            if ! run_integration_tests "$verbose_flag" "$debug_flag"; then
                overall_success=false
                [[ "$fail_fast" == "true" ]] && exit 1
            fi
            ;;
        "all"|"")
            # 运行所有测试
            if ! run_log_parser_tests "$verbose_flag" "$debug_flag"; then
                overall_success=false
                [[ "$fail_fast" == "true" ]] && exit 1
            fi
            
            if ! run_timeline_tests "$verbose_flag" "$debug_flag"; then
                overall_success=false
                [[ "$fail_fast" == "true" ]] && exit 1
            fi
            
            if ! run_integration_tests "$verbose_flag" "$debug_flag"; then
                overall_success=false
                [[ "$fail_fast" == "true" ]] && exit 1
            fi
            ;;
        *)
            log_error "未知的测试套件: $test_name"
            log_info "使用 --list 查看可用的测试套件"
            exit 1
            ;;
    esac
    
    # 显示最终报告
    show_final_report "$generate_report"
    
    # 返回状态
    if [[ "$overall_success" == "true" ]]; then
        exit 0
    else
        exit 1
    fi
}

# 运行主函数
main "$@"