# Claude Code Router

🚀 **A high-performance, multi-provider routing system for Claude Code that supports seamless switching between AWS CodeWhisperer, OpenAI-compatible APIs, and other providers.**

[![npm version](https://badge.fury.io/js/claude-code-router.svg)](https://badge.fury.io/js/claude-code-router)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🔄 **Multi-Provider Support**: AWS CodeWhisperer, OpenAI-compatible APIs, and more
- 🎯 **Smart Routing**: Route different types of requests to optimal providers
- 🛠️ **Perfect Tool Call Support**: Advanced tool call parsing and buffered processing
- 🔧 **Format Transformation**: Seamless conversion between API formats
- 📊 **Load Balancing**: Multiple provider instances with automatic load balancing
- 🔍 **Comprehensive Logging**: Full debugging and monitoring capabilities
- ⚡ **High Performance**: Optimized for speed and reliability
- 🔐 **Secure Authentication**: Multiple authentication methods supported

## 🚀 Quick Start

### Installation

#### Option 1: NPM Installation (Recommended)
```bash
npm install -g claude-code-router
```

#### Option 2: Install Claude Code (includes routing capabilities)
```bash
# Install Claude Code which can work with the router
curl -fsSL https://claude.ai/install.sh | sh
```

#### Option 3: Manual Installation
```bash
git clone https://github.com/your-username/claude-code-router.git
cd claude-code-router
npm install
npm run build
npm link
```

### Basic Usage

1. **Start the Router**:
```bash
claude-code-router start
```

2. **Configure Claude Code to Use Router**:
```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"
export ANTHROPIC_API_KEY="your-router-key"
```

3. **Use Claude Code Normally**:
```bash
claude "Help me write a Python script"
```

## 📋 Configuration

### Creating Configuration File

Create a configuration file at `~/.claude-code-router/config.json`:

```json
{
  "server": {
    "port": 3456,
    "host": "127.0.0.1"
  },
  "routing": {
    "rules": {
      "default": {
        "provider": "codewhisperer-primary",
        "model": "CLAUDE_SONNET_4_20250514_V1_0"
      },
      "background": {
        "provider": "codewhisperer-primary", 
        "model": "CLAUDE_3_5_HAIKU_20241022_V1_0"
      },
      "thinking": {
        "provider": "codewhisperer-primary",
        "model": "CLAUDE_SONNET_4_20250514_V1_0"
      },
      "longcontext": {
        "provider": "codewhisperer-primary",
        "model": "CLAUDE_SONNET_4_20250514_V1_0"
      },
      "search": {
        "provider": "openai-compatible",
        "model": "gemini-2.5-flash"
      }
    },
    "defaultProvider": "codewhisperer-primary",
    "providers": {
      "codewhisperer-primary": {
        "type": "codewhisperer",
        "endpoint": "https://codewhisperer.us-east-1.amazonaws.com",
        "authentication": {
          "type": "bearer",
          "credentials": {
            "tokenPath": "~/.aws/sso/cache/your-auth-token.json"
          }
        },
        "settings": {
          "profileArn": "arn:aws:codewhisperer:us-east-1:ACCOUNT:profile/PROFILE_ID",
          "categoryMappings": {
            "default": true,
            "background": true,
            "thinking": true,
            "longcontext": true,
            "search": true
          },
          "models": [
            "CLAUDE_SONNET_4_20250514_V1_0",
            "CLAUDE_3_5_HAIKU_20241022_V1_0",
            "CLAUDE_3_7_SONNET_20250219_V1_0"
          ],
          "defaultModel": "CLAUDE_SONNET_4_20250514_V1_0"
        }
      },
      "openai-compatible": {
        "type": "openai",
        "endpoint": "https://api.openai.com/v1/chat/completions",
        "authentication": {
          "type": "bearer",
          "credentials": {
            "apiKey": "sk-your-openai-api-key-here"
          }
        },
        "settings": {
          "categoryMappings": {
            "default": false,
            "background": false,
            "thinking": false,
            "longcontext": false,
            "search": true
          },
          "models": ["gpt-4", "gpt-3.5-turbo"],
          "defaultModel": "gpt-4"
        }
      },
      "gemini-provider": {
        "type": "openai",
        "endpoint": "https://generativelanguage.googleapis.com/v1beta/chat/completions",
        "authentication": {
          "type": "bearer",
          "credentials": {
            "apiKey": "your-gemini-api-key"
          }
        },
        "settings": {
          "categoryMappings": {
            "search": true
          },
          "models": ["gemini-2.5-flash", "gemini-pro"],
          "defaultModel": "gemini-2.5-flash"
        }
      }
    }
  },
  "debug": {
    "enabled": true,
    "logLevel": "info",
    "traceRequests": true,
    "saveRequests": true,
    "logDir": "~/.claude-code-router/logs"
  }
}
```

## 🔧 Supported Formats and Providers

### Provider Types

#### 1. AWS CodeWhisperer
- **Type**: `codewhisperer`
- **Authentication**: Bearer token via AWS SSO
- **Features**: Native Claude 4 support, tool calls, 128K context
- **Models**: 
  - `CLAUDE_SONNET_4_20250514_V1_0`
  - `CLAUDE_3_5_HAIKU_20241022_V1_0`
  - `CLAUDE_3_7_SONNET_20250219_V1_0`

#### 2. OpenAI-Compatible APIs
- **Type**: `openai`
- **Authentication**: Bearer token (API Key)
- **Features**: Universal compatibility with OpenAI-format APIs
- **Providers**:
  - OpenAI (GPT-4, GPT-3.5-turbo)
  - Google Gemini (via OpenAI-compatible endpoint)
  - Third-party providers (Anthropic, etc.)

### Routing Categories

- **`default`**: General conversations and coding tasks
- **`background`**: Background processing, less critical tasks
- **`thinking`**: Complex reasoning and analysis
- **`longcontext`**: Long document processing
- **`search`**: Search and information retrieval

## 🛠️ Advanced Configuration

### Multiple Provider Instances (Load Balancing)

```json
{
  "providers": {
    "codewhisperer-primary": {
      "type": "codewhisperer",
      "instances": [
        {
          "endpoint": "https://codewhisperer.us-east-1.amazonaws.com",
          "authentication": { "tokenPath": "~/.aws/sso/cache/token1.json" }
        },
        {
          "endpoint": "https://codewhisperer.us-west-2.amazonaws.com",  
          "authentication": { "tokenPath": "~/.aws/sso/cache/token2.json" }
        }
      ],
      "loadBalancing": {
        "strategy": "round-robin",
        "healthCheck": true
      }
    }
  }
}
```

### Custom Routing Rules

```json
{
  "routing": {
    "customRules": [
      {
        "condition": {
          "modelContains": "gpt",
          "hasTools": true
        },
        "target": {
          "provider": "openai-compatible",
          "model": "gpt-4"
        }
      },
      {
        "condition": {
          "messageLength": "> 10000"
        },
        "target": {
          "provider": "codewhisperer-primary",
          "model": "CLAUDE_SONNET_4_20250514_V1_0"
        }
      }
    ]
  }
}
```

## 🔍 Tool Call Support

Claude Code Router provides **advanced tool call processing** with:

- ✅ **Perfect Tool Call Parsing**: Handles fragmented tool calls across multiple events
- ✅ **Buffered Processing**: Accumulates complete responses before processing
- ✅ **Format Conversion**: Seamless conversion between provider formats
- ✅ **Error Recovery**: Automatically fixes common tool call issues
- ✅ **Streaming Support**: Real-time tool call processing in streaming mode

### Tool Call Formats Supported

#### Anthropic Format (Input)
```json
{
  "model": "claude-3",
  "messages": [...],
  "tools": [
    {
      "name": "search_web",
      "description": "Search the web for information",
      "input_schema": {
        "type": "object",
        "properties": {
          "query": {"type": "string"}
        }
      }
    }
  ]
}
```

#### OpenAI Format (Provider)
```json
{
  "model": "gpt-4",
  "messages": [...],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "search_web",
        "description": "Search the web for information",
        "parameters": {
          "type": "object",
          "properties": {
            "query": {"type": "string"}
          }
        }
      }
    }
  ]
}
```

## 📊 Monitoring and Debugging

### Built-in Status Endpoint

```bash
curl http://127.0.0.1:3456/status
```

### Health Check

```bash
curl http://127.0.0.1:3456/health
```

### Debug Mode

Enable comprehensive logging:

```json
{
  "debug": {
    "enabled": true,
    "logLevel": "debug",
    "traceRequests": true,
    "saveRequests": true,
    "logDir": "~/.claude-code-router/logs"
  }
}
```

### Log Analysis

```bash
# View live logs
tail -f ~/.claude-code-router/logs/ccr-$(date +%Y-%m-%d).log

# Search for tool call issues
grep "tool_use" ~/.claude-code-router/logs/ccr-*.log

# Monitor response fixes
grep "Applied response fixes" ~/.claude-code-router/logs/ccr-*.log
```

## 🚀 CLI Commands

```bash
# Start the router
claude-code-router start

# Start with custom config
claude-code-router start --config /path/to/config.json

# Start on custom port
claude-code-router start --port 3457

# Check status
claude-code-router status

# Stop the router
claude-code-router stop

# View logs
claude-code-router logs

# Test configuration
claude-code-router test-config
```

## 🔧 Environment Variables

```bash
# Router Configuration
export CCR_CONFIG_PATH="~/.claude-code-router/config.json"
export CCR_PORT="3456"
export CCR_LOG_LEVEL="info"

# Claude Code Integration
export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"
export ANTHROPIC_API_KEY="your-router-key"

# AWS CodeWhisperer
export AWS_PROFILE="your-aws-profile"
export AWS_REGION="us-east-1"
```

## 🔐 Authentication Methods

### AWS CodeWhisperer Authentication

1. **AWS SSO Token** (Recommended):
```json
{
  "authentication": {
    "type": "bearer",
    "credentials": {
      "tokenPath": "~/.aws/sso/cache/your-token.json"
    }
  }
}
```

2. **Direct Token**:
```json
{
  "authentication": {
    "type": "bearer",
    "credentials": {
      "token": "your-bearer-token"
    }
  }
}
```

### OpenAI-Compatible Authentication

```json
{
  "authentication": {
    "type": "bearer",
    "credentials": {
      "apiKey": "sk-your-api-key"
    }
  }
}
```

## 📈 Performance Optimization

### Buffered Processing

Claude Code Router uses advanced buffered processing for optimal performance:

- **Complete Response Assembly**: Waits for full responses before processing
- **Intelligent Parsing**: Advanced algorithms for tool call extraction
- **Error Recovery**: Automatic fixing of common parsing issues
- **Memory Efficient**: Optimized memory usage for large responses

### Connection Pooling

```json
{
  "providers": {
    "provider-name": {
      "settings": {
        "connectionPool": {
          "maxConnections": 10,
          "keepAlive": true,
          "timeout": 30000
        }
      }
    }
  }
}
```

## 🛡️ Security Features

- 🔐 **Token Encryption**: Secure token storage and transmission
- 🚫 **Request Filtering**: Block malicious requests
- 📝 **Audit Logging**: Complete request/response logging
- 🔒 **Access Control**: IP-based access restrictions
- 🛡️ **Rate Limiting**: Prevent abuse and ensure fair usage

## 🚨 Troubleshooting

### Common Issues

#### 1. Tool Calls Not Working
```bash
# Check tool call parsing
grep "tool_use" ~/.claude-code-router/logs/ccr-*.log

# Verify response fixing
grep "Applied response fixes" ~/.claude-code-router/logs/ccr-*.log
```

#### 2. Provider Connection Issues
```bash
# Test provider health
curl http://127.0.0.1:3456/health

# Check authentication
grep "Authentication" ~/.claude-code-router/logs/ccr-*.log
```

#### 3. High Memory Usage
```bash
# Monitor memory usage
ps aux | grep claude-code-router

# Check log file sizes
du -sh ~/.claude-code-router/logs/
```

### Debug Mode

Enable comprehensive debugging:

```bash
claude-code-router start --debug --log-level debug
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/your-username/claude-code-router.git
cd claude-code-router
npm install
npm run dev
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test category
npm run test:integration
npm run test:functional
npm run test:performance
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- AWS CodeWhisperer team for the excellent API
- OpenAI for the standardized API format
- Anthropic for Claude and Claude Code
- All contributors and users of this project

## 📞 Support

- 📖 **Documentation**: [Full Documentation](https://github.com/your-username/claude-code-router/wiki)
- 🐛 **Issues**: [GitHub Issues](https://github.com/your-username/claude-code-router/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/your-username/claude-code-router/discussions)
- 📧 **Email**: support@claude-code-router.com

---

**Made with ❤️ for the Claude Code community**