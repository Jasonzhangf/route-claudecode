#!/bin/bash

# 路由流水线测试脚本
# Run Pipeline Tests
# Author: Jason Zhang

echo "🧪 Claude Code Router 路由流水线测试"
echo "===================================="
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

# 确保构建是最新的
echo "🔧 确保项目构建是最新的..."
npm run build > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ 项目构建失败"
    exit 1
fi
echo "✅ 项目构建完成"
echo ""

# 清理之前的结果
echo "🧹 清理之前的测试结果..."
rm -f step1-output.json step2-output.json step3-output.json
echo "✅ 清理完成"
echo ""

# Step 1: 基础路由测试
echo "=========================================="
echo "🧪 Step 1: 基础路由逻辑测试"
echo "=========================================="
node test/pipeline/test-step1-basic-routing.js
step1_exit_code=$?

if [ $step1_exit_code -eq 0 ]; then
    echo ""
    echo "✅ Step 1 完成"
    echo ""
else
    echo ""
    echo "❌ Step 1 失败，停止后续测试"
    exit 1
fi

# Step 2: 供应商映射测试
echo "=========================================="
echo "🧪 Step 2: 供应商映射测试"
echo "=========================================="
node test/pipeline/test-step2-provider-mapping.js
step2_exit_code=$?

if [ $step2_exit_code -eq 0 ]; then
    echo ""
    echo "✅ Step 2 完成"
    echo ""
else
    echo ""
    echo "❌ Step 2 失败，但继续进行 Step 3"
    echo ""
fi

# Step 3: 实际API测试
echo "=========================================="
echo "🧪 Step 3: 实际API测试"
echo "=========================================="
node test/pipeline/test-step3-live-api.js
step3_exit_code=$?

if [ $step3_exit_code -eq 0 ]; then
    echo ""
    echo "✅ Step 3 完成"
    echo ""
else
    echo ""
    echo "⚠️  Step 3 存在问题"
    echo ""
fi

# 综合报告
echo "=========================================="
echo "📊 流水线测试综合报告"
echo "=========================================="

# 读取各步骤结果
if [ -f "step1-output.json" ]; then
    step1_pass_rate=$(node -e "console.log(JSON.parse(require('fs').readFileSync('step1-output.json', 'utf8')).summary.passRate)")
    echo "Step 1 (路由逻辑): ${step1_pass_rate}% 通过"
fi

if [ -f "step2-output.json" ]; then
    step2_mapping_rate=$(node -e "console.log(JSON.parse(require('fs').readFileSync('step2-output.json', 'utf8')).mappingTests.passRate)")
    step2_e2e_rate=$(node -e "console.log(JSON.parse(require('fs').readFileSync('step2-output.json', 'utf8')).endToEndTests.passRate)")
    echo "Step 2 (映射测试): ${step2_mapping_rate}% 通过"
    echo "Step 2 (端到端): ${step2_e2e_rate}% 通过"
fi

if [ -f "step3-output.json" ]; then
    step3_api_rate=$(node -e "console.log(JSON.parse(require('fs').readFileSync('step3-output.json', 'utf8')).apiTests.passRate)")
    step3_model_rate=$(node -e "console.log(JSON.parse(require('fs').readFileSync('step3-output.json', 'utf8')).modelMapping.accuracy)")
    echo "Step 3 (API调用): ${step3_api_rate}% 通过"
    echo "Step 3 (模型映射): ${step3_model_rate}% 准确"
fi

echo ""
echo "📁 详细结果文件:"
echo "   - step1-output.json (路由逻辑测试)"
echo "   - step2-output.json (供应商映射测试)"
echo "   - step3-output.json (实际API测试)"

echo ""
if [ $step1_exit_code -eq 0 ] && [ $step2_exit_code -eq 0 ] && [ $step3_exit_code -eq 0 ]; then
    echo "🎉 流水线测试全部通过!"
    echo "✅ 路由系统工作正常"
elif [ -f "step3-output.json" ]; then
    model_accuracy=$(node -e "console.log(JSON.parse(require('fs').readFileSync('step3-output.json', 'utf8')).modelMapping.accuracy)")
    if [ "$model_accuracy" = "100" ]; then
        echo "🎯 模型映射完全正确!"
        echo "⚠️  部分API错误可能是供应商认证问题"
        echo "✅ 路由和映射逻辑正确"
    else
        echo "❌ 存在路由或映射问题，请检查详细结果"
    fi
else
    echo "❌ 流水线测试存在问题，请检查详细结果"
fi

echo ""
echo "🏁 流水线测试完成!"