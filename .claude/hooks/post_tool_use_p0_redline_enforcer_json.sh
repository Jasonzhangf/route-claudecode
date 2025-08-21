#!/bin/bash

# Post-Tool-Use P0 Red Line Enforcer Hook for RCC v4.0 - JSON Format
# 工具使用后进行P0级架构红线全文件检查，确保没有违规内容被写入
# Based on .claude/rules comprehensive rule system

set -e

# Read JSON input from stdin
input=$(cat)

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
            VIOLATION_MESSAGES+=("POST-P0-HARDCODING: 在 $file_path 中发现硬编码模式: $pattern")
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
            VIOLATION_MESSAGES+=("POST-P0-SILENT-FAILURE: 在 $file_path 中发现静默失败模式: $pattern")
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
        "return\s*{\s*status:\s*[\"']success[\"']"
        "return\s*{\s*data:\s*[\"']test"
        "jest\.fn\("
        "sinon\."
        "spyOn"
    )
    
    for pattern in "${unreal_patterns[@]}"; do
        if echo "$file_content" | grep -qE "$pattern"; then
            VIOLATION_FOUND=true
            VIOLATION_MESSAGES+=("POST-P0-UNREAL-RESPONSE: 在 $file_path 中发现不真实响应模式: $pattern")
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
            VIOLATION_MESSAGES+=("POST-P0-MODULE-BOUNDARY: 在 $file_path 中发现跨模块直接导入: $pattern")
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
            VIOLATION_MESSAGES+=("POST-P0-ZERO-FALLBACK: 在 $file_path 中发现Fallback机制违规: $pattern")
        fi
    done
    
    # 特别检查注释中的fallback描述
    if echo "$file_content" | grep -qE "//.*fallback|/\*.*fallback.*\*/"; then
        VIOLATION_FOUND=true
        VIOLATION_MESSAGES+=("POST-P0-ZERO-FALLBACK: 在 $file_path 中发现注释中的Fallback描述，违反零Fallback策略")
    fi
}

# 检查TypeScript-Only政策违规
check_typescript_only_violations() {
    local file_path="$1"
    
    # P0 TypeScript-Only违规检测
    if [[ "$file_path" =~ \.js$ ]] && [[ "$file_path" =~ ^src/ ]]; then
        VIOLATION_FOUND=true
        VIOLATION_MESSAGES+=("POST-P0-TYPESCRIPT-ONLY: 禁止在src目录中创建或修改JavaScript文件: $file_path")
    fi
    
    if [[ "$file_path" =~ \.jsx$ ]]; then
        VIOLATION_FOUND=true
        VIOLATION_MESSAGES+=("POST-P0-TYPESCRIPT-ONLY: 禁止创建或修改JSX文件: $file_path")
    fi
    
    if [[ "$file_path" =~ \.mjs$ ]]; then
        VIOLATION_FOUND=true
        VIOLATION_MESSAGES+=("POST-P0-TYPESCRIPT-ONLY: 禁止创建或修改ES Module JavaScript文件: $file_path")
    fi
}

# 检查JSON处理强制规范违规
check_json_processing_violations() {
    local file_content="$1"
    local file_path="$2"
    
    # P0 JSON处理强制检查 - 必须使用jq
    local prohibited_json_patterns=(
        "JSON\.parse\("
        "JSON\.stringify\("
        "JSON\.parse\s*\("
        "JSON\.stringify\s*\("
        "JSON\s*\.\s*parse"
        "JSON\s*\.\s*stringify"
        "\$\{.*\}"
        "echo.*\{.*\}"
        "cat.*\{.*\}"
        "echo.*\[.*\]"
        "cat.*\[.*\]"
        ">\s*[^>]*\.json"
        ">>.*\.json"
        "tee.*\.json"
        "printf.*\{.*\}"
        "printf.*\[.*\]"
    )
    
    # 检查是否包含JSON内容但未使用jq
    local has_json_content=false
    local uses_jq=false
    
    # 检查是否包含JSON结构
    if echo "$file_content" | grep -qE '(\{[^}]*\}|\[[^\]]*\])'; then
        has_json_content=true
    fi
    
    # 检查是否使用jq
    if echo "$file_content" | grep -qE 'jq\s+'; then
        uses_jq=true
    fi
    
    # 如果有JSON内容但不使用jq，检查违规模式
    if [ "$has_json_content" = true ] && [ "$uses_jq" = false ]; then
        for pattern in "${prohibited_json_patterns[@]}"; do
            if echo "$file_content" | grep -qE "$pattern"; then
                VIOLATION_FOUND=true
                VIOLATION_MESSAGES+=("POST-P0-JSON-PROCESSING: 在 $file_path 中发现禁止的JSON处理模式: $pattern，必须使用jq")
            fi
        done
    fi
    
    # 特别检查：禁止手动构造JSON字符串
    if echo "$file_content" | grep -qE "(echo|printf).*[\"']\s*\{.*[\"']"; then
        VIOLATION_FOUND=true
        VIOLATION_MESSAGES+=("POST-P0-JSON-PROCESSING: 在 $file_path 中发现手动构造JSON字符串，必须使用jq构造")
    fi
    
    # 检查：禁止直接写入JSON文件而不使用jq
    if echo "$file_content" | grep -qE "(echo|printf|cat).*\{.*\}.*>.*\.json"; then
        VIOLATION_FOUND=true
        VIOLATION_MESSAGES+=("POST-P0-JSON-PROCESSING: 在 $file_path 中发现直接写入JSON文件，必须使用jq生成")
    fi
    
    # 检查：Node.js/TypeScript中的JSON操作必须有错误处理
    if echo "$file_content" | grep -qE "JSON\.(parse|stringify)" && ! echo "$file_content" | grep -qE "(try|catch|\.catch\()"; then
        VIOLATION_FOUND=true
        VIOLATION_MESSAGES+=("POST-P0-JSON-PROCESSING: 在 $file_path 中发现未包装错误处理的JSON操作")
    fi
}

# 读取文件内容进行全文件检查
perform_full_file_check() {
    local file_path="$1"
    
    echo "🔍 [POST-P0-红线强制执行] 全文件检查: $file_path" >&2
    
    # 跳过非代码文件
    if [[ "$file_path" =~ \.(md|json|yml|yaml|txt|log)$ ]]; then
        echo "✅ [POST-P0-红线强制执行] 跳过非代码文件: $file_path" >&2
        return 0
    fi
    
    # 严禁修改编译产物目录 - 应该修改源码
    if [[ "$file_path" =~ ^dist/ ]]; then
        VIOLATION_FOUND=true
        VIOLATION_MESSAGES+=("POST-P0-DIST-VIOLATION: 严禁修改编译产物目录 $file_path - 请修改对应的TypeScript源文件")
        return
    fi
    
    # 跳过node_modules依赖目录
    if [[ "$file_path" =~ ^node_modules/ ]]; then
        echo "✅ [POST-P0-红线强制执行] 跳过依赖目录: $file_path" >&2
        return 0
    fi
    
    # 检查文件是否存在
    if [[ ! -f "$file_path" ]]; then
        echo "⚠️ [POST-P0-红线强制执行] 文件不存在: $file_path" >&2
        return 0
    fi
    
    # 读取文件内容
    local file_content
    file_content=$(cat "$file_path" 2>/dev/null || echo "")
    
    if [[ -z "$file_content" ]]; then
        echo "✅ [POST-P0-红线强制执行] 文件为空，跳过检查: $file_path" >&2
        return 0
    fi
    
    # 执行P0级检查
    check_typescript_only_violations "$file_path"
    check_json_processing_violations "$file_content" "$file_path"
    check_hardcoding_violations "$file_content" "$file_path"
    check_silent_failure_violations "$file_content" "$file_path"
    check_unreal_response_violations "$file_content" "$file_path"
    check_module_boundary_violations "$file_content" "$file_path"
    check_zero_fallback_violations "$file_content" "$file_path"
}

# JSON Hook主入口
if command -v jq >/dev/null 2>&1; then
    tool_name=$(echo "$input" | jq -r '.tool_name // "unknown"')
    file_path=$(echo "$input" | jq -r '.tool_input.file_path // ""')
    
    # Only check Write/Edit/MultiEdit operations
    if [[ "$tool_name" =~ ^(Write|Edit|MultiEdit)$ ]] && [[ -n "$file_path" ]]; then
        
        # 执行全文件P0红线检查
        perform_full_file_check "$file_path"
        
        # 检查是否发现违规
        if [ "$VIOLATION_FOUND" = true ]; then
            echo ""
            echo "🚨 [POST-P0-红线强制执行] 发现架构红线违规，操作已回滚！"
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
            echo "  9. 强制使用jq处理所有JSON操作"
            echo ""
            echo "🔧 JSON处理规范:"
            echo "  • Bash脚本: 使用 'jq' 命令解析和生成JSON"
            echo "  • TypeScript: JSON.parse/stringify必须包装try-catch"
            echo "  • 禁止: echo/printf手动构造JSON字符串"
            echo "  • 禁止: 直接重定向到.json文件"
            echo "  • 示例: jq -n '{\"key\": \"value\"}' > output.json"
            echo ""
            echo "⚠️  P0级规则违反将导致开发工作被立即拒绝！"
            # Record statistics
            /Users/fanzhang/.claude/hooks/hook-statistics-manager.sh block "$HOOK_NAME" "${violation_type:-unknown}" "${file_path:-unknown}" >/dev/null 2>&1            exit 2
        fi
        
        echo "✅ [POST-P0-红线强制执行] 全文件P0级检查通过" >&2
    fi
fi

exit 0