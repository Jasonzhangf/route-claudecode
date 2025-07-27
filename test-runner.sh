#!/bin/bash

# Claude Code Router - 测试运行器
# 项目所有者: Jason Zhang
# 规则：
# 1. 测试一定使用脚本
# 2. 用一句话总结测试的用例，并且用其命名测试文件
# 3. 每个测试文件有同名md，每次测试总结更新该md
# 4. 每次发现问题要测试，先去test文件夹查看是否已经有类似文件

function show_usage() {
    echo "🧪 Claude Code Router 测试运行器"
    echo "================================="
    echo "使用方法："
    echo "  $0 <测试文件路径>                    - 运行单个测试"
    echo "  $0 --list                          - 列出所有测试文件"
    echo "  $0 --search <关键词>               - 搜索相关测试文件"
    echo "  $0 --category <分类>               - 运行指定分类的测试"
    echo ""
    echo "测试分类："
    echo "  - pipeline     流水线测试 (6步骤标准流程)"
    echo "  - functional   功能测试 (工具调用、多轮对话等)"
    echo "  - integration  集成测试 (端到端、供应商集成)"
    echo "  - performance  性能测试 (调试、解析性能)"
    echo ""
    echo "示例："
    echo "  $0 test/functional/test-cli-tool-issue.js"
    echo "  $0 --search token"
    echo "  $0 --category pipeline"
}

function list_tests() {
    echo "📋 所有可用测试文件："
    echo ""
    
    for category in pipeline functional integration performance; do
        echo "📂 $category/"
        find test/$category -name "*.js" 2>/dev/null | sort | while read file; do
            if [ -f "$file" ]; then
                # 提取测试用例描述（从文件名或注释中）
                description=$(head -5 "$file" | grep -E "^[[:space:]]*\*[[:space:]]*测试用例:|^[[:space:]]*//[[:space:]]*测试用例:" | head -1 | sed 's/.*测试用例:[[:space:]]*//')
                if [ -z "$description" ]; then
                    description="（无描述）"
                fi
                echo "   $(basename $file) - $description"
            fi
        done
        echo ""
    done
}

function search_tests() {
    local keyword="$1"
    echo "🔍 搜索关键词：$keyword"
    echo ""
    
    # 搜索文件名
    echo "📄 文件名匹配："
    find test -name "*$keyword*.js" 2>/dev/null | sort
    echo ""
    
    # 搜索文件内容  
    echo "📝 内容匹配："
    find test -name "*.js" -exec grep -l "$keyword" {} \; 2>/dev/null | sort
    echo ""
    
    # 搜索MD文档
    echo "📚 文档匹配："
    find test -name "*.md" -exec grep -l "$keyword" {} \; 2>/dev/null | sort
}

function run_category() {
    local category="$1"
    echo "🧪 运行 $category 分类测试..."
    echo ""
    
    if [ ! -d "test/$category" ]; then
        echo "❌ 分类不存在: $category"
        return 1
    fi
    
    find test/$category -name "*.js" | sort | while read test_file; do
        if [ -f "$test_file" ]; then
            echo "🔸 运行: $(basename $test_file)"
            run_single_test "$test_file"
            echo ""
        fi
    done
}

function run_single_test() {
    local test_file="$1"
    local md_file="${test_file%.js}.md"
    local start_time=$(date +%s)
    
    echo "🧪 运行测试: $(basename $test_file)"
    echo "📄 测试文件: $test_file"
    echo "📋 文档文件: $md_file"
    echo "⏰ 开始时间: $(date)"
    echo ""
    
    # 检查测试文件是否存在
    if [ ! -f "$test_file" ]; then
        echo "❌ 测试文件不存在: $test_file"
        return 1
    fi
    
    # 运行测试并捕获输出
    local log_file="/tmp/test-$(basename ${test_file%.js})-$(date +%Y%m%d-%H%M%S).log"
    local exit_code=0
    
    echo "📊 执行测试..."
    if node "$test_file" > "$log_file" 2>&1; then
        echo "✅ 测试通过"
        local status="PASSED"
    else
        echo "❌ 测试失败"
        local status="FAILED"
        exit_code=1
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo "⏱️  执行时间: ${duration}秒"
    echo "📋 日志文件: $log_file"
    
    # 更新或创建MD文档
    update_test_documentation "$test_file" "$md_file" "$status" "$duration" "$log_file"
    
    return $exit_code
}

function update_test_documentation() {
    local test_file="$1"
    local md_file="$2" 
    local status="$3"
    local duration="$4"
    local log_file="$5"
    
    # 提取测试用例描述
    local test_case=$(basename ${test_file%.js} | sed 's/test-//' | sed 's/-/ /g')
    local description=$(head -10 "$test_file" | grep -E "测试用例:|测试目标:" | head -1 | sed 's/.*://')
    
    # 创建或更新MD文档
    cat > "$md_file" << EOF
# $(basename ${test_file%.js})

## 测试用例
$test_case

## 测试描述  
$description

## 最近执行记录

### $(date '+%Y-%m-%d %H:%M:%S')
- **状态**: $status
- **执行时间**: ${duration}秒  
- **日志文件**: $log_file

$(if [ "$status" = "PASSED" ]; then
    echo "✅ 测试通过"
    echo ""
    echo "### 测试结果摘要"
    tail -20 "$log_file" | grep -E "✅|❌|📊|分析|问题|错误" | head -10
else
    echo "❌ 测试失败"
    echo ""  
    echo "### 错误信息"
    tail -50 "$log_file" | grep -E "Error|错误|Failed|失败" | head -10
    echo ""
    echo "### 完整日志"
    echo "\`\`\`"
    tail -100 "$log_file"
    echo "\`\`\`"
fi)

## 历史执行记录
$(if [ -f "$md_file.backup" ]; then
    grep -A 20 "## 最近执行记录" "$md_file.backup" | tail -n +2 | head -20 || true
fi)

## 相关文件
- 测试脚本: \`$test_file\`
- 最新日志: \`$log_file\`

EOF

    # 备份旧版本
    if [ -f "$md_file" ]; then
        cp "$md_file" "$md_file.backup" 2>/dev/null || true
    fi
    
    echo "📝 文档已更新: $md_file"
}

# 主程序
case "$1" in
    "")
        show_usage
        ;;
    "--help"|"-h")
        show_usage
        ;;
    "--list")
        list_tests
        ;;
    "--search")
        if [ -z "$2" ]; then
            echo "❌ 请提供搜索关键词"
            exit 1
        fi
        search_tests "$2"
        ;;
    "--category")
        if [ -z "$2" ]; then
            echo "❌ 请提供测试分类"
            exit 1
        fi
        run_category "$2"
        ;;
    *)
        if [ -f "$1" ]; then
            run_single_test "$1"
        else
            echo "❌ 文件不存在: $1"
            echo ""
            show_usage
            exit 1
        fi
        ;;
esac