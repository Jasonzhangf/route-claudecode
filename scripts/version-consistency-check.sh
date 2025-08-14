#!/bin/bash

# 🏷️ Claude Code Router 版本一致性强制检查脚本 v1.0
# P0级最高优先级规则 - 违反将立即中止测试

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[VERSION-CHECK]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[VERSION-CHECK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[VERSION-CHECK]${NC} $1"
}

log_error() {
    echo -e "${RED}[VERSION-CHECK]${NC} $1"
}

# 显示脚本信息
show_info() {
    echo "🏷️ Claude Code Router 版本一致性检查"
    echo "======================================"
    echo "规则级别: P0 - 最高优先级"
    echo "执行时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
}

# 获取本地版本
get_local_version() {
    if [[ ! -f "package.json" ]]; then
        log_error "未找到 package.json 文件"
        exit 1
    fi
    
    local version
    version=$(node -e "console.log(require('./package.json').version)" 2>/dev/null)
    
    if [[ -z "$version" ]]; then
        log_error "无法读取本地版本"
        exit 1
    fi
    
    echo "$version"
}

# 获取全局版本
get_global_version() {
    local global_info
    global_info=$(npm list -g route-claudecode --depth=0 2>/dev/null | grep route-claudecode || echo "")
    
    if [[ -z "$global_info" ]]; then
        echo "NOT_INSTALLED"
        return
    fi
    
    # 提取版本号 (格式: route-claudecode@2.8.0)
    local version
    version=$(echo "$global_info" | cut -d'@' -f2 | tr -d ' ')
    
    if [[ -z "$version" ]]; then
        echo "NOT_INSTALLED"
    else
        echo "$version"
    fi
}

# 检查版本一致性
check_version_consistency() {
    local local_version="$1"
    local global_version="$2"
    
    log_info "本地版本: v$local_version"
    log_info "全局版本: $(if [[ "$global_version" == "NOT_INSTALLED" ]]; then echo "未安装"; else echo "v$global_version"; fi)"
    echo ""
    
    # 场景3: 无全局安装
    if [[ "$global_version" == "NOT_INSTALLED" ]]; then
        log_error "❌ 全局未安装 route-claudecode"
        echo ""
        echo "根据最高优先级规则，交付测试必须有全局安装版本"
        echo ""
        echo "请执行以下命令进行全局安装："
        echo "  npm install -g route-claudecode@$local_version"
        echo ""
        echo "安装完成后重新执行测试"
        return 1
    fi
    
    # 场景1: 版本一致
    if [[ "$local_version" == "$global_version" ]]; then
        log_success "✅ 版本一致检查通过"
        echo ""
        echo "使用版本: v$local_version"
        echo "测试模式: 本地开发版本"
        echo ""
        return 0
    fi
    
    # 场景2: 版本不一致
    log_warning "⚠️  版本冲突检测到!"
    echo ""
    echo "根据最高优先级规则，强制使用全局版本进行测试"
    echo ""
    echo "冲突详情:"
    echo "  本地版本: v$local_version"
    echo "  全局版本: v$global_version"
    echo "  选择版本: v$global_version (全局)"
    echo ""
    
    # 询问用户确认
    read -p "是否继续使用全局版本 v$global_version 进行测试? (y/N): " confirm
    case "$confirm" in
        [yY][eE][sS]|[yY])
            switch_to_global_version "$global_version"
            return 0
            ;;
        *)
            log_error "❌ 用户取消测试"
            echo ""
            echo "可选解决方案:"
            echo "1. 更新全局版本: npm install -g route-claudecode@$local_version"
            echo "2. 回滚本地版本到: v$global_version"
            echo "3. 接受使用全局版本 v$global_version 进行测试"
            return 1
            ;;
    esac
}

# 切换到全局版本
switch_to_global_version() {
    local global_version="$1"
    
    log_info "开始切换到全局版本 v$global_version"
    
    # 备份本地 node_modules
    if [[ -d "node_modules" ]]; then
        local backup_name="node_modules.backup.$(date +%s)"
        mv node_modules "$backup_name"
        log_success "已备份本地 node_modules → $backup_name"
    fi
    
    # 创建版本覆盖标记
    cat > .test-version-override << EOF
# Claude Code Router 测试版本覆盖
# 生成时间: $(date '+%Y-%m-%d %H:%M:%S')
USING_GLOBAL_VERSION=$global_version
BACKUP_CREATED=$(date +%s)
ORIGINAL_LOCAL_VERSION=$(get_local_version)
EOF
    
    log_success "✅ 已切换到全局版本 v$global_version"
    echo ""
    echo "测试模式: 全局安装版本"
    echo "备份信息: 已保存到 .test-version-override"
    echo ""
    echo "⚠️  重要提醒:"
    echo "- 测试完成后请执行 ./scripts/test-cleanup.sh 恢复环境"
    echo "- 或手动删除 .test-version-override 并恢复 node_modules"
}

# 显示当前版本状态
show_version_status() {
    if [[ -f ".test-version-override" ]]; then
        local override_version
        override_version=$(grep "USING_GLOBAL_VERSION=" .test-version-override | cut -d'=' -f2)
        
        log_warning "当前使用覆盖版本: v$override_version"
        echo ""
        echo "版本覆盖信息:"
        cat .test-version-override | grep -E "USING_GLOBAL_VERSION|BACKUP_CREATED|ORIGINAL_LOCAL_VERSION"
        echo ""
        echo "恢复命令: ./scripts/test-cleanup.sh"
        echo ""
    fi
}

# 主函数
main() {
    case "${1:-check}" in
        --status)
            show_version_status
            ;;
        --check|check|"")
            show_info
            show_version_status
            
            local local_version
            local global_version
            
            local_version=$(get_local_version)
            global_version=$(get_global_version)
            
            if check_version_consistency "$local_version" "$global_version"; then
                log_success "版本一致性检查完成，可以继续测试"
                exit 0
            else
                log_error "版本一致性检查失败，测试被中止"
                exit 1
            fi
            ;;
        --help|help)
            echo "🏷️ Claude Code Router 版本一致性检查工具"
            echo ""
            echo "用法:"
            echo "  $0                检查版本一致性（默认）"
            echo "  $0 --check        检查版本一致性"
            echo "  $0 --status       显示当前版本状态"
            echo "  $0 --help         显示帮助信息"
            echo ""
            echo "规则说明:"
            echo "  - P0级最高优先级规则"
            echo "  - 本地版本与全局版本必须一致"
            echo "  - 版本冲突时强制使用全局版本"
            echo "  - 无全局安装时拒绝测试"
            ;;
        *)
            log_error "未知参数: $1"
            echo "使用 $0 --help 查看帮助信息"
            exit 1
            ;;
    esac
}

main "$@"