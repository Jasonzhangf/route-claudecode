#!/bin/bash

echo "🔍 对比5507和5509端口处理工具调用的差异"
echo "========================================="
echo ""

echo "📊 测试5507端口 (Shuaihong):"
echo "   配置: passthrough-compatibility"  
echo "   服务器: https://ai.shuaihong.fun"
echo ""

# 测试5507
ANTHROPIC_BASE_URL=http://localhost:5507 ANTHROPIC_API_KEY=rcc4-proxy-key claude --print "列出本目录中所有文件夹" 2>&1 | head -20

echo ""
echo "========================================="
echo ""
echo "📊 测试5509端口 (Qwen):"
echo "   配置: qwen-compatibility"
echo "   服务器: https://portal.qwen.ai"
echo ""

# 测试5509  
ANTHROPIC_BASE_URL=http://localhost:5509 ANTHROPIC_API_KEY=rcc4-proxy-key claude --print "列出本目录中所有文件夹" 2>&1 | head -20

echo ""
echo "✅ 对比测试完成"