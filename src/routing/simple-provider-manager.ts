/**
 * Simple Provider Manager with Round-Robin and Failover
 * Replaces complex concurrency management with simple blacklisting
 * Task 1 Implementation: Multi-provider round-robin with failure-based blacklisting
 */

import { logger } from '@/utils/logger';

export interface SimpleProviderBlacklist {
  providerId: string;
  model?: string; // Optional model specification for model-specific blacklisting
  blacklistedUntil: Date;
  reason: 'rate_limit' | 'auth_failure' | 'network_error' | 'server_error';
  errorCount: number;
  consecutiveErrors?: number; // Track consecutive errors for 429 rate limiting
}

export interface WeightedProvider {
  providerId: string;
  model?: string;
  weight: number;
  keyCount?: number; // Number of API keys available for round-robin within this provider
}

export interface ProviderKeyStatus {
  providerId: string;
  keyIndex: number;
  isBlacklisted: boolean;
  consecutiveErrors: number;
  lastError?: string;
  blacklistedUntil?: Date;
}

export class SimpleProviderManager {
  private roundRobinIndex: Map<string, number> = new Map();
  private blacklist: Map<string, SimpleProviderBlacklist> = new Map(); // Key format: 'providerId' or 'providerId:model'
  private consecutiveFailures: Map<string, number> = new Map(); // Track consecutive failures for 429 detection
  
  // Key-level management for providers with multiple API keys
  private keyRoundRobinIndex: Map<string, number> = new Map(); // Format: 'providerId' -> current key index
  private keyBlacklist: Map<string, ProviderKeyStatus[]> = new Map(); // Format: 'providerId' -> key status array
  
  // Blacklist durations in seconds
  private readonly RATE_LIMIT_BLACKLIST_DURATION = 60; // 1 minute for 429 errors
  private readonly AUTH_FAILURE_BLACKLIST_DURATION = 300; // 5 minutes for auth failures
  private readonly NETWORK_ERROR_BLACKLIST_DURATION = 120; // 2 minutes for network errors
  private readonly SERVER_ERROR_BLACKLIST_DURATION = 180; // 3 minutes for server errors
  
  // 429 consecutive failure threshold
  private readonly CONSECUTIVE_429_THRESHOLD = 3; // 连续3次429才拉黑
  
  constructor() {
    // 🔧 启动时清空所有黑名单，防止重启后仍被拉黑
    this.blacklist.clear();
    this.consecutiveFailures.clear();
    logger.info('SimpleProviderManager initialized with weighted round-robin and intelligent blacklisting', {
      blacklistCleared: true,
      consecutiveFailuresCleared: true,
      startupTime: new Date().toISOString()
    });
  }

  /**
   * Select next provider using weighted selection with blacklist filtering
   * Supports both weight-based and round-robin selection
   */
  selectProviderWeighted(providers: WeightedProvider[], category: string): WeightedProvider | null {
    // Filter out blacklisted providers
    const availableProviders = providers.filter(provider => 
      !this.isBlacklisted(provider.providerId, provider.model)
    );
    
    if (availableProviders.length === 0) {
      logger.warn('All weighted providers are blacklisted, using first provider anyway', {
        category,
        totalProviders: providers.length,
        blacklistedProviders: providers.filter(p => this.isBlacklisted(p.providerId, p.model))
      });
      // Return first provider even if blacklisted (emergency fallback)
      return providers[0] || null;
    }

    // Redistribute weights among available providers
    const redistributedProviders = this.redistributeWeights(availableProviders, providers);
    
    // Weighted random selection
    const selectedProvider = this.weightedRandomSelection(redistributedProviders);
    
    logger.debug('Weighted provider selection', {
      category,
      selectedProvider: selectedProvider?.providerId,
      selectedModel: selectedProvider?.model,
      selectedWeight: selectedProvider?.weight,
      availableProviders: availableProviders.length,
      totalProviders: providers.length,
      totalWeight: redistributedProviders.reduce((sum, p) => sum + p.weight, 0)
    });
    
    return selectedProvider;
  }

  /**
   * Select next provider using round-robin with blacklist filtering
   * Now supports model-specific blacklisting (legacy method)
   */
  selectProvider(providers: string[], category: string, model?: string): string | null {
    // Filter out blacklisted providers (check both model-specific and provider-wide blacklists)
    const availableProviders = providers.filter(providerId => 
      !this.isBlacklisted(providerId, model)
    );
    
    if (availableProviders.length === 0) {
      logger.warn('All providers are blacklisted, using first provider anyway', {
        category,
        model: model || 'all-models',
        totalProviders: providers.length,
        blacklistedProviders: providers.filter(p => this.isBlacklisted(p, model))
      });
      // Return first provider even if blacklisted (emergency fallback)
      return providers[0] || null;
    }
    
    // Round-robin selection among available providers
    const currentIndex = this.roundRobinIndex.get(category) || 0;
    const selectedProvider = availableProviders[currentIndex % availableProviders.length];
    
    // Update round-robin index
    this.roundRobinIndex.set(category, currentIndex + 1);
    
    logger.debug('Round-robin provider selection', {
      category,
      model: model || 'all-models',
      selectedProvider,
      availableProviders: availableProviders.length,
      totalProviders: providers.length,
      roundRobinIndex: currentIndex,
      blacklistScope: model ? 'model-specific' : 'provider-wide'
    });
    
    return selectedProvider;
  }

  /**
   * Report provider failure and apply blacklisting if needed
   * Now supports model-specific blacklisting when model is provided
   * Enhanced with consecutive 429 detection
   */
  reportFailure(providerId: string, error: string, httpCode?: number, model?: string): void {
    const failureType = this.categorizeFailure(error, httpCode);
    // Create composite key for model-specific blacklisting when model is provided
    const blacklistKey = model ? `${providerId}:${model}` : providerId;
    const existing = this.blacklist.get(blacklistKey);
    
    // Track consecutive failures for rate limiting
    const consecutiveKey = blacklistKey;
    
    logger.info('Provider failure reported', {
      providerId,
      model: model || 'all-models',
      failureType,
      error: error.substring(0, 100), // Truncate long errors
      httpCode,
      existingErrorCount: existing?.errorCount || 0,
      blacklistScope: model ? 'model-specific' : 'provider-wide'
    });
    
    switch (failureType) {
      case 'rate_limit':
        // Enhanced consecutive 429 detection
        const consecutive429 = this.consecutiveFailures.get(consecutiveKey) || 0;
        this.consecutiveFailures.set(consecutiveKey, consecutive429 + 1);
        
        if (consecutive429 + 1 >= this.CONSECUTIVE_429_THRESHOLD) {
          logger.warn(`🚫 Consecutive 429 threshold reached (${consecutive429 + 1}/${this.CONSECUTIVE_429_THRESHOLD}) - blacklisting provider`, {
            providerId,
            model: model || 'all-models',
            consecutiveErrors: consecutive429 + 1
          });
          this.blacklistProvider(blacklistKey, providerId, failureType, this.RATE_LIMIT_BLACKLIST_DURATION, model, consecutive429 + 1);
          // Reset consecutive counter after blacklisting
          this.consecutiveFailures.set(consecutiveKey, 0);
        } else {
          logger.debug(`Rate limit failure ${consecutive429 + 1}/${this.CONSECUTIVE_429_THRESHOLD} - not blacklisting yet`, {
            providerId,
            model: model || 'all-models',
            remainingAttempts: this.CONSECUTIVE_429_THRESHOLD - (consecutive429 + 1)
          });
        }
        break;
        
      case 'auth_failure':
        const authErrorCount = (existing?.errorCount || 0) + 1;
        if (authErrorCount >= 3) {
          // Permanent-like blacklisting for repeated auth failures (very long duration)
          this.blacklistProvider(blacklistKey, providerId, failureType, 3600, model); // 1 hour
        } else {
          this.blacklistProvider(blacklistKey, providerId, failureType, this.AUTH_FAILURE_BLACKLIST_DURATION, model);
        }
        break;
        
      case 'network_error':
        this.blacklistProvider(blacklistKey, providerId, failureType, this.NETWORK_ERROR_BLACKLIST_DURATION, model);
        break;
        
      case 'server_error':
        this.blacklistProvider(blacklistKey, providerId, failureType, this.SERVER_ERROR_BLACKLIST_DURATION, model);
        break;
        
      default:
        // Don't blacklist for unknown errors, just log
        logger.debug('Unknown error type, not blacklisting', { providerId, error, httpCode });
        break;
    }
  }

  /**
   * Report provider success (removes from blacklist if temporary)
   * Now supports model-specific recovery and resets consecutive failure counts
   */
  reportSuccess(providerId: string, model?: string): void {
    // Check both model-specific and provider-wide blacklists
    const keys = model ? [`${providerId}:${model}`, providerId] : [providerId];
    
    for (const key of keys) {
      // Reset consecutive failure counter on success
      if (this.consecutiveFailures.has(key)) {
        const previousConsecutive = this.consecutiveFailures.get(key) || 0;
        this.consecutiveFailures.set(key, 0);
        logger.debug('Reset consecutive failure counter after success', {
          providerId,
          model: model || 'all-models',
          previousConsecutive,
          blacklistKey: key
        });
      }
      
      const blacklisted = this.blacklist.get(key);
      if (blacklisted && blacklisted.reason !== 'auth_failure') {
        // Remove from blacklist on success (except for auth failures which need time-based recovery)
        this.blacklist.delete(key);
        logger.debug('Provider recovered from blacklist after success', { 
          providerId, 
          model: model || 'all-models',
          blacklistKey: key
        });
      }
    }
  }

  /**
   * Check if provider is currently blacklisted
   * Now supports model-specific blacklisting
   */
  isBlacklisted(providerId: string, model?: string): boolean {
    // Check model-specific blacklist first, then provider-wide blacklist
    const keys = model ? [`${providerId}:${model}`, providerId] : [providerId];
    
    for (const key of keys) {
      const blacklisted = this.blacklist.get(key);
      if (!blacklisted) {
        continue;
      }
    
      const now = new Date();
      if (now >= blacklisted.blacklistedUntil) {
        // Blacklist expired, remove it
        this.blacklist.delete(key);
        logger.info('Provider blacklist expired', { 
          providerId, 
          model: blacklisted.model || 'all-models',
          reason: blacklisted.reason,
          blacklistKey: key,
          duration: Math.round((now.getTime() - (blacklisted.blacklistedUntil.getTime() - this.getBlacklistDuration(blacklisted.reason) * 1000)) / 1000)
        });
        continue;
      }
      
      // Found active blacklist
      return true;
    }
    
    return false;
  }

  /**
   * Get blacklist status for all providers
   */
  getBlacklistStatus(): Record<string, SimpleProviderBlacklist | null> {
    const status: Record<string, SimpleProviderBlacklist | null> = {};
    
    // Clean expired blacklists first
    const now = new Date();
    for (const [providerId, blacklisted] of this.blacklist.entries()) {
      if (now >= blacklisted.blacklistedUntil) {
        this.blacklist.delete(providerId);
      }
    }
    
    // Return current blacklist status
    this.blacklist.forEach((blacklisted, providerId) => {
      status[providerId] = blacklisted;
    });
    
    return status;
  }

  /**
   * Clear all blacklists (for testing or emergency recovery)
   */
  clearAllBlacklists(): void {
    const count = this.blacklist.size;
    this.blacklist.clear();
    logger.info(`Cleared ${count} provider blacklists`);
  }

  /**
   * Get round-robin state for monitoring
   */
  getRoundRobinState(): Record<string, number> {
    const state: Record<string, number> = {};
    this.roundRobinIndex.forEach((index, category) => {
      state[category] = index;
    });
    return state;
  }

  // Private methods

  private blacklistProvider(blacklistKey: string, providerId: string, reason: SimpleProviderBlacklist['reason'], durationSeconds: number, model?: string, consecutiveErrors?: number): void {
    const now = new Date();
    const blacklistedUntil = new Date(now.getTime() + (durationSeconds * 1000));
    
    const existing = this.blacklist.get(blacklistKey);
    const errorCount = (existing?.errorCount || 0) + 1;
    
    this.blacklist.set(blacklistKey, {
      providerId,
      model,
      blacklistedUntil,
      reason,
      errorCount,
      consecutiveErrors: consecutiveErrors || errorCount
    });
    
    logger.warn('Provider blacklisted', {
      providerId,
      model: model || 'all-models',
      reason,
      durationSeconds,
      blacklistedUntil: blacklistedUntil.toISOString(),
      errorCount,
      consecutiveErrors: consecutiveErrors || errorCount,
      isRecurring: !!existing,
      blacklistKey,
      scope: model ? 'model-specific' : 'provider-wide'
    });
  }

  private categorizeFailure(error: string, httpCode?: number): SimpleProviderBlacklist['reason'] {
    const errorLower = error.toLowerCase();
    
    // Rate limit detection
    if (httpCode === 429) return 'rate_limit';
    if (errorLower.includes('rate limit') || errorLower.includes('too many requests')) {
      return 'rate_limit';
    }
    
    // Authentication failure detection
    if (httpCode === 401 || httpCode === 403) return 'auth_failure';
    if (errorLower.includes('unauthorized') || errorLower.includes('forbidden')) {
      return 'auth_failure';
    }
    if (errorLower.includes('token') && (errorLower.includes('invalid') || errorLower.includes('expired'))) {
      return 'auth_failure';
    }
    
    // Network error detection
    if (errorLower.includes('network') || errorLower.includes('connection')) {
      return 'network_error';
    }
    if (errorLower.includes('timeout') || errorLower.includes('econnreset')) {
      return 'network_error';
    }
    
    // Server error detection
    if (httpCode && httpCode >= 500) return 'server_error';
    if (errorLower.includes('internal server error') || errorLower.includes('bad gateway')) {
      return 'server_error';
    }
    
    // Default to server error for unknown failures
    return 'server_error';
  }

  private getBlacklistDuration(reason: SimpleProviderBlacklist['reason']): number {
    switch (reason) {
      case 'rate_limit': return this.RATE_LIMIT_BLACKLIST_DURATION;
      case 'auth_failure': return this.AUTH_FAILURE_BLACKLIST_DURATION;
      case 'network_error': return this.NETWORK_ERROR_BLACKLIST_DURATION;
      case 'server_error': return this.SERVER_ERROR_BLACKLIST_DURATION;
      default: return this.SERVER_ERROR_BLACKLIST_DURATION;
    }
  }

  /**
   * Redistribute weights among available providers
   * When providers are blacklisted, their weights are redistributed proportionally
   */
  private redistributeWeights(availableProviders: WeightedProvider[], allProviders: WeightedProvider[]): WeightedProvider[] {
    // Calculate total weight of all providers (including blacklisted)
    const totalOriginalWeight = allProviders.reduce((sum, p) => sum + p.weight, 0);
    
    // Calculate total weight of available providers
    const availableWeight = availableProviders.reduce((sum, p) => sum + p.weight, 0);
    
    // If all providers are available, no redistribution needed
    if (availableProviders.length === allProviders.length) {
      return availableProviders;
    }
    
    // Calculate weight of blacklisted providers
    const blacklistedWeight = totalOriginalWeight - availableWeight;
    
    if (availableWeight === 0) {
      // All available providers have 0 weight, distribute equally
      const equalWeight = totalOriginalWeight / availableProviders.length;
      return availableProviders.map(p => ({
        ...p,
        weight: equalWeight
      }));
    }
    
    // Redistribute blacklisted weight proportionally to available providers
    const redistributedProviders = availableProviders.map(provider => {
      const proportionalShare = (provider.weight / availableWeight) * blacklistedWeight;
      const newWeight = provider.weight + proportionalShare;
      
      return {
        ...provider,
        weight: newWeight
      };
    });
    
    logger.debug('Weight redistribution applied', {
      totalOriginalWeight,
      availableWeight,
      blacklistedWeight,
      availableProviders: availableProviders.length,
      totalProviders: allProviders.length,
      redistributedWeights: redistributedProviders.map(p => ({ 
        provider: p.providerId, 
        originalWeight: availableProviders.find(ap => ap.providerId === p.providerId)?.weight,
        newWeight: p.weight 
      }))
    });
    
    return redistributedProviders;
  }

  /**
   * Weighted random selection algorithm
   * Uses cumulative weight distribution for O(n) selection
   */
  private weightedRandomSelection(providers: WeightedProvider[]): WeightedProvider | null {
    if (providers.length === 0) {
      return null;
    }
    
    if (providers.length === 1) {
      return providers[0];
    }
    
    // Calculate total weight
    const totalWeight = providers.reduce((sum, p) => sum + p.weight, 0);
    
    if (totalWeight <= 0) {
      // All providers have 0 or negative weight, select randomly
      const randomIndex = Math.floor(Math.random() * providers.length);
      return providers[randomIndex];
    }
    
    // Generate random number between 0 and totalWeight
    let random = Math.random() * totalWeight;
    
    // Find the provider that matches the random value
    for (const provider of providers) {
      random -= provider.weight;
      if (random <= 0) {
        return provider;
      }
    }
    
    // Fallback (should not happen, but just in case)
    return providers[providers.length - 1];
  }

  /**
   * Get consecutive failure count for a provider
   */
  getConsecutiveFailures(providerId: string, model?: string): number {
    const key = model ? `${providerId}:${model}` : providerId;
    return this.consecutiveFailures.get(key) || 0;
  }

  /**
   * Clear consecutive failure counters (for testing or recovery)
   */
  clearConsecutiveFailures(): void {
    const count = this.consecutiveFailures.size;
    this.consecutiveFailures.clear();
    logger.info(`Cleared ${count} consecutive failure counters`);
  }

  // ==================== KEY-LEVEL MANAGEMENT ====================
  
  /**
   * Initialize key-level tracking for a provider
   */
  initializeProviderKeys(providerId: string, keyCount: number): void {
    if (keyCount <= 1) {
      // Single key or no keys, no need for key-level management
      this.keyBlacklist.delete(providerId);
      this.keyRoundRobinIndex.delete(providerId);
      return;
    }
    
    // Initialize key status array
    const keyStatuses: ProviderKeyStatus[] = [];
    for (let i = 0; i < keyCount; i++) {
      keyStatuses.push({
        providerId,
        keyIndex: i,
        isBlacklisted: false,
        consecutiveErrors: 0
      });
    }
    
    this.keyBlacklist.set(providerId, keyStatuses);
    this.keyRoundRobinIndex.set(providerId, 0);
    
    logger.debug(`Initialized key-level tracking for ${providerId}`, {
      keyCount,
      providerId
    });
  }

  /**
   * Select next available key for a provider using round-robin
   */
  selectProviderKey(providerId: string): number | null {
    const keyStatuses = this.keyBlacklist.get(providerId);
    if (!keyStatuses || keyStatuses.length <= 1) {
      // Single key or no key management, return 0 (first key)
      return 0;
    }
    
    // Clean expired blacklists first
    this.cleanExpiredKeyBlacklists(providerId);
    
    // Find available keys (not blacklisted)
    const availableKeys = keyStatuses.filter(status => !status.isBlacklisted);
    
    if (availableKeys.length === 0) {
      logger.warn(`All keys for provider ${providerId} are blacklisted, using first key anyway`, {
        providerId,
        totalKeys: keyStatuses.length,
        blacklistedKeys: keyStatuses.filter(s => s.isBlacklisted).length
      });
      // Return first key as emergency fallback
      return 0;
    }
    
    // Round-robin selection among available keys
    const currentIndex = this.keyRoundRobinIndex.get(providerId) || 0;
    const selectedKeyStatus = availableKeys[currentIndex % availableKeys.length];
    
    // Update round-robin index
    this.keyRoundRobinIndex.set(providerId, currentIndex + 1);
    
    logger.debug(`Key round-robin selection for ${providerId}`, {
      selectedKeyIndex: selectedKeyStatus.keyIndex,
      availableKeys: availableKeys.length,
      totalKeys: keyStatuses.length,
      roundRobinIndex: currentIndex
    });
    
    return selectedKeyStatus.keyIndex;
  }

  /**
   * Report key-level failure for a specific provider key
   */
  reportKeyFailure(providerId: string, keyIndex: number, error: string, httpCode?: number): void {
    const keyStatuses = this.keyBlacklist.get(providerId);
    if (!keyStatuses || keyIndex >= keyStatuses.length) {
      // No key management or invalid key index, fall back to provider-level failure
      this.reportFailure(providerId, error, httpCode);
      return;
    }
    
    const keyStatus = keyStatuses[keyIndex];
    const failureType = this.categorizeFailure(error, httpCode);
    
    keyStatus.consecutiveErrors++;
    keyStatus.lastError = error;
    
    logger.info(`Key-level failure reported for ${providerId}[${keyIndex}]`, {
      providerId,
      keyIndex,
      failureType,
      consecutiveErrors: keyStatus.consecutiveErrors,
      error: error.substring(0, 100),
      httpCode
    });
    
    // Apply key-level blacklisting based on failure type
    switch (failureType) {
      case 'rate_limit':
        if (keyStatus.consecutiveErrors >= this.CONSECUTIVE_429_THRESHOLD) {
          this.blacklistProviderKey(providerId, keyIndex, this.RATE_LIMIT_BLACKLIST_DURATION, 'rate_limit');
        }
        break;
        
      case 'auth_failure':
        // Blacklist immediately for auth failures
        this.blacklistProviderKey(providerId, keyIndex, this.AUTH_FAILURE_BLACKLIST_DURATION, 'auth_failure');
        break;
        
      case 'network_error':
        if (keyStatus.consecutiveErrors >= 2) {
          this.blacklistProviderKey(providerId, keyIndex, this.NETWORK_ERROR_BLACKLIST_DURATION, 'network_error');
        }
        break;
        
      case 'server_error':
        if (keyStatus.consecutiveErrors >= 3) {
          this.blacklistProviderKey(providerId, keyIndex, this.SERVER_ERROR_BLACKLIST_DURATION, 'server_error');
        }
        break;
    }
    
    // Check if all keys are blacklisted, then report provider-level failure
    const availableKeys = keyStatuses.filter(status => !status.isBlacklisted);
    if (availableKeys.length === 0) {
      logger.warn(`All keys for provider ${providerId} are blacklisted, reporting provider-level failure`, {
        providerId,
        totalKeys: keyStatuses.length
      });
      // Report provider-level failure to trigger provider-level blacklisting
      this.reportFailure(providerId, `All ${keyStatuses.length} keys blacklisted`, httpCode);
    }
  }

  /**
   * Report key-level success for a specific provider key
   */
  reportKeySuccess(providerId: string, keyIndex: number): void {
    const keyStatuses = this.keyBlacklist.get(providerId);
    if (!keyStatuses || keyIndex >= keyStatuses.length) {
      // No key management or invalid key index, fall back to provider-level success
      this.reportSuccess(providerId);
      return;
    }
    
    const keyStatus = keyStatuses[keyIndex];
    
    // Reset consecutive errors and remove from blacklist if temporarily blacklisted
    keyStatus.consecutiveErrors = 0;
    if (keyStatus.isBlacklisted && keyStatus.blacklistedUntil && new Date() < keyStatus.blacklistedUntil) {
      keyStatus.isBlacklisted = false;
      keyStatus.blacklistedUntil = undefined;
      keyStatus.lastError = undefined;
      
      logger.debug(`Key recovered from blacklist after success: ${providerId}[${keyIndex}]`, {
        providerId,
        keyIndex
      });
    }
    
    // Also report provider-level success
    this.reportSuccess(providerId);
  }

  /**
   * Get key-level status for a provider
   */
  getProviderKeyStatus(providerId: string): ProviderKeyStatus[] | null {
    return this.keyBlacklist.get(providerId) || null;
  }

  // Private key management methods
  
  private blacklistProviderKey(providerId: string, keyIndex: number, durationSeconds: number, reason: string): void {
    const keyStatuses = this.keyBlacklist.get(providerId);
    if (!keyStatuses || keyIndex >= keyStatuses.length) {
      return;
    }
    
    const keyStatus = keyStatuses[keyIndex];
    const blacklistedUntil = new Date(Date.now() + (durationSeconds * 1000));
    
    keyStatus.isBlacklisted = true;
    keyStatus.blacklistedUntil = blacklistedUntil;
    
    logger.warn(`Key blacklisted: ${providerId}[${keyIndex}]`, {
      providerId,
      keyIndex,
      reason,
      durationSeconds,
      blacklistedUntil: blacklistedUntil.toISOString(),
      consecutiveErrors: keyStatus.consecutiveErrors
    });
  }

  private cleanExpiredKeyBlacklists(providerId: string): void {
    const keyStatuses = this.keyBlacklist.get(providerId);
    if (!keyStatuses) {
      return;
    }
    
    const now = new Date();
    let recoveredKeys = 0;
    
    for (const keyStatus of keyStatuses) {
      if (keyStatus.isBlacklisted && keyStatus.blacklistedUntil && now >= keyStatus.blacklistedUntil) {
        keyStatus.isBlacklisted = false;
        keyStatus.blacklistedUntil = undefined;
        keyStatus.lastError = undefined;
        recoveredKeys++;
      }
    }
    
    if (recoveredKeys > 0) {
      logger.info(`${recoveredKeys} keys recovered from blacklist for provider ${providerId}`, {
        providerId,
        recoveredKeys,
        totalKeys: keyStatuses.length
      });
    }
  }
}