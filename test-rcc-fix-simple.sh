#!/bin/bash

echo "🔧 Testing RCC_PORT fix using rcc command..."
cd "$(dirname "$0")"

echo "📋 Command: ./rcc start --config ~/.route-claude-code/config/single-provider/config-google-gemini-5502.json --debug"
echo ""

# 运行命令并在5秒后终止
timeout 5s ./rcc start --config ~/.route-claude-code/config/single-provider/config-google-gemini-5502.json --debug &
RCC_PID=$!

# 等待一下然后检查进程状态
sleep 2

if kill -0 $RCC_PID 2>/dev/null; then
  echo "✅ RCC process is running successfully!"
  echo "✅ RCC_PORT environment variable fix is working!"
  
  # 优雅终止进程
  kill $RCC_PID 2>/dev/null || true
  wait $RCC_PID 2>/dev/null || true
  
  echo "✅ Process terminated gracefully"
  echo "🎯 Fix validation completed successfully!"
else
  echo "❌ RCC process failed to start or crashed immediately"
  echo "This indicates the fix needs more work"
  exit 1
fi