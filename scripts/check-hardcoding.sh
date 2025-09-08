#!/bin/bash
# scripts/check-hardcoding.sh
# 硬编码检查脚本 - 强制执行零硬编码原则

set -e

echo "🔍 检查硬编码违规..."

# RCC v4.0主项目路径检测 - 只在主项目目录执行，跳过子项目
PROJECT_ROOT="/Users/fanzhang/Documents/github/route-claudecode/workspace/main-development"

# 检查是否在主项目目录（不是子目录如architecture-engineer）
if [[ "$PWD" != "$PROJECT_ROOT" ]]; then
    echo "ℹ️ [硬编码检查] 不在RCC v4.0主项目目录，跳过检查: $PWD" >&2
    exit 0
fi

# 确认这是正确的RCC主项目
if [[ ! -f "package.json" ]] || [[ ! -d "src" ]] || [[ ! -f "scripts/check-hardcoding.sh" ]]; then
    echo "ℹ️ [硬编码检查] 项目结构不匹配，跳过检查" >&2
    exit 0
fi

echo "📁 [硬编码检查] 在RCC v4.0项目中执行硬编码检查: $PWD" >&2

# 检查是否有硬编码的URL
check_hardcoded_urls() {
    echo "📡 检查硬编码URL..."
    
    local url_patterns=(
        "https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
        "localhost:[0-9]+"
        "127\.0\.0\.1:[0-9]+"
    )
    
    local found_violations=false
    
    for pattern in "${url_patterns[@]}"; do
        # 排除constants目录和测试文件
        local violating_files=$(git ls-files "src/**/*.ts" | grep -v "constants" | grep -v "__tests__" | xargs grep -l "$pattern" 2>/dev/null || true)
        
        if [ -n "$violating_files" ]; then
            echo "❌ 发现硬编码URL: $pattern"
            echo "$violating_files" | sed 's/^/   - /'
            found_violations=true
        fi
    done
    
    if [ "$found_violations" = true ]; then
        return 2
    fi
    
    echo "✅ URL检查通过"
}

# 检查是否有硬编码的端口号
check_hardcoded_ports() {
    echo "🔌 检查硬编码端口..."
    
    # 查找数字端口号（排除constants目录）
    local violating_files=$(git ls-files "src/**/*.ts" | grep -v "constants" | grep -v "__tests__" | xargs grep -l ":[0-9]\{4,5\}" 2>/dev/null || true)
    
    if [ -n "$violating_files" ]; then
        echo "❌ 发现硬编码端口号"
        echo "$violating_files" | sed 's/^/   - /'
        return 2
    fi
    
    echo "✅ 端口检查通过"
}

# 检查是否有硬编码的错误消息
check_hardcoded_errors() {
    echo "⚠️  检查硬编码错误消息..."
    
    # 查找硬编码的Error构造函数
    local violating_files=$(git ls-files "src/**/*.ts" | grep -v "constants" | grep -v "__tests__" | xargs grep -l "new Error(" 2>/dev/null || true)
    
    if [ -n "$violating_files" ]; then
        echo "❌ 发现硬编码错误消息"
        echo "$violating_files" | sed 's/^/   - /'
        echo ""
        echo "💡 建议：将错误消息移动到 src/constants/error-messages.ts"
        return 2
    fi
    
    echo "✅ 错误消息检查通过"
}

# 检查硬编码的模型名称
check_hardcoded_models() {
    echo "🤖 检查硬编码模型名称..."
    
    local model_patterns=(
        "gpt-4"
        "gpt-3.5-turbo"
        "claude-3"
        "gemini-pro"
    )
    
    local found_violations=false
    
    for pattern in "${model_patterns[@]}"; do
        local violating_files=$(git ls-files "src/**/*.ts" | grep -v "constants" | grep -v "__tests__" | xargs grep -l "$pattern" 2>/dev/null || true)
        
        if [ -n "$violating_files" ]; then
            echo "❌ 发现硬编码模型名称: $pattern"
            echo "$violating_files" | sed 's/^/   - /'
            found_violations=true
        fi
    done
    
    if [ "$found_violations" = true ]; then
        echo ""
        echo "💡 建议：将模型名称移动到 src/constants/model-mappings.ts"
        return 2
    fi
    
    echo "✅ 模型名称检查通过"
}

# 检查硬编码的文件路径
check_hardcoded_paths() {
    echo "📁 检查硬编码文件路径..."
    
    local path_patterns=(
        "/home/[^/]+"
        "/Users/[^/]+"
        "~/[^/]+"
        "C:\\\\[^\\\\]+"
    )
    
    local found_violations=false
    
    for pattern in "${path_patterns[@]}"; do
        local violating_files=$(git ls-files "src/**/*.ts" | grep -v "constants" | grep -v "__tests__" | xargs grep -l "$pattern" 2>/dev/null || true)
        
        if [ -n "$violating_files" ]; then
            echo "❌ 发现硬编码文件路径: $pattern"
            echo "$violating_files" | sed 's/^/   - /'
            found_violations=true
        fi
    done
    
    if [ "$found_violations" = true ]; then
        echo ""
        echo "💡 建议：将文件路径移动到 src/constants/file-paths.ts"
        return 2
    fi
    
    echo "✅ 文件路径检查通过"
}

# 检查硬编码的超时时间
check_hardcoded_timeouts() {
    echo "⏱️  检查硬编码超时时间..."
    
    # 查找 setTimeout, setInterval 等函数中的硬编码数字
    local violating_files=$(git ls-files "src/**/*.ts" | grep -v "constants" | grep -v "__tests__" | xargs grep -l "setTimeout.*[0-9]\{4,\}\|setInterval.*[0-9]\{4,\}" 2>/dev/null || true)
    
    if [ -n "$violating_files" ]; then
        echo "❌ 发现硬编码超时时间"
        echo "$violating_files" | sed 's/^/   - /'
        echo ""
        echo "💡 建议：将超时时间移动到 src/constants/timeout-defaults.ts"
        return 2
    fi
    
    echo "✅ 超时时间检查通过"
}

# 生成硬编码检查报告
generate_report() {
    echo ""
    echo "📊 硬编码检查报告"
    echo "=================="
    
    local total_files=$(git ls-files "src/**/*.ts" | grep -v "constants" | grep -v "__tests__" | wc -l)
    echo "📁 检查文件数量: $total_files"
    
    local constants_files=$(git ls-files "src/modules/constants/src/*.ts" 2>/dev/null | wc -l || echo 0)
    echo "📋 Constants文件数量: $constants_files"
    
    echo ""
    echo "📝 现有的Constants文件结构："
    echo "   src/modules/constants/src/"
    echo "   ├── index.ts                 # 统一导出 (已存在)"
    echo "   ├── bootstrap-constants.ts   # Bootstrap配置常量 (已存在)"
    echo "   ├── error-messages.ts        # 错误消息 (已存在)"
    echo "   ├── model-mappings.ts        # 模型映射 (已存在)"
    echo "   └── test-constants.ts        # 测试常量 (已存在)"
    echo ""
    echo "📖 查看现有常量："
    echo "   cat src/modules/constants/src/bootstrap-constants.ts"
    echo "   cat src/modules/constants/src/model-mappings.ts"
}

# 执行所有检查
main() {
    local exit_code=0
    
    check_hardcoded_urls || exit_code=2
    check_hardcoded_ports || exit_code=2
    check_hardcoded_errors || exit_code=2
    check_hardcoded_models || exit_code=2
    check_hardcoded_paths || exit_code=2
    check_hardcoded_timeouts || exit_code=2
    
    generate_report
    
    if [ $exit_code -eq 0 ]; then
        echo "✅ [RCC v4.0硬编码检查] 无违规发现"
    else
        echo ""
        echo "❌ 硬编码检查失败 - 发现违规项"
        echo ""
        echo "🔧 解决方案："
        echo "1. 创建 src/constants/ 目录结构"
        echo "2. 将硬编码值移动到相应的constants文件"
        echo "3. 更新代码使用constants导入"
        echo "4. 重新运行检查确认修复"
    fi
    
    exit $exit_code
}

# 检查依赖
check_dependencies() {
    command -v git >/dev/null 2>&1 || { 
        echo "❌ 错误: git 未安装" 
        exit 1 
    }
}

# 主执行
check_dependencies
main