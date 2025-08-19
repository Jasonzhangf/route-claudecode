#!/bin/bash

# P0 Red Line Enforcer Hook for RCC v4.0
# 强制执行P0级架构红线，违反立即拒绝
# Based on .claude/rules comprehensive rule system

VIOLATION_FOUND=false
VIOLATION_MESSAGES=()

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
        "/home/[^/]+"
        "process\.env\.[A-Z_]+\s*\|\|\s*['\"]"
        "3456"
        "5506"
        "8080"
        "3000"
    )
    
    for pattern in "${hardcode_patterns[@]}"; do
        if echo "$file_content" | grep -qE "$pattern"; then
            VIOLATION_FOUND=true
            VIOLATION_MESSAGES+=("P0-HARDCODING: 在 $file_path 中发现硬编码模式: $pattern")
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
        "\.catch\(\(\)\s*=>\s*undefined\)"
    )
    
    for pattern in "${silent_patterns[@]}"; do
        if echo "$file_content" | grep -qE "$pattern"; then
            VIOLATION_FOUND=true
            VIOLATION_MESSAGES+=("P0-SILENT-FAILURE: 在 $file_path 中发现静默失败模式: $pattern")
        fi
    done
}

# 检查不真实响应违规
check_unreal_response_violations() {
    local file_content="$1"
    local file_path="$2"
    
    # P0 不真实响应模式检测
    local unreal_patterns=(
        "return.*test"
        "placeholder.*response"
        "return\s*{\s*status:\s*[\"']success[\"']"
        "return\s*{\s*data:\s*[\"']test"
        "jest\.fn\("
        "sinon\."
        "spyOn"
    )
    
    for pattern in "${unreal_patterns[@]}"; do
        if echo "$file_content" | grep -qE "$pattern"; then
            VIOLATION_FOUND=true
            VIOLATION_MESSAGES+=("P0-UNREAL-RESPONSE: 在 $file_path 中发现不真实响应模式: $pattern")
        fi
    done
}

# 检查模块边界违规
check_module_boundary_violations() {
    local file_content="$1"
    local file_path="$2"
    
    # P0 模块边界违规模式检测
    local boundary_patterns=(
        "\.\./\.\./.*/"
        "import.*from.*\.\./\.\./[^/]*/"
        "require\([\"']\.\./\.\./[^/]*/"
    )
    
    for pattern in "${boundary_patterns[@]}"; do
        if echo "$file_content" | grep -qE "$pattern"; then
            VIOLATION_FOUND=true
            VIOLATION_MESSAGES+=("P0-MODULE-BOUNDARY: 在 $file_path 中发现跨模块直接导入: $pattern")
        fi
    done
}

# 检查零Fallback策略违规
check_zero_fallback_violations() {
    local file_content="$1"
    local file_path="$2"
    
    # P0 零Fallback违规模式检测 - 与全局hook同步
    local fallback_patterns=(
        "fallback"
        "backup"
        "secondary"
        "emergency"
        "CrossProviderFallback"
        "ConditionalFallback"
        "AdaptiveFallback"
        "FallbackStrategy"
        "FallbackResolver"
        "FallbackManager"
        "BackwardCompatibility"
        "DefaultsForBackward"
        "loadDefaults.*Compatibility"
        "兜底"
        "降级"
        "备用"
    )
    
    for pattern in "${fallback_patterns[@]}"; do
        if echo "$file_content" | grep -qiE "$pattern" && ! echo "$file_content" | grep -qE "@deprecated.*$pattern"; then
            VIOLATION_FOUND=true
            VIOLATION_MESSAGES+=("P0-ZERO-FALLBACK: 在 $file_path 中发现Fallback机制违规: $pattern")
        fi
    done
    
    # 特别检查注释中的fallback描述
    if echo "$file_content" | grep -qE "//.*fallback|/\*.*fallback.*\*/"; then
        VIOLATION_FOUND=true
        VIOLATION_MESSAGES+=("P0-ZERO-FALLBACK: 在 $file_path 中发现注释中的Fallback描述，违反零Fallback策略")
    fi
}

# 检查TypeScript-Only政策违规
check_typescript_only_violations() {
    local file_path="$1"
    
    # P0 TypeScript-Only违规检测
    if [[ "$file_path" =~ \.js$ ]] && [[ "$file_path" =~ ^src/ ]]; then
        VIOLATION_FOUND=true
        VIOLATION_MESSAGES+=("P0-TYPESCRIPT-ONLY: 禁止在src目录中创建或修改JavaScript文件: $file_path")
    fi
    
    if [[ "$file_path" =~ \.jsx$ ]]; then
        VIOLATION_FOUND=true
        VIOLATION_MESSAGES+=("P0-TYPESCRIPT-ONLY: 禁止创建或修改JSX文件: $file_path")
    fi
    
    if [[ "$file_path" =~ \.mjs$ ]]; then
        VIOLATION_FOUND=true
        VIOLATION_MESSAGES+=("P0-TYPESCRIPT-ONLY: 禁止创建或修改ES Module JavaScript文件: $file_path")
    fi
}

# 主要检查函数
perform_p0_checks() {
    local file_path="$1"
    local file_content="$2"
    
    echo "🔍 [P0-红线强制执行] 检查文件: $file_path"
    
    # 跳过非代码文件
    if [[ "$file_path" =~ \.(md|json|yml|yaml|txt|log)$ ]]; then
        echo "✅ [P0-红线强制执行] 跳过非代码文件: $file_path"
        return 0
    fi
    
    # 跳过编译产物目录
    if [[ "$file_path" =~ ^dist/ ]] || [[ "$file_path" =~ ^node_modules/ ]]; then
        echo "✅ [P0-红线强制执行] 跳过编译产物或依赖: $file_path"
        return 0
    fi
    
    # 执行P0级检查
    check_typescript_only_violations "$file_path"
    check_hardcoding_violations "$file_content" "$file_path"
    check_silent_failure_violations "$file_content" "$file_path"
    check_unreal_response_violations "$file_content" "$file_path"
    check_module_boundary_violations "$file_content" "$file_path"
    check_zero_fallback_violations "$file_content" "$file_path"
}

# Hook主入口
main() {
    local file_path="$1"
    local file_content="$2"
    
    if [ -z "$file_path" ] || [ -z "$file_content" ]; then
        echo "❌ [P0-红线强制执行] Hook参数错误"
        exit 1
    fi
    
    # 执行P0红线检查
    perform_p0_checks "$file_path" "$file_content"
    
    # 检查是否发现违规
    if [ "$VIOLATION_FOUND" = true ]; then
        echo ""
        echo "🚨 [P0-红线强制执行] 发现架构红线违规，拒绝操作！"
        echo ""
        echo "违规详情:"
        for message in "${VIOLATION_MESSAGES[@]}"; do
            echo "  ❌ $message"
        done
        echo ""
        echo "📚 解决方案:"
        echo "  1. 查阅 .claude/rules/README.md 了解完整规则"
        echo "  2. 查阅 .claude/rules/quick-reference.md 获取快速参考"
        echo "  3. 使用配置文件替代硬编码"
        echo "  4. 通过ErrorHandler处理所有错误"
        echo "  5. 使用真实数据替代虚假响应"
        echo "  6. 遵循模块边界约束"
        echo "  7. 移除所有Fallback机制"
        echo "  8. 使用TypeScript替代JavaScript"
        echo ""
        echo "⚠️  P0级规则违反将导致开发工作被立即拒绝！"
        exit 1
    fi
    
    echo "✅ [P0-红线强制执行] 所有P0级检查通过"
    return 0
}

# 调用主函数
main "$@"