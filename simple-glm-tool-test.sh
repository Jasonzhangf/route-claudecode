#!/bin/bash

echo "🔧 简单GLM工具调用测试"
echo "==================="

# 启动服务
echo "🚀 启动服务..."
node dist/cli.js start --config ~/.route-claude-code/config/single-provider/config-openai-sdk-modelscope-glm-5509.json --debug &
SERVER_PID=$!

echo "⏳ 等待服务启动..."
sleep 8

# 检查服务是否启动
if curl -s http://127.0.0.1:5509/health > /dev/null; then
    echo "✅ 服务启动成功"
else
    echo "❌ 服务启动失败"
    kill $SERVER_PID
    exit 1
fi

# 创建工具调用测试请求
echo "📝 发送工具调用测试请求..."

curl -X POST http://127.0.0.1:5509/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-key" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 1000,
    "messages": [
      {
        "role": "user", 
        "content": "Please use the search_files tool to search for TypeScript files with pattern *.ts"
      }
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "search_files",
          "description": "Search for files matching a pattern",
          "parameters": {
            "type": "object",
            "properties": {
              "pattern": {
                "type": "string",
                "description": "File pattern to search for"
              }
            },
            "required": ["pattern"]
          }
        }
      }
    ]
  }' 2>&1 | head -50

echo -e "\n🛑 停止服务..."
kill $SERVER_PID
wait $SERVER_PID 2>/dev/null

echo "✅ 测试完成"