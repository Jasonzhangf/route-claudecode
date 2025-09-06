#!/bin/bash

# 测试新的模块系统

set -e

echo "🧪 测试新的模块系统..."

# 测试1: 检查node_modules中是否存在@rcc模块
echo "检查 @rcc 模块是否存在..."
if [ -d "node_modules/@rcc" ]; then
    echo "✅ @rcc 目录存在"
    
    # 列出所有@rcc模块
    echo "📁 @rcc 模块列表:"
    ls -la node_modules/@rcc/
    
    # 检查几个关键模块是否存在
    if [ -L "node_modules/@rcc/config" ]; then
        echo "✅ @rcc/config 模块链接存在"
    else
        echo "❌ @rcc/config 模块链接不存在"
    fi
    
    if [ -L "node_modules/@rcc/router" ]; then
        echo "✅ @rcc/router 模块链接存在"
    else
        echo "❌ @rcc/router 模块链接不存在"
    fi
    
else
    echo "❌ @rcc 目录不存在"
fi

# 测试2: 创建一个简单的测试脚本来验证模块导入
echo ""
echo "🧪 创建模块导入测试脚本..."

cat > test-module-import.js << 'EOF'
// 测试模块导入
try {
  const config = require('@rcc/config');
  console.log('✅ @rcc/config 模块导入成功');
  console.log('config 模块信息:', typeof config);
} catch (error) {
  console.log('❌ @rcc/config 模块导入失败:', error.message);
}

try {
  const router = require('@rcc/router');
  console.log('✅ @rcc/router 模块导入成功');
  console.log('router 模块信息:', typeof router);
} catch (error) {
  console.log('❌ @rcc/router 模块导入失败:', error.message);
}

try {
  const pipeline = require('@rcc/pipeline');
  console.log('✅ @rcc/pipeline 模块导入成功');
  console.log('pipeline 模块信息:', typeof pipeline);
} catch (error) {
  console.log('❌ @rcc/pipeline 模块导入失败:', error.message);
}

console.log('🧪 模块导入测试完成');
EOF

# 运行测试脚本
echo ""
echo "🏃 运行模块导入测试..."
node test-module-import.js

# 清理测试文件
rm -f test-module-import.js

echo ""
echo "🏁 模块系统测试完成"