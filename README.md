# Claude Code Router - Six-Layer Architecture (MOCKUP)

🔧 **MOCKUP IMPLEMENTATION**: This is a complete placeholder implementation demonstrating the six-layer architecture design. All functionality is mocked and should be replaced with real implementations.

## Architecture Overview

This implementation follows a six-layer architecture pattern:

```
Request → Client → Router → Preprocessor → Provider → Transformer → Post-processor → Response
```

### Layer Responsibilities

1. **Client Layer** (`src/client/`) - Request validation and initial processing
2. **Router Layer** (`src/router/`) - Provider and model selection logic
3. **Preprocessor Layer** (`src/preprocessor/`) - Request preparation and formatting
4. **Provider Layer** (`src/provider/`) - Communication with AI services
5. **Transformer Layer** (`src/transformer/`) - Response format conversion
6. **Post-processor Layer** (`src/post-processor/`) - Final response processing
7. **Server Layer** (`src/server/`) - HTTP server and response formatting

## Supported Providers (Mockup)

- **Anthropic** - Claude models (mockup implementation)
- **OpenAI** - GPT models (mockup implementation)
- **Gemini** - Google AI models (mockup implementation)
- **CodeWhisperer** - AWS CodeWhisperer (mockup implementation)

## Quick Start (Mockup)

### Installation
```bash
npm install
npm run build
```

### Start Server
```bash
npm start
# Server will start on http://localhost:3000
```

### CLI Usage
```bash
# Start all services
npm run cli start

# Check status
npm run cli status

# Test providers
npm run cli test

# Show help
npm run cli help
```

## API Endpoints (Mockup)

- `POST /v1/chat/completions` - Process AI requests
- `GET /health` - Health check
- `GET /status` - Service status
- `GET /metrics` - System metrics
- `GET /debug/recordings` - Debug recordings
- `POST /debug/replay` - Replay requests

## Configuration (Mockup)

Configuration files are located in the `config/` directory:

- `config/development/` - Development environment
- `config/production/` - Production environment  
- `config/testing/` - Testing environment

## Tools Ecosystem (Mockup)

### Log Parser (`tools/log-parser/`)
- Parse provider logs
- Extract performance data
- Generate metadata

### Visualization (`tools/visualization/`)
- API timeline visualization
- Finish reason analysis
- Performance charts

### Data Extraction (`tools/data-extraction/`)
- Provider metrics extraction
- Request pattern analysis
- Error analysis

### Utilities (`tools/utilities/`)
- Configuration validation
- Database optimization
- System health reports

## Testing (Mockup)

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

Test structure:
- `test/unit/` - Unit tests
- `test/integration/` - Integration tests
- `test/functional/` - Functional tests
- `test/performance/` - Performance tests

## Development (Mockup)

### Project Structure
```
src/
├── client/           # Client layer
├── router/           # Router layer
├── preprocessor/     # Preprocessor layer
├── provider/         # Provider layer
│   ├── anthropic/    # Anthropic provider
│   ├── openai/       # OpenAI provider
│   ├── gemini/       # Gemini provider
│   └── codewhisperer/# CodeWhisperer provider
├── transformer/      # Transformer layer
├── post-processor/   # Post-processor layer
├── server/           # Server layer
├── service/          # Service management
├── debug/            # Debug recording
├── pipeline/         # Pipeline orchestration
└── types/            # Type definitions

tools/
├── log-parser/       # Log parsing tools
├── visualization/    # Visualization tools
├── data-extraction/  # Data extraction tools
└── utilities/        # Utility tools

config/
├── development/      # Dev configuration
├── production/       # Prod configuration
└── testing/          # Test configuration

test/
├── unit/             # Unit tests
├── integration/      # Integration tests
├── functional/       # Functional tests
└── performance/      # Performance tests
```

### Key Features (Mockup)

- ✅ Six-layer architecture
- ✅ Multi-provider support
- ✅ Debug recording and replay
- ✅ Health monitoring
- ✅ Configuration management
- ✅ Service orchestration
- ✅ CLI interface
- ✅ HTTP API
- ✅ Comprehensive testing
- ✅ Tools ecosystem

## Monitoring (Mockup)

The system includes comprehensive monitoring:

- Service health checks
- Provider latency tracking
- Error rate monitoring
- Request/response recording
- Performance metrics
- Debug replay capabilities

## Contributing (Mockup)

This is a mockup implementation. To contribute to the real implementation:

1. Replace mockup components with real implementations
2. Implement actual provider integrations
3. Add real database persistence
4. Implement proper error handling
5. Add comprehensive logging
6. Implement security measures

## License

MIT License - This is a mockup implementation for demonstration purposes.

---

🔧 **MOCKUP INDICATOR**: This entire implementation is a placeholder demonstrating the six-layer architecture design. All components contain mockup functionality and should be replaced with real implementations for production use.