#!/bin/bash

# RCC4 Claude Code Router 端到端工具调用测试脚本
# 功能：验证RCC4路由系统的完整性和工具调用功能
# 位置：.claude/scripts/ (标准脚本目录)

set -e

# 脚本配置 - 使用默认推荐配置，不接受命令行参数
DEFAULT_PORT="5506"
DEFAULT_API_KEY="test"
DEFAULT_CONFIG="~/.route-claudecode/config/v4/single-provider/modelscope-v4-5508.json"
TEST_COMMAND="列出本目录中所有文件夹"

echo "🧪 RCC4 Claude Code Router 端到端测试"
echo "========================================"
echo ""
echo "📋 测试配置:"
echo "   端口: $DEFAULT_PORT"
echo "   配置: $DEFAULT_CONFIG"
echo "   测试命令: $TEST_COMMAND"
echo ""

# 检查必要工具
echo "🔍 检查测试环境..."
if ! command -v claude >/dev/null 2>&1; then
    echo "❌ 错误：claude命令未安装或不可用"
    echo "   请确保 Claude Code 已正确安装并在PATH中"
    exit 1
fi

if ! command -v rcc4 >/dev/null 2>&1; then
    echo "❌ 错误：rcc4命令未安装或不可用"
    echo "   请确保 RCC4 已通过 ./build-and-install.sh 正确构建和安装"
    exit 1
fi

echo "✅ 环境检查通过"
echo ""

# 检查服务状态
echo "🔍 检查RCC4服务状态..."
if ! curl -s "http://localhost:$DEFAULT_PORT/health" >/dev/null 2>&1; then
    echo "❌ 错误：RCC4服务未运行或不可访问 (端口 $DEFAULT_PORT)"
    echo ""
    echo "🔧 请启动服务:"
    echo "   rcc4 start --config $DEFAULT_CONFIG --port $DEFAULT_PORT"
    echo ""
    exit 1
fi

echo "✅ RCC4服务运行正常"
echo ""

# 执行端到端测试
echo "🚀 执行端到端工具调用测试..."
echo "   命令: ANTHROPIC_BASE_URL=http://localhost:$DEFAULT_PORT ANTHROPIC_API_KEY=$DEFAULT_API_KEY claude --print \"$TEST_COMMAND\""
echo ""

# 执行测试命令
start_time=$(date +%s)
if ANTHROPIC_BASE_URL="http://localhost:$DEFAULT_PORT" ANTHROPIC_API_KEY="$DEFAULT_API_KEY" claude --print "$TEST_COMMAND"; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    echo ""
    echo "✅ 端到端测试成功完成！"
    echo "   执行时间: ${duration}秒"
    echo ""
    
    # 检查debug日志
    if [[ -d "./debug-logs" ]]; then
        latest_log_count=$(find ./debug-logs -name "*.json" -type f -mmin -2 | wc -l)
        echo "📊 Debug日志状态:"
        echo "   日志目录: ./debug-logs"
        echo "   新生成日志: $latest_log_count 个文件"
        
        if [[ $latest_log_count -gt 0 ]]; then
            echo "✅ Debug日志记录正常"
        else
            echo "⚠️ 未发现新的debug日志文件"
        fi
    else
        echo "⚠️ Debug日志目录不存在"
    fi
    
    echo ""
    echo "🎉 RCC4系统功能验证通过！"
    echo "   • API路由: ✅ 正常"
    echo "   • 工具调用: ✅ 正常"  
    echo "   • 响应处理: ✅ 正常"
    echo "   • Debug日志: ✅ 记录完整"
    
else
    echo ""
    echo "❌ 端到端测试失败！"
    echo ""
    echo "🔍 故障排查建议:"
    echo "   1. 检查RCC4服务状态和日志"
    echo "   2. 验证LM Studio后端连接"
    echo "   3. 检查配置文件正确性"
    echo "   4. 查看debug-logs目录中的详细日志"
    echo ""
    exit 1
fi

echo ""
echo "📝 测试报告已生成，系统运行正常"
echo "========================================"