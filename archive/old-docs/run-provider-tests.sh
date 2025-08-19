#!/bin/bash

# RCC v4.0 Provider测试脚本
# 测试各个单独Provider和混合配置

set -e

echo "🧪 Starting RCC v4.0 Provider Tests"
echo "=================================="

# 创建测试结果目录
mkdir -p test-results
cd test-results

# 测试提示文件
TEST_PROMPTS="../test-prompts.txt"

# 测试函数
test_provider() {
    local config_name="$1"
    local config_path="$2"
    local port="$3"
    
    echo ""
    echo "🔧 Testing $config_name"
    echo "----------------------------------------"
    
    # 创建结果目录
    mkdir -p "$config_name"
    cd "$config_name"
    
    echo "📋 Starting RCC server with $config_name..."
    
    # 启动RCC服务器 (后台运行)
    if [[ -f "$config_path" ]]; then
        rcc4 start --port "$port" --config "$config_path" > server.log 2>&1 &
    else
        echo "⚠️  Config file not found: $config_path, using default"
        rcc4 start --port "$port" > server.log 2>&1 &
    fi
    
    local server_pid=$!
    echo "🌐 RCC server started (PID: $server_pid, Port: $port)"
    
    # 等待服务器启动
    sleep 5
    
    # 检查服务器是否运行
    if ! curl -s "http://localhost:$port/health" > /dev/null; then
        echo "❌ Server failed to start, checking logs:"
        cat server.log
        kill $server_pid 2>/dev/null || true
        cd ..
        return 1
    fi
    
    echo "✅ Server is running, starting tests..."
    
    # 运行测试 - 逐个提示测试
    local prompt_num=1
    while IFS= read -r prompt; do
        if [[ -n "$prompt" && ! "$prompt" =~ ^# ]]; then
            echo ""
            echo "📝 Test $prompt_num: $(echo "$prompt" | cut -c1-50)..."
            
            # 使用rcc4 code进行测试，但需要非交互式方式
            echo "$prompt" | timeout 60 bash -c "
                export ANTHROPIC_BASE_URL=http://localhost:$port
                export ANTHROPIC_API_KEY=any-string-is-ok
                claude --print '$prompt'
            " > "test_${prompt_num}_response.txt" 2>&1
            
            if [[ $? -eq 0 ]]; then
                echo "✅ Test $prompt_num completed successfully"
                # 显示响应的前100字符
                head -c 100 "test_${prompt_num}_response.txt" | tr '\n' ' '
                echo "..."
            else
                echo "❌ Test $prompt_num failed"
                cat "test_${prompt_num}_response.txt"
            fi
            
            prompt_num=$((prompt_num + 1))
            sleep 2  # 避免请求过快
        fi
    done < "$TEST_PROMPTS"
    
    # 停止服务器
    echo ""
    echo "🛑 Stopping RCC server (PID: $server_pid)..."
    kill $server_pid 2>/dev/null || true
    wait $server_pid 2>/dev/null || true
    
    echo "📊 Test summary for $config_name:"
    echo "   - Server log: server.log"
    echo "   - Test responses: test_*_response.txt"
    
    cd ..
}

# 测试配置列表
declare -A CONFIGS=(
    ["hybrid-v4"]="$HOME/.route-claudecode/config/v4/hybrid-provider/comprehensive-hybrid-v4-5510.json:5510"
    ["lmstudio-v4"]="$HOME/.route-claudecode/config/v4/single-provider/lmstudio-v4-5506.json:5506"
    ["hybrid-v3"]="./config/hybrid-multi-provider-v3-5509.json:5509"
    ["default-auto"]="auto:5512"
)

# 运行所有测试
for config_name in "${!CONFIGS[@]}"; do
    IFS=':' read -r config_path port <<< "${CONFIGS[$config_name]}"
    
    if [[ "$config_path" == "auto" ]]; then
        test_provider "$config_name" "" "$port"
    else
        test_provider "$config_name" "$config_path" "$port"
    fi
    
    sleep 3  # 确保端口释放
done

echo ""
echo "🎉 All provider tests completed!"
echo "📁 Results saved in: $(pwd)"
echo ""
echo "📋 Test Summary:"
for config_name in "${!CONFIGS[@]}"; do
    if [[ -d "$config_name" ]]; then
        echo "   ✅ $config_name: $(ls $config_name/test_*_response.txt 2>/dev/null | wc -l) tests completed"
    else
        echo "   ❌ $config_name: Tests failed or not run"
    fi
done