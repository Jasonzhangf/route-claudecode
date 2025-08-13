# Configuration Management - Zero Hardcoding System

## Overview

The zero-hardcoding configuration management system loads configuration from external files and environment variables, with no fallback mechanisms. This ensures explicit error handling and prevents accidental use of hardcoded values.

## Configuration Loading Priority

The system loads configuration in the following order:

1. **User Configuration Directory**: `~/.route-claudecode/config/`
2. **Project Configuration Directory**: `config/`
3. **Environment Variables**: Override any configuration values

## User Configuration Directory

### Location
```
~/.route-claudecode/config/
├── development.json    # Development environment config
├── production.json     # Production environment config
├── testing.json        # Testing environment config
└── README.md          # Configuration documentation
```

### Format Options

#### JSON Format (Recommended for real API keys)
```json
{
  "environment": "development",
  "providers": {
    "anthropic": {
      "enabled": true,
      "apiKey": "sk-ant-api03-your-real-key-here",
      "baseURL": "https://api.anthropic.com/v1",
      "timeout": 30000,
      "retries": 3,
      "rateLimits": {
        "requestsPerMinute": 60,
        "tokensPerMinute": 100000
      }
    }
  }
}
```

#### JavaScript Module Format
```javascript
// ~/.route-claudecode/config/development.js
export default {
  environment: 'development',
  providers: {
    anthropic: {
      enabled: true,
      apiKey: process.env.ANTHROPIC_API_KEY || 'your-fallback-key',
      // ... rest of config
    }
  }
};
```

## Environment Variables

All configuration values can be overridden with environment variables:

### Server Configuration
- `PORT`: Server port number
- `HOST`: Server host address
- `ALLOWED_ORIGINS`: Comma-separated list of CORS origins
- `SSL_CERT_PATH`: Path to SSL certificate
- `SSL_KEY_PATH`: Path to SSL private key

### Provider Configuration
- `ANTHROPIC_API_KEY`: Anthropic API key
- `ANTHROPIC_BASE_URL`: Anthropic API base URL
- `ANTHROPIC_ENABLED`: Enable/disable Anthropic provider (true/false)
- `OPENAI_API_KEY`: OpenAI API key
- `OPENAI_ORG_ID`: OpenAI organization ID
- `OPENAI_BASE_URL`: OpenAI API base URL
- `OPENAI_ENABLED`: Enable/disable OpenAI provider (true/false)
- `GEMINI_API_KEY`: Gemini API key
- `GEMINI_BASE_URL`: Gemini API base URL
- `GEMINI_ENABLED`: Enable/disable Gemini provider (true/false)
- `AWS_ACCESS_KEY_ID`: AWS access key for CodeWhisperer
- `AWS_SECRET_ACCESS_KEY`: AWS secret key for CodeWhisperer
- `AWS_REGION`: AWS region for CodeWhisperer
- `CODEWHISPERER_ENABLED`: Enable/disable CodeWhisperer provider (true/false)

### Database Configuration
- `DATABASE_PATH`: Database storage path
- `DATABASE_MAX_SIZE`: Maximum database size (e.g., "1GB")
- `RETENTION_DAYS`: Data retention period in days

### Logging Configuration
- `LOG_LEVEL`: Logging level (debug, info, warn, error)
- `LOG_FILE`: Log file path
- `LOG_MAX_SIZE`: Maximum log file size
- `LOG_MAX_FILES`: Maximum number of log files

## Environment-Specific Behavior

### Development Environment
- API keys are optional (warnings instead of errors)
- Debug logging enabled
- CORS allows localhost origins
- Rate limiting disabled

### Production Environment
- API keys are required for enabled providers
- Strict validation
- SSL configuration supported
- Rate limiting enabled
- Console logging disabled

### Testing Environment
- Uses mock API keys and endpoints
- In-memory database
- Fast timeouts for quick test execution
- All providers enabled with test credentials

## Security Best Practices

### 1. Never Commit Real API Keys
```bash
# Add to .gitignore
~/.route-claudecode/
*.env
config/*/real-*.json
```

### 2. Use Environment Variables in Production
```bash
export ANTHROPIC_API_KEY="sk-ant-api03-your-real-key"
export OPENAI_API_KEY="sk-your-real-openai-key"
export GEMINI_API_KEY="your-real-gemini-key"
```

### 3. Separate Configuration by Environment
- Development: Use user config directory with real keys
- Production: Use environment variables only
- Testing: Use project config with mock values

### 4. Validate Configuration on Startup
The system validates all configuration on startup and fails fast if:
- Required API keys are missing in production
- Configuration format is invalid
- Environment variables have wrong types
- Provider configurations are incomplete

## Error Handling

### No Fallback Mechanisms
The system explicitly fails when:
- Required configuration is missing
- Environment variables are invalid
- Configuration files cannot be loaded
- Validation fails

### Error Types
- `MissingConfigurationError`: Required configuration missing
- `InvalidConfigurationError`: Invalid configuration values
- `EnvironmentVariableError`: Environment variable issues
- `ConfigurationValidationError`: Multiple validation errors
- `ProviderConfigurationError`: Provider-specific errors

## Usage Examples

### Basic Usage
```typescript
import { createConfigurationManager } from './src/config/index.js';

const configManager = createConfigurationManager('development');
await configManager.initialize();

const config = configManager.getConfiguration();
const anthropicConfig = configManager.getProviderConfig('anthropic');
```

### Dynamic Configuration Updates
```typescript
// Update provider configuration at runtime
await configManager.updateProviderConfig('anthropic', {
  timeout: 60000,
  retries: 5
});

// Reload configuration from files
await configManager.reload();
```

### Configuration Validation
```typescript
const validation = await configManager.validateCurrentConfiguration();
if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
  process.exit(1);
}
```

## Migration from Mockup System

### Step 1: Create User Configuration
1. Create `~/.route-claudecode/config/` directory
2. Copy your real API keys to environment-specific JSON files
3. Remove any hardcoded values from project files

### Step 2: Update Application Code
```typescript
// Old mockup system
import MockupConfigManager from './config/index.js';
const config = new MockupConfigManager('development');

// New zero-hardcoding system
import { createConfigurationManager } from './src/config/index.js';
const configManager = createConfigurationManager('development');
await configManager.initialize();
```

### Step 3: Environment Variables
Set up environment variables for production deployment:
```bash
# Production environment
export NODE_ENV=production
export ANTHROPIC_API_KEY="your-real-key"
export OPENAI_API_KEY="your-real-key"
# ... other variables
```

### Step 4: Validation
Run the application and verify:
- Configuration loads without errors
- All required API keys are present
- Providers are properly configured
- No hardcoded values remain

## Troubleshooting

### Common Issues

1. **Configuration Not Found**
   - Check file paths and permissions
   - Verify JSON syntax
   - Ensure environment variables are set

2. **Validation Errors**
   - Check required fields for each provider
   - Verify data types (numbers, booleans, strings)
   - Ensure API key formats are correct

3. **Environment Variable Issues**
   - Check variable names (case-sensitive)
   - Verify values are properly formatted
   - Ensure variables are exported

### Debug Mode
Enable debug logging to see configuration loading process:
```bash
export LOG_LEVEL=debug
npm start
```

This will show:
- Configuration file loading attempts
- Environment variable processing
- Validation results
- Final configuration summary