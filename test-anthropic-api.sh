#!/bin/bash

# 测试RCC4 Anthropic API兼容性和transformer功能
echo "🧪 RCC4 Anthropic API测试"
echo "======================="

# 配置
PORT=5507
BASE_URL="http://localhost:${PORT}"
API_KEY="rcc4-proxy-key"

echo "📋 测试配置:"
echo "  - 端口: ${PORT}"
echo "  - URL: ${BASE_URL}"
echo "  - 密钥: ${API_KEY}"
echo ""

# 检查服务状态
echo "🔍 检查RCC4服务状态..."
if ! curl -s "${BASE_URL}/health" > /dev/null; then
    echo "❌ RCC4服务未运行"
    exit 1
fi
echo "✅ RCC4服务运行正常"
echo ""

# 构建Anthropic格式的请求（标准Claude格式）
echo "🚀 发送Anthropic格式请求..."
echo "请求: 带工具调用的Anthropic格式消息"

curl -X POST "${BASE_URL}/v1/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "default",
    "max_tokens": 1024,
    "messages": [
      {
        "role": "user",
        "content": "列出本项目下文件列表"
      }
    ],
    "tools": [
      {
        "name": "list_files",
        "description": "列出指定目录下的文件",
        "input_schema": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "description": "要列出文件的目录路径"
            }
          },
          "required": ["path"]
        }
      }
    ]
  }' 2>/dev/null

echo ""
echo ""
echo "📊 检查最新调试日志..."

# 等待日志生成
sleep 1

# 查找最新日志
LOG_DIR="/Users/fanzhang/.route-claudecode/debug-logs/port-${PORT}"
if [ -d "${LOG_DIR}" ]; then
    LATEST_LOG=$(ls -t "${LOG_DIR}"/*.json 2>/dev/null | head -1)
    if [ -n "${LATEST_LOG}" ]; then
        echo "📄 最新日志: ${LATEST_LOG}"
        echo ""
        
        echo "🔧 请求格式检查 (原始请求):"
        jq '.originalRequest' "${LATEST_LOG}" 2>/dev/null || echo "解析失败"
        
        echo ""
        echo "🔧 Transformer层输入输出:"
        jq '.pipelineSteps[] | select(.layer == "transformer") | {input: .input, output: .output}' "${LATEST_LOG}" 2>/dev/null || echo "解析失败"
        
        echo ""
        echo "🔧 Server层状态:"
        jq '.pipelineSteps[] | select(.layer == "server") | {success: .success, error: .error}' "${LATEST_LOG}" 2>/dev/null || echo "解析失败"
        
        echo ""
        echo "📊 完整流水线状态:"
        jq '.pipelineSteps[] | {layer: .layer, success: .success, duration: .duration}' "${LATEST_LOG}" 2>/dev/null || echo "解析失败"
    else
        echo "⚠️ 未找到日志文件"
    fi
else
    echo "⚠️ 日志目录不存在: ${LOG_DIR}"
fi

echo ""
echo "🏁 测试完成"