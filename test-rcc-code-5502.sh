#!/bin/bash

# 测试 rcc code --port 5502 交互体验
echo "🧪 测试 rcc code --port 5502 交互体验"

# 检查健康状态
echo "🔍 检查Gemini 5502端口健康状态"
HEALTH_CHECK=$(curl -s http://localhost:5502/health | jq -r '.overall')
if [ "$HEALTH_CHECK" = "healthy" ]; then
    echo "✅ 服务器健康状态: $HEALTH_CHECK"
else
    echo "❌ 服务器不健康: $HEALTH_CHECK"
    exit 1
fi

# 模拟 rcc code 交互（通过API调用）
echo "🤖 模拟 'rcc code --port 5502' 用户交互"
echo "📝 输入: '请进行本项目风险检查'"

# API调用并保存完整响应
RESPONSE=$(curl -s -X POST http://localhost:5502/v1/messages \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "gemini-2.5-pro", 
    "max_tokens": 4000,
    "messages": [
      {"role": "user", "content": "请进行本项目风险检查"}
    ]
  }')

# 检查响应状态
if echo "$RESPONSE" | jq -e '.content[0].text' > /dev/null 2>&1; then
    echo "✅ API调用成功"
    
    # 提取响应内容并格式化显示
    CONTENT=$(echo "$RESPONSE" | jq -r '.content[0].text')
    TOKEN_COUNT=$(echo "$RESPONSE" | jq -r '.usage.output_tokens')
    MODEL=$(echo "$RESPONSE" | jq -r '.model')
    
    echo "📊 响应统计:"
    echo "   模型: $MODEL"
    echo "   输出token数: $TOKEN_COUNT"
    echo "   响应长度: $(echo -n "$CONTENT" | wc -c) 字符"
    
    echo ""
    echo "🎯 响应内容（前500字符预览）:"
    echo "----------------------------------------"
    echo "$CONTENT" | head -c 500
    echo ""
    echo "...（内容已截断，完整内容请参见完整响应）"
    echo "----------------------------------------"
    
    # 验证关键内容
    if echo "$CONTENT" | grep -q "风险检查" && echo "$CONTENT" | grep -q "项目"; then
        echo "✅ 响应内容包含预期的风险检查相关内容"
    else
        echo "⚠️  响应内容可能不完整或不相关"
    fi
    
    echo ""
    echo "🎉 rcc code --port 5502 功能测试完成！"
    echo "💡 用户可以通过以下命令开始交互："
    echo "   rcc code --port 5502"
    echo "   然后输入：请进行本项目风险检查"
    
else
    echo "❌ API调用失败"
    echo "错误响应: $RESPONSE"
    exit 1
fi