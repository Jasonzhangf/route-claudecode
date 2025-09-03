# iFlow Configuration for RCC4

This configuration integrates iFlow CLI with the RCC4 (Route Claude Code v4) system, providing a seamless workflow for AI-assisted software engineering tasks with defensive security focus.

## Configuration Overview

```json
{
  "version": "1.0",
  "name": "rcc4-iflow-config",
  "description": "iFlow configuration for RCC4 development",
  "model": "qwen3-coder-plus",
  "features": {
    "sandbox": true,
    "debug": true,
    "telemetry": false,
    "checkpointing": true
  },
  "directories": [
    "./src",
    "./config",
    "./docs",
    "./scripts",
    "./test"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "*.log",
    ".git"
  ],
  "commands": [
    {
      "name": "rcc4-start",
      "description": "Start RCC4 server",
      "command": "npm run start -- --config config/rcc4-config.json"
    },
    {
      "name": "rcc4-test",
      "description": "Run RCC4 tests",
      "command": "npm run test"
    },
    {
      "name": "rcc4-build",
      "description": "Build RCC4 project",
      "command": "npm run build"
    }
  ],
  "agents": [
    {
      "name": "rcc4-developer",
      "description": "RCC4 development assistant",
      "system_prompt": "You are an expert software engineer specializing in the RCC4 (Route Claude Code v4) project. You help with defensive security tasks, code analysis, and development following strict TypeScript and zero-fallback policies.",
      "models": [
        "qwen3-coder-plus",
        "qwen3-coder-flash",
        "qwen-max",
        "qwen-plus",
        "qwen-turbo"
      ],
      "routing": {
        "default": "qwen3-coder-plus",
        "long_context": "qwen-max",
        "fast_response": "qwen-turbo",
        "complex_reasoning": "qwen-plus"
      }
    }
  ],
  "mcp_servers": [
    {
      "name": "rcc4-internal-api",
      "url": "http://localhost:5506",
      "description": "RCC4 internal API server",
      "auth": {
        "type": "none"
      }
    },
    {
      "name": "rcc4-main-server",
      "url": "http://localhost:5507",
      "description": "RCC4 main development server",
      "auth": {
        "type": "bearer",
        "token": "rcc4-proxy-key"
      }
    }
  ]
}
```

## Key Integration Points

1. **Model Configuration**: Uses `qwen3-coder-plus` which aligns with the Qwen provider in RCC4
2. **Directory Structure**: Includes all key RCC4 development directories
3. **Custom Commands**: Predefined commands for common RCC4 operations
4. **Security Focus**: Telemetry disabled by default, sandbox enabled
5. **MCP Integration**: 
   - Connects to RCC4 internal API server running on port 5506 (no authentication)
   - Connects to RCC4 main server running on port 5507 with bearer token authentication
6. **Model Support**: Agent configured with full list of Qwen models supported by RCC4
7. **Routing Rules**: Agent includes routing rules for different task types:
   - Default: qwen3-coder-plus
   - Long context tasks: qwen-max
   - Fast response needs: qwen-turbo
   - Complex reasoning: qwen-plus

## API Endpoints

The RCC4 internal API server (port 5506) provides the following endpoints:
- `GET /health` - Health check endpoint
- `POST /api/v1/pipeline/router/process` - Router layer processing
- `POST /api/v1/pipeline/transformer/process` - Transformer layer processing
- `POST /api/v1/pipeline/protocol/process` - Protocol layer processing
- `POST /api/v1/pipeline/server/process` - Server layer processing

## Usage

1. Start RCC4 server: `iflow commands rcc4-start`
2. Run tests: `iflow commands rcc4-test`
3. Build project: `iflow commands rcc4-build`
4. Use development assistant: `iflow agent rcc4-developer`

This configuration enables a secure, efficient development workflow for the RCC4 project while maintaining compliance with defensive security practices.