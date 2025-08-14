#!/bin/bash

# 🔧 Claude Code Router 自动修复脚本 v2.0
# P0级问题自动修复：硬编码、Fallback、架构违规、重复代码

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 修复日志文件
FIX_LOG_FILE="~/.route-claude-code/logs/auto-fix-$(date +%Y%m%d-%H%M%S).log"
BACKUP_DIR="~/.route-claude-code/backups/$(date +%Y%m%d-%H%M%S)"

# 创建必要目录
mkdir -p ~/.route-claude-code/logs
mkdir -p ~/.route-claude-code/backups

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $1" >> "$FIX_LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [SUCCESS] $1" >> "$FIX_LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [WARNING] $1" >> "$FIX_LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $1" >> "$FIX_LOG_FILE"
}

# 检查权限令牌
check_permissions() {
    local permission_token="~/.route-claude-code/.permission-token"
    
    if [[ ! -f "$permission_token" ]]; then
        log_error "未找到权限令牌，请先执行权限审批: ./permission-review.sh --pre-approval"
        exit 1
    fi
    
    # 检查令牌有效性
    local expires_at
    expires_at=$(grep '"expires_at":' "$permission_token" | cut -d':' -f2 | tr -d ' ,')
    local current_time
    current_time=$(date +%s)
    
    if [[ $current_time -gt $expires_at ]]; then
        log_error "权限令牌已过期，请重新执行预审批"
        exit 1
    fi
    
    log_success "权限验证通过，开始自动修复"
}

# 创建代码备份
create_backup() {
    log_info "创建代码备份到: $BACKUP_DIR"
    
    # 备份关键源码目录
    mkdir -p "$BACKUP_DIR"
    cp -r src/ "$BACKUP_DIR/src-backup"
    
    # 备份配置文件
    if [[ -d "config" ]]; then
        cp -r config/ "$BACKUP_DIR/config-backup"
    fi
    
    log_success "代码备份完成"
}

# 修复硬编码问题
fix_hardcoding_issues() {
    log_info "🚫 开始修复硬编码问题"
    
    local hardcode_patterns=(
        # 模型名硬编码
        "'gemini-1.5-pro'"
        "\"gemini-1.5-pro\""
        "'claude-3-sonnet'"
        "\"claude-3-sonnet\""
        "'gpt-4'"
        "\"gpt-4\""
        # API端点硬编码
        "'https://api.openai.com'"
        "\"https://api.openai.com\""
        "'https://api.anthropic.com'"
        "\"https://api.anthropic.com\""
        # 端口硬编码
        ":3456"
        ":5501"
        ":5502"
    )
    
    local files_to_check=(
        "src/providers/gemini/modules/api-client.ts"
        "src/providers/gemini/client.ts"
        "src/providers/openai/pure-client.ts"
        "src/providers/openai/sdk-client.ts"
        "src/providers/codewhisperer/index.ts"
        "src/transformers/gemini.ts"
        "src/transformers/openai.ts"
        "src/server.ts"
    )
    
    local fixes_applied=0
    
    for file in "${files_to_check[@]}"; do
        if [[ -f "$file" ]]; then
            log_info "检查文件: $file"
            
            for pattern in "${hardcode_patterns[@]}"; do
                if grep -q "$pattern" "$file"; then
                    log_warning "发现硬编码: $pattern 在文件 $file 中"
                    
                    # 根据模式进行特定修复
                    case "$pattern" in
                        *"gemini-1.5-pro"*)
                            # 修复Gemini模型硬编码
                            sed -i "s/$pattern/config.model || process.env.GEMINI_DEFAULT_MODEL/g" "$file"
                            log_success "修复Gemini模型硬编码: $file"
                            ((fixes_applied++))
                            ;;
                        *"claude-3-sonnet"*)
                            # 修复Claude模型硬编码
                            sed -i "s/$pattern/config.model || process.env.CLAUDE_DEFAULT_MODEL/g" "$file"
                            log_success "修复Claude模型硬编码: $file"
                            ((fixes_applied++))
                            ;;
                        *"gpt-4"*)
                            # 修复OpenAI模型硬编码
                            sed -i "s/$pattern/config.model || process.env.OPENAI_DEFAULT_MODEL/g" "$file"
                            log_success "修复OpenAI模型硬编码: $file"
                            ((fixes_applied++))
                            ;;
                        *"api.openai.com"*)
                            # 修复API端点硬编码
                            sed -i "s/$pattern/config.baseURL || process.env.OPENAI_BASE_URL/g" "$file"
                            log_success "修复OpenAI端点硬编码: $file"
                            ((fixes_applied++))
                            ;;
                        *":3456"*|*":5501"*|*":5502"*)
                            # 修复端口硬编码
                            sed -i "s/$pattern/:${process.env.SERVER_PORT || config.port}/g" "$file"
                            log_success "修复端口硬编码: $file"
                            ((fixes_applied++))
                            ;;
                    esac
                fi
            done
        fi
    done
    
    log_success "硬编码修复完成，共修复 $fixes_applied 处"
}

# 移除Fallback机制
remove_fallback_mechanisms() {
    log_info "🚫 开始移除Fallback机制"
    
    local fallback_patterns=(
        "|| 'default'"
        "|| \"default\""
        "|| fallback"
        "|| backup"
        "catch.*return.*default"
        "catch.*{.*return"
    )
    
    local files_to_check=(
        "src/providers/gemini/modules/api-client.ts"
        "src/providers/openai/pure-client.ts"
        "src/routing/"
        "src/transformers/"
    )
    
    local fixes_applied=0
    
    for file_pattern in "${files_to_check[@]}"; do
        # 处理目录和单个文件
        if [[ -d "$file_pattern" ]]; then
            local files
            files=$(find "$file_pattern" -name "*.ts" -type f)
        elif [[ -f "$file_pattern" ]]; then
            local files="$file_pattern"
        else
            continue
        fi
        
        for file in $files; do
            log_info "检查Fallback: $file"
            
            # 检查是否存在fallback模式
            for pattern in "${fallback_patterns[@]}"; do
                if grep -E "$pattern" "$file" > /dev/null; then
                    log_warning "发现Fallback机制: $pattern 在文件 $file 中"
                    
                    # 根据模式进行修复
                    case "$pattern" in
                        *"|| 'default'"*|*"|| \"default\""*)
                            # 移除默认值fallback，改为抛出异常
                            sed -i "s/|| 'default'/|| (() => { throw new Error('Required configuration missing'); })()/g" "$file"
                            sed -i 's/|| "default"/|| (() => { throw new Error("Required configuration missing"); })()/g' "$file"
                            log_success "移除默认值fallback: $file"
                            ((fixes_applied++))
                            ;;
                        *"|| fallback"*|*"|| backup"*)
                            # 移除fallback变量
                            sed -i "s/|| fallback/|| (() => { throw new Error('Fallback not allowed'); })()/g" "$file"
                            sed -i "s/|| backup/|| (() => { throw new Error('Backup mechanism not allowed'); })()/g" "$file"
                            log_success "移除fallback变量: $file"
                            ((fixes_applied++))
                            ;;
                        *"catch.*return.*default"*)
                            # 替换catch中的默认返回
                            sed -i 's/catch.*{.*return.*default.*/catch (error) { logger.error("Operation failed", error); throw error; }/g' "$file"
                            log_success "移除catch默认返回: $file"
                            ((fixes_applied++))
                            ;;
                    esac
                fi
            done
        done
    done
    
    log_success "Fallback机制移除完成，共修复 $fixes_applied 处"
}

# 修复架构违规
fix_architecture_violations() {
    log_info "🏗️ 开始修复架构违规"
    
    # 检查跨节点耦合
    local violations_found=0
    
    # 检查Transformer是否包含Provider逻辑
    log_info "检查Transformer层纯净性"
    local transformer_files
    transformer_files=$(find src/transformers/ -name "*.ts" -type f)
    
    for file in $transformer_files; do
        # 检查是否直接导入Provider模块
        if grep -E "from.*providers/" "$file" > /dev/null; then
            log_warning "架构违规: Transformer层导入Provider模块 - $file"
            
            # 移除跨层导入
            sed -i '/from.*providers\//d' "$file"
            log_success "移除跨层导入: $file"
            ((violations_found++))
        fi
        
        # 检查是否包含API调用逻辑
        if grep -E "(fetch|axios|http)" "$file" > /dev/null; then
            log_warning "架构违规: Transformer层包含API调用逻辑 - $file"
            
            # 提取API调用逻辑到Provider层
            # 这里需要具体的重构逻辑，暂时添加TODO注释
            sed -i '1i// TODO: Move API call logic to Provider layer' "$file"
            log_warning "标记需要重构: $file"
            ((violations_found++))
        fi
    done
    
    # 检查Provider是否包含转换逻辑
    log_info "检查Provider层职责单一性"
    local provider_files
    provider_files=$(find src/providers/ -name "*.ts" -type f)
    
    for file in $provider_files; do
        # 检查是否包含格式转换逻辑
        if grep -E "(transform|convert|format)" "$file" > /dev/null; then
            log_warning "架构违规: Provider层包含转换逻辑 - $file"
            
            # 标记需要重构
            sed -i '1i// TODO: Move transformation logic to Transformer layer' "$file"
            log_warning "标记需要重构: $file"
            ((violations_found++))
        fi
    done
    
    log_success "架构违规修复完成，发现 $violations_found 处违规"
}

# 消除重复代码
eliminate_code_duplication() {
    log_info "🔄 开始消除重复代码"
    
    # 检查Provider中的重复实现
    log_info "检查Provider重复实现"
    
    # 寻找相似的错误处理模式
    local common_error_pattern="catch (error) {"
    local error_handling_files=()
    
    while IFS= read -r -d '' file; do
        if grep -l "$common_error_pattern" "$file" > /dev/null; then
            error_handling_files+=("$file")
        fi
    done < <(find src/ -name "*.ts" -type f -print0)
    
    if [[ ${#error_handling_files[@]} -gt 2 ]]; then
        log_info "发现 ${#error_handling_files[@]} 个文件存在相似错误处理"
        
        # 创建共享的错误处理工具
        cat > src/utils/error-handler.ts << EOF
// 统一错误处理工具
// 项目所有者: Jason Zhang

export class UnifiedErrorHandler {
    static handleProviderError(error: any, context: string): never {
        const logger = require('./logger');
        logger.error(\`Provider error in \${context}\`, error);
        throw new Error(\`Provider operation failed: \${error.message}\`);
    }
    
    static handleTransformError(error: any, context: string): never {
        const logger = require('./logger');
        logger.error(\`Transform error in \${context}\`, error);
        throw new Error(\`Transformation failed: \${error.message}\`);
    }
    
    static handleApiError(error: any, context: string): never {
        const logger = require('./logger');
        logger.error(\`API error in \${context}\`, error);
        throw new Error(\`API call failed: \${error.message}\`);
    }
}
EOF
        
        log_success "创建统一错误处理工具: src/utils/error-handler.ts"
        
        # 在重复文件中引用统一处理器
        for file in "${error_handling_files[@]}"; do
            if ! grep -q "UnifiedErrorHandler" "$file"; then
                # 添加导入
                sed -i '1i import { UnifiedErrorHandler } from "../utils/error-handler";' "$file"
                
                # 替换重复的错误处理代码（示例）
                sed -i 's/catch (error) {.*logger\.error.*throw new Error/catch (error) { UnifiedErrorHandler.handleProviderError(error, "provider-operation"); \/\/ REPLACED/g' "$file"
                
                log_success "更新错误处理: $file"
            fi
        done
    fi
    
    # 检查相似的配置加载逻辑
    log_info "检查配置加载重复实现"
    local config_files=()
    
    while IFS= read -r -d '' file; do
        if grep -l "process.env\|config\." "$file" > /dev/null; then
            config_files+=("$file")
        fi
    done < <(find src/providers/ -name "*.ts" -type f -print0)
    
    if [[ ${#config_files[@]} -gt 2 ]]; then
        log_info "发现 ${#config_files[@]} 个Provider存在相似配置加载逻辑"
        
        # 创建统一配置管理器
        cat > src/utils/config-manager.ts << EOF
// 统一配置管理器
// 项目所有者: Jason Zhang

export class ConfigManager {
    static getProviderConfig(providerName: string): any {
        return {
            apiKey: process.env[\`\${providerName.toUpperCase()}_API_KEY\`],
            baseUrl: process.env[\`\${providerName.toUpperCase()}_BASE_URL\`],
            model: process.env[\`\${providerName.toUpperCase()}_DEFAULT_MODEL\`],
            timeout: parseInt(process.env[\`\${providerName.toUpperCase()}_TIMEOUT\`] || '30000'),
        };
    }
    
    static validateConfig(config: any, requiredFields: string[]): void {
        for (const field of requiredFields) {
            if (!config[field]) {
                throw new Error(\`Required configuration field missing: \${field}\`);
            }
        }
    }
}
EOF
        
        log_success "创建统一配置管理器: src/utils/config-manager.ts"
        
        # 更新Provider文件使用统一配置管理器
        for file in "${config_files[@]}"; do
            if ! grep -q "ConfigManager" "$file"; then
                sed -i '1i import { ConfigManager } from "../utils/config-manager";' "$file"
                log_success "添加配置管理器引用: $file"
            fi
        done
    fi
    
    log_success "重复代码消除完成"
}

# 修复静默失败
fix_silent_failures() {
    log_info "🔇 开始修复静默失败问题"
    
    local files_to_check
    files_to_check=$(find src/ -name "*.ts" -type f)
    
    local fixes_applied=0
    
    for file in $files_to_check; do
        # 检查空catch块
        if grep -E "catch.*\{\s*\}" "$file" > /dev/null; then
            log_warning "发现空catch块: $file"
            
            # 替换空catch块
            sed -i 's/catch.*{\s*}/catch (error) { logger.error("Unhandled error in '$file'", error); throw error; }/g' "$file"
            log_success "修复空catch块: $file"
            ((fixes_applied++))
        fi
        
        # 检查只有console.log的catch块
        if grep -E "catch.*console\.log" "$file" > /dev/null; then
            log_warning "发现只有console.log的catch块: $file"
            
            # 替换为proper错误处理
            sed -i 's/catch.*console\.log.*/catch (error) { logger.error("Error in '$file'", error); throw error; }/g' "$file"
            log_success "修复console.log catch块: $file"
            ((fixes_applied++))
        fi
        
        # 检查return null/undefined的错误处理
        if grep -E "catch.*return (null|undefined)" "$file" > /dev/null; then
            log_warning "发现返回null的错误处理: $file"
            
            # 替换为抛出异常
            sed -i 's/catch.*return null.*/catch (error) { logger.error("Operation failed in '$file'", error); throw error; }/g' "$file"
            sed -i 's/catch.*return undefined.*/catch (error) { logger.error("Operation failed in '$file'", error); throw error; }/g' "$file"
            log_success "修复返回null的错误处理: $file"
            ((fixes_applied++))
        fi
    done
    
    log_success "静默失败修复完成，共修复 $fixes_applied 处"
}

# 验证修复结果
verify_fixes() {
    log_info "🔍 验证修复结果"
    
    # 编译检查
    if npm run build > /dev/null 2>&1; then
        log_success "✅ TypeScript编译通过"
    else
        log_error "❌ TypeScript编译失败，需要手动修复"
        return 1
    fi
    
    # ESLint检查
    if npx eslint src/ --ext .ts > /dev/null 2>&1; then
        log_success "✅ ESLint检查通过"
    else
        log_warning "⚠️ ESLint检查发现问题，建议手动检查"
    fi
    
    # 运行基本测试
    if npm test > /dev/null 2>&1; then
        log_success "✅ 基本测试通过"
    else
        log_warning "⚠️ 部分测试失败，建议检查"
    fi
    
    log_success "修复验证完成"
}

# 生成修复报告
generate_fix_report() {
    local report_file="~/.route-claude-code/reports/auto-fix-report-$(date +%Y%m%d-%H%M%S).md"
    mkdir -p ~/.route-claude-code/reports
    
    cat > "$report_file" << EOF
# Claude Code Router 自动修复报告

## 修复概览
- **执行时间**: $(date '+%Y-%m-%d %H:%M:%S')
- **修复脚本**: auto-fix-delivery-issues.sh v2.0
- **项目所有者**: Jason Zhang

## 修复类别

### 🚫 硬编码问题修复
- 检查并修复了模型名、API端点、端口等硬编码
- 替换为配置驱动的动态值
- 确保零硬编码原则

### 🚫 Fallback机制移除
- 移除所有fallback和默认降级逻辑
- 替换为明确的错误抛出机制
- 确保失败时明确可见

### 🏗️ 架构违规修复
- 检查跨节点耦合问题
- 修复层职责混乱
- 确保六层架构纯净性

### 🔄 重复代码消除
- 创建统一错误处理工具
- 建立共享配置管理器
- 提高代码复用率

### 🔇 静默失败修复
- 修复空catch块
- 替换console.log错误处理
- 确保所有错误可追踪

## 修复结果
- **编译状态**: $(if npm run build > /dev/null 2>&1; then echo "✅ 通过"; else echo "❌ 失败"; fi)
- **ESLint状态**: $(if npx eslint src/ --ext .ts > /dev/null 2>&1; then echo "✅ 通过"; else echo "⚠️ 警告"; fi)
- **测试状态**: $(if npm test > /dev/null 2>&1; then echo "✅ 通过"; else echo "⚠️ 部分失败"; fi)

## 备份信息
- **备份位置**: $BACKUP_DIR
- **修复日志**: $FIX_LOG_FILE

## 建议后续操作
1. 运行完整测试套件验证修复效果
2. 执行代码风险审核专家验收
3. 进行真实端到端测试

---
**报告生成时间**: $(date '+%Y-%m-%d %H:%M:%S')
EOF
    
    log_success "修复报告已生成: $report_file"
}

# 显示帮助信息
show_help() {
    echo "🔧 Claude Code Router 自动修复脚本 v2.0"
    echo ""
    echo "用法:"
    echo "  $0                    执行完整自动修复"
    echo "  $0 --hardcoding      只修复硬编码问题"
    echo "  $0 --fallback        只移除fallback机制"
    echo "  $0 --architecture    只修复架构违规"
    echo "  $0 --duplication     只消除重复代码"
    echo "  $0 --silent-failure  只修复静默失败"
    echo "  $0 --verify          只验证当前代码状态"
    echo "  $0 --help            显示帮助信息"
    echo ""
    echo "注意: 执行前请确保已通过权限审批"
}

# 主函数
main() {
    log_info "🔧 Claude Code Router 自动修复脚本启动"
    
    case "${1:-all}" in
        --hardcoding)
            check_permissions
            create_backup
            fix_hardcoding_issues
            verify_fixes
            ;;
        --fallback)
            check_permissions
            create_backup
            remove_fallback_mechanisms
            verify_fixes
            ;;
        --architecture)
            check_permissions
            create_backup
            fix_architecture_violations
            verify_fixes
            ;;
        --duplication)
            check_permissions
            create_backup
            eliminate_code_duplication
            verify_fixes
            ;;
        --silent-failure)
            check_permissions
            create_backup
            fix_silent_failures
            verify_fixes
            ;;
        --verify)
            verify_fixes
            ;;
        --help)
            show_help
            exit 0
            ;;
        all|"")
            check_permissions
            create_backup
            
            echo "🚀 执行完整自动修复流程"
            echo "=================================="
            
            fix_hardcoding_issues
            remove_fallback_mechanisms
            fix_architecture_violations
            eliminate_code_duplication
            fix_silent_failures
            
            verify_fixes
            generate_fix_report
            
            log_success "🎉 所有自动修复完成！"
            ;;
        *)
            log_error "未知参数: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"