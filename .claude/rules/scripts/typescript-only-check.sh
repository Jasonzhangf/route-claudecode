#!/bin/bash

# TypeScript-Only 强制执行检查脚本
# 用于预提交和开发时检查

set -e

echo "🔍 执行 TypeScript-Only 强制检查..."
echo "======================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 错误计数器
ERROR_COUNT=0

# 检查函数
check_javascript_files() {
    echo -e "${BLUE}📂 检查JavaScript文件修改...${NC}"
    
    # 检查staged文件中的JavaScript文件
    JS_FILES=$(git diff --cached --name-only 2>/dev/null | grep -E '\.(js|jsx|mjs)$' | grep -v '^dist/' | grep -v '^node_modules/' || true)
    
    if [ ! -z "$JS_FILES" ]; then
        echo -e "${RED}❌ 错误: 检测到JavaScript文件修改，违反TypeScript-Only政策${NC}"
        echo -e "${RED}违规文件:${NC}"
        echo "$JS_FILES" | while read -r file; do
            echo -e "${RED}  - $file${NC}"
        done
        echo ""
        echo -e "${YELLOW}💡 解决方案: 使用TypeScript (.ts) 文件替代JavaScript文件${NC}"
        echo -e "${YELLOW}   1. 将 .js 文件重命名为 .ts${NC}"
        echo -e "${YELLOW}   2. 添加适当的TypeScript类型定义${NC}"
        echo -e "${YELLOW}   3. 修复任何类型错误${NC}"
        ERROR_COUNT=$((ERROR_COUNT + 1))
        return 1
    else
        echo -e "${GREEN}✅ JavaScript文件检查通过${NC}"
        return 0
    fi
}

check_dist_modification() {
    echo -e "${BLUE}📦 检查dist目录修改...${NC}"
    
    # 检查是否有dist目录文件被修改
    DIST_FILES=$(git diff --cached --name-only 2>/dev/null | grep '^dist/' || true)
    
    if [ ! -z "$DIST_FILES" ]; then
        echo -e "${RED}❌ 错误: 检测到dist目录文件修改，违反编译文件保护政策${NC}"
        echo -e "${RED}违规文件:${NC}"
        echo "$DIST_FILES" | while read -r file; do
            echo -e "${RED}  - $file${NC}"
        done
        echo ""
        echo -e "${YELLOW}💡 解决方案: 不要直接修改编译后文件${NC}"
        echo -e "${YELLOW}   1. 修改src目录下的TypeScript源文件${NC}"
        echo -e "${YELLOW}   2. 运行 'npm run build' 重新编译${NC}"
        echo -e "${YELLOW}   3. 提交源文件修改，忽略dist目录${NC}"
        ERROR_COUNT=$((ERROR_COUNT + 1))
        return 1
    else
        echo -e "${GREEN}✅ dist目录保护检查通过${NC}"
        return 0
    fi
}

check_typescript_compilation() {
    echo -e "${BLUE}🔧 检查TypeScript编译...${NC}"
    
    # 检查TypeScript编译
    if npm run build > /dev/null 2>&1; then
        echo -e "${GREEN}✅ TypeScript编译成功${NC}"
        return 0
    else
        echo -e "${RED}❌ 错误: TypeScript编译失败${NC}"
        echo ""
        echo -e "${YELLOW}💡 解决方案: 修复TypeScript编译错误${NC}"
        echo -e "${YELLOW}   运行以下命令查看详细错误:${NC}"
        echo -e "${YELLOW}   npm run build${NC}"
        ERROR_COUNT=$((ERROR_COUNT + 1))
        return 1
    fi
}

check_type_coverage() {
    echo -e "${BLUE}📊 检查TypeScript类型覆盖率...${NC}"
    
    # 检查是否安装了type-coverage
    if ! npm list type-coverage > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  type-coverage未安装，跳过类型覆盖率检查${NC}"
        echo -e "${YELLOW}   安装命令: npm install --save-dev type-coverage${NC}"
        return 0
    fi
    
    # 检查类型覆盖率
    COVERAGE=$(npx type-coverage --detail 2>/dev/null | grep "type coverage is" | awk '{print $4}' | sed 's/%//' || echo "0")
    
    if [ -z "$COVERAGE" ]; then
        echo -e "${YELLOW}⚠️  无法获取类型覆盖率信息${NC}"
        return 0
    fi
    
    # 将覆盖率转换为整数进行比较
    COVERAGE_INT=${COVERAGE%.*}
    
    if [ "$COVERAGE_INT" -lt 95 ]; then
        echo -e "${RED}❌ 错误: TypeScript类型覆盖率 ${COVERAGE}% 低于要求的95%${NC}"
        echo ""
        echo -e "${YELLOW}💡 解决方案: 提高类型覆盖率${NC}"
        echo -e "${YELLOW}   1. 添加缺失的类型定义${NC}"
        echo -e "${YELLOW}   2. 减少any类型的使用${NC}"
        echo -e "${YELLOW}   3. 为函数添加明确的返回类型${NC}"
        echo -e "${YELLOW}   运行详细报告: npx type-coverage --detail${NC}"
        ERROR_COUNT=$((ERROR_COUNT + 1))
        return 1
    else
        echo -e "${GREEN}✅ TypeScript类型覆盖率: ${COVERAGE}%${NC}"
        return 0
    fi
}

check_eslint_typescript() {
    echo -e "${BLUE}🔍 检查TypeScript ESLint规则...${NC}"
    
    # 检查是否安装了ESLint
    if ! npm list eslint > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  ESLint未安装，跳过lint检查${NC}"
        return 0
    fi
    
    # 运行ESLint检查TypeScript文件
    if npx eslint src/**/*.ts --ext .ts > /dev/null 2>&1; then
        echo -e "${GREEN}✅ TypeScript ESLint检查通过${NC}"
        return 0
    else
        echo -e "${RED}❌ 错误: TypeScript ESLint检查失败${NC}"
        echo ""
        echo -e "${YELLOW}💡 解决方案: 修复ESLint错误${NC}"
        echo -e "${YELLOW}   运行详细检查: npx eslint src/**/*.ts --ext .ts${NC}"
        echo -e "${YELLOW}   自动修复: npx eslint src/**/*.ts --ext .ts --fix${NC}"
        ERROR_COUNT=$((ERROR_COUNT + 1))
        return 1
    fi
}

check_any_usage() {
    echo -e "${BLUE}🚫 检查any类型使用...${NC}"
    
    # 搜索src目录中的any类型使用
    ANY_USAGE=$(grep -r ": any\|<any>\|any\[\]\|any |" src/ --include="*.ts" | grep -v "// @ts-expect-error" | wc -l || echo "0")
    
    if [ "$ANY_USAGE" -gt 5 ]; then
        echo -e "${RED}❌ 警告: 检测到过多any类型使用 (${ANY_USAGE}处)${NC}"
        echo ""
        echo -e "${YELLOW}💡 建议: 减少any类型使用${NC}"
        echo -e "${YELLOW}   1. 为复杂对象定义具体接口${NC}"
        echo -e "${YELLOW}   2. 使用联合类型替代any${NC}"
        echo -e "${YELLOW}   3. 使用泛型提供类型安全${NC}"
        echo -e "${YELLOW}   查看具体位置: grep -r ': any\\|<any>\\|any\\[\\]' src/ --include='*.ts'${NC}"
        # 不增加ERROR_COUNT，仅作为警告
    else
        echo -e "${GREEN}✅ any类型使用检查通过 (${ANY_USAGE}处)${NC}"
    fi
}

# 主检查流程
main() {
    echo -e "${BLUE}🚀 开始TypeScript-Only合规检查${NC}"
    echo ""
    
    # 执行所有检查
    check_javascript_files
    check_dist_modification
    check_typescript_compilation
    check_type_coverage
    check_eslint_typescript
    check_any_usage
    
    echo ""
    echo "======================================"
    
    # 总结结果
    if [ $ERROR_COUNT -eq 0 ]; then
        echo -e "${GREEN}🎉 所有TypeScript-Only检查通过！${NC}"
        echo -e "${GREEN}   可以安全地继续开发或提交代码${NC}"
        exit 0
    else
        echo -e "${RED}❌ 发现 $ERROR_COUNT 个违规项目${NC}"
        echo -e "${RED}   必须修复所有问题后才能继续${NC}"
        echo ""
        echo -e "${YELLOW}📝 常用修复命令:${NC}"
        echo -e "${YELLOW}   npm run build          # 编译TypeScript${NC}"
        echo -e "${YELLOW}   npm run type-check      # 仅类型检查${NC}"
        echo -e "${YELLOW}   npx eslint --fix        # 自动修复lint错误${NC}"
        echo -e "${YELLOW}   npx type-coverage --detail  # 查看类型覆盖率详情${NC}"
        exit 1
    fi
}

# 如果作为脚本直接运行
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi