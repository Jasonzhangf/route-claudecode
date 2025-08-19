#!/bin/bash

# Debug Session Validator Hook - 停止前检查最新debug日志和会话完整性
# 功能：检查最新request是否有完整的end_turn，如果没有且超过10分钟则要求运行测试

# 从stdin读取JSON输入
input=$(cat)

if command -v jq >/dev/null 2>&1; then
    hook_event=$(echo "$input" | jq -r '.hook_event_name // "unknown"')
    session_id=$(echo "$input" | jq -r '.session_id // "unknown"')
    
    # 在Stop事件时执行检查
    if [[ "$hook_event" == "Stop" ]]; then
        
        echo "🔍 Debug会话完整性检查..." >&2
        echo "" >&2
        
        # 检查debug-logs目录
        DEBUG_LOGS_DIR="./debug-logs"
        if [[ ! -d "$DEBUG_LOGS_DIR" ]]; then
            echo "⚠️ Debug日志目录不存在: $DEBUG_LOGS_DIR" >&2
            echo "🚨 无法验证会话完整性，建议运行测试脚本确认系统状态" >&2
            echo "" >&2
            echo "🧪 请运行标准测试脚本:" >&2
            echo "   ./scripts/test-claude-rcc4-tool-calling.sh" >&2
            echo "" >&2
            exit 0
        fi
        
        # 获取最新的request文件
        latest_request=$(find "$DEBUG_LOGS_DIR" -name "*_request.json" -type f | sort -V | tail -1)
        
        if [[ -z "$latest_request" ]]; then
            echo "⚠️ 未找到debug日志中的request文件" >&2
            echo "🚨 无法验证会话完整性，建议运行测试脚本确认系统状态" >&2
            echo "" >&2
            echo "🧪 请运行标准测试脚本:" >&2
            echo "   ./scripts/test-claude-rcc4-tool-calling.sh" >&2
            echo "" >&2
            exit 0
        fi
        
        echo "📂 检查最新request文件: $(basename "$latest_request")" >&2
        
        # 检查文件时间戳（从文件名提取时间）
        filename=$(basename "$latest_request")
        # 从文件名提取时间戳格式: 2025-08-16_20-02-59-501
        if [[ $filename =~ ([0-9]{4}-[0-9]{2}-[0-9]{2})_([0-9]{2})-([0-9]{2})-([0-9]{2})-[0-9]{3} ]]; then
            file_date="${BASH_REMATCH[1]}"
            file_time="${BASH_REMATCH[2]}:${BASH_REMATCH[3]}:${BASH_REMATCH[4]}"
            file_timestamp="$file_date $file_time"
            
            # 转换为时间戳
            if command -v date >/dev/null 2>&1; then
                file_epoch=$(date -d "$file_timestamp" +%s 2>/dev/null || date -j -f "%Y-%m-%d %H:%M:%S" "$file_timestamp" +%s 2>/dev/null)
                current_epoch=$(date +%s)
                time_diff=$((current_epoch - file_epoch))
                
                echo "⏰ 最新request时间: $file_timestamp ($(($time_diff / 60))分钟前)" >&2
                
                # 检查是否超过10分钟
                if [[ $time_diff -gt 600 ]]; then
                    time_too_old=true
                    echo "⚠️ 最新request超过10分钟 ($(($time_diff / 60))分钟前)" >&2
                else
                    time_too_old=false
                    echo "✅ 最新request在10分钟内 ($(($time_diff / 60))分钟前)" >&2
                fi
            else
                echo "⚠️ 无法解析时间戳，假设需要检查" >&2
                time_too_old=true
            fi
        else
            echo "⚠️ 无法从文件名解析时间戳，假设需要检查" >&2
            time_too_old=true
        fi
        
        # 检查request内容是否包含end_turn
        has_end_turn=false
        if [[ -f "$latest_request" ]]; then
            if grep -q "end_turn" "$latest_request" 2>/dev/null; then
                has_end_turn=true
                echo "✅ 检测到会话正常结束 (end_turn)" >&2
            else
                echo "❌ 未检测到会话正常结束 (end_turn)" >&2
                
                # 额外检查一些其他的完整结束标志
                if jq -e '.messages[-1].content' "$latest_request" >/dev/null 2>&1; then
                    last_message=$(jq -r '.messages[-1].content' "$latest_request" 2>/dev/null)
                    if [[ "$last_message" == *"助手"* ]] || [[ "$last_message" == *"完成"* ]] || [[ "$last_message" == *"结束"* ]]; then
                        has_end_turn=true
                        echo "✅ 检测到会话完整结束标志" >&2
                    fi
                fi
            fi
        else
            echo "❌ 无法读取request文件内容" >&2
        fi
        
        echo "" >&2
        
        # 决策逻辑
        if [[ "$has_end_turn" == false && "$time_too_old" == true ]]; then
            echo "🚨 系统检测到潜在问题，需要立即解决！" >&2
            echo "" >&2
            echo "📊 检查结果:" >&2
            echo "   • 会话正常结束: ❌ 未检测到end_turn" >&2
            echo "   • 时间检查: ❌ 超过10分钟 (需要重新测试)" >&2
            echo "" >&2
            echo "🎯 AI模型，你必须立即执行以下操作解决此问题:" >&2
            echo "   1️⃣ 立即运行系统验证脚本诊断问题根源" >&2
            echo "   2️⃣ 根据测试结果分析并修复发现的问题" >&2
            echo "   3️⃣ 重新运行测试确保系统完全恢复正常" >&2
            echo "   4️⃣ 提供完整的问题解决报告" >&2
            echo "" >&2
            echo "⚡ 立即执行测试脚本:" >&2
            echo "   ./scripts/test-claude-rcc4-tool-calling.sh" >&2
            echo "" >&2
            echo "🔧 如果测试失败，你需要:" >&2
            echo "   • 分析失败原因（服务器、配置、网络等）" >&2
            echo "   • 修复所有发现的问题" >&2
            echo "   • 重新运行测试直到成功" >&2
            echo "   • 提供详细的修复过程报告" >&2
            echo "" >&2
            echo "❌ 严禁：不解决问题就结束会话" >&2
            echo "✅ 要求：必须解决所有问题并提供解决方案报告" >&2
            
            # 记录验证失败
            {
                echo "=== DEBUG SESSION VALIDATION FAILED ==="
                echo "Time: $(date)"
                echo "Session: $session_id"
                echo "Latest Request: $(basename "$latest_request")"
                echo "Has end_turn: $has_end_turn"
                echo "Time too old: $time_too_old"
                echo "Action Required: Run test script and provide report"
                echo "========================================"
                echo ""
            } >> ~/.claude/debug-session-validation.log
            
        elif [[ "$has_end_turn" == false && "$time_too_old" == false ]]; then
            echo "⚠️ 系统检测到会话状态异常，需要验证！" >&2
            echo "" >&2
            echo "📊 检查结果:" >&2
            echo "   • 会话正常结束: ❌ 未检测到end_turn" >&2
            echo "   • 时间检查: ✅ 10分钟内 (可能正在处理)" >&2
            echo "" >&2
            echo "🎯 AI模型，建议立即执行验证操作:" >&2
            echo "   1️⃣ 运行系统测试脚本确认状态" >&2
            echo "   2️⃣ 如发现问题立即修复" >&2
            echo "   3️⃣ 提供验证结果报告" >&2
            echo "" >&2
            echo "⚡ 执行测试脚本:" >&2
            echo "   ./scripts/test-claude-rcc4-tool-calling.sh" >&2
            
        else
            echo "✅ 会话完整性验证通过！" >&2
            echo "" >&2
            echo "📊 检查结果:" >&2
            echo "   • 会话正常结束: ✅ 检测到完整结束标志" >&2
            echo "   • 时间检查: ✅ 会话活跃度正常" >&2
            echo "" >&2
            echo "🎉 可以安全结束会话" >&2
            
            # 记录验证成功
            {
                echo "=== DEBUG SESSION VALIDATION PASSED ==="
                echo "Time: $(date)"
                echo "Session: $session_id"
                echo "Latest Request: $(basename "$latest_request")"
                echo "Has end_turn: $has_end_turn"
                echo "Time check: passed"
                echo "======================================="
                echo ""
            } >> ~/.claude/debug-session-validation.log
        fi
        
        echo "" >&2
    fi
fi

# 不阻止停止，只是提供验证信息
exit 0