/**
 * Independent Authentication Manager
 * Handles all authentication logic without coupling to provider protocols
 * 
 * Project owner: Jason Zhang
 */

export interface AuthCredentials {
  type: 'bearer' | 'api-key' | 'aws-codewhisperer' | 'oauth';
  credentials: {
    apiKey?: string | string[];
    apiKeys?: string[];
    profile?: string;
    accessToken?: string;
    refreshToken?: string;
    region?: string;
    profileArn?: string;
  };
  headers?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface AuthenticationConfig {
  id: string;
  providerId: string;
  originalProviderId: string;
  type: string;
  keyIndex?: number;
  totalKeys?: number;
  credentials: AuthCredentials;
  rotationStrategy?: 'round_robin' | 'weighted' | 'failover';
  cooldownMs?: number;
  maxRetriesPerKey?: number;
  rateLimitCooldownMs?: number;
}

export class AuthenticationManager {
  private authConfigs: Map<string, AuthenticationConfig> = new Map();
  private keyRotationStates: Map<string, number> = new Map();
  private keyFailureCounts: Map<string, number> = new Map();
  private keyCooldowns: Map<string, number> = new Map();

  constructor() {
    console.log('🔐 Independent Authentication Manager initialized');
  }

  /**
   * Register authentication configuration
   */
  registerAuth(config: AuthenticationConfig): void {
    this.authConfigs.set(config.id, config);
    
    // Initialize rotation state for multi-key configurations
    if (config.totalKeys && config.totalKeys > 1) {
      this.keyRotationStates.set(config.originalProviderId, 0);
    }

    console.log(`🔐 Registered authentication: ${config.id}`, {
      type: config.type,
      providerId: config.providerId,
      hasMultipleKeys: (config.totalKeys || 1) > 1,
      keyIndex: config.keyIndex,
      totalKeys: config.totalKeys
    });
  }

  /**
   * Get authentication for a specific provider
   */
  getAuth(providerId: string): AuthenticationConfig | null {
    return this.authConfigs.get(providerId) || null;
  }

  /**
   * Get authentication with key rotation for multi-key providers
   */
  getAuthWithRotation(originalProviderId: string, requestId?: string): AuthenticationConfig | null {
    // Find all auth configs for this original provider
    const matchingConfigs = Array.from(this.authConfigs.values())
      .filter(config => config.originalProviderId === originalProviderId);

    if (matchingConfigs.length === 0) {
      return null;
    }

    if (matchingConfigs.length === 1) {
      return matchingConfigs[0];
    }

    // Multi-key rotation logic
    const currentIndex = this.keyRotationStates.get(originalProviderId) || 0;
    const selectedConfig = matchingConfigs[currentIndex % matchingConfigs.length];
    
    // Update rotation state
    this.keyRotationStates.set(originalProviderId, currentIndex + 1);

    console.log(`🔄 Key rotation for ${originalProviderId}: selected ${selectedConfig.id}`, {
      currentIndex,
      totalKeys: matchingConfigs.length,
      selectedConfig: selectedConfig.id,
      requestId
    });

    return selectedConfig;
  }

  /**
   * Mark authentication key as failed
   */
  markAuthFailure(authId: string, error?: string): void {
    const currentCount = this.keyFailureCounts.get(authId) || 0;
    this.keyFailureCounts.set(authId, currentCount + 1);
    
    // Set cooldown for failed key
    const config = this.authConfigs.get(authId);
    if (config && config.rateLimitCooldownMs) {
      this.keyCooldowns.set(authId, Date.now() + config.rateLimitCooldownMs);
    }

    console.log(`❌ Authentication failure: ${authId}`, {
      failureCount: currentCount + 1,
      error,
      cooldownUntil: this.keyCooldowns.get(authId)
    });
  }

  /**
   * Check if authentication key is in cooldown
   */
  isInCooldown(authId: string): boolean {
    const cooldownUntil = this.keyCooldowns.get(authId);
    if (!cooldownUntil) return false;
    
    const isInCooldown = Date.now() < cooldownUntil;
    if (!isInCooldown) {
      // Remove expired cooldown
      this.keyCooldowns.delete(authId);
    }
    
    return isInCooldown;
  }

  /**
   * Get available authentication keys (not in cooldown)
   */
  getAvailableAuth(originalProviderId: string): AuthenticationConfig[] {
    const matchingConfigs = Array.from(this.authConfigs.values())
      .filter(config => config.originalProviderId === originalProviderId)
      .filter(config => !this.isInCooldown(config.id));

    return matchingConfigs;
  }

  /**
   * Convert provider config to authentication config
   */
  static fromProviderConfig(
    providerId: string,
    originalProviderId: string,
    keyIndex: number,
    totalKeys: number,
    providerConfig: any
  ): AuthenticationConfig {
    const auth = providerConfig.authentication;
    
    return {
      id: providerId,
      providerId,
      originalProviderId,
      type: auth?.type || 'bearer',
      keyIndex,
      totalKeys,
      credentials: {
        type: auth?.type || 'bearer',
        credentials: auth?.credentials || {},
        headers: auth?.headers || {},
        metadata: auth?.metadata || {}
      },
      rotationStrategy: 'round_robin',
      cooldownMs: 1000,
      maxRetriesPerKey: 2,
      rateLimitCooldownMs: 60000
    };
  }

  /**
   * Get authentication headers for API calls
   */
  getAuthHeaders(authConfig: AuthenticationConfig): Record<string, string> {
    const headers: Record<string, string> = {};
    
    switch (authConfig.credentials.type) {
      case 'bearer':
        const apiKey = Array.isArray(authConfig.credentials.credentials.apiKey)
          ? authConfig.credentials.credentials.apiKey[0]
          : authConfig.credentials.credentials.apiKey as string;
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }
        break;
        
      case 'api-key':
        const key = Array.isArray(authConfig.credentials.credentials.apiKeys)
          ? authConfig.credentials.credentials.apiKeys[0]
          : authConfig.credentials.credentials.apiKey as string;
        if (key) {
          headers['X-API-Key'] = key;
        }
        break;
        
      case 'aws-codewhisperer':
        // AWS authentication is handled by SDK
        break;
    }

    // Add custom headers
    if (authConfig.credentials.headers) {
      Object.assign(headers, authConfig.credentials.headers);
    }

    return headers;
  }

  /**
   * Get statistics about authentication states
   */
  getAuthStats(): any {
    const stats = {
      totalConfigs: this.authConfigs.size,
      authTypes: new Map<string, number>(),
      rotationStates: Object.fromEntries(this.keyRotationStates),
      failureCounts: Object.fromEntries(this.keyFailureCounts),
      cooldowns: Object.fromEntries(this.keyCooldowns),
      multiKeyProviders: 0
    };

    // Count auth types and multi-key providers
    for (const config of this.authConfigs.values()) {
      const currentCount = stats.authTypes.get(config.type) || 0;
      stats.authTypes.set(config.type, currentCount + 1);
      
      if ((config.totalKeys || 1) > 1) {
        stats.multiKeyProviders++;
      }
    }

    return stats;
  }
}

// Global authentication manager instance
export const authenticationManager = new AuthenticationManager();