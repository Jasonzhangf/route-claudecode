#!/bin/bash

# TypeScript编译强制器 - JSON format
# 检测到服务启动命令时，强制进行TypeScript编译检查
# 解决Jest测试通过但TypeScript编译失败的问题

set -e

# Read JSON input from stdin
input=$(cat)

if command -v jq >/dev/null 2>&1; then
    tool_name=$(echo "$input" | jq -r '.tool_name // "unknown"')
    command_text=$(echo "$input" | jq -r '.tool_input.command // ""')
    description=$(echo "$input" | jq -r '.tool_input.description // ""')
    
    # Only check Bash commands
    if [[ "$tool_name" == "Bash" ]] && [[ -n "$command_text" ]]; then
        
        # 定义需要TypeScript检查的服务启动命令
        start_patterns=(
            "rcc4.*start"
            "npm run start"
            "node.*start"
            "./dist/cli.js start"
            "yarn start"
        )
        
        should_check=false
        for pattern in "${start_patterns[@]}"; do
            if echo "$command_text" | grep -qE "$pattern"; then
                should_check=true
                break
            fi
        done
        
        if [ "$should_check" = true ]; then
            echo "🔍 [TypeScript编译检查] 检测到服务启动命令，执行编译检查..." >&2
            echo "" >&2
            
            # 检查是否存在TypeScript配置
            if [[ ! -f "tsconfig.json" ]]; then
                echo "⚠️ [TypeScript编译检查] 警告：未找到tsconfig.json文件" >&2
                echo "📋 建议：创建适当的TypeScript配置文件" >&2
                echo "" >&2
                exit 0
            fi
            
            # 执行TypeScript编译检查
            echo "📋 [TypeScript编译检查] 执行编译检查..." >&2
            
            # 尝试TypeScript编译
            tsc_output=""
            tsc_exit_code=0
            
            if command -v npx >/dev/null 2>&1; then
                tsc_output=$(npx tsc --noEmit 2>&1) || tsc_exit_code=$?
            elif command -v tsc >/dev/null 2>&1; then
                tsc_output=$(tsc --noEmit 2>&1) || tsc_exit_code=$?
            else
                echo "❌ [TypeScript编译检查] 错误：未找到TypeScript编译器" >&2
                echo "📋 解决方案：npm install -g typescript 或 npm install typescript" >&2
            # Record statistics
            /Users/fanzhang/.claude/hooks/hook-statistics-manager.sh block "$HOOK_NAME" "${violation_type:-unknown}" "${file_path:-unknown}" >/dev/null 2>&1                exit 2
            fi
            
            if [ $tsc_exit_code -eq 0 ]; then
                echo "✅ [TypeScript编译检查] 编译检查通过，可以启动服务" >&2
                echo "" >&2
            else
                echo "" >&2
                echo "🚨 [TypeScript编译检查] TypeScript编译错误检测！"
                echo ""
                echo "❌ 问题描述："
                echo "   Jest测试可能通过但TypeScript编译失败"
                echo "   这会导致服务启动时出现类型错误"
                echo ""
                echo "🔍 编译错误详情："
                echo "$tsc_output" | head -20
                echo ""
                if [ $(echo "$tsc_output" | wc -l) -gt 20 ]; then
                    echo "   ... (显示前20行，完整错误请运行: npx tsc --noEmit)"
                    echo ""
                fi
                echo "📋 推荐解决方案："
                echo "  🎯 使用标准化流水线测试脚本 (推荐):"
                echo "     ./scripts/pipeline-test-runner.sh basic"
                if echo "$command_text" | grep -qE -- "--config[[:space:]]+[^[:space:]]+"; then
                    config_file=$(echo "$command_text" | grep -oE -- "--config[[:space:]]+[^[:space:]]+" | awk '{print $2}')
                    echo "     ./scripts/pipeline-test-runner.sh --config $config_file --mode integration"
                else
                    echo "     ./scripts/pipeline-test-runner.sh --config ~/.route-claudecode/config/v4/single-provider/lmstudio-v4-5506.json"
                fi
                echo ""
                echo "  🔧 手动修复TypeScript错误:"
                echo "     1. 运行: npx tsc --noEmit 查看详细错误"
                echo "     2. 修复所有编译错误"
                echo "     3. 不要使用 --skipLibCheck 等绕过标志"
                echo "     4. 确保类型定义正确和完整"
                echo ""
                echo "💡 为什么使用测试脚本?"
                echo "   • 自动进行TypeScript编译检查"
                echo "   • 模块化测试各个组件"
                echo "   • 生成详细的测试报告和日志"
                echo "   • 支持多种测试模式和数据源"
                echo "   • 避免启动有问题的服务"
                echo ""
                echo "⚠️ 直接服务启动被阻止 - 请使用标准化测试流程！"
                echo ""
                echo "🚫 使用测试脚本确保系统稳定性！"
            # Record statistics
            /Users/fanzhang/.claude/hooks/hook-statistics-manager.sh block "$HOOK_NAME" "${violation_type:-unknown}" "${file_path:-unknown}" >/dev/null 2>&1                exit 2
            fi
        fi
        
        echo "✅ [TypeScript编译检查] 命令检查完成" >&2
    fi
fi

# 注意：只有当所有检查都通过时才到达这里
exit 0