#!/bin/bash

# 测试套件运行脚本
# 用于执行所有测试用例并生成比较报告

set -e  # 遇到错误时退出

echo "🚀 开始执行 RCC v4.0 测试套件..."

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 检查依赖
echo "🔍 检查依赖..."
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未找到 npm"
    exit 1
fi

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 检查测试服务是否运行
echo "🔍 检查测试服务..."
RCC_V4_PORT=5511
CCR_PORT=5510

# 检查 RCC v4.0 服务
if nc -z localhost $RCC_V4_PORT; then
    echo "✅ RCC v4.0 服务已在端口 $RCC_V4_PORT 运行"
else
    echo "⚠️  RCC v4.0 服务未运行，启动测试服务..."
    npm run start:test &
    RCC_V4_PID=$!
    sleep 3  # 等待服务启动
    
    if ! nc -z localhost $RCC_V4_PORT; then
        echo "❌ 错误: 无法启动 RCC v4.0 服务"
        kill $RCC_V4_PID 2>/dev/null || true
        exit 1
    fi
    echo "✅ RCC v4.0 服务已启动 (PID: $RCC_V4_PID)"
fi

# 检查 Claude Code Router 服务
if nc -z localhost $CCR_PORT; then
    echo "✅ Claude Code Router 服务已在端口 $CCR_PORT 运行"
else
    echo "⚠️  Claude Code Router 服务未运行"
    echo "💡 提示: 如需完整比较测试，请启动 Claude Code Router 服务"
    CCR_AVAILABLE=false
fi

# 创建测试输出目录
TEST_OUTPUT_DIR="test-results"
mkdir -p "$TEST_OUTPUT_DIR"

# 运行基本转换测试
echo "🧪 运行基本转换测试..."
if npm run test:basic; then
    echo "✅ 基本转换测试通过"
else
    echo "❌ 基本转换测试失败"
    BASIC_TEST_FAILED=true
fi

# 运行工具调用测试
echo "🔧 运行工具调用测试..."
if npm run test:tools; then
    echo "✅ 工具调用测试通过"
else
    echo "❌ 工具调用测试失败"
    TOOLS_TEST_FAILED=true
fi

# 运行流式协议测试
echo "🌊 运行流式协议测试..."
if npm run test:streaming; then
    echo "✅ 流式协议测试通过"
else
    echo "❌ 流式协议测试失败"
    STREAMING_TEST_FAILED=true
fi

# 运行复杂场景测试
echo "🎭 运行复杂场景测试..."
if npm run test:complex; then
    echo "✅ 复杂场景测试通过"
else
    echo "❌ 复杂场景测试失败"
    COMPLEX_TEST_FAILED=true
fi

# 生成测试报告
echo "📝 生成测试报告..."
REPORT_FILE="$TEST_OUTPUT_DIR/test-report-$(date +%Y%m%d-%H%M%S).md"

cat > "$REPORT_FILE" << EOF
# RCC v4.0 测试报告
生成时间: $(date)

## 测试环境
- RCC v4.0 端口: $RCC_V4_PORT
- Claude Code Router 端口: $CCR_PORT
- Claude Code Router 可用: ${CCR_AVAILABLE:-true}

## 测试结果
| 测试类型 | 状态 |
|---------|------|
| 基本转换测试 | ${BASIC_TEST_FAILED:-✅ 通过} |
| 工具调用测试 | ${TOOLS_TEST_FAILED:-✅ 通过} |
| 流式协议测试 | ${STREAMING_TEST_FAILED:-✅ 通过} |
| 复杂场景测试 | ${COMPLEX_TEST_FAILED:-✅ 通过} |

## 详细结果
- 基本转换测试: ${BASIC_TEST_FAILED:-通过}
- 工具调用测试: ${TOOLS_TEST_FAILED:-通过}
- 流式协议测试: ${STREAMING_TEST_FAILED:-通过}
- 复杂场景测试: ${COMPLEX_TEST_FAILED:-通过}

EOF

echo "📄 测试报告已生成: $REPORT_FILE"

# 检查是否有失败的测试
if [ "$BASIC_TEST_FAILED" = true ] || [ "$TOOLS_TEST_FAILED" = true ] || [ "$STREAMING_TEST_FAILED" = true ] || [ "$COMPLEX_TEST_FAILED" = true ]; then
    echo "❌ 部分测试失败，请检查测试报告"
    exit 1
else
    echo "🎉 所有测试通过！"
    exit 0
fi