#!/bin/bash

# 自动化合规检查系统
# 全面检查项目是否遵循TypeScript-Only政策

set -e

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
REPORT_FILE="$PROJECT_ROOT/typescript-compliance-report.json"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# 全局变量
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNINGS=0

# 检查结果数组
declare -a CHECK_RESULTS=()

# 日志函数
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    WARNINGS=$((WARNINGS + 1))
}

# 添加检查结果
add_check_result() {
    local check_name="$1"
    local status="$2"
    local details="$3"
    local suggestion="$4"
    
    CHECK_RESULTS+=("{\"name\":\"$check_name\",\"status\":\"$status\",\"details\":\"$details\",\"suggestion\":\"$suggestion\"}")
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
}

# 检查1: 项目结构合规性
check_project_structure() {
    log_info "检查项目结构合规性..."
    
    local errors=0
    
    # 检查必需目录
    local required_dirs=("src" ".claude/rules" ".claude/rules/scripts")
    for dir in "${required_dirs[@]}"; do
        if [ ! -d "$PROJECT_ROOT/$dir" ]; then
            log_error "缺少必需目录: $dir"
            errors=$((errors + 1))
        fi
    done
    
    # 检查必需文件
    local required_files=("tsconfig.json" "package.json")
    for file in "${required_files[@]}"; do
        if [ ! -f "$PROJECT_ROOT/$file" ]; then
            log_error "缺少必需文件: $file"
            errors=$((errors + 1))
        fi
    done
    
    if [ $errors -eq 0 ]; then
        log_success "项目结构合规"
        add_check_result "project_structure" "pass" "所有必需目录和文件都存在" ""
    else
        add_check_result "project_structure" "fail" "缺少$errors个必需目录或文件" "请确保项目包含所有必需的目录和文件"
    fi
}

# 检查2: TypeScript配置合规性
check_typescript_config() {
    log_info "检查TypeScript配置合规性..."
    
    if [ ! -f "$PROJECT_ROOT/tsconfig.json" ]; then
        log_error "tsconfig.json文件不存在"
        add_check_result "typescript_config" "fail" "tsconfig.json文件不存在" "创建符合规范的tsconfig.json文件"
        return
    fi
    
    local config_errors=0
    
    # 检查strict模式
    if ! grep -q '"strict":\s*true' "$PROJECT_ROOT/tsconfig.json"; then
        log_error "TypeScript配置未启用strict模式"
        config_errors=$((config_errors + 1))
    fi
    
    # 检查输出目录
    if ! grep -q '"outDir":\s*"./dist"' "$PROJECT_ROOT/tsconfig.json"; then
        log_warning "建议设置outDir为./dist"
    fi
    
    if [ $config_errors -eq 0 ]; then
        log_success "TypeScript配置合规"
        add_check_result "typescript_config" "pass" "TypeScript配置符合规范" ""
    else
        add_check_result "typescript_config" "fail" "TypeScript配置存在$config_errors个问题" "请更新tsconfig.json以符合TypeScript-Only规范"
    fi
}

# 检查3: 源代码文件类型合规性
check_source_files() {
    log_info "检查源代码文件类型合规性..."
    
    cd "$PROJECT_ROOT"
    
    # 检查src目录中的JavaScript文件
    local js_files=$(find src -name "*.js" 2>/dev/null | wc -l)
    local ts_files=$(find src -name "*.ts" 2>/dev/null | wc -l)
    
    if [ $js_files -gt 0 ]; then
        log_error "发现$js_files个JavaScript文件在src目录中"
        local js_file_list=$(find src -name "*.js" 2>/dev/null | head -5)
        add_check_result "source_files" "fail" "src目录包含$js_files个JavaScript文件" "将所有.js文件转换为.ts文件"
    else
        log_success "源代码目录只包含TypeScript文件 ($ts_files个.ts文件)"
        add_check_result "source_files" "pass" "源代码目录包含$ts_files个TypeScript文件，无JavaScript文件" ""
    fi
}

# 检查4: 编译状态
check_compilation() {
    log_info "检查TypeScript编译状态..."
    
    cd "$PROJECT_ROOT"
    
    # 运行TypeScript编译检查
    if npm run build > /dev/null 2>&1; then
        log_success "TypeScript编译成功"
        add_check_result "compilation" "pass" "TypeScript编译无错误" ""
    else
        log_error "TypeScript编译失败"
        # 获取编译错误详情
        local compile_errors=$(npm run build 2>&1 | grep -E "error TS[0-9]+" | wc -l)
        add_check_result "compilation" "fail" "TypeScript编译失败，发现$compile_errors个错误" "运行 'npm run build' 查看详细错误并修复"
    fi
}

# 检查5: 类型覆盖率
check_type_coverage() {
    log_info "检查TypeScript类型覆盖率..."
    
    cd "$PROJECT_ROOT"
    
    # 检查是否安装了type-coverage
    if ! npm list type-coverage > /dev/null 2>&1; then
        log_warning "type-coverage未安装，跳过类型覆盖率检查"
        add_check_result "type_coverage" "skip" "type-coverage工具未安装" "安装type-coverage: npm install --save-dev type-coverage"
        return
    fi
    
    # 获取类型覆盖率
    local coverage=$(npx type-coverage 2>/dev/null | grep "type coverage is" | awk '{print $4}' | sed 's/%//' || echo "0")
    
    if [ -z "$coverage" ]; then
        log_warning "无法获取类型覆盖率"
        add_check_result "type_coverage" "warning" "无法获取类型覆盖率信息" "检查type-coverage工具配置"
        return
    fi
    
    local coverage_int=${coverage%.*}
    
    if [ "$coverage_int" -ge 95 ]; then
        log_success "类型覆盖率: ${coverage}% (≥95%)"
        add_check_result "type_coverage" "pass" "类型覆盖率${coverage}%，符合≥95%的要求" ""
    else
        log_error "类型覆盖率: ${coverage}% (<95%)"
        add_check_result "type_coverage" "fail" "类型覆盖率${coverage}%，低于95%要求" "增加类型定义以提高覆盖率，运行 'npx type-coverage --detail' 查看详情"
    fi
}

# 检查6: ESLint规则合规性
check_eslint_compliance() {
    log_info "检查ESLint规则合规性..."
    
    cd "$PROJECT_ROOT"
    
    # 检查是否安装了ESLint
    if ! npm list eslint > /dev/null 2>&1; then
        log_warning "ESLint未安装，跳过lint检查"
        add_check_result "eslint_compliance" "skip" "ESLint工具未安装" "安装ESLint及TypeScript插件"
        return
    fi
    
    # 运行ESLint检查
    if npx eslint src/**/*.ts --ext .ts > /dev/null 2>&1; then
        log_success "ESLint检查通过"
        add_check_result "eslint_compliance" "pass" "代码符合ESLint规则" ""
    else
        local lint_errors=$(npx eslint src/**/*.ts --ext .ts 2>&1 | grep -E "error|warning" | wc -l)
        log_error "ESLint检查失败，发现$lint_errors个问题"
        add_check_result "eslint_compliance" "fail" "ESLint发现$lint_errors个问题" "运行 'npx eslint src/**/*.ts --ext .ts --fix' 自动修复"
    fi
}

# 检查7: any类型使用检查
check_any_usage() {
    log_info "检查any类型使用情况..."
    
    cd "$PROJECT_ROOT"
    
    # 搜索any类型使用
    local any_count=$(grep -r ": any\|<any>\|any\[\]" src/ --include="*.ts" 2>/dev/null | grep -v "// @ts-expect-error" | wc -l || echo "0")
    
    if [ "$any_count" -le 5 ]; then
        log_success "any类型使用适度 ($any_count处)"
        add_check_result "any_usage" "pass" "any类型使用$any_count处，在合理范围内" ""
    else
        log_warning "any类型使用过多 ($any_count处)"
        add_check_result "any_usage" "warning" "any类型使用$any_count处，建议减少" "为复杂对象定义具体接口，使用联合类型替代any"
    fi
}

# 检查8: Git hooks设置
check_git_hooks() {
    log_info "检查Git hooks设置..."
    
    local hooks_dir="$PROJECT_ROOT/.git/hooks"
    
    if [ -f "$hooks_dir/pre-commit" ] && [ -x "$hooks_dir/pre-commit" ]; then
        log_success "Git pre-commit hook已设置"
        add_check_result "git_hooks" "pass" "Git pre-commit hook已正确设置" ""
    else
        log_error "Git pre-commit hook未设置或不可执行"
        add_check_result "git_hooks" "fail" "Git pre-commit hook缺失" "运行 'bash .claude/rules/scripts/dist-protection.sh' 设置hooks"
    fi
}

# 检查9: 编译脚本合规性
check_build_scripts() {
    log_info "检查编译脚本合规性..."
    
    local script_errors=0
    
    # 检查install.sh
    if [ -f "$PROJECT_ROOT/install.sh" ]; then
        log_success "install.sh脚本存在"
    else
        log_error "install.sh脚本不存在"
        script_errors=$((script_errors + 1))
    fi
    
    # 检查build.sh
    if [ -f "$PROJECT_ROOT/build.sh" ]; then
        log_success "build.sh脚本存在"
    else
        log_warning "build.sh脚本不存在"
    fi
    
    if [ $script_errors -eq 0 ]; then
        add_check_result "build_scripts" "pass" "编译脚本设置正确" ""
    else
        add_check_result "build_scripts" "fail" "缺少必需的编译脚本" "创建缺失的编译脚本"
    fi
}

# 检查10: 文档合规性
check_documentation() {
    log_info "检查文档合规性..."
    
    local doc_errors=0
    
    # 检查规则文档
    if [ -f "$PROJECT_ROOT/.claude/rules/typescript-only-policy.md" ]; then
        log_success "TypeScript-Only政策文档存在"
    else
        log_error "TypeScript-Only政策文档不存在"
        doc_errors=$((doc_errors + 1))
    fi
    
    # 检查工作流文档
    if [ -f "$PROJECT_ROOT/.claude/rules/typescript-development-workflow.md" ]; then
        log_success "开发工作流文档存在"
    else
        log_error "开发工作流文档不存在"
        doc_errors=$((doc_errors + 1))
    fi
    
    if [ $doc_errors -eq 0 ]; then
        add_check_result "documentation" "pass" "文档完整" ""
    else
        add_check_result "documentation" "fail" "缺少$doc_errors个必需文档" "创建缺失的规则文档"
    fi
}

# 生成JSON报告
generate_report() {
    log_info "生成合规检查报告..."
    
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local status="pass"
    
    if [ $FAILED_CHECKS -gt 0 ]; then
        status="fail"
    elif [ $WARNINGS -gt 0 ]; then
        status="warning"
    fi
    
    # 构建JSON报告
    local json_results=$(IFS=,; echo "${CHECK_RESULTS[*]}")
    
    cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$timestamp",
  "overall_status": "$status",
  "summary": {
    "total_checks": $TOTAL_CHECKS,
    "passed": $PASSED_CHECKS,
    "failed": $FAILED_CHECKS,
    "warnings": $WARNINGS
  },
  "compliance_score": $(( (PASSED_CHECKS * 100) / TOTAL_CHECKS )),
  "checks": [$json_results]
}
EOF
    
    log_success "报告已生成: $REPORT_FILE"
}

# 显示总结
show_summary() {
    echo ""
    echo "======================================"
    echo -e "${PURPLE}📊 TypeScript-Only 合规检查总结${NC}"
    echo "======================================"
    echo -e "${BLUE}总检查项目: $TOTAL_CHECKS${NC}"
    echo -e "${GREEN}通过: $PASSED_CHECKS${NC}"
    echo -e "${RED}失败: $FAILED_CHECKS${NC}"
    echo -e "${YELLOW}警告: $WARNINGS${NC}"
    echo ""
    
    local compliance_score=$(( (PASSED_CHECKS * 100) / TOTAL_CHECKS ))
    echo -e "${BLUE}合规得分: $compliance_score%${NC}"
    
    if [ $FAILED_CHECKS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}🎉 恭喜！项目完全符合TypeScript-Only规范${NC}"
    elif [ $FAILED_CHECKS -eq 0 ]; then
        echo -e "${YELLOW}⚠️  项目基本符合规范，但有一些警告需要注意${NC}"
    else
        echo -e "${RED}❌ 项目不符合TypeScript-Only规范，需要修复$FAILED_CHECKS个问题${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}详细报告: $REPORT_FILE${NC}"
}

# 主执行函数
main() {
    echo -e "${PURPLE}🚀 开始 TypeScript-Only 自动化合规检查${NC}"
    echo "========================================"
    echo ""
    
    # 执行所有检查
    check_project_structure
    check_typescript_config
    check_source_files
    check_compilation
    check_type_coverage
    check_eslint_compliance
    check_any_usage
    check_git_hooks
    check_build_scripts
    check_documentation
    
    # 生成报告和总结
    generate_report
    show_summary
    
    # 返回适当的退出码
    if [ $FAILED_CHECKS -gt 0 ]; then
        exit 1
    else
        exit 0
    fi
}

# 运行主函数
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi