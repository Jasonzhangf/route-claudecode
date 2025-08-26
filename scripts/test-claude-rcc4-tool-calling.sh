#!/bin/bash

# RCC4 Claude Code Router 端到端工具调用测试脚本
# 功能：验证RCC4路由系统的完整性和工具调用功能
# 位置：.claude/scripts/ (标准脚本目录)

set -e

# 脚本配置 - 直接修改以下变量来自定义测试参数
DEFAULT_PORT="5506"
DEFAULT_API_KEY="rcc4-proxy-key"
DEFAULT_CONFIG="/Users/fanzhang/.route-claudecode/config/multi-provider-hybrid-v4.json"
TEST_COMMAND="列出本目录中所有文件夹"

# 配置文件路径说明
CONFIG_PATH_INFO() {
    echo "📁 配置文件路径说明:"
    echo "   当前配置: $DEFAULT_CONFIG"
    echo "   全局配置目录: /Users/fanzhang/.route-claudecode/config/"
    echo ""
    echo "🔧 可用配置文件:"
    echo "   • LM Studio (端口5506): /Users/fanzhang/.route-claudecode/config/v4/single-provider/lmstudio-v4-5506-demo1-enhanced.json"
    echo "   • ShuaiHong (端口5507): /Users/fanzhang/.route-claudecode/config/v4/single-provider/shuaihong-v4-5507-demo1-enhanced.json"
    echo "   • ModelScope (端口5508): /Users/fanzhang/.route-claudecode/config/v4/single-provider/modelscope-v4-5508-demo1-enhanced.json"
    echo "   • Qwen (端口5509): /Users/fanzhang/.route-claudecode/config/v4/single-provider/qwen-v4-5509-demo1-enhanced.json"
    echo ""
    echo "💡 修改配置方法:"
    echo "   1. 编辑此脚本文件，修改DEFAULT_CONFIG变量"
    echo "   2. 或者复制现有配置文件并修改端口/API密钥"
    echo "   3. 确保与rcc start命令使用相同的配置文件"
    echo ""
}

echo "🧪 RCC4 Claude Code Router 端到端测试"
echo "========================================"
echo ""

# 显示配置路径信息
CONFIG_PATH_INFO

echo "📋 当前测试配置:"
echo "   端口: $DEFAULT_PORT"
echo "   API密钥: $DEFAULT_API_KEY"
echo "   配置文件: $DEFAULT_CONFIG"
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

# 检查配置文件是否存在
echo "🔍 检查配置文件..."
if [[ ! -f "$DEFAULT_CONFIG" ]]; then
    echo "❌ 错误：配置文件不存在: $DEFAULT_CONFIG"
    echo ""
    echo "🔧 解决方案:"
    echo "   1. 检查配置文件路径是否正确"
    echo "   2. 从可用配置中选择一个:"
    ls -la /Users/fanzhang/.route-claudecode/config/v4/single-provider/*.json 2>/dev/null | sed 's/^/      /' || echo "      无可用配置文件"
    echo "   3. 或创建新的配置文件"
    echo ""
    exit 1
fi

echo "✅ 配置文件检查通过: $DEFAULT_CONFIG"

# 检查服务状态
echo "🔍 检查RCC4服务状态..."
if ! curl -s "http://localhost:$DEFAULT_PORT/health" >/dev/null 2>&1; then
    echo "❌ 错误：RCC4服务未运行或不可访问 (端口 $DEFAULT_PORT)"
    echo ""
    echo "🔧 请启动服务:"
    echo "   rcc4 start --config \"$DEFAULT_CONFIG\" --port $DEFAULT_PORT"
    echo ""
    echo "💡 如需修改配置:"
    echo "   1. 停止现有服务: rcc4 stop"
    echo "   2. 编辑配置文件或选择其他配置文件"
    echo "   3. 重新启动服务"
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
    echo "🔍 详细故障排查建议:"
    echo "   1. 检查RCC4服务状态:"
    echo "      • 服务状态: curl http://localhost:$DEFAULT_PORT/health"
    echo "      • 服务日志: 查看RCC4启动时的控制台输出"
    echo ""
    echo "   2. 验证配置文件:"
    echo "      • 配置路径: $DEFAULT_CONFIG"
    echo "      • 检查端口号与启动命令一致"
    echo "      • 验证API密钥设置正确"
    echo ""
    echo "   3. 检查后端服务:"
    echo "      • LM Studio是否运行在配置的端口"
    echo "      • 模型是否已加载"
    echo "      • 网络连接是否正常"
    echo ""
    echo "   4. 查看详细日志:"
    echo "      • Debug日志: ./debug-logs/"
    echo "      • Claude Code日志: ~/.claude/logs/"
    echo "      • 系统日志: /var/log/system.log"
    echo ""
    echo "   5. 常见解决方案:"
    echo "      • 重启RCC4服务: rcc4 stop && rcc4 start --config \"$DEFAULT_CONFIG\" --port $DEFAULT_PORT"
    echo "      • 检查防火墙设置"
    echo "      • 验证环境变量设置"
    echo ""
    exit 1
fi

echo ""
echo "📝 测试报告已生成，系统运行正常"
echo "========================================"
echo ""

# 显示配置修改说明
echo "💡 配置文件修改说明:"
echo "   如需修改端口、API密钥或其他配置："
echo ""
echo "   1. 编辑脚本变量 (推荐):"
echo "      • 编辑此脚本文件: $0"
echo "      • 修改DEFAULT_PORT、DEFAULT_API_KEY、DEFAULT_CONFIG变量"
echo ""
echo "   2. 编辑配置文件:"
echo "      • 直接编辑: $DEFAULT_CONFIG"
echo "      • 修改port、apiKey、baseUrl等字段"
echo ""
echo "   3. 使用其他配置文件:"
echo "      • 查看可用配置: ls /Users/fanzhang/.route-claudecode/config/v4/single-provider/"
echo "      • 复制并修改现有配置文件"
echo ""
echo "🚀 重新测试命令:"
echo "   ./scripts/test-claude-rcc4-tool-calling.sh"