#!/bin/bash

# ModelScope API测试脚本
# 用于检查模型是否存在和API端点是否正确

echo "🧪 ModelScope API测试"
echo "===================="

# 从配置文件读取API Key
API_KEY="ms-cc2f461b-8228-427f-99aa-1d44fab73e67"
BASE_URL="https://api-inference.modelscope.cn"

echo "📍 测试目标: $BASE_URL"
echo "🔑 使用API Key: ${API_KEY:0:10}..."

echo ""
echo "1️⃣ 测试 /v1/models 端点..."
curl -s -X GET "$BASE_URL/v1/models" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  | jq '.' 2>/dev/null || echo "JSON解析失败，原始响应："

echo ""
echo "2️⃣ 测试具体模型: Qwen/Qwen3-Coder-480B-A35B-Instruct"
curl -s -X POST "$BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen3-Coder-480B-A35B-Instruct",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 10
  }' \
  | jq '.' 2>/dev/null || echo "JSON解析失败，原始响应："

echo ""
echo "3️⃣ 测试简化模型名"
curl -s -X POST "$BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-coder",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 10
  }' \
  | jq '.' 2>/dev/null || echo "JSON解析失败，原始响应："

echo ""
echo "4️⃣ 测试基础端点连通性"
curl -s -I "$BASE_URL" | head -5

echo ""
echo "✅ 测试完成"