#!/bin/bash

# 快速构建和测试模型名修复

echo "🔨 Building project..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful"
    
    echo "🧪 Running background model test..."
    node test-background-model-fix.js
else
    echo "❌ Build failed"
    exit 1
fi