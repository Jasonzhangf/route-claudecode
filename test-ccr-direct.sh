#!/bin/bash

# 设置环境变量
export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"
export ANTHROPIC_API_KEY="any-string-is-ok"

# 简单测试CCR
echo "🔍 Testing CCR Code Direct"
echo "=========================="

# 通过curl直接测试
echo "📡 Direct API Test:"
curl -X POST "http://127.0.0.1:3456/v1/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "messages": [
      {
        "role": "user",
        "content": "Say hello briefly"
      }
    ],
    "max_tokens": 50,
    "stream": false
  }' 2>/dev/null | jq '.' || echo "❌ Failed"

echo -e "\n🔧 Environment Check:"
echo "ANTHROPIC_BASE_URL: $ANTHROPIC_BASE_URL"
echo "ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY"