#!/bin/bash

# Stop Hook - 构建和测试提醒
# 在Claude完成响应时提醒进行系统构建、全局安装和测试

# 从stdin读取JSON输入
input=$(cat)

if command -v jq >/dev/null 2>&1; then
    hook_event=$(echo "$input" | jq -r '.hook_event_name // "unknown"')
    session_id=$(echo "$input" | jq -r '.session_id // "unknown"')
    
    # 输出构建和测试提醒
    echo "🔔 STOP HOOK 系统提醒:" >&2
    echo "   📋 任务完成检查清单:" >&2
    echo "   ✅ 是否已完成 TypeScript 编译构建？" >&2
    echo "       运行: ./build-and-install.sh" >&2
    echo "   ✅ 是否已完成全局安装验证？" >&2
    echo "       验证: rcc4 --version" >&2
    echo "   ✅ 是否已完成端到端RCC debug系统测试？" >&2
    echo "       🎯 必须执行命令: ANTHROPIC_BASE_URL=http://localhost:5506 ANTHROPIC_API_KEY=rcc4-proxy-key claude --print \"测试修复后的debug系统：请列出当前目录下的文件\" --timeout 15" >&2
    echo "       📋 验证要点:" >&2
    echo "         • RCC服务器正常启动 (localhost:5506)" >&2
    echo "         • Claude客户端连接成功" >&2
    echo "         • 工具调用功能正常 (文件列表)" >&2
    echo "         • Debug系统记录完整" >&2
    echo "   ✅ 是否已完成基础端到端测试？" >&2
    echo "       替代测试: ANTHROPIC_BASE_URL=http://localhost:5506 ANTHROPIC_API_KEY=rcc4-proxy-key claude --print \"列出本目录中所有文件夹\"" >&2
    echo "   ✅ 是否已运行完整测试套件？" >&2
    echo "       执行: npm test && npm run build" >&2
    echo "" >&2
    echo "   💡 提醒: 根据CLAUDE.md规范，必须使用标准构建流程确保系统完整性" >&2
    
    # 记录到日志
    echo "$(date): Stop hook triggered - Build/Test reminder shown (Session: $session_id)" >> ~/.claude/hook-activity.log
else
    echo "🔔 构建测试提醒: 请完成构建、安装和测试验证" >&2
fi

# 成功退出，不阻止停止
exit 0