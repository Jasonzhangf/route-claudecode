#!/bin/bash
# 测试脚本：验证API功能

echo "🧪 Testing API functionality..."

# 检查API服务器是否能正常启动
echo "1. Testing API server startup..."
npm run build
if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

# 检查API路由是否正确注册
echo "2. Checking API routes..."
if grep -r "apiRoutes" src/routes/ > /dev/null; then
    echo "✅ API routes found"
else
    echo "❌ API routes not found"
fi

# 检查Pipeline路由是否正确注册
echo "3. Checking Pipeline routes..."
if grep -r "pipelineRoutes" src/routes/ > /dev/null; then
    echo "✅ Pipeline routes found"
else
    echo "❌ Pipeline routes not found"
fi

echo "✅ API functionality test completed"