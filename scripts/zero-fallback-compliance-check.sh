#!/bin/bash
# Zero Fallback Policy Compliance Check Script
# 
# 检查RCC v4.0项目是否遵循零fallback策略
# 此脚本为强制性质量控制工具
#
# @see .claude/rules/zero-fallback-policy.md
# @author Jason Zhang
# @version 4.0.0

set -e

echo "🔍 RCC v4.0 Zero Fallback Policy Compliance Check"
echo "=================================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 错误计数器
VIOLATION_COUNT=0
WARNING_COUNT=0

# 检查源代码目录
SRC_DIR="src"
CONFIG_DIR="config"

if [ ! -d "$SRC_DIR" ]; then
    echo -e "${RED}❌ 错误: 找不到 $SRC_DIR 目录${NC}"
    exit 1
fi

echo "📂 检查目录: $SRC_DIR"
echo ""

# Rule ZF-001: 检查fallback实现违规
echo "🔍 Rule ZF-001: 检查禁止的fallback实现..."

# 查找fallback相关代码（排除已标记为deprecated的）
FALLBACK_VIOLATIONS=$(grep -r -n "fallback\|backup\|secondary\|emergency" "$SRC_DIR" --include="*.ts" | \
    grep -v "@deprecated" | \
    grep -v "zeroFallbackPolicy" | \
    grep -v "Zero Fallback" | \
    grep -v "// 移除" | \
    grep -v "违反" | \
    grep -v "REMOVED" || true)

if [ -n "$FALLBACK_VIOLATIONS" ]; then
    echo -e "${RED}❌ 发现 fallback 相关违规代码:${NC}"
    echo "$FALLBACK_VIOLATIONS"
    VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
else
    echo -e "${GREEN}✅ 未发现禁止的fallback实现${NC}"
fi

# Rule ZF-002: 检查错误处理违规
echo ""
echo "🔍 Rule ZF-002: 检查错误处理标准..."

# 检查是否存在静默失败
SILENT_FAILURES=$(grep -r -n "catch.*{.*}" "$SRC_DIR" --include="*.ts" | \
    grep -v "throw\|error\|log" || true)

if [ -n "$SILENT_FAILURES" ]; then
    echo -e "${YELLOW}⚠️  发现可能的静默失败处理:${NC}"
    echo "$SILENT_FAILURES"
    WARNING_COUNT=$((WARNING_COUNT + 1))
fi

# 检查是否使用了统一的错误类型
ZERO_FALLBACK_ERRORS=$(grep -r -n "ZeroFallbackError\|ZeroFallbackErrorFactory" "$SRC_DIR" --include="*.ts" | wc -l)

if [ "$ZERO_FALLBACK_ERRORS" -gt 0 ]; then
    echo -e "${GREEN}✅ 发现 $ZERO_FALLBACK_ERRORS 处使用统一错误类型${NC}"
else
    echo -e "${YELLOW}⚠️  未发现使用统一的ZeroFallbackError类型${NC}"
    WARNING_COUNT=$((WARNING_COUNT + 1))
fi

# Rule ZF-003: 检查配置违规
echo ""
echo "🔍 Rule ZF-003: 检查配置文件合规性..."

if [ -d "$CONFIG_DIR" ]; then
    # 检查配置文件中的fallback设置
    CONFIG_VIOLATIONS=$(find "$CONFIG_DIR" -name "*.json" -o -name "*.json5" | \
        xargs grep -l "fallback\|backup\|secondary" 2>/dev/null || true)
    
    if [ -n "$CONFIG_VIOLATIONS" ]; then
        echo -e "${RED}❌ 发现包含fallback配置的文件:${NC}"
        echo "$CONFIG_VIOLATIONS"
        VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
    else
        echo -e "${GREEN}✅ 配置文件未发现fallback违规${NC}"
    fi
    
    # 检查zeroFallbackPolicy设置
    ZERO_POLICY_FILES=$(find "$CONFIG_DIR" -name "*.json" -o -name "*.json5" | \
        xargs grep -l "zeroFallbackPolicy.*true" 2>/dev/null | wc -l)
    
    if [ "$ZERO_POLICY_FILES" -gt 0 ]; then
        echo -e "${GREEN}✅ 发现 $ZERO_POLICY_FILES 个文件正确设置zeroFallbackPolicy: true${NC}"
    else
        echo -e "${YELLOW}⚠️  未在配置文件中发现zeroFallbackPolicy: true设置${NC}"
        WARNING_COUNT=$((WARNING_COUNT + 1))
    fi
else
    echo -e "${YELLOW}⚠️  配置目录 $CONFIG_DIR 不存在${NC}"
fi

# Rule ZF-004: 检查模块边界违规
echo ""
echo "🔍 Rule ZF-004: 检查模块边界约束..."

# 检查跨模块fallback逻辑
CROSS_MODULE_VIOLATIONS=$(grep -r -n "import.*fallback\|export.*fallback" "$SRC_DIR" --include="*.ts" | \
    grep -v "@deprecated" || true)

if [ -n "$CROSS_MODULE_VIOLATIONS" ]; then
    echo -e "${RED}❌ 发现跨模块fallback逻辑:${NC}"
    echo "$CROSS_MODULE_VIOLATIONS"
    VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
else
    echo -e "${GREEN}✅ 未发现跨模块fallback违规${NC}"
fi

# 检查重试逻辑违规
echo ""
echo "🔍 检查重试逻辑合规性..."

RETRY_VIOLATIONS=$(grep -r -n "retry\|retryable.*true" "$SRC_DIR" --include="*.ts" | \
    grep -v "retryable.*false\|retryable = false" | \
    grep -v "@deprecated\|// 注意：这是单个Provider内的重试" || true)

if [ -n "$RETRY_VIOLATIONS" ]; then
    echo -e "${RED}❌ 发现不符合零fallback策略的重试逻辑:${NC}"
    echo "$RETRY_VIOLATIONS"
    VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
else
    echo -e "${GREEN}✅ 重试逻辑符合零fallback策略${NC}"
fi

# 检查已废弃文件的标记
echo ""
echo "🔍 检查已废弃文件的标记..."

DEPRECATED_FILES=(
    "$SRC_DIR/modules/providers/cross-provider-fallback-strategy.ts"
    "$SRC_DIR/modules/providers/conditional-fallback-resolver.ts"
    "$SRC_DIR/modules/providers/fallback-integration.ts"
    "$SRC_DIR/modules/providers/adaptive-fallback-manager.ts"
)

for file in "${DEPRECATED_FILES[@]}"; do
    if [ -f "$file" ]; then
        if grep -q "@deprecated.*Zero Fallback Policy" "$file"; then
            echo -e "${GREEN}✅ $file 已正确标记为废弃${NC}"
        else
            echo -e "${RED}❌ $file 存在但未正确标记为废弃${NC}"
            VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
        fi
    fi
done

# 项目规则文件检查
echo ""
echo "🔍 检查项目规则文件..."

RULE_FILES=(
    ".claude/rules/zero-fallback-policy.md"
    ".claude/rules/zero-fallback-error-types.md"
)

for rule_file in "${RULE_FILES[@]}"; do
    if [ -f "$rule_file" ]; then
        echo -e "${GREEN}✅ 规则文件存在: $rule_file${NC}"
    else
        echo -e "${RED}❌ 规则文件缺失: $rule_file${NC}"
        VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
    fi
done

# 生成检查报告
echo ""
echo "📊 检查结果摘要"
echo "=================="
echo "🔍 检查项目: RCC v4.0 Zero Fallback Policy"
echo "📅 检查时间: $(date)"
echo "❌ 违规项: $VIOLATION_COUNT"
echo "⚠️  警告项: $WARNING_COUNT"

if [ "$VIOLATION_COUNT" -eq 0 ]; then
    if [ "$WARNING_COUNT" -eq 0 ]; then
        echo ""
        echo -e "${GREEN}🎉 零Fallback策略合规检查完全通过！${NC}"
        echo -e "${GREEN}✅ 项目完全符合Zero Fallback Policy要求${NC}"
        exit 0
    else
        echo ""
        echo -e "${YELLOW}⚠️  零Fallback策略检查通过，但存在 $WARNING_COUNT 个警告项${NC}"
        echo -e "${YELLOW}💡 建议修复警告项以提高代码质量${NC}"
        exit 0
    fi
else
    echo ""
    echo -e "${RED}❌ 零Fallback策略合规检查失败！${NC}"
    echo -e "${RED}🚫 发现 $VIOLATION_COUNT 个违规项，必须修复后才能继续${NC}"
    echo ""
    echo "📋 修复建议:"
    echo "1. 移除或标记废弃所有fallback相关代码"
    echo "2. 使用ZeroFallbackError统一错误类型"
    echo "3. 确保配置文件设置zeroFallbackPolicy: true"
    echo "4. 移除跨模块fallback逻辑"
    echo ""
    echo "📚 参考文档: .claude/rules/zero-fallback-policy.md"
    exit 1
fi