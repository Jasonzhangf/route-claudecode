#!/bin/bash

# Claude Code Router - 测试文件整理脚本
# 项目所有者: Jason Zhang

echo "🔧 整理测试文件到 test/ 目录..."

# 创建测试分类目录
mkdir -p test/functional    # 功能测试
mkdir -p test/integration   # 集成测试  
mkdir -p test/pipeline      # 流水线测试
mkdir -p test/performance   # 性能测试
mkdir -p test/docs          # 测试文档

# 移动并分类测试文件
echo "📦 移动流水线测试文件..."
mv test-step*-*.js test/pipeline/ 2>/dev/null || true

echo "📦 移动功能测试文件..."
mv test-cli-*.js test/functional/ 2>/dev/null || true
mv test-simple-*.js test/functional/ 2>/dev/null || true
mv test-comprehensive-*.js test/functional/ 2>/dev/null || true
mv test-multi-turn-*.js test/functional/ 2>/dev/null || true
mv test-streaming-*.js test/functional/ 2>/dev/null || true
mv test-grep-*.js test/functional/ 2>/dev/null || true

echo "📦 移动集成测试文件..."
mv test-codewhisperer-*.js test/integration/ 2>/dev/null || true
mv test-demo2-*.js test/integration/ 2>/dev/null || true
mv test-direct-*.js test/integration/ 2>/dev/null || true
mv test-final-*.js test/integration/ 2>/dev/null || true
mv test-reproduce-*.js test/integration/ 2>/dev/null || true

echo "📦 移动性能测试文件..."
mv test-debug-*.js test/performance/ 2>/dev/null || true
mv test-undefined-*.js test/performance/ 2>/dev/null || true
mv test-parser-*.js test/performance/ 2>/dev/null || true

echo "📦 移动其他测试文件..."
mv test-*.js test/functional/ 2>/dev/null || true

echo "✅ 测试文件整理完成！"
echo "📊 测试文件分布："
echo "   - 流水线测试: $(ls test/pipeline/test-*.js 2>/dev/null | wc -l) 个文件"
echo "   - 功能测试: $(ls test/functional/test-*.js 2>/dev/null | wc -l) 个文件" 
echo "   - 集成测试: $(ls test/integration/test-*.js 2>/dev/null | wc -l) 个文件"
echo "   - 性能测试: $(ls test/performance/test-*.js 2>/dev/null | wc -l) 个文件"