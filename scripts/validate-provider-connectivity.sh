#!/bin/bash

# Provider连接性验证脚本
# Project: Claude Code Router v2.8.0  
# Owner: Jason Zhang

set -e

CONFIG_FILE="$1"
TIMEOUT=${2:-30}

if [ -z "$CONFIG_FILE" ]; then
    echo "用法: $0 <配置文件> [超时秒数]"
    exit 1
fi

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ 配置文件不存在: $CONFIG_FILE"
    exit 1
fi

PORT=$(jq -r '.server.port' "$CONFIG_FILE")
PROVIDER=$(jq -r '.deliveryTesting.provider' "$CONFIG_FILE")

echo "🔍 测试Provider连接性..."
echo "配置文件: $CONFIG_FILE"
echo "Provider: $PROVIDER"
echo "端口: $PORT"

# 启动服务
echo "🚀 启动服务..."
node dist/cli.js start --config "$CONFIG_FILE" --daemon &
SERVER_PID=$!

# 等待服务启动
sleep 5

# 检查健康状态
echo "🔍 检查服务健康状态..."
if curl -s "http://127.0.0.1:$PORT/health" > /dev/null; then
    echo "✅ 服务健康检查通过"
else
    echo "❌ 服务健康检查失败"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

# 简单API测试
echo "🧪 执行简单API测试..."
API_RESPONSE=$(curl -s -X POST "http://127.0.0.1:$PORT/v1/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-delivery-key" \
  -d '{
    "model": "test-model",
    "messages": [{"role": "user", "content": [{"type": "text", "text": "Hello, this is a connectivity test."}]}],
    "max_tokens": 100
  }' || echo "ERROR")

if [[ "$API_RESPONSE" == *"ERROR"* ]] || [ -z "$API_RESPONSE" ]; then
    echo "❌ API连接测试失败"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
else
    echo "✅ API连接测试通过"
fi

# 清理
kill $SERVER_PID 2>/dev/null || true
echo "✅ Provider连接性验证完成"
