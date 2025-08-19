#!/bin/bash

# 防测试造假Hook - 检测并阻止虚假测试数据生成
# 确保AI助手创建真实的测试而非编造结果

# 从stdin读取JSON输入
input=$(cat)

if command -v jq >/dev/null 2>&1; then
    tool_name=$(echo "$input" | jq -r '.tool_name // "unknown"')
    command_text=$(echo "$input" | jq -r '.tool_input.command // ""')
    description=$(echo "$input" | jq -r '.tool_input.description // ""')
    
    # 检查是否是Bash命令
    if [[ "$tool_name" == "Bash" ]] && [[ -n "$command_text" ]]; then
        
        # 定义造假测试数据的模式
        fraud_patterns=(
            "echo.*test.*json.*>"
            "echo.*success.*true.*>"
            "echo.*numTotalTests.*>"
            "mkdir.*test-results.*&&.*echo"
            "\\{.*numPassedTests.*\\}"
            "\\{.*coverage.*\\}"
            "\\{.*pct.*\\}"
            "echo.*\\{.*success.*\\}.*>"
            "cat.*<<.*EOF.*test.*success"
            "echo.*\"\\{.*\\}\".*>.*test"
        )
        
        # 检查是否匹配造假模式
        is_fraud_attempt=false
        matched_fraud_pattern=""
        
        for pattern in "${fraud_patterns[@]}"; do
            if echo "$command_text" | grep -qE "$pattern"; then
                is_fraud_attempt=true
                matched_fraud_pattern="$pattern"
                break
            fi
        done
        
        if [ "$is_fraud_attempt" = true ]; then
            
            echo "🚨 测试造假检测器 - 阻止虚假测试数据生成" >&2
            echo "" >&2
            echo "❌ 检测到疑似造假测试数据的命令:" >&2
            echo "   $command_text" >&2
            echo "🎯 匹配的造假模式: $matched_fraud_pattern" >&2
            echo "" >&2
            echo "🚫 严禁行为:" >&2
            echo "   - 直接创建虚假的测试结果JSON文件" >&2
            echo "   - 编造测试通过数据" >&2
            echo "   - 伪造代码覆盖率报告" >&2
            echo "   - 绕过真实测试执行流程" >&2
            echo "" >&2
            echo "✅ 必须执行的正确流程:" >&2
            echo "" >&2
            echo "1️⃣ 检查项目是否有package.json中的test script" >&2
            echo "2️⃣ 如果没有test script，必须:" >&2
            echo "   - 安装测试框架(Jest, Mocha等)" >&2
            echo "   - 在package.json中添加test script" >&2
            echo "   - 创建真实的测试文件(.test.ts, .spec.ts等)" >&2
            echo "   - 针对实际代码编写测试用例" >&2
            echo "" >&2
            echo "3️⃣ 创建针对RCC v4.0项目的真实测试:" >&2
            echo "   - 测试CLI参数解析功能" >&2
            echo "   - 测试配置文件加载" >&2
            echo "   - 测试路由器核心功能" >&2
            echo "   - 测试Provider管理器" >&2
            echo "   - 测试HTTP服务器启动" >&2
            echo "" >&2
            echo "4️⃣ 然后运行: npm test (真实的测试执行)" >&2
            echo "" >&2
            echo "💡 目标: 建立真实的测试基础设施，确保代码质量" >&2
            
            # 记录造假尝试
            {
                echo "=== 测试造假尝试记录 ==="
                echo "时间: $(date)"
                echo "尝试的造假命令: $command_text"
                echo "匹配模式: $matched_fraud_pattern"
                echo "描述: $description"
                echo "=============================="
                echo ""
            } >> ~/.claude/test-fraud-attempts.log
            
            # 阻止命令执行
            exit 2
        fi
    fi
fi

# 允许其他命令继续
exit 0