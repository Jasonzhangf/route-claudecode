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
}

export class SimpleProviderManager {
  private roundRobinIndex: Map<string, number> = new Map();
  private blacklist: Map<string, SimpleProviderBlacklist> = new Map(); // Key format: 'providerId' or 'providerId:model'
  
  // Blacklist durations in seconds
  private readonly RATE_LIMIT_BLACKLIST_DURATION = 60; // 1 minute for 429 errors
  private readonly AUTH_FAILURE_BLACKLIST_DURATION = 300; // 5 minutes for auth failures
  private readonly NETWORK_ERROR_BLACKLIST_DURATION = 120; // 2 minutes for network errors
  private readonly SERVER_ERROR_BLACKLIST_DURATION = 180; // 3 minutes for server errors
  
  constructor() {
    // 🔧 启动时清空所有黑名单，防止重启后仍被拉黑
    this.blacklist.clear();
    logger.info('SimpleProviderManager initialized with round-robin and blacklisting', {
      blacklistCleared: true,
      startupTime: new Date().toISOString()
    });
  }

  /**
   * Select next provider using round-robin with blacklist filtering
   */
  selectProvider(providers: string[], category: string): string | null {
    // Filter out blacklisted providers
    const availableProviders = providers.filter(providerId => 
      !this.isBlacklisted(providerId)
    );
    
    if (availableProviders.length === 0) {
      logger.warn('All providers are blacklisted, using first provider anyway', {
        category,
        totalProviders: providers.length,
        blacklistedProviders: providers.filter(p => this.isBlacklisted(p))
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
      selectedProvider,
      availableProviders: availableProviders.length,
      totalProviders: providers.length,
      roundRobinIndex: currentIndex
    });
    
    return selectedProvider;
  }

  /**
   * Report provider failure and apply blacklisting if needed
   * Now supports model-specific blacklisting when model is provided
   */
  reportFailure(providerId: string, error: string, httpCode?: number, model?: string): void {
    const failureType = this.categorizeFailure(error, httpCode);
    // Create composite key for model-specific blacklisting when model is provided
    const blacklistKey = model ? `${providerId}:${model}` : providerId;
    const existing = this.blacklist.get(blacklistKey);
    
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
        this.blacklistProvider(blacklistKey, providerId, failureType, this.RATE_LIMIT_BLACKLIST_DURATION, model);
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
   * Now supports model-specific recovery
   */
  reportSuccess(providerId: string, model?: string): void {
    // Check both model-specific and provider-wide blacklists
    const keys = model ? [`${providerId}:${model}`, providerId] : [providerId];
    
    for (const key of keys) {
      const blacklisted = this.blacklist.get(key);
      if (blacklisted && blacklisted.reason !== 'auth_failure') {
        // Remove from blacklist on success (except for auth failures which need time-based recovery)
        this.blacklist.delete(key);
        logger.info('Provider recovered from blacklist after success', { 
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

  private blacklistProvider(blacklistKey: string, providerId: string, reason: SimpleProviderBlacklist['reason'], durationSeconds: number, model?: string): void {
    const now = new Date();
    const blacklistedUntil = new Date(now.getTime() + (durationSeconds * 1000));
    
    const existing = this.blacklist.get(blacklistKey);
    const errorCount = (existing?.errorCount || 0) + 1;
    
    this.blacklist.set(blacklistKey, {
      providerId,
      model,
      blacklistedUntil,
      reason,
      errorCount
    });
    
    logger.warn('Provider blacklisted', {
      providerId,
      model: model || 'all-models',
      reason,
      durationSeconds,
      blacklistedUntil: blacklistedUntil.toISOString(),
      errorCount,
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
}