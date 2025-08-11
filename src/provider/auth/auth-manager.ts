/**
 * Authentication Manager
 * Centralized authentication management for all providers
 */

import { AuthResult, ProviderConfig } from '../../types/interfaces.js';
import { TokenManager } from './token-manager.js';
import { CredentialStore } from './credential-store.js';
import { AuthHealthMonitor } from './auth-health-monitor.js';

export interface AuthProvider {
  name: string;
  type: 'api-key' | 'oauth' | 'bearer' | 'aws-credentials';
  authenticate(): Promise<AuthResult>;
  refreshToken(): Promise<AuthResult>;
  validateToken(): Promise<boolean>;
  isTokenValid(): boolean;
  getToken(): string | undefined;
  clearAuth(): void;
}

export class AuthManager {
  private providers: Map<string, AuthProvider> = new Map();
  private tokenManager: TokenManager;
  private credentialStore: CredentialStore;
  private healthMonitor: AuthHealthMonitor;
  private initialized: boolean = false;

  constructor() {
    this.tokenManager = new TokenManager();
    this.credentialStore = new CredentialStore();
    this.healthMonitor = new AuthHealthMonitor();
  }

  async initialize(): Promise<void> {
    await this.tokenManager.initialize();
    await this.credentialStore.initialize();
    await this.healthMonitor.initialize();
    
    this.initialized = true;
    console.log('✅ AuthManager initialized successfully');
  }

  async registerProvider(name: string, authProvider: AuthProvider): Promise<void> {
    if (!this.initialized) {
      throw new Error('AuthManager must be initialized before registering providers');
    }

    this.providers.set(name, authProvider);
    this.healthMonitor.addProvider(name, authProvider);
    
    console.log(`✅ Auth provider '${name}' registered successfully`);
  }

  async authenticateProvider(providerName: string): Promise<AuthResult> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      return {
        success: false,
        error: `Provider '${providerName}' not found`
      };
    }

    try {
      const result = await provider.authenticate();
      
      if (result.success && result.token) {
        // Store token securely
        await this.tokenManager.storeToken(providerName, result.token, result.expiresAt);
        
        // Update health status
        this.healthMonitor.updateAuthStatus(providerName, 'healthy');
      } else {
        this.healthMonitor.updateAuthStatus(providerName, 'unhealthy');
      }
      
      return result;
    } catch (error) {
      this.healthMonitor.updateAuthStatus(providerName, 'unhealthy');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  async refreshProviderToken(providerName: string): Promise<AuthResult> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      return {
        success: false,
        error: `Provider '${providerName}' not found`
      };
    }

    try {
      const result = await provider.refreshToken();
      
      if (result.success && result.token) {
        // Update stored token
        await this.tokenManager.storeToken(providerName, result.token, result.expiresAt);
        
        // Update health status
        this.healthMonitor.updateAuthStatus(providerName, 'healthy');
      } else {
        this.healthMonitor.updateAuthStatus(providerName, 'unhealthy');
      }
      
      return result;
    } catch (error) {
      this.healthMonitor.updateAuthStatus(providerName, 'unhealthy');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      };
    }
  }

  async validateProviderToken(providerName: string): Promise<boolean> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      return false;
    }

    try {
      const isValid = await provider.validateToken();
      
      if (!isValid) {
        this.healthMonitor.updateAuthStatus(providerName, 'unhealthy');
      }
      
      return isValid;
    } catch (error) {
      this.healthMonitor.updateAuthStatus(providerName, 'unhealthy');
      return false;
    }
  }

  getProviderToken(providerName: string): string | undefined {
    const provider = this.providers.get(providerName);
    return provider?.getToken();
  }

  async ensureValidToken(providerName: string): Promise<string> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider '${providerName}' not found`);
    }

    // Check if current token is valid
    if (await this.validateProviderToken(providerName)) {
      const token = provider.getToken();
      if (token) {
        return token;
      }
    }

    // Try to refresh token
    const refreshResult = await this.refreshProviderToken(providerName);
    if (refreshResult.success && refreshResult.token) {
      return refreshResult.token;
    }

    // Try to authenticate from scratch
    const authResult = await this.authenticateProvider(providerName);
    if (authResult.success && authResult.token) {
      return authResult.token;
    }

    throw new Error(`Failed to obtain valid token for provider '${providerName}'`);
  }

  async clearProviderAuth(providerName: string): Promise<void> {
    const provider = this.providers.get(providerName);
    if (provider) {
      provider.clearAuth();
      await this.tokenManager.removeToken(providerName);
      this.healthMonitor.updateAuthStatus(providerName, 'unhealthy');
    }
  }

  async clearAllAuth(): Promise<void> {
    for (const [name, provider] of this.providers) {
      provider.clearAuth();
      await this.tokenManager.removeToken(name);
      this.healthMonitor.updateAuthStatus(name, 'unhealthy');
    }
  }

  getAuthStatus(providerName: string): 'healthy' | 'unhealthy' | 'unknown' {
    return this.healthMonitor.getAuthStatus(providerName);
  }

  getAllAuthStatuses(): Map<string, 'healthy' | 'unhealthy' | 'unknown'> {
    return this.healthMonitor.getAllAuthStatuses();
  }

  async startHealthMonitoring(intervalMs: number = 300000): Promise<void> {
    // Start monitoring auth health every 5 minutes by default
    setInterval(async () => {
      for (const [name] of this.providers) {
        await this.validateProviderToken(name);
      }
    }, intervalMs);
    
    console.log(`✅ Auth health monitoring started (interval: ${intervalMs}ms)`);
  }

  async storeCredentials(providerName: string, credentials: Record<string, any>): Promise<void> {
    await this.credentialStore.storeCredentials(providerName, credentials);
  }

  async getCredentials(providerName: string): Promise<Record<string, any> | undefined> {
    return await this.credentialStore.getCredentials(providerName);
  }

  async removeCredentials(providerName: string): Promise<void> {
    await this.credentialStore.removeCredentials(providerName);
  }

  // Method to get authentication statistics
  getAuthStats(): {
    totalProviders: number;
    healthyProviders: number;
    unhealthyProviders: number;
    unknownProviders: number;
  } {
    const statuses = this.getAllAuthStatuses();
    const stats = {
      totalProviders: statuses.size,
      healthyProviders: 0,
      unhealthyProviders: 0,
      unknownProviders: 0
    };

    for (const status of statuses.values()) {
      switch (status) {
        case 'healthy':
          stats.healthyProviders++;
          break;
        case 'unhealthy':
          stats.unhealthyProviders++;
          break;
        case 'unknown':
          stats.unknownProviders++;
          break;
      }
    }

    return stats;
  }

  // Method to get provider list
  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  // Method to check if provider is registered
  hasProvider(providerName: string): boolean {
    return this.providers.has(providerName);
  }

  // Method to get provider type
  getProviderType(providerName: string): string | undefined {
    const provider = this.providers.get(providerName);
    return provider?.type;
  }

  async shutdown(): Promise<void> {
    await this.clearAllAuth();
    await this.tokenManager.shutdown();
    await this.credentialStore.shutdown();
    await this.healthMonitor.shutdown();
    
    this.initialized = false;
    console.log('✅ AuthManager shutdown completed');
  }
}

console.log('✅ AuthManager loaded');