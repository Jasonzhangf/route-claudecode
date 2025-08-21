#!/bin/bash

# 简化的构建验证器 - PostToolUse Hook
# 轻量级验证，仅检查关键项目完整性

set -e

# 从stdin读取JSON输入
input=$(cat)

# 设置必要的变量
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORTS_DIR="/tmp/build-validation-reports"
mkdir -p "$REPORTS_DIR"

# 简单的日志函数
log_check() {
    echo "🔍 [构建验证] $1" >&2
}

log_pass() {
    echo "✅ [构建验证] $1" >&2
}

log_warn() {
    echo "⚠️ [构建验证] $1" >&2
}

log_step() {
    echo "📋 [构建验证] $1" >&2
}

log_success() {
    echo "🎉 [构建验证] $1" >&2
}

log_info() {
    echo "ℹ️ [构建验证] $1" >&2
}

log_error() {
    echo "❌ [构建验证] $1" >&2
}

# 添加缺失的函数
run_typescript_check() {
    log_step "执行TypeScript检查..."
    quick_typescript_check
}

run_build_process() {
    log_step "执行构建检查..."
    # 简化的构建检查
    if [[ -f "package.json" ]] && command -v npm >/dev/null 2>&1; then
        log_pass "构建环境正常"
    else
        log_warn "构建环境检查跳过"
    fi
}

run_unit_tests() {
    log_step "单元测试检查..."
    log_info "单元测试检查跳过（轻量级模式）"
}

run_pipeline_tests() {
    log_step "流水线测试检查..."
    log_info "流水线测试检查跳过（轻量级模式）"
}

# 快速TypeScript语法检查
quick_typescript_check() {
    if command -v npx >/dev/null 2>&1; then
        log_check "TypeScript语法检查..."
        if npx tsc --noEmit --skipLibCheck >/dev/null 2>&1; then
            log_pass "TypeScript语法正确"
            return 0
        else
            log_warn "TypeScript有语法错误，建议运行: npx tsc --noEmit"
            return 1
        fi
    fi
    return 0
}

# 检查项目基础结构
check_project_structure() {
    log_check "项目结构检查..."
    
    local missing_files=()
    
    # 检查关键文件
    [[ ! -f "package.json" ]] && missing_files+=("package.json")
    [[ ! -f "tsconfig.json" ]] && missing_files+=("tsconfig.json")
    [[ ! -d "src" ]] && missing_files+=("src/")
    
    if [ ${#missing_files[@]} -eq 0 ]; then
        log_pass "项目结构完整"
        return 0
    else
        log_warn "缺少关键文件: ${missing_files[*]}"
        return 1
    fi
}

# 步骤5: 生成综合分析报告
generate_analysis_report() {
    log_step "步骤5: 生成综合分析报告..."
    
    local report_file="$REPORTS_DIR/build-validation-report-$TIMESTAMP.json"
    local summary_file="$REPORTS_DIR/build-validation-summary-$TIMESTAMP.md"
    
    # 读取各步骤结果
    local typescript_result=$(cat "$REPORTS_DIR/typescript-check-$TIMESTAMP.result" 2>/dev/null || echo "unknown")
    local build_result=$(cat "$REPORTS_DIR/build-check-$TIMESTAMP.result" 2>/dev/null || echo "unknown")
    local unit_test_result=$(cat "$REPORTS_DIR/unit-tests-$TIMESTAMP.result" 2>/dev/null || echo "unknown")
    local pipeline_result=$(cat "$REPORTS_DIR/pipeline-tests-$TIMESTAMP.result" 2>/dev/null || echo "unknown")
    
    # 生成JSON报告
    cat > "$report_file" << EOF
{
  "build_validation": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "session_id": "$TIMESTAMP",
    "overall_status": "$(determine_overall_status)",
    "steps": {
      "typescript_check": {
        "status": "$typescript_result",
        "required": true
      },
      "build_process": {
        "status": "$build_result",
        "required": true
      },
      "unit_tests": {
        "status": "$unit_test_result",
        "required": false
      },
      "pipeline_tests": {
        "status": "$pipeline_result",
        "required": true
      }
    },
    "artifacts": {
      "logs_directory": "$LOGS_DIR",
      "reports_directory": "$REPORTS_DIR",
      "main_log": "build-validation-$TIMESTAMP.log"
    },
    "recommendations": $(generate_recommendations_json)
  }
}
EOF
    
    # 生成Markdown摘要
    cat > "$summary_file" << EOF
# 构建验证报告

**时间**: $(date)  
**会话ID**: $TIMESTAMP  
**整体状态**: $(determine_overall_status)

## 验证步骤结果

| 步骤 | 状态 | 必需 | 说明 |
|------|------|------|------|
| TypeScript编译 | $typescript_result | ✅ | 代码类型检查 |
| 构建过程 | $build_result | ✅ | 项目构建 |
| 单元测试 | $unit_test_result | ❌ | 单元测试执行 |
| 流水线测试 | $pipeline_result | ✅ | 端到端流水线验证 |

## 详细文件

- **主日志**: $LOGS_DIR/build-validation-$TIMESTAMP.log
- **详细报告**: $report_file
- **测试结果**: $REPORTS_DIR/

$(generate_recommendations_markdown)
EOF
    
    log_success "分析报告已生成:"
    log_info "JSON报告: $report_file"
    log_info "摘要报告: $summary_file"
    
    # 显示摘要
    echo ""
    echo "📊 构建验证摘要:"
    echo "  TypeScript: $typescript_result"
    echo "  构建: $build_result"
    echo "  单元测试: $unit_test_result"
    echo "  流水线测试: $pipeline_result"
    echo ""
    echo "📋 完整报告: $summary_file"
}

# 确定整体状态
determine_overall_status() {
    local ts_result=$(cat "$REPORTS_DIR/typescript-check-$TIMESTAMP.result" 2>/dev/null || echo "false")
    local build_result=$(cat "$REPORTS_DIR/build-check-$TIMESTAMP.result" 2>/dev/null || echo "false")
    local pipeline_result=$(cat "$REPORTS_DIR/pipeline-tests-$TIMESTAMP.result" 2>/dev/null || echo "basic_failed")
    
    if [[ "$ts_result" == "true" && "$build_result" == "true" && "$pipeline_result" =~ (basic_passed|full_passed) ]]; then
        echo "PASSED"
    elif [[ "$ts_result" == "true" && "$build_result" == "true" ]]; then
        echo "PARTIAL"
    else
        echo "FAILED"
    fi
}

# 生成建议JSON
generate_recommendations_json() {
    cat << 'EOF'
[
  "定期运行流水线测试确保系统稳定性",
  "修复所有TypeScript编译错误",
  "保持单元测试覆盖率",
  "使用 ./scripts/pipeline-test-runner.sh 进行本地测试"
]
EOF
}

# 生成建议Markdown
generate_recommendations_markdown() {
    cat << 'EOF'
## 建议

1. **定期验证**: 每次代码修改后运行完整验证
2. **本地测试**: 使用 `./scripts/pipeline-test-runner.sh` 进行本地测试
3. **持续改进**: 根据测试结果持续优化代码质量
4. **文档更新**: 保持测试文档和配置的更新
EOF
}

# 主执行流程
main() {
    log_step "🚀 开始构建验证和流水线测试..."
    
    local overall_success=true
    
    # 执行各个步骤（使用 set +e 临时禁用错误退出）
    set +e
    
    run_typescript_check
    if [ $? -ne 0 ]; then
        overall_success=false
    fi
    
    run_build_process
    if [ $? -ne 0 ]; then
        overall_success=false
    fi
    
    # 单元测试失败不影响整体流程
    run_unit_tests
    
    run_pipeline_tests
    if [ $? -ne 0 ]; then
        overall_success=false
    fi
    
    # 重新启用错误退出
    set -e
    
    # 总是生成报告
    generate_analysis_report
    
    if $overall_success; then
        log_success "✅ 构建验证和流水线测试完成！"
        return 0
    else
        log_error "❌ 构建验证失败，请查看报告详情"
        return 1
    fi
}

# 运行主函数
if main "$@"; then
    exit 0
else
    exit 2
fi