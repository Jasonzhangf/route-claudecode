#!/bin/bash
# 直接curl测试shuaihong API

API_KEY="sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl"
IP="172.67.213.123"

echo "🔍 Testing shuaihong API with curl"
echo "=================================="

# 测试原始endpoint (使用IP)
echo "📡 Testing original endpoint with IP: https://${IP}/v1/chat/completions"
echo "Model: gemini-2.5-pro"
curl -X POST "https://${IP}/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Host: ai.shuaihong.fun" \
  -k \
  -d '{
    "model": "gemini-2.5-pro",
    "messages": [
      {
        "role": "user",
        "content": "Hello"
      }
    ],
    "max_tokens": 50,
    "temperature": 0.1,
    "stream": false
  }'

echo -e "\n=================================="

echo -e "\n=================================="

# 测试新的endpoint (双v1)
echo "📡 Testing new endpoint: https://ai.shuaihong.fun/v1/v1/chat/completions"
echo "Model: gemini-2.5-pro"
curl -X POST "https://ai.shuaihong.fun/v1/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d '{
    "model": "gemini-2.5-pro",
    "messages": [
      {
        "role": "user",
        "content": "Hello"
      }
    ],
    "max_tokens": 50,
    "temperature": 0.1,
    "stream": false
  }' | jq '.'

echo -e "\n=================================="

# 测试gemini-2.5-flash 对比
echo "📡 Testing gemini-2.5-flash with new endpoint"
curl -X POST "https://ai.shuaihong.fun/v1/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {
        "role": "user",
        "content": "Hello"
      }
    ],
    "max_tokens": 50,
    "temperature": 0.1,
    "stream": false
  }' | jq '.'

echo -e "\n✅ Curl tests completed"