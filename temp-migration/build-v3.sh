#!/bin/bash

# Claude Code Router V3.0 完整构建脚本
# 构建可用的V3生产版本

echo "🚀 Claude Code Router V3.0 完整构建"
echo "=================================="

cd /Users/fanzhang/Documents/github/route-claudecode

# 清理旧构建
echo "🧹 清理构建目录..."
rm -rf dist/

# 创建构建目录
mkdir -p dist/v3

# 构建核心模块
echo "🔧 构建V3核心模块..."
/tmp/build-v3-core.sh

# 复制V3启动器
echo "📋 复制V3启动器..."
cp v3-startup.js dist/v3-startup.js

# 复制配置和工具
echo "📁 复制项目文件..."
cp package.json dist/
cp tsconfig.json dist/

# 创建V3专用的package.json
echo "📦 创建V3 package.json..."
cat > dist/package.json << 'EOF'
{
  "name": "claude-code-router-v3",
  "version": "3.0.0", 
  "description": "Claude Code Router V3.0 - Six-layer architecture with pure implementation",
  "type": "module",
  "main": "v3-startup.js",
  "bin": {
    "rcc3": "v3-startup.js"
  },
  "scripts": {
    "start": "node v3-startup.js",
    "health": "curl -s http://localhost:3456/health",
    "status": "curl -s http://localhost:3456/status"
  },
  "dependencies": {
    "fastify": "^5.5.0",
    "uuid": "^11.1.0"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "author": "Jason Zhang",
  "license": "MIT"
}
EOF

# 创建启动脚本
echo "🎯 创建启动脚本..."
cat > dist/start-v3.sh << 'EOF'
#!/bin/bash
# V3启动脚本

CONFIG_PATH="${1:-/Users/fanzhang/.route-claudecode/config/v3/load-balancing/config-multi-provider-v3-3456.json}"

if [ ! -f "$CONFIG_PATH" ]; then
    echo "❌ 配置文件不存在: $CONFIG_PATH"
    exit 1
fi

echo "🚀 启动Claude Code Router V3.0..."
node v3-startup.js "$CONFIG_PATH"
EOF

chmod +x dist/start-v3.sh

# 创建README
echo "📖 创建README..."
cat > dist/README.md << 'EOF'
# Claude Code Router V3.0

🚀 Six-layer architecture with pure implementation

## Features

- ✅ Six-layer Architecture: Client → Router → Post-processor → Transformer → Provider-Protocol → Preprocessor
- ✅ Intelligent Load Balancing: weighted-round-robin with health monitoring
- ✅ Multi-Provider Support: CodeWhisperer, Gemini, OpenAI-Compatible
- ✅ Zero Hardcoding: Complete configuration-driven routing
- ✅ Zero v2.7 Dependencies: Pure V3 implementation

## Quick Start

```bash
# Install dependencies
npm install

# Start with default config
./start-v3.sh

# Start with custom config
./start-v3.sh /path/to/your/config.json

# Check health
npm run health
```

## Endpoints

- `GET /health` - Health check
- `GET /status` - Server status  
- `GET /v3/info` - V3 architecture details
- `POST /v1/messages` - V3 load balancing API

## Architecture

V3 implements a six-layer architecture:

1. **Client Layer**: Request reception and validation
2. **Router Layer**: Category determination and provider selection
3. **Post-processor Layer**: Request processing and enhancement
4. **Transformer Layer**: Format normalization
5. **Provider-Protocol Layer**: Provider-specific protocol handling
6. **Preprocessor Layer**: Provider-specific preprocessing

## Configuration

V3 uses structured JSON configuration with:

- `server`: Port, host, architecture settings
- `providers`: Multi-provider configurations with authentication
- `routing`: Category-based routing with weights
- `layers`: Six-layer architecture settings
- `governance`: Compliance rules and validation

Built with ❤️ by Jason Zhang
EOF

# 验证构建
echo "✅ 验证构建产物..."
echo "📁 构建目录结构:"
find dist -type f -name "*.js" | head -5
echo "..."
echo "📊 构建统计:"
echo "   JS文件: $(find dist -name "*.js" | wc -l)"
echo "   类型文件: $(find dist -name "*.d.ts" | wc -l)"
echo "   总文件: $(find dist -type f | wc -l)"

echo ""
echo "🎉 Claude Code Router V3.0 构建完成！"
echo "=================================="
echo "📁 构建目录: ./dist/"  
echo "🚀 启动命令: ./dist/start-v3.sh"
echo "📦 部署就绪: V3纯净架构构建成功"