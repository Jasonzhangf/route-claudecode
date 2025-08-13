# Provider Usage Examples

## Basic Provider Implementation

Here's a complete example of implementing a new provider using the unified ProviderClient interface:

```typescript
import { BaseProvider } from '../base-provider.js';
import { AIRequest, AIResponse, ModelInfo, ProviderConfig } from '../../types/interfaces.js';

export class ExampleProvider extends BaseProvider {
  private httpClient: any; // Your HTTP client

  constructor() {
    super('example-provider', '1.0.0');
  }

  async initialize(config: ProviderConfig): Promise<void> {
    await super.initialize(config);
    
    // Initialize HTTP client with provider-specific settings
    this.httpClient = createHttpClient({
      baseURL: config.endpoint,
      timeout: config.timeout || 30000,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async processRequest(request: AIRequest): Promise<AIResponse> {
    try {
      // Validate token before processing
      if (!await this.validateToken()) {
        await this.refreshToken();
      }

      // Convert to provider format
      const providerRequest = await this.convertRequest(request, 'example-format');
      
      // Make API call
      const response = await this.httpClient.post('/chat/completions', providerRequest);
      
      // Convert back to standard format
      return await this.convertResponse(response.data, 'example-format');
      
    } catch (error) {
      const providerError = this.handleError(error);
      
      if (this.shouldRetry(providerError)) {
        // Implement retry logic with exponential backoff
        await this.delay(providerError.retryAfter || 1000);
        return this.processRequest(request);
      }
      
      throw providerError;
    }
  }

  async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.httpClient.get('/models');
      
      return response.data.models.map((model: any) => ({
        id: model.id,
        name: model.name,
        provider: this.name,
        capabilities: model.capabilities || ['text-generation'],
        maxTokens: model.max_tokens,
        contextWindow: model.context_window,
        pricing: {
          inputTokens: model.pricing?.input || 0,
          outputTokens: model.pricing?.output || 0
        }
      }));
    } catch (error) {
      const providerError = this.handleError(error);
      throw providerError;
    }
  }

  protected async performHealthCheck(): Promise<void> {
    await this.httpClient.get('/health');
  }

  protected async performAuthentication(): Promise<AuthResult> {
    if (!this.config?.apiKey) {
      throw new Error('API key is required');
    }

    try {
      const response = await this.httpClient.post('/auth/validate', {
        api_key: this.config.apiKey
      });

      return {
        success: true,
        token: response.data.token,
        expiresAt: new Date(response.data.expires_at)
      };
    } catch (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  async convertRequest(request: AIRequest, targetFormat: string): Promise<any> {
    if (targetFormat === 'example-format') {
      return {
        model: request.model,
        messages: request.messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        stream: request.stream || false,
        max_tokens: 1000,
        temperature: 0.7
      };
    }
    
    return super.convertRequest(request, targetFormat);
  }

  async convertResponse(response: any, sourceFormat: string): Promise<AIResponse> {
    if (sourceFormat === 'example-format') {
      return {
        id: response.id,
        model: response.model,
        choices: response.choices.map((choice: any) => ({
          index: choice.index,
          message: {
            role: choice.message.role,
            content: choice.message.content
          },
          finishReason: choice.finish_reason
        })),
        usage: {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens
        },
        metadata: {
          timestamp: new Date(),
          processingTime: response.processing_time || 0,
          provider: this.name
        }
      };
    }
    
    return super.convertResponse(response, sourceFormat);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Provider Registration and Usage

```typescript
import { ExampleProvider } from './providers/example/client.js';
import { ProviderConfig } from './types/interfaces.js';

// Configuration
const config: ProviderConfig = {
  name: 'example-provider',
  type: 'example',
  endpoint: 'https://api.example.com/v1',
  apiKey: process.env.EXAMPLE_API_KEY,
  models: ['example-model-1', 'example-model-2'],
  timeout: 30000,
  retryAttempts: 3,
  healthCheckInterval: 60000,
  authentication: {
    type: 'api-key',
    tokenExpiry: 3600000
  }
};

// Initialize provider
const provider = new ExampleProvider();
await provider.initialize(config);

// Use provider
const request: AIRequest = {
  id: 'req-123',
  provider: 'example-provider',
  model: 'example-model-1',
  messages: [
    { role: 'user', content: 'Hello, how are you?' }
  ],
  metadata: {
    timestamp: new Date(),
    source: 'api',
    priority: 1
  }
};

const response = await provider.processRequest(request);
console.log(response.choices[0].message.content);
```

## Error Handling Example

```typescript
async function processWithErrorHandling(provider: ProviderClient, request: AIRequest): Promise<AIResponse> {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      return await provider.processRequest(request);
    } catch (error) {
      if (error instanceof ProviderError) {
        console.log(`Provider error: ${error.type} - ${error.message}`);
        
        if (error.type === 'authentication') {
          // Try to refresh token
          const authResult = await provider.refreshToken();
          if (!authResult.success) {
            throw new Error('Authentication failed and cannot be refreshed');
          }
        } else if (error.type === 'rate-limit') {
          // Wait for rate limit to reset
          const waitTime = error.retryAfter || 60000;
          console.log(`Rate limited, waiting ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else if (!provider.shouldRetry(error)) {
          // Non-retryable error
          throw error;
        }
        
        retryCount++;
        if (retryCount < maxRetries) {
          // Exponential backoff
          const backoffTime = Math.pow(2, retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      } else {
        throw error;
      }
    }
  }
  
  throw new Error(`Failed to process request after ${maxRetries} retries`);
}
```

## Health Monitoring Example

```typescript
class ProviderHealthMonitor {
  private providers: Map<string, ProviderClient> = new Map();
  private healthStatus: Map<string, ProviderHealth> = new Map();

  addProvider(name: string, provider: ProviderClient): void {
    this.providers.set(name, provider);
  }

  async checkAllProviders(): Promise<Map<string, ProviderHealth>> {
    const healthChecks = Array.from(this.providers.entries()).map(
      async ([name, provider]) => {
        try {
          const health = await provider.healthCheck();
          this.healthStatus.set(name, health);
          return [name, health] as const;
        } catch (error) {
          const unhealthyStatus: ProviderHealth = {
            status: 'unhealthy',
            latency: 0,
            errorRate: 1,
            lastCheck: new Date()
          };
          this.healthStatus.set(name, unhealthyStatus);
          return [name, unhealthyStatus] as const;
        }
      }
    );

    const results = await Promise.all(healthChecks);
    return new Map(results);
  }

  getHealthyProviders(): string[] {
    return Array.from(this.healthStatus.entries())
      .filter(([_, health]) => health.status === 'healthy')
      .map(([name, _]) => name);
  }

  async startMonitoring(intervalMs: number = 60000): Promise<void> {
    setInterval(async () => {
      await this.checkAllProviders();
      console.log('Health check completed:', this.getHealthyProviders());
    }, intervalMs);
  }
}

// Usage
const monitor = new ProviderHealthMonitor();
monitor.addProvider('anthropic', anthropicProvider);
monitor.addProvider('openai', openaiProvider);
monitor.addProvider('gemini', geminiProvider);

await monitor.startMonitoring(30000); // Check every 30 seconds
```

## Format Conversion Example

```typescript
class FormatConverter {
  static async convertAnthropicToOpenAI(request: AIRequest): Promise<any> {
    return {
      model: request.model,
      messages: request.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      stream: request.stream || false,
      max_tokens: 1000,
      temperature: 0.7
    };
  }

  static async convertOpenAIToAnthropic(request: AIRequest): Promise<any> {
    return {
      model: request.model,
      messages: request.messages,
      max_tokens: 1000,
      stream: request.stream || false
    };
  }

  static async convertGeminiToStandard(response: any): Promise<AIResponse> {
    return {
      id: response.id || `gemini-${Date.now()}`,
      model: response.model,
      choices: response.candidates?.map((candidate: any, index: number) => ({
        index,
        message: {
          role: 'assistant',
          content: candidate.content?.parts?.[0]?.text || ''
        },
        finishReason: candidate.finishReason?.toLowerCase() || 'stop'
      })) || [],
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0
      },
      metadata: {
        timestamp: new Date(),
        processingTime: 0,
        provider: 'gemini'
      }
    };
  }
}
```

## Testing Example

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ExampleProvider } from './example-provider.js';
import { ProviderConfig, AIRequest } from '../types/interfaces.js';

describe('ExampleProvider', () => {
  let provider: ExampleProvider;
  let config: ProviderConfig;

  beforeEach(async () => {
    config = {
      name: 'example-provider',
      type: 'example',
      endpoint: 'https://api.example.com/v1',
      apiKey: 'test-api-key',
      models: ['test-model'],
      timeout: 5000,
      retryAttempts: 2
    };

    provider = new ExampleProvider();
    await provider.initialize(config);
  });

  afterEach(async () => {
    await provider.shutdown();
  });

  it('should initialize correctly', () => {
    expect(provider.getName()).toBe('example-provider');
    expect(provider.getEndpoint()).toBe('https://api.example.com/v1');
  });

  it('should process requests', async () => {
    const request: AIRequest = {
      id: 'test-req',
      provider: 'example-provider',
      model: 'test-model',
      messages: [{ role: 'user', content: 'Hello' }],
      metadata: { timestamp: new Date(), source: 'test', priority: 1 }
    };

    const response = await provider.processRequest(request);
    
    expect(response.id).toBeDefined();
    expect(response.model).toBe('test-model');
    expect(response.choices).toHaveLength(1);
    expect(response.choices[0].message.content).toBeDefined();
  });

  it('should handle authentication', async () => {
    const result = await provider.authenticate();
    expect(result.success).toBe(true);
    expect(result.token).toBeDefined();
  });

  it('should perform health checks', async () => {
    const health = await provider.healthCheck();
    expect(health.status).toBe('healthy');
    expect(health.latency).toBeGreaterThan(0);
    expect(health.lastCheck).toBeInstanceOf(Date);
  });

  it('should get models', async () => {
    const models = await provider.getModels();
    expect(models).toBeInstanceOf(Array);
    expect(models.length).toBeGreaterThan(0);
    expect(models[0]).toHaveProperty('id');
    expect(models[0]).toHaveProperty('name');
    expect(models[0]).toHaveProperty('provider');
  });

  it('should handle errors correctly', async () => {
    // Mock an error scenario
    const invalidRequest: AIRequest = {
      id: 'invalid-req',
      provider: 'example-provider',
      model: 'non-existent-model',
      messages: [],
      metadata: { timestamp: new Date(), source: 'test', priority: 1 }
    };

    await expect(provider.processRequest(invalidRequest)).rejects.toThrow();
  });

  it('should validate tokens', async () => {
    await provider.authenticate();
    const isValid = await provider.validateToken();
    expect(isValid).toBe(true);
  });

  it('should convert formats', async () => {
    const request: AIRequest = {
      id: 'test-req',
      provider: 'example-provider',
      model: 'test-model',
      messages: [{ role: 'user', content: 'Hello' }],
      metadata: { timestamp: new Date(), source: 'test', priority: 1 }
    };

    const converted = await provider.convertRequest(request, 'example-format');
    expect(converted).toHaveProperty('model');
    expect(converted).toHaveProperty('messages');
  });
});
```

## Integration with Router Layer

```typescript
import { ProviderClient, AIRequest } from '../types/interfaces.js';

class ProviderRouter {
  private providers: Map<string, ProviderClient> = new Map();
  private healthMonitor: ProviderHealthMonitor;

  constructor() {
    this.healthMonitor = new ProviderHealthMonitor();
  }

  registerProvider(name: string, provider: ProviderClient): void {
    this.providers.set(name, provider);
    this.healthMonitor.addProvider(name, provider);
  }

  async routeRequest(request: AIRequest): Promise<AIResponse> {
    const healthyProviders = this.healthMonitor.getHealthyProviders();
    
    if (healthyProviders.length === 0) {
      throw new Error('No healthy providers available');
    }

    // Simple round-robin selection
    const providerName = healthyProviders[Math.floor(Math.random() * healthyProviders.length)];
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }

    return await provider.processRequest(request);
  }
}
```

This comprehensive example demonstrates how to implement, test, and integrate providers using the unified ProviderClient interface.