#!/bin/bash

# 🔐 Claude Code Router 权限审核系统 v2.0
# 执行前用户预授权机制，避免中途暂停

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 权限令牌文件
PERMISSION_TOKEN_FILE="~/.route-claude-code/.permission-token"
PERMISSION_LOG_FILE="~/.route-claude-code/logs/permission-audit.log"

# 创建必要目录
mkdir -p ~/.route-claude-code/logs

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $1" >> "$PERMISSION_LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [SUCCESS] $1" >> "$PERMISSION_LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [WARNING] $1" >> "$PERMISSION_LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $1" >> "$PERMISSION_LOG_FILE"
}

# 显示帮助信息
show_help() {
    echo "🔐 Claude Code Router 权限审核系统 v2.0"
    echo ""
    echo "用法:"
    echo "  $0 --pre-approval              执行预审批流程"
    echo "  $0 --test-execution             审核测试执行权限"
    echo "  $0 --fix-operations             审核修复操作权限"
    echo "  $0 --emergency-handling         审核紧急处理权限"
    echo "  $0 --execution-confirmation     执行前最终确认"
    echo "  $0 --check-token                检查权限令牌有效性"
    echo "  $0 --revoke-token               撤销权限令牌"
    echo "  $0 --help                       显示帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 --pre-approval               # 一次性获得所有权限"
    echo "  $0 --execution-confirmation      # 执行前确认权限"
}

# 生成权限令牌
generate_permission_token() {
    local permissions="$1"
    local duration_hours="$2"
    local expires_at=$(($(date +%s) + duration_hours * 3600))
    
    # 创建权限令牌JSON
    cat > "$PERMISSION_TOKEN_FILE" << EOF
{
    "created_at": "$(date '+%Y-%m-%d %H:%M:%S')",
    "expires_at": $expires_at,
    "expires_at_human": "$(date -r $expires_at '+%Y-%m-%d %H:%M:%S')",
    "duration_hours": $duration_hours,
    "permissions": $permissions,
    "token_version": "v2.0",
    "user_confirmed": true
}
EOF
    
    log_success "权限令牌已生成，有效期 $duration_hours 小时"
    log_info "令牌过期时间: $(date -r $expires_at '+%Y-%m-%d %H:%M:%S')"
}

# 检查权限令牌有效性
check_permission_token() {
    if [[ ! -f "$PERMISSION_TOKEN_FILE" ]]; then
        log_error "权限令牌不存在，请先执行预审批流程"
        return 1
    fi
    
    local expires_at
    expires_at=$(grep '"expires_at":' "$PERMISSION_TOKEN_FILE" | cut -d':' -f2 | tr -d ' ,')
    local current_time
    current_time=$(date +%s)
    
    if [[ $current_time -gt $expires_at ]]; then
        log_error "权限令牌已过期，请重新执行预审批流程"
        return 1
    fi
    
    log_success "权限令牌有效"
    return 0
}

# 用户确认函数
user_confirm() {
    local message="$1"
    echo -e "${YELLOW}❓ $message${NC}"
    read -p "请输入 'yes' 确认，'no' 取消: " response
    case "$response" in
        [yY][eE][sS]|[yY])
            return 0
            ;;
        *)
            log_warning "用户取消操作"
            return 1
            ;;
    esac
}

# 测试执行权限审核
review_test_execution_permissions() {
    echo "🧪 测试执行权限审核"
    echo "======================================"
    
    echo ""
    echo "📋 需要您确认以下测试执行权限:"
    echo ""
    echo "🏷️ 版本一致性检查 (P0级最高优先级):"
    echo "   • 检查本地版本与全局安装版本一致性"
    echo "   • 版本冲突时强制使用全局版本进行测试"
    echo "   • 临时备份和恢复本地 node_modules"
    echo "   • 生成和管理版本覆盖标记文件"
    echo ""
    echo "🌐 网络连接权限:"
    echo "   • 连接 Anthropic Claude API (api.anthropic.com)"
    echo "   • 连接 OpenAI GPT API (api.openai.com)"
    echo "   • 连接 Google Gemini API (generativelanguage.googleapis.com)"
    echo "   • 连接 AWS CodeWhisperer API (codewhisperer.*.amazonaws.com)"
    echo "   • 连接 LM Studio (localhost:1234)"
    echo "   • 连接 ModelScope API (dashscope.aliyuncs.com)"
    echo "   • 连接 ShuaiHong服务 (配置的第三方端点)"
    echo ""
    echo "🔌 端口使用权限:"
    echo "   • 占用端口 5501-5509 (单Provider服务)"
    echo "   • 占用端口 3456-3457 (生产环境服务)"
    echo "   • 监听和绑定以上端口用于测试"
    echo ""
    echo "📁 文件系统权限:"
    echo "   • 读取 ~/.route-claude-code/config/ 配置文件"
    echo "   • 写入 ~/.route-claude-code/logs/ 日志文件"
    echo "   • 创建和更新测试报告文件"
    echo "   • 读取 database/ 目录下的测试数据"
    echo ""
    echo "⚙️ 进程管理权限:"
    echo "   • 启动 rcc start 服务进程"
    echo "   • 停止异常或冲突的服务进程"
    echo "   • 检查和管理进程状态"
    echo ""
    echo "🔑 API密钥使用权限:"
    echo "   • 使用配置文件中的 Anthropic API Key"
    echo "   • 使用配置文件中的 OpenAI API Key"
    echo "   • 使用配置文件中的 Google Gemini API Key"
    echo "   • 使用配置文件中的 AWS 凭据"
    echo "   • 使用配置文件中的第三方服务凭据"
    echo ""
    
    if user_confirm "您是否授权以上所有测试执行权限？"; then
        log_success "用户授权测试执行权限"
        return 0
    else
        log_error "用户拒绝测试执行权限"
        return 1
    fi
}

# 修复操作权限审核
review_fix_operations_permissions() {
    echo "🔧 修复操作权限审核"
    echo "======================================"
    
    echo ""
    echo "📋 需要您确认以下修复操作权限:"
    echo ""
    echo "💻 代码修复权限:"
    echo "   • 修复检测到的 P0 级硬编码问题"
    echo "   • 移除所有 fallback 和默认降级机制"
    echo "   • 重构架构违规和跨节点耦合问题"
    echo "   • 消除重复代码和实现"
    echo "   • 修复静默失败和错误处理问题"
    echo ""
    echo "⚙️ 配置调整权限:"
    echo "   • 修改测试相关配置文件"
    echo "   • 调整端口和服务配置"
    echo "   • 更新依赖和环境配置"
    echo ""
    echo "📦 依赖安装权限:"
    echo "   • 安装测试所需的 npm 包"
    echo "   • 更新项目依赖版本"
    echo "   • 安装开发和测试工具"
    echo ""
    echo "🔄 服务重启权限:"
    echo "   • 重启出现问题的 rcc 服务"
    echo "   • 强制停止异常进程"
    echo "   • 重新加载配置和服务"
    echo ""
    echo "🧹 日志清理权限:"
    echo "   • 清理过期的日志文件"
    echo "   • 整理和压缩大日志文件"
    echo "   • 管理磁盘空间使用"
    echo ""
    echo "📊 报告生成权限:"
    echo "   • 生成和更新测试报告"
    echo "   • 创建风险审核报告"
    echo "   • 更新交付文档"
    echo ""
    
    if user_confirm "您是否授权以上所有修复操作权限？"; then
        log_success "用户授权修复操作权限"
        return 0
    else
        log_error "用户拒绝修复操作权限"
        return 1
    fi
}

# 紧急处理权限审核
review_emergency_handling_permissions() {
    echo "🚨 紧急处理权限审核"
    echo "======================================"
    
    echo ""
    echo "📋 需要您确认以下紧急处理权限:"
    echo ""
    echo "🔄 服务故障恢复权限:"
    echo "   • 自动检测和重启异常服务"
    echo "   • 处理服务崩溃和无响应问题"
    echo "   • 恢复服务到正常运行状态"
    echo ""
    echo "🔌 端口冲突解决权限:"
    echo "   • 自动检测端口占用情况"
    echo "   • 停止冲突进程释放端口"
    echo "   • 重新分配可用端口"
    echo ""
    echo "🌐 网络异常处理权限:"
    echo "   • 自动重试失败的网络连接"
    echo "   • 切换备用网络端点"
    echo "   • 处理API调用超时和失败"
    echo ""
    echo "💾 内存泄漏处理权限:"
    echo "   • 监控进程内存使用情况"
    echo "   • 自动重启内存占用过高的组件"
    echo "   • 清理临时文件和缓存"
    echo ""
    echo "📁 日志空间管理权限:"
    echo "   • 自动清理占用大量空间的日志"
    echo "   • 压缩或删除过期日志文件"
    echo "   • 防止磁盘空间不足"
    echo ""
    
    if user_confirm "您是否授权以上所有紧急处理权限？"; then
        log_success "用户授权紧急处理权限"
        return 0
    else
        log_error "用户拒绝紧急处理权限"
        return 1
    fi
}

# 预审批流程
execute_pre_approval() {
    echo "🔐 Claude Code Router 权限预审批流程"
    echo "========================================================"
    
    # P0级最高优先级：版本一致性检查
    log_info "🏷️ 执行P0级版本一致性检查"
    if ! ./scripts/version-consistency-check.sh; then
        log_error "版本一致性检查失败，中止权限审批"
        exit 1
    fi
    
    log_info "开始执行权限预审批流程"
    
    echo ""
    echo "📋 本次审批将一次性授权以下三类权限:"
    echo "   1. 🧪 测试执行权限 - 网络连接、端口使用、文件系统、API密钥"
    echo "   2. 🔧 修复操作权限 - 代码修复、配置调整、依赖管理、服务重启"
    echo "   3. 🚨 紧急处理权限 - 故障恢复、端口冲突、网络异常、资源管理"
    echo ""
    echo "💡 授权后24小时内，所有相关操作将自动执行，无需再次确认"
    echo ""
    
    if ! user_confirm "您是否同意开始详细权限审批流程？"; then
        log_error "用户取消预审批流程"
        exit 1
    fi
    
    # 逐一审核权限
    local all_permissions_granted=true
    local permissions_array=()
    
    echo ""
    echo "🧪 第1步: 测试执行权限审核"
    echo "----------------------------------------"
    if review_test_execution_permissions; then
        permissions_array+=("test_execution")
    else
        all_permissions_granted=false
    fi
    
    echo ""
    echo "🔧 第2步: 修复操作权限审核"
    echo "----------------------------------------"
    if review_fix_operations_permissions; then
        permissions_array+=("fix_operations")
    else
        all_permissions_granted=false
    fi
    
    echo ""
    echo "🚨 第3步: 紧急处理权限审核"
    echo "----------------------------------------"
    if review_emergency_handling_permissions; then
        permissions_array+=("emergency_handling")
    else
        all_permissions_granted=false
    fi
    
    if [[ "$all_permissions_granted" == "true" ]]; then
        # 生成权限令牌
        local permissions_json
        permissions_json=$(printf '%s\n' "${permissions_array[@]}" | jq -R . | jq -s .)
        
        generate_permission_token "$permissions_json" 24
        
        echo ""
        echo "✅ 权限预审批完成！"
        echo "======================================"
        echo "📅 有效期: 24小时"
        echo "🔑 权限令牌已保存到: $PERMISSION_TOKEN_FILE"
        echo "📊 审批日志: $PERMISSION_LOG_FILE"
        echo ""
        echo "💡 接下来可以直接执行:"
        echo "   ./comprehensive-delivery-test.sh --auto-execute"
        echo "   ./scripts/auto-fix-delivery-issues.sh"
        echo "   ./scripts/fix-test-failures.sh"
        echo ""
        
        log_success "权限预审批流程完成，所有权限已授权"
    else
        log_error "权限预审批失败，部分权限被拒绝"
        echo ""
        echo "❌ 权限预审批未完成"
        echo "======================================"
        echo "部分权限被拒绝，无法生成权限令牌"
        echo "请重新执行预审批流程并授权所有必要权限"
        exit 1
    fi
}

# 执行前最终确认
execute_confirmation() {
    echo "🔍 执行前最终确认"
    echo "======================================"
    
    if ! check_permission_token; then
        exit 1
    fi
    
    echo ""
    echo "📋 即将执行的操作清单:"
    echo "   • 完整5层测试流程 (单元→黑盒→单层→模拟→真实)"
    echo "   • 真实端到端连接测试 (所有Provider端口)"
    echo "   • 代码风险审核专家验收"
    echo "   • 必要时自动修复发现的问题"
    echo "   • 生成完整交付报告"
    echo ""
    
    # 显示权限令牌信息
    local expires_at_human
    expires_at_human=$(grep '"expires_at_human":' "$PERMISSION_TOKEN_FILE" | cut -d'"' -f4)
    echo "🔑 当前权限令牌状态:"
    echo "   • 状态: ✅ 有效"
    echo "   • 过期时间: $expires_at_human"
    echo ""
    
    if user_confirm "确认开始自动化执行完整交付测试流程？"; then
        log_success "用户确认执行，开始自动化交付测试"
        echo ""
        echo "🚀 正在启动自动化执行..."
        return 0
    else
        log_warning "用户取消执行"
        return 1
    fi
}

# 撤销权限令牌
revoke_permission_token() {
    if [[ -f "$PERMISSION_TOKEN_FILE" ]]; then
        rm -f "$PERMISSION_TOKEN_FILE"
        log_success "权限令牌已撤销"
    else
        log_warning "未找到权限令牌文件"
    fi
}

# 主函数
main() {
    case "$1" in
        --pre-approval)
            execute_pre_approval
            ;;
        --test-execution)
            review_test_execution_permissions
            ;;
        --fix-operations)
            review_fix_operations_permissions
            ;;
        --emergency-handling)
            review_emergency_handling_permissions
            ;;
        --execution-confirmation)
            execute_confirmation
            ;;
        --check-token)
            check_permission_token
            ;;
        --revoke-token)
            revoke_permission_token
            ;;
        --help|"")
            show_help
            ;;
        *)
            log_error "未知参数: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"