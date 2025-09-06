#!/bin/bash

# RCC v4.0 自动修复脚本
# 用于基于测试对比结果执行自动修复

set -e  # 遇到错误时退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

# 检查服务是否运行
check_service() {
    local port=$1
    local service_name=$2
    
    if curl -s http://localhost:$port/health >/dev/null; then
        log_success "$service_name 服务运行正常"
        return 0
    else
        log_error "$service_name 服务未响应"
        return 1
    fi
}

# 备份当前配置和代码
backup_current_state() {
    log "备份当前状态..."
    
    local backup_dir="./test-results/backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # 备份配置文件
    if [ -f "./config/test-config.json" ]; then
        cp "./config/test-config.json" "$backup_dir/config.json.bak"
    fi
    
    # 备份关键源代码文件
    local modules_dir="./src/modules"
    if [ -d "$modules_dir" ]; then
        cp -r "$modules_dir" "$backup_dir/modules.bak" 2>/dev/null || true
    fi
    
    log_success "当前状态已备份到 $backup_dir"
}

# 分析差异报告
analyze_differences() {
    log "分析差异报告..."
    
    # 获取最新的对比结果
    local comparison_result=$(curl -s http://localhost:5511/api/v1/test/compare/results)
    
    if [ -z "$comparison_result" ] || [ "$comparison_result" = "null" ]; then
        log_error "未找到有效的对比结果"
        return 1
    fi
    
    # 保存对比结果供分析
    echo "$comparison_result" > "./test-results/latest-differences.json"
    
    # 检查是否有显著差异
    local significant_differences=$(echo "$comparison_result" | jq '.differences | length' 2>/dev/null || echo "0")
    
    if [ "$significant_differences" -gt 0 ]; then
        log_warning "发现 $significant_differences 个显著差异"
        return 0
    else
        log_success "未发现显著差异"
        return 1
    fi
}

# 生成修复策略
generate_fix_strategy() {
    log "生成修复策略..."
    
    # 调用修复策略生成API
    local fix_strategy=$(curl -s -X POST http://localhost:5511/api/v1/test/fix/generate \
        -H "Content-Type: application/json" \
        -d '{"autoApply": false}')
    
    if [ -z "$fix_strategy" ] || [ "$fix_strategy" = "null" ]; then
        log_error "修复策略生成失败"
        return 1
    fi
    
    # 保存修复策略
    echo "$fix_strategy" > "./test-results/latest-fix-strategy.json"
    
    # 检查策略数量
    local strategy_count=$(echo "$fix_strategy" | jq '.strategies | length' 2>/dev/null || echo "0")
    
    if [ "$strategy_count" -gt 0 ]; then
        log_success "生成了 $strategy_count 个修复策略"
        return 0
    else
        log_warning "未生成修复策略"
        return 1
    fi
}

# 应用修复策略
apply_fixes() {
    log "应用修复策略..."
    
    # 检查是否存在修复策略
    if [ ! -f "./test-results/latest-fix-strategy.json" ]; then
        log_error "未找到修复策略文件"
        return 1
    fi
    
    # 调用修复应用API
    local apply_result=$(curl -s -X POST http://localhost:5511/api/v1/test/fix/apply \
        -H "Content-Type: application/json" \
        -d '{"strategyFile": "./test-results/latest-fix-strategy.json"}')
    
    if [ -z "$apply_result" ] || [ "$apply_result" = "null" ]; then
        log_error "修复策略应用失败"
        return 1
    fi
    
    # 保存应用结果
    echo "$apply_result" > "./test-results/latest-fix-application.json"
    
    # 检查应用结果
    local success_count=$(echo "$apply_result" | jq '.appliedStrategies' 2>/dev/null || echo "0")
    
    if [ "$success_count" -gt 0 ]; then
        log_success "成功应用了 $success_count 个修复策略"
        return 0
    else
        log_warning "未成功应用任何修复策略"
        return 1
    fi
}

# 验证修复效果
verify_fixes() {
    log "验证修复效果..."
    
    # 重新运行测试
    log "重新运行测试用例..."
    npm run test:basic || log_warning "基本测试失败"
    
    # 重新执行对比
    log "重新执行数据对比..."
    if curl -s -X POST http://localhost:5511/api/v1/test/compare/run \
       -H "Content-Type: application/json" \
       -d '{"sources": ["rcc4", "ccr"]}' >/dev/null; then
        
        # 获取新的对比结果
        local new_comparison=$(curl -s http://localhost:5511/api/v1/test/compare/results)
        echo "$new_comparison" > "./test-results/post-fix-comparison.json"
        
        # 检查差异是否减少
        local old_differences=$(cat "./test-results/latest-differences.json" | jq '.differences | length' 2>/dev/null || echo "0")
        local new_differences=$(echo "$new_comparison" | jq '.differences | length' 2>/dev/null || echo "0")
        
        if [ "$new_differences" -lt "$old_differences" ]; then
            log_success "修复效果验证通过，差异从 $old_differences 减少到 $new_differences"
            return 0
        elif [ "$new_differences" -eq "$old_differences" ]; then
            log_warning "修复后差异数量未变化"
            return 1
        else
            log_warning "修复后差异数量增加 ($new_differences > $old_differences)"
            return 1
        fi
    else
        log_error "重新对比执行失败"
        return 1
    fi
}

# 生成修复报告
generate_fix_report() {
    log "生成修复报告..."
    
    # 获取修复报告
    local fix_report=$(curl -s http://localhost:5511/api/v1/test/fix/report)
    
    if [ -n "$fix_report" ] && [ "$fix_report" != "null" ]; then
        echo "$fix_report" > "./test-results/latest-fix-report.md"
        log_success "修复报告已生成: ./test-results/latest-fix-report.md"
    else
        log_warning "未生成修复报告"
    fi
}

# 显示使用信息
show_usage() {
    echo "使用方法: $0 [选项]"
    echo "选项:"
    echo "  --help, -h        显示此帮助信息"
    echo "  --no-backup       跳过备份步骤"
    echo "  --dry-run         仅生成策略，不实际应用"
    echo "  --verify-only     仅验证修复效果"
    echo ""
    echo "示例:"
    echo "  $0"
    echo "  $0 --dry-run"
    echo "  $0 --verify-only"
}

# 主函数
main() {
    log "========================================="
    log "RCC v4.0 自动修复脚本"
    log "========================================="
    
    # 解析命令行参数
    local no_backup=false
    local dry_run=false
    local verify_only=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_usage
                exit 0
                ;;
            --no-backup)
                no_backup=true
                shift
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            --verify-only)
                verify_only=true
                shift
                ;;
            *)
                log_error "未知参数: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # 检查服务
    check_service 5511 "RCC v4.0" || exit 1
    
    # 如果仅验证，则跳过其他步骤
    if [ "$verify_only" = true ]; then
        verify_fixes
        generate_fix_report
        log_success "修复验证完成"
        exit 0
    fi
    
    # 备份当前状态
    if [ "$no_backup" = false ]; then
        backup_current_state
    else
        log_warning "跳过备份步骤"
    fi
    
    # 分析差异
    if ! analyze_differences; then
        log_warning "未发现需要修复的差异"
        exit 0
    fi
    
    # 生成修复策略
    if ! generate_fix_strategy; then
        log_error "修复策略生成失败"
        exit 1
    fi
    
    # 如果是dry-run，则仅生成策略
    if [ "$dry_run" = true ]; then
        log_success "Dry-run完成，修复策略已生成"
        exit 0
    fi
    
    # 应用修复
    if ! apply_fixes; then
        log_error "修复应用失败"
        exit 1
    fi
    
    # 验证修复效果
    verify_fixes
    
    # 生成修复报告
    generate_fix_report
    
    log_success "自动修复流程完成！"
}

# 执行主函数
main "$@"