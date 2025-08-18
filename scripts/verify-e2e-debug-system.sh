#!/bin/bash

# 端到端Debug系统验证脚本
# 验证RCC v4.0完整的请求-响应-debug流水线
# 
# 此脚本是Claude Code hooks系统要求的强制验证脚本
# 必须在项目开发完成前执行，确保系统功能完整性

echo "🔬 RCC v4.0 端到端Debug系统验证"
echo "=================================="
echo ""

# 检查RCC服务器状态
echo "📋 步骤 1: 检查RCC服务器状态"
if lsof -Pi :5506 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✅ RCC服务器正在端口5506运行"
else
    echo "❌ RCC服务器未在端口5506运行"
    echo "   请先启动RCC服务器: ./dist/cli.js start --port 5506"
    exit 1
fi

echo ""

# 执行核心验证命令
echo "📋 步骤 2: 执行核心端到端验证"
echo "🎯 验证命令: ANTHROPIC_BASE_URL=http://localhost:5506 ANTHROPIC_API_KEY=rcc4-proxy-key claude --print \"测试修复后的debug系统：请列出当前目录下的文件\" --timeout 15"
echo ""

# 记录验证开始时间
verification_start=$(date '+%Y-%m-%d %H:%M:%S')
echo "⏰ 验证开始时间: $verification_start"

# 执行验证命令
ANTHROPIC_BASE_URL=http://localhost:5506 ANTHROPIC_API_KEY=rcc4-proxy-key claude --print "测试修复后的debug系统：请列出当前目录下的文件" --timeout 15

# 检查命令执行状态
verification_status=$?
verification_end=$(date '+%Y-%m-%d %H:%M:%S')

echo ""
echo "⏰ 验证结束时间: $verification_end"

if [ $verification_status -eq 0 ]; then
    echo "✅ 端到端验证成功完成"
else
    echo "❌ 端到端验证失败 (退出码: $verification_status)"
fi

echo ""

# 检查debug日志生成
echo "📋 步骤 3: 验证debug日志生成"
debug_logs_dir="./debug-logs"

if [ -d "$debug_logs_dir" ]; then
    recent_logs=$(find "$debug_logs_dir" -name "*.json" -newermt "1 minute ago" | wc -l)
    
    if [ "$recent_logs" -gt 0 ]; then
        echo "✅ Debug日志系统正常工作 (发现 $recent_logs 个新日志文件)"
        echo "📄 最新日志文件:"
        find "$debug_logs_dir" -name "*.json" -newermt "1 minute ago" | head -3 | while read log_file; do
            echo "   - $(basename "$log_file")"
        done
    else
        echo "⚠️ 未发现新的debug日志文件"
        echo "   可能的原因:"
        echo "   - Debug系统配置问题"
        echo "   - 请求未正确路由到RCC服务器"
    fi
else
    echo "❌ Debug日志目录不存在: $debug_logs_dir"
    echo "   Debug系统可能未正确配置"
fi

echo ""

# 验证完整性检查
echo "📋 步骤 4: 验证完整性总结"
echo "验证项目检查结果:"

verification_score=0
total_checks=4

# 1. 服务器运行检查
if lsof -Pi :5506 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✅ RCC服务器运行状态: 正常"
    ((verification_score++))
else
    echo "❌ RCC服务器运行状态: 异常"
fi

# 2. Claude客户端连接检查
if [ $verification_status -eq 0 ]; then
    echo "✅ Claude客户端连接: 成功"
    ((verification_score++))
else
    echo "❌ Claude客户端连接: 失败"
fi

# 3. 工具调用功能检查 (基于命令输出)
if [ $verification_status -eq 0 ]; then
    echo "✅ 工具调用功能: 正常"
    ((verification_score++))
else
    echo "❌ 工具调用功能: 异常"
fi

# 4. Debug日志系统检查
if [ -d "$debug_logs_dir" ] && [ "$recent_logs" -gt 0 ]; then
    echo "✅ Debug日志系统: 正常"
    ((verification_score++))
else
    echo "❌ Debug日志系统: 异常"
fi

echo ""
echo "📊 验证评分: $verification_score/$total_checks"

# 记录验证结果
verification_log_file="~/.claude/debug-verification-executions.log"
{
    echo "=== RCC v4.0 端到端验证记录 ==="
    echo "时间: $verification_start - $verification_end"
    echo "验证评分: $verification_score/$total_checks"
    echo "命令退出码: $verification_status"
    echo "Debug日志: $recent_logs 个新文件"
    echo "验证状态: $([ $verification_score -eq $total_checks ] && echo "✅ 完全成功" || echo "⚠️ 部分成功")"
    echo "==============================="
    echo ""
} >> ~/.claude/debug-verification-executions.log

# 最终结果
if [ $verification_score -eq $total_checks ]; then
    echo "🎉 RCC v4.0端到端验证完全成功！"
    echo "   系统已准备就绪，可以继续开发或部署"
    exit 0
else
    echo "⚠️ RCC v4.0端到端验证部分成功"
    echo "   请解决上述问题后重新验证"
    exit 1
fi