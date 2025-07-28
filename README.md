# Route Claude Code

🚀 **A high-performance, multi-provider routing system for Claude Code that supports seamless switching between AWS CodeWhisperer, OpenAI-compatible APIs, and other providers.**

[![npm version](https://badge.fury.io/js/route-claudecode.svg)](https://badge.fury.io/js/route-claudecode)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🔄 **Multi-Provider Support**: AWS CodeWhisperer, Anthropic Direct, Google Gemini, OpenAI-compatible APIs
- 🎯 **Smart Routing**: Route different types of requests to optimal providers
- 🛠️ **Perfect Tool Call Support**: Advanced tool call parsing and buffered processing
- 🔧 **Format Transformation**: Seamless conversion between API formats
- 📊 **Load Balancing**: Multiple provider instances with automatic load balancing
- 🔍 **Comprehensive Logging**: Full debugging and monitoring capabilities
- ⚡ **High Performance**: Optimized for speed and reliability
- 🔐 **Secure Authentication**: Multiple authentication methods supported
- 🌍 **Four Platform Types**: CodeWhisperer, Anthropic, Gemini, and OpenAI-compatible providers

## 📋 Prerequisites

Before installing Route Claude Code, ensure you have:

- **Node.js 18+** (required by Claude Code CLI)
- **Operating System**: macOS 10.15+, Ubuntu 20.04+/Debian 10+, or Windows 10+ (with WSL or Git for Windows)
- **Hardware**: 4GB+ RAM
- **Claude Code CLI** installed
- **Provider credentials** (AWS CodeWhisperer or OpenAI-compatible API keys)

## 🚀 Installation Guide

### Step 1: Install Claude Code CLI

Install the official Claude Code CLI using npm:

```bash
# Standard installation (all platforms)
npm install -g @anthropic-ai/claude-code
```

**Important Notes:**
- **Do NOT use** `sudo npm install -g` on macOS/Linux
- **Windows users**: Use WSL or Git Bash for best experience
- After installation, run `claude doctor` to verify your installation

**Platform-specific setup:**

**Windows:**
```cmd
# Option 1: Use WSL (recommended)
wsl
npm install -g @anthropic-ai/claude-code

# Option 2: Use Git Bash
# Install Git for Windows, then use Git Bash terminal
npm install -g @anthropic-ai/claude-code
```

**macOS/Linux:**
```bash
# Direct installation
npm install -g @anthropic-ai/claude-code

# Verify installation
claude doctor
```

### Step 2: Install Route Claude Code

#### Option A: NPM Installation (Recommended)
```bash
npm install -g route-claudecode
```

#### Option B: Manual Installation from Source
```bash
# Clone the repository
git clone https://github.com/Jasonzhangf/route-claudecode.git
cd route-claudecode

# Install dependencies
npm install

# Build the project
npm run build

# Install globally
npm link
```

### Step 3: Create Configuration File

Create a configuration directory and file:

**macOS/Linux:**
```bash
# Create configuration directory
mkdir -p ~/.claude-code-router

# Copy sample configuration
cp config.sample.json ~/.claude-code-router/config.json

# Edit the configuration file
nano ~/.claude-code-router/config.json
```

**Windows (PowerShell):**
```powershell
# Create configuration directory
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude-code-router"

# Copy sample configuration
Copy-Item config.sample.json "$env:USERPROFILE\.claude-code-router\config.json"

# Edit the configuration file
notepad "$env:USERPROFILE\.claude-code-router\config.json"
```

**Windows (Command Prompt):**
```cmd
# Create configuration directory
mkdir "%USERPROFILE%\.claude-code-router"

# Copy sample configuration
copy config.sample.json "%USERPROFILE%\.claude-code-router\config.json"

# Edit the configuration file
notepad "%USERPROFILE%\.claude-code-router\config.json"
```

### Step 4: Configure Your Providers

Edit `~/.claude-code-router/config.json` with your provider settings. See [Configuration](#-configuration) section below for details.

### Step 5: Start the Router

```bash
# Start with default settings
rcc start

# Or start with debug mode
rcc start --debug

# Or use the integrated command
rcc code
```

### Step 6: Configure Claude Code to Use Router

Set environment variables to redirect Claude Code requests:

**macOS/Linux (Bash/Zsh):**
```bash
# Temporary (current session only)
export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"
export ANTHROPIC_API_KEY="any-string-is-ok"

# Permanent (add to ~/.bashrc, ~/.zshrc, etc.)
echo 'export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"' >> ~/.bashrc
echo 'export ANTHROPIC_API_KEY="any-string-is-ok"' >> ~/.bashrc
source ~/.bashrc
```

**Windows (PowerShell):**
```powershell
# Temporary (current session only)
$env:ANTHROPIC_BASE_URL="http://127.0.0.1:3456"
$env:ANTHROPIC_API_KEY="any-string-is-ok"

# Permanent (PowerShell profile)
Add-Content $PROFILE '`$env:ANTHROPIC_BASE_URL="http://127.0.0.1:3456"'
Add-Content $PROFILE '`$env:ANTHROPIC_API_KEY="any-string-is-ok"'

# Or use system environment variables (requires restart)
[Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", "http://127.0.0.1:3456", "User")
[Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "any-string-is-ok", "User")
```

**Windows (Command Prompt):**
```cmd
# Temporary (current session only)
set ANTHROPIC_BASE_URL=http://127.0.0.1:3456
set ANTHROPIC_API_KEY=any-string-is-ok

# Permanent (system environment variables)
setx ANTHROPIC_BASE_URL "http://127.0.0.1:3456"
setx ANTHROPIC_API_KEY "any-string-is-ok"

# Note: Restart your terminal after using setx
```

### Step 7: Test the Setup

```bash
# Test the router status
rcc status

# Test with Claude Code
claude "Hello, test the routing system"

# Check logs
rcc config --show
```

## 📋 Configuration

### Configuration File Structure

The router uses a JSON configuration file located at `~/.claude-code-router/config.json`. Here's the complete structure:

```json
{
  "server": {
    "port": 3456,
    "host": "127.0.0.1"
  },
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
      "models": [
        "CLAUDE_SONNET_4_20250514_V1_0",
        "CLAUDE_3_7_SONNET_20250219_V1_0"
      ],
      "defaultModel": "CLAUDE_SONNET_4_20250514_V1_0",
      "maxTokens": {
        "CLAUDE_SONNET_4_20250514_V1_0": 131072,
        "CLAUDE_3_7_SONNET_20250219_V1_0": 131072
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
      "models": ["gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet"],
      "defaultModel": "gpt-4o",
      "maxTokens": {
        "gpt-4o": 128000,
        "gpt-4o-mini": 128000,
        "claude-3-5-sonnet": 200000
      }
    }
  },
  "routing": {
    "default": {
      "provider": "codewhisperer-primary",
      "model": "CLAUDE_SONNET_4_20250514_V1_0"
    },
    "background": {
      "provider": "codewhisperer-primary",
      "model": "CLAUDE_SONNET_4_20250514_V1_0"
    },
    "thinking": {
      "provider": "openai-compatible",
      "model": "gpt-4o"
    },
    "longcontext": {
      "provider": "openai-compatible",
      "model": "claude-3-5-sonnet"
    },
    "search": {
      "provider": "openai-compatible",
      "model": "gpt-4o-mini"
    }
  },
  "debug": {
    "enabled": false,
    "logLevel": "info",
    "traceRequests": false,
    "saveRequests": false,
    "logDir": "~/.claude-code-router/logs"
  },
  "hooks": []
}
```

### Provider Configuration Options

#### AWS CodeWhisperer Provider
```json
{
  "type": "codewhisperer",
  "endpoint": "https://codewhisperer.us-east-1.amazonaws.com",
  "authentication": {
    "type": "bearer",
    "credentials": {
      "tokenPath": "~/.aws/sso/cache/your-token-file.json"
    }
  },
  "models": [
    "CLAUDE_SONNET_4_20250514_V1_0",
    "CLAUDE_3_7_SONNET_20250219_V1_0"
  ]
}
```

**Setup AWS CodeWhisperer:**
1. Install AWS CLI: `curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg" && sudo installer -pkg AWSCLIV2.pkg -target /`
2. Configure SSO: `aws configure sso`
3. Find your token file in `~/.aws/sso/cache/`

#### OpenAI-Compatible Provider
```json
{
  "type": "openai",
  "endpoint": "https://api.openai.com/v1/chat/completions",
  "authentication": {
    "type": "bearer",
    "credentials": {
      "apiKey": "sk-your-api-key-here"
    }
  },
  "models": ["gpt-4o", "gpt-4o-mini"]
}
```

#### Anthropic Direct Provider
```json
{
  "type": "anthropic",
  "endpoint": "https://api.anthropic.com",
  "authentication": {
    "type": "bearer",
    "credentials": {
      "apiKey": "sk-ant-your-anthropic-api-key-here"
    }
  },
  "models": [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022", 
    "claude-3-opus-20240229"
  ]
}
```

**Setup Anthropic Direct:**
1. Sign up for Anthropic API: https://console.anthropic.com/
2. Generate an API key from your console
3. Add the key to your configuration

#### Google Gemini Provider
```json
{
  "type": "gemini",
  "endpoint": "https://generativelanguage.googleapis.com",
  "authentication": {
    "type": "bearer",  
    "credentials": {
      "apiKey": "your-gemini-api-key-here"
    }
  },
  "models": [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash"
  ]
}
```

**Setup Google Gemini:**
1. Visit Google AI Studio: https://makersuite.google.com/app/apikey
2. Create a new API key for your project
3. Add the key to your configuration

### Routing Categories

The router supports five routing categories:

- **`default`**: General requests, most common usage
- **`background`**: Background tasks, lower priority
- **`thinking`**: Complex reasoning tasks
- **`longcontext`**: Large documents, extensive context
- **`search`**: Tool-heavy requests, search operations

## 🎯 Usage Examples

### Basic Commands

```bash
# Start the router
rcc start

# Start with debug mode
rcc start --debug

# Check router status
rcc status

# Check provider health
rcc health

# Stop the router
rcc stop

# View configuration
rcc config --show

# Edit configuration
rcc config --edit
```

### Integrated Usage

```bash
# Start router and launch Claude Code automatically
rcc code

# Pass arguments to Claude Code
rcc code --help
rcc code "Write a Python function to sort a list"
```

### Advanced Usage

```bash
# Start on custom port
rcc start --port 8080

# Start with specific host
rcc start --host 0.0.0.0 --port 3456

# Enable debug with custom log level
rcc start --debug --log-level debug

# Stop router forcefully
rcc stop --force
```

### Environment Configuration

**macOS/Linux:**
```bash
# Set environment variables for permanent usage
export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"
export ANTHROPIC_API_KEY="any-string-is-ok"

# Test with Claude Code
claude "Hello from the router!"
```

**Windows (PowerShell):**
```powershell
# Set environment variables
$env:ANTHROPIC_BASE_URL="http://127.0.0.1:3456"
$env:ANTHROPIC_API_KEY="any-string-is-ok"

# Test with Claude Code
claude "Hello from the router!"
```

**Windows (Command Prompt):**
```cmd
# Set environment variables
set ANTHROPIC_BASE_URL=http://127.0.0.1:3456
set ANTHROPIC_API_KEY=any-string-is-ok

# Test with Claude Code
claude "Hello from the router!"
```

**How it works:**
The router will automatically:
1. Receive the request from Claude Code
2. Determine the appropriate routing category
3. Route to the configured provider
4. Transform the response back to Anthropic format
5. Return the response to Claude Code

### Configuration Examples

#### Example 1: CodeWhisperer Only
```json
{
  "providers": {
    "codewhisperer-primary": {
      "type": "codewhisperer",
      "endpoint": "https://codewhisperer.us-east-1.amazonaws.com",
      "authentication": {
        "type": "bearer",
        "credentials": {
          "tokenPath": "~/.aws/sso/cache/your-token.json"
        }
      }
    }
  },
  "routing": {
    "default": {"provider": "codewhisperer-primary", "model": "CLAUDE_SONNET_4_20250514_V1_0"},
    "background": {"provider": "codewhisperer-primary", "model": "CLAUDE_SONNET_4_20250514_V1_0"},
    "thinking": {"provider": "codewhisperer-primary", "model": "CLAUDE_SONNET_4_20250514_V1_0"},
    "longcontext": {"provider": "codewhisperer-primary", "model": "CLAUDE_SONNET_4_20250514_V1_0"},
    "search": {"provider": "codewhisperer-primary", "model": "CLAUDE_SONNET_4_20250514_V1_0"}
  }
}
```

#### Example 2: Mixed Providers (All Platform Types)
```json
{
  "providers": {
    "codewhisperer": {
      "type": "codewhisperer",
      "endpoint": "https://codewhisperer.us-east-1.amazonaws.com",
      "authentication": {"type": "bearer", "credentials": {"tokenPath": "~/.aws/sso/cache/token.json"}}
    },
    "anthropic": {
      "type": "anthropic",
      "endpoint": "https://api.anthropic.com",
      "authentication": {"type": "bearer", "credentials": {"apiKey": "sk-ant-your-key"}}
    },
    "openai": {
      "type": "openai",  
      "endpoint": "https://api.openai.com/v1/chat/completions",
      "authentication": {"type": "bearer", "credentials": {"apiKey": "sk-your-key"}}
    },
    "gemini": {
      "type": "gemini",
      "endpoint": "https://generativelanguage.googleapis.com",
      "authentication": {"type": "bearer", "credentials": {"apiKey": "your-gemini-key"}}
    }
  },
  "routing": {
    "default": {"provider": "codewhisperer", "model": "CLAUDE_SONNET_4_20250514_V1_0"},
    "background": {"provider": "gemini", "model": "gemini-2.5-flash"}, 
    "thinking": {"provider": "anthropic", "model": "claude-3-5-sonnet-20241022"},
    "longcontext": {"provider": "gemini", "model": "gemini-2.5-pro"},
    "search": {"provider": "openai", "model": "gpt-4o-mini"}
  }
}
```

## 🔧 CLI Reference

### `rcc start`
Start the router server.

**Options:**
- `-c, --config <path>`: Configuration file path (default: `~/.claude-code-router/config.json`)
- `-p, --port <number>`: Server port
- `-h, --host <string>`: Server host
- `-d, --debug`: Enable debug mode
- `--log-level <level>`: Log level (error, warn, info, debug)

### `rcc stop`
Stop the router server.

**Options:**
- `-p, --port <number>`: Server port to stop
- `-h, --host <string>`: Server host
- `-c, --config <path>`: Configuration file path
- `-f, --force`: Force stop using kill signal

### `rcc status`
Check router status.

**Options:**
- `-p, --port <number>`: Server port
- `-h, --host <string>`: Server host

### `rcc health`
Check router and provider health.

**Options:**
- `-p, --port <number>`: Server port
- `-h, --host <string>`: Server host

### `rcc code`
Start router and launch Claude Code with routing.

**Options:**
- All options from `rcc start`
- `[...args]`: Arguments to pass to Claude Code

### `rcc config`
Show or edit configuration.

**Options:**
- `-c, --config <path>`: Configuration file path
- `--show`: Show current configuration
- `--edit`: Open configuration in default editor

## 🚨 Troubleshooting

### Common Issues

#### Router Won't Start

**macOS/Linux:**
```bash
# Check if something is using the port
lsof -i :3456

# Kill existing processes
rcc stop --force

# Start with debug mode
rcc start --debug
```

**Windows:**
```cmd
# Check if something is using the port
netstat -ano | findstr :3456

# Kill existing processes
rcc stop --force

# Start with debug mode
rcc start --debug
```

#### Claude Code Not Using Router

**macOS/Linux:**
```bash
# Verify environment variables
echo $ANTHROPIC_BASE_URL
echo $ANTHROPIC_API_KEY

# Test router connectivity
curl http://127.0.0.1:3456/status
```

**Windows (PowerShell):**
```powershell
# Verify environment variables
echo $env:ANTHROPIC_BASE_URL
echo $env:ANTHROPIC_API_KEY

# Test router connectivity
Invoke-WebRequest http://127.0.0.1:3456/status
```

**Windows (Command Prompt):**
```cmd
# Verify environment variables
echo %ANTHROPIC_BASE_URL%
echo %ANTHROPIC_API_KEY%

# Test router connectivity
curl http://127.0.0.1:3456/status
```

#### Provider Authentication Issues

**CodeWhisperer (all platforms):**
```bash
# Check AWS SSO
aws sso login

# Check token file exists (macOS/Linux)
ls ~/.aws/sso/cache/

# Check token file exists (Windows)
dir "%USERPROFILE%\.aws\sso\cache\"
```

**OpenAI Provider:**
```bash
# Verify API key (macOS/Linux)
curl -H "Authorization: Bearer YOUR_KEY" https://api.openai.com/v1/models

# Verify API key (Windows PowerShell)
Invoke-WebRequest -Headers @{"Authorization"="Bearer YOUR_KEY"} https://api.openai.com/v1/models
```

### Debug Mode

Enable debug mode for detailed logging:

```bash
rcc start --debug --log-level debug
```

This will create detailed logs in `~/.claude-code-router/logs/`

## 🧪 Testing

After installation, test the router:

```bash
# 1. Start the router
rcc start --debug

# 2. In another terminal, set environment variables
export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"
export ANTHROPIC_API_KEY="any-string-is-ok"

# 3. Test with Claude Code
claude "Hello, test routing!"

# 4. Check logs and status
rcc status
tail -f ~/.claude-code-router/logs/*.log
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- AWS CodeWhisperer team for the excellent API
- OpenAI for the standardized API format  
- Anthropic for Claude and Claude Code
- All contributors and users of this project

## 📞 Support

- 📖 **Documentation**: [GitHub Repository](https://github.com/Jasonzhangf/route-claudecode)
- 🐛 **Issues**: [GitHub Issues](https://github.com/Jasonzhangf/route-claudecode/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/Jasonzhangf/route-claudecode/discussions)

---

**Made with ❤️ for the Claude Code community**
