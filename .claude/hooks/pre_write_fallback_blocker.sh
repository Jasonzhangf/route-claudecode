#!/bin/bash

# Fallback Blocker Hook - 专门阻止Fallback违规
# 基于P0红线规则的强化版本

VIOLATION_FOUND=false

# 读取输入参数
file_path="$1"
file_content="$2"

if [ -z "$file_path" ] || [ -z "$file_content" ]; then
    echo "❌ [FALLBACK-BLOCKER] Hook参数错误"
    exit 1
fi

echo "🔍 [FALLBACK-BLOCKER] 检查文件: $file_path" >&2

# 跳过非代码文件
if [[ "$file_path" =~ \.(md|json|yml|yaml|txt|log)$ ]] || 
   [[ "$file_path" =~ ^(dist|node_modules|\.git)/ ]]; then
    echo "✅ [FALLBACK-BLOCKER] 跳过非代码文件: $file_path" >&2
    exit 0
fi

# 强化的Fallback检测模式
FALLBACK_PATTERNS=(
    "fallback"
    "backup" 
    "secondary"
    "emergency"
    "兜底"
    "降级"
    "备用"
    "loadDefaultsForBackwardCompatibility"
    "BackwardCompatibility"
    "DefaultsForBackward"
    "作为fallback"
    "作为备用"
    "作为兜底"
)

# 检查每个模式
for pattern in "${FALLBACK_PATTERNS[@]}"; do
    if echo "$file_content" | grep -qiE "$pattern"; then
        # 检查是否是已标记为废弃的代码
        if ! echo "$file_content" | grep -qE "@deprecated.*$pattern"; then
            VIOLATION_FOUND=true
            echo ""
            echo "🚨 [FALLBACK-BLOCKER] 检测到FALLBACK违规！"
            echo ""
            echo "违规文件: $file_path"
            echo "违规模式: $pattern"
            echo ""
            echo "🔍 违规内容预览:"
            echo "$file_content" | grep -i "$pattern" | head -3 | sed 's/^/  > /'
            echo ""
            echo "📚 解决方案:"
            echo "  1. 移除所有fallback/备用/兜底机制"
            echo "  2. 失败时立即抛出错误，不进行降级"
            echo "  3. 使用配置文件替代硬编码默认值"
            echo "  4. 查阅 .claude/rules/zero-fallback-policy.md"
            echo ""
            echo "⚠️  P0级规则违反：FALLBACK机制严禁使用！"
            echo ""
            exit 1
        fi
    fi
done

echo "✅ [FALLBACK-BLOCKER] Fallback检查通过" >&2
exit 0