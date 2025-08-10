#!/bin/bash

# 测试启动命令修复
# 项目所有者: Jason Zhang

echo "🔧 Testing RCC start command with config..."

# 使用构建好的CLI测试启动命令
cd "$(dirname "$0")"

echo "📋 Testing: node dist/cli.js start --config ~/.route-claude-code/config/single-provider/config-google-gemini-5502.json --debug"
echo ""

# 测试启动命令（会立即退出，只是为了验证初始化过程）
timeout 10s node dist/cli.js start --config ~/.route-claude-code/config/single-provider/config-google-gemini-5502.json --debug || {
  exit_code=$?
  if [ $exit_code -eq 124 ]; then
    echo "✅ Command started successfully and was terminated by timeout (expected)"
    echo "✅ This means the RCC_PORT initialization issue is fixed!"
  else
    echo "❌ Command failed with exit code: $exit_code"
    echo "This indicates the fix needs more work"
  fi
}

echo ""
echo "🎯 Testing completed!"