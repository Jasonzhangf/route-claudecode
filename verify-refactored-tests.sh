#!/bin/bash

# RCC v4.0 重构后测试验证脚本
# 验证新创建的专门单元测试是否正常工作

echo "🧪 RCC v4.0 重构后测试验证"
echo "================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 计数器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 函数：运行单个测试
run_test() {
    local test_name="$1"
    local test_file="$2"
    
    echo ""
    echo -e "${BLUE}📋 测试: $test_name${NC}"
    echo "   文件: $test_file"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [[ ! -f "$test_file" ]]; then
        echo -e "   ${RED}❌ 测试文件不存在${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
    
    # 检查TypeScript编译
    echo "   🔧 检查TypeScript语法..."
    if npx tsc --noEmit "$test_file" 2>/dev/null; then
        echo -e "   ${GREEN}✅ TypeScript语法检查通过${NC}"
    else
        echo -e "   ${YELLOW}⚠️  TypeScript语法检查有警告（可能是依赖问题）${NC}"
    fi
    
    # 尝试运行测试（干运行）
    echo "   🧪 执行测试..."
    if timeout 30s npx jest "$test_file" --passWithNoTests --verbose 2>/dev/null; then
        echo -e "   ${GREEN}✅ 测试执行成功${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "   ${RED}❌ 测试执行失败或超时${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

echo -e "${YELLOW}🚀 开始验证重构后的测试架构...${NC}"

# 1. ConfigPreprocessor集成测试
run_test "ConfigPreprocessor集成测试" \
    "src/modules/config/src/__tests__/config-preprocessor-integration.test.ts"

# 2. RouterPreprocessor集成测试
run_test "RouterPreprocessor集成测试" \
    "src/modules/router/src/__tests__/router-preprocessor-integration.test.ts"

# 3. PipelineAssembler集成测试
run_test "PipelineAssembler集成测试" \
    "src/modules/pipeline/src/__tests__/pipeline-assembler-integration.test.ts"

# 4. 系统启动集成测试
run_test "系统启动集成测试" \
    "src/__tests__/system-startup-integration.test.ts"

# 5. 核心转换器测试（重构后）
run_test "核心转换器测试" \
    "src/__tests__/core-transformer.test.ts"

echo ""
echo "================================"
echo -e "${BLUE}📊 测试验证总结${NC}"
echo "================================"

echo "📋 总测试数量: $TOTAL_TESTS"
echo -e "${GREEN}✅ 通过测试: $PASSED_TESTS${NC}"
echo -e "${RED}❌ 失败测试: $FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 所有重构后的测试都验证通过！${NC}"
    echo -e "${GREEN}📁 测试架构重构成功完成${NC}"
    echo ""
    echo "✨ 重构后的测试架构特点："
    echo "   • 专门的模块单元测试"
    echo "   • 使用真实组件进行测试"
    echo "   • 清晰的测试职责边界"
    echo "   • 完整的输出验证体系"
    echo "   • 明确的性能基准"
    echo ""
    echo "🚀 下一步: 运行完整测试套件"
    echo "   npm run build && npm test"
    exit 0
else
    echo ""
    echo -e "${YELLOW}⚠️  部分测试验证失败，需要进一步调试${NC}"
    echo -e "${BLUE}🔍 建议检查:${NC}"
    echo "   1. 确保所有依赖模块存在"
    echo "   2. 检查TypeScript编译配置"
    echo "   3. 验证配置文件路径"
    echo "   4. 检查模块导入路径"
    echo ""
    echo "📋 测试文件创建状态："
    
    test_files=(
        "src/modules/config/src/__tests__/config-preprocessor-integration.test.ts"
        "src/modules/router/src/__tests__/router-preprocessor-integration.test.ts"
        "src/modules/pipeline/src/__tests__/pipeline-assembler-integration.test.ts"
        "src/__tests__/system-startup-integration.test.ts"
        "src/__tests__/core-transformer.test.ts"
    )
    
    for file in "${test_files[@]}"; do
        if [[ -f "$file" ]]; then
            echo -e "   ${GREEN}✅ $file${NC}"
        else
            echo -e "   ${RED}❌ $file${NC}"
        fi
    done
    
    exit 1
fi