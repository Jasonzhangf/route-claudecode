#!/bin/bash

echo "🔍 RCC v4.0 TypeScript错误快速检查"
echo "=================================="

# 运行TypeScript编译检查并计算错误数量
ERROR_OUTPUT=$(npx tsc --noEmit 2>&1)
ERROR_COUNT=$(echo "$ERROR_OUTPUT" | grep "error TS" | wc -l | tr -d ' ')

echo "当前TypeScript错误数量: $ERROR_COUNT"

if [ "$ERROR_COUNT" -eq 0 ]; then
    echo "✅ 恭喜！所有TypeScript错误都已修复！"
else
    echo "🚧 还有 $ERROR_COUNT 个错误需要修复"
    
    # 显示最常见的错误类型
    echo ""
    echo "📊 最常见的错误类型:"
    echo "$ERROR_OUTPUT" | grep "error TS" | sed 's/.*error \(TS[0-9]*\):.*/\1/' | sort | uniq -c | sort -nr | head -5
    
    # 显示受影响最多的文件
    echo ""
    echo "📁 受影响最多的文件:"
    echo "$ERROR_OUTPUT" | grep "error TS" | sed 's/^\([^(]*\)(.*/\1/' | sort | uniq -c | sort -nr | head -5
fi

echo ""
echo "修复进度:"
echo "原始错误数: 336"
echo "当前错误数: $ERROR_COUNT"
echo "已修复: $((336 - ERROR_COUNT)) 个错误"
echo "完成度: $(( (336 - ERROR_COUNT) * 100 / 336 ))%"

if [ "$ERROR_COUNT" -le 100 ]; then
    echo "🎉 错误数量已减少到100个以下！"
fi