#!/bin/bash

# 简化的RCC Provider测试
# 手动启动服务器，然后测试连接

echo "🧪 RCC v4.0 Simple Provider Test"
echo "================================"

# 检查参数
if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <port> [config_file]"
    echo "Example: $0 5506"
    echo "Example: $0 5510 ~/.route-claudecode/config/v4/hybrid-provider/comprehensive-hybrid-v4-5510.json"
    exit 1
fi

PORT="$1"
CONFIG_FILE="$2"

echo "📋 Testing configuration:"
echo "   Port: $PORT"
echo "   Config: ${CONFIG_FILE:-"auto-detect"}"

# 测试连接
echo ""
echo "🔍 Testing server connectivity..."

# 等待服务器启动（假设已经手动启动）
sleep 2

# 检查健康状态
if curl -s "http://localhost:$PORT/health" > /dev/null; then
    echo "✅ Server is running at http://localhost:$PORT"
else
    echo "❌ Server is not running at http://localhost:$PORT"
    echo "💡 Please start the server first:"
    if [[ -n "$CONFIG_FILE" ]]; then
        echo "   rcc4 start --port $PORT --config $CONFIG_FILE"
    else
        echo "   rcc4 start --port $PORT"
    fi
    exit 1
fi

# 创建测试结果目录
mkdir -p "test-results-port-$PORT"
cd "test-results-port-$PORT"

echo ""
echo "📝 Running test prompts..."

# 设置环境变量
export ANTHROPIC_BASE_URL="http://localhost:$PORT"
export ANTHROPIC_API_KEY="any-string-is-ok"

# 测试1: 代码生成
echo "🧪 Test 1: Code Generation"
claude --print "请创建一个Python函数计算斐波那契数列第n项，使用动态规划方法" > test1_fibonacci.txt 2>&1
echo "   结果保存到: test1_fibonacci.txt"

# 测试2: 文件分析  
echo "🧪 Test 2: File Analysis"
claude --print "请分析以下JSON内容的结构: $(cat ../package.json | head -20)" > test2_package_analysis.txt 2>&1
echo "   结果保存到: test2_package_analysis.txt"

# 测试3: 算法分析
echo "🧪 Test 3: Algorithm Analysis"
claude --print "分析冒泡排序的时间复杂度，并提供更高效的替代方案" > test3_algorithm.txt 2>&1
echo "   结果保存到: test3_algorithm.txt"

# 测试4: 项目结构
echo "🧪 Test 4: Project Structure"
claude --print "创建一个Express.js项目结构，包含基本的API路由和错误处理" > test4_express.txt 2>&1
echo "   结果保存到: test4_express.txt"

# 测试5: 工具调用
echo "🧪 Test 5: Tool Usage"
claude --print "请使用工具帮我创建一个名为hello.py的文件，内容是打印Hello World" > test5_tools.txt 2>&1
echo "   结果保存到: test5_tools.txt"

echo ""
echo "📊 Test Results Summary:"
echo "----------------------------------------"

for i in {1..5}; do
    test_file="test${i}_*.txt"
    if ls $test_file >/dev/null 2>&1; then
        file_name=$(ls $test_file)
        file_size=$(wc -c < "$file_name")
        if [[ $file_size -gt 100 ]]; then
            echo "✅ Test $i: Success ($file_size bytes)"
            echo "   Preview: $(head -c 100 "$file_name" | tr '\n' ' ')..."
        else
            echo "❌ Test $i: Failed or empty response"
            echo "   Content: $(cat "$file_name")"
        fi
    else
        echo "❌ Test $i: No output file found"
    fi
    echo ""
done

echo "🎉 Testing completed!"
echo "📁 Results directory: $(pwd)"