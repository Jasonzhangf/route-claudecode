/**
 * Intelligent Routing Engine
 * Routes requests to appropriate providers based on model, content, and configuration
 */

import { BaseRequest, RoutingCategory, CategoryRouting, ProviderHealth, FailoverTrigger, ProviderEntry, LoadBalancingConfig, FailoverConfig } from '@/types';
import { logger } from '@/utils/logger';
import { calculateTokenCount } from '@/utils/tokenizer';
import { responseStatsManager } from '@/utils/response-stats';
import { SimpleProviderManager, WeightedProvider } from './simple-provider-manager';
export class RoutingEngine {
  private providerHealth: Map<string, ProviderHealth> = new Map();
  private simpleProviderManager: SimpleProviderManager;
  
  // 临时禁用的providers - 非持久化存储
  private temporarilyDisabledProviders: Set<string> = new Set();
  
  constructor(private routingConfig: Record<RoutingCategory, CategoryRouting>) {
    // Initialize simple provider manager for round-robin and blacklisting
    this.simpleProviderManager = new SimpleProviderManager();

    logger.info('Routing engine initialized with simplified provider management', {
      categories: Object.keys(routingConfig),
      hasBackup: Object.values(routingConfig).some(config => config.backup && config.backup.length > 0),
      hasMultiProvider: Object.values(routingConfig).some(config => config.providers && config.providers.length > 0)
    });
    
    // Initialize provider health tracking
    this.initializeProviderHealth();
  }

  /**
   * Route a request to the appropriate provider
   */
  async route(request: BaseRequest, requestId: string): Promise<string> {
    try {
      logger.trace(requestId, 'routing', 'Starting request routing', {
        model: request.model,
        messageCount: request.messages.length
      });

      // Step 1: Determine routing category based on request characteristics
      const originalCategory = this.determineCategory(request);
      logger.debug(`Determined routing category: ${originalCategory}`, { requestId }, requestId, 'routing');

      // Step 2: Get provider and model from category configuration with fallback to default
      let categoryRule = this.routingConfig[originalCategory];
      let category = originalCategory;
      
      if (!categoryRule) {
        logger.warn(`No routing configuration found for category: ${originalCategory}, falling back to default`, { 
          requestId, 
          originalCategory, 
          fallbackCategory: 'default' 
        });
        
        // Fallback to default category
        categoryRule = this.routingConfig['default'];
        if (!categoryRule) {
          throw new Error(`No routing configuration found for category: ${originalCategory} and no default configuration available`);
        }
        
        // Update the category to default for downstream processing
        category = 'default' as RoutingCategory;
      }

      // Step 3: Select provider with advanced routing (backup + multi-provider + failover)
      const selectedProvider = await this.selectProviderWithBackup(categoryRule, category, requestId);
      
      // Step 4: Apply model mapping and return provider
      this.applyModelMapping(request, selectedProvider.provider, selectedProvider.model, category);
      
      logger.debug(`Routing ${category} to ${selectedProvider.provider}`, {
        category,
        provider: selectedProvider.provider,
        targetModel: selectedProvider.model,
        originalModel: request.model,
        backupAvailable: categoryRule.backup ? categoryRule.backup.length : 0
      }, requestId, 'routing');

      return selectedProvider.provider;

    } catch (error) {
      logger.error('Error during routing', error, requestId, 'routing');
      throw error;
    }
  }

  /**
   * Select provider with multi-provider and backup support
   */
  private async selectProviderWithBackup(
    categoryRule: CategoryRouting, 
    category: string, 
    requestId: string
  ): Promise<{ provider: string; model: string }> {
    // Check if using new multi-provider format
    if (categoryRule.providers && categoryRule.providers.length > 0) {
      return this.selectFromMultiProvider(categoryRule, category, requestId);
    }
    
    // Fallback to legacy single provider + backup format
    return this.selectFromLegacyBackup(categoryRule, category, requestId);
  }

  /**
   * Select from multi-provider configuration with weighted selection and intelligent blacklisting
   */
  private async selectFromMultiProvider(
    categoryRule: CategoryRouting,
    category: string,
    requestId: string
  ): Promise<{ provider: string; model: string }> {
    const providers = categoryRule.providers!;
    
    logger.debug(`Enhanced weighted multi-provider selection for ${category}`, {
      providerCount: providers.length,
      allProviders: providers.map(p => ({ provider: p.provider, model: p.model, weight: p.weight || 1 }))
    }, requestId, 'routing');

    // Convert to weighted providers (default weight = 1 if not specified)
    const weightedProviders: WeightedProvider[] = providers.map(p => ({
      providerId: p.provider,
      model: p.model,
      weight: p.weight || 1
    }));
    
    // Use enhanced weighted selection with dynamic weight redistribution
    const selectedProvider = this.simpleProviderManager.selectProviderWeighted(weightedProviders, category);
    
    if (!selectedProvider) {
      logger.error('No weighted providers available (all blacklisted)', { 
        category, 
        providers: weightedProviders,
        blacklistStatus: this.simpleProviderManager.getBlacklistStatus()
      }, requestId, 'routing');
      throw new Error(`No providers available for category: ${category}`);
    }
    
    logger.info(`🎯 Weighted provider selected: ${selectedProvider.providerId}`, {
      category,
      selectedProvider: selectedProvider.providerId,
      selectedModel: selectedProvider.model,
      selectedWeight: selectedProvider.weight,
      totalProviders: providers.length,
      selectionMethod: 'weighted-with-redistribution'
    }, requestId, 'routing');

    return {
      provider: selectedProvider.providerId,
      model: selectedProvider.model || selectedProvider.providerId
    };
  }

  /**
   * Select from legacy single provider + backup configuration using weighted selection
   */
  private async selectFromLegacyBackup(
    categoryRule: CategoryRouting,
    category: string,
    requestId: string
  ): Promise<{ provider: string; model: string }> {
    // Build list of providers (primary + backups) with weights
    const providers: Array<{ provider: string; model: string; weight?: number }> = [];
    
    // Add primary provider (weight = 1 by default)
    if (categoryRule.provider && categoryRule.model) {
      providers.push({
        provider: categoryRule.provider,
        model: categoryRule.model,
        weight: 1
      });
    }
    
    // Add backup providers (check if they have weights, default to 1)
    if (categoryRule.backup && categoryRule.backup.length > 0) {
      providers.push(...categoryRule.backup.map(backup => ({
        provider: backup.provider,
        model: backup.model,
        weight: backup.weight || 1
      })));
    }
    
    if (providers.length === 0) {
      throw new Error(`No providers configured for category: ${category}`);
    }

    // Convert to weighted providers for enhanced selection
    const weightedProviders: WeightedProvider[] = providers.map(p => ({
      providerId: p.provider,
      model: p.model,
      weight: p.weight || 1
    }));
    
    // Use weighted selection if multiple providers, otherwise use simple selection
    if (weightedProviders.length > 1) {
      const selectedProvider = this.simpleProviderManager.selectProviderWeighted(weightedProviders, category);
      
      if (selectedProvider) {
        logger.debug(`🎯 Legacy weighted provider selection: ${selectedProvider.providerId}`, {
          category,
          selectedProvider: selectedProvider.providerId,
          selectedModel: selectedProvider.model,
          selectedWeight: selectedProvider.weight,
          totalProviders: providers.length,
          isBackupProvider: selectedProvider.providerId !== categoryRule.provider,
          selectionMethod: 'legacy-weighted'
        }, requestId, 'routing');
        
        return {
          provider: selectedProvider.providerId,
          model: selectedProvider.model || selectedProvider.providerId
        };
      }
    }
    
    // Fallback to simple round-robin for legacy compatibility
    const providerIds = providers.map(p => p.provider);
    let selectedProviderId: string | null = null;
    let selectedModel: string | null = null;
    
    for (let i = 0; i < providerIds.length; i++) {
      const candidateProviderId = this.simpleProviderManager.selectProvider(providerIds, category);
      if (!candidateProviderId) break;
      
      const candidateEntry = providers.find(p => p.provider === candidateProviderId);
      if (candidateEntry) {
        // Check if this provider+model combination is blacklisted
        if (!this.simpleProviderManager.isBlacklisted(candidateProviderId, candidateEntry.model)) {
          selectedProviderId = candidateProviderId;
          selectedModel = candidateEntry.model;
          break;
        }
      }
    }
    
    if (!selectedProviderId || !selectedModel) {
      logger.error('No providers available in legacy config (all blacklisted)', { 
        category, 
        providerIds,
        blacklistStatus: this.simpleProviderManager.getBlacklistStatus()
      }, requestId, 'routing');
      // Fallback to first provider
      return providers[0];
    }
    
    // Find the corresponding provider entry
    const selectedProvider = providers.find(p => p.provider === selectedProviderId);
    if (!selectedProvider) {
      logger.error('Selected provider not found in legacy configuration', {
        selectedProviderId,
        availableProviders: providers.map(p => p.provider)
      }, requestId, 'routing');
      return providers[0];
    }
    
    logger.debug(`Legacy round-robin provider selection: ${selectedProviderId}`, {
      category,
      model: selectedModel,
      totalProviders: providers.length,
      isBackupProvider: selectedProviderId !== categoryRule.provider,
      selectionMethod: 'legacy-round-robin'
    }, requestId, 'routing');
    
    return {
      provider: selectedProviderId,
      model: selectedModel
    };
  }


  /**
   * Get provider success rate for health-based selection
   */
  private getProviderSuccessRate(providerId: string): number {
    const health = this.providerHealth.get(providerId);
    if (!health || health.totalRequests === 0) {
      return 1.0; // Assume 100% for new providers
    }
    
    return health.successCount / health.totalRequests;
  }

  /**
   * Check if provider is healthy using simple provider manager
   * Now supports model-specific blacklisting
   */
  private isProviderHealthy(providerId: string, model?: string): boolean {
    // 🚫 临时禁用检查 - 最高优先级
    if (this.temporarilyDisabledProviders.has(providerId)) {
      logger.debug(`Provider ${providerId} is temporarily disabled via user control`);
      return false;
    }
    
    // Use simple provider manager blacklist check (now supports model-specific)
    if (this.simpleProviderManager.isBlacklisted(providerId, model)) {
      logger.debug(`Provider ${providerId} is blacklisted by simple provider manager`, {
        model: model || 'all-models',
        scope: model ? 'model-specific' : 'provider-wide'
      });
      return false;
    }
    
    // Keep legacy health check for compatibility
    const health = this.providerHealth.get(providerId);
    if (!health) {
      return true; // Assume healthy for new providers
    }
    
    // Simple consecutive errors check
    if (health.consecutiveErrors >= 5) {
      return false;
    }
    
    return health.isHealthy;
  }

  /**
   * Initialize provider health tracking
   */
  private initializeProviderHealth(): void {
    const allProviders = new Set<string>();
    
    // Collect all provider IDs from configuration
    Object.values(this.routingConfig).forEach(config => {
      if (config.provider) {
        allProviders.add(config.provider);
      }
      if (config.backup) {
        config.backup.forEach(backup => allProviders.add(backup.provider));
      }
      if (config.providers) {
        config.providers.forEach(provider => allProviders.add(provider.provider));
      }
    });
    
    // Initialize health tracking for all providers
    allProviders.forEach(providerId => {
      this.providerHealth.set(providerId, {
        providerId,
        isHealthy: true,
        consecutiveErrors: 0,
        errorHistory: [],
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        inCooldown: false,
        // Enhanced intelligent failover fields
        isPermanentlyBlacklisted: false,
        temporaryBackoffLevel: 0,
        authFailureCount: 0,
        networkFailureCount: 0,
        gatewayFailureCount: 0,
        // 429错误临时黑名单支持
        isTemporarilyBlacklisted: false,
        rateLimitFailureCount: 0
      });
    });
    
    logger.info(`Initialized health tracking for ${allProviders.size} providers`, {
      providers: Array.from(allProviders)
    });
  }

  /**
   * Record provider request result for health tracking and statistics with intelligent failover
   */
  public recordProviderResult(providerId: string, success: boolean, error?: string, httpCode?: number, model?: string, responseTimeMs?: number, isStreaming: boolean = false): void {
    let health = this.providerHealth.get(providerId);
    if (!health) {
      // Initialize if not exists
      health = {
        providerId,
        isHealthy: true,
        consecutiveErrors: 0,
        errorHistory: [],
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        inCooldown: false,
        // Enhanced intelligent failover fields
        isPermanentlyBlacklisted: false,
        temporaryBackoffLevel: 0,
        authFailureCount: 0,
        networkFailureCount: 0,
        gatewayFailureCount: 0,
        // 429错误临时黑名单支持
        isTemporarilyBlacklisted: false,
        rateLimitFailureCount: 0
      };
      this.providerHealth.set(providerId, health);
    }
    
    health.totalRequests++;
    
    if (success) {
      health.successCount++;
      health.consecutiveErrors = 0;
      health.isHealthy = true;
      health.lastSuccessTime = new Date();
      health.inCooldown = false;
      
      // Reset temporary backoff on successful request
      if (health.temporaryBackoffLevel > 0) {
        logger.info(`Provider ${providerId} recovered - resetting backoff level`, {
          previousBackoffLevel: health.temporaryBackoffLevel,
          totalRequests: health.totalRequests
        });
        health.temporaryBackoffLevel = 0;
        health.nextRetryTime = undefined;
      }
      
      // Report success to simple provider manager for blacklist recovery
      this.simpleProviderManager.reportSuccess(providerId, model);
      
      // 记录成功响应统计
      if (model) {
        responseStatsManager.recordSuccess(providerId, model, responseTimeMs || 0, isStreaming);
      }
      
      logger.debug(`Provider ${providerId} request succeeded`, {
        totalRequests: health.totalRequests,
        successRate: health.successCount / health.totalRequests,
        model: model || 'unknown',
        responseTime: responseTimeMs ? `${responseTimeMs}ms` : 'unknown'
      });
    } else {
      health.failureCount++;
      health.consecutiveErrors++;
      health.lastFailureTime = new Date();
      
      // 🧠 INTELLIGENT FAILURE CATEGORIZATION
      const failureCategory = this.categorizeFailure(error, httpCode);
      
      // Add to error history
      health.errorHistory.push({
        timestamp: new Date(),
        errorType: failureCategory,
        errorMessage: error || 'No error message provided',
        httpCode
      });
      
      // Keep only last 10 errors
      if (health.errorHistory.length > 10) {
        health.errorHistory = health.errorHistory.slice(-10);
      }
      
      // Report failure to simple provider manager with model-specific blacklisting
      this.simpleProviderManager.reportFailure(providerId, error || 'Unknown error', httpCode, model);
      
      // 🚨 APPLY INTELLIGENT FAILOVER LOGIC
      this.applyIntelligentFailover(health, failureCategory, error, httpCode);
      
      // 记录失败响应统计
      if (model) {
        responseStatsManager.recordFailure(providerId, model, error || 'unknown', isStreaming);
      }
    }
  }

  /**
   * 🧠 Intelligent failure categorization
   */
  private categorizeFailure(error?: string, httpCode?: number): string {
    const errorLower = (error || '').toLowerCase();
    
    // Rate limit failures (temporary blacklist candidates)
    if (httpCode === 429) return 'rate_limit';
    if (errorLower.includes('rate limit') || errorLower.includes('quota') || errorLower.includes('exhausted')) return 'rate_limit';
    if (errorLower.includes('too many requests')) return 'rate_limit';
    
    // Authentication failures (permanent blacklist candidates)
    if (httpCode === 401 || httpCode === 403) return 'authentication';
    if (errorLower.includes('unauthorized') || errorLower.includes('forbidden')) return 'authentication';
    if (errorLower.includes('token') && (errorLower.includes('invalid') || errorLower.includes('expired'))) return 'authentication';
    if (errorLower.includes('authentication') || errorLower.includes('auth')) return 'authentication';
    
    // Network failures (temporary backoff candidates)
    if (errorLower.includes('network') || errorLower.includes('connection')) return 'network';
    if (errorLower.includes('timeout') || errorLower.includes('etimedout')) return 'network';
    if (errorLower.includes('econnreset') || errorLower.includes('enotfound')) return 'network';
    if (errorLower.includes('dns') || errorLower.includes('resolve')) return 'network';
    
    // Gateway failures (temporary backoff candidates)
    if (httpCode === 502 || httpCode === 503 || httpCode === 504) return 'gateway';
    if (errorLower.includes('gateway') || errorLower.includes('proxy')) return 'gateway';
    if (errorLower.includes('upstream') || errorLower.includes('bad gateway')) return 'gateway';
    
    // Other failures
    if (httpCode && httpCode >= 500) return 'server_error';
    if (httpCode && httpCode >= 400) return 'client_error';
    
    return 'unknown';
  }

  /**
   * 🚨 Apply intelligent failover logic based on failure type
   */
  private applyIntelligentFailover(health: ProviderHealth, failureCategory: string, error?: string, httpCode?: number): void {
    const now = new Date();
    
    switch (failureCategory) {
      case 'authentication':
        health.authFailureCount++;
        health.lastAuthFailure = now;
        
        // 🔒 PERMANENT BLACKLISTING for authentication failures
        if (health.authFailureCount >= 3) {
          health.isPermanentlyBlacklisted = true;
          health.blacklistReason = `Authentication failures: ${health.authFailureCount} consecutive failures. Last error: ${error}`;
          health.isHealthy = false;
          
          logger.error(`🔒 Provider ${health.providerId} PERMANENTLY BLACKLISTED due to authentication failures`, {
            authFailureCount: health.authFailureCount,
            lastError: error,
            httpCode,
            blacklistReason: health.blacklistReason
          });
        } else {
          logger.warn(`⚠️ Authentication failure ${health.authFailureCount}/3 for provider ${health.providerId}`, {
            error, httpCode, remainingAttempts: 3 - health.authFailureCount
          });
        }
        break;
        
      case 'rate_limit':
        health.rateLimitFailureCount++;
        health.lastRateLimitFailure = now;
        
        // 🚫 TEMPORARY BLACKLISTING for 429 rate limit errors
        // 根据配置中的blacklistDuration设置临时拉黑时长（默认5分钟）
        const blacklistDurationSeconds = 300; // 5 minutes
        health.isTemporarilyBlacklisted = true;
        health.temporaryBlacklistUntil = new Date(now.getTime() + (blacklistDurationSeconds * 1000));
        health.isHealthy = false;
        
        logger.warn(`🚫 Provider ${health.providerId} TEMPORARILY BLACKLISTED for rate limit (429)`, {
          rateLimitFailures: health.rateLimitFailureCount,
          blacklistDurationSeconds,
          blacklistUntil: health.temporaryBlacklistUntil.toISOString(),
          error, httpCode
        });
        break;
        
      case 'network':
      case 'gateway':
        // Update failure counters
        if (failureCategory === 'network') {
          health.networkFailureCount++;
          health.lastNetworkFailure = now;
        } else {
          health.gatewayFailureCount++;
          health.lastGatewayFailure = now;
        }
        
        // 📈 PROGRESSIVE TEMPORARY BACKOFF for network/gateway issues
        const failureCount = failureCategory === 'network' ? health.networkFailureCount : health.gatewayFailureCount;
        
        if (failureCount >= 3) {
          // Escalate backoff level (max level 3)
          health.temporaryBackoffLevel = Math.min(health.temporaryBackoffLevel + 1, 3);
          
          // Calculate backoff duration: 1min → 5min → 10min
          const backoffMinutes = health.temporaryBackoffLevel === 1 ? 1 : 
                                 health.temporaryBackoffLevel === 2 ? 5 : 10;
          
          health.nextRetryTime = new Date(now.getTime() + (backoffMinutes * 60 * 1000));
          health.isHealthy = false;
          health.inCooldown = true;
          health.cooldownUntil = health.nextRetryTime;
          
          logger.warn(`📈 Provider ${health.providerId} entering backoff level ${health.temporaryBackoffLevel}`, {
            failureCategory,
            failureCount,
            backoffMinutes,
            nextRetryTime: health.nextRetryTime.toISOString(),
            error, httpCode
          });
        }
        break;
        
      default:
        // Standard failover logic for other errors
        if (health.consecutiveErrors >= 5) {
          health.isHealthy = false;
          health.inCooldown = true;
          health.cooldownUntil = new Date(now.getTime() + 60000); // 1 minute cooldown
          
          logger.warn(`Provider ${health.providerId} marked unhealthy after ${health.consecutiveErrors} consecutive errors`, {
            errorType: failureCategory,
            error, httpCode,
            cooldownUntil: health.cooldownUntil
          });
        }
        break;
    }
  }

  /**
   * Mark provider as healthy or unhealthy (legacy method)
   */
  public setProviderHealth(providerId: string, healthy: boolean): void {
    let health = this.providerHealth.get(providerId);
    if (!health) {
      health = {
        providerId,
        isHealthy: healthy,
        consecutiveErrors: 0,
        errorHistory: [],
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        inCooldown: false,
        // Enhanced intelligent failover support - 添加缺失的属性
        isPermanentlyBlacklisted: false,
        temporaryBackoffLevel: 0,
        authFailureCount: 0,
        networkFailureCount: 0,
        gatewayFailureCount: 0,
        // 429错误临时黑名单支持
        isTemporarilyBlacklisted: false,
        rateLimitFailureCount: 0
      };
      this.providerHealth.set(providerId, health);
    } else {
      health.isHealthy = healthy;
      if (healthy) {
        health.consecutiveErrors = 0;
        health.inCooldown = false;
      }
    }
    
    logger.info(`Provider health manually updated: ${providerId} = ${healthy ? 'healthy' : 'unhealthy'}`);
  }

  /**
   * Get provider health status
   */
  public getProviderHealth(providerId: string): ProviderHealth | undefined {
    return this.providerHealth.get(providerId);
  }

  /**
   * Get all provider health statuses
   */
  public getAllProviderHealth(): Record<string, ProviderHealth> {
    const result: Record<string, ProviderHealth> = {};
    this.providerHealth.forEach((health, providerId) => {
      result[providerId] = health;
    });
    return result;
  }

  /**
   * Apply failover filtering based on error conditions
   */
  private applyFailoverFiltering(
    providers: ProviderEntry[],
    failoverConfig: FailoverConfig,
    requestId: string
  ): ProviderEntry[] {
    const availableProviders: ProviderEntry[] = [];
    
    for (const provider of providers) {
      const health = this.providerHealth.get(provider.provider);
      let shouldExclude = false;
      
      if (health && failoverConfig.triggers.length > 0) {
        for (const trigger of failoverConfig.triggers) {
          if (this.shouldTriggerFailover(health, trigger)) {
            logger.warn(`Provider ${provider.provider} excluded by failover trigger`, {
              triggerType: trigger.type,
              threshold: trigger.threshold,
              consecutiveErrors: health.consecutiveErrors,
              errorHistory: health.errorHistory.slice(-3) // Last 3 errors
            }, requestId, 'routing');
            
            shouldExclude = true;
            break;
          }
        }
      }
      
      if (!shouldExclude) {
        availableProviders.push(provider);
      }
    }
    
    logger.debug(`Failover filtering applied`, {
      originalCount: providers.length,
      availableCount: availableProviders.length,
      excludedProviders: providers.filter(p => 
        !availableProviders.some(ap => ap.provider === p.provider)
      ).map(p => p.provider)
    }, requestId, 'routing');
    
    return availableProviders.length > 0 ? availableProviders : providers; // Never exclude all providers
  }

  /**
   * Check if failover should be triggered for a provider
   */
  private shouldTriggerFailover(health: ProviderHealth, trigger: FailoverTrigger): boolean {
    switch (trigger.type) {
      case 'consecutive_errors':
        return health.consecutiveErrors >= trigger.threshold;
        
      case 'http_error':
        if (trigger.httpCodes && trigger.httpCodes.length > 0) {
          // Count recent errors with specific HTTP codes
          const recentErrors = this.getRecentErrors(health, trigger.timeWindow || 300); // 5 minutes default
          const httpErrorCount = recentErrors.filter(error => 
            error.httpCode && trigger.httpCodes!.includes(error.httpCode)
          ).length;
          return httpErrorCount >= trigger.threshold;
        }
        return false;
        
      case 'network_timeout':
        // Count network timeout errors in recent time window
        const recentErrors = this.getRecentErrors(health, trigger.timeWindow || 300);
        const timeoutCount = recentErrors.filter(error => 
          error.errorType.toLowerCase().includes('timeout') ||
          error.errorType.toLowerCase().includes('network')
        ).length;
        return timeoutCount >= trigger.threshold;
        
      case 'auth_failed':
        // Count authentication failures in recent time window
        const recentAuthErrors = this.getRecentErrors(health, trigger.timeWindow || 300);
        const authErrorCount = recentAuthErrors.filter(error => 
          error.errorType.toLowerCase().includes('auth') ||
          error.errorType.toLowerCase().includes('unauthorized') ||
          (error.httpCode && [401, 403].includes(error.httpCode))
        ).length;
        return authErrorCount >= trigger.threshold;
        
      default:
        logger.warn(`Unknown failover trigger type: ${trigger.type}`);
        return false;
    }
  }

  /**
   * Get recent errors within specified time window (seconds)
   */
  private getRecentErrors(health: ProviderHealth, timeWindowSeconds: number): ProviderHealth['errorHistory'] {
    const cutoffTime = new Date(Date.now() - (timeWindowSeconds * 1000));
    return health.errorHistory.filter(error => error.timestamp >= cutoffTime);
  }

  /**
   * Check if provider should be failed over based on error conditions
   */
  public shouldFailoverProvider(providerId: string, errorType: string, httpCode?: number): boolean {
    const health = this.providerHealth.get(providerId);
    if (!health) {
      return false;
    }
    
    // Get failover configs from all categories that use this provider
    const failoverConfigs: FailoverConfig[] = [];
    Object.values(this.routingConfig).forEach(config => {
      if (config.failover && config.failover.enabled) {
        // Check if this provider is used in this category
        const usesProvider = 
          config.provider === providerId ||
          (config.backup && config.backup.some(b => b.provider === providerId)) ||
          (config.providers && config.providers.some(p => p.provider === providerId));
          
        if (usesProvider) {
          failoverConfigs.push(config.failover);
        }
      }
    });
    
    // Check if any failover config would trigger
    for (const failoverConfig of failoverConfigs) {
      for (const trigger of failoverConfig.triggers) {
        if (this.shouldTriggerFailover(health!, trigger)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Determine the routing category based on request characteristics
   */
  private determineCategory(request: BaseRequest): RoutingCategory {
    // Check for background models (haiku models for lightweight tasks)
    if (request.model.includes('haiku')) {
      return 'background';
    }

    // Check for explicit thinking mode
    if (request.metadata?.thinking) {
      return 'thinking';
    }

    // Check for long context based on token count
    const tokenCount = this.calculateRequestTokens(request);
    if (tokenCount > 45000) {
      return 'longcontext';
    }

    // Check for search tools
    if (request.metadata?.tools && Array.isArray(request.metadata.tools)) {
      const hasSearchTools = request.metadata.tools.some((tool: any) => 
        typeof tool === 'object' && tool.name && (
          tool.name.toLowerCase().includes('search') ||
          tool.name.toLowerCase().includes('web') ||
          tool.name === 'WebSearch'
        )
      );
      
      if (hasSearchTools) {
        return 'search';
      }
    }

    // Default category for all other cases
    return 'default';
  }

  /**
   * Apply model mapping based on routing configuration
   */
  private applyModelMapping(request: BaseRequest, providerId: string, targetModel: string, category: RoutingCategory): void {
    // Initialize metadata if not present
    if (!request.metadata) {
      request.metadata = { requestId: 'routing-generated' };
    }
    
    // Store original model for reference
    request.metadata.originalModel = request.model;
    request.metadata.targetProvider = providerId;
    request.metadata.routingCategory = category;
    
    // CRITICAL: Replace the model name directly in the request
    // This ensures all downstream processing uses the correct target model
    const originalModel = request.model;
    request.model = targetModel;
    
    logger.info(`Model routing applied: ${originalModel} -> ${targetModel}`, {
      category,
      providerId,
      originalModel,
      targetModel: targetModel,
      transformation: `${originalModel} -> ${targetModel} via ${providerId}`
    });
  }

  /**
   * Calculate approximate token count for routing decisions
   */
  private calculateRequestTokens(request: BaseRequest): number {
    try {
      return calculateTokenCount(
        request.messages,
        request.metadata?.system,
        request.metadata?.tools
      );
    } catch (error) {
      logger.warn('Failed to calculate token count, using message length estimation', error);
      
      // Fallback: rough estimation based on character count
      let totalChars = 0;
      request.messages.forEach(msg => {
        if (typeof msg.content === 'string') {
          totalChars += msg.content.length;
        } else if (Array.isArray(msg.content)) {
          msg.content.forEach((block: any) => {
            if (block.text) totalChars += block.text.length;
          });
        }
      });
      
      // Rough conversion: ~4 characters per token
      return Math.ceil(totalChars / 4);
    }
  }

  /**
   * Update routing configuration
   */
  updateConfig(routingConfig: Record<RoutingCategory, CategoryRouting>) {
    this.routingConfig = routingConfig;
    logger.info('Routing configuration updated', {
      categories: Object.keys(routingConfig)
    });
  }

  /**
   * Get current routing configuration summary
   */
  getConfigSummary() {
    const summary: Record<string, any> = {};
    
    for (const [category, config] of Object.entries(this.routingConfig)) {
      summary[category] = {
        provider: config.provider,
        model: config.model
      };
    }
    
    return {
      categories: Object.keys(this.routingConfig),
      routing: summary
    };
  }

  /**
   * Get routing engine statistics (for compatibility)
   */
  getStats() {
    return {
      categories: Object.keys(this.routingConfig),
      routing: this.routingConfig,
      providerHealth: this.getAllProviderHealth(),
      roundRobinState: this.getRoundRobinState()
    };
  }

  /**
   * Get current round robin state from simple provider manager
   */
  private getRoundRobinState(): Record<string, number> {
    return this.simpleProviderManager.getRoundRobinState();
  }

  /**
   * Reset provider health (for testing or recovery)
   */
  public resetProviderHealth(providerId?: string): void {
    if (providerId) {
      const health = this.providerHealth.get(providerId);
      if (health) {
        health.isHealthy = true;
        health.consecutiveErrors = 0;
        health.errorHistory = [];
        health.inCooldown = false;
        health.cooldownUntil = undefined;
        
        logger.info(`Provider health reset: ${providerId}`);
      }
    } else {
      // Reset all providers
      this.providerHealth.forEach((health) => {
        health.isHealthy = true;
        health.consecutiveErrors = 0;
        health.errorHistory = [];
        health.inCooldown = false;
        health.cooldownUntil = undefined;
      });
      
      logger.info('All provider health reset');
    }
  }

  // ==================== 并发控制方法 ====================

  // 🔥 移除了所有并发控制方法 - HTTP天然隔离，无需进程锁

  /**
   * 获取响应统计数据
   */
  public getResponseStats(): any {
    return responseStatsManager.getAllStats();
  }

  /**
   * 获取统计汇总
   */
  public getStatsSummary(): any {
    return responseStatsManager.getSummaryStats();
  }

  /**
   * 强制输出统计日志
   */
  public logCurrentStats(): void {
    responseStatsManager.logSummaryStats();
  }

  /**
   * 重置统计数据
   */
  public resetStats(): void {
    responseStatsManager.reset();
  }

  /**
   * 临时禁用provider（非持久化）
   */
  public temporarilyDisableProvider(providerId: string): boolean {
    if (!this.providerHealth.has(providerId)) {
      logger.warn(`Cannot disable unknown provider: ${providerId}`);
      return false;
    }
    
    this.temporarilyDisabledProviders.add(providerId);
    logger.info(`Provider ${providerId} temporarily disabled via user control`);
    return true;
  }

  /**
   * 临时启用provider（非持久化）
   */
  public temporarilyEnableProvider(providerId: string): boolean {
    if (!this.providerHealth.has(providerId)) {
      logger.warn(`Cannot enable unknown provider: ${providerId}`);
      return false;
    }
    
    const wasDisabled = this.temporarilyDisabledProviders.delete(providerId);
    if (wasDisabled) {
      logger.info(`Provider ${providerId} temporarily enabled via user control`);
    }
    return wasDisabled;
  }

  /**
   * 检查provider是否被临时禁用
   */
  public isProviderTemporarilyDisabled(providerId: string): boolean {
    return this.temporarilyDisabledProviders.has(providerId);
  }

  /**
   * 获取所有临时禁用的providers
   */
  public getTemporarilyDisabledProviders(): string[] {
    return Array.from(this.temporarilyDisabledProviders);
  }

  /**
   * 清除所有临时禁用状态（重启时自动调用）
   */
  public clearTemporaryDisables(): void {
    this.temporarilyDisabledProviders.clear();
    this.simpleProviderManager.clearAllBlacklists();
    logger.info('All temporary provider disables and blacklists cleared');
  }
  
  /**
   * Get blacklist status from simple provider manager
   */
  public getBlacklistStatus(): any {
    return this.simpleProviderManager.getBlacklistStatus();
  }
}