#!/bin/bash

# 🧹 Claude Code Router 测试环境清理脚本 v1.0
# 恢复版本覆盖和测试环境

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[CLEANUP]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[CLEANUP]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[CLEANUP]${NC} $1"
}

log_error() {
    echo -e "${RED}[CLEANUP]${NC} $1"
}

# 显示脚本信息
show_info() {
    echo "🧹 Claude Code Router 测试环境清理"
    echo "===================================="
    echo "执行时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
}

# 检查版本覆盖状态
check_version_override() {
    if [[ ! -f ".test-version-override" ]]; then
        log_info "未发现版本覆盖，无需清理"
        return 1
    fi
    
    log_info "发现版本覆盖配置，准备清理"
    echo ""
    echo "覆盖配置内容:"
    cat .test-version-override | grep -E "USING_GLOBAL_VERSION|BACKUP_CREATED|ORIGINAL_LOCAL_VERSION" | sed 's/^/  /'
    echo ""
    return 0
}

# 恢复 node_modules
restore_node_modules() {
    log_info "检查 node_modules 备份"
    
    # 查找最新的备份
    local backup_dir
    backup_dir=$(ls -t node_modules.backup.* 2>/dev/null | head -1)
    
    if [[ -n "$backup_dir" && -d "$backup_dir" ]]; then
        log_info "找到备份: $backup_dir"
        
        # 删除当前的 node_modules (如果存在)
        if [[ -d "node_modules" ]]; then
            log_warning "删除当前 node_modules (全局版本)"
            rm -rf node_modules
        fi
        
        # 恢复备份
        mv "$backup_dir" node_modules
        log_success "✅ 已恢复本地 node_modules"
        
        # 清理其他备份
        local other_backups
        other_backups=$(ls node_modules.backup.* 2>/dev/null || true)
        if [[ -n "$other_backups" ]]; then
            log_info "清理其他备份文件"
            rm -rf node_modules.backup.*
            log_success "已清理其他备份"
        fi
    else
        log_warning "⚠️  未找到 node_modules 备份"
        echo ""
        echo "可能原因:"
        echo "- 版本切换时本地没有 node_modules"
        echo "- 备份文件已被手动删除"
        echo ""
        echo "建议操作:"
        echo "  npm install  # 重新安装本地依赖"
    fi
}

# 清理版本覆盖标记
cleanup_version_override() {
    if [[ -f ".test-version-override" ]]; then
        # 显示覆盖信息
        local override_version
        override_version=$(grep "USING_GLOBAL_VERSION=" .test-version-override | cut -d'=' -f2 2>/dev/null || echo "unknown")
        
        log_info "清理版本覆盖标记"
        echo "覆盖版本: v$override_version"
        
        # 备份覆盖文件到日志目录
        local log_dir="~/.route-claude-code/logs"
        mkdir -p "$log_dir"
        cp .test-version-override "$log_dir/version-override-$(date +%Y%m%d-%H%M%S).log"
        
        # 删除覆盖标记
        rm -f .test-version-override
        log_success "✅ 版本覆盖标记已清理"
    fi
}

# 验证环境恢复
verify_recovery() {
    log_info "验证环境恢复状态"
    
    # 检查本地版本
    if [[ -f "package.json" ]]; then
        local local_version
        local_version=$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "unknown")
        log_info "本地版本: v$local_version"
    fi
    
    # 检查 node_modules
    if [[ -d "node_modules" ]]; then
        log_success "✅ node_modules 存在"
    else
        log_warning "⚠️  node_modules 不存在，可能需要重新安装"
    fi
    
    # 检查版本覆盖状态
    if [[ ! -f ".test-version-override" ]]; then
        log_success "✅ 版本覆盖已清理"
    else
        log_warning "⚠️  版本覆盖标记仍存在"
    fi
    
    echo ""
    log_success "环境恢复验证完成"
}

# 清理测试临时文件
cleanup_test_artifacts() {
    log_info "清理测试临时文件"
    
    local cleanup_patterns=(
        ".test-version-override"
        "node_modules.backup.*"
        "*.backup.*"
        ".npm/_logs/*"
    )
    
    local cleaned=0
    for pattern in "${cleanup_patterns[@]}"; do
        if ls $pattern 1>/dev/null 2>&1; then
            rm -rf $pattern
            ((cleaned++))
        fi
    done
    
    if [[ $cleaned -gt 0 ]]; then
        log_success "已清理 $cleaned 类临时文件"
    else
        log_info "未找到需要清理的临时文件"
    fi
}

# 显示环境状态
show_environment_status() {
    echo ""
    echo "🔍 当前环境状态"
    echo "===================="
    
    # 本地版本
    if [[ -f "package.json" ]]; then
        local local_version
        local_version=$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "读取失败")
        echo "本地版本: v$local_version"
    else
        echo "本地版本: package.json 不存在"
    fi
    
    # 全局版本
    local global_version
    global_version=$(npm list -g route-claudecode --depth=0 2>/dev/null | grep route-claudecode | cut -d'@' -f2 || echo "未安装")
    echo "全局版本: v$global_version"
    
    # node_modules 状态
    if [[ -d "node_modules" ]]; then
        echo "node_modules: ✅ 存在"
    else
        echo "node_modules: ❌ 不存在"
    fi
    
    # 版本覆盖状态
    if [[ -f ".test-version-override" ]]; then
        echo "版本覆盖: ⚠️  活跃中"
    else
        echo "版本覆盖: ✅ 已清理"
    fi
    
    echo ""
}

# 显示帮助信息
show_help() {
    echo "🧹 Claude Code Router 测试环境清理工具"
    echo ""
    echo "用法:"
    echo "  $0                    执行完整环境清理（默认）"
    echo "  $0 --cleanup          执行完整环境清理"
    echo "  $0 --status           显示当前环境状态"
    echo "  $0 --verify           仅验证环境状态"
    echo "  $0 --help             显示帮助信息"
    echo ""
    echo "清理内容:"
    echo "  - 恢复本地 node_modules"
    echo "  - 清理版本覆盖标记"
    echo "  - 清理测试临时文件"
    echo "  - 验证环境恢复状态"
    echo ""
    echo "注意事项:"
    echo "  - 请在测试完成后执行清理"
    echo "  - 清理前会询问用户确认"
    echo "  - 支持多次安全执行"
}

# 主函数
main() {
    case "${1:-cleanup}" in
        --cleanup|cleanup|"")
            show_info
            
            if check_version_override; then
                echo ""
                read -p "确认执行环境清理? (y/N): " confirm
                case "$confirm" in
                    [yY][eE][sS]|[yY])
                        restore_node_modules
                        cleanup_version_override
                        cleanup_test_artifacts
                        verify_recovery
                        show_environment_status
                        
                        echo ""
                        log_success "🎉 环境清理完成！"
                        echo ""
                        echo "建议执行:"
                        echo "  npm install    # 确保依赖完整"
                        echo "  npm run build  # 验证构建正常"
                        ;;
                    *)
                        log_info "用户取消清理操作"
                        ;;
                esac
            else
                show_environment_status
            fi
            ;;
        --status)
            show_environment_status
            ;;
        --verify)
            verify_recovery
            show_environment_status
            ;;
        --help|help)
            show_help
            ;;
        *)
            log_error "未知参数: $1"
            echo "使用 $0 --help 查看帮助信息"
            exit 1
            ;;
    esac
}

main "$@"