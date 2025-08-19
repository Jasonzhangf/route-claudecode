#!/bin/bash

# 全文件合规扫描工具 - Full File Compliance Scanner
# 扫描整个文件的完整内容，检查P0级违规
# 与pre_write检查不同：此工具扫描整个文件，pre_write只检查编辑的内容

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCAN_RESULTS_DIR="$PROJECT_ROOT/.claude/scan-results"

# 创建扫描结果目录
mkdir -p "$SCAN_RESULTS_DIR"

# 初始化扫描状态
TOTAL_FILES=0
VIOLATIONS_FOUND=0
CLEAN_FILES=0

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

# 扫描单个文件
scan_single_file() {
    local file_path="$1"
    local relative_path="${file_path#$PROJECT_ROOT/}"
    
    # 跳过非代码文件
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
    
    local file_violations=()
    
    # === P0 违规检查 ===
    
    # 1. Fallback机制检查
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
    )
    
    for pattern in "${fallback_patterns[@]}"; do
        if echo "$file_content" | grep -qiE "$pattern" && ! echo "$file_content" | grep -qE "@deprecated.*$pattern|DEPRECATED.*$pattern"; then
            file_violations+=("FALLBACK: 发现$pattern模式")
        fi
    done
    
    # 检查注释中的fallback描述
    if echo "$file_content" | grep -qiE "//.*fallback|//.*备用|//.*兜底|作为.*fallback|作为.*备用|作为.*兜底"; then
        file_violations+=("FALLBACK-COMMENT: 注释中包含fallback描述")
    fi
    
    # 2. 硬编码检查
    local hardcode_patterns=(
        "api\.openai\.com"
        "api\.anthropic\.com"
        "localhost:[0-9]+"
        "127\.0\.0\.1:[0-9]+"
        "sk-[a-zA-Z0-9]+"
        "claude-3"
        "gpt-4"
        "gpt-3\.5"
        "3456"
        "5506"
        "8080"
        "3000"
    )
    
    for pattern in "${hardcode_patterns[@]}"; do
        if echo "$file_content" | grep -qE "$pattern"; then
            file_violations+=("HARDCODING: 发现硬编码$pattern")
        fi
    done
    
    # 3. 虚假实现检查 (排除测试文件)
    if [[ ! "$relative_path" =~ \.(test|spec)\. ]]; then
        local unreal_patterns=(
            "jest\.fn"
            "sinon\."
            "spyOn"
            "return.*{.*test.*}"
            "return.*{.*success.*:.*true.*}"
            "placeholder.*response"
            "虚假"
            "模拟"
            "假数据"
        )
        
        for pattern in "${unreal_patterns[@]}"; do
            if echo "$file_content" | grep -qiE "$pattern"; then
                file_violations+=("UNREAL-IMPL: 发现虚假实现$pattern")
            fi
        done
    fi
    
    # 4. 静默失败检查
    local silent_patterns=(
        "catch\s*\([^)]*\)\s*{\s*}"
        "catch\s*\([^)]*\)\s*{\s*console\.log"
        "catch\s*\([^)]*\)\s*{\s*return"
        "\|\|\s*{}"
        "\.catch\(\(\)\s*=>\s*{\s*}\)"
        "\.catch\(\(\)\s*=>\s*null\)"
    )
    
    for pattern in "${silent_patterns[@]}"; do
        if echo "$file_content" | grep -qE "$pattern"; then
            file_violations+=("SILENT-FAILURE: 发现静默失败$pattern")
        fi
    done
    
    # 输出扫描结果
    if [ ${#file_violations[@]} -eq 0 ]; then
        log_success "✅ $relative_path - 无违规"
        CLEAN_FILES=$((CLEAN_FILES + 1))
    else
        log_error "❌ $relative_path - 发现 ${#file_violations[@]} 个违规:"
        for violation in "${file_violations[@]}"; do
            echo "    • $violation"
        done
        VIOLATIONS_FOUND=$((VIOLATIONS_FOUND + 1))
        
        # 保存详细违规报告
        save_violation_report "$relative_path" "${file_violations[@]}"
    fi
}

# 保存违规报告
save_violation_report() {
    local file_path="$1"
    shift
    local violations=("$@")
    
    local report_file="$SCAN_RESULTS_DIR/violation-$(basename "$file_path")-$(date '+%Y%m%d-%H%M%S').json"
    
    cat > "$report_file" << EOF
{
  "timestamp": "$(date '+%Y-%m-%d %H:%M:%S')",
  "file_path": "$file_path",
  "violation_count": ${#violations[@]},
  "violations": [
EOF

    for i in "${!violations[@]}"; do
        echo "    \"${violations[$i]}\"" >> "$report_file"
        if [ $i -lt $((${#violations[@]} - 1)) ]; then
            echo "," >> "$report_file"
        fi
    done

    cat >> "$report_file" << EOF
  ],
  "scan_type": "full_file",
  "status": "violation_detected"
}
EOF
}

# 生成汇总报告
generate_summary_report() {
    local summary_file="$SCAN_RESULTS_DIR/scan-summary-$(date '+%Y%m%d-%H%M%S').json"
    
    cat > "$summary_file" << EOF
{
  "timestamp": "$(date '+%Y-%m-%d %H:%M:%S')",
  "scan_type": "full_project_scan",
  "statistics": {
    "total_files_scanned": $TOTAL_FILES,
    "files_with_violations": $VIOLATIONS_FOUND,
    "clean_files": $CLEAN_FILES,
    "violation_rate": "$(echo "scale=2; $VIOLATIONS_FOUND * 100 / $TOTAL_FILES" | bc -l)%"
  },
  "scan_status": "completed"
}
EOF
    
    echo "$summary_file"
}

# 主扫描函数
main() {
    local target_path="$1"
    
    log_info "🔍 开始全文件合规扫描..."
    log_info "📂 扫描目录: ${target_path:-$PROJECT_ROOT}"
    log_info "📋 扫描规则: P0级架构红线 (Fallback/硬编码/虚假实现/静默失败)"
    echo
    
    if [ -n "$target_path" ] && [ -f "$target_path" ]; then
        # 扫描单个文件
        scan_single_file "$target_path"
    elif [ -d "${target_path:-$PROJECT_ROOT}" ]; then
        # 扫描目录下所有文件
        local scan_dir="${target_path:-$PROJECT_ROOT}"
        while IFS= read -r -d '' file; do
            scan_single_file "$file"
        done < <(find "$scan_dir" -type f -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" | grep -v node_modules | sort -z)
    else
        log_error "无效的扫描目标: ${target_path:-$PROJECT_ROOT}"
        exit 1
    fi
    
    echo
    log_info "📊 扫描完成统计:"
    echo "   📁 总文件数: $TOTAL_FILES"
    echo "   ✅ 清洁文件: $CLEAN_FILES"  
    echo "   ❌ 违规文件: $VIOLATIONS_FOUND"
    
    if [ $VIOLATIONS_FOUND -gt 0 ]; then
        echo "   📈 违规比例: $(echo "scale=2; $VIOLATIONS_FOUND * 100 / $TOTAL_FILES" | bc -l)%"
        echo
        log_warning "⚠️ 发现代码违规，需要立即修复！"
        log_info "📋 详细报告已保存到: $SCAN_RESULTS_DIR/"
        
        # 生成汇总报告
        local summary_report=$(generate_summary_report)
        log_info "📄 汇总报告: $summary_report"
        
        exit 1
    else
        log_success "🎉 所有文件通过合规检查！"
        
        # 生成汇总报告
        local summary_report=$(generate_summary_report)
        log_info "📄 汇总报告: $summary_report"
        
        exit 0
    fi
}

# 显示帮助信息
show_help() {
    echo "全文件合规扫描工具 - Full File Compliance Scanner"
    echo
    echo "用法:"
    echo "  $0 [选项] [文件/目录]"
    echo
    echo "选项:"
    echo "  -h, --help     显示此帮助信息"
    echo "  文件路径       扫描指定文件"
    echo "  目录路径       扫描指定目录下所有代码文件"
    echo "  无参数         扫描整个项目"
    echo
    echo "扫描范围:"
    echo "  • TypeScript/JavaScript文件 (.ts, .js, .tsx, .jsx)"
    echo "  • 排除 dist/, node_modules/, .git/ 目录"
    echo "  • 排除 .md, .json, .yml 等非代码文件"
    echo
    echo "检查规则:"
    echo "  • P0-FALLBACK: 检查所有fallback/备用/兜底机制"
    echo "  • P0-HARDCODING: 检查硬编码URL、端口、API密钥等"
    echo "  • P0-UNREAL-IMPL: 检查虚假实现（排除测试文件）"  
    echo "  • P0-SILENT-FAILURE: 检查静默失败处理"
    echo
    echo "示例:"
    echo "  $0                                    # 扫描整个项目"
    echo "  $0 src/modules/                       # 扫描modules目录"
    echo "  $0 src/router/router.ts               # 扫描单个文件"
}

# 处理命令行参数
case "$1" in
    -h|--help)
        show_help
        exit 0
        ;;
    "")
        main
        ;;
    *)
        main "$1"
        ;;
esac