#!/bin/bash

# 客户端连接测试运行器
# 功能：执行标准客户端连接测试，验证rcc code --port真实连接功能
# Project: Claude Code Router v2.8.0
# Owner: Jason Zhang

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置参数
TARGET_PORT=${1:-5508}
CONFIG_FILE=${2:-"~/.route-claude-code/config/single-provider/config-openai-shuaihong-5508.json"}

echo -e "${BLUE}🧪 Claude Code Router - 客户端连接测试${NC}"
echo "==============================================="
echo -e "📌 测试类型: 客户端连接测试 (Client Connection Test)"
echo -e "📌 目标端口: ${YELLOW}$TARGET_PORT${NC}"
echo -e "📁 配置文件: ${YELLOW}$CONFIG_FILE${NC}"
echo -e "🔧 Mock策略: 可以Mock第三方服务(基于真实数据)"
echo -e "✅ 验证标准: 整链路完整响应视为连接正常"
echo ""

# 检查依赖
echo -e "${BLUE}🔍 Step 1: 检查依赖和环境${NC}"

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 未安装${NC}"
    exit 1
fi

# 检查rcc命令
if ! command -v rcc &> /dev/null; then
    echo -e "${RED}❌ rcc 命令未安装${NC}"
    echo -e "${YELLOW}💡 请先安装Claude Code Router: npm install -g route-claudecode${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js 和 rcc 命令可用${NC}"

# 检查项目构建状态
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}⚠️  项目未构建，正在构建...${NC}"
    npm run build --silent
fi

echo -e "${GREEN}✅ 项目构建状态正常${NC}"

# 检查配置文件
CONFIG_PATH=$(eval echo $CONFIG_FILE)
if [ ! -f "$CONFIG_PATH" ]; then
    echo -e "${RED}❌ 配置文件不存在: $CONFIG_PATH${NC}"
    echo -e "${YELLOW}💡 请检查配置文件路径是否正确${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 配置文件检查通过${NC}"

# 检查测试脚本
if [ ! -f "test-client-connection-standard.js" ]; then
    echo -e "${RED}❌ 测试脚本不存在: test-client-connection-standard.js${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 测试脚本检查通过${NC}"

# 清理端口占用
echo -e "${BLUE}🔄 Step 2: 清理端口占用${NC}"
if lsof -i :$TARGET_PORT > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  端口 $TARGET_PORT 被占用，正在清理...${NC}"
    
    # 只清理rcc start进程，不碰rcc code进程
    PIDS=$(lsof -ti :$TARGET_PORT)
    for PID in $PIDS; do
        PROCESS_CMD=$(ps -p $PID -o command= 2>/dev/null || echo "unknown")
        if [[ "$PROCESS_CMD" == *"rcc start"* ]]; then
            echo -e "🔫 停止API服务器进程: $PID ($PROCESS_CMD)"
            kill -TERM $PID 2>/dev/null || true
        else
            echo -e "⚠️  保留进程: $PID ($PROCESS_CMD)"
        fi
    done
    
    sleep 2
    
    # 强制清理仍占用端口的rcc start进程
    if lsof -i :$TARGET_PORT > /dev/null 2>&1; then
        PIDS=$(lsof -ti :$TARGET_PORT)
        for PID in $PIDS; do
            PROCESS_CMD=$(ps -p $PID -o command= 2>/dev/null || echo "unknown")
            if [[ "$PROCESS_CMD" == *"rcc start"* ]]; then
                echo -e "${YELLOW}⚡ 强制停止: $PID${NC}"
                kill -9 $PID 2>/dev/null || true
            fi
        done
    fi
    
    echo -e "${GREEN}✅ 端口清理完成${NC}"
else
    echo -e "${GREEN}✅ 端口 $TARGET_PORT 未被占用${NC}"
fi

# 执行客户端连接测试
echo -e "${BLUE}🧪 Step 3: 执行客户端连接测试${NC}"
echo -e "📋 测试范围: 客户端 → 路由器 → 预处理器 → Transformer → Provider连接层"
echo -e "🔧 连接方式: rcc code --port $TARGET_PORT (真实连接)"
echo -e "🎯 验证重点: 系统内部流水线完整性和正确性"
echo ""

# 设置测试环境变量
export CLIENT_CONNECTION_TEST_PORT=$TARGET_PORT
export CLIENT_CONNECTION_TEST_CONFIG="$CONFIG_PATH"

# 执行测试
echo -e "${GREEN}🚀 启动客户端连接测试...${NC}"
if node test-client-connection-standard.js; then
    echo -e "${GREEN}✅ 客户端连接测试成功完成${NC}"
    TEST_RESULT=0
else
    echo -e "${RED}❌ 客户端连接测试失败${NC}"
    TEST_RESULT=1
fi

# 显示测试结果总结
echo ""
echo "==============================================="
echo -e "${BLUE}📊 测试结果总结${NC}"
echo "==============================================="

if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}🎉 客户端连接测试全部通过！${NC}"
    echo -e "${GREEN}✅ rcc code --port 连接功能正常${NC}"
    echo -e "${GREEN}✅ 客户端到路由器通信正常${NC}"
    echo -e "${GREEN}✅ 系统内部流水线完整性验证通过${NC}"
    echo -e "${GREEN}✅ 工具调用传输功能正常${NC}"
    echo -e "${GREEN}✅ 连接韧性和恢复机制正常${NC}"
else
    echo -e "${RED}❌ 客户端连接测试存在失败项${NC}"
    echo -e "${YELLOW}💡 建议检查：${NC}"
    echo -e "   - 服务器配置和启动状态"
    echo -e "   - 网络连接和端口可用性"
    echo -e "   - rcc命令版本和兼容性"
    echo -e "   - 系统内部流水线配置"
fi

# 显示相关文件
echo -e "${BLUE}📁 相关文件：${NC}"
echo -e "   测试脚本: test-client-connection-standard.js"
echo -e "   测试文档: test-client-connection-standard.md"
echo -e "   配置文件: $CONFIG_PATH"
echo -e "   测试数据: /tmp/client-connection-test/"

echo ""
echo "==============================================="
echo -e "${BLUE}🏁 客户端连接测试完成${NC}"
echo "==============================================="

exit $TEST_RESULT