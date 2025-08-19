#!/bin/bash

# RCC4工具调用测试脚本
# 功能：使用最佳工具调用prompt测试RCC4路由器功能
# 推荐prompt："列出本目录中所有文件夹" - 最适合测试复杂工具调用和多轮会话
# 版本：v1.0

# 默认配置
DEFAULT_PORT=5506
DEFAULT_API_KEY=rcc4-proxy-key
DEFAULT_BASE_URL=http://localhost
RECOMMENDED_PROMPT="列出本目录中所有文件夹"

# 解析命令行参数
PORT=${1:-$DEFAULT_PORT}
API_KEY=${2:-$DEFAULT_API_KEY}
PROMPT=${3:-$RECOMMENDED_PROMPT}

BASE_URL="$DEFAULT_BASE_URL:$PORT"

echo "🚀 RCC4工具调用测试"
echo "📍 服务器：$BASE_URL"
echo "🔑 API密钥：$API_KEY"

# 如果使用推荐prompt，显示特别提示
if [ "$PROMPT" = "$RECOMMENDED_PROMPT" ]; then
    echo "⭐ 使用推荐测试prompt（最佳工具调用测试）"
else
    echo "💡 建议使用推荐prompt以获得最佳测试效果：\"$RECOMMENDED_PROMPT\""
fi

echo "💬 测试prompt：$PROMPT"
echo ""

# 执行测试命令
ANTHROPIC_BASE_URL="$BASE_URL" ANTHROPIC_API_KEY="$API_KEY" claude --print "$PROMPT"

# 检查结果
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 测试完成！"
    if [ "$PROMPT" = "$RECOMMENDED_PROMPT" ]; then
        echo "📊 工具调用功能验证：请检查是否正确调用了文件系统工具"
    fi
else
    echo ""
    echo "❌ 测试失败！请检查RCC4服务器状态"
fi

echo ""
echo "📝 使用方法："
echo "   $0                    # 使用推荐配置和最佳测试prompt"
echo "   $0 5508 test         # 指定端口和密钥，使用推荐prompt"
echo "   $0 5506 key \"自定义prompt\"  # 完全自定义"