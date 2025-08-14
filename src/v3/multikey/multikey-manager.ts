/**
 * Independent Multi-Key and Token Manager
 * Handles key rotation, rate limiting, and token management
 * 
 * Project owner: Jason Zhang
 */

export interface KeyInfo {
  keyId: string;
  providerId: string;
  keyValue: string;
  keyType: 'api-key' | 'bearer-token' | 'oauth-token' | 'aws-profile';
  status: 'active' | 'rate_limited' | 'failed' | 'expired';
  usage: {
    requestCount: number;
    lastUsed: number;
    rateLimitResetTime?: number;
    failureCount: number;
    successCount: number;
  };
  limits: {
    requestsPerMinute?: number;
    requestsPerHour?: number;
    requestsPerDay?: number;
    maxConcurrent?: number;
  };
  metadata: {
    created: number;
    expiresAt?: number;
    region?: string;
    scope?: string[];
    keyPrefix: string;
  };
}

export interface RotationStrategy {
  type: 'round_robin' | 'weighted' | 'least_used' | 'random' | 'failover';
  weights?: number[];
  cooldownMs?: number;
  maxFailuresBeforeSkip?: number;
  backoffMultiplier?: number;
}

export interface TokenQuota {
  providerId: string;
  keyId: string;
  tokensUsed: number;
  tokensAvailable: number;
  tokensPerMinute: number;
  tokensPerHour: number;
  resetTime: number;
  estimatedCost: number;
}

export class MultiKeyManager {
  private keys: Map<string, KeyInfo> = new Map();
  private providerKeys: Map<string, string[]> = new Map();
  private rotationStates: Map<string, number> = new Map();
  private tokenQuotas: Map<string, TokenQuota> = new Map();
  private concurrentRequests: Map<string, number> = new Map();

  constructor() {
    console.log('🔑 Independent Multi-Key Manager initialized');
    
    // Start cleanup and monitoring tasks
    this.startCleanupTasks();
  }

  /**
   * Register a key for a provider
   */
  registerKey(providerId: string, keyValue: string, keyType: string, options?: {
    limits?: Partial<KeyInfo['limits']>;
    metadata?: Partial<KeyInfo['metadata']>;
    rotationWeight?: number;
  }): string {
    const keyId = this.generateKeyId(providerId, keyValue);
    
    const keyInfo: KeyInfo = {
      keyId,
      providerId,
      keyValue,
      keyType: keyType as KeyInfo['keyType'],
      status: 'active',
      usage: {
        requestCount: 0,
        lastUsed: 0,
        failureCount: 0,
        successCount: 0
      },
      limits: {
        requestsPerMinute: 60,
        requestsPerHour: 3600,
        requestsPerDay: 86400,
        maxConcurrent: 10,
        ...options?.limits
      },
      metadata: {
        created: Date.now(),
        keyPrefix: keyValue.substring(0, 8),
        ...options?.metadata
      }
    };

    this.keys.set(keyId, keyInfo);
    
    // Add to provider keys mapping
    const existingKeys = this.providerKeys.get(providerId) || [];
    existingKeys.push(keyId);
    this.providerKeys.set(providerId, existingKeys);

    console.log(`🔑 Registered key: ${keyId} for provider ${providerId}`, {
      keyType,
      limits: keyInfo.limits,
      totalKeysForProvider: existingKeys.length
    });

    return keyId;
  }

  /**
   * Register multiple keys from provider configuration
   */
  registerKeysFromConfig(providerId: string, config: any): string[] {
    const registeredKeys: string[] = [];
    const auth = config.authentication?.credentials;

    if (!auth) return registeredKeys;

    let keys: string[] = [];
    let keyType = 'api-key';

    // Extract keys from different formats
    if (auth.apiKeys && Array.isArray(auth.apiKeys)) {
      keys = auth.apiKeys;
      keyType = 'api-key';
    } else if (auth.apiKey) {
      keys = Array.isArray(auth.apiKey) ? auth.apiKey : [auth.apiKey];
      keyType = 'api-key';
    } else if (config.apiKey) {
      keys = [config.apiKey];
      keyType = 'api-key';
    }

    // Register each key
    for (const keyValue of keys) {
      const keyId = this.registerKey(providerId, keyValue, keyType, {
        limits: {
          requestsPerMinute: config.rateLimits?.requestsPerMinute,
          requestsPerHour: config.rateLimits?.requestsPerHour,
          requestsPerDay: config.rateLimits?.requestsPerDay,
          maxConcurrent: config.rateLimits?.maxConcurrent
        },
        metadata: {
          region: config.region,
          scope: config.scope
        }
      });
      registeredKeys.push(keyId);
    }

    console.log(`📋 Registered ${registeredKeys.length} keys for provider ${providerId}`);
    return registeredKeys;
  }

  /**
   * Select best key for a request
   */
  selectKey(providerId: string, strategy: RotationStrategy = { type: 'round_robin' }): KeyInfo | null {
    const keyIds = this.providerKeys.get(providerId);
    if (!keyIds || keyIds.length === 0) {
      return null;
    }

    // Filter available keys (not rate limited or failed)
    const availableKeys = keyIds
      .map(keyId => this.keys.get(keyId))
      .filter(key => key && this.isKeyAvailable(key)) as KeyInfo[];

    if (availableKeys.length === 0) {
      console.warn(`No available keys for provider ${providerId}`);
      return null;
    }

    let selectedKey: KeyInfo;

    switch (strategy.type) {
      case 'round_robin':
        selectedKey = this.selectRoundRobin(providerId, availableKeys);
        break;
      case 'weighted':
        selectedKey = this.selectWeighted(availableKeys, strategy.weights || []);
        break;
      case 'least_used':
        selectedKey = this.selectLeastUsed(availableKeys);
        break;
      case 'random':
        selectedKey = this.selectRandom(availableKeys);
        break;
      case 'failover':
        selectedKey = this.selectFailover(availableKeys);
        break;
      default:
        selectedKey = availableKeys[0];
    }

    // Update usage tracking
    this.updateKeyUsage(selectedKey.keyId);

    console.log(`🎯 Selected key: ${selectedKey.keyId} for ${providerId}`, {
      strategy: strategy.type,
      availableKeys: availableKeys.length,
      keyUsage: selectedKey.usage.requestCount
    });

    return selectedKey;
  }

  /**
   * Round robin key selection
   */
  private selectRoundRobin(providerId: string, availableKeys: KeyInfo[]): KeyInfo {
    const currentIndex = this.rotationStates.get(providerId) || 0;
    const selectedKey = availableKeys[currentIndex % availableKeys.length];
    this.rotationStates.set(providerId, currentIndex + 1);
    return selectedKey;
  }

  /**
   * Weighted key selection
   */
  private selectWeighted(availableKeys: KeyInfo[], weights: number[]): KeyInfo {
    if (weights.length === 0) {
      return availableKeys[0];
    }

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const random = Math.random() * totalWeight;
    
    let currentWeight = 0;
    for (let i = 0; i < availableKeys.length; i++) {
      currentWeight += weights[i] || 1;
      if (random <= currentWeight) {
        return availableKeys[i];
      }
    }
    
    return availableKeys[0];
  }

  /**
   * Least used key selection
   */
  private selectLeastUsed(availableKeys: KeyInfo[]): KeyInfo {
    return availableKeys.reduce((least, current) => 
      current.usage.requestCount < least.usage.requestCount ? current : least
    );
  }

  /**
   * Random key selection
   */
  private selectRandom(availableKeys: KeyInfo[]): KeyInfo {
    const randomIndex = Math.floor(Math.random() * availableKeys.length);
    return availableKeys[randomIndex];
  }

  /**
   * Failover key selection (prefer keys with lowest failure count)
   */
  private selectFailover(availableKeys: KeyInfo[]): KeyInfo {
    return availableKeys.reduce((best, current) => 
      current.usage.failureCount < best.usage.failureCount ? current : best
    );
  }

  /**
   * Check if key is available for use
   */
  private isKeyAvailable(key: KeyInfo): boolean {
    // Check status
    if (key.status !== 'active') {
      return false;
    }

    // Check rate limits
    if (key.usage.rateLimitResetTime && Date.now() < key.usage.rateLimitResetTime) {
      return false;
    }

    // Check concurrent requests
    const concurrent = this.concurrentRequests.get(key.keyId) || 0;
    if (key.limits.maxConcurrent && concurrent >= key.limits.maxConcurrent) {
      return false;
    }

    // Check expiration
    if (key.metadata.expiresAt && Date.now() > key.metadata.expiresAt) {
      return false;
    }

    return true;
  }

  /**
   * Update key usage statistics
   */
  private updateKeyUsage(keyId: string): void {
    const key = this.keys.get(keyId);
    if (!key) return;

    key.usage.requestCount++;
    key.usage.lastUsed = Date.now();

    // Increment concurrent requests
    const concurrent = this.concurrentRequests.get(keyId) || 0;
    this.concurrentRequests.set(keyId, concurrent + 1);
  }

  /**
   * Mark request completion (success or failure)
   */
  markRequestComplete(keyId: string, success: boolean, error?: string): void {
    const key = this.keys.get(keyId);
    if (!key) return;

    // Decrement concurrent requests
    const concurrent = this.concurrentRequests.get(keyId) || 0;
    this.concurrentRequests.set(keyId, Math.max(0, concurrent - 1));

    if (success) {
      key.usage.successCount++;
      // Reset failure count on success
      if (key.usage.failureCount > 0) {
        key.usage.failureCount = Math.max(0, key.usage.failureCount - 1);
      }
    } else {
      key.usage.failureCount++;
      
      // Handle rate limiting
      if (error?.includes('rate limit') || error?.includes('429')) {
        key.status = 'rate_limited';
        key.usage.rateLimitResetTime = Date.now() + (60 * 1000); // 1 minute default
      }
      
      // Handle key failure
      if (key.usage.failureCount > 5) {
        key.status = 'failed';
        console.warn(`Key marked as failed: ${keyId}`, {
          failureCount: key.usage.failureCount,
          error
        });
      }
    }

    console.log(`📊 Request completed for key: ${keyId}`, {
      success,
      failureCount: key.usage.failureCount,
      successCount: key.usage.successCount,
      concurrent: this.concurrentRequests.get(keyId) || 0
    });
  }

  /**
   * Get key statistics
   */
  getKeyStats(providerId?: string): any {
    const keys = providerId 
      ? (this.providerKeys.get(providerId) || []).map(keyId => this.keys.get(keyId)).filter(Boolean)
      : Array.from(this.keys.values());

    const stats = {
      totalKeys: keys.length,
      activeKeys: keys.filter(key => key.status === 'active').length,
      rateLimitedKeys: keys.filter(key => key.status === 'rate_limited').length,
      failedKeys: keys.filter(key => key.status === 'failed').length,
      totalRequests: keys.reduce((sum, key) => sum + key.usage.requestCount, 0),
      totalFailures: keys.reduce((sum, key) => sum + key.usage.failureCount, 0),
      averageSuccessRate: 0,
      concurrentRequests: Array.from(this.concurrentRequests.values()).reduce((sum, count) => sum + count, 0)
    };

    if (stats.totalRequests > 0) {
      const totalSuccesses = keys.reduce((sum, key) => sum + key.usage.successCount, 0);
      stats.averageSuccessRate = totalSuccesses / stats.totalRequests;
    }

    return stats;
  }

  /**
   * Generate unique key ID
   */
  private generateKeyId(providerId: string, keyValue: string): string {
    const hash = this.simpleHash(keyValue);
    return `${providerId}-key-${hash}`;
  }

  /**
   * Simple hash function for key identification
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).substring(0, 8);
  }

  /**
   * Start cleanup and monitoring tasks
   */
  private startCleanupTasks(): void {
    // Reset rate limited keys every minute
    setInterval(() => {
      const now = Date.now();
      for (const key of this.keys.values()) {
        if (key.status === 'rate_limited' && 
            key.usage.rateLimitResetTime && 
            now > key.usage.rateLimitResetTime) {
          key.status = 'active';
          delete key.usage.rateLimitResetTime;
          console.log(`🔄 Key rate limit reset: ${key.keyId}`);
        }
      }
    }, 60000); // Every minute

    // Log statistics every 5 minutes
    setInterval(() => {
      const stats = this.getKeyStats();
      console.log('📊 Multi-Key Manager Statistics:', stats);
    }, 300000); // Every 5 minutes
  }
}

// Global multi-key manager instance
export const multiKeyManager = new MultiKeyManager();