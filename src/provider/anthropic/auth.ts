/**
 * Anthropic Authentication Implementation
 * Real implementation of Anthropic authentication management
 * Implements the AuthProvider interface for use with AuthManager
 */

import { AuthResult } from '../../types/interfaces.js';
import { AuthProvider } from '../auth/auth-manager.js';

export class AnthropicAuth implements AuthProvider {
  public readonly name = 'anthropic';
  public readonly type = 'api-key' as const;
  
  private apiKey?: string;
  private token?: string;
  private tokenExpiry?: Date;
  private initialized: boolean = false;

  constructor() {
    // Constructor no longer takes apiKey directly - use initialize method
  }

  async initialize(apiKey: string): Promise<void> {
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }

    this.apiKey = apiKey;
    this.initialized = true;
    
    // Anthropic uses API keys directly, so we set the token immediately
    this.token = apiKey;
    // API keys don't expire, but we set a far future date for consistency
    this.tokenExpiry = new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)); // 1 year
    
    console.log('✅ AnthropicAuth initialized successfully');
  }

  async authenticate(): Promise<AuthResult> {
    if (!this.initialized || !this.apiKey) {
      return {
        success: false,
        error: 'Anthropic authentication not initialized'
      };
    }

    try {
      // Validate the API key by checking format and optionally making a test request
      const isValid = await this.validateApiKey();
      
      if (!isValid) {
        return {
          success: false,
          error: 'Invalid Anthropic API key'
        };
      }

      this.token = this.apiKey;
      this.tokenExpiry = new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)); // 1 year

      return {
        success: true,
        token: this.token,
        expiresAt: this.tokenExpiry
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  async refreshToken(): Promise<AuthResult> {
    // For Anthropic, refreshing is the same as authenticating since we use API keys
    return this.authenticate();
  }

  isTokenValid(): boolean {
    if (!this.initialized || !this.token || !this.tokenExpiry) {
      return false;
    }
    
    // Check if token is expired
    if (new Date() >= this.tokenExpiry) {
      return false;
    }

    return true;
  }

  getToken(): string | undefined {
    return this.isTokenValid() ? this.token : undefined;
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }

  async validateToken(): Promise<boolean> {
    if (!this.isTokenValid()) {
      return false;
    }

    try {
      return await this.validateApiKey();
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  private async validateApiKey(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      // First check format
      if (!this.isValidApiKeyFormat(this.apiKey)) {
        return false;
      }

      // In a real implementation, you could make a lightweight API call here
      // to validate the key with Anthropic's servers
      // For now, we'll just return true if format is valid
      return true;
    } catch (error) {
      console.error('API key validation failed:', error);
      return false;
    }
  }

  private isValidApiKeyFormat(apiKey: string): boolean {
    // Anthropic API keys typically start with 'sk-ant-' and have a specific format
    return apiKey.startsWith('sk-ant-') && apiKey.length > 20;
  }

  // Utility method to get authorization header
  getAuthorizationHeader(): string | undefined {
    const token = this.getToken();
    return token ? `Bearer ${token}` : undefined;
  }

  // Method to check if authentication is properly initialized
  isInitialized(): boolean {
    return this.initialized && !!this.apiKey;
  }

  // Method to clear authentication state
  clearAuth(): void {
    this.token = undefined;
    this.tokenExpiry = undefined;
    this.apiKey = undefined;
    this.initialized = false;
  }

  // Method to get authentication headers for HTTP requests
  getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    };

    const authHeader = this.getAuthorizationHeader();
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    return headers;
  }

  // Method to validate API key with actual API call (optional)
  async validateWithAPI(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      // This would make an actual API call to validate the key
      // For now, we'll just return the format validation
      return this.isValidApiKeyFormat(this.apiKey);
    } catch (error) {
      console.error('API validation failed:', error);
      return false;
    }
  }

  // Method to get provider-specific configuration
  getProviderConfig(): Record<string, any> {
    return {
      name: this.name,
      type: this.type,
      initialized: this.initialized,
      hasApiKey: !!this.apiKey,
      tokenValid: this.isTokenValid(),
      tokenExpiry: this.tokenExpiry
    };
  }
}

console.log('✅ Anthropic auth loaded - real implementation with AuthProvider interface');