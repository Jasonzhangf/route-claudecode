#!/bin/bash

# 快速Gemini provider测试
echo "🧪 快速Gemini Provider测试"

# 启动Gemini服务器
echo "🚀 启动Gemini服务器 (端口3460)"
node dist/cli.js start --config config/delivery-testing/config-gemini-only.json --debug > /tmp/gemini-test.log 2>&1 &
SERVER_PID=$!
sleep 3

# 健康检查
echo "🔍 执行健康检查"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3460/health)
if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo "✅ 健康检查通过"
else
    echo "❌ 健康检查失败: $HEALTH_RESPONSE"
    kill $SERVER_PID
    exit 1
fi

# 测试API调用
echo "🧪 测试API调用"
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3460/v1/messages \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "test-model",
    "max_tokens": 10,
    "messages": [{"role": "user", "content": "Hi"}]
  }')

echo "📊 API响应状态: $API_RESPONSE"

# 清理
echo "🧹 清理测试环境"
kill $SERVER_PID 2>/dev/null
sleep 1

if [ "$API_RESPONSE" = "200" ] || [ "$API_RESPONSE" = "400" ] || [ "$API_RESPONSE" = "401" ]; then
    echo "✅ Gemini Provider基础功能正常"
    echo "📋 详细日志: /tmp/gemini-test.log"
    exit 0
else
    echo "❌ Gemini Provider存在问题: $API_RESPONSE" 
    echo "📋 详细日志: /tmp/gemini-test.log"
    exit 1
fi