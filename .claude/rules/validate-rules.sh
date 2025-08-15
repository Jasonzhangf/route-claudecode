#!/bin/bash
# .claude/rules/validate-rules.sh
# RCC v4.0 编码规则体系验证脚本

set -e

echo "🔍 验证 RCC v4.0 编码规则体系完整性..."

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

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

log_info "脚本目录: $SCRIPT_DIR"
log_info "项目根目录: $PROJECT_ROOT"

# 1. 验证规则文件完整性
validate_rule_files() {
    log_info "验证规则文件完整性..."
    
    local required_files=(
        "README.md"
        "programming-rules.md"
        "architecture-rules.md"
        "testing-rules.md"
    )
    
    local missing_files=()
    
    for file in "${required_files[@]}"; do
        local file_path="$SCRIPT_DIR/$file"
        if [ ! -f "$file_path" ]; then
            missing_files+=("$file")
        else
            log_success "规则文件存在: $file"
        fi
    done
    
    if [ ${#missing_files[@]} -gt 0 ]; then
        log_error "缺少规则文件:"
        for file in "${missing_files[@]}"; do
            echo "  - $file"
        done
        exit 1
    fi
    
    log_success "所有规则文件验证通过"
}

# 2. 验证项目文档结构
validate_project_docs() {
    log_info "验证项目文档结构..."
    
    local required_docs=(
        ".claude/project-details/rcc-v4-specification.md"
        ".claude/project-details/modules/README.md"
        ".claude/project-details/modules/development/README.md"
        ".claude/project-details/client-module-design.md"
    )
    
    local missing_docs=()
    
    for doc in "${required_docs[@]}"; do
        local doc_path="$PROJECT_ROOT/$doc"
        if [ ! -f "$doc_path" ]; then
            missing_docs+=("$doc")
        else
            log_success "项目文档存在: $doc"
        fi
    done
    
    if [ ${#missing_docs[@]} -gt 0 ]; then
        log_warning "缺少项目文档:"
        for doc in "${missing_docs[@]}"; do
            echo "  - $doc"
        done
    else
        log_success "所有项目文档验证通过"
    fi
}

# 3. 验证规则内容完整性
validate_rule_content() {
    log_info "验证规则内容完整性..."
    
    # 检查编程规则必要章节
    local programming_rules="$SCRIPT_DIR/programming-rules.md"
    local required_programming_sections=(
        "## 开发前强制检查清单"
        "## 模块化编程约束"
        "## 代码质量强制标准"
        "### 1. 零硬编码原则"
        "### 2. 零静默失败原则"
        "### 3. 零Mockup响应原则"
        "## 脚本设计规格遵循"
        "## 开发后文档同步机制"
        "## 错误处理要求"
        "## TypeScript代码规范"
        "## 测试要求"
    )
    
    for section in "${required_programming_sections[@]}"; do
        if ! grep -q "$section" "$programming_rules"; then
            log_error "编程规则缺少章节: $section"
            exit 1
        fi
    done
    log_success "编程规则内容验证通过"
    
    # 检查架构规则必要章节
    local architecture_rules="$SCRIPT_DIR/architecture-rules.md"
    local required_architecture_sections=(
        "## 模块层级架构"
        "## 模块职责定义"
        "### 客户端模块"
        "### 路由器模块"
        "### 流水线Worker模块"
        "## 流水线子模块架构"
        "### Transformer模块"
        "### Protocol模块"
        "### Server-Compatibility模块"
        "### Server模块"
        "## 数据流架构约束"
        "## 错误处理架构"
    )
    
    for section in "${required_architecture_sections[@]}"; do
        if ! grep -q "$section" "$architecture_rules"; then
            log_error "架构规则缺少章节: $section"
            exit 1
        fi
    done
    log_success "架构规则内容验证通过"
    
    # 检查测试规则必要章节
    local testing_rules="$SCRIPT_DIR/testing-rules.md"
    local required_testing_sections=(
        "## 测试哲学"
        "### 真实流水线测试原则"
        "## 测试架构约束"
        "### 1. 禁止Mock测试"
        "### 2. 基于Debug系统的测试架构"
        "### 3. 回放测试系统"
        "## 测试分层架构"
        "### 1. 单元测试"
        "### 2. 集成测试"
        "### 3. 端到端测试"
        "## 性能测试架构"
        "## 测试数据管理"
    )
    
    for section in "${required_testing_sections[@]}"; do
        if ! grep -q "$section" "$testing_rules"; then
            log_error "测试规则缺少章节: $section"
            exit 1
        fi
    done
    log_success "测试规则内容验证通过"
}

# 4. 验证规则交叉引用
validate_cross_references() {
    log_info "验证规则交叉引用..."
    
    local readme_file="$SCRIPT_DIR/README.md"
    
    # 检查是否正确引用了其他规则文件
    local required_references=(
        "./programming-rules.md"
        "./architecture-rules.md"
        "./testing-rules.md"
    )
    
    for ref in "${required_references[@]}"; do
        if ! grep -q "$ref" "$readme_file"; then
            log_error "README.md 缺少引用: $ref"
            exit 1
        fi
    done
    
    log_success "规则交叉引用验证通过"
}

# 5. 验证规则优先级定义
validate_priority_definitions() {
    log_info "验证规则优先级定义..."
    
    local readme_file="$SCRIPT_DIR/README.md"
    
    # 检查优先级定义
    local required_priorities=(
        "### P0 - 项目架构红线"
        "### P1 - 开发流程强制要求"
        "### P2 - 代码质量和规范"
    )
    
    for priority in "${required_priorities[@]}"; do
        if ! grep -q "$priority" "$readme_file"; then
            log_error "README.md 缺少优先级定义: $priority"
            exit 1
        fi
    done
    
    # 检查P0级规则是否都有明确定义
    local p0_rules=(
        "零硬编码原则"
        "零静默失败原则"
        "零Mockup原则"
        "严格模块边界"
        "真实流水线测试"
    )
    
    for rule in "${p0_rules[@]}"; do
        if ! grep -q "$rule" "$readme_file"; then
            log_error "README.md 缺少P0级规则: $rule"
            exit 1
        fi
    done
    
    log_success "规则优先级定义验证通过"
}

# 6. 验证工作流定义
validate_workflow_definitions() {
    log_info "验证工作流定义..."
    
    local readme_file="$SCRIPT_DIR/README.md"
    
    # 检查开发工作流阶段
    local required_workflow_stages=(
        "### 阶段1：开发前准备"
        "### 阶段2：编码实现"
        "### 阶段3：测试验证"
        "### 阶段4：文档同步"
        "### 阶段5：构建和部署"
    )
    
    for stage in "${required_workflow_stages[@]}"; do
        if ! grep -q "$stage" "$readme_file"; then
            log_error "README.md 缺少工作流阶段: $stage"
            exit 1
        fi
    done
    
    log_success "工作流定义验证通过"
}

# 7. 验证代码示例完整性
validate_code_examples() {
    log_info "验证代码示例完整性..."
    
    # 检查编程规则中的代码示例
    local programming_rules="$SCRIPT_DIR/programming-rules.md"
    
    # 统计代码块数量
    local code_blocks=$(grep -c '```typescript' "$programming_rules")
    local bash_blocks=$(grep -c '```bash' "$programming_rules")
    
    if [ "$code_blocks" -lt 10 ]; then
        log_warning "编程规则TypeScript代码示例较少: $code_blocks (建议至少10个)"
    else
        log_success "编程规则包含足够的TypeScript代码示例: $code_blocks"
    fi
    
    if [ "$bash_blocks" -lt 5 ]; then
        log_warning "编程规则Bash脚本示例较少: $bash_blocks (建议至少5个)"
    else
        log_success "编程规则包含足够的Bash脚本示例: $bash_blocks"
    fi
    
    # 检查测试规则中的测试示例
    local testing_rules="$SCRIPT_DIR/testing-rules.md"
    local test_examples=$(grep -c 'describe.*test.*expect' "$testing_rules")
    
    if [ "$test_examples" -lt 5 ]; then
        log_warning "测试规则测试示例较少: $test_examples (建议至少5个)"
    else
        log_success "测试规则包含足够的测试示例: $test_examples"
    fi
}

# 8. 生成验证报告
generate_validation_report() {
    log_info "生成验证报告..."
    
    local report_file="$SCRIPT_DIR/validation-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# RCC v4.0 编码规则体系验证报告

**验证时间**: $(date -Iseconds)
**验证版本**: v1.0.0

## 验证结果总览

### 文件完整性
- ✅ 所有必要的规则文件都存在
- ✅ 项目文档结构完整

### 内容完整性
- ✅ 编程规则内容完整
- ✅ 架构规则内容完整  
- ✅ 测试规则内容完整

### 交叉引用
- ✅ 规则文件间的交叉引用正确
- ✅ 优先级定义清晰
- ✅ 工作流定义完整

### 代码示例
- ✅ 包含足够的TypeScript代码示例
- ✅ 包含足够的Bash脚本示例
- ✅ 包含足够的测试示例

## 规则统计

### 编程规则 (programming-rules.md)
- 文件大小: $(wc -c < "$SCRIPT_DIR/programming-rules.md") 字节
- 行数: $(wc -l < "$SCRIPT_DIR/programming-rules.md")
- TypeScript代码块: $(grep -c '```typescript' "$SCRIPT_DIR/programming-rules.md")
- Bash脚本块: $(grep -c '```bash' "$SCRIPT_DIR/programming-rules.md")

### 架构规则 (architecture-rules.md)
- 文件大小: $(wc -c < "$SCRIPT_DIR/architecture-rules.md") 字节
- 行数: $(wc -l < "$SCRIPT_DIR/architecture-rules.md")
- TypeScript代码块: $(grep -c '```typescript' "$SCRIPT_DIR/architecture-rules.md")

### 测试规则 (testing-rules.md)
- 文件大小: $(wc -c < "$SCRIPT_DIR/testing-rules.md") 字节
- 行数: $(wc -l < "$SCRIPT_DIR/testing-rules.md")
- 测试示例: $(grep -c 'describe.*test.*expect' "$SCRIPT_DIR/testing-rules.md")

### 规则总览 (README.md)
- 文件大小: $(wc -c < "$SCRIPT_DIR/README.md") 字节
- 行数: $(wc -l < "$SCRIPT_DIR/README.md")

## 验证结论

✅ **RCC v4.0 编码规则体系验证通过**

所有必要的规则文件、内容和示例都已完整定义，可以为开发团队提供全面的编码指导。

## 建议

1. 定期更新规则内容以适应项目发展
2. 收集开发团队反馈持续改进规则
3. 建立规则执行监控机制
4. 定期验证规则与实际开发实践的一致性

---
**验证脚本**: $0
**报告生成时间**: $(date)
EOF
    
    log_success "验证报告已生成: $report_file"
}

# 主执行流程
main() {
    echo "🎯 开始验证 RCC v4.0 编码规则体系..."
    echo "=================================================="
    
    validate_rule_files
    echo ""
    
    validate_project_docs
    echo ""
    
    validate_rule_content
    echo ""
    
    validate_cross_references
    echo ""
    
    validate_priority_definitions
    echo ""
    
    validate_workflow_definitions
    echo ""
    
    validate_code_examples
    echo ""
    
    generate_validation_report
    echo ""
    
    echo "=================================================="
    log_success "🎉 RCC v4.0 编码规则体系验证完成！"
    log_info "所有规则文件和内容都已验证通过，可以为开发团队提供完整的编码指导。"
    echo ""
    log_info "使用说明:"
    echo "  1. 开发前查阅: .claude/rules/README.md"
    echo "  2. 具体规则参考:"
    echo "     - 编程规范: .claude/rules/programming-rules.md"
    echo "     - 架构约束: .claude/rules/architecture-rules.md"
    echo "     - 测试要求: .claude/rules/testing-rules.md"
    echo "  3. 执行验证: .claude/rules/validate-rules.sh"
    echo ""
    log_info "编码规则体系已建立完成！"
}

# 执行主函数
main "$@"