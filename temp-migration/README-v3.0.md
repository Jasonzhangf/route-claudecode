# Claude Code Router v3.0

🚀 **Six-Layer Architecture with Official SDK Integration**

[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](https://github.com/fanzhang16/claude-code-router)
[![Architecture](https://img.shields.io/badge/architecture-six--layer-green.svg)](#architecture)
[![SDK Integration](https://img.shields.io/badge/SDK-official--priority-orange.svg)](#sdk-integration)

## 🔄 Version Coexistence

Claude Code Router v3.0 is designed to **coexist peacefully** with v2.7.0:

| Version | Command | Architecture | Use Case |
|---------|---------|--------------|----------|
| **v2.7.0** | `rcc` | Four-layer | Production, stable workloads |
| **v3.0** | `rcc3` | Six-layer | Development, SDK integration |

## 🏗️ Architecture

### Six-Layer Architecture
```
Client Layer → Router Layer → Post-processor Layer → Transformer Layer → Provider-Protocol Layer → Preprocessor Layer → Server Layer
```

### Key Enhancements
- ✅ **Official SDK Priority Integration** - LMStudio, Ollama, OpenAI, Gemini, CodeWhisperer
- ✅ **Dynamic SDK Detection** - Runtime capability discovery
- ✅ **Enhanced Preprocessing System** - Provider-specific transformations
- ✅ **Zero-Hardcoding Compliance** - Configuration-driven architecture
- ✅ **Zero-Fallback Architecture** - Explicit error handling
- ✅ **Provider-Protocol Governance** - Standardized integration workflow
- ✅ **Comprehensive Debug Recording** - Full I/O traceability
- ✅ **Patch System Integration** - Non-invasive compatibility fixes

## 🚀 Quick Start

### Installation

```bash
# Clone and install v3.0
git clone https://github.com/fanzhang16/claude-code-router.git
cd claude-code-router
./scripts/install-v3.sh
```

### First Run

```bash
# 1. List available v3.0 configurations
rcc3 config list-v3

# 2. Start LM Studio v3.0 service
rcc3 start ~/.route-claudecode/config/v3/single-provider/config-lmstudio-v3-5506.json --debug

# 3. Connect Claude Code client (in another terminal)
rcc3 code --port 5506

# 4. Check SDK availability
rcc3 sdk detect
```

## 📁 Configuration Files

### v3.0 Configuration Structure
```
~/.route-claudecode/config/v3/
├── config-index.json                      # Central configuration index
├── single-provider/                       # Single provider configs
│   ├── config-lmstudio-v3-5506.json      # LM Studio enhanced
│   ├── config-openai-shuaihong-v3-5508.json # ShuaiHong multi-model
│   ├── config-codewhisperer-primary-v3-5501.json # CodeWhisperer production
│   └── config-google-gemini-v3-5502.json # Gemini multimodal
└── load-balancing/                        # Multi-provider configs
    └── config-multi-provider-v3-3456.json # Intelligent load balancing
```

### Configuration Features
- **SDK Integration Settings** - Official SDK priority and fallback configuration
- **Enhanced Preprocessing** - Provider-specific request transformations
- **Governance Compliance** - Zero-hardcoding and zero-fallback validation
- **Debug Recording** - Full layer I/O recording and replay capability
- **Patch System** - Non-invasive compatibility patches

## 🔌 SDK Integration

### Supported Official SDKs
- **LMStudio** - `@lmstudio/sdk` with OpenAI-compatible fallback
- **Ollama** - `ollama` with standalone implementation fallback
- **OpenAI** - `openai` official SDK with enhanced preprocessing
- **Google Gemini** - `@google/generative-ai` with multimodal support
- **AWS CodeWhisperer** - AWS SDK with enhanced authentication

### Dynamic SDK Detection
```bash
# Check which official SDKs are available
rcc3 sdk detect

# Test SDK functionality
rcc3 sdk test lmstudio
rcc3 sdk test ollama
```

## 📊 Provider Configurations

### LM Studio v3.0 (Port 5506)
```bash
rcc3 start ~/.route-claudecode/config/v3/single-provider/config-lmstudio-v3-5506.json --debug
```
- **Features**: Official SDK priority, local model optimization, dynamic detection
- **Models**: `gpt-oss-20b-mlx`, `unsloth-gpt-oss-120b`
- **Use Case**: Local development, offline usage, private models

### ShuaiHong OpenAI Compatible v3.0 (Port 5508)
```bash
rcc3 start ~/.route-claudecode/config/v3/single-provider/config-openai-shuaihong-v3-5508.json --debug
```
- **Features**: Multi-model support, tool call patches, key rotation
- **Models**: `claude-4-sonnet`, `gemini-2.5-pro`, `gpt-4o-mini`
- **Use Case**: Multi-model access, cost optimization, backup provider

### Google Gemini v3.0 (Port 5502)
```bash
rcc3 start ~/.route-claudecode/config/v3/single-provider/config-google-gemini-v3-5502.json --debug
```
- **Features**: Multimodal support, thinking models, multi-key balancing
- **Models**: `gemini-2.5-pro`, `gemini-2.0-flash-thinking-exp`
- **Use Case**: Multimodal tasks, long-context processing, thinking workloads

### CodeWhisperer Primary v3.0 (Port 5501)
```bash
rcc3 start ~/.route-claudecode/config/v3/single-provider/config-codewhisperer-primary-v3-5501.json --debug
```
- **Features**: AWS integration, token refresh, code generation
- **Models**: `CLAUDE_SONNET_4_20250514_V1_0`, `CLAUDE_3_7_SONNET`
- **Use Case**: Production usage, enterprise integration, AWS environments

## 🔧 Advanced Usage

### Multi-Provider Load Balancing
```bash
# Start intelligent load balancing across all providers
rcc3 start ~/.route-claudecode/config/v3/load-balancing/config-multi-provider-v3-3456.json --debug

# Connect to load-balanced service
rcc3 code --port 3456
```

### Configuration Management
```bash
# List all v3.0 configurations
rcc3 config list-v3

# Validate configuration file
rcc3 config validate ~/.route-claudecode/config/v3/single-provider/config-lmstudio-v3-5506.json

# Backup current configuration
rcc3 config backup
```

### Debug and Monitoring
```bash
# Check service status
rcc3 status

# Health check
rcc3 health

# View logs
rcc3 logs parse

# Extract provider-specific data
rcc3 tools extract gemini
```

## 🧪 Development and Testing

### SDK Integration Testing
```bash
# Test all provider connections
rcc3 test

# Test specific SDK integration
rcc3 test lmstudio
rcc3 test gemini
```

### Debug Recording
All v3.0 configurations include comprehensive debug recording:
- **I/O Recording**: Full layer input/output capture
- **Replay Capability**: Reproduce issues from recorded data
- **Performance Metrics**: Timing and audit trails
- **Database Storage**: `~/.route-claudecode/database/v3/`

## 🔄 Migration from v2.7.0

### Key Differences
| Aspect | v2.7.0 | v3.0 |
|--------|---------|------|
| **Architecture** | 4 layers | 6 layers |
| **SDK Support** | Basic HTTP clients | Official SDK priority |
| **Preprocessing** | Basic transformations | Enhanced provider-specific preprocessing |
| **Configuration** | Static configs | Dynamic validation and governance |
| **Debug Recording** | Basic logging | Full I/O recording and replay |
| **Compatibility** | Limited patches | Comprehensive patch system |

### Migration Steps
1. Keep existing v2.7.0 installation (`rcc` command)
2. Install v3.0 (`rcc3` command) using `./scripts/install-v3.sh`
3. Migrate configurations to v3.0 format in `~/.route-claudecode/config/v3/`
4. Test v3.0 functionality with `rcc3 test`
5. Gradually migrate workloads from `rcc` to `rcc3`

## 📚 Documentation

- **Architecture Design**: `.claude/ProjectDesign/`
- **Configuration Guide**: `~/.route-claudecode/config/v3/config-index.json`
- **Testing Framework**: `test/functional/`
- **SDK Integration**: `src/v3/provider/sdk-integration/`
- **Governance System**: `src/v3/provider/protocol-governance/`

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Follow v3.0 architecture patterns and zero-hardcoding principles
4. Add comprehensive tests using the existing testing framework
5. Update configuration files and documentation
6. Submit pull request

## 📋 Requirements

### System Requirements
- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **Architecture**: v3.0 compatible components

### Optional SDK Dependencies
- **LM Studio**: Install LM Studio application or `@lmstudio/sdk`
- **Ollama**: Install Ollama CLI or `ollama` package
- **OpenAI**: `openai` package (automatically installed)
- **Google Gemini**: `@google/generative-ai` (automatically installed)
- **AWS CodeWhisperer**: AWS CLI configured with proper credentials

## 🔗 Links

- **GitHub Repository**: https://github.com/fanzhang16/claude-code-router
- **v2.7.0 NPM Package**: https://www.npmjs.com/package/route-claudecode
- **v3.0 NPM Package**: https://www.npmjs.com/package/route-claudecode-v3 (coming soon)

## 📄 License

MIT License - see LICENSE file for details.

---

**🚀 Claude Code Router v3.0** - *Six-layer architecture with official SDK integration*

*Created by Jason Zhang • Version 3.0.0 • 2025*