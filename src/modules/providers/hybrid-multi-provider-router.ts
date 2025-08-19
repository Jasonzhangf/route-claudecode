/**
 * DEPRECATED: This file has been replaced by src/modules/routing/core-router.ts
 *
 * ❌ DO NOT USE: This router implementation is deprecated
 * ✅ USE INSTEAD: src/modules/routing/core-router.ts - CoreRouter
 *
 * This file will be removed in a future version.
 * Please update all imports to use the new CoreRouter.
 *
 * @deprecated Use CoreRouter from src/modules/routing/core-router.ts instead
 * @see src/modules/routing/core-router.ts
 */

import { secureLogger } from '../../utils/secure-logger';
import {
  ZeroFallbackErrorFactory,
  ProviderUnavailableError,
  HealthCheckFailedError,
  ModelUnavailableError,
} from '../../interfaces/core/zero-fallback-errors';
import { ValidateInput, ValidateOutput, DataValidator, ValidationSchema } from '../../middleware/data-validator';

export interface ProviderConfig {
  type: 'gemini' | 'openai';
  priority: number;
  tier: 'premium' | 'standard'; // 移除 'backup' tier - 违反零fallback策略
  endpoint: string;
  apiKeys: string[];
  models: Record<
    string,
    {
      primary: string;
      // 移除 backup: string[] - 违反零fallback策略
    }
  >;
  timeout: number;
  maxRetries: number; // 注意：这是单个Provider内的重试，不是fallback
  healthCheck: {
    enabled: boolean;
    interval: number;
    model: string;
  };
}

export interface ProviderHealth {
  providerId: string;
  isHealthy: boolean;
  healthScore: number;
  responseTime: number;
  successRate: number;
  consecutiveFailures: number;
  lastFailureTime: Date | null;
  cooldownUntil: Date | null;
  currentLoad: number;
  maxLoad: number;
}

export interface RoutingCategory {
  name: string;
  primaryProvider: string;
  primaryModel: string;
  // 移除 fallbackChain - 违反Zero Fallback Policy Rule ZF-001
}

export interface HybridRoutingDecision {
  selectedProvider: string;
  selectedModel: string;
  // 移除 fallbacksUsed - 违反Zero Fallback Policy Rule ZF-002
  reasoning: string;
  estimatedLatency: number;
  confidenceScore: number;
  providerHealth: Record<string, number>;
}

// 验证模式定义
const PROVIDER_CONFIG_SCHEMA: { [key: string]: ValidationSchema } = {
  priority: { type: 'number', required: true },
  tier: { type: 'string', required: true, enum: ['premium', 'standard'] },
  endpoint: { type: 'string', required: true },
  apiKeys: { type: 'array', required: true, properties: { type: 'string' } },
  models: { type: 'object', required: true },
  timeout: { type: 'number', required: true },
  maxRetries: { type: 'number', required: true },
  healthCheck: {
    type: 'object',
    required: true,
    properties: {
      enabled: { type: 'boolean', required: true },
      interval: { type: 'number', required: true },
      model: { type: 'string', required: true },
    },
  },
};

const PROVIDER_HEALTH_SCHEMA: { [key: string]: ValidationSchema } = {
  providerId: { type: 'string', required: true },
  isHealthy: { type: 'boolean', required: true },
  healthScore: { type: 'number', required: true },
  responseTime: { type: 'number', required: true },
  successRate: { type: 'number', required: true },
  consecutiveFailures: { type: 'number', required: true },
  lastFailureTime: { type: 'object' }, // Date对象
  cooldownUntil: { type: 'object' }, // Date对象
  currentLoad: { type: 'number', required: true },
  maxLoad: { type: 'number', required: true },
};

const ROUTING_CATEGORY_SCHEMA: { [key: string]: ValidationSchema } = {
  name: { type: 'string', required: true },
  primaryProvider: { type: 'string', required: true },
  primaryModel: { type: 'string', required: true },
};

const HYBRID_ROUTING_DECISION_SCHEMA: { [key: string]: ValidationSchema } = {
  selectedProvider: { type: 'string', required: true },
  selectedModel: { type: 'string', required: true },
  reasoning: { type: 'string', required: true },
  estimatedLatency: { type: 'number', required: true },
  confidenceScore: { type: 'number', required: true },
  providerHealth: { type: 'object', required: true },
};

/**
 * 混合多Provider路由器
 */
export class HybridMultiProviderRouter {
  private providers: Map<string, ProviderConfig> = new Map();
  private providerHealth: Map<string, ProviderHealth> = new Map();
  private routingCategories: Map<string, RoutingCategory> = new Map();
  private loadBalanceWeights: Map<string, number> = new Map();
  private requestStats: Map<
    string,
    {
      totalRequests: number;
      successfulRequests: number;
      avgLatency: number;
      last24hRequests: Array<{ timestamp: Date; success: boolean; latency: number }>;
    }
  > = new Map();

  // 跨Provider策略配置
  private crossProviderConfig = {
    maxFailuresBeforeSwitch: 3,
    providerCooldownMs: 300000, // 5分钟
    adaptiveRecovery: true,
    recoveryCheckInterval: 60000, // 1分钟
    globalRateLimitThreshold: 10,
    adaptiveCooldown: {
      baseCooldownMs: 60000,
      maxCooldownMs: 600000,
      backoffMultiplier: 2.0,
    },
  };

  constructor(config: any) {
    // 验证输入配置
    const configValidation = DataValidator.validate(config, {
      providers: { type: 'object', required: true },
      routing: {
        type: 'object',
        required: true,
        properties: {
          categories: { type: 'object', required: true },
        },
      },
    });

    if (!configValidation.isValid) {
      throw new Error(`配置验证失败: ${configValidation.errors.join(', ')}`);
    }

    this.initializeFromConfig(config);
    this.startHealthMonitoring();

    secureLogger.info('🌐 混合多Provider路由器已初始化', {
      providers: Array.from(this.providers.keys()),
      categories: Array.from(this.routingCategories.keys()),
    });
  }

  /**
   * 从配置初始化路由器
   */
  private initializeFromConfig(config: any): void {
    // 初始化Provider配置
    Object.entries(config.providers).forEach(([providerId, providerConfig]: [string, any]) => {
      // 验证Provider配置
      const providerValidation = DataValidator.validate(providerConfig, PROVIDER_CONFIG_SCHEMA);
      if (!providerValidation.isValid) {
        secureLogger.error('Provider配置验证失败', {
          providerId,
          errors: providerValidation.errors,
        });
        throw new Error(`Provider配置验证失败 ${providerId}: ${providerValidation.errors.join(', ')}`);
      }

      this.providers.set(providerId, {
        type: providerConfig.type,
        priority: providerConfig.priority,
        tier: providerConfig.tier,
        endpoint: providerConfig.endpoint,
        apiKeys: providerConfig.authentication.credentials.apiKeys,
        models: providerConfig.models,
        timeout: providerConfig.timeout,
        maxRetries: providerConfig.maxRetries,
        healthCheck: providerConfig.healthCheck,
      });

      // 初始化Provider健康状态
      this.initializeProviderHealth(providerId);

      // 初始化请求统计
      this.requestStats.set(providerId, {
        totalRequests: 0,
        successfulRequests: 0,
        avgLatency: 0,
        last24hRequests: [],
      });
    });

    // 初始化路由类别
    Object.entries(config.routing.categories).forEach(([categoryId, categoryConfig]: [string, any]) => {
      // 验证路由类别配置
      const categoryValidation = DataValidator.validate(categoryConfig, ROUTING_CATEGORY_SCHEMA);
      if (!categoryValidation.isValid) {
        secureLogger.error('路由类别配置验证失败', {
          categoryId,
          errors: categoryValidation.errors,
        });
        throw new Error(`路由类别配置验证失败 ${categoryId}: ${categoryValidation.errors.join(', ')}`);
      }

      this.routingCategories.set(categoryId, {
        name: categoryId,
        primaryProvider: categoryConfig.primaryProvider,
        primaryModel: categoryConfig.primaryModel,
        // 移除 fallbackChain - 违反Zero Fallback Policy Rule ZF-001
      });
    });

    // 初始化负载均衡权重
    if (config.crossProviderStrategy?.loadBalancing?.weights) {
      Object.entries(config.crossProviderStrategy.loadBalancing.weights).forEach(
        ([providerId, weight]: [string, any]) => {
          this.loadBalanceWeights.set(providerId, weight);
        }
      );
    }

    // 更新跨Provider配置
    if (config.crossProviderStrategy?.failoverPolicy) {
      Object.assign(this.crossProviderConfig, config.crossProviderStrategy.failoverPolicy);
    }
  }

  /**
   * 初始化Provider健康状态
   */
  private initializeProviderHealth(providerId: string): void {
    const config = this.providers.get(providerId)!;

    // 创建ProviderHealth对象
    const providerHealth: ProviderHealth = {
      providerId,
      isHealthy: true,
      healthScore: 100,
      responseTime: 0,
      successRate: 100,
      consecutiveFailures: 0,
      lastFailureTime: null,
      cooldownUntil: null,
      currentLoad: 0,
      maxLoad: config.apiKeys.length * 5, // 每个Key最多5个并发
    };

    // 验证创建的ProviderHealth对象
    const validation = DataValidator.validate(providerHealth, PROVIDER_HEALTH_SCHEMA);
    if (!validation.isValid) {
      secureLogger.error('ProviderHealth验证失败', {
        providerId,
        errors: validation.errors,
      });
      throw new Error(`ProviderHealth验证失败 ${providerId}: ${validation.errors.join(', ')}`);
    }

    this.providerHealth.set(providerId, providerHealth);
  }

  /**
   * 零Fallback路由决策主方法
   *
   * ⚠️ ZERO FALLBACK POLICY: 只使用主Provider，失败时立即抛出错误
   * @see .claude/rules/zero-fallback-policy.md Rule ZF-002
   */
  @ValidateInput({
    category: { type: 'string' },
    priority: { type: 'string', enum: ['high', 'normal', 'low'] },
    requestContext: { type: 'object' },
  })
  async routeRequest(
    category: string = 'default',
    priority: 'high' | 'normal' | 'low' = 'normal',
    requestContext?: any
  ): Promise<HybridRoutingDecision> {
    const startTime = Date.now();
    secureLogger.debug('🎯 开始零Fallback路由决策', { category, priority });

    // 1. 获取路由类别配置
    const routingCategory = this.routingCategories.get(category);
    if (!routingCategory) {
      const error = new Error(`路由类别 ${category} 不存在`);
      secureLogger.error('❌ 路由类别不存在', { category, error: error.message });
      throw error;
    }

    // 验证路由类别
    const categoryValidation = DataValidator.validate(routingCategory, ROUTING_CATEGORY_SCHEMA);
    if (!categoryValidation.isValid) {
      const error = new Error(`路由类别 ${category} 验证失败: ${categoryValidation.errors.join(', ')}`);
      secureLogger.error('❌ 路由类别验证失败', { category, errors: categoryValidation.errors });
      throw error;
    }

    // 2. 检查主Provider健康状态
    const primaryProvider = routingCategory.primaryProvider;
    const primaryModel = routingCategory.primaryModel;

    const providerHealth = this.providerHealth.get(primaryProvider);
    if (!providerHealth || !providerHealth.isHealthy) {
      const error = ZeroFallbackErrorFactory.createProviderUnavailable(
        primaryProvider,
        primaryModel,
        `Health check failed or provider not found`,
        { category, priority, requestId: requestContext?.requestId }
      );
      secureLogger.error('❌ 主Provider不可用', {
        provider: primaryProvider,
        health: providerHealth,
        zeroFallbackPolicy: true,
        error: error.type,
      });
      throw error;
    }

    // 3. 构建路由决策（仅主Provider）
    const decision: HybridRoutingDecision = {
      selectedProvider: primaryProvider,
      selectedModel: primaryModel,
      reasoning: `零Fallback策略：使用主Provider ${primaryProvider} 和模型 ${primaryModel}`,
      estimatedLatency: providerHealth.responseTime,
      confidenceScore: this.calculateZeroFallbackConfidenceScore(providerHealth),
      providerHealth: {
        [primaryProvider]: providerHealth.healthScore,
      },
    };

    // 验证路由决策
    const decisionValidation = DataValidator.validate(decision, HYBRID_ROUTING_DECISION_SCHEMA);
    if (!decisionValidation.isValid) {
      const error = new Error(`路由决策验证失败: ${decisionValidation.errors.join(', ')}`);
      secureLogger.error('❌ 路由决策验证失败', {
        errors: decisionValidation.errors,
        decision,
      });
      throw error;
    }

    // 4. 更新负载统计
    this.updateLoadStats(decision.selectedProvider);

    const processingTime = Date.now() - startTime;

    secureLogger.info('✅ 零Fallback路由决策完成', {
      category,
      selectedProvider: decision.selectedProvider,
      selectedModel: decision.selectedModel,
      zeroFallbackPolicy: true,
      processingTimeMs: processingTime,
    });

    return decision;
  }

  /**
   * 计算零Fallback策略下的置信度评分
   *
   * @deprecated 原有的 buildFullFallbackChain 方法已被移除 - 违反Zero Fallback Policy Rule ZF-001
   * @see .claude/rules/zero-fallback-policy.md
   */
  private calculateZeroFallbackConfidenceScore(health: ProviderHealth): number {
    // 零Fallback策略下的置信度评分仅基于主Provider健康状态
    let score = 100;

    // 基于健康评分调整
    score = health.healthScore;

    // 基于响应时间调整（延迟越低，置信度越高）
    if (health.responseTime < 100) {
      score += 10;
    } else if (health.responseTime > 1000) {
      score -= 20;
    }

    // 基于成功率调整
    score *= health.successRate;

    // 基于负载调整
    if (health.currentLoad < health.maxLoad * 0.8) {
      score += 5;
    } else if (health.currentLoad >= health.maxLoad) {
      score -= 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * @deprecated REMOVED: addDynamicFallbacks - 违反Zero Fallback Policy Rule ZF-001
   * @deprecated REMOVED: selectBestModelForProvider - 包含backup模型选择逻辑
   * @deprecated REMOVED: selectBestProviderAndModel - 包含fallback链处理逻辑
   * @deprecated REMOVED: calculateConfidenceScore - 包含fallback惩罚逻辑
   * @see .claude/rules/zero-fallback-policy.md
   */

  /**
   * 零Fallback策略下的模型选择
   *
   * 仅返回主模型，不进行backup模型选择
   */
  private selectPrimaryModelForProvider(providerId: string, modelCategory: string = 'general'): string | null {
    const providerConfig = this.providers.get(providerId);
    if (!providerConfig) return null;

    const models = providerConfig.models[modelCategory] || providerConfig.models['general'];
    if (!models) return null;

    // 零Fallback策略：仅检查主模型，不使用backup
    if (this.isPrimaryModelHealthy(providerId, models.primary)) {
      return models.primary;
    }

    // 主模型不健康时返回null，由上层处理错误
    return null;
  }

  /**
   * 检查主模型是否健康
   */
  private isPrimaryModelHealthy(providerId: string, modelName: string): boolean {
    const health = this.providerHealth.get(providerId);
    if (!health || !health.isHealthy) return false;

    // 零Fallback策略下的高标准健康检查
    return health.healthScore >= 80; // 提高健康阈值
  }

  /**
   * 零Fallback策略下的Provider可用性检查
   */
  private isZeroFallbackProviderAvailable(providerId: string, priority: 'high' | 'normal' | 'low'): boolean {
    const health = this.providerHealth.get(providerId);
    if (!health) return false;

    // 检查健康状态
    if (!health.isHealthy) return false;

    // 检查冷却状态
    if (health.cooldownUntil && new Date() < health.cooldownUntil) return false;

    // 零Fallback策略下的严格健康分数阈值
    const healthThresholds = { high: 90, normal: 80, low: 70 };
    if (health.healthScore < healthThresholds[priority]) return false;

    // 检查连续失败次数 - 零Fallback策略下更严格
    if (health.consecutiveFailures >= 2) {
      // 降低失败容忍度
      return false;
    }

    return true;
  }

  /**
   * 估算延迟
   */
  private estimateLatency(providerId: string): number {
    const health = this.providerHealth.get(providerId);
    if (!health) return 5000; // 默认5秒

    // 使用实际健康数据中的响应时间
    return health.responseTime || 3000;
  }

  /**
   * 更新负载统计
   */
  private updateLoadStats(providerId: string): void {
    const health = this.providerHealth.get(providerId);
    if (health) {
      health.currentLoad++;
    }
  }

  /**
   * 记录请求结果
   */
  recordRequestResult(
    providerId: string,
    modelName: string,
    isSuccess: boolean,
    latency: number,
    errorType?: string
  ): void {
    const health = this.providerHealth.get(providerId);
    const stats = this.requestStats.get(providerId);

    if (health) {
      // 更新健康状态
      if (isSuccess) {
        health.consecutiveFailures = 0;
        health.lastFailureTime = null;
        health.cooldownUntil = null;
      } else {
        health.consecutiveFailures++;
        health.lastFailureTime = new Date();

        // 应用自适应冷却
        if (health.consecutiveFailures >= this.crossProviderConfig.maxFailuresBeforeSwitch) {
          const cooldownMs = Math.min(
            this.crossProviderConfig.adaptiveCooldown.baseCooldownMs *
              Math.pow(
                this.crossProviderConfig.adaptiveCooldown.backoffMultiplier,
                health.consecutiveFailures - this.crossProviderConfig.maxFailuresBeforeSwitch
              ),
            this.crossProviderConfig.adaptiveCooldown.maxCooldownMs
          );
          health.cooldownUntil = new Date(Date.now() + cooldownMs);

          secureLogger.warn('⚠️ Provider进入冷却状态', {
            providerId,
            consecutiveFailures: health.consecutiveFailures,
            cooldownMs,
          });
        }
      }

      // 减少负载计数
      health.currentLoad = Math.max(0, health.currentLoad - 1);

      // 更新响应时间
      health.responseTime = latency;
    }

    if (stats) {
      stats.totalRequests++;
      if (isSuccess) {
        stats.successfulRequests++;
      }

      // 更新平均延迟
      stats.avgLatency = (stats.avgLatency * (stats.totalRequests - 1) + latency) / stats.totalRequests;

      // 记录24小时内的请求
      stats.last24hRequests.push({
        timestamp: new Date(),
        success: isSuccess,
        latency,
      });

      // 清理旧记录（保留24小时）
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      stats.last24hRequests = stats.last24hRequests.filter(r => r.timestamp > oneDayAgo);

      // 重新计算成功率
      if (health) {
        health.successRate = (stats.successfulRequests / stats.totalRequests) * 100;
        health.healthScore = this.calculateHealthScore(health, stats);
        health.isHealthy = health.healthScore >= 60;
      }
    }
  }

  /**
   * 计算健康分数
   */
  private calculateHealthScore(health: ProviderHealth, stats: any): number {
    let score = 100;

    // 成功率影响 (40%)
    score -= (100 - health.successRate) * 0.4;

    // 连续失败惩罚 (30%)
    score -= Math.min(health.consecutiveFailures * 10, 30);

    // 响应时间影响 (20%)
    if (health.responseTime > 10000) {
      // 超过10秒
      score -= Math.min((health.responseTime - 10000) / 1000, 20);
    }

    // 负载影响 (10%)
    const loadRatio = health.currentLoad / health.maxLoad;
    score -= loadRatio * 10;

    return Math.max(0, Math.round(score));
  }

  /**
   * 启动健康监控
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      this.performHealthChecks();
      this.adjustLoadBalanceWeights();
    }, 30000); // 每30秒检查一次

    secureLogger.info('🔍 健康监控已启动');
  }

  /**
   * 执行健康检查
   */
  private async performHealthChecks(): Promise<void> {
    for (const [providerId, config] of this.providers) {
      if (!config.healthCheck.enabled) continue;

      try {
        // 这里应该实际调用Provider的健康检查API
        // 简化实现：基于最近的请求统计推断健康状态
        const health = this.providerHealth.get(providerId);
        const stats = this.requestStats.get(providerId);

        if (health && stats) {
          // 如果最近没有请求，保持当前状态
          if (stats.last24hRequests.length === 0) continue;

          // 检查最近的失败率
          const recentRequests = stats.last24hRequests.slice(-10); // 最近10个请求
          const recentFailureRate = recentRequests.filter(r => !r.success).length / recentRequests.length;

          if (recentFailureRate > 0.5) {
            // 失败率超过50%
            health.isHealthy = false;
            health.healthScore = Math.min(health.healthScore, 40);
          } else if (recentFailureRate < 0.1) {
            // 失败率低于10%
            health.isHealthy = true;
            health.healthScore = Math.max(health.healthScore, 80);
          }
        }
      } catch (error) {
        secureLogger.error('❌ 健康检查失败', { providerId, error: (error as Error).message });
      }
    }
  }

  /**
   * 调整负载均衡权重
   */
  private adjustLoadBalanceWeights(): void {
    const totalHealthScore = Array.from(this.providerHealth.values()).reduce(
      (sum, health) => sum + health.healthScore,
      0
    );

    if (totalHealthScore === 0) return;

    for (const [providerId, health] of this.providerHealth) {
      const newWeight = Math.round((health.healthScore / totalHealthScore) * 100);
      this.loadBalanceWeights.set(providerId, newWeight);
    }

    secureLogger.debug('⚖️ 负载均衡权重已调整', Object.fromEntries(this.loadBalanceWeights));
  }

  /**
   * 获取路由器状态
   */
  getRouterStatus(): {
    providers: ProviderHealth[];
    categories: string[];
    totalRequests: number;
    totalSuccessfulRequests: number;
    avgLatency: number;
    loadBalanceWeights: Record<string, number>;
  } {
    const providers = Array.from(this.providerHealth.values());
    const categories = Array.from(this.routingCategories.keys());

    let totalRequests = 0;
    let totalSuccessfulRequests = 0;
    let totalLatency = 0;

    for (const stats of this.requestStats.values()) {
      totalRequests += stats.totalRequests;
      totalSuccessfulRequests += stats.successfulRequests;
      totalLatency += stats.avgLatency * stats.totalRequests;
    }

    const avgLatency = totalRequests > 0 ? totalLatency / totalRequests : 0;
    const loadBalanceWeights = Object.fromEntries(this.loadBalanceWeights);

    return {
      providers,
      categories,
      totalRequests,
      totalSuccessfulRequests,
      avgLatency,
      loadBalanceWeights,
    };
  }
}
