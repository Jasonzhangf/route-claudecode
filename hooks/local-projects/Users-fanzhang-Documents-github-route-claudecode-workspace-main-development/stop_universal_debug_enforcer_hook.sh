#!/bin/bash

# Debug Verification Enforcer Hook - 强制执行RCC debug系统端到端验证
# 确保必须运行指定的debug验证命令

# 从stdin读取JSON输入
input=$(cat)

if command -v jq >/dev/null 2>&1; then
    hook_event=$(echo "$input" | jq -r '.hook_event_name // "unknown"')
    stop_hook_active=$(echo "$input" | jq -r '.stop_hook_active // false')
    session_id=$(echo "$input" | jq -r '.session_id // "unknown"')
    
    # 在Stop事件时执行强制检查
    if [[ "$hook_event" == "Stop" ]]; then
        
        echo "🔒 CRITICAL DEBUG VERIFICATION ENFORCEMENT" >&2
        echo "" >&2
        echo "⚠️ 系统强制要求: 必须完成RCC debug系统端到端验证" >&2
        echo "" >&2
        echo "🎯 强制执行的验证脚本:" >&2
        echo "   ./scripts/verify-e2e-debug-system.sh" >&2
        echo "" >&2
        echo "📋 脚本内部执行的验证命令:" >&2
        echo "   ANTHROPIC_BASE_URL=http://localhost:5506 ANTHROPIC_API_KEY=rcc4-proxy-key claude --print \"测试修复后的debug系统：请列出当前目录下的文件\" --timeout 15" >&2
        echo "" >&2
        echo "📋 此命令验证的关键功能:" >&2
        echo "   ✅ RCC v4.0服务器启动和运行" >&2
        echo "   ✅ Claude客户端与RCC代理连接" >&2
        echo "   ✅ API请求正确路由和处理" >&2
        echo "   ✅ 工具调用功能 (LS/文件列表)" >&2
        echo "   ✅ Debug日志系统记录和保存" >&2
        echo "   ✅ 完整的请求-响应流水线" >&2
        echo "" >&2
        echo "🚨 重要性: 这是项目的核心功能验证" >&2
        echo "   • 验证RCC系统整体集成" >&2
        echo "   • 确保debug系统修复有效" >&2
        echo "   • 保证生产就绪状态" >&2
        echo "   • 符合CLAUDE.md全局验证协议" >&2
        echo "" >&2
        echo "💡 执行提醒:" >&2
        echo "   1. 确保RCC服务器在端口5506运行" >&2
        echo "   2. 使用指定的API key: rcc4-proxy-key" >&2
        echo "   3. 验证输出包含文件列表" >&2
        echo "   4. 检查debug日志是否生成" >&2
        echo "" >&2
        
        # 检查是否有最近的验证记录
        verification_log_file="~/.claude/debug-verification-executions.log"
        recent_verification=$(tail -1 "$verification_log_file" 2>/dev/null || echo "")
        
        if [[ -n "$recent_verification" ]]; then
            echo "📝 最近的验证记录: $recent_verification" >&2
        else
            echo "⚠️ 未发现最近的debug验证执行记录" >&2
        fi
        
        echo "" >&2
        echo "🔔 请在继续之前确保已执行上述验证命令" >&2
        
        # 记录强制检查
        {
            echo "=== DEBUG VERIFICATION ENFORCEMENT ==="
            echo "Time: $(date)"
            echo "Session: $session_id"
            echo "Stop Hook Active: $stop_hook_active"
            echo "Enforcement Message Displayed: YES"
            echo "======================================="
            echo ""
        } >> ~/.claude/debug-verification-enforcement.log
    fi
fi

# 不阻止，只是强烈提醒
exit 0