#!/bin/bash

# 全面架构合规扫描器 - Comprehensive Architecture Scanner
# 整合所有P0-P2级规则检查，帮助清理设计和架构违规
# 基于.claude/rules/中的完整规则体系

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCAN_RESULTS_DIR="$PROJECT_ROOT/.claude/scan-results"
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')

# 创建扫描结果目录
mkdir -p "$SCAN_RESULTS_DIR"

# 初始化扫描统计
TOTAL_FILES=0
TOTAL_VIOLATIONS=0
VIOLATION_REPORT=""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_p0() { echo -e "${RED}[P0-CRITICAL]${NC} $*"; }
log_p1() { echo -e "${YELLOW}[P1-MAJOR]${NC} $*"; }
log_p2() { echo -e "${CYAN}[P2-MINOR]${NC} $*"; }

# 记录违规到统计
record_violation() {
    local priority="$1"
    local type="$2"
    local file_path="$3"
    local description="$4"
    
    TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + 1))
    
    # 添加到违规报告
    VIOLATION_REPORT="${VIOLATION_REPORT}${priority}:${type}:${file_path}:${description}
"
    
    # 实时输出违规信息
    case "$priority" in
        "P0") log_p0 "   $file_path: $description" ;;
        "P1") log_p1 "   $file_path: $description" ;;
        "P2") log_p2 "   $file_path: $description" ;;
    esac
}

# ===== P0级检查：项目架构红线 =====

# P0-1: 零硬编码原则检查
check_p0_zero_hardcoding() {
    local file_content="$1"
    local file_path="$2"
    
    local hardcode_patterns=(
        "api\.openai\.com"
        "api\.anthropic\.com"
        "localhost:[0-9]+"
        "127\.0\.0\.1:[0-9]+"
        "sk-[a-zA-Z0-9]+"
        "claude-3"
        "gpt-4"
        "gpt-3\.5"
        "llama-[0-9]"
        "deepseek"
        "process\.env\.[A-Z_]+\s*\|\|\s*['\"]"
        "3456"
        "5506"
        "8080"
        "3000"
        "anthropic_api_key"
        "openai_api_key"
    )
    
    for pattern in "${hardcode_patterns[@]}"; do
        if echo "$file_content" | grep -qiE "$pattern"; then
            record_violation "P0" "HARDCODING" "$file_path" "硬编码模式: $pattern"
        fi
    done
}

# P0-2: 零静默失败原则检查
check_p0_zero_silent_failure() {
    local file_content="$1"
    local file_path="$2"
    
    local silent_patterns=(
        "catch\s*\([^)]*\)\s*{\s*}"
        "catch\s*\([^)]*\)\s*{\s*console\.log"
        "catch\s*\([^)]*\)\s*{\s*return"
        "\|\|\s*{}"
        "\.catch\(\(\)\s*=>\s*{\s*}\)"
        "\.catch\(\(\)\s*=>\s*null\)"
        "\.catch\(\(\)\s*=>\s*undefined\)"
        "try\s*{[^}]*}\s*catch\s*\([^)]*\)\s*{\s*}"
    )
    
    for pattern in "${silent_patterns[@]}"; do
        if echo "$file_content" | grep -qE "$pattern"; then
            record_violation "P0" "SILENT_FAILURE" "$file_path" "静默失败模式: $pattern"
        fi
    done
}

# P0-3: 零虚假实现原则检查 (排除测试文件)
check_p0_zero_unreal_implementation() {
    local file_content="$1"
    local file_path="$2"
    
    # 跳过测试文件
    if [[ "$file_path" =~ \.(test|spec)\. ]]; then
        return 0
    fi
    
    local unreal_patterns=(
        "jest\.fn"
        "sinon\."
        "spyOn"
        "return\s*{\s*test\s*:"
        "return\s*{\s*success\s*:\s*true\s*}"
        "placeholder.*response"
        "return.*test.*data"
        "虚假"
        "模拟"
        "假数据"
        "测试数据"
    )
    
    for pattern in "${unreal_patterns[@]}"; do
        if echo "$file_content" | grep -qiE "$pattern"; then
            record_violation "P0" "UNREAL_IMPL" "$file_path" "虚假实现: $pattern"
        fi
    done
}

# P0-4: 严格模块边界检查
check_p0_module_boundaries() {
    local file_content="$1"
    local file_path="$2"
    
    # 检查跨层级导入
    local boundary_patterns=(
        "import.*from.*\\.\\./\\.\\./\\.\\./.*"
        "import.*from.*\\.\\./\\.\\./[^/]*/[^/]*/"
        "require\\([\"']\\.\\./\\.\\./\\.\\./.*[\"']\\)"
        "require\\([\"']\\.\\./\\.\\./[^/]*/[^/]*/.*[\"']\\)"
    )
    
    for pattern in "${boundary_patterns[@]}"; do
        if echo "$file_content" | grep -qE "$pattern"; then
            record_violation "P0" "MODULE_BOUNDARY" "$file_path" "跨层级导入: $pattern"
        fi
    done
    
    # 检查直接访问内部方法
    if echo "$file_content" | grep -qE "import.*[Ii]nternal.*from|import.*[Pp]rivate.*from"; then
        record_violation "P0" "MODULE_BOUNDARY" "$file_path" "访问内部方法"
    fi
}

# P0-5: 零Fallback策略检查
check_p0_zero_fallback() {
    local file_content="$1"
    local file_path="$2"
    
    local fallback_patterns=(
        "fallback"
        "backup"
        "secondary"
        "emergency"
        "兜底"
        "降级"
        "备用"
        "CrossProviderFallback"
        "ConditionalFallback"
        "AdaptiveFallback"
        "BackwardCompatibility"
        "DefaultsForBackward"
        "loadDefaults.*Compatibility"
        "FallbackStrategy"
        "FallbackResolver"
        "FallbackManager"
    )
    
    for pattern in "${fallback_patterns[@]}"; do
        if echo "$file_content" | grep -qiE "$pattern" && ! echo "$file_content" | grep -qE "@deprecated.*$pattern|DEPRECATED.*$pattern"; then
            record_violation "P0" "FALLBACK" "$file_path" "Fallback机制: $pattern"
        fi
    done
    
    # 检查注释中的fallback描述
    if echo "$file_content" | grep -qiE "//.*fallback|//.*备用|//.*兜底|作为.*fallback|作为.*备用|作为.*兜底"; then
        record_violation "P0" "FALLBACK" "$file_path" "注释中的Fallback描述"
    fi
}

# ===== P1级检查：开发流程强制要求 =====

# P1-1: TypeScript规范检查
check_p1_typescript_standards() {
    local file_content="$1"
    local file_path="$2"
    
    # 检查any类型使用
    if echo "$file_content" | grep -qE ":\s*any\s*[;,=)]|<any>|\bany\[\]"; then
        record_violation "P1" "TYPESCRIPT" "$file_path" "使用any类型，违反类型安全"
    fi
    
    # 检查未定义类型
    if echo "$file_content" | grep -qE "function.*\([^)]*\)\s*{|=>\s*{" && ! echo "$file_content" | grep -qE "function.*\([^)]*\):\s*\w+|=>\s*\w+\s*{"; then
        record_violation "P1" "TYPESCRIPT" "$file_path" "缺少返回类型注解"
    fi
    
    # 检查JavaScript文件在src目录
    if [[ "$file_path" =~ ^src/.*\.js$ ]]; then
        record_violation "P1" "TYPESCRIPT" "$file_path" "src目录中存在JavaScript文件"
    fi
}

# P1-2: 错误处理架构检查
check_p1_error_handling() {
    local file_content="$1"
    local file_path="$2"
    
    # 检查是否使用标准错误处理
    if echo "$file_content" | grep -qE "throw\s+new\s+Error\(" && ! echo "$file_content" | grep -qE "import.*ErrorHandler|import.*RCCError"; then
        record_violation "P1" "ERROR_HANDLING" "$file_path" "未使用标准错误处理架构"
    fi
    
    # 检查错误重抛
    if echo "$file_content" | grep -qE "catch.*{.*console\.log.*}" && ! echo "$file_content" | grep -qE "throw.*error"; then
        record_violation "P1" "ERROR_HANDLING" "$file_path" "错误处理后未重抛"
    fi
}

# P1-3: 接口定义检查
check_p1_interface_definitions() {
    local file_content="$1"
    local file_path="$2"
    
    # 检查是否定义了接口
    if echo "$file_content" | grep -qE "export\s+class\s+\w+" && ! echo "$file_content" | grep -qE "interface\s+\w+|implements\s+\w+"; then
        record_violation "P1" "INTERFACE" "$file_path" "类未实现标准接口"
    fi
    
    # 检查接口导入
    if echo "$file_content" | grep -qE "export\s+class.*Manager|export\s+class.*Handler" && ! echo "$file_content" | grep -qE "import.*Interface.*from"; then
        record_violation "P1" "INTERFACE" "$file_path" "管理器/处理器类未导入接口定义"
    fi
}

# ===== P2级检查：代码质量和规范 =====

# P2-1: 命名约定检查
check_p2_naming_conventions() {
    local file_content="$1"
    local file_path="$2"
    
    # 检查类命名 (PascalCase)
    if echo "$file_content" | grep -qE "export\s+class\s+[a-z]"; then
        record_violation "P2" "NAMING" "$file_path" "类名未使用PascalCase"
    fi
    
    # 检查函数命名 (camelCase)
    if echo "$file_content" | grep -qE "function\s+[A-Z]"; then
        record_violation "P2" "NAMING" "$file_path" "函数名未使用camelCase"
    fi
    
    # 检查常量命名 (UPPER_SNAKE_CASE)
    if echo "$file_content" | grep -qE "const\s+[a-z][A-Z].*=.*['\"]"; then
        record_violation "P2" "NAMING" "$file_path" "常量未使用UPPER_SNAKE_CASE"
    fi
}

# P2-2: 代码结构检查
check_p2_code_structure() {
    local file_content="$1"
    local file_path="$2"
    
    # 检查文件长度
    local line_count=$(echo "$file_content" | wc -l)
    if [ "$line_count" -gt 500 ]; then
        record_violation "P2" "STRUCTURE" "$file_path" "文件过长($line_count行)，建议拆分"
    fi
    
    # 检查代码重复
    if echo "$file_content" | grep -qE "console\.log.*console\.log.*console\.log"; then
        record_violation "P2" "STRUCTURE" "$file_path" "存在重复的调试代码"
    fi
}

# P2-3: 性能和监控检查
check_p2_performance_monitoring() {
    local file_content="$1"
    local file_path="$2"
    
    # 检查异步操作是否有超时
    if echo "$file_content" | grep -qE "await\s+fetch\(|await\s+axios\." && ! echo "$file_content" | grep -qE "timeout|signal"; then
        record_violation "P2" "PERFORMANCE" "$file_path" "异步操作缺少超时控制"
    fi
    
    # 检查是否有性能监控
    if echo "$file_content" | grep -qE "export\s+class.*Manager" && ! echo "$file_content" | grep -qE "performance|metrics|monitor"; then
        record_violation "P2" "MONITORING" "$file_path" "管理器类缺少性能监控"
    fi
}

# P2-4: Debug系统检查
check_p2_debug_system() {
    local file_content="$1"
    local file_path="$2"
    
    # 检查调试代码
    if echo "$file_content" | grep -qE "console\.log|console\.debug|console\.warn" && [[ ! "$file_path" =~ debug/ ]]; then
        record_violation "P2" "DEBUG" "$file_path" "存在调试代码，应使用正式日志系统"
    fi
    
    # 检查debug配置
    if echo "$file_content" | grep -qE "debug.*true|DEBUG.*=.*true" && [[ ! "$file_path" =~ \.(test|spec)\. ]]; then
        record_violation "P2" "DEBUG" "$file_path" "生产代码中存在debug配置"
    fi
}

# 执行完整扫描
scan_file() {
    local file_path="$1"
    local relative_path="${file_path#$PROJECT_ROOT/}"
    
    # 跳过非代码文件和特定目录
    if [[ "$relative_path" =~ \.(md|json|yml|yaml|txt|log|git)$ ]] || 
       [[ "$relative_path" =~ ^(dist|node_modules|\.git|\.claude/scan-results)/ ]]; then
        return 0
    fi
    
    TOTAL_FILES=$((TOTAL_FILES + 1))
    
    if [ ! -f "$file_path" ]; then
        log_error "文件不存在: $relative_path"
        return 1
    fi
    
    # 读取完整文件内容
    local file_content
    if ! file_content=$(cat "$file_path" 2>/dev/null); then
        log_error "无法读取文件: $relative_path"
        return 1
    fi
    
    # 执行所有检查
    echo "🔍 扫描: $relative_path"
    
    # P0级检查 - 架构红线
    check_p0_zero_hardcoding "$file_content" "$relative_path"
    check_p0_zero_silent_failure "$file_content" "$relative_path"
    check_p0_zero_unreal_implementation "$file_content" "$relative_path"
    check_p0_module_boundaries "$file_content" "$relative_path"
    check_p0_zero_fallback "$file_content" "$relative_path"
    
    # P1级检查 - 开发流程要求
    check_p1_typescript_standards "$file_content" "$relative_path"
    check_p1_error_handling "$file_content" "$relative_path"
    check_p1_interface_definitions "$file_content" "$relative_path"
    
    # P2级检查 - 代码质量规范
    check_p2_naming_conventions "$file_content" "$relative_path"
    check_p2_code_structure "$file_content" "$relative_path"
    check_p2_performance_monitoring "$file_content" "$relative_path"
    check_p2_debug_system "$file_content" "$relative_path"
}

# 生成详细报告
generate_comprehensive_report() {
    local report_file="$SCAN_RESULTS_DIR/comprehensive-scan-$TIMESTAMP.json"
    
    cat > "$report_file" << EOF
{
  "timestamp": "$(date '+%Y-%m-%d %H:%M:%S')",
  "scan_type": "comprehensive_architecture_scan",
  "project_root": "$PROJECT_ROOT",
  "statistics": {
    "total_files_scanned": $TOTAL_FILES,
    "total_violations": $TOTAL_VIOLATIONS
  },
  "violations": [
EOF

    # 输出违规详情
    echo "$VIOLATION_REPORT" | while IFS=':' read -r priority type file_path description; do
        if [ -n "$priority" ]; then
            echo "    {\"priority\": \"$priority\", \"type\": \"$type\", \"file\": \"$file_path\", \"description\": \"$description\"},"
        fi
    done | sed '$ s/,$//' >> "$report_file"

    cat >> "$report_file" << EOF
  ],
  "scan_status": "completed"
}
EOF

    echo "$report_file"
}

# 显示汇总统计
show_summary() {
    echo
    log_info "📊 全面架构扫描完成统计:"
    echo "   📁 总文件数: $TOTAL_FILES"
    echo "   🚨 总违规数: $TOTAL_VIOLATIONS"
    
    if [ $TOTAL_VIOLATIONS -gt 0 ]; then
        echo
        log_warning "所有违规已在上方显示"
        
        # 统计P0违规数量
        local p0_count=$(echo "$VIOLATION_REPORT" | grep "^P0:" | wc -l)
        if [ $p0_count -gt 0 ]; then
            echo
            log_warning "🔧 发现 $p0_count 个P0级关键违规，需要优先修复！"
        fi
    fi
}

# 显示帮助信息
show_help() {
    echo "全面架构合规扫描器 - Comprehensive Architecture Scanner"
    echo
    echo "功能: 整合所有P0-P2级架构规则和设计规则检查"
    echo
    echo "用法:"
    echo "  $0 [选项] [文件/目录]"
    echo
    echo "扫描规则:"
    echo "  P0级 - 项目架构红线 (违反立即拒绝):"
    echo "    • 零硬编码原则"
    echo "    • 零静默失败原则"  
    echo "    • 零虚假实现原则"
    echo "    • 严格模块边界"
    echo "    • 零Fallback策略"
    echo
    echo "  P1级 - 开发流程强制要求:"
    echo "    • TypeScript规范"
    echo "    • 错误处理架构"
    echo "    • 接口定义要求"
    echo
    echo "  P2级 - 代码质量和规范:"
    echo "    • 命名约定"
    echo "    • 代码结构"
    echo "    • 性能监控"
    echo "    • Debug系统"
    echo
    echo "示例:"
    echo "  $0                    # 扫描整个项目"
    echo "  $0 src/               # 扫描src目录"
    echo "  $0 src/router/        # 扫描router模块"
}

# 主函数
main() {
    local target_path="$1"
    
    case "$1" in
        -h|--help)
            show_help
            exit 0
            ;;
        "")
            target_path="$PROJECT_ROOT"
            ;;
    esac
    
    log_info "🔍 开始全面架构合规扫描..."
    log_info "📂 扫描目录: ${target_path}"
    log_info "📋 扫描规则: P0-P2级完整架构规则体系"
    echo
    
    if [ -f "$target_path" ]; then
        # 扫描单个文件
        scan_file "$target_path"
    elif [ -d "$target_path" ]; then
        # 扫描目录下所有文件
        while IFS= read -r -d '' file; do
            scan_file "$file"
        done < <(find "$target_path" -type f -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" | grep -v node_modules | sort -z)
    else
        log_error "无效的扫描目标: $target_path"
        exit 1
    fi
    
    # 生成报告和显示统计
    local report_file=$(generate_comprehensive_report)
    show_summary
    
    echo
    log_info "📄 详细报告已保存: $report_file"
    log_info "📋 扫描结果目录: $SCAN_RESULTS_DIR/"
    
    # 根据违规数量确定退出码
    if [ $TOTAL_VIOLATIONS -gt 0 ]; then
        echo
        log_warning "⚠️ 发现代码违规，建议按优先级修复！"
        exit 1
    else
        echo  
        log_success "🎉 所有文件通过全面架构合规检查！"
        exit 0
    fi
}

# 执行主函数
main "$@"