/**
 * Base Provider Implementation
 * Real implementation of the unified ProviderClient interface
 * Provides common functionality for all AI providers
 */

import { 
  ProviderClient, 
  AIRequest, 
  AIResponse, 
  ProviderHealth, 
  AuthResult, 
  ModelInfo,
  ProviderConfig,
  ProviderError
} from '../types/interfaces.js';

export abstract class BaseProvider implements ProviderClient {
  protected name: string;
  protected version: string;
  protected endpoint: string;
  protected config?: ProviderConfig;
  protected initialized: boolean = false;
  protected lastHealthCheck?: Date;
  protected authToken?: string;
  protected tokenExpiry?: Date;

  constructor(name: string, version: string = '1.0.0') {
    this.name = name;
    this.version = version;
    this.endpoint = '';
  }

  // Provider information methods
  getName(): string {
    return this.name;
  }

  getVersion(): string {
    return this.version;
  }

  getEndpoint(): string {
    return this.endpoint;
  }

  // Configuration and lifecycle methods
  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config;
    this.endpoint = config.endpoint;
    
    // Validate configuration
    this.validateConfig(config);
    
    // Perform initial authentication if API key is provided
    if (config.apiKey) {
      const authResult = await this.authenticate();
      if (!authResult.success) {
        throw new Error(`Failed to authenticate with ${this.name}: ${authResult.error}`);
      }
    }
    
    this.initialized = true;
    console.log(`✅ ${this.name} provider initialized successfully`);
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
    this.authToken = undefined;
    this.tokenExpiry = undefined;
    console.log(`🔄 ${this.name} provider shutdown completed`);
  }

  // Abstract methods that must be implemented by concrete providers
  abstract processRequest(request: AIRequest): Promise<AIResponse>;
  abstract getModels(): Promise<ModelInfo[]>;

  // Health check implementation
  async healthCheck(): Promise<ProviderHealth> {
    if (!this.initialized) {
      return {
        status: 'unhealthy',
        latency: 0,
        errorRate: 1,
        lastCheck: new Date()
      };
    }

    const startTime = Date.now();
    
    try {
      // Perform a lightweight health check (e.g., ping endpoint or get models)
      await this.performHealthCheck();
      
      const latency = Date.now() - startTime;
      this.lastHealthCheck = new Date();
      
      return {
        status: 'healthy',
        latency,
        errorRate: 0,
        lastCheck: this.lastHealthCheck
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      this.lastHealthCheck = new Date();
      
      return {
        status: 'unhealthy',
        latency,
        errorRate: 1,
        lastCheck: this.lastHealthCheck
      };
    }
  }

  // Authentication methods
  async authenticate(): Promise<AuthResult> {
    if (!this.config?.apiKey) {
      return {
        success: false,
        error: 'No API key configured'
      };
    }

    try {
      const result = await this.performAuthentication();
      
      if (result.success && result.token) {
        this.authToken = result.token;
        this.tokenExpiry = result.expiresAt;
      }
      
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  async refreshToken(): Promise<AuthResult> {
    if (!this.config?.authentication?.refreshUrl) {
      // If no refresh URL, perform regular authentication
      return this.authenticate();
    }

    try {
      const result = await this.performTokenRefresh();
      
      if (result.success && result.token) {
        this.authToken = result.token;
        this.tokenExpiry = result.expiresAt;
      }
      
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      };
    }
  }

  async validateToken(): Promise<boolean> {
    if (!this.authToken) {
      return false;
    }

    if (this.tokenExpiry && new Date() >= this.tokenExpiry) {
      return false;
    }

    try {
      return await this.performTokenValidation();
    } catch (error) {
      return false;
    }
  }

  // Format conversion methods (to be implemented by concrete providers)
  async convertRequest(request: AIRequest, targetFormat: string): Promise<any> {
    // Default implementation - return as-is
    // Concrete providers should override this for specific format conversions
    return request;
  }

  async convertResponse(response: any, sourceFormat: string): Promise<AIResponse> {
    // Default implementation - assume response is already in AIResponse format
    // Concrete providers should override this for specific format conversions
    return response as AIResponse;
  }

  // Error handling methods
  handleError(error: any): ProviderError {
    if (error.response) {
      // HTTP error response
      const status = error.response.status;
      const message = error.response.data?.message || error.message || 'Unknown error';
      
      if (status === 401 || status === 403) {
        return {
          code: `AUTH_ERROR_${status}`,
          message,
          type: 'authentication',
          retryable: status === 401, // 401 might be retryable after token refresh
          originalError: error
        };
      } else if (status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        return {
          code: 'RATE_LIMIT',
          message,
          type: 'rate-limit',
          retryable: true,
          retryAfter: retryAfter ? parseInt(retryAfter) * 1000 : 60000, // Default 1 minute
          originalError: error
        };
      } else if (status >= 500) {
        return {
          code: `SERVER_ERROR_${status}`,
          message,
          type: 'server',
          retryable: true,
          originalError: error
        };
      } else if (status >= 400) {
        return {
          code: `CLIENT_ERROR_${status}`,
          message,
          type: 'validation',
          retryable: false,
          originalError: error
        };
      }
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return {
        code: error.code,
        message: error.message,
        type: 'network',
        retryable: true,
        originalError: error
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'Unknown error occurred',
      type: 'unknown',
      retryable: false,
      originalError: error
    };
  }

  shouldRetry(error: ProviderError): boolean {
    if (!error.retryable) {
      return false;
    }

    // Don't retry authentication errors unless it's a 401 (might need token refresh)
    if (error.type === 'authentication' && !error.code.includes('401')) {
      return false;
    }

    return true;
  }

  // Protected helper methods for concrete providers to override
  protected validateConfig(config: ProviderConfig): void {
    if (!config.endpoint) {
      throw new Error(`Endpoint is required for ${this.name} provider`);
    }

    if (!config.apiKey && config.authentication?.type === 'api-key') {
      throw new Error(`API key is required for ${this.name} provider`);
    }
  }

  protected async performHealthCheck(): Promise<void> {
    // Default implementation - override in concrete providers
    // This could make a simple API call to verify connectivity
    throw new Error('Health check not implemented');
  }

  protected async performAuthentication(): Promise<AuthResult> {
    // Default implementation for API key authentication
    // Override in concrete providers for specific authentication flows
    if (!this.config?.apiKey) {
      throw new Error('No API key available for authentication');
    }

    return {
      success: true,
      token: this.config.apiKey,
      expiresAt: new Date(Date.now() + (this.config.authentication?.tokenExpiry || 3600000)) // Default 1 hour
    };
  }

  protected async performTokenRefresh(): Promise<AuthResult> {
    // Default implementation - override in concrete providers
    return this.performAuthentication();
  }

  protected async performTokenValidation(): Promise<boolean> {
    // Default implementation - override in concrete providers
    return true;
  }

  // Utility methods for request/response handling
  protected createErrorResponse(request: AIRequest, error: ProviderError): AIResponse {
    return {
      id: `error-${Date.now()}`,
      model: request.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: `Error: ${error.message}`
        },
        finishReason: 'error'
      }],
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      metadata: {
        timestamp: new Date(),
        processingTime: 0,
        provider: this.name
      }
    };
  }

  protected calculateTokens(text: string): number {
    // Simple token estimation - 4 characters per token on average
    // Concrete providers should implement more accurate tokenization
    return Math.ceil(text.length / 4);
  }
}

console.log('✅ BaseProvider class loaded - real implementation');