#!/bin/bash

# TypeScript-Only 合规监控系统
# 定期监控项目合规状态并生成报告

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
MONITOR_LOG="$PROJECT_ROOT/.claude/rules/compliance-monitor.log"
REPORTS_DIR="$PROJECT_ROOT/.claude/rules/reports"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 创建报告目录
mkdir -p "$REPORTS_DIR"

# 日志函数
log_with_timestamp() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$MONITOR_LOG"
}

# 运行合规检查
run_compliance_check() {
    log_with_timestamp "开始定期合规检查..."
    
    cd "$PROJECT_ROOT"
    
    # 运行自动化合规检查
    if bash "$SCRIPT_DIR/automated-compliance-check.sh"; then
        local status="PASS"
        log_with_timestamp "✅ 合规检查通过"
    else
        local status="FAIL"
        log_with_timestamp "❌ 合规检查失败"
    fi
    
    # 复制报告到监控目录
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local report_file="$REPORTS_DIR/compliance-report-$timestamp.json"
    
    if [ -f "$PROJECT_ROOT/typescript-compliance-report.json" ]; then
        cp "$PROJECT_ROOT/typescript-compliance-report.json" "$report_file"
        log_with_timestamp "报告已保存: $report_file"
    fi
    
    return $?
}

# 分析合规趋势
analyze_compliance_trend() {
    log_with_timestamp "分析合规趋势..."
    
    local recent_reports=$(ls -t "$REPORTS_DIR"/compliance-report-*.json 2>/dev/null | head -10)
    
    if [ -z "$recent_reports" ]; then
        log_with_timestamp "没有足够的历史报告进行趋势分析"
        return
    fi
    
    local trend_file="$REPORTS_DIR/compliance-trend-$(date '+%Y%m%d').json"
    
    echo "{" > "$trend_file"
    echo "  \"analysis_date\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"," >> "$trend_file"
    echo "  \"reports_analyzed\": [" >> "$trend_file"
    
    local first=true
    for report in $recent_reports; do
        if [ "$first" = true ]; then
            first=false
        else
            echo "," >> "$trend_file"
        fi
        
        echo -n "    " >> "$trend_file"
        cat "$report" | jq -c '{timestamp: .timestamp, status: .overall_status, score: .compliance_score}' >> "$trend_file"
    done
    
    echo "  ]" >> "$trend_file"
    echo "}" >> "$trend_file"
    
    log_with_timestamp "趋势分析已保存: $trend_file"
}

# 检查特定违规模式
check_violation_patterns() {
    log_with_timestamp "检查常见违规模式..."
    
    cd "$PROJECT_ROOT"
    
    local violations=0
    
    # 检查1: JavaScript文件创建
    local js_files=$(find src -name "*.js" 2>/dev/null | wc -l)
    if [ $js_files -gt 0 ]; then
        log_with_timestamp "⚠️  发现 $js_files 个JavaScript文件在src目录"
        violations=$((violations + 1))
    fi
    
    # 检查2: dist目录修改
    if git status --porcelain | grep -q "^.M dist/"; then
        log_with_timestamp "⚠️  检测到dist目录有未提交的修改"
        violations=$((violations + 1))
    fi
    
    # 检查3: any类型过度使用
    local any_usage=$(grep -r ": any\|<any>\|any\[\]" src/ --include="*.ts" 2>/dev/null | wc -l || echo "0")
    if [ $any_usage -gt 10 ]; then
        log_with_timestamp "⚠️  any类型使用过多: $any_usage 处"
        violations=$((violations + 1))
    fi
    
    # 检查4: TypeScript编译错误
    if ! npm run build > /dev/null 2>&1; then
        log_with_timestamp "⚠️  TypeScript编译失败"
        violations=$((violations + 1))
    fi
    
    log_with_timestamp "违规模式检查完成，发现 $violations 个潜在问题"
    return $violations
}

# 生成监控摘要
generate_monitoring_summary() {
    log_with_timestamp "生成监控摘要..."
    
    local summary_file="$REPORTS_DIR/monitoring-summary-$(date '+%Y%m%d').md"
    
    cat > "$summary_file" << EOF
# TypeScript-Only 合规监控日报

**日期**: $(date '+%Y-%m-%d')
**时间**: $(date '+%H:%M:%S')

## 📊 合规状态概览

EOF
    
    # 读取最新的合规报告
    local latest_report=$(ls -t "$REPORTS_DIR"/compliance-report-*.json 2>/dev/null | head -1)
    
    if [ -f "$latest_report" ]; then
        local overall_status=$(cat "$latest_report" | jq -r '.overall_status')
        local compliance_score=$(cat "$latest_report" | jq -r '.compliance_score')
        local passed_checks=$(cat "$latest_report" | jq -r '.summary.passed')
        local failed_checks=$(cat "$latest_report" | jq -r '.summary.failed')
        local warnings=$(cat "$latest_report" | jq -r '.summary.warnings')
        
        cat >> "$summary_file" << EOF
- **总体状态**: $overall_status
- **合规得分**: $compliance_score%
- **通过检查**: $passed_checks
- **失败检查**: $failed_checks  
- **警告数量**: $warnings

## 🔍 详细检查结果

EOF
        
        # 提取失败的检查项
        local failed_checks_details=$(cat "$latest_report" | jq -r '.checks[] | select(.status == "fail") | "- **" + .name + "**: " + .details')
        
        if [ ! -z "$failed_checks_details" ]; then
            echo "### ❌ 失败的检查项" >> "$summary_file"
            echo "$failed_checks_details" >> "$summary_file"
            echo "" >> "$summary_file"
        fi
        
        # 提取警告项
        local warning_checks=$(cat "$latest_report" | jq -r '.checks[] | select(.status == "warning") | "- **" + .name + "**: " + .details')
        
        if [ ! -z "$warning_checks" ]; then
            echo "### ⚠️  警告项" >> "$summary_file"
            echo "$warning_checks" >> "$summary_file"
            echo "" >> "$summary_file"
        fi
    else
        echo "无法找到最新的合规报告" >> "$summary_file"
    fi
    
    cat >> "$summary_file" << EOF

## 📈 建议行动

1. **立即处理**: 修复所有失败的检查项
2. **持续改进**: 处理警告项以提高代码质量
3. **监控趋势**: 关注合规得分变化趋势
4. **定期审查**: 每周审查TypeScript配置和规则

---

*此报告由TypeScript-Only合规监控系统自动生成*
EOF
    
    log_with_timestamp "监控摘要已生成: $summary_file"
}

# 发送通知 (可扩展)
send_notification() {
    local status="$1"
    local score="$2"
    
    log_with_timestamp "准备发送通知 (状态: $status, 得分: $score%)"
    
    # 这里可以添加邮件通知、Slack通知等
    # 目前只记录日志
    
    if [ "$status" = "fail" ]; then
        log_with_timestamp "🚨 合规检查失败通知已准备"
    elif [ "$score" -lt 90 ]; then
        log_with_timestamp "⚠️  合规得分较低通知已准备"
    else
        log_with_timestamp "✅ 合规状态良好"
    fi
}

# 清理旧报告
cleanup_old_reports() {
    log_with_timestamp "清理旧报告..."
    
    # 保留最近30天的报告
    find "$REPORTS_DIR" -name "compliance-report-*.json" -mtime +30 -delete 2>/dev/null || true
    find "$REPORTS_DIR" -name "monitoring-summary-*.md" -mtime +30 -delete 2>/dev/null || true
    find "$REPORTS_DIR" -name "compliance-trend-*.json" -mtime +7 -delete 2>/dev/null || true
    
    log_with_timestamp "旧报告清理完成"
}

# 主执行函数
main() {
    local mode="${1:-monitor}"
    
    case "$mode" in
        "monitor")
            echo -e "${BLUE}🔍 执行定期合规监控${NC}"
            
            # 运行合规检查
            if run_compliance_check; then
                local status="pass"
                local score=$(cat "$PROJECT_ROOT/typescript-compliance-report.json" 2>/dev/null | jq -r '.compliance_score' || echo "0")
            else
                local status="fail"
                local score="0"
            fi
            
            # 分析趋势
            analyze_compliance_trend
            
            # 检查违规模式
            check_violation_patterns
            
            # 生成摘要
            generate_monitoring_summary
            
            # 发送通知
            send_notification "$status" "$score"
            
            # 清理旧报告
            cleanup_old_reports
            
            log_with_timestamp "定期监控完成"
            ;;
            
        "quick")
            echo -e "${YELLOW}⚡ 执行快速合规检查${NC}"
            run_compliance_check
            ;;
            
        "trend")
            echo -e "${PURPLE}📈 生成趋势分析${NC}"
            analyze_compliance_trend
            ;;
            
        "summary")
            echo -e "${GREEN}📋 生成监控摘要${NC}"
            generate_monitoring_summary
            ;;
            
        *)
            echo "用法: $0 [monitor|quick|trend|summary]"
            echo "  monitor  - 完整监控 (默认)"
            echo "  quick    - 快速检查"
            echo "  trend    - 趋势分析"
            echo "  summary  - 生成摘要"
            exit 1
            ;;
    esac
}

# 设置定时任务函数
setup_cron_job() {
    echo "设置定时监控任务..."
    
    # 检查是否已有定时任务
    if crontab -l 2>/dev/null | grep -q "typescript-compliance"; then
        echo "定时任务已存在"
        return
    fi
    
    # 添加定时任务 (每天早上9点执行)
    (crontab -l 2>/dev/null; echo "0 9 * * * cd $PROJECT_ROOT && bash $SCRIPT_DIR/compliance-monitor.sh monitor >> $MONITOR_LOG 2>&1") | crontab -
    
    echo "定时任务已设置：每天早上9点执行合规检查"
}

# 如果作为脚本直接运行
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi