#!/bin/bash

# 智能单元测试检查Hook - 闭环设计
# 检测到服务启动命令时，检查单元测试报告，确保代码质量

# 从stdin读取JSON输入
input=$(cat)

if command -v jq >/dev/null 2>&1; then
    tool_name=$(echo "$input" | jq -r '.tool_name // "unknown"')
    command_text=$(echo "$input" | jq -r '.tool_input.command // ""')
    description=$(echo "$input" | jq -r '.tool_input.description // ""')
    
    # 检查是否是服务启动命令
    if [[ "$tool_name" == "Bash" ]] && [[ -n "$command_text" ]]; then
        
        # 定义需要单元测试检查的服务启动命令模式
        start_patterns=(
            "./dist/cli.js start"
            "rcc4.*start"
            "npm run start"
            "node.*start"
        )
        
        # 定义需要引导使用测试脚本的Claude命令模式
        claude_patterns=(
            "ANTHROPIC_BASE_URL.*ANTHROPIC_API_KEY.*claude.*--print"
            "claude.*--print"
        )
        
        # 定义需要更严格检查的构建/部署命令
        build_patterns=(
            "npm run build" 
            "npm run deploy"
            "docker build"
            "npm publish"
            "git commit.*release"
            "git tag"
        )
        
        # 检查是否匹配服务启动命令
        needs_unit_test_check=false
        needs_full_verification=false
        needs_claude_guidance=false
        matched_pattern=""
        
        # 检查Claude命令模式
        for pattern in "${claude_patterns[@]}"; do
            if echo "$command_text" | grep -qE "$pattern"; then
                needs_claude_guidance=true
                matched_pattern="$pattern"
                break
            fi
        done
        
        for pattern in "${start_patterns[@]}"; do
            if echo "$command_text" | grep -qE "$pattern"; then
                needs_unit_test_check=true
                matched_pattern="$pattern"
                break
            fi
        done
        
        for pattern in "${build_patterns[@]}"; do
            if echo "$command_text" | grep -qE "$pattern"; then
                needs_full_verification=true
                matched_pattern="$pattern"
                break
            fi
        done
        
        # 处理Claude命令引导
        if [ "$needs_claude_guidance" = true ]; then
            echo "🤖 检测到Claude测试命令" >&2
            echo "" >&2
            echo "📋 当前命令: $command_text" >&2
            echo "🎯 匹配模式: $matched_pattern" >&2
            echo "" >&2
            
            echo "⚡ 系统检测到手动Claude测试命令！" >&2
            echo "" >&2
            echo "🎯 AI模型，立即使用标准测试脚本执行更好的测试:" >&2
            echo "   ./scripts/test-claude-rcc4-tool-calling.sh" >&2
            echo "" >&2
            echo "🚀 标准脚本优势:" >&2
            echo "   ⭐ 使用最佳测试prompt：\"列出本目录中所有文件夹\"" >&2
            echo "   🔧 适合测试复杂工具调用和多轮会话" >&2
            echo "   ⚡ 预配置环境变量，避免输入错误" >&2
            echo "   📊 内置debug引导和流水线测试指南" >&2
            echo "   🛡️ 标准化测试流程，确保结果一致性" >&2
            echo "" >&2
            echo "⚡ 立即执行标准测试:" >&2
            echo "   ./scripts/test-claude-rcc4-tool-calling.sh" >&2
            echo "" >&2
            echo "🔧 如果测试失败，你必须继续调试并解决问题！" >&2
            echo "" >&2
            
            # 阻止原命令执行
            exit 2
        fi
        
        if [ "$needs_unit_test_check" = true ] || [ "$needs_full_verification" = true ]; then
            
            # 定义期望的单元测试报告文件
            unit_test_report="./test-results/unit-test-report.json"
            coverage_report="./coverage/coverage-summary.json"
            test_timestamp_file="./test-results/.test-timestamp"
            
            echo "🔍 智能代码质量检查 - 服务启动前验证" >&2
            echo "" >&2
            echo "📋 检测到命令: $command_text" >&2
            echo "🎯 匹配模式: $matched_pattern" >&2
            echo "" >&2
            
            # 检查单元测试报告是否存在
            test_report_exists=false
            test_report_recent=false
            
            if [ -f "$unit_test_report" ]; then
                test_report_exists=true
                echo "✅ 单元测试报告存在: $unit_test_report" >&2
                
                # 检查测试报告的时间戳 - 修改为10分钟有效期
                if [ -f "$test_timestamp_file" ]; then
                    test_time=$(cat "$test_timestamp_file")
                    current_time=$(date +%s)
                    time_diff=$((current_time - test_time))
                    
                    # 质检文件10分钟有效期 (600秒)
                    if [ $time_diff -lt 600 ]; then
                        test_report_recent=true
                        echo "✅ 测试报告较新 ($(($time_diff / 60))分钟$(($time_diff % 60))秒前)" >&2
                    else
                        echo "⚠️ 测试报告过期 ($(($time_diff / 60))分钟前，超过10分钟有效期)" >&2
                    fi
                else
                    echo "⚠️ 测试时间戳文件不存在" >&2
                fi
                
                # 读取测试结果
                if command -v jq >/dev/null 2>&1; then
                    test_status=$(jq -r '.success // false' "$unit_test_report" 2>/dev/null)
                    test_count=$(jq -r '.numTotalTests // 0' "$unit_test_report" 2>/dev/null)
                    passed_count=$(jq -r '.numPassedTests // 0' "$unit_test_report" 2>/dev/null)
                    
                    if [ "$test_status" = "true" ]; then
                        echo "✅ 测试状态: 全部通过 ($passed_count/$test_count)" >&2
                    else
                        echo "❌ 测试状态: 有失败 ($passed_count/$test_count)" >&2
                    fi
                fi
                
            else
                echo "❌ 单元测试报告不存在: $unit_test_report" >&2
            fi
            
            # 检查代码覆盖率报告
            if [ -f "$coverage_report" ]; then
                echo "✅ 代码覆盖率报告存在: $coverage_report" >&2
                if command -v jq >/dev/null 2>&1; then
                    line_coverage=$(jq -r '.total.lines.pct // 0' "$coverage_report" 2>/dev/null)
                    if [ "$line_coverage" != "0" ]; then
                        echo "📊 代码覆盖率: ${line_coverage}%" >&2
                    fi
                fi
            else
                echo "⚠️ 代码覆盖率报告不存在: $coverage_report" >&2
            fi
            
            echo "" >&2
            
            # 决策逻辑
            if [ "$test_report_exists" = true ] && [ "$test_report_recent" = true ] && [ "$test_status" = "true" ]; then
                # 测试通过，允许执行
                echo "🎉 质量检查通过！允许执行服务启动命令" >&2
                echo "" >&2
                echo "⚠️ 提醒: 如果使用局部构建版本 (./dist/cli.js):" >&2
                echo "   - 局部版本可能与全局安装版本不同" >&2
                echo "   - 建议在测试后使用 './build-and-install.sh' 进行全局安装" >&2
                echo "   - 或者使用全局命令 'rcc4' 确保一致性" >&2
                echo "" >&2
                
                # 记录成功启动
                {
                    echo "=== 质量检查通过记录 ==="
                    echo "时间: $(date)"
                    echo "命令: $command_text"
                    echo "测试报告: $unit_test_report"
                    echo "测试状态: 通过 ($passed_count/$test_count)"
                    echo "覆盖率: ${line_coverage}%"
                    echo "=============================="
                    echo ""
                } >> ~/.claude/quality-check-passed.log
                
                # 允许命令执行
                exit 0
                
            else
                # 强制要求AI助手解决问题
                echo "🚨 系统强制质量检查 - AI模型必须立即解决问题！" >&2
                echo "" >&2
                echo "📋 检测到服务启动命令，但质量检查未通过:" >&2
                echo "   命令: $command_text" >&2
                echo "   要求: 必须有有效的单元测试报告（10分钟内生成）" >&2
                echo "" >&2
                
                echo "❌ 发现的问题:" >&2
                if [ "$test_report_exists" = false ]; then
                    echo "   • 单元测试报告不存在: $unit_test_report" >&2
                fi
                
                if [ "$test_report_recent" = false ]; then
                    echo "   • 测试报告过期（超过10分钟有效期）" >&2
                fi
                
                if [ "$test_status" != "true" ]; then
                    echo "   • 测试未全部通过" >&2
                fi
                
                echo "" >&2
                echo "⚡ AI模型，你必须立即执行以下操作解决所有问题:" >&2
                echo "" >&2
                echo "1️⃣ 立即执行单元测试生成脚本:" >&2
                echo "   bash ./scripts/run-unit-tests-with-report.sh" >&2
                echo "" >&2
                echo "2️⃣ 如果测试失败，你必须:" >&2
                echo "   • 分析并修复所有失败的测试用例" >&2
                echo "   • 重新运行测试直到全部通过" >&2
                echo "   • 确保代码覆盖率达标" >&2
                echo "" >&2
                echo "3️⃣ 生成的文件必须包含:" >&2
                echo "   📄 $unit_test_report - 测试结果JSON格式" >&2
                echo "   📊 $coverage_report - 代码覆盖率报告" >&2
                echo "   ⏰ $test_timestamp_file - 测试时间戳" >&2
                echo "" >&2
                echo "4️⃣ 完成质量检查后，系统会自动重新执行原始命令:" >&2
                echo "   $command_text" >&2
                echo "" >&2
                echo "❌ 严禁：绕过质量检查或使用mock数据" >&2
                echo "✅ 要求：解决所有问题直到质量检查完全通过" >&2
                
                # 记录阻止操作
                {
                    echo "=== 质量检查阻止记录 ==="
                    echo "时间: $(date)"
                    echo "被阻止的命令: $command_text"
                    echo "匹配模式: $matched_pattern"
                    echo "原因: 缺少有效的单元测试报告"
                    echo "测试报告存在: $test_report_exists"
                    echo "测试报告最新: $test_report_recent"
                    echo "测试状态: $test_status"
                    echo "=============================="
                    echo ""
                } >> ~/.claude/quality-check-blocks.log
                
                # 阻止命令执行
                exit 2
            fi
        fi
    fi
fi

# 允许其他命令继续
exit 0