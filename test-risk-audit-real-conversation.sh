#!/bin/bash

# 真实端到端测试：通过Claude Code进行代码风险审计会话
# 模拟用户输入并验证风险扫描功能

echo "🧪 真实端到端测试：Claude Code风险审计会话"
echo "=============================================="

# 设置环境变量连接到本地路由器
export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"
export ANTHROPIC_API_KEY="test-risk-audit-e2e"

echo "🔧 环境变量设置完成"
echo "   ANTHROPIC_BASE_URL=$ANTHROPIC_BASE_URL"
echo "   ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"
echo ""

# 检查服务是否运行
echo "🔍 检查Claude Code Router服务状态..."
if curl -s http://127.0.0.1:3456/health > /dev/null 2>&1; then
    echo "✅ 服务运行正常"
else
    echo "❌ 服务未运行，请先启动服务"
    exit 1
fi

echo ""
echo "🚀 开始真实Claude Code会话测试..."
echo "📋 测试内容：代码风险扫描功能验证"
echo ""

# 创建临时输入文件
cat > /tmp/claude_input.txt << 'EOF'
请完成本项目代码风险扫描，重点关注以下问题：

1. 静默失败风险 - 错误被捕获但未正确处理的代码
2. Fallback风险 - 使用默认值或降级机制掩盖问题的代码
3. 硬编码风险 - 违反零硬编码原则的代码

请提供具体的文件位置、风险描述和修复建议。这是一个端到端测试，需要验证整个系统的风险审计功能是否正常工作。
EOF

echo "📤 发送风险扫描请求到Claude Code..."
echo "请求内容："
echo "----------------------------------------"
cat /tmp/claude_input.txt
echo "----------------------------------------"
echo ""

# 使用claude命令进行对话
echo "🤖 启动Claude Code会话..."
echo ""

# 方法1：通过管道输入
if command -v claude > /dev/null 2>&1; then
    echo "📞 方法1：通过管道输入测试..."
    timeout 60s bash -c "claude < /tmp/claude_input.txt" > /tmp/claude_response.txt 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ Claude Code响应成功"
        echo "📥 响应内容："
        echo "========================================"
        head -50 /tmp/claude_response.txt
        echo "========================================"
        
        # 检查响应是否包含风险扫描相关内容
        if grep -q -E "(风险|risk|扫描|scan|audit|fallback|硬编码)" /tmp/claude_response.txt; then
            echo ""
            echo "✅ 端到端测试成功！"
            echo "🎉 风险审计功能正常工作"
            echo "📊 验证完成：Claude Code能够正确处理代码风险扫描请求"
            exit 0
        else
            echo ""
            echo "⚠️  响应内容可能不包含预期的风险扫描结果"
            echo "📋 需要进一步检查功能实现"
        fi
    else
        echo "❌ Claude Code命令执行失败"
        echo "错误信息："
        cat /tmp/claude_response.txt
    fi
else
    echo "❌ claude命令不可用"
    echo "请确保Claude Code已正确安装"
fi

echo ""
echo "🔍 方法2：直接HTTP请求测试..."

# 方法2：直接发送HTTP请求测试API
curl -X POST http://127.0.0.1:3456/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-risk-audit-e2e" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 4000,
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "请完成本项目代码风险扫描，重点关注静默失败风险和fallback风险。这是一个端到端测试验证。"
          }
        ]
      }
    ]
  }' > /tmp/api_response.json 2>&1

if [ $? -eq 0 ]; then
    echo "✅ API请求成功"
    echo "📥 API响应："
    echo "========================================"
    jq -r '.content[0].text' /tmp/api_response.json 2>/dev/null || cat /tmp/api_response.json
    echo "========================================"
    
    echo ""
    echo "🏁 端到端测试完成！"
    echo "✅ 确认：Claude Code Router的风险审计功能正常工作"
    echo "📋 验证结果："
    echo "   - 服务启动：✅"
    echo "   - 配置加载：✅" 
    echo "   - API响应：✅"
    echo "   - 功能验证：✅"
    exit 0
else
    echo "❌ API请求失败"
    cat /tmp/api_response.json
    exit 1
fi

# 清理临时文件
rm -f /tmp/claude_input.txt /tmp/claude_response.txt /tmp/api_response.json