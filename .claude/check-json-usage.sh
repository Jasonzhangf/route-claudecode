#!/bin/bash

# JSON Stringify/Parse Checker Script
# This script checks for JSON.stringify and JSON.parse usage in code files
# and suggests using jq-based approaches instead

echo "🔍 Checking for JSON.stringify and JSON.parse usage..."

# Find files containing JSON.stringify or JSON.parse
STRINGIFY_COUNT=$(grep -r "JSON\.stringify" --include="*.ts" --include="*.js" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git . 2>/dev/null | wc -l | tr -d ' ')
PARSE_COUNT=$(grep -r "JSON\.parse" --include="*.ts" --include="*.js" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git . 2>/dev/null | wc -l | tr -d ' ')

TOTAL_JSON_USAGES=$((STRINGIFY_COUNT + PARSE_COUNT))

if [ $TOTAL_JSON_USAGES -gt 0 ]; then
    echo "⚠️  WARNING: JSON.stringify and/or JSON.parse usage found!"
    echo "   - JSON.stringify usage: $STRINGIFY_COUNT"
    echo "   - JSON.parse usage: $PARSE_COUNT"
    echo "   - Total JSON operations: $TOTAL_JSON_USAGES"
    echo ""
    echo "Files with JSON operations:"
    echo "JSON.stringify usage:"
    grep -r "JSON\.stringify" --include="*.ts" --include="*.js" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git . 2>/dev/null | head -5
    echo ""
    echo "JSON.parse usage:"
    grep -r "JSON\.parse" --include="*.ts" --include="*.js" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git . 2>/dev/null | head -5
    if [ $TOTAL_JSON_USAGES -gt 10 ]; then
        echo "... and $((TOTAL_JSON_USAGES - 10)) more usages"
    fi
    echo ""
    echo "建议: 考虑使用 jq-based 方法替代 JSON.stringify/JSON.parse"
    echo "例如: 使用 jq 处理 JSON 数据而不是 JavaScript 内置方法"
else
    echo "✅ No JSON.stringify or JSON.parse usage found."
fi