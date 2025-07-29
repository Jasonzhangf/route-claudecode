# RCC (Route Claude Code)

🚀 **A high-performance, enterprise-grade routing system for Claude Code that supports intelligent multi-provider routing, advanced load balancing, concurrent request management, and comprehensive monitoring.**

[![npm version](https://badge.fury.io/js/rcc.svg)](https://badge.fury.io/js/rcc)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Key Features

### 🎯 Core Capabilities
- 🔄 **Multi-Provider Support**: AWS CodeWhisperer, Anthropic Direct, Google Gemini, OpenAI-compatible APIs, ModelScope
- 🧠 **Intelligent Routing**: Category-based routing with `default`, `background`, `thinking`, `longcontext`, and `search` categories
- 🛠️ **Perfect Tool Call Support**: Advanced tool call parsing with buffered processing for 100% accuracy
- 🔧 **Format Transformation**: Seamless conversion between Anthropic, OpenAI, and provider-specific formats
- ⚡ **Zero Hardcoding**: Completely configurable with no hardcoded model names or endpoints

### 🚀 Advanced Features (v2.1.0+)
- ⚖️ **Advanced Load Balancing**: Weighted, round-robin, and health-based strategies with automatic failover
- 🔀 **Concurrent Request Management**: Provider-level concurrency control with intelligent queue management  
- 📊 **Real-time Monitoring Dashboard**: Beautiful web interface with live statistics and analytics
- 🔄 **Auto-Start Support**: System-level service management for macOS and Linux
- 🎛️ **Unified Control Scripts**: Single-command deployment for development and production environments
- 📈 **Performance Analytics**: Detailed metrics, failure analysis, and trend monitoring
- 🔐 **Enhanced Security**: Advanced authentication methods and secure configuration management

### 🏗️ Architecture Highlights
- **Category-Based Routing**: Requests automatically routed based on content analysis and model requirements
- **Provider Health Monitoring**: Continuous health checks with automatic failover and recovery
- **Buffered Processing**: Complete response buffering for perfect tool call handling
- **Multi-Instance Support**: Deploy multiple router instances with session persistence
- **Comprehensive Logging**: Full request/response tracing with configurable log levels

## 📋 Prerequisites

Before installing RCC, ensure you have:

- **Node.js 16+** (18+ recommended)
- **Operating System**: macOS 10.15+, Ubuntu 20.04+/Debian 10+, or Windows 10+ (with WSL or Git for Windows)
- **Hardware**: 4GB+ RAM (8GB+ recommended for concurrent processing)
- **Claude Code CLI** installed
- **Provider credentials** (AWS CodeWhisperer, OpenAI-compatible API keys, or Anthropic keys)

## 🚀 Quick Start

### Step 1: Install RCC
```bash
npm install -g rcc
```

### Step 2: Basic Setup
```bash
# Create configuration directory
mkdir -p ~/.route-claude-code

# Start with interactive setup
rcc start --autostart

# Configure environment variables
export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"
export ANTHROPIC_API_KEY="rcc-router-key"
```

### Step 3: Test the Setup
```bash
# Check status
rcc status

# Test with Claude Code
claude "Hello from RCC!"

# View monitoring dashboard
open http://localhost:3456/stats
```

## 📊 Monitoring Dashboard

RCC includes a comprehensive web-based monitoring dashboard accessible at `http://localhost:{port}/stats`:

### Dashboard Features
- **Real-time Statistics**: Live request counts, success rates, and performance metrics
- **Provider Health**: Visual status indicators for all configured providers
- **Load Balancing Analytics**: Weight distribution and routing effectiveness analysis
- **Concurrent Request Monitoring**: Active connections and queue status per provider
- **Failure Analysis**: Detailed error categorization and trend analysis
- **Performance Metrics**: Response times, throughput, and optimization recommendations

### Dashboard Navigation
- **System Overview**: Total requests, active providers, models in use, overall success rate
- **Real-time Status**: Current provider availability and concurrent connection utilization
- **Provider Distribution**: Request distribution across configured providers
- **Model Usage**: Most used models and their request frequencies
- **Weight Effect Analysis**: Effectiveness of load balancing configuration
- **Performance Indicators**: Average response times and requests per minute
- **Failure Analysis**: Error categorization, trends, and recommendations
- **Historical Data**: Daily trends and usage patterns

## ⚙️ Advanced Configuration

### Load Balancing Configuration

RCC supports multiple load balancing strategies:

```json
{
  "routing": {
    "default": {
      "providers": [
        {
          "provider": "codewhisperer-primary",
          "model": "CLAUDE_SONNET_4_20250514_V1_0",
          "weight": 70
        },
        {
          "provider": "codewhisperer-backup",
          "model": "CLAUDE_SONNET_4_20250514_V1_0",
          "weight": 30
        }
      ],
      "loadBalancing": {
        "enabled": true,
        "strategy": "weighted"
      },
      "failover": {
        "enabled": true,
        "triggers": [
          {
            "type": "consecutive_errors",
            "threshold": 3
          },
          {
            "type": "http_error",
            "httpCodes": [500, 502, 503],
            "threshold": 3,
            "timeWindow": 300
          }
        ],
        "cooldown": 60
      }
    }
  }
}
```

### Concurrency Management

Control concurrent requests per provider:

```json
{
  "concurrency": {
    "enabled": true,
    "maxConcurrencyPerProvider": 3,
    "lockTimeoutMs": 300000,
    "queueTimeoutMs": 60000,
    "enableWaitingQueue": true,
    "preferIdleProviders": true
  }
}
```

### Category-Based Routing

Configure intelligent routing based on request characteristics:

```json
{
  "routing": {
    "default": {
      "providers": [
        {"provider": "codewhisperer-primary", "model": "CLAUDE_SONNET_4_20250514_V1_0", "weight": 70},
        {"provider": "modelscope-openai", "model": "Qwen/Qwen3-Coder-480B-A35B-Instruct", "weight": 30}
      ],
      "loadBalancing": {"enabled": true, "strategy": "weighted"}
    },
    "background": {
      "providers": [
        {"provider": "shuaihong-openai", "model": "gemini-2.5-flash", "weight": 80},
        {"provider": "codewhisperer-backup", "model": "CLAUDE_SONNET_4_20250514_V1_0", "weight": 20}
      ],
      "loadBalancing": {"enabled": true, "strategy": "round_robin"}
    },
    "thinking": {
      "providers": [
        {"provider": "codewhisperer-primary", "model": "CLAUDE_SONNET_4_20250514_V1_0", "weight": 70},
        {"provider": "shuaihong-openai", "model": "gemini-2.5-pro", "weight": 30}
      ],
      "loadBalancing": {"enabled": true, "strategy": "weighted"}
    },
    "longcontext": {
      "providers": [
        {"provider": "shuaihong-openai", "model": "gemini-2.5-pro", "weight": 60},
        {"provider": "modelscope-openai", "model": "Qwen/Qwen3-Coder-480B-A35B-Instruct", "weight": 40}
      ],
      "loadBalancing": {"enabled": true, "strategy": "health_based"}
    },
    "search": {
      "providers": [
        {"provider": "shuaihong-openai", "model": "gemini-2.5-flash", "weight": 70},
        {"provider": "modelscope-openai", "model": "Qwen/Qwen3-Coder-480B-A35B-Instruct", "weight": 30}
      ],
      "loadBalancing": {"enabled": true, "strategy": "weighted"}
    }
  }
}
```

### Provider Configuration Examples

#### AWS CodeWhisperer (Enterprise-Grade)
```json
{
  "codewhisperer-primary": {
    "type": "codewhisperer",
    "endpoint": "https://codewhisperer.us-east-1.amazonaws.com",
    "authentication": {
      "type": "bearer",
      "credentials": {
        "tokenPath": "~/.aws/sso/cache/your-auth-token.json"
      }
    },
    "models": [
      "CLAUDE_SONNET_4_20250514_V1_0",
      "CLAUDE_3_7_SONNET_20250219_V1_0"
    ],
    "defaultModel": "CLAUDE_SONNET_4_20250514_V1_0",
    "maxTokens": {
      "CLAUDE_SONNET_4_20250514_V1_0": 131072,
      "CLAUDE_3_7_SONNET_20250219_V1_0": 131072
    }
  }
}
```

#### OpenAI-Compatible Provider (Including ModelScope)
```json
{
  "modelscope-openai": {
    "type": "openai",
    "endpoint": "https://api-inference.modelscope.cn/v1/chat/completions",
    "authentication": {
      "type": "bearer",
      "credentials": {
        "apiKey": "ms-your-api-key-here"
      }
    },
    "models": [
      "Qwen/Qwen3-Coder-480B-A35B-Instruct"
    ],
    "defaultModel": "Qwen/Qwen3-Coder-480B-A35B-Instruct",
    "maxTokens": {
      "Qwen/Qwen3-Coder-480B-A35B-Instruct": 262144
    },
    "timeout": 120000,
    "description": "ModelScope CN API with OpenAI-compatible interface for Qwen3-Coder-480B"
  }
}
```

#### Third-Party OpenAI Provider
```json
{
  "shuaihong-openai": {
    "type": "openai",
    "endpoint": "https://ai.shuaihong.fun/v1/chat/completions",
    "authentication": {
      "type": "bearer",
      "credentials": {
        "apiKey": "sk-your-api-key-here"
      }
    },
    "models": [
      "gemini-2.5-pro",
      "gemini-2.5-flash"
    ],
    "defaultModel": "gemini-2.5-pro",
    "maxTokens": {
      "gemini-2.5-pro": 131072,
      "gemini-2.5-flash": 131072
    }
  }
}
```

## 🎛️ Unified Control System

RCC includes unified startup scripts for different environments:

### Development Environment
```bash
# Start development server (port 3456)
./start-unified.sh -e development --debug

# With autostart capability
./start-unified.sh -e development --autostart
```

### Production Environment
```bash
# Start production server (port 8888)
./start-unified.sh -e release

# Stop services
./start-unified.sh --stop

# Check status
./start-unified.sh --status
```

### Script Options
```bash
./start-unified.sh [OPTIONS]

Options:
  -e, --env ENV          Environment: development, release
  -p, --port PORT        Custom port number
  -h, --host HOST        Custom host address
  -c, --config PATH      Custom config file path
  -d, --debug            Enable debug mode
  -a, --autostart        Setup automatic startup
  --stop                 Stop all RCC services
  --status               Show service status
  --restart              Restart services
  --help                 Show help message
```

## 🔧 CLI Reference

### Core Commands

#### `rcc start`
Start the router server with advanced options.

**Options:**
- `-c, --config <path>`: Configuration file path
- `-p, --port <number>`: Server port
- `-h, --host <string>`: Server host
- `-d, --debug`: Enable debug mode
- `--log-level <level>`: Log level (error, warn, info, debug)
- `--autostart`: Enable automatic startup on system boot

#### `rcc status`
Check comprehensive router status including provider health and performance.

#### `rcc stop`
Stop the router server with graceful shutdown.

**Options:**
- `-f, --force`: Force stop using kill signal
- `-p, --port <number>`: Server port to stop

### Advanced Commands

#### `rcc health`
Perform deep health check of all providers and routing configuration.

#### `rcc config`
Configuration management with validation.

**Options:**
- `--show`: Display current configuration
- `--edit`: Open configuration in default editor
- `--validate`: Validate configuration syntax
- `--migrate`: Migrate from older configuration formats

## 🎯 Routing Intelligence

### Category Determination Logic

RCC automatically determines the routing category based on request characteristics:

- **`default`**: General requests, most common usage
- **`background`**: Haiku models (`claude-3-5-haiku-*`) for background tasks
- **`thinking`**: Requests with `thinking: true` parameter for complex reasoning
- **`longcontext`**: Content over 60K tokens for extensive context processing
- **`search`**: Requests containing tool definitions for search operations

### Model Mapping Examples

```
Input: claude-3-5-haiku-20241022
→ Category: background
→ Provider: shuaihong-openai
→ Target Model: gemini-2.5-flash

Input: claude-sonnet-4-20250514 + thinking=true
→ Category: thinking  
→ Provider: codewhisperer-primary
→ Target Model: CLAUDE_SONNET_4_20250514_V1_0

Input: claude-3-5-sonnet-20241022 + 70K tokens
→ Category: longcontext
→ Provider: shuaihong-openai
→ Target Model: gemini-2.5-pro

Input: claude-sonnet-4-20250514 + tools
→ Category: search
→ Provider: shuaihong-openai  
→ Target Model: gemini-2.5-flash
```

## 📈 Performance Monitoring

### Metrics Available
- **Request Metrics**: Total requests, success rate, average response time
- **Provider Metrics**: Health status, concurrent connections, error rates
- **Model Metrics**: Usage distribution, performance per model
- **Load Balancing Metrics**: Weight effectiveness, distribution analysis
- **Failure Metrics**: Error categorization, trend analysis, recovery recommendations

### Log Analysis
RCC provides comprehensive logging with structured data:

```bash
# View real-time logs
tail -f ~/.route-claude-code/logs/router.log

# Analyze performance logs
grep "Performance" ~/.route-claude-code/logs/*.log

# Check error patterns  
grep "ERROR" ~/.route-claude-code/logs/*.log | head -20
```

## 🚨 Troubleshooting

### Common Issues

#### Configuration Validation
```bash
# Validate configuration
rcc config --validate

# Check provider health
rcc health

# Test specific provider
curl -X POST http://localhost:3456/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-sonnet-4-20250514", "messages": [{"role": "user", "content": "test"}], "max_tokens": 100}'
```

#### Performance Issues
```bash
# Check concurrent load
curl http://localhost:3456/api/stats | jq '.concurrency'

# Monitor provider utilization
watch -n 1 'curl -s http://localhost:3456/api/stats | jq ".providers"'

# Analyze failure patterns
curl http://localhost:3456/api/stats | jq '.failures'
```

#### Debug Mode Analysis
```bash
# Start with comprehensive debugging
rcc start --debug --log-level debug

# Follow debug logs
tail -f ~/.route-claude-code/logs/debug.log

# Check request/response tracing
grep "REQUEST\|RESPONSE" ~/.route-claude-code/logs/debug.log
```

## 🧪 Testing

### Comprehensive Test Suite

RCC includes a complete testing framework:

```bash
# Run basic functionality tests
node test-router-with-modelscope.js

# Test load balancing
node test-load-balancing.js

# Test concurrent access
node test-concurrency-load-balancing.js

# Test specific providers
node test-modelscope-openai.js
node test-shuaihong-provider.js
```

### Manual Testing Procedures

```bash
# 1. Start router with monitoring
rcc start --debug

# 2. Configure environment
export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"
export ANTHROPIC_API_KEY="rcc-router-key"

# 3. Test different request types
claude "Simple test request"                    # → default category
claude "This is a very long request..." # → longcontext category

# 4. Monitor dashboard
open http://localhost:3456/stats

# 5. Check logs and metrics
rcc status
curl http://localhost:3456/api/stats
```

## 🔄 Version 2.1.0 Changelog

### Major New Features
- ✅ **Advanced Load Balancing**: Multi-provider routing with weighted, round-robin, and health-based strategies
- ✅ **Concurrent Request Management**: Provider-level concurrency control with intelligent queuing
- ✅ **Real-time Monitoring Dashboard**: Beautiful web interface with comprehensive analytics
- ✅ **Auto-Start System Service**: macOS launchd and Linux systemd integration
- ✅ **Unified Control Scripts**: Single-command deployment for multiple environments
- ✅ **Zero Hardcoding Architecture**: Complete elimination of hardcoded model names and endpoints
- ✅ **Enhanced Provider Support**: Added ModelScope and other OpenAI-compatible providers
- ✅ **Buffered Tool Call Processing**: 100% accurate tool call handling with complete response buffering

### Architecture Improvements
- **Category-Based Routing**: Intelligent request classification and routing
- **Provider Health Monitoring**: Continuous health checks with automatic failover
- **Session Management**: Persistent session handling across provider instances
- **Advanced Configuration**: Hierarchical configuration with validation and migration support
- **Performance Analytics**: Detailed metrics collection and trend analysis

### Bug Fixes
- Fixed tool call parsing issues with streaming responses
- Resolved hardcoded model name problems in routing engine
- Corrected response format inconsistencies across providers
- Enhanced error handling and recovery mechanisms
- Improved memory management for concurrent requests

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- AWS CodeWhisperer team for the excellent enterprise API
- OpenAI for the standardized API format
- Anthropic for Claude and Claude Code  
- ModelScope for the powerful Chinese AI models
- All contributors and users who helped test and improve RCC

## 📞 Support

- 📖 **Documentation**: [GitHub Repository](https://github.com/fanzhang16/claude-code-router)
- 🐛 **Issues**: [GitHub Issues](https://github.com/fanzhang16/claude-code-router/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/fanzhang16/claude-code-router/discussions)
- 📊 **Monitoring**: Access real-time dashboard at `http://localhost:3456/stats`

---

**Made with ❤️ for the Claude Code community**

*RCC v2.1.0 - Enterprise-grade routing with intelligent load balancing and comprehensive monitoring*