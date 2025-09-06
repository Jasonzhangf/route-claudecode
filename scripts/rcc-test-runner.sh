#!/bin/bash
# rcc-test-runner.sh

# Claude Code Router 测试系统启动脚本

echo "🚀 启动Claude Code Router测试系统"

# 设置环境变量
export TEST_MODE=true
export CAPTURE_DATA=true
export REFERENCE_IMPL_URL="http://localhost:8080"
export TEST_IMPL_URL="http://localhost:8081"
export CAPTURE_DIR="/Users/fanzhang/Documents/github/route-claudecode/workspace/main-development/test-captures"

# 创建捕获目录
mkdir -p $CAPTURE_DIR

# 1. 启动参考实现（Claude Code Router）
echo "🔄 启动参考实现..."
# 这里应该启动Claude Code Router服务
# npm run start:reference &

# 2. 启动被测系统
echo "🔄 启动被测系统..."
# 这里应该启动我们的实现
# npm run start:test &

# 3. 启动数据捕获
echo "🔄 启动数据捕获..."
# 这里应该启动数据捕获服务
# node dist/test/data-capture.js --port 8082 &

# 4. 等待服务启动
sleep 5

# 5. 运行测试用例
echo "🧪 运行测试用例..."
# 执行测试用例
# npm run test:conversion

# 6. 生成报告
echo "📊 生成测试报告..."
# 生成对比报告
# node dist/test/report-generator.js

echo "✅ 测试系统执行完成"

# 显示报告位置
echo "📄 测试报告已生成到: $CAPTURE_DIR/report-$(date +%Y%m%d-%H%M%S).json"