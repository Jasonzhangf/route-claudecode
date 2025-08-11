# Provider Interface Documentation

## Overview

The unified ProviderClient interface standardizes how all AI providers are implemented in the Claude Code Router system. This interface ensures consistent behavior, error handling, and authentication management across all providers.

## ProviderClient Interface

### Core Processing Methods

#### `processRequest(request: AIRequest): Promise<AIResponse>`
Processes an AI request and returns a standardized response.

**Parameters:**
- `request`: The AI request containing messages, model, and metadata

**Returns:**
- `AIResponse`: Standardized response with choices, usage, and metadata

**Example:**
```typescript
const response = await provider.processRequest({
  id: 'req-123',
  provider: 'anthropic',
  model: 'claude-3-sonnet',
  messages: [{ role: 'user', content: 'Hello!' }],
  metadata: { timestamp: new Date(), source: 'api', priority: 1 }
});
```

#### `healthCheck(): Promise<ProviderHealth>`
Performs a health check to verify provider availability and performance.

**Returns:**
- `ProviderHealth`: Status, latency, error rate, and last check time

#### `authenticate(): Promise<AuthResult>`
Authenticates with the provider using configured credentials.

**Returns:**
- `AuthResult`: Success status, token, expiry, and error information

#### `getModels(): Promise<ModelInfo[]>`
Retrieves available models from the provider.

**Returns:**
- `ModelInfo[]`: Array of model information including capabilities and pricing

### Provider Information Methods

#### `getName(): string`
Returns the provider name.

#### `getVersion(): string`
Returns the provider implementation version.

#### `getEndpoint(): string`
Returns the provider API endpoint.

### Configuration and Lifecycle Methods

#### `initialize(config: ProviderConfig): Promise<void>`
Initializes the provider with configuration.

**Parameters:**
- `config`: Provider configuration including endpoint, API key, and settings

#### `shutdown(): Promise<void>`
Gracefully shuts down the provider and cleans up resources.

### Authentication Management Methods

#### `refreshToken(): Promise<AuthResult>`
Refreshes the authentication token if supported.

#### `validateToken(): Promise<boolean>`
Validates the current authentication token.

### Format Conversion Methods

#### `convertRequest(request: AIRequest, targetFormat: string): Promise<any>`
Converts a request to the provider's native format.

#### `convertResponse(response: any, sourceFormat: string): Promise<AIResponse>`
Converts a provider response to the standardized AIResponse format.

### Error Handling Methods

#### `handleError(error: any): ProviderError`
Standardizes error handling and classification.

#### `shouldRetry(error: ProviderError): boolean`
Determines if an error is retryable.

## BaseProvider Class

The `BaseProvider` abstract class provides common functionality for all providers:

### Key Features

1. **Configuration Management**: Validates and stores provider configuration
2. **Authentication Handling**: Manages tokens and authentication lifecycle
3. **Health Monitoring**: Implements health check functionality
4. **Error Classification**: Standardizes error handling across providers
5. **Token Management**: Handles token refresh and validation

### Implementation Example

```typescript
export class MyProvider extends BaseProvider {
  constructor() {
    super('my-provider', '1.0.0');
  }

  async processRequest(request: AIRequest): Promise<AIResponse> {
    // Implement provider-specific request processing
    const nativeRequest = await this.convertRequest(request, 'native');
    const nativeResponse = await this.callProviderAPI(nativeRequest);
    return this.convertResponse(nativeResponse, 'native');
  }

  async getModels(): Promise<ModelInfo[]> {
    // Implement model discovery
    return [
      {
        id: 'my-model-1',
        name: 'My Model 1',
        provider: this.name,
        capabilities: ['text-generation'],
        maxTokens: 4096
      }
    ];
  }

  protected async performHealthCheck(): Promise<void> {
    // Implement provider-specific health check
    await this.callProviderAPI({ method: 'ping' });
  }
}
```

## Configuration

### ProviderConfig Interface

```typescript
interface ProviderConfig {
  name: string;                    // Provider name
  type: string;                    // Provider type
  endpoint: string;                // API endpoint
  apiKey?: string;                 // API key
  models: string[];                // Supported models
  timeout?: number;                // Request timeout
  retryAttempts?: number;          // Retry attempts
  healthCheckInterval?: number;    // Health check interval
  authentication?: {               // Authentication config
    type: 'api-key' | 'oauth' | 'bearer';
    refreshUrl?: string;
    tokenExpiry?: number;
  };
}
```

### Example Configuration

```typescript
const config: ProviderConfig = {
  name: 'anthropic',
  type: 'anthropic',
  endpoint: 'https://api.anthropic.com/v1',
  apiKey: process.env.ANTHROPIC_API_KEY,
  models: ['claude-3-sonnet', 'claude-3-haiku'],
  timeout: 30000,
  retryAttempts: 3,
  healthCheckInterval: 60000,
  authentication: {
    type: 'api-key',
    tokenExpiry: 3600000
  }
};
```

## Error Handling

### ProviderError Interface

```typescript
interface ProviderError {
  code: string;                    // Error code
  message: string;                 // Error message
  type: 'authentication' | 'rate-limit' | 'network' | 'validation' | 'server' | 'unknown';
  retryable: boolean;              // Whether error is retryable
  retryAfter?: number;             // Retry delay in milliseconds
  originalError?: any;             // Original error object
}
```

### Error Types

1. **Authentication**: Invalid credentials, expired tokens
2. **Rate Limit**: API quota exceeded
3. **Network**: Connection issues, timeouts
4. **Validation**: Invalid request format or parameters
5. **Server**: Provider server errors
6. **Unknown**: Unclassified errors

## Best Practices

### 1. Configuration Validation
Always validate configuration in the `initialize` method:

```typescript
protected validateConfig(config: ProviderConfig): void {
  if (!config.endpoint) {
    throw new Error(`Endpoint is required for ${this.name} provider`);
  }
  // Add more validation as needed
}
```

### 2. Error Handling
Use the standardized error handling:

```typescript
try {
  const response = await this.callAPI(request);
  return response;
} catch (error) {
  const providerError = this.handleError(error);
  if (this.shouldRetry(providerError)) {
    // Implement retry logic
  }
  throw providerError;
}
```

### 3. Token Management
Implement proper token validation:

```typescript
async processRequest(request: AIRequest): Promise<AIResponse> {
  if (!await this.validateToken()) {
    await this.refreshToken();
  }
  // Process request
}
```

### 4. Health Checks
Implement lightweight health checks:

```typescript
protected async performHealthCheck(): Promise<void> {
  // Use a lightweight endpoint like /health or /models
  await fetch(`${this.endpoint}/health`);
}
```

## Testing

### Unit Tests
Test each method of your provider implementation:

```typescript
describe('MyProvider', () => {
  let provider: MyProvider;

  beforeEach(async () => {
    provider = new MyProvider();
    await provider.initialize(testConfig);
  });

  it('should process requests correctly', async () => {
    const request = createTestRequest();
    const response = await provider.processRequest(request);
    expect(response.choices).toHaveLength(1);
  });

  it('should handle authentication', async () => {
    const result = await provider.authenticate();
    expect(result.success).toBe(true);
  });
});
```

### Integration Tests
Test provider integration with the system:

```typescript
describe('Provider Integration', () => {
  it('should work with the router layer', async () => {
    const router = new RouterLayer();
    const provider = new MyProvider();
    
    await provider.initialize(config);
    const response = await router.routeRequest(request, provider);
    
    expect(response).toBeDefined();
  });
});
```

## Migration Guide

### From Mockup to Real Implementation

1. **Remove mockup indicators**: Remove console.log statements with "MOCKUP"
2. **Implement abstract methods**: Provide real implementations for `processRequest` and `getModels`
3. **Add provider-specific logic**: Implement authentication, format conversion, and error handling
4. **Update configuration**: Use real API endpoints and authentication methods
5. **Add comprehensive tests**: Test all functionality with real or mocked API calls

### Example Migration

Before (Mockup):
```typescript
export class AnthropicClient extends BaseProvider {
  constructor(apiKey?: string) {
    super('anthropic', 'https://api.anthropic.com/v1', apiKey);
  }

  async processRequest(request: AIRequest): Promise<AIResponse> {
    console.log('🔧 MOCKUP: AnthropicClient processing request');
    return this.createMockupResponse(request);
  }
}
```

After (Real Implementation):
```typescript
export class AnthropicClient extends BaseProvider {
  constructor() {
    super('anthropic', '1.0.0');
  }

  async processRequest(request: AIRequest): Promise<AIResponse> {
    const anthropicRequest = await this.convertToAnthropicFormat(request);
    const response = await this.callAnthropicAPI(anthropicRequest);
    return this.convertFromAnthropicFormat(response);
  }

  private async callAnthropicAPI(request: any): Promise<any> {
    // Real API call implementation
  }
}
```