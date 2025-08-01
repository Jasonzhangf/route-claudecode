#!/bin/bash

# Single-Provider配置文件端口验证脚本
# 项目所有者：Jason Zhang

CONFIG_DIR="$HOME/.route-claude-code/config/single-provider"
echo "🔍 验证Single-Provider配置文件端口映射"
echo "📁 配置目录: $CONFIG_DIR"
echo

cd "$CONFIG_DIR" || exit 1

SUCCESS_COUNT=0
TOTAL_COUNT=0

for config_file in config-*-*.json; do
    if [[ ! -f "$config_file" ]]; then
        continue
    fi
    
    TOTAL_COUNT=$((TOTAL_COUNT + 1))
    
    # 从文件名提取端口号
    FILE_PORT=$(echo "$config_file" | grep -o '[0-9]\{4\}' | tail -1)
    
    # 从JSON配置提取端口号
    JSON_PORT=$(jq -r '.server.port' "$config_file" 2>/dev/null)
    
    # 提取provider类型
    PROVIDER_TYPE=$(jq -r '.providers | keys[0]' "$config_file" 2>/dev/null)
    PROVIDER_CONFIG_TYPE=$(jq -r '.providers | .[keys[0]].type' "$config_file" 2>/dev/null)
    
    echo "📄 配置文件: $config_file"
    echo "   文件名端口: $FILE_PORT"
    echo "   配置端口: $JSON_PORT" 
    echo "   Provider: $PROVIDER_TYPE ($PROVIDER_CONFIG_TYPE)"
    
    if [[ "$FILE_PORT" == "$JSON_PORT" ]]; then
        echo "   ✅ 端口映射正确"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo "   ❌ 端口映射错误！"
    fi
    echo
done

echo "📊 验证结果总结:"
echo "   总配置文件: $TOTAL_COUNT"
echo "   端口映射正确: $SUCCESS_COUNT"
echo "   端口映射错误: $((TOTAL_COUNT - SUCCESS_COUNT))"

if [[ $SUCCESS_COUNT -eq $TOTAL_COUNT ]]; then
    echo "🎉 所有配置文件端口映射验证通过！"
    exit 0
else
    echo "⚠️  发现端口映射错误，需要修复"
    exit 1
fi