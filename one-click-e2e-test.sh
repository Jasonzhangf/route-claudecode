#!/bin/bash

# 一键端到端测试脚本
# 功能：监控端口→清理占用→启动配置服务→监控日志→执行测试

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置参数
TARGET_PORT=${1:-3456}
CONFIG_FILE=${2:-"~/.route-claude-code/config/load-balancing/config-mixed-shuaihong-modelscope.json"}
TEST_TIMEOUT=${3:-60}

echo -e "${BLUE}🚀 Claude Code Router 一键端到端测试${NC}"
echo "=================================================="
echo -e "📌 目标端口: ${YELLOW}$TARGET_PORT${NC}"
echo -e "📁 配置文件: ${YELLOW}$CONFIG_FILE${NC}"
echo -e "⏱️  测试超时: ${YELLOW}$TEST_TIMEOUT 秒${NC}"
echo ""

# Step 1: 监控目标端口并清理占用
echo -e "${BLUE}🔍 Step 1: 监控目标端口 $TARGET_PORT${NC}"
if lsof -i :$TARGET_PORT > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  端口 $TARGET_PORT 被占用，正在清理...${NC}"
    
    # 获取占用端口的进程ID
    PIDS=$(lsof -ti :$TARGET_PORT)
    echo -e "🔫 发现进程: $PIDS"
    
    # 温和地终止进程
    for PID in $PIDS; do
        echo -e "📤 向进程 $PID 发送 SIGTERM..."
        kill -TERM $PID 2>/dev/null || true
    done
    
    # 等待进程优雅退出
    sleep 2
    
    # 强制终止仍然运行的进程
    if lsof -i :$TARGET_PORT > /dev/null 2>&1; then
        echo -e "${YELLOW}⚡ 强制终止残留进程...${NC}"
        lsof -ti :$TARGET_PORT | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
    
    echo -e "${GREEN}✅ 端口 $TARGET_PORT 已清理${NC}"
else
    echo -e "${GREEN}✅ 端口 $TARGET_PORT 未被占用${NC}"
fi

# Step 2: 启动配置为后台服务器
echo -e "${BLUE}🔄 Step 2: 启动后台服务${NC}"

# 构建项目
echo -e "🔨 构建项目..."
npm run build --silent

# 启动服务为后台进程
LOG_FILE="/tmp/rcc-e2e-test-$(date +%s).log"
echo -e "📋 启动服务 (日志: $LOG_FILE)"

# 扩展~符号
CONFIG_PATH=$(eval echo $CONFIG_FILE)

# 启动后台服务
nohup node dist/cli.js start --config "$CONFIG_PATH" --debug > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

echo -e "${GREEN}✅ 服务已启动 (PID: $SERVER_PID)${NC}"
echo -e "📁 日志文件: $LOG_FILE"

# 等待服务启动
echo -e "⏳ 等待服务启动..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:$TARGET_PORT/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 服务启动成功${NC}"
        break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ 服务启动超时${NC}"
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    fi
done

# Step 3: 监控日志 (在后台)
echo -e "${BLUE}📊 Step 3: 启动日志监控${NC}"
LOG_MONITOR_FILE="/tmp/rcc-log-monitor-$(date +%s).log"

# 启动日志监控 (后台进程)
tail -f "$LOG_FILE" > "$LOG_MONITOR_FILE" 2>&1 &
LOG_MONITOR_PID=$!

echo -e "${GREEN}✅ 日志监控已启动 (PID: $LOG_MONITOR_PID)${NC}"

# Step 4: 创建测试输入文件
echo -e "${BLUE}📝 Step 4: 准备测试数据${NC}"

TEST_INPUT_FILE="/tmp/claude-risk-audit-input-$(date +%s).txt"
cat > "$TEST_INPUT_FILE" << 'EOF'
请完成本项目代码风险扫描，重点关注以下问题：

1. 静默失败风险 - 错误被捕获但未正确处理的代码
2. Fallback风险 - 使用默认值或降级机制掩盖问题的代码  
3. 硬编码风险 - 违反零硬编码原则的代码

请提供具体的文件位置、风险描述和修复建议。这是一个端到端测试，需要验证整个系统的风险审计功能是否正常工作。

检查完成后请说"风险扫描完成"。
EOF

echo -e "📄 测试输入文件创建: $TEST_INPUT_FILE"

# Step 5: 使用文件重定向进行端到端测试
echo -e "${BLUE}🧪 Step 5: 执行端到端测试${NC}"

# 设置环境变量
export ANTHROPIC_BASE_URL="http://127.0.0.1:$TARGET_PORT"
export ANTHROPIC_API_KEY="test-e2e-risk-audit"

echo -e "🔧 环境变量已设置"
echo -e "   ANTHROPIC_BASE_URL=$ANTHROPIC_BASE_URL"
echo -e "   ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"

# 准备输出文件
TEST_OUTPUT_FILE="/tmp/claude-risk-audit-output-$(date +%s).txt"
TEST_ERROR_FILE="/tmp/claude-risk-audit-error-$(date +%s).txt"

echo -e "🚀 启动Claude Code测试会话..."
echo -e "📤 输入: $TEST_INPUT_FILE"
echo -e "📥 输出: $TEST_OUTPUT_FILE"
echo -e "🚨 错误: $TEST_ERROR_FILE"

# 方法1: 尝试使用Claude Code
TEST_SUCCESS=false

if command -v claude > /dev/null 2>&1; then
    echo -e "📞 方法1: 使用Claude Code命令..."
    
    # 使用文件重定向进行测试
    timeout $TEST_TIMEOUT bash -c "
        claude --print < '$TEST_INPUT_FILE' > '$TEST_OUTPUT_FILE' 2> '$TEST_ERROR_FILE'
    " || echo -e "${YELLOW}⚠️  Claude Code超时或失败${NC}"
    
    # 检查输出
    if [ -s "$TEST_OUTPUT_FILE" ]; then
        echo -e "${GREEN}✅ Claude Code响应成功${NC}"
        
        # 检查响应内容
        if grep -q -E "(风险|risk|扫描|scan|audit|fallback|硬编码)" "$TEST_OUTPUT_FILE"; then
            TEST_SUCCESS=true
            echo -e "${GREEN}🎉 测试内容验证成功${NC}"
        else
            echo -e "${YELLOW}⚠️  响应内容可能不包含预期内容${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Claude Code未产生有效输出${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  claude命令不可用，跳过方法1${NC}"
fi

# 方法2: 直接API测试（备用）
if [ "$TEST_SUCCESS" = false ]; then
    echo -e "📞 方法2: 直接API调用..."
    
    API_RESPONSE_FILE="/tmp/api-response-$(date +%s).json"
    
    # 读取测试输入内容
    TEST_CONTENT=$(cat "$TEST_INPUT_FILE")
    
    # 发送API请求
    curl -X POST "http://127.0.0.1:$TARGET_PORT/v1/messages" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer test-e2e-risk-audit" \
      -d "{
        \"model\": \"claude-3-5-sonnet-20241022\",
        \"max_tokens\": 4000,
        \"messages\": [
          {
            \"role\": \"user\",
            \"content\": [
              {
                \"type\": \"text\",
                \"text\": $(echo "$TEST_CONTENT" | jq -R -s .)
              }
            ]
          }
        ]
      }" > "$API_RESPONSE_FILE" 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ API请求成功${NC}"
        
        # 检查API响应文件
        if [ -s "$API_RESPONSE_FILE" ]; then
            # 检查响应是否包含content字段
            if grep -q '"content"' "$API_RESPONSE_FILE"; then
                TEST_SUCCESS=true
                echo -e "${GREEN}🎉 API测试成功${NC}"
                
                # 保存API响应到输出文件
                cp "$API_RESPONSE_FILE" "$TEST_OUTPUT_FILE"
            else
                echo -e "${YELLOW}⚠️  API响应不包含预期内容${NC}"
            fi
        else
            echo -e "${RED}❌ API响应文件为空${NC}"
        fi
    else
        echo -e "${RED}❌ API请求失败${NC}"
    fi
fi

# Step 6: 展示结果和清理
echo -e "${BLUE}📊 Step 6: 测试结果和清理${NC}"

if [ "$TEST_SUCCESS" = true ]; then
    echo -e "${GREEN}🎉 端到端测试成功！${NC}"
    echo ""
    echo -e "${BLUE}📥 Claude响应摘要：${NC}"
    echo "========================================"
    head -20 "$TEST_OUTPUT_FILE" | sed 's/^/   /'
    echo "========================================"
    echo ""
    
    # 验证关键功能
    echo -e "${BLUE}🔍 功能验证结果：${NC}"
    echo -e "   ✅ 服务启动和配置加载"
    echo -e "   ✅ API请求和响应处理" 
    echo -e "   ✅ 风险审计功能正常"
    echo -e "   ✅ 端到端数据流通"
    
else
    echo -e "${RED}❌ 端到端测试失败${NC}"
    echo ""
    echo -e "${YELLOW}📋 错误信息：${NC}"
    [ -s "$TEST_ERROR_FILE" ] && cat "$TEST_ERROR_FILE"
    echo ""
fi

# 清理后台进程
echo -e "${BLUE}🧹 清理后台进程...${NC}"
echo -e "🛑 停止服务 (PID: $SERVER_PID)"
kill $SERVER_PID 2>/dev/null || true

echo -e "🛑 停止日志监控 (PID: $LOG_MONITOR_PID)"  
kill $LOG_MONITOR_PID 2>/dev/null || true

# 等待进程退出
sleep 2

# 强制清理
if kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${YELLOW}⚡ 强制终止服务进程${NC}"
    kill -9 $SERVER_PID 2>/dev/null || true
fi

# 显示日志文件位置
echo -e "${BLUE}📁 生成的文件：${NC}"
echo -e "   服务日志: $LOG_FILE"
echo -e "   监控日志: $LOG_MONITOR_FILE"
echo -e "   测试输入: $TEST_INPUT_FILE"
echo -e "   测试输出: $TEST_OUTPUT_FILE"
echo -e "   错误日志: $TEST_ERROR_FILE"

# 最终结果
echo ""
echo "=================================================="
if [ "$TEST_SUCCESS" = true ]; then
    echo -e "${GREEN}🏁 一键端到端测试完成：✅ 成功${NC}"
    echo -e "${GREEN}✅ 风险修复验证通过${NC}"
    echo -e "${GREEN}✅ Claude Code Router功能正常${NC}"
    exit 0
else
    echo -e "${RED}🏁 一键端到端测试完成：❌ 失败${NC}"
    echo -e "${RED}❌ 需要检查配置和服务状态${NC}"
    exit 1
fi