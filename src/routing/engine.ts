/**
 * Intelligent Routing Engine
 * Routes requests to appropriate providers based on model, content, and configuration
 */

import { BaseRequest, RoutingCategory, CategoryRouting, ProviderHealth, FailoverTrigger, ProviderEntry, LoadBalancingConfig, FailoverConfig } from '@/types';
import { ConcurrentLoadBalancingConfig } from '@/types/concurrency';
import { logger } from '@/utils/logger';
import { calculateTokenCount } from '@/utils/tokenizer';
import { responseStatsManager } from '@/utils/response-stats';
export class RoutingEngine {
  private providerHealth: Map<string, ProviderHealth> = new Map();
  private roundRobinIndex: Map<string, number> = new Map();
  
  constructor(private routingConfig: Record<RoutingCategory, CategoryRouting>, concurrencyConfig?: ConcurrentLoadBalancingConfig) {
    // 🚀 移除并发管理 - HTTP本身就是天然隔离的

    logger.info('Routing engine initialized with category-based configuration', {
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
      const category = this.determineCategory(request);
      logger.debug(`Determined routing category: ${category}`, { requestId }, requestId, 'routing');

      // Step 2: Get provider and model from category configuration
      const categoryRule = this.routingConfig[category];
      if (!categoryRule) {
        throw new Error(`No routing configuration found for category: ${category}`);
      }

      // Step 3: Select provider with advanced routing (backup + multi-provider + failover)
      const selectedProvider = await this.selectProviderWithBackup(categoryRule, category, requestId);
      
      // Step 4: Apply model mapping and return provider
      this.applyModelMapping(request, selectedProvider.provider, selectedProvider.model, category);
      
      logger.info(`Routing ${category} to ${selectedProvider.provider}`, {
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
   * Select from multi-provider configuration with concurrent load balancing
   */
  private async selectFromMultiProvider(
    categoryRule: CategoryRouting,
    category: string,
    requestId: string
  ): Promise<{ provider: string; model: string }> {
    const providers = categoryRule.providers!;
    const loadBalancingConfig = categoryRule.loadBalancing || { enabled: false, strategy: 'round_robin' };
    const failoverConfig = categoryRule.failover || { enabled: false, triggers: [], cooldown: 60 };
    
    logger.debug(`Multi-provider selection for ${category}`, {
      providerCount: providers.length,
      loadBalancing: loadBalancingConfig.enabled,
      strategy: loadBalancingConfig.strategy,
      failoverEnabled: failoverConfig.enabled
    }, requestId, 'routing');

    // Apply error priority fallback if failover is enabled
    let availableProviders = providers;
    if (failoverConfig.enabled) {
      availableProviders = this.applyFailoverFiltering(providers, failoverConfig, requestId);
    }

    // Filter healthy providers
    const healthyProviders = availableProviders.filter(p => this.isProviderHealthy(p.provider));
    
    if (healthyProviders.length === 0) {
      logger.error('No healthy providers available in multi-provider config', {
        category,
        totalProviders: providers.length,
        availableAfterFailover: availableProviders.length,
        allProviders: providers.map(p => p.provider)
      }, requestId, 'routing');
      
      // Last resort: use first provider despite health status
      return {
        provider: providers[0].provider,
        model: providers[0].model
      };
    }

    // 🚀 简化: 直接使用负载均衡，无需并发控制

    // Apply load balancing strategy
    let selectedProvider: ProviderEntry;
    
    if (!loadBalancingConfig.enabled) {
      // No load balancing: select first healthy provider by weight
      const sortedHealthy = healthyProviders.sort((a, b) => (a.weight || 1) - (b.weight || 1));
      selectedProvider = sortedHealthy[0];
      logger.debug(`Selected first healthy provider: ${selectedProvider.provider}`, {
        weight: selectedProvider.weight || 1
      }, requestId, 'routing');
    } else {
      selectedProvider = this.applyLoadBalancingStrategy(
        healthyProviders, 
        loadBalancingConfig.strategy, 
        category, 
        requestId
      );
    }

    return {
      provider: selectedProvider.provider,
      model: selectedProvider.model
    };
  }

  /**
   * Select from legacy single provider + backup configuration
   */
  private async selectFromLegacyBackup(
    categoryRule: CategoryRouting,
    category: string,
    requestId: string
  ): Promise<{ provider: string; model: string }> {
    // Check if primary provider is healthy
    const primaryHealthy = this.isProviderHealthy(categoryRule.provider!);
    
    if (primaryHealthy) {
      logger.debug(`Using primary provider: ${categoryRule.provider}`, {}, requestId, 'routing');
      return {
        provider: categoryRule.provider!,
        model: categoryRule.model!
      };
    }

    // Primary failed, try backup providers
    if (categoryRule.backup && categoryRule.backup.length > 0) {
      logger.warn(`Primary provider ${categoryRule.provider} unhealthy, trying backup providers`, {
        backupCount: categoryRule.backup.length
      }, requestId, 'routing');

      // Sort backup providers by weight (lower weight = higher priority)
      const sortedBackups = [...categoryRule.backup].sort((a, b) => (a.weight || 1) - (b.weight || 1));
      
      for (const backup of sortedBackups) {
        if (this.isProviderHealthy(backup.provider)) {
          logger.info(`Using backup provider: ${backup.provider}`, {
            weight: backup.weight || 1
          }, requestId, 'routing');
          
          return {
            provider: backup.provider,
            model: backup.model
          };
        }
      }
      
      logger.error('All backup providers are unhealthy, falling back to primary', {
        category,
        primaryProvider: categoryRule.provider,
        backupProviders: sortedBackups.map(b => b.provider)
      }, requestId, 'routing');
    }

    // If no backup or all backups failed, use primary anyway
    logger.warn(`No healthy backup found for ${category}, using primary provider anyway`, {}, requestId, 'routing');
    return {
      provider: categoryRule.provider!,
      model: categoryRule.model!
    };
  }

  /**
   * Apply load balancing strategy to select provider
   */
  private applyLoadBalancingStrategy(
    providers: ProviderEntry[],
    strategy: 'round_robin' | 'weighted' | 'health_based' | 'health_based_with_blacklist',
    category: string,
    requestId: string
  ): ProviderEntry {
    switch (strategy) {
      case 'round_robin':
        return this.selectRoundRobin(providers, category, requestId);
      case 'weighted':
        return this.selectWeighted(providers, requestId);
      case 'health_based':
        return this.selectHealthBased(providers, requestId);
      case 'health_based_with_blacklist':
        return this.selectHealthBasedWithBlacklist(providers, requestId);
      default:
        logger.warn(`Unknown load balancing strategy: ${strategy}, using round_robin`, {}, requestId, 'routing');
        return this.selectRoundRobin(providers, category, requestId);
    }
  }

  /**
   * Round robin selection
   */
  private selectRoundRobin(providers: ProviderEntry[], category: string, requestId: string): ProviderEntry {
    const currentIndex = this.roundRobinIndex.get(category) || 0;
    const selectedProvider = providers[currentIndex % providers.length];
    
    this.roundRobinIndex.set(category, currentIndex + 1);
    
    logger.debug(`Round robin selection: ${selectedProvider.provider}`, {
      index: currentIndex,
      totalProviders: providers.length
    }, requestId, 'routing');
    
    return selectedProvider;
  }

  /**
   * Weighted selection based on provider weights (真正的权重随机选择)
   */
  private selectWeighted(providers: ProviderEntry[], requestId: string): ProviderEntry {
    // 计算总权重
    const totalWeight = providers.reduce((sum, provider) => sum + (provider.weight || 1), 0);
    
    // 生成随机数 [0, totalWeight)
    const random = Math.random() * totalWeight;
    
    // 按权重累积选择
    let currentWeight = 0;
    for (const provider of providers) {
      currentWeight += (provider.weight || 1);
      if (random < currentWeight) {
        logger.debug(`Weighted selection: ${provider.provider}`, {
          weight: provider.weight || 1,
          totalWeight,
          randomValue: random.toFixed(3),
          selectionProbability: `${(((provider.weight || 1) / totalWeight) * 100).toFixed(1)}%`
        }, requestId, 'routing');
        
        return provider;
      }
    }
    
    // 降级：如果由于浮点精度问题没选中，返回最后一个
    const fallbackProvider = providers[providers.length - 1];
    logger.warn(`Weighted selection fallback: ${fallbackProvider.provider}`, {
      reason: 'floating_point_precision_issue',
      totalWeight,
      randomValue: random
    }, requestId, 'routing');
    
    return fallbackProvider;
  }

  /**
   * Health-based selection (best performing provider)
   */
  private selectHealthBased(providers: ProviderEntry[], requestId: string): ProviderEntry {
    // 计算每个provider的健康分数
    const scoredProviders = providers.map(provider => {
      const health = this.providerHealth.get(provider.provider);
      let score = 1.0; // 默认健康分数
      
      if (health) {
        // 基于成功率计算分数
        const successRate = health.totalRequests > 0 
          ? health.successCount / health.totalRequests 
          : 1.0;
        
        // 考虑连续错误数的影响 
        const errorPenalty = Math.max(0, health.consecutiveErrors) * 0.1;
        
        // 考虑冷却状态
        const cooldownPenalty = health.inCooldown ? 0.5 : 0;
        
        score = successRate - errorPenalty - cooldownPenalty;
      }
      
      return {
        provider,
        score: Math.max(0.1, score) // 确保分数不为负
      };
    });
    
    // 按健康分数排序，分数高的优先
    const sortedByHealth = scoredProviders.sort((a, b) => b.score - a.score);
    const selectedProvider = sortedByHealth[0].provider;
    
    logger.debug(`Health-based selection: ${selectedProvider.provider}`, {
      score: sortedByHealth[0].score.toFixed(3),
      allScores: scoredProviders.map(sp => ({
        provider: sp.provider.provider,
        score: sp.score.toFixed(3)
      }))
    }, requestId, 'routing');
    
    return selectedProvider;
  }

  /**
   * Health-based selection with blacklist awareness and dynamic load balancing
   * 智能黑名单感知的健康负载均衡选择
   */
  private selectHealthBasedWithBlacklist(providers: ProviderEntry[], requestId: string): ProviderEntry {
    // 获取所有可用（未被拉黑）的providers
    const availableProviders = providers.filter(provider => this.isProviderHealthy(provider.provider));
    
    if (availableProviders.length === 0) {
      // 所有provider都被拉黑，选择最先恢复的那个
      logger.warn('All providers are blacklisted, selecting earliest recovery provider', {
        totalProviders: providers.length,
        allProviders: providers.map(p => p.provider)
      }, requestId, 'routing');
      
      const providerRecoveryTimes = providers.map(provider => {
        const health = this.providerHealth.get(provider.provider);
        let recoveryTime = new Date();
        
        if (health?.isTemporarilyBlacklisted && health.temporaryBlacklistUntil) {
          recoveryTime = health.temporaryBlacklistUntil;
        } else if (health?.nextRetryTime) {
          recoveryTime = health.nextRetryTime;
        }
        
        return { provider, recoveryTime };
      });
      
      // 选择最先恢复的provider
      const earliestRecovery = providerRecoveryTimes.sort((a, b) => 
        a.recoveryTime.getTime() - b.recoveryTime.getTime()
      )[0];
      
      return earliestRecovery.provider;
    }
    
    // 计算可用providers的权重分布（动态调整）
    const totalOriginalWeight = availableProviders.reduce((sum, p) => sum + (p.weight || 1), 0);
    
    // 为每个可用provider计算动态权重
    const adjustedProviders = availableProviders.map(provider => {
      const health = this.providerHealth.get(provider.provider);
      let adjustedWeight = provider.weight || 1;
      
      if (health) {
        // 基于成功率调整权重
        const successRate = health.totalRequests > 0 
          ? health.successCount / health.totalRequests 
          : 1.0;
        
        // 基于429错误频率调整权重（有429历史的降低权重）
        const rateLimitPenalty = health.rateLimitFailureCount > 0 
          ? Math.max(0.3, 1 - (health.rateLimitFailureCount * 0.1)) 
          : 1.0;
        
        adjustedWeight = adjustedWeight * successRate * rateLimitPenalty;
      }
      
      return {
        ...provider,
        adjustedWeight: Math.max(0.1, adjustedWeight) // 最小权重0.1
      };
    });
    
    // 权重随机选择
    const totalAdjustedWeight = adjustedProviders.reduce((sum, p) => sum + p.adjustedWeight, 0);
    const random = Math.random() * totalAdjustedWeight;
    
    let currentWeight = 0;
    for (const provider of adjustedProviders) {
      currentWeight += provider.adjustedWeight;
      if (random < currentWeight) {
        logger.debug(`Health-based blacklist-aware selection: ${provider.provider}`, {
          originalWeight: provider.weight || 1,
          adjustedWeight: provider.adjustedWeight.toFixed(3),
          totalAdjustedWeight: totalAdjustedWeight.toFixed(3),
          availableProviders: availableProviders.length,
          totalProviders: providers.length,
          selectionProbability: `${((provider.adjustedWeight / totalAdjustedWeight) * 100).toFixed(1)}%`
        }, requestId, 'routing');
        
        return provider;
      }
    }
    
    // 降级选择（浮点精度问题）
    const fallbackProvider = adjustedProviders[adjustedProviders.length - 1];
    logger.warn(`Health-based blacklist-aware selection fallback: ${fallbackProvider.provider}`, {
      reason: 'floating_point_precision_issue',
      totalAdjustedWeight,
      randomValue: random
    }, requestId, 'routing');
    
    return fallbackProvider;
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
   * Check if provider is healthy with intelligent failover logic
   */
  private isProviderHealthy(providerId: string): boolean {
    const health = this.providerHealth.get(providerId);
    if (!health) {
      return true; // Assume healthy for new providers
    }
    
    const now = new Date();
    
    // 🔒 PERMANENT BLACKLIST CHECK - highest priority
    if (health.isPermanentlyBlacklisted) {
      logger.debug(`Provider ${providerId} is permanently blacklisted`, {
        reason: health.blacklistReason,
        authFailureCount: health.authFailureCount
      });
      return false;
    }
    
    // 🚫 TEMPORARY BLACKLIST CHECK for 429 errors
    if (health.isTemporarilyBlacklisted && health.temporaryBlacklistUntil) {
      if (now < health.temporaryBlacklistUntil) {
        const remainingSeconds = Math.ceil((health.temporaryBlacklistUntil.getTime() - now.getTime()) / 1000);
        logger.debug(`Provider ${providerId} is temporarily blacklisted for 429 errors`, {
          remainingSeconds,
          rateLimitFailures: health.rateLimitFailureCount,
          blacklistUntil: health.temporaryBlacklistUntil.toISOString()
        });
        return false;
      } else {
        // 黑名单期满，自动恢复
        health.isTemporarilyBlacklisted = false;
        health.temporaryBlacklistUntil = undefined;
        logger.info(`Provider ${providerId} recovered from temporary blacklist`, {
          rateLimitFailures: health.rateLimitFailureCount
        });
      }
    }
    
    // 📈 TEMPORARY BACKOFF CHECK - check if retry time has passed
    if (health.temporaryBackoffLevel > 0 && health.nextRetryTime) {
      if (now < health.nextRetryTime) {
        const minutesRemaining = Math.ceil((health.nextRetryTime.getTime() - now.getTime()) / (60 * 1000));
        logger.debug(`Provider ${providerId} in backoff level ${health.temporaryBackoffLevel}`, {
          minutesRemaining,
          nextRetryTime: health.nextRetryTime.toISOString()
        });
        return false;
      } else {
        // Backoff time has passed, allow health check but don't reset backoff level
        // (backoff level will be reset on successful request)
        logger.info(`Provider ${providerId} backoff period expired, allowing health check`, {
          backoffLevel: health.temporaryBackoffLevel,
          nextRetryTime: health.nextRetryTime.toISOString()
        });
      }
    }
    
    // Standard cooldown check (for legacy compatibility)
    if (health.inCooldown && health.cooldownUntil && now < health.cooldownUntil) {
      return false;
    }
    
    // Check consecutive errors threshold (fallback for non-categorized errors)
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
   * Get current round robin state
   */
  private getRoundRobinState(): Record<string, number> {
    const state: Record<string, number> = {};
    this.roundRobinIndex.forEach((index, category) => {
      state[category] = index;
    });
    return state;
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
}