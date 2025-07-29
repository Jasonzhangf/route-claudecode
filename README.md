# RCC (Route Claude Code)

🚀 **Enterprise-grade dual-server routing system for Claude Code with intelligent multi-provider support, advanced daemon management, and real-time monitoring.**

[![npm version](https://badge.fury.io/js/route-claudecode.svg)](https://badge.fury.io/js/route-claudecode)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Key Features

### 🎯 **Dual-Server Architecture (NEW in v2.3.0)**
- 🔄 **Dual Configuration Mode**: Simultaneous development (3456) and release (8888) servers
- 🖥️ **Unified Web Dashboard**: Monitor both servers from a single interface
- 🔧 **Temporary Model Toggle**: Enable/disable models without persisting changes
- 🚀 **Daemon Mode**: Background process management with auto-restart capabilities
- 🔄 **Auto-Start Support**: Boot-time startup with dual-server configuration

### 🧠 **Intelligent Routing System**
- 🎯 **Category-Based Routing**: `default`, `background`, `thinking`, `longcontext`, `search`
- 🔄 **Multi-Provider Support**: AWS CodeWhisperer, OpenAI-compatible APIs, Google Gemini
- ⚖️ **Advanced Load Balancing**: Weighted, round-robin, health-based strategies
- 🛡️ **429 Rate Limit Handling**: Automatic blacklisting and load redistribution
- 🛠️ **Perfect Tool Call Support**: 100% accuracy with buffered processing

### 🚀 **Enterprise Features**
- ⚡ **Zero Hardcoding**: Completely configurable system
- 📊 **Real-time Monitoring**: Beautiful web dashboard with live statistics
- 🔐 **Enhanced Security**: Secure configuration and authentication management
- 📈 **Performance Analytics**: Detailed metrics and failure analysis
- 🔄 **Session Persistence**: Maintain sessions across server restarts

## 📋 Prerequisites

- **Node.js 16+** (18+ recommended)
- **Operating System**: macOS 10.15+, Ubuntu 20.04+, Windows 10+ (with WSL)
- **Claude Code CLI** installed
- **Provider credentials** (AWS CodeWhisperer, OpenAI keys, etc.)

## 🚀 Quick Start

### Step 1: Install RCC
```bash
npm install -g route-claudecode
```

### Step 2: Start Dual-Server Mode (Default)
```bash
# Start both development and release servers
rcc start

# Or explicitly with daemon mode and auto-start
rcc start --daemon --autostart
```

### Step 3: Configure Environment
```bash
# Development environment (port 3456)
export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"
export ANTHROPIC_API_KEY="rcc-router-key"

# Or release environment (port 8888)
export ANTHROPIC_BASE_URL="http://127.0.0.1:8888"
export ANTHROPIC_API_KEY="rcc-router-key"
```

### Step 4: Monitor Both Servers
```bash
# Check daemon status
rcc status --daemon

# Access unified monitoring dashboard
open http://localhost:3456/dual-stats
# Or development server: http://localhost:3456/stats
# Or release server: http://localhost:8888/stats
```

## 🎛️ **New CLI Commands (v2.3.0)**

### **Dual-Server Management**
```bash
# Start dual-config mode (default behavior)
rcc start                              # Both servers: 3456 + 8888
rcc start --single-config             # Single server mode
rcc start --daemon                     # Background dual-server mode
rcc start --daemon --autostart        # Boot-time dual-server startup

# Check status
rcc status                             # Check running servers
rcc status --daemon                    # Check daemon status

# Stop services
rcc stop                               # Stop running servers
rcc stop --daemon                      # Stop daemon mode
```

### **Daemon Mode Benefits**
- ✅ **Background Operation**: Services run independently of terminal
- ✅ **Auto-Restart**: Services restart automatically on failure
- ✅ **Boot-Time Startup**: Services start automatically on system boot
- ✅ **Process Management**: Proper PID management and signal handling
- ✅ **Log Management**: Centralized logging to `/tmp/rcc-daemon.log`

### **Server Configuration**

#### Development Server (`config.json`)
```json
{
  "server": {
    "port": 3456,
    "host": "0.0.0.0",
    "name": "development"
  },
  "routing": {
    "default": {
      "providers": [
        {"provider": "codewhisperer-primary", "model": "CLAUDE_SONNET_4_20250514_V1_0", "weight": 70},
        {"provider": "modelscope-openai", "model": "Qwen/Qwen3-Coder-480B-A35B-Instruct", "weight": 30}
      ],
      "loadBalancing": {"enabled": true, "strategy": "health_based_with_blacklist"},
      "failover": {
        "enabled": true,
        "triggers": [{"type": "http_status", "codes": [429], "blacklistDuration": 300}]
      }
    }
  }
}
```

#### Release Server (`config.release.json`)
```json
{
  "server": {
    "port": 8888,
    "host": "0.0.0.0",
    "name": "release"
  },
  "routing": {
    "default": {
      "providers": [
        {"provider": "kiro-zcam", "model": "CLAUDE_SONNET_4_20250514_V1_0", "weight": 100}
      ],
      "loadBalancing": {"enabled": false}
    }
  }
}
```

## 📊 **Unified Monitoring Dashboard**

### **Dual-Stats Dashboard** 
Access at `http://localhost:3456/dual-stats` or `http://localhost:8888/dual-stats`

**Features:**
- 🖥️ **Server Comparison**: Side-by-side development vs release metrics
- 🎛️ **Live Model Toggle**: Enable/disable models in real-time (non-persistent)
- 📈 **Real-time Statistics**: Live request counts, success rates, response times
- 🔄 **Provider Health**: Visual status indicators with blacklist information
- ⚡ **Instant Updates**: 30-second auto-refresh with manual refresh capability

**Model Control Features:**
- ✅ **Temporary Toggle**: Enable/disable providers without config changes
- 🔄 **System Recovery**: Automatic re-enable after blacklist timeout
- 🚫 **User Override**: Manual disable for maintenance or testing
- 📊 **Status Indicators**: Clear visual feedback (enabled/disabled/blacklisted)

### **Individual Server Dashboards**
- **Development**: `http://localhost:3456/stats`
- **Release**: `http://localhost:8888/stats`

## ⚙️ **Advanced Configuration**

### **Load Balancing with Rate Limit Protection**
```json
{
  "routing": {
    "longcontext": {
      "providers": [
        {"provider": "shuaihong-openai", "model": "gemini-2.5-pro", "weight": 40},
        {"provider": "gemini-jason-gmail", "model": "gemini-2.5-pro", "weight": 30},
        {"provider": "gemini-jason-zcam", "model": "gemini-2.5-pro", "weight": 20},
        {"provider": "gemini-nguyentronghuebich", "model": "gemini-2.5-pro", "weight": 10}
      ],
      "loadBalancing": {"enabled": true, "strategy": "health_based_with_blacklist"},
      "failover": {
        "enabled": true,
        "triggers": [{"type": "http_status", "codes": [429], "blacklistDuration": 300}]
      }
    }
  }
}
```

### **Provider Types**

#### **AWS CodeWhisperer (Enterprise)**
```json
{
  "codewhisperer-primary": {
    "type": "codewhisperer",
    "endpoint": "https://codewhisperer.us-east-1.amazonaws.com",
    "authentication": {
      "type": "bearer",
      "credentials": {"tokenPath": "~/.aws/sso/cache/your-token.json"}
    },
    "models": ["CLAUDE_SONNET_4_20250514_V1_0"],
    "defaultModel": "CLAUDE_SONNET_4_20250514_V1_0"
  }
}
```

#### **OpenAI-Compatible (ModelScope, Gemini, etc.)**
```json
{
  "shuaihong-openai": {
    "type": "openai",
    "endpoint": "https://ai.shuaihong.fun/v1/chat/completions",
    "authentication": {
      "type": "bearer",
      "credentials": {"apiKey": "sk-your-key-here"}
    },
    "models": ["gemini-2.5-pro", "gemini-2.5-flash"],
    "defaultModel": "gemini-2.5-pro"
  }
}
```

## 🎯 **Intelligent Routing**

### **Category Determination**
- **`background`**: Haiku models (`claude-3-5-haiku-*`) → Fast, lightweight processing
- **`thinking`**: `thinking=true` parameter → Complex reasoning tasks
- **`longcontext`**: Content > 60K tokens → Extended context handling
- **`search`**: Tool definitions present → Search and function calling
- **`default`**: All other requests → General-purpose routing

### **Model Mapping Examples**
```
claude-3-5-haiku-20241022              → background → gemini-2.5-flash
claude-sonnet-4-20250514 + thinking   → thinking   → CLAUDE_SONNET_4_20250514_V1_0
claude-3-5-sonnet + 70K tokens        → longcontext → gemini-2.5-pro
claude-sonnet-4-20250514 + tools      → search     → gemini-2.5-flash
claude-sonnet-4-20250514              → default    → CLAUDE_SONNET_4_20250514_V1_0
```

## 🛠️ **Deployment Options**

### **Development Setup**
```bash
# Start development with debugging
rcc start --debug --log-level debug

# Access development dashboard
open http://localhost:3456/stats
```

### **Production Deployment**
```bash
# Start production daemon with auto-start
rcc start --daemon --autostart

# Monitor production
rcc status --daemon
open http://localhost:8888/stats
```

### **Hybrid Setup**
```bash
# Run both development and release servers
rcc start --daemon

# Access unified monitoring
open http://localhost:3456/dual-stats
```

## 🔧 **Troubleshooting**

### **Common Issues**

#### **Port Conflicts**
```bash
# Check port usage
lsof -i :3456
lsof -i :8888

# Stop conflicting processes
rcc stop --daemon
```

#### **Configuration Validation**
```bash
# Validate both configs
rcc config --show ~/.route-claude-code/config.json
rcc config --show ~/.route-claude-code/config.release.json

# Test connectivity
curl http://localhost:3456/health
curl http://localhost:8888/health
```

#### **Daemon Management**
```bash
# Check daemon logs
tail -f /tmp/rcc-daemon.log

# Restart daemon
rcc stop --daemon
rcc start --daemon

# Check daemon status
rcc status --daemon
```

## 🧪 **Testing**

### **Test Dual-Server Setup**
```bash
# Set up development environment
export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"
export ANTHROPIC_API_KEY="rcc-router-key"
claude "Test development server"

# Switch to release environment
export ANTHROPIC_BASE_URL="http://127.0.0.1:8888"
claude "Test release server"

# Monitor both in dashboard
open http://localhost:3456/dual-stats
```

### **Load Balancing Test**
```bash
# Generate concurrent requests
for i in {1..10}; do
  curl -X POST http://localhost:3456/v1/messages \
    -H "Content-Type: application/json" \
    -d '{"model": "claude-sonnet-4-20250514", "messages": [{"role": "user", "content": "Test '$i'"}], "max_tokens": 100}' &
done

# Check load distribution
curl http://localhost:3456/api/stats | jq '.providers'
```

## 🔄 **Version 2.3.0 Changelog**

### 🆕 **Major New Features**
- ✅ **Dual-Server Architecture**: Simultaneous dev/release server management
- ✅ **Enhanced Daemon Mode**: Proper background process management with auto-restart
- ✅ **Unified Monitoring Dashboard**: Single interface for monitoring both servers
- ✅ **Temporary Model Toggle**: Real-time enable/disable without configuration changes
- ✅ **Auto-Start Integration**: Boot-time startup with dual-server configuration
- ✅ **Rate Limit Protection**: 429 error handling with temporary blacklisting
- ✅ **Health-Based Load Balancing**: Intelligent routing based on provider health

### 🏗️ **Architecture Improvements**
- **Default Dual-Config**: `rcc start` now defaults to dual-server mode
- **Daemon-First Design**: Background operation as primary deployment method
- **Enhanced CLI**: Simplified commands with intelligent defaults
- **Process Management**: Proper PID handling and signal management
- **Configuration Flexibility**: Support for both single and dual configurations

### 🐛 **Bug Fixes**
- Fixed autostart configuration to use dual-config mode by default
- Resolved daemon script signal handling issues
- Corrected model toggle persistence behavior
- Enhanced error handling for port conflicts
- Improved logging and monitoring accuracy

## 📄 **License**

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 **Acknowledgments**

- AWS CodeWhisperer for enterprise-grade API
- OpenAI for standardized API formats
- Anthropic for Claude and Claude Code
- All contributors and community members

## 📞 **Support**

- 📖 **Documentation**: [GitHub Repository](https://github.com/fanzhang16/claude-code-router)
- 🐛 **Issues**: [GitHub Issues](https://github.com/fanzhang16/claude-code-router/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/fanzhang16/claude-code-router/discussions)
- 📊 **Live Monitoring**: `http://localhost:3456/dual-stats`

---

**Made with ❤️ for the Claude Code community**

*RCC v2.3.0 - Dual-server architecture with intelligent daemon management*