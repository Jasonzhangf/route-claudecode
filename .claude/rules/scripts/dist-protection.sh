#!/bin/bash

# 编译文件保护脚本
# 防止直接修改dist目录下的编译产物

set -e

echo "🛡️  执行编译文件保护检查..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 获取项目根目录
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

# 检查dist目录保护
check_dist_protection() {
    echo -e "${BLUE}📦 检查dist目录完整性...${NC}"
    
    # 检查dist目录是否存在
    if [ ! -d "$PROJECT_ROOT/dist" ]; then
        echo -e "${YELLOW}⚠️  dist目录不存在，将在编译时创建${NC}"
        return 0
    fi
    
    # 检查是否有手动修改的编译文件
    echo -e "${BLUE}🔍 检查编译文件修改...${NC}"
    
    # 使用git检查dist目录的修改状态
    if git diff --quiet HEAD -- dist/ 2>/dev/null; then
        echo -e "${GREEN}✅ dist目录未被手动修改${NC}"
    else
        echo -e "${RED}❌ 警告: 检测到dist目录有未提交的修改${NC}"
        echo -e "${YELLOW}建议执行以下操作:${NC}"
        echo -e "${YELLOW}  1. git checkout -- dist/    # 撤销dist修改${NC}"
        echo -e "${YELLOW}  2. npm run build            # 重新编译${NC}"
        echo -e "${YELLOW}  3. 或添加到.gitignore       # 忽略dist目录${NC}"
    fi
}

# 设置Git hooks保护
setup_git_hooks() {
    echo -e "${BLUE}🔧 设置Git hooks保护...${NC}"
    
    local hooks_dir="$PROJECT_ROOT/.git/hooks"
    
    # 创建pre-commit hook
    cat > "$hooks_dir/pre-commit" << 'EOF'
#!/bin/bash
# TypeScript-Only 预提交检查

# 执行TypeScript-Only检查
if [ -f ".claude/rules/scripts/typescript-only-check.sh" ]; then
    bash .claude/rules/scripts/typescript-only-check.sh
    if [ $? -ne 0 ]; then
        echo "❌ 预提交检查失败，请修复后重新提交"
        exit 1
    fi
fi

# 检查dist目录修改
DIST_FILES=$(git diff --cached --name-only | grep '^dist/' || true)
if [ ! -z "$DIST_FILES" ]; then
    echo "❌ 禁止提交dist目录文件，请从暂存区移除:"
    echo "$DIST_FILES"
    echo ""
    echo "解决方案: git reset HEAD dist/"
    exit 1
fi

echo "✅ 预提交检查通过"
EOF
    
    chmod +x "$hooks_dir/pre-commit"
    echo -e "${GREEN}✅ Git pre-commit hook 已设置${NC}"
}

# 创建.gitignore保护
setup_gitignore_protection() {
    echo -e "${BLUE}📝 设置.gitignore保护...${NC}"
    
    local gitignore="$PROJECT_ROOT/.gitignore"
    
    # 检查.gitignore中是否包含dist目录
    if [ -f "$gitignore" ]; then
        if grep -q "^dist/" "$gitignore" 2>/dev/null; then
            echo -e "${GREEN}✅ .gitignore已包含dist目录保护${NC}"
        else
            echo -e "${YELLOW}添加dist目录到.gitignore...${NC}"
            echo "" >> "$gitignore"
            echo "# 编译输出目录 - 由TypeScript编译器生成" >> "$gitignore"
            echo "dist/" >> "$gitignore"
            echo "*.js.map" >> "$gitignore"
            echo "*.d.ts.map" >> "$gitignore"
            echo -e "${GREEN}✅ .gitignore保护已添加${NC}"
        fi
    else
        echo -e "${YELLOW}创建.gitignore文件...${NC}"
        cat > "$gitignore" << 'EOF'
# Dependencies
node_modules/
npm-debug.log*

# 编译输出目录 - 由TypeScript编译器生成
dist/
*.js.map
*.d.ts.map

# 环境配置
.env
.env.local

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Coverage
coverage/
EOF
        echo -e "${GREEN}✅ .gitignore文件已创建${NC}"
    fi
}

# 验证编译系统
verify_build_system() {
    echo -e "${BLUE}🔧 验证编译系统配置...${NC}"
    
    # 检查固定编译脚本
    if [ -f "$PROJECT_ROOT/install.sh" ]; then
        echo -e "${GREEN}✅ install.sh 存在 - 用于编译和全局安装${NC}"
    else
        echo -e "${YELLOW}⚠️  install.sh 不存在 - 需要创建标准安装脚本${NC}"
    fi
    
    if [ -f "$PROJECT_ROOT/build.sh" ]; then
        echo -e "${GREEN}✅ build.sh 存在 - 用于本地编译${NC}"
    else
        echo -e "${YELLOW}⚠️  build.sh 不存在 - 需要创建本地编译脚本${NC}"
    fi
    
    # 检查package.json中的scripts
    if [ -f "$PROJECT_ROOT/package.json" ]; then
        if grep -q '"build":' "$PROJECT_ROOT/package.json"; then
            echo -e "${GREEN}✅ package.json包含build脚本${NC}"
        else
            echo -e "${RED}❌ package.json缺少build脚本${NC}"
        fi
    fi
}

# 主执行函数
main() {
    echo -e "${BLUE}🚀 开始编译文件保护设置${NC}"
    echo ""
    
    check_dist_protection
    setup_git_hooks
    setup_gitignore_protection
    verify_build_system
    
    echo ""
    echo "======================================"
    echo -e "${GREEN}🎉 编译文件保护设置完成！${NC}"
    echo ""
    echo -e "${BLUE}📋 保护措施总结:${NC}"
    echo -e "${GREEN}  ✅ Git pre-commit hooks 已激活${NC}"
    echo -e "${GREEN}  ✅ .gitignore 规则已设置${NC}"
    echo -e "${GREEN}  ✅ dist目录保护已启用${NC}"
    echo ""
    echo -e "${YELLOW}📝 开发者注意事项:${NC}"
    echo -e "${YELLOW}  - 使用 ./install.sh 进行编译和全局安装${NC}"
    echo -e "${YELLOW}  - 使用 ./build.sh 进行仅本地编译${NC}"
    echo -e "${YELLOW}  - 不要直接修改dist目录下的文件${NC}"
    echo -e "${YELLOW}  - 所有源代码修改在src目录进行${NC}"
}

# 运行主函数
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi