#!/bin/bash

# RCC v4.0 编译和全局安装脚本
# 自动化构建和安装RCC CLI到全局环境

set -e  # 出现错误时停止执行

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo ""
log_info "🚀 开始 RCC v4.0 编译和全局安装..."
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    log_error "未找到 package.json，请在项目根目录执行此脚本"
    exit 1
fi

# 检查Node.js和npm
log_info "检查系统环境..."
if ! command -v node &> /dev/null; then
    log_error "Node.js 未找到，请先安装 Node.js"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    log_error "npm 未找到，请先安装 npm"
    exit 1
fi

node_version=$(node --version)
npm_version=$(npm --version)
log_success "Node.js: $node_version"
log_success "npm: $npm_version"

# 清理旧的构建文件
log_info "清理旧的构建文件..."
rm -rf dist/
mkdir -p dist/

# 跳过TypeScript编译，直接使用JavaScript实现
log_info "跳过 TypeScript 编译，使用现有的 JavaScript 实现..."

# 复制CLI文件到dist目录
log_info "复制 CLI 文件到 dist 目录..."

# 复制主要CLI文件
if [ -f "rcc-simple.js" ]; then
    cp rcc-simple.js dist/cli-simple.js
    chmod +x dist/cli-simple.js
    log_success "复制 rcc-simple.js -> dist/cli-simple.js"
else
    log_error "未找到 rcc-simple.js 文件"
    exit 1
fi

# 复制配置文件
if [ -d "config" ]; then
    cp -r config dist/
    log_success "复制配置文件到 dist/config"
fi

# 复制其他必要文件到dist
if [ -f "package.json" ]; then
    cp package.json dist/
    log_success "复制 package.json"
fi

# 跳过依赖安装，使用现有的node_modules
if [ ! -d "node_modules" ]; then
    log_info "安装项目依赖 (跳过build脚本)..."
    npm install --ignore-scripts
    
    if [ $? -eq 0 ]; then
        log_success "依赖安装完成"
    else
        log_error "依赖安装失败"
        exit 1
    fi
else
    log_success "使用现有的 node_modules"
fi

# 检查是否已经全局安装
if npm list -g route-claude-code &> /dev/null; then
    log_warning "检测到已安装的 route-claude-code，正在卸载..."
    npm uninstall -g route-claude-code
fi

# 使用npm link进行全局安装
log_info "安装 RCC CLI 到全局环境..."
npm link

if [ $? -eq 0 ]; then
    log_success "RCC CLI 全局安装完成"
else
    log_error "全局安装失败"
    exit 1
fi

# 验证安装
log_info "验证安装结果..."
if command -v rcc4 &> /dev/null; then
    log_success "✅ rcc4 命令可用"
    
    # 显示版本信息
    version=$(node -e "console.log(require('./package.json').version)")
    log_success "✅ 版本: $version"
    
    # 显示安装路径
    install_path=$(which rcc4)
    log_success "✅ 安装路径: $install_path"
    
    log_info "测试基本功能..."
    echo ""
    echo "运行 rcc4 help:"
    rcc4 || true
    
else
    log_error "❌ rcc4 命令不可用"
    log_error "可能需要重新加载shell: source ~/.bashrc 或 source ~/.zshrc"
    exit 1
fi

# 显示使用说明
echo ""
log_success "🎉 RCC v4.0 CLI 安装完成！"
echo ""
echo -e "${BLUE}可用命令:${NC}"
echo "  rcc4 start --config <config-file> --port <port>  # 启动RCC Server"
echo "  rcc4 code --proxy-port <port>                    # 启动Claude Code代理"  
echo "  rcc4 stop --port <port>                          # 停止RCC Server"
echo ""
echo -e "${BLUE}示例:${NC}"
echo "  # 启动LM Studio Provider"
echo "  rcc4 start --config ~/.route-claudecode/config/v4/single-provider/lmstudio-v4-5506.json --port 5506"
echo ""
echo "  # 启动Claude Code代理"
echo "  rcc4 code --proxy-port 3456"
echo ""
echo "  # 停止服务器"
echo "  rcc4 stop --port 5506"
echo ""
log_info "如果命令不可用，请重新加载shell: source ~/.bashrc 或 source ~/.zshrc"

echo ""
log_success "🎯 RCC v4.0 安装流程完成！"