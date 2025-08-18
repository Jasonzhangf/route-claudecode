#!/bin/bash

# E2E验证强制Hook - 在特定Bash命令时强制执行端到端验证
# 检测到关键部署或测试命令时，要求先执行E2E验证脚本

# 从stdin读取JSON输入
input=$(cat)

if command -v jq >/dev/null 2>&1; then
    tool_name=$(echo "$input" | jq -r '.tool_name // "unknown"')
    command_text=$(echo "$input" | jq -r '.tool_input.command // ""')
    description=$(echo "$input" | jq -r '.tool_input.description // ""')
    
    # 检查是否是关键的部署/测试/构建命令
    if [[ "$tool_name" == "Bash" ]] && [[ -n "$command_text" ]]; then
        
        # 定义需要强制E2E验证的命令模式
        critical_patterns=(
            "npm run build"
            "npm run start"
            "npm run deploy" 
            "docker build"
            "docker run"
            "./dist/cli.js start"
            "rcc4.*start"
            "ANTHROPIC_BASE_URL.*claude"
            "git commit.*release"
            "git tag"
            "npm publish"
        )
        
        # 检查是否匹配关键命令
        needs_verification=false
        matched_pattern=""
        
        for pattern in "${critical_patterns[@]}"; do
            if echo "$command_text" | grep -qE "$pattern"; then
                needs_verification=true
                matched_pattern="$pattern"
                break
            fi
        done
        
        if [ "$needs_verification" = true ]; then
            
            echo "🚨 E2E验证强制要求 - 关键操作检测" >&2
            echo "" >&2
            echo "❌ 检测到关键部署/测试命令: $command_text" >&2
            echo "🎯 匹配模式: $matched_pattern" >&2
            echo "" >&2
            echo "⚠️ 在执行此命令前，必须完成端到端验证" >&2
            echo "" >&2
            echo "🔧 强制执行的验证脚本:" >&2
            echo "   ./scripts/verify-e2e-debug-system.sh" >&2
            echo "" >&2
            echo "📋 此脚本验证以下关键功能:" >&2
            echo "   ✅ RCC v4.0服务器启动和运行状态" >&2
            echo "   ✅ Claude客户端与RCC代理连接" >&2  
            echo "   ✅ API请求正确路由和处理" >&2
            echo "   ✅ 工具调用功能 (LS/文件列表)" >&2
            echo "   ✅ Debug日志系统记录和保存" >&2
            echo "   ✅ 完整的请求-响应流水线" >&2
            echo "" >&2
            
            # 检查验证脚本是否存在
            verification_script="./scripts/verify-e2e-debug-system.sh"
            if [ -f "$verification_script" ]; then
                echo "✅ 验证脚本存在: $verification_script" >&2
            else
                echo "❌ 验证脚本不存在: $verification_script" >&2
                echo "   请确保脚本存在并具有执行权限" >&2
            fi
            
            echo "" >&2
            echo "💡 执行顺序:" >&2
            echo "   1. 先执行: bash $verification_script" >&2
            echo "   2. 验证通过后，再执行: $command_text" >&2
            echo "" >&2
            
            # 检查是否有最近的验证记录
            verification_log="~/.claude/debug-verification-executions.log"
            if [ -f ~/.claude/debug-verification-executions.log ]; then
                recent_verification=$(tail -10 ~/.claude/debug-verification-executions.log | grep -E "验证状态.*完全成功" | tail -1)
                if [[ -n "$recent_verification" ]]; then
                    echo "📝 发现最近的成功验证记录:" >&2
                    echo "   $recent_verification" >&2
                    echo "" >&2
                    echo "⏰ 如果此验证是在最近5分钟内完成的，可能可以继续" >&2
                else
                    echo "⚠️ 未发现最近的成功验证记录" >&2
                fi
            else
                echo "⚠️ 未发现验证执行日志文件" >&2
            fi
            
            echo "" >&2
            echo "🚨 此操作已被阻止，请先完成E2E验证" >&2
            
            # 记录阻止操作
            {
                echo "=== E2E验证强制阻止记录 ==="
                echo "时间: $(date)"
                echo "被阻止的命令: $command_text"
                echo "匹配模式: $matched_pattern"
                echo "描述: $description"
                echo "要求: 执行 $verification_script"
                echo "=============================="
                echo ""
            } >> ~/.claude/e2e-verification-blocks.log
            
            # 阻止命令执行
            exit 2
        fi
    fi
fi

# 允许其他命令继续
exit 0