# 🚀 Claude Code Router - Quick Start Guide

## Overview

Claude Code Router is a powerful routing system that seamlessly redirects your Claude Code requests to multiple AI providers (AWS CodeWhisperer, OpenAI-compatible services) while maintaining full compatibility with your existing workflow.

## ⚡ Quick Setup (2 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Router
```bash
# Method 1: One-command development setup
./fix-and-test.sh --debug

# Method 2: Using CLI directly  
npm run build
npx ccr start --debug
```

### 3. Configure Environment Variables
```bash
# Add to your shell profile (.bashrc, .zshrc, etc.)
export ANTHROPIC_BASE_URL=http://127.0.0.1:3456
export ANTHROPIC_API_KEY=any-string-is-ok
```

### 4. Use Claude Code Normally
```bash
# Claude Code will now automatically route through your router
claude-code "Help me write a React component"
```

That's it! Claude Code now routes through your router with intelligent provider selection.

## 🎯 Use Cases

### 1. Claude Code → CodeWhisperer One-Click
**Goal**: Route all Claude Code requests to AWS CodeWhisperer

**Configuration**: Use the default config - it's already set up for CodeWhisperer!

**Benefits**: 
- Lower costs than direct Claude usage
- Same experience as Claude Code
- Automatic token management

### 2. Mixed Provider Routing
**Goal**: Use different providers for different types of tasks

**Configuration**: 
```bash
cp config.example.json ~/.claude-code-router/config.json
# Edit the config file with your API keys
```

**Routing Rules**:
- 🤖 **Code generation** → CodeWhisperer (optimized for code)
- 🧠 **Complex reasoning** → OpenAI GPT-4 (better at logic)
- ✍️ **Creative writing** → OpenAI GPT-4 (more creative)
- 📊 **Background tasks** → Cheaper models
- 🔍 **Search queries** → Fast OpenAI models

### 3. Load Balancing Multiple Providers
**Goal**: Distribute load across multiple CodeWhisperer instances

**Setup**: Configure multiple providers in your config with different tokens.

**Benefits**:
- Higher throughput
- Automatic failover
- Load distribution

## 📋 Configuration

### Basic Configuration
```json
{
  "server": {
    "port": 3456,
    "host": "127.0.0.1"
  },
  "routing": {
    "defaultProvider": "codewhisperer-primary",
    "rules": {
      "default": {
        "provider": "codewhisperer-primary",
        "model": "CLAUDE_SONNET_4_20250514_V1_0"
      }
    },
    "providers": {
      "codewhisperer-primary": {
        "type": "codewhisperer",
        "endpoint": "https://codewhisperer.us-east-1.amazonaws.com",
        "authentication": {
          "type": "bearer",
          "credentials": {
            "tokenPath": "~/.aws/sso/cache/kiro-auth-token.json"
          }
        }
      }
    }
  }
}
```

### Environment Variables
- `ANTHROPIC_BASE_URL`: Point to your router (http://127.0.0.1:3456)
- `ANTHROPIC_API_KEY`: Any string (ignored by router)
- `SHUAIHONG_API_KEY`: Your OpenAI-compatible API key (if using mixed providers)

## 🛠 CLI Commands

```bash
# Start the router
ccr start                    # Start with default config
ccr start --debug           # Start with debug logging
ccr start --port 3457       # Start on custom port

# Check status
ccr status                   # Basic server status
ccr health                   # Health check all providers

# Configuration
ccr config --show           # Show current config
ccr config --edit           # Edit config file
```

## 🔧 Debugging

### Enable Debug Mode
```bash
ccr start --debug --log-level debug
```

### Monitor Logs
```bash
# Real-time log monitoring
tail -f /tmp/ccr-dev-$(date +%Y%m%d)*.log

# Or check server logs
tail -f ~/.claude-code-router/logs/server.log
```

### Test Health
```bash
# Quick health check
curl http://127.0.0.1:3456/health

# Detailed status
curl http://127.0.0.1:3456/status | jq .
```

## 🎨 Advanced Features

### Intelligent Routing
The router automatically classifies your requests:
- **Code generation**: Programming tasks → CodeWhisperer
- **Creative writing**: Stories, essays → OpenAI
- **Complex reasoning**: Math, logic → OpenAI  
- **Long context**: Large documents → CodeWhisperer
- **Background tasks**: Low priority → Cheaper models

### Hook System
Add custom logic at any point:
```json
{
  "debug": {
    "hooks": {
      "onRequest": "console.log('Request:', data.url)",
      "onRouting": "console.log('Using provider:', data.provider)",
      "onResponse": "console.log('Response time:', data.duration)"
    }
  }
}
```

### Load Balancing
Distribute requests across multiple providers:
```json
{
  "loadBalancing": {
    "enabled": true,
    "strategy": "round-robin",
    "weights": {
      "codewhisperer-primary": 60,
      "codewhisperer-secondary": 40
    }
  }
}
```

## 🚨 Troubleshooting

### Common Issues

**Router not starting?**
```bash
# Check if port is in use
lsof -i :3456

# Kill existing process
./fix-and-test.sh  # This handles port cleanup automatically
```

**Claude Code not routing?**
```bash
# Verify environment variables
echo $ANTHROPIC_BASE_URL
echo $ANTHROPIC_API_KEY

# Test router directly
curl -X POST http://127.0.0.1:3456/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-3-sonnet-20240229", "max_tokens": 10, "messages": [{"role": "user", "content": "Hi"}]}'
```

**Provider authentication failing?**
```bash
# Check CodeWhisperer token
cat ~/.aws/sso/cache/kiro-auth-token.json

# Refresh Kiro token
kiro refresh  # If using Kiro2cc tool
```

### Getting Help

1. **Check logs**: Debug mode shows detailed request/response flow
2. **Validate config**: Use `ccr config --show` to verify settings
3. **Test providers**: Use `ccr health` to check provider status
4. **Test routing**: Enable debug hooks to see routing decisions

## 📚 More Information

- **Configuration Examples**: `config.example.json`
- **Architecture Details**: `CLAUDE.md`
- **Use Cases**: `use-cases/` directory
- **Test Suite**: `./test-all.sh`

## 🎉 Success!

You now have a production-ready Claude Code router that can:
- ✅ Route Claude Code requests transparently
- ✅ Support multiple AI providers
- ✅ Intelligent task-based routing
- ✅ Load balancing and failover
- ✅ Complete debugging and monitoring

Enjoy your optimized AI workflow! 🚀