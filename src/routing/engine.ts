/**
 * Intelligent Routing Engine
 * Routes requests to appropriate providers based on model, content, and configuration
 */

import { BaseRequest, RoutingCategory, CategoryRouting, ProviderHealth, FailoverTrigger, ProviderEntry, LoadBalancingConfig, FailoverConfig } from '@/types';
import { ConcurrentLoadBalancingConfig } from '@/types/concurrency';
import { logger } from '@/utils/logger';
import { calculateTokenCount } from '@/utils/tokenizer';
import { responseStatsManager } from '@/utils/response-stats';
import { ConcurrencyManager } from './concurrency-manager';

export class RoutingEngine {
  private providerHealth: Map<string, ProviderHealth> = new Map();
  private roundRobinIndex: Map<string, number> = new Map();
  private concurrencyManager: ConcurrencyManager;
  
  constructor(private routingConfig: Record<RoutingCategory, CategoryRouting>) {
    // 初始化并发管理器
    const concurrencyConfig: ConcurrentLoadBalancingConfig = {
      enabled: true,
      maxConcurrencyPerProvider: 3, // 每个provider最多3个并发
      lockTimeoutMs: 300000, // 5分钟超时
      queueTimeoutMs: 60000, // 队列等待1分钟
      enableWaitingQueue: true,
      preferIdleProviders: true
    };
    this.concurrencyManager = new ConcurrencyManager(concurrencyConfig);

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

    // 🚀 NEW: 使用并发感知的负载均衡
    if (loadBalancingConfig.enabled) {
      return this.selectWithConcurrencyControl(
        healthyProviders, 
        loadBalancingConfig, 
        category, 
        requestId
      );
    }

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
    strategy: 'round_robin' | 'weighted' | 'health_based',
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
   * Check if provider is healthy
   */
  private isProviderHealthy(providerId: string): boolean {
    const health = this.providerHealth.get(providerId);
    if (!health) {
      return true; // Assume healthy for new providers
    }
    
    // Check if in cooldown
    if (health.inCooldown && health.cooldownUntil && new Date() < health.cooldownUntil) {
      return false;
    }
    
    // Check consecutive errors threshold
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
        inCooldown: false
      });
    });
    
    logger.info(`Initialized health tracking for ${allProviders.size} providers`, {
      providers: Array.from(allProviders)
    });
  }

  /**
   * Record provider request result for health tracking and statistics
   */
  public recordProviderResult(providerId: string, success: boolean, error?: string, httpCode?: number, model?: string, responseTimeMs?: number): void {
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
        inCooldown: false
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
      
      // 记录成功响应统计
      if (model) {
        responseStatsManager.recordSuccess(providerId, model, responseTimeMs || 0);
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
      
      // 记录失败响应统计
      if (model) {
        responseStatsManager.recordFailure(providerId, model, error || 'unknown');
      }
      
      // Add to error history
      health.errorHistory.push({
        timestamp: new Date(),
        errorType: error || 'unknown',
        errorMessage: error || 'No error message provided',
        httpCode
      });
      
      // Keep only last 10 errors
      if (health.errorHistory.length > 10) {
        health.errorHistory = health.errorHistory.slice(-10);
      }
      
      // Mark unhealthy if consecutive errors exceed threshold
      if (health.consecutiveErrors >= 5) {
        health.isHealthy = false;
        health.inCooldown = true;
        health.cooldownUntil = new Date(Date.now() + 60000); // 1 minute cooldown
        
        logger.warn(`Provider ${providerId} marked unhealthy after ${health.consecutiveErrors} consecutive errors`, {
          errorType: error,
          httpCode,
          cooldownUntil: health.cooldownUntil
        });
      }
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
        inCooldown: false
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
        if (this.shouldTriggerFailover(health, trigger)) {
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

  /**
   * 并发感知的负载均衡选择
   */
  private async selectWithConcurrencyControl(
    providers: ProviderEntry[],
    loadBalancingConfig: LoadBalancingConfig,
    category: string,
    requestId: string
  ): Promise<{ provider: string; model: string }> {
    
    // 提取sessionId用于并发控制
    const sessionId = requestId; // 简化实现，实际应该从request中提取

    // 初始化所有providers
    providers.forEach(p => this.concurrencyManager.initializeProvider(p.provider, 3));

    // 根据负载均衡策略选择
    switch (loadBalancingConfig.strategy) {
      case 'weighted':
        return this.selectWithConcurrentWeighted(providers, sessionId, requestId);
      case 'round_robin':
        return this.selectWithConcurrentRoundRobin(providers, category, sessionId, requestId);
      case 'health_based':
        return this.selectWithConcurrentHealthBased(providers, sessionId, requestId);
      default:
        return this.selectWithConcurrentWeighted(providers, sessionId, requestId);
    }
  }

  /**
   * 并发感知的权重选择
   */
  private async selectWithConcurrentWeighted(
    providers: ProviderEntry[],
    sessionId: string,
    requestId: string
  ): Promise<{ provider: string; model: string }> {
    
    // 构建权重映射
    const weights = new Map<string, number>();
    providers.forEach(p => weights.set(p.provider, p.weight || 1));

    // 尝试获取可用provider
    const lockResult = await this.concurrencyManager.acquireAvailableProvider(
      sessionId,
      requestId,
      providers.map(p => p.provider),
      weights
    );

    if (lockResult.success) {
      const selectedProvider = providers.find(p => p.provider === lockResult.providerId)!;
      
      logger.info(`Concurrent weighted selection: ${lockResult.providerId}`, {
        sessionId,
        weight: selectedProvider.weight || 1,
        concurrencyMetrics: this.concurrencyManager.getProviderMetrics(lockResult.providerId)
      }, requestId, 'routing');

      return {
        provider: selectedProvider.provider,
        model: selectedProvider.model
      };
    }

    // 降级：使用传统权重选择
    logger.warn('Concurrent provider selection failed, falling back to traditional weighted', {
      sessionId, requestId
    }, requestId, 'routing');
    
    const traditionalSelection = this.selectWeighted(providers, requestId);
    return {
      provider: traditionalSelection.provider,
      model: traditionalSelection.model
    };
  }

  /**
   * 并发感知的轮询选择
   */
  private async selectWithConcurrentRoundRobin(
    providers: ProviderEntry[],
    category: string,
    sessionId: string,
    requestId: string
  ): Promise<{ provider: string; model: string }> {
    
    // 按轮询顺序排序
    const currentIndex = this.roundRobinIndex.get(category) || 0;
    const orderedProviders = [
      ...providers.slice(currentIndex),
      ...providers.slice(0, currentIndex)
    ];

    // 尝试按顺序获取可用provider
    for (let i = 0; i < orderedProviders.length; i++) {
      const provider = orderedProviders[i];
      
      const lockResult = await this.concurrencyManager.acquireProviderLock({
        sessionId,
        requestId,
        providerId: provider.provider,
        priority: 'normal'
      });

      if (lockResult.success) {
        // 更新轮询索引
        const nextIndex = (currentIndex + i + 1) % providers.length;
        this.roundRobinIndex.set(category, nextIndex);

        logger.info(`Concurrent round-robin selection: ${provider.provider}`, {
          sessionId,
          roundRobinIndex: nextIndex,
          concurrencyMetrics: this.concurrencyManager.getProviderMetrics(provider.provider)
        }, requestId, 'routing');

        return {
          provider: provider.provider,
          model: provider.model
        };
      }
    }

    // 所有provider都被占用，返回第一个
    logger.warn('All providers occupied in round-robin, using first provider', {
      sessionId, requestId, 
      providerCount: providers.length
    }, requestId, 'routing');

    return {
      provider: providers[0].provider,
      model: providers[0].model
    };
  }

  /**
   * 并发感知的健康状态选择
   */
  private async selectWithConcurrentHealthBased(
    providers: ProviderEntry[],
    sessionId: string,
    requestId: string
  ): Promise<{ provider: string; model: string }> {
    
    // 按健康分数和并发利用率综合排序
    const scoredProviders = providers.map(provider => {
      const health = this.providerHealth.get(provider.provider);
      const concurrencyMetrics = this.concurrencyManager.getProviderMetrics(provider.provider);
      
      let healthScore = 1.0;
      if (health) {
        const successRate = health.totalRequests > 0 ? health.successCount / health.totalRequests : 1.0;
        const errorPenalty = Math.max(0, health.consecutiveErrors) * 0.1;
        const cooldownPenalty = health.inCooldown ? 0.5 : 0;
        healthScore = successRate - errorPenalty - cooldownPenalty;
      }
      
      // 考虑并发负载
      const concurrencyScore = concurrencyMetrics ? (1 - concurrencyMetrics.utilizationRate) : 1.0;
      
      // 综合分数
      const finalScore = (healthScore * 0.7) + (concurrencyScore * 0.3);
      
      return {
        provider,
        score: Math.max(0.1, finalScore),
        healthScore,
        concurrencyScore
      };
    }).sort((a, b) => b.score - a.score);

    // 按分数顺序尝试获取锁
    for (const scoredProvider of scoredProviders) {
      const lockResult = await this.concurrencyManager.acquireProviderLock({
        sessionId,
        requestId,
        providerId: scoredProvider.provider.provider,
        priority: 'normal'
      });

      if (lockResult.success) {
        logger.info(`Concurrent health-based selection: ${scoredProvider.provider.provider}`, {
          sessionId,
          finalScore: scoredProvider.score.toFixed(3),
          healthScore: scoredProvider.healthScore.toFixed(3),
          concurrencyScore: scoredProvider.concurrencyScore.toFixed(3),
          concurrencyMetrics: this.concurrencyManager.getProviderMetrics(scoredProvider.provider.provider)
        }, requestId, 'routing');

        return {
          provider: scoredProvider.provider.provider,
          model: scoredProvider.provider.model
        };
      }
    }

    // 降级处理
    logger.warn('Health-based concurrent selection failed, using first provider', {
      sessionId, requestId
    }, requestId, 'routing');

    return {
      provider: providers[0].provider,
      model: providers[0].model
    };
  }

  /**
   * 释放provider锁 (供外部调用)
   */
  public releaseProviderLock(sessionId: string, requestId?: string): boolean {
    return this.concurrencyManager.releaseProviderLock(sessionId, requestId);
  }

  /**
   * 获取并发状态快照
   */
  public getConcurrencySnapshot(): Record<string, any> {
    return this.concurrencyManager.getOccupancySnapshot();
  }

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