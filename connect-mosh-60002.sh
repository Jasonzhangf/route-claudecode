#!/bin/bash
echo "=== Mosh快速连接（端口：��==="

# 检查mosh服务器是否运行
if ! pgrep -f "mosh-server.*-p 60002" > /dev/null; then
    echo "启动mosh服务器..."
    MOSH_OUTPUT=$(MOSH_KEY=quick123 /opt/homebrew/bin/mosh-server new -p 60002 2>&1)
    
    if [[ "$MOSH_OUTPUT" == *"MOSH CONNECT"* ]]; then
        echo "✅ 服务器启动成功"
    else
        echo "❌ 服务器启动失败: $MOSH_OUTPUT"
        exit 1
    fi
else
    echo "✅ 服务器已在运行"
fi

echo "连接中..."
MOSH_KEY=quick123 /opt/homebrew/bin/mosh-client localhost 60002
