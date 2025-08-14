#!/bin/bash

# 交付测试配置验证脚本
# Project: Claude Code Router v2.8.0
# Owner: Jason Zhang

set -e

CONFIG_DIR=${1:-"config/delivery-testing"}
RESULTS_FILE="/tmp/config-validation-$(date +%s).json"

echo "🔍 验证交付测试配置文件..."
echo "配置目录: $CONFIG_DIR"

# 验证JSON格式
echo "📋 检查JSON格式..."
for config in "$CONFIG_DIR"/*.json; do
    if [ -f "$config" ]; then
        echo "  检查: $(basename "$config")"
        if jq . "$config" > /dev/null 2>&1; then
            echo "    ✅ JSON格式正确"
        else
            echo "    ❌ JSON格式错误"
            exit 1
        fi
    fi
done

# 验证端口唯一性
echo "📋 检查端口唯一性..."
ports=$(jq -r '.server.port' "$CONFIG_DIR"/*.json | sort | uniq -d)
if [ -n "$ports" ]; then
    echo "❌ 发现重复端口: $ports"
    exit 1
else
    echo "✅ 端口配置唯一"
fi

# 验证Provider配置完整性
echo "📋 检查Provider配置完整性..."
for config in "$CONFIG_DIR"/*.json; do
    if [ -f "$config" ]; then
        config_name=$(basename "$config")
        echo "  检查配置: $config_name"
        
        # 检查必需字段
        required_fields=(".name" ".server.port" ".routing" ".providers")
        for field in "${required_fields[@]}"; do
            if jq -e "$field" "$config" > /dev/null 2>&1; then
                echo "    ✅ 字段存在: $field"
            else
                echo "    ❌ 缺少字段: $field"
                exit 1
            fi
        done
    fi
done

echo "✅ 所有配置文件验证通过"

# 生成验证报告
cat > "$RESULTS_FILE" << EOJSON
{
  "validation": {
    "timestamp": "$(date -Iseconds)",
    "status": "PASS",
    "configDirectory": "$CONFIG_DIR",
    "validatedConfigs": [
EOJSON

first=true
for config in "$CONFIG_DIR"/*.json; do
    if [ -f "$config" ]; then
        if [ "$first" = false ]; then
            echo "," >> "$RESULTS_FILE"
        fi
        echo "      {" >> "$RESULTS_FILE"
        echo "        \"file\": \"$(basename "$config")\"," >> "$RESULTS_FILE"
        echo "        \"port\": $(jq '.server.port' "$config")," >> "$RESULTS_FILE"
        echo "        \"provider\": \"$(jq -r '.deliveryTesting.provider' "$config")\"," >> "$RESULTS_FILE"
        echo "        \"status\": \"VALID\"" >> "$RESULTS_FILE"
        echo "      }" >> "$RESULTS_FILE"
        first=false
    fi
done

cat >> "$RESULTS_FILE" << EOJSON
    ]
  }
}
EOJSON

echo "📊 验证报告保存到: $RESULTS_FILE"
