#!/bin/bash

# 交付测试配置生成脚本
# 功能：为每个Provider生成独立的交付测试配置文件
# Project: Claude Code Router v2.8.0
# Owner: Jason Zhang

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置目录
DELIVERY_CONFIG_DIR="config/delivery-testing"
BASE_PORT=3458

# 创建配置目录
mkdir -p "$DELIVERY_CONFIG_DIR"
mkdir -p scripts

echo -e "${BLUE}🔧 生成交付测试配置文件${NC}"
echo "=================================="

# 1. CodeWhisperer Only 配置
echo -e "📝 生成 CodeWhisperer Only 配置..."
cat > "$DELIVERY_CONFIG_DIR/config-codewhisperer-only.json" << 'EOF'
{
  "name": "CodeWhisperer Only - Delivery Testing",
  "description": "Routes ALL categories to CodeWhisperer for isolated testing",
  "server": { 
    "port": 3458,
    "host": "127.0.0.1"
  },
  "routing": {
    "default": { "provider": "codewhisperer-primary", "model": "CLAUDE_SONNET_4_20250514_V1_0" },
    "background": { "provider": "codewhisperer-primary", "model": "CLAUDE_3_5_HAIKU_20241022_V1_0" },
    "thinking": { "provider": "codewhisperer-primary", "model": "CLAUDE_SONNET_4_20250514_V1_0" },
    "longcontext": { "provider": "codewhisperer-primary", "model": "CLAUDE_SONNET_4_20250514_V1_0" },
    "search": { "provider": "codewhisperer-primary", "model": "CLAUDE_SONNET_4_20250514_V1_0" }
  },
  "providers": {
    "codewhisperer-primary": {
      "type": "codewhisperer",
      "name": "CodeWhisperer Primary for Delivery Testing",
      "config": {
        "region": "us-east-1",
        "maxRetries": 3,
        "timeout": 60000
      },
      "models": {
        "CLAUDE_SONNET_4_20250514_V1_0": { "maxTokens": 200000 },
        "CLAUDE_3_5_HAIKU_20241022_V1_0": { "maxTokens": 200000 }
      }
    }
  },
  "logging": {
    "level": "debug",
    "file": "~/.route-claude-code/logs/delivery-codewhisperer-{timestamp}.log"
  },
  "deliveryTesting": {
    "enabled": true,
    "provider": "codewhisperer",
    "port": 3458,
    "scenarios": ["tool-calls", "multi-turn", "large-input", "long-response"]
  }
}
EOF

# 2. OpenAI Compatible Only 配置
echo -e "📝 生成 OpenAI Compatible Only 配置..."
cat > "$DELIVERY_CONFIG_DIR/config-openai-only.json" << 'EOF'
{
  "name": "OpenAI Compatible Only - Delivery Testing",
  "description": "Routes ALL categories to OpenAI Compatible for isolated testing",
  "server": { 
    "port": 3459,
    "host": "127.0.0.1"
  },
  "routing": {
    "default": { "provider": "shuaihong-test", "model": "claude-4-sonnet" },
    "background": { "provider": "shuaihong-test", "model": "claude-3-5-haiku-20241022" },
    "thinking": { "provider": "shuaihong-test", "model": "claude-4-sonnet" },
    "longcontext": { "provider": "shuaihong-test", "model": "claude-4-sonnet" },
    "search": { "provider": "shuaihong-test", "model": "claude-4-sonnet" }
  },
  "providers": {
    "shuaihong-test": {
      "type": "openai",
      "name": "ShuaiHong OpenAI Compatible for Delivery Testing",
      "config": {
        "baseURL": "https://api.gaccode.com/v1",
        "timeout": 60000,
        "maxRetries": 3
      },
      "models": {
        "claude-4-sonnet": { "maxTokens": 200000 },
        "claude-3-5-haiku-20241022": { "maxTokens": 200000 }
      }
    }
  },
  "logging": {
    "level": "debug", 
    "file": "~/.route-claude-code/logs/delivery-openai-{timestamp}.log"
  },
  "deliveryTesting": {
    "enabled": true,
    "provider": "openai",
    "port": 3459,
    "scenarios": ["tool-calls", "multi-turn", "large-input", "long-response"]
  }
}
EOF

# 3. Gemini Only 配置  
echo -e "📝 生成 Gemini Only 配置..."
cat > "$DELIVERY_CONFIG_DIR/config-gemini-only.json" << 'EOF'
{
  "name": "Gemini Only - Delivery Testing",
  "description": "Routes ALL categories to Gemini for isolated testing",
  "server": { 
    "port": 3460,
    "host": "127.0.0.1"
  },
  "routing": {
    "default": { "provider": "gemini-test", "model": "gemini-2.5-pro" },
    "background": { "provider": "gemini-test", "model": "gemini-2.5-flash" },
    "thinking": { "provider": "gemini-test", "model": "gemini-2.5-pro" },
    "longcontext": { "provider": "gemini-test", "model": "gemini-2.5-pro" },
    "search": { "provider": "gemini-test", "model": "gemini-2.5-pro" }
  },
  "providers": {
    "gemini-test": {
      "type": "gemini",
      "name": "Google Gemini for Delivery Testing",
      "config": {
        "timeout": 60000,
        "maxRetries": 3
      },
      "models": {
        "gemini-2.5-pro": { "maxTokens": 200000 },
        "gemini-2.5-flash": { "maxTokens": 200000 }
      }
    }
  },
  "logging": {
    "level": "debug",
    "file": "~/.route-claude-code/logs/delivery-gemini-{timestamp}.log"
  },
  "deliveryTesting": {
    "enabled": true,
    "provider": "gemini",
    "port": 3460,
    "scenarios": ["tool-calls", "multi-turn", "large-input", "long-response"]
  }
}
EOF

# 4. Anthropic Only 配置
echo -e "📝 生成 Anthropic Only 配置..."
cat > "$DELIVERY_CONFIG_DIR/config-anthropic-only.json" << 'EOF'
{
  "name": "Anthropic Only - Delivery Testing", 
  "description": "Routes ALL categories to Anthropic for isolated testing",
  "server": { 
    "port": 3461,
    "host": "127.0.0.1"
  },
  "routing": {
    "default": { "provider": "anthropic-test", "model": "claude-3-5-sonnet-20241022" },
    "background": { "provider": "anthropic-test", "model": "claude-3-5-haiku-20241022" },
    "thinking": { "provider": "anthropic-test", "model": "claude-3-5-sonnet-20241022" },
    "longcontext": { "provider": "anthropic-test", "model": "claude-3-5-sonnet-20241022" },
    "search": { "provider": "anthropic-test", "model": "claude-3-5-sonnet-20241022" }
  },
  "providers": {
    "anthropic-test": {
      "type": "anthropic",
      "name": "Anthropic Official for Delivery Testing",
      "config": {
        "baseURL": "https://api.anthropic.com",
        "timeout": 60000,
        "maxRetries": 3
      },
      "models": {
        "claude-3-5-sonnet-20241022": { "maxTokens": 200000 },
        "claude-3-5-haiku-20241022": { "maxTokens": 200000 }
      }
    }
  },
  "logging": {
    "level": "debug",
    "file": "~/.route-claude-code/logs/delivery-anthropic-{timestamp}.log"  
  },
  "deliveryTesting": {
    "enabled": true,
    "provider": "anthropic",
    "port": 3461,
    "scenarios": ["tool-calls", "multi-turn", "large-input", "long-response"]
  }
}
EOF

# 5. 混合Provider验证配置
echo -e "📝 生成 Mixed Provider 验证配置..."
cat > "$DELIVERY_CONFIG_DIR/config-mixed-validation.json" << 'EOF'
{
  "name": "Mixed Provider Validation - Delivery Testing",
  "description": "Mixed provider configuration for cross-provider validation testing",
  "server": { 
    "port": 3462,
    "host": "127.0.0.1"
  },
  "routing": {
    "default": { "provider": "shuaihong-mixed", "model": "claude-4-sonnet" },
    "background": { "provider": "gemini-mixed", "model": "gemini-2.5-flash" },
    "thinking": { "provider": "codewhisperer-mixed", "model": "CLAUDE_SONNET_4_20250514_V1_0" },
    "longcontext": { "provider": "shuaihong-mixed", "model": "claude-4-sonnet" },
    "search": { "provider": "gemini-mixed", "model": "gemini-2.5-pro" }
  },
  "providers": {
    "codewhisperer-mixed": {
      "type": "codewhisperer",
      "name": "CodeWhisperer Mixed Testing",
      "config": {
        "region": "us-east-1",
        "maxRetries": 3,
        "timeout": 60000
      }
    },
    "shuaihong-mixed": {
      "type": "openai",
      "name": "ShuaiHong Mixed Testing",
      "config": {
        "baseURL": "https://api.gaccode.com/v1",
        "timeout": 60000,
        "maxRetries": 3
      }
    },
    "gemini-mixed": {
      "type": "gemini",
      "name": "Gemini Mixed Testing",
      "config": {
        "timeout": 60000,
        "maxRetries": 3
      }
    }
  },
  "logging": {
    "level": "debug",
    "file": "~/.route-claude-code/logs/delivery-mixed-{timestamp}.log"
  },
  "deliveryTesting": {
    "enabled": true,
    "provider": "mixed",
    "port": 3462,
    "scenarios": ["tool-calls", "multi-turn", "large-input", "long-response", "provider-switching"]
  }
}
EOF

# 创建配置验证脚本
echo -e "📝 生成配置验证脚本..."
cat > "scripts/validate-delivery-configs.sh" << 'EOF'
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
EOF

chmod +x "scripts/validate-delivery-configs.sh"

# 创建Provider连接测试脚本
echo -e "📝 生成Provider连接测试脚本..."
cat > "scripts/validate-provider-connectivity.sh" << 'EOF'
#!/bin/bash

# Provider连接性验证脚本
# Project: Claude Code Router v2.8.0  
# Owner: Jason Zhang

set -e

CONFIG_FILE="$1"
TIMEOUT=${2:-30}

if [ -z "$CONFIG_FILE" ]; then
    echo "用法: $0 <配置文件> [超时秒数]"
    exit 1
fi

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ 配置文件不存在: $CONFIG_FILE"
    exit 1
fi

PORT=$(jq -r '.server.port' "$CONFIG_FILE")
PROVIDER=$(jq -r '.deliveryTesting.provider' "$CONFIG_FILE")

echo "🔍 测试Provider连接性..."
echo "配置文件: $CONFIG_FILE"
echo "Provider: $PROVIDER"
echo "端口: $PORT"

# 启动服务
echo "🚀 启动服务..."
node dist/cli.js start --config "$CONFIG_FILE" --daemon &
SERVER_PID=$!

# 等待服务启动
sleep 5

# 检查健康状态
echo "🔍 检查服务健康状态..."
if curl -s "http://127.0.0.1:$PORT/health" > /dev/null; then
    echo "✅ 服务健康检查通过"
else
    echo "❌ 服务健康检查失败"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

# 简单API测试
echo "🧪 执行简单API测试..."
API_RESPONSE=$(curl -s -X POST "http://127.0.0.1:$PORT/v1/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-delivery-key" \
  -d '{
    "model": "test-model",
    "messages": [{"role": "user", "content": [{"type": "text", "text": "Hello, this is a connectivity test."}]}],
    "max_tokens": 100
  }' || echo "ERROR")

if [[ "$API_RESPONSE" == *"ERROR"* ]] || [ -z "$API_RESPONSE" ]; then
    echo "❌ API连接测试失败"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
else
    echo "✅ API连接测试通过"
fi

# 清理
kill $SERVER_PID 2>/dev/null || true
echo "✅ Provider连接性验证完成"
EOF

chmod +x "scripts/validate-provider-connectivity.sh"

# 创建端口管理脚本
echo -e "📝 生成端口管理脚本..."
cat > "scripts/manage-delivery-ports.sh" << 'EOF'
#!/bin/bash

# 交付测试端口管理脚本
# Project: Claude Code Router v2.8.0
# Owner: Jason Zhang

set -e

ACTION=${1:-"status"}
PORT_RANGE="3458-3467"

function show_port_status() {
    echo "🔍 交付测试端口状态 ($PORT_RANGE):"
    echo "=================================="
    
    for port in {3458..3467}; do
        if lsof -i :$port > /dev/null 2>&1; then
            PID=$(lsof -ti :$port)
            CMD=$(ps -p $PID -o command= 2>/dev/null || echo "unknown")
            echo "  端口 $port: 🔴 占用 (PID: $PID, CMD: $CMD)"
        else
            echo "  端口 $port: 🟢 空闲"
        fi
    done
}

function cleanup_delivery_ports() {
    echo "🧹 清理交付测试端口..."
    
    for port in {3458..3467}; do
        if lsof -i :$port > /dev/null 2>&1; then
            PIDS=$(lsof -ti :$port)
            for PID in $PIDS; do
                CMD=$(ps -p $PID -o command= 2>/dev/null || echo "unknown")
                if [[ "$CMD" == *"rcc start"* ]] || [[ "$CMD" == *"dist/cli.js start"* ]]; then
                    echo "  停止端口 $port 上的服务 (PID: $PID)"
                    kill -TERM $PID 2>/dev/null || true
                fi
            done
        fi
    done
    
    sleep 2
    
    # 强制清理残留进程
    for port in {3458..3467}; do
        if lsof -i :$port > /dev/null 2>&1; then
            echo "  强制清理端口 $port"
            lsof -ti :$port | xargs kill -9 2>/dev/null || true
        fi
    done
    
    echo "✅ 端口清理完成"
}

function reserve_ports() {
    echo "🔒 预留交付测试端口..."
    echo "这将清理现有占用并确保端口可用"
    cleanup_delivery_ports
    show_port_status
}

case "$ACTION" in
    status)
        show_port_status
        ;;
    cleanup)
        cleanup_delivery_ports
        ;;
    reserve)
        reserve_ports
        ;;
    *)
        echo "用法: $0 {status|cleanup|reserve}"
        exit 1
        ;;
esac
EOF

chmod +x "scripts/manage-delivery-ports.sh"

echo -e "✅ 交付测试配置文件生成完成"
echo ""
echo -e "${BLUE}📋 生成的配置文件:${NC}"
echo -e "   📂 $DELIVERY_CONFIG_DIR/config-codewhisperer-only.json (端口: 3458)"
echo -e "   📂 $DELIVERY_CONFIG_DIR/config-openai-only.json (端口: 3459)"
echo -e "   📂 $DELIVERY_CONFIG_DIR/config-gemini-only.json (端口: 3460)"
echo -e "   📂 $DELIVERY_CONFIG_DIR/config-anthropic-only.json (端口: 3461)"
echo -e "   📂 $DELIVERY_CONFIG_DIR/config-mixed-validation.json (端口: 3462)"
echo ""
echo -e "${BLUE}📋 生成的工具脚本:${NC}"
echo -e "   🔧 scripts/validate-delivery-configs.sh"
echo -e "   🔧 scripts/validate-provider-connectivity.sh"
echo -e "   🔧 scripts/manage-delivery-ports.sh"
echo ""
echo -e "${GREEN}🎉 配置生成完成，可以开始交付测试了！${NC}"