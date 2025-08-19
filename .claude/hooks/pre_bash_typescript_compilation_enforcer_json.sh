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
                exit 1
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
                echo "📋 解决方案："
                echo "  1. 修复所有TypeScript编译错误"
                echo "  2. 不要使用 --skipLibCheck 或其他绕过标志"
                echo "  3. 确保类型定义正确和完整"
                echo "  4. 运行: npx tsc --noEmit 查看详细错误"
                echo "  5. 修复错误后再启动服务"
                echo ""
                echo "⚠️ 强制要求：必须解决TypeScript编译错误后才能启动服务"
                echo ""
                echo "🚫 服务启动被阻止，请先修复编译错误！"
                exit 1
            fi
        fi
        
        echo "✅ [TypeScript编译检查] 命令检查完成" >&2
    fi
fi

exit 0