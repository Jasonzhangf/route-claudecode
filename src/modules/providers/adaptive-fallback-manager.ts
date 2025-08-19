/**
 * Adaptive Fallback Manager for Gemini Provider
 *
 * 实现基于429频率的自适应降级模型策略
 * 支持智能恢复、动态冷却时间和故障预测
 *
 * @deprecated DEPRECATED: 根据RCC v4.0零fallback策略，此类已被完全废弃
 * @deprecated 违反 Zero Fallback Policy Rule ZF-001 - 禁止自适应fallback管理器
 * @deprecated 429错误处理方案: 立即返回Rate Limit错误，让客户端处理重试
 * @author Jason Zhang
 * @version 4.0.0-alpha.2
 * @see .claude/rules/zero-fallback-policy.md
 */

import { secureLogger } from '../../utils/secure-logger';

export interface FallbackRule {
  primaryModel: string;
  fallbackChain: string[];
  triggerConditions: {
    maxConsecutiveFailures: number;
    maxFailureRatePercent: number;
    timeWindowMinutes: number;
  };
  recoveryConditions: {
    minSuccessfulRequests: number;
    minSuccessRatePercent: number;
    recoveryTimeoutMinutes: number;
  };
}

export interface ModelHealthStatus {
  modelName: string;
  tier: 'premium' | 'standard' | 'basic';
  isHealthy: boolean;
  healthScore: number; // 0-100
  consecutiveFailures: number;
  totalFailures: number;
  totalRequests: number;
  successRate: number;
  avgResponseTime: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  currentCooldownUntil: Date | null;
  adaptiveCooldownLevel: number; // 0-5
  failurePattern: {
    recentFailures: Array<{ timestamp: Date; errorType: '429' | '500' | 'timeout' | 'other' }>;
    peak429Hours: number[]; // 一天中429频率最高的小时
    recurrentFailureIntervals: number[]; // 经常出现故障的时间间隔（分钟）
  };
}

export interface FallbackDecision {
  action: 'continue' | 'fallback' | 'wait' | 'circuit_break';
  recommendedModel: string;
  reasoning: string;
  waitTimeMs?: number;
  confidenceScore: number; // 0-100
  fallbackHistory: string[];
}

/**
 * 自适应降级管理器类
 */
export class AdaptiveFallbackManager {
  private fallbackRules: Map<string, FallbackRule> = new Map();
  private modelHealthStatus: Map<string, ModelHealthStatus> = new Map();
  private circuitBreakerStatus: Map<
    string,
    {
      isOpen: boolean;
      failureCount: number;
      lastFailureTime: Date;
      nextRetryTime: Date;
    }
  > = new Map();

  // 预测性配置
  private readonly PREDICTION_WINDOW_HOURS = 2;
  private readonly MAX_COOLDOWN_LEVELS = 5;
  private readonly BASE_COOLDOWN_MS = 60000; // 1分钟

  constructor() {
    this.initializeDefaultRules();
    secureLogger.info('🔧 自适应降级管理器已初始化');
  }

  /**
   * 初始化默认降级规则
   */
  private initializeDefaultRules(): void {
    // Gemini 2.5 Pro 降级规则
    this.addFallbackRule({
      primaryModel: 'gemini-2.5-pro',
      fallbackChain: ['gemini-2.5-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-pro'],
      triggerConditions: {
        maxConsecutiveFailures: 3,
        maxFailureRatePercent: 50,
        timeWindowMinutes: 15,
      },
      recoveryConditions: {
        minSuccessfulRequests: 5,
        minSuccessRatePercent: 85,
        recoveryTimeoutMinutes: 30,
      },
    });

    // Gemini 2.5 Flash 降级规则
    this.addFallbackRule({
      primaryModel: 'gemini-2.5-flash',
      fallbackChain: ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro'],
      triggerConditions: {
        maxConsecutiveFailures: 4,
        maxFailureRatePercent: 60,
        timeWindowMinutes: 10,
      },
      recoveryConditions: {
        minSuccessfulRequests: 3,
        minSuccessRatePercent: 80,
        recoveryTimeoutMinutes: 20,
      },
    });

    // Gemini 2.0 Flash 降级规则
    this.addFallbackRule({
      primaryModel: 'gemini-2.0-flash-exp',
      fallbackChain: ['gemini-1.5-flash', 'gemini-1.5-pro'],
      triggerConditions: {
        maxConsecutiveFailures: 5,
        maxFailureRatePercent: 70,
        timeWindowMinutes: 8,
      },
      recoveryConditions: {
        minSuccessfulRequests: 2,
        minSuccessRatePercent: 75,
        recoveryTimeoutMinutes: 15,
      },
    });
  }

  /**
   * 添加降级规则
   */
  addFallbackRule(rule: FallbackRule): void {
    this.fallbackRules.set(rule.primaryModel, rule);

    // 初始化模型健康状态
    if (!this.modelHealthStatus.has(rule.primaryModel)) {
      this.initializeModelHealth(rule.primaryModel);
    }

    // 初始化降级链中的所有模型
    rule.fallbackChain.forEach(model => {
      if (!this.modelHealthStatus.has(model)) {
        this.initializeModelHealth(model);
      }
    });

    secureLogger.debug('➕ 添加降级规则', {
      primaryModel: rule.primaryModel,
      fallbackChain: rule.fallbackChain,
    });
  }

  /**
   * 初始化模型健康状态
   */
  private initializeModelHealth(modelName: string): void {
    const tier = this.determineModelTier(modelName);

    this.modelHealthStatus.set(modelName, {
      modelName,
      tier,
      isHealthy: true,
      healthScore: 100,
      consecutiveFailures: 0,
      totalFailures: 0,
      totalRequests: 0,
      successRate: 100,
      avgResponseTime: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      currentCooldownUntil: null,
      adaptiveCooldownLevel: 0,
      failurePattern: {
        recentFailures: [],
        peak429Hours: [],
        recurrentFailureIntervals: [],
      },
    });
  }

  /**
   * 确定模型层级
   */
  private determineModelTier(modelName: string): 'premium' | 'standard' | 'basic' {
    if (modelName.includes('2.5-pro')) return 'premium';
    if (modelName.includes('2.5') || modelName.includes('2.0')) return 'standard';
    return 'basic';
  }

  /**
   * 主要降级决策方法
   */
  async decideFallbackAction(
    currentModel: string,
    errorType: '429' | '500' | 'timeout' | 'other',
    requestPriority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<FallbackDecision> {
    const startTime = Date.now();
    secureLogger.debug('🤔 开始降级决策分析', { currentModel, errorType, requestPriority });

    // 1. 更新模型健康状态
    this.updateModelHealth(currentModel, false, errorType);

    // 2. 检查熔断器状态
    const circuitBreakerDecision = this.checkCircuitBreaker(currentModel);
    if (circuitBreakerDecision) {
      return circuitBreakerDecision;
    }

    // 3. 获取当前模型健康状态
    const currentHealth = this.modelHealthStatus.get(currentModel);
    if (!currentHealth) {
      return this.createFallbackDecision('circuit_break', currentModel, '模型健康状态未知', 0);
    }

    // 4. 检查是否触发降级条件
    const shouldFallback = this.shouldTriggerFallback(currentModel, requestPriority);

    if (!shouldFallback) {
      // 5. 如果不需要降级，检查是否需要等待
      if (currentHealth.currentCooldownUntil && new Date() < currentHealth.currentCooldownUntil) {
        const waitTime = currentHealth.currentCooldownUntil.getTime() - Date.now();
        return this.createFallbackDecision(
          'wait',
          currentModel,
          `模型处于冷却期，建议等待${Math.ceil(waitTime / 1000)}秒`,
          85,
          [],
          waitTime
        );
      }

      return this.createFallbackDecision('continue', currentModel, '模型健康状态良好，继续使用', 90);
    }

    // 6. 选择最佳降级模型
    const bestFallback = await this.selectBestFallbackModel(currentModel, requestPriority);

    if (!bestFallback) {
      // 7. 如果没有可用的降级模型，触发熔断器
      this.triggerCircuitBreaker(currentModel);
      return this.createFallbackDecision('circuit_break', currentModel, '所有降级模型都不可用，触发熔断器', 20);
    }

    // 8. 应用自适应冷却
    this.applyAdaptiveCooldown(currentModel);

    const processingTime = Date.now() - startTime;
    secureLogger.info('✅ 降级决策完成', {
      currentModel,
      recommendedModel: bestFallback,
      processingTimeMs: processingTime,
    });

    return this.createFallbackDecision(
      'fallback',
      bestFallback,
      `模型${currentModel}健康分数过低(${currentHealth.healthScore}%)，降级到${bestFallback}`,
      75,
      this.getFallbackHistory(currentModel)
    );
  }

  /**
   * 检查是否应该触发降级
   */
  private shouldTriggerFallback(modelName: string, priority: 'high' | 'normal' | 'low'): boolean {
    const health = this.modelHealthStatus.get(modelName);
    const rule = this.fallbackRules.get(modelName);

    if (!health || !rule) return false;

    // 根据请求优先级调整阈值
    const priorityMultiplier = { high: 0.5, normal: 1.0, low: 1.5 }[priority];
    const adjustedMaxFailures = Math.ceil(rule.triggerConditions.maxConsecutiveFailures * priorityMultiplier);
    const adjustedMaxFailureRate = rule.triggerConditions.maxFailureRatePercent * priorityMultiplier;

    // 检查连续失败次数
    if (health.consecutiveFailures >= adjustedMaxFailures) {
      secureLogger.warn('⚠️ 触发降级: 连续失败次数过多', {
        model: modelName,
        consecutiveFailures: health.consecutiveFailures,
        threshold: adjustedMaxFailures,
      });
      return true;
    }

    // 检查失败率
    if (health.totalRequests >= 10 && health.successRate <= 100 - adjustedMaxFailureRate) {
      secureLogger.warn('⚠️ 触发降级: 失败率过高', {
        model: modelName,
        successRate: health.successRate,
        threshold: 100 - adjustedMaxFailureRate,
      });
      return true;
    }

    // 检查健康分数
    const minimumHealthScore = { high: 70, normal: 50, low: 30 }[priority];
    if (health.healthScore < minimumHealthScore) {
      secureLogger.warn('⚠️ 触发降级: 健康分数过低', {
        model: modelName,
        healthScore: health.healthScore,
        threshold: minimumHealthScore,
      });
      return true;
    }

    // 预测性降级 - 检查429模式
    if (this.predictUpcoming429(modelName)) {
      secureLogger.info('🔮 预测性降级: 检测到429高峰期临近', { model: modelName });
      return true;
    }

    return false;
  }

  /**
   * 选择最佳降级模型
   */
  private async selectBestFallbackModel(
    primaryModel: string,
    priority: 'high' | 'normal' | 'low'
  ): Promise<string | null> {
    const rule = this.fallbackRules.get(primaryModel);
    if (!rule) return null;

    // 按健康分数排序降级选项
    const fallbackOptions = rule.fallbackChain
      .map(model => ({
        model,
        health: this.modelHealthStatus.get(model),
      }))
      .filter(option => option.health && option.health.isHealthy)
      .filter(option => !this.isModelInCooldown(option.model))
      .sort((a, b) => b.health!.healthScore - a.health!.healthScore);

    if (fallbackOptions.length === 0) return null;

    // 根据优先级选择
    const bestOption = fallbackOptions[0];

    // 对于高优先级请求，尝试找到tier相同或更高的模型
    if (priority === 'high') {
      const primaryTier = this.modelHealthStatus.get(primaryModel)?.tier;
      const sameOrHigherTierOption = fallbackOptions.find(option => {
        const optionTier = option.health!.tier;
        if (primaryTier === 'premium') return optionTier === 'premium';
        if (primaryTier === 'standard') return optionTier === 'premium' || optionTier === 'standard';
        return true;
      });

      if (sameOrHigherTierOption) {
        return sameOrHigherTierOption.model;
      }
    }

    return bestOption.model;
  }

  /**
   * 预测即将到来的429高峰期
   */
  private predictUpcoming429(modelName: string): boolean {
    const health = this.modelHealthStatus.get(modelName);
    if (!health) return false;

    const now = new Date();
    const currentHour = now.getHours();

    // 检查是否在历史429高峰期
    if (health.failurePattern.peak429Hours.includes(currentHour)) {
      return true;
    }

    // 检查最近的429模式
    const recent429s = health.failurePattern.recentFailures
      .filter(f => f.errorType === '429')
      .filter(f => now.getTime() - f.timestamp.getTime() < this.PREDICTION_WINDOW_HOURS * 60 * 60 * 1000);

    if (recent429s.length >= 3) {
      // 分析时间间隔模式
      const intervals = [];
      for (let i = 1; i < recent429s.length; i++) {
        intervals.push(recent429s[i].timestamp.getTime() - recent429s[i - 1].timestamp.getTime());
      }

      // 如果间隔呈递减趋势，可能即将迎来高峰
      if (intervals.length >= 2) {
        const isDecreasing = intervals.every(
          (interval, index) => index === 0 || interval <= intervals[index - 1] * 1.2
        );
        if (isDecreasing) return true;
      }
    }

    return false;
  }

  /**
   * 应用自适应冷却
   */
  private applyAdaptiveCooldown(modelName: string): void {
    const health = this.modelHealthStatus.get(modelName);
    if (!health) return;

    // 计算冷却级别 (基于连续失败次数)
    health.adaptiveCooldownLevel = Math.min(health.consecutiveFailures, this.MAX_COOLDOWN_LEVELS);

    // 计算冷却时间 (指数退避)
    const cooldownMs = this.BASE_COOLDOWN_MS * Math.pow(2, health.adaptiveCooldownLevel);
    health.currentCooldownUntil = new Date(Date.now() + cooldownMs);

    secureLogger.info('❄️ 应用自适应冷却', {
      model: modelName,
      level: health.adaptiveCooldownLevel,
      cooldownMs,
      cooldownUntil: health.currentCooldownUntil,
    });
  }

  /**
   * 检查模型是否在冷却期
   */
  private isModelInCooldown(modelName: string): boolean {
    const health = this.modelHealthStatus.get(modelName);
    if (!health || !health.currentCooldownUntil) return false;

    return new Date() < health.currentCooldownUntil;
  }

  /**
   * 检查熔断器状态
   */
  private checkCircuitBreaker(modelName: string): FallbackDecision | null {
    const circuitBreaker = this.circuitBreakerStatus.get(modelName);
    if (!circuitBreaker || !circuitBreaker.isOpen) return null;

    // 检查是否可以尝试半开状态
    if (new Date() >= circuitBreaker.nextRetryTime) {
      // 重置熔断器到半开状态
      circuitBreaker.isOpen = false;
      secureLogger.info('🔄 熔断器进入半开状态', { model: modelName });
      return null;
    }

    const waitTime = circuitBreaker.nextRetryTime.getTime() - Date.now();
    return this.createFallbackDecision(
      'circuit_break',
      modelName,
      `熔断器已触发，请等待${Math.ceil(waitTime / 1000)}秒后重试`,
      10,
      [],
      waitTime
    );
  }

  /**
   * 触发熔断器
   */
  private triggerCircuitBreaker(modelName: string): void {
    const circuitBreaker = this.circuitBreakerStatus.get(modelName) || {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: new Date(),
      nextRetryTime: new Date(),
    };

    circuitBreaker.isOpen = true;
    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = new Date();

    // 计算下次重试时间 (指数退避，最大30分钟)
    const backoffMs = Math.min(60000 * Math.pow(2, circuitBreaker.failureCount - 1), 30 * 60 * 1000);
    circuitBreaker.nextRetryTime = new Date(Date.now() + backoffMs);

    this.circuitBreakerStatus.set(modelName, circuitBreaker);

    secureLogger.error('🚨 触发熔断器', {
      model: modelName,
      failureCount: circuitBreaker.failureCount,
      nextRetryTime: circuitBreaker.nextRetryTime,
    });
  }

  /**
   * 更新模型健康状态
   */
  updateModelHealth(
    modelName: string,
    isSuccess: boolean,
    errorType?: '429' | '500' | 'timeout' | 'other',
    responseTime?: number
  ): void {
    let health = this.modelHealthStatus.get(modelName);
    if (!health) {
      this.initializeModelHealth(modelName);
      health = this.modelHealthStatus.get(modelName)!;
    }

    health.totalRequests++;

    if (isSuccess) {
      health.consecutiveFailures = 0;
      health.lastSuccessTime = new Date();
      health.currentCooldownUntil = null; // 清除冷却
      health.adaptiveCooldownLevel = Math.max(0, health.adaptiveCooldownLevel - 1); // 逐渐降低冷却级别

      if (responseTime) {
        health.avgResponseTime =
          (health.avgResponseTime * (health.totalRequests - 1) + responseTime) / health.totalRequests;
      }
    } else {
      health.consecutiveFailures++;
      health.totalFailures++;
      health.lastFailureTime = new Date();

      // 记录失败模式
      if (errorType) {
        health.failurePattern.recentFailures.push({
          timestamp: new Date(),
          errorType,
        });

        // 只保留最近100个失败记录
        if (health.failurePattern.recentFailures.length > 100) {
          health.failurePattern.recentFailures = health.failurePattern.recentFailures.slice(-100);
        }

        // 更新429高峰时间统计
        if (errorType === '429') {
          const hour = new Date().getHours();
          if (!health.failurePattern.peak429Hours.includes(hour)) {
            health.failurePattern.peak429Hours.push(hour);
          }
        }
      }
    }

    // 重新计算成功率和健康分数
    health.successRate = ((health.totalRequests - health.totalFailures) / health.totalRequests) * 100;
    health.healthScore = this.calculateHealthScore(health);
    health.isHealthy = health.healthScore >= 60; // 60分以上认为健康
  }

  /**
   * 计算健康分数
   */
  private calculateHealthScore(health: ModelHealthStatus): number {
    let score = 100;

    // 成功率影响 (权重40%)
    score -= (100 - health.successRate) * 0.4;

    // 连续失败惩罚 (权重30%)
    score -= Math.min(health.consecutiveFailures * 10, 30);

    // 最近失败频率惩罚 (权重20%)
    const recent429Count = health.failurePattern.recentFailures
      .filter(f => f.errorType === '429')
      .filter(f => Date.now() - f.timestamp.getTime() < 15 * 60 * 1000).length; // 15分钟内
    score -= Math.min(recent429Count * 5, 20);

    // 响应时间影响 (权重10%)
    if (health.avgResponseTime > 5000) {
      // 超过5秒
      score -= Math.min((health.avgResponseTime - 5000) / 1000, 10);
    }

    return Math.max(0, Math.round(score));
  }

  /**
   * 获取降级历史
   */
  private getFallbackHistory(modelName: string): string[] {
    const rule = this.fallbackRules.get(modelName);
    return rule ? rule.fallbackChain : [];
  }

  /**
   * 创建降级决策对象
   */
  private createFallbackDecision(
    action: 'continue' | 'fallback' | 'wait' | 'circuit_break',
    model: string,
    reasoning: string,
    confidence: number,
    fallbackHistory: string[] = [],
    waitTime?: number
  ): FallbackDecision {
    return {
      action,
      recommendedModel: model,
      reasoning,
      waitTimeMs: waitTime,
      confidenceScore: confidence,
      fallbackHistory,
    };
  }

  /**
   * 获取所有模型的健康状态
   */
  getHealthReport(): {
    healthyModels: string[];
    unhealthyModels: string[];
    modelDetails: ModelHealthStatus[];
    circuitBreakerStatus: Array<{
      model: string;
      isOpen: boolean;
      failureCount: number;
      nextRetryTime: Date;
    }>;
  } {
    const modelDetails = Array.from(this.modelHealthStatus.values());
    const healthyModels = modelDetails.filter(m => m.isHealthy).map(m => m.modelName);
    const unhealthyModels = modelDetails.filter(m => !m.isHealthy).map(m => m.modelName);

    const circuitBreakerStatus = Array.from(this.circuitBreakerStatus.entries()).map(([model, status]) => ({
      model,
      isOpen: status.isOpen,
      failureCount: status.failureCount,
      nextRetryTime: status.nextRetryTime,
    }));

    return {
      healthyModels,
      unhealthyModels,
      modelDetails,
      circuitBreakerStatus,
    };
  }

  /**
   * 重置模型健康状态
   */
  resetModelHealth(modelName: string): void {
    this.initializeModelHealth(modelName);
    this.circuitBreakerStatus.delete(modelName);
    secureLogger.info('🔄 重置模型健康状态', { model: modelName });
  }
}
