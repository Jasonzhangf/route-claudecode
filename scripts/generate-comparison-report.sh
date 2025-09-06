#!/bin/bash

# 比较报告生成器
# 用于比较 RCC v4.0 和 Claude Code Router 的转换结果

set -e

echo "📊 生成 RCC v4.0 与 Claude Code Router 比较报告..."

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 创建比较报告目录
COMPARISON_DIR="test-results/comparison"
mkdir -p "$COMPARISON_DIR"

# 检查服务可用性
RCC_V4_PORT=5511
CCR_PORT=5510

if ! nc -z localhost $RCC_V4_PORT; then
    echo "❌ 错误: RCC v4.0 服务未在端口 $RCC_V4_PORT 运行"
    exit 1
fi

if ! nc -z localhost $CCR_PORT; then
    echo "❌ 错误: Claude Code Router 服务未在端口 $CCR_PORT 运行"
    exit 1
fi

# 测试用例
TEST_CASES=(
    '{"model":"claude-3-opus-20240229","messages":[{"role":"user","content":"Hello, how are you?"}]}'
    '{"model":"claude-3-opus-20240229","system":"You are a helpful assistant.","messages":[{"role":"user","content":"What is 2+2?"}]}'
    '{"model":"claude-3-opus-20240229","messages":[{"role":"user","content":"What is the weather like?"}],"tools":[{"name":"get_weather","description":"Get weather information","input_schema":{"type":"object","properties":{"location":{"type":"string"}}}}]}'
    '{"model":"claude-3-opus-20240229","messages":[{"role":"user","content":"Count to 100"}],"stream":true}'
)

# 生成比较报告
REPORT_FILE="$COMPARISON_DIR/comparison-report-$(date +%Y%m%d-%H%M%S).md"
echo "# RCC v4.0 与 Claude Code Router 转换结果比较报告" > "$REPORT_FILE"
echo "生成时间: $(date)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

for i in "${!TEST_CASES[@]}"; do
    echo "🔍 比较测试用例 $((i+1))..."
    
    TEST_CASE=${TEST_CASES[$i]}
    TEST_NAME="测试用例 $((i+1))"
    
    echo "## $TEST_NAME" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "**输入:**" >> "$REPORT_FILE"
    echo '```json' >> "$REPORT_FILE"
    echo "$TEST_CASE" | jq '.' >> "$REPORT_FILE" 2>/dev/null || echo "$TEST_CASE" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    
    # 获取 RCC v4.0 结果
    echo "获取 RCC v4.0 转换结果..."
    RCC_RESULT=$(curl -s -X POST "http://localhost:$RCC_V4_PORT/transform" \
        -H "Content-Type: application/json" \
        -d "$TEST_CASE")
    
    # 获取 Claude Code Router 结果
    echo "获取 Claude Code Router 转换结果..."
    CCR_RESULT=$(curl -s -X POST "http://localhost:$CCR_PORT/transform" \
        -H "Content-Type: application/json" \
        -d "$TEST_CASE")
    
    # 保存详细结果
    echo "$RCC_RESULT" | jq '.' > "$COMPARISON_DIR/rcc-result-$((i+1)).json" 2>/dev/null || echo "$RCC_RESULT" > "$COMPARISON_DIR/rcc-result-$((i+1)).json"
    echo "$CCR_RESULT" | jq '.' > "$COMPARISON_DIR/ccr-result-$((i+1)).json" 2>/dev/null || echo "$CCR_RESULT" > "$COMPARISON_DIR/ccr-result-$((i+1)).json"
    
    # 比较结果
    if [ "$RCC_RESULT" = "$CCR_RESULT" ]; then
        echo "**结果:** ✅ 一致" >> "$REPORT_FILE"
    else
        echo "**结果:** ⚠️  不一致" >> "$REPORT_FILE"
    fi
    
    echo "" >> "$REPORT_FILE"
    echo "**RCC v4.0 输出:**" >> "$REPORT_FILE"
    echo '```json' >> "$REPORT_FILE"
    echo "$RCC_RESULT" | jq '.' >> "$REPORT_FILE" 2>/dev/null || echo "$RCC_RESULT" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    
    echo "**Claude Code Router 输出:**" >> "$REPORT_FILE"
    echo '```json' >> "$REPORT_FILE"
    echo "$CCR_RESULT" | jq '.' >> "$REPORT_FILE" 2>/dev/null || echo "$CCR_RESULT" >> "$REPORT_FILE"
    echo '```' >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    
    # 差异分析（如果 jq 可用）
    if command -v jq &> /dev/null; then
        echo "**差异分析:**" >> "$REPORT_FILE"
        echo '```diff' >> "$REPORT_FILE"
        diff <(echo "$RCC_RESULT" | jq -S . 2>/dev/null || echo "$RCC_RESULT") \
             <(echo "$CCR_RESULT" | jq -S . 2>/dev/null || echo "$CCR_RESULT") >> "$REPORT_FILE" 2>/dev/null || echo "无法生成差异分析" >> "$REPORT_FILE"
        echo '```' >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    fi
done

echo "📄 比较报告已生成: $REPORT_FILE"

# 生成摘要
echo "📋 生成摘要报告..."
SUMMARY_FILE="$COMPARISON_DIR/summary-$(date +%Y%m%d-%H%M%S).txt"
MATCHES=0
TOTAL=${#TEST_CASES[@]}

for i in "${!TEST_CASES[@]}"; do
    RCC_RESULT=$(cat "$COMPARISON_DIR/rcc-result-$((i+1)).json")
    CCR_RESULT=$(cat "$COMPARISON_DIR/ccr-result-$((i+1)).json")
    
    if [ "$RCC_RESULT" = "$CCR_RESULT" ]; then
        MATCHES=$((MATCHES + 1))
    fi
done

echo "RCC v4.0 与 Claude Code Router 转换结果比较摘要" > "$SUMMARY_FILE"
echo "========================================" >> "$SUMMARY_FILE"
echo "测试时间: $(date)" >> "$SUMMARY_FILE"
echo "总测试用例数: $TOTAL" >> "$SUMMARY_FILE"
echo "匹配的测试用例数: $MATCHES" >> "$SUMMARY_FILE"
echo "匹配率: $((MATCHES * 100 / TOTAL))%" >> "$SUMMARY_FILE"

if [ $MATCHES -eq $TOTAL ]; then
    echo "结论: ✅ 所有测试用例结果一致" >> "$SUMMARY_FILE"
else
    echo "结论: ⚠️  部分测试用例结果不一致，请查看详细报告" >> "$SUMMARY_FILE"
fi

echo "📄 摘要报告已生成: $SUMMARY_FILE"
echo "🎉 比较完成！"