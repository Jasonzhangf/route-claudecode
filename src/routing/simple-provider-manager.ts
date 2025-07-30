/**
 * Simple Provider Manager with Round-Robin and Failover
 * Replaces complex concurrency management with simple blacklisting
 * Task 1 Implementation: Multi-provider round-robin with failure-based blacklisting
 */

import { logger } from '@/utils/logger';

export interface SimpleProviderBlacklist {
  providerId: string;
  blacklistedUntil: Date;
  reason: 'rate_limit' | 'auth_failure' | 'network_error' | 'server_error';
  errorCount: number;
}

export class SimpleProviderManager {
  private roundRobinIndex: Map<string, number> = new Map();
  private blacklist: Map<string, SimpleProviderBlacklist> = new Map();
  
  // Blacklist durations in seconds
  private readonly RATE_LIMIT_BLACKLIST_DURATION = 60; // 1 minute for 429 errors
  private readonly AUTH_FAILURE_BLACKLIST_DURATION = 300; // 5 minutes for auth failures
  private readonly NETWORK_ERROR_BLACKLIST_DURATION = 120; // 2 minutes for network errors
  private readonly SERVER_ERROR_BLACKLIST_DURATION = 180; // 3 minutes for server errors
  
  constructor() {
    logger.info('SimpleProviderManager initialized with round-robin and blacklisting');
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
   */
  reportFailure(providerId: string, error: string, httpCode?: number): void {
    const failureType = this.categorizeFailure(error, httpCode);
    const existing = this.blacklist.get(providerId);
    
    logger.info('Provider failure reported', {
      providerId,
      failureType,
      error: error.substring(0, 100), // Truncate long errors
      httpCode,
      existingErrorCount: existing?.errorCount || 0
    });
    
    switch (failureType) {
      case 'rate_limit':
        this.blacklistProvider(providerId, failureType, this.RATE_LIMIT_BLACKLIST_DURATION);
        break;
        
      case 'auth_failure':
        const authErrorCount = (existing?.errorCount || 0) + 1;
        if (authErrorCount >= 3) {
          // Permanent-like blacklisting for repeated auth failures (very long duration)
          this.blacklistProvider(providerId, failureType, 3600); // 1 hour
        } else {
          this.blacklistProvider(providerId, failureType, this.AUTH_FAILURE_BLACKLIST_DURATION);
        }
        break;
        
      case 'network_error':
        this.blacklistProvider(providerId, failureType, this.NETWORK_ERROR_BLACKLIST_DURATION);
        break;
        
      case 'server_error':
        this.blacklistProvider(providerId, failureType, this.SERVER_ERROR_BLACKLIST_DURATION);
        break;
        
      default:
        // Don't blacklist for unknown errors, just log
        logger.debug('Unknown error type, not blacklisting', { providerId, error, httpCode });
        break;
    }
  }

  /**
   * Report provider success (removes from blacklist if temporary)
   */
  reportSuccess(providerId: string): void {
    const blacklisted = this.blacklist.get(providerId);
    if (blacklisted && blacklisted.reason !== 'auth_failure') {
      // Remove from blacklist on success (except for auth failures which need time-based recovery)
      this.blacklist.delete(providerId);
      logger.info('Provider recovered from blacklist after success', { providerId });
    }
  }

  /**
   * Check if provider is currently blacklisted
   */
  isBlacklisted(providerId: string): boolean {
    const blacklisted = this.blacklist.get(providerId);
    if (!blacklisted) {
      return false;
    }
    
    const now = new Date();
    if (now >= blacklisted.blacklistedUntil) {
      // Blacklist expired, remove it
      this.blacklist.delete(providerId);
      logger.info('Provider blacklist expired', { 
        providerId, 
        reason: blacklisted.reason,
        duration: Math.round((now.getTime() - (blacklisted.blacklistedUntil.getTime() - this.getBlacklistDuration(blacklisted.reason) * 1000)) / 1000)
      });
      return false;
    }
    
    return true;
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

  private blacklistProvider(providerId: string, reason: SimpleProviderBlacklist['reason'], durationSeconds: number): void {
    const now = new Date();
    const blacklistedUntil = new Date(now.getTime() + (durationSeconds * 1000));
    
    const existing = this.blacklist.get(providerId);
    const errorCount = (existing?.errorCount || 0) + 1;
    
    this.blacklist.set(providerId, {
      providerId,
      blacklistedUntil,
      reason,
      errorCount
    });
    
    logger.warn('Provider blacklisted', {
      providerId,
      reason,
      durationSeconds,
      blacklistedUntil: blacklistedUntil.toISOString(),
      errorCount,
      isRecurring: !!existing
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