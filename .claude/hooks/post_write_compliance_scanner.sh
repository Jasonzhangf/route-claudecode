#!/bin/bash

# 后写入合规扫描器 - Post-Write Compliance Scanner
# 在文件写入/编辑操作完成后进行P0级违规扫描和审查

VIOLATION_FOUND=false
VIOLATION_MESSAGES=()
SCAN_RESULTS_DIR=".claude/scan-results"

# 创建扫描结果目录
mkdir -p "$SCAN_RESULTS_DIR"

# 记录扫描日志
log_scan_result() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local log_file="$SCAN_RESULTS_DIR/compliance-scan.log"
    echo "[$timestamp] $*" >> "$log_file"
}

# 检查虚假实现违规
check_unreal_implementation_violations() {
    local file_content="$1"
    local file_path="$2"
    
    # P0 虚假实现违规模式检测 - 使用编码检查避免触发
    local test_patterns=()
    test_patterns+=("jest\.fn")
    test_patterns+=("sinon\.")
    test_patterns+=("spyOn")
    test_patterns+=("return.*test")
    test_patterns+=("placeholder.*response")
    test_patterns+=("虚假")
    test_patterns+=("模拟")
    
    for pattern in "${test_patterns[@]}"; do
        if echo "$file_content" | grep -qiE "$pattern"; then
            # 排除正常的测试文件
            if [[ ! "$file_path" =~ \.(test|spec)\. ]]; then
                VIOLATION_FOUND=true
                VIOLATION_MESSAGES+=("UNREAL-IMPL: 在 $file_path 中发现虚假实现: $pattern")
                log_scan_result "虚假实现违规: $file_path -> $pattern"
            fi
        fi
    done
}

# 检查fallback违规
check_fallback_violations() {
    local file_content="$1"
    local file_path="$2"
    
    # P0 Fallback违规模式检测
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
        "FallbackStrategy"
        "FallbackResolver"
        "FallbackManager"
        "BackwardCompatibility"
        "DefaultsForBackward"
        "loadDefaults.*Compatibility"
    )
    
    for pattern in "${fallback_patterns[@]}"; do
        if echo "$file_content" | grep -qiE "$pattern" && ! echo "$file_content" | grep -qE "@deprecated.*$pattern"; then
            VIOLATION_FOUND=true
            VIOLATION_MESSAGES+=("FALLBACK-VIOLATION: 在 $file_path 中发现Fallback机制: $pattern")
            log_scan_result "FALLBACK违规: $file_path -> $pattern"
        fi
    done
    
    # 检查注释中的fallback描述
    if echo "$file_content" | grep -qiE "//.*fallback|//.*备用|//.*兜底"; then
        VIOLATION_FOUND=true
        VIOLATION_MESSAGES+=("FALLBACK-COMMENT: 在 $file_path 中发现注释中的Fallback描述")
        log_scan_result "FALLBACK注释违规: $file_path"
    fi
}

# 检查硬编码违规
check_hardcoding_violations() {
    local file_content="$1"
    local file_path="$2"
    
    # P0 硬编码模式检测
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
            VIOLATION_FOUND=true
            VIOLATION_MESSAGES+=("HARDCODING: 在 $file_path 中发现硬编码: $pattern")
            log_scan_result "硬编码违规: $file_path -> $pattern"
        fi
    done
}

# 检查静默失败违规
check_silent_failure_violations() {
    local file_content="$1"
    local file_path="$2"
    
    # P0 静默失败模式检测
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
            VIOLATION_FOUND=true
            VIOLATION_MESSAGES+=("SILENT-FAILURE: 在 $file_path 中发现静默失败: $pattern")
            log_scan_result "静默失败违规: $file_path -> $pattern"
        fi
    done
}

# 执行完整扫描
perform_comprehensive_scan() {
    local file_path="$1"
    local file_content="$2"
    
    echo "🔍 [合规扫描器] 扫描文件: $file_path" >&2
    log_scan_result "开始扫描: $file_path"
    
    # 跳过非代码文件和编译产物
    if [[ "$file_path" =~ \.(md|json|yml|yaml|txt|log)$ ]] || 
       [[ "$file_path" =~ ^(dist|node_modules|\.git)/ ]]; then
        echo "✅ [合规扫描器] 跳过非代码文件: $file_path" >&2
        log_scan_result "跳过文件: $file_path (非代码文件)"
        return 0
    fi
    
    # 执行所有违规检查
    check_unreal_implementation_violations "$file_content" "$file_path"
    check_fallback_violations "$file_content" "$file_path" 
    check_hardcoding_violations "$file_content" "$file_path"
    check_silent_failure_violations "$file_content" "$file_path"
}

# 生成扫描报告
generate_scan_report() {
    local report_file="$SCAN_RESULTS_DIR/scan-report-$(date '+%Y%m%d-%H%M%S').json"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    cat > "$report_file" << EOF
{
  "timestamp": "$timestamp",
  "scanned_file": "$1",
  "violations_found": $VIOLATION_FOUND,
  "violation_count": ${#VIOLATION_MESSAGES[@]},
  "violations": [
EOF

    # 添加违规详情
    for i in "${!VIOLATION_MESSAGES[@]}"; do
        local msg="${VIOLATION_MESSAGES[$i]}"
        echo "    \"$msg\"" >> "$report_file"
        if [ $i -lt $((${#VIOLATION_MESSAGES[@]} - 1)) ]; then
            echo "," >> "$report_file"
        fi
    done

    cat >> "$report_file" << EOF
  ],
  "scan_status": "completed"
}
EOF

    echo "$report_file"
}

# Hook主入口
main() {
    local file_path="$1"
    local file_content="$2"
    
    if [ -z "$file_path" ] || [ -z "$file_content" ]; then
        echo "❌ [合规扫描器] Hook参数错误" >&2
        log_scan_result "参数错误: 缺少文件路径或内容"
        exit 2
    fi
    
    # 执行完整合规扫描
    perform_comprehensive_scan "$file_path" "$file_content"
    
    # 生成扫描报告
    local report_file=$(generate_scan_report "$file_path")
    
    # 检查是否发现违规
    if [ "$VIOLATION_FOUND" = true ]; then
        echo ""
        echo "🚨 [合规扫描器] 检测到代码违规，需要立即修复！" >&2
        echo ""
        echo "违规文件: $file_path" >&2
        echo "违规数量: ${#VIOLATION_MESSAGES[@]}" >&2
        echo ""
        echo "违规详情:" >&2
        for message in "${VIOLATION_MESSAGES[@]}"; do
            echo "  ❌ $message" >&2
        done
        echo ""
        echo "📋 扫描报告已保存: $report_file" >&2
        echo ""
        echo "📚 修复指南:" >&2
        echo "  1. 移除所有虚假/测试/占位代码，使用真实数据" >&2
        echo "  2. 删除所有fallback/备用/兜底机制" >&2  
        echo "  3. 使用配置文件替代硬编码值" >&2
        echo "  4. 通过ErrorHandler处理所有错误，不静默失败" >&2
        echo "  5. 查阅 .claude/rules/ 了解完整规则" >&2
        echo ""
        echo "⚠️ 必须修复所有违规才能继续开发工作！" >&2
        
        log_scan_result "扫描完成: $file_path - 发现 ${#VIOLATION_MESSAGES[@]} 个违规"
        exit 2
    fi
    
    echo "✅ [合规扫描器] 合规检查通过，无违规发现" >&2
    log_scan_result "扫描完成: $file_path - 无违规"
    return 0
}

# 调用主函数
main "$@"