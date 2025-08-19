/**
 * Cross-Provider Fallback Strategy
 *
 * 跨Provider降级策略实现
 * 支持智能Provider选择、负载均衡和故障恢复
 *
 * @deprecated DEPRECATED: 根据RCC v4.0零fallback策略，此类已被完全废弃
 * @deprecated 违反 Zero Fallback Policy Rule ZF-001
 * @deprecated 请使用直接错误抛出机制，不要使用任何形式的fallback
 * @author Jason Zhang
 * @version 4.0.0-alpha.2
 * @see .claude/rules/zero-fallback-policy.md
 */

import { secureLogger } from '../../utils/secure-logger';

export interface CrossProviderFallbackRule {
  category: string;
  primaryChain: Array<{
    provider: string;
    model: string;
    maxLatency: number;
    priority: number;
  }>;
  emergencyChain: Array<{
    provider: string;
    model: string;
    maxLatency: number;
    priority: number;
  }>;
  conditions: {
    triggerOnLatency: number;
    triggerOnErrorRate: number;
    triggerOnConsecutiveFailures: number;
    recoverySuccessThreshold: number;
    recoveryTimeoutMs: number;
  };
}

export interface ProviderPerformanceMetrics {
  providerId: string;
  avgLatency: number;
  p95Latency: number;
  errorRate: number;
  throughput: number;
  availability: number;
  costPerRequest: number;
  currentCapacity: number;
  maxCapacity: number;
  qualityScore: number; // 综合质量评分
}

export interface FallbackDecision {
  action: 'continue' | 'switch_model' | 'switch_provider' | 'emergency_fallback';
  targetProvider: string;
  targetModel: string;
  reasoning: string;
  expectedImprovement: {
    latencyReduction: number;
    reliabilityIncrease: number;
    costImpact: number;
  };
  rollbackPlan: {
    enabled: boolean;
    conditions: string[];
    timeoutMs: number;
  };
}

/**
 * 跨Provider降级策略管理器
 */
export class CrossProviderFallbackStrategy {
  private fallbackRules: Map<string, CrossProviderFallbackRule> = new Map();
  private providerMetrics: Map<string, ProviderPerformanceMetrics> = new Map();
  private activeTransitions: Map<
    string,
    {
      fromProvider: string;
      toProvider: string;
      startTime: Date;
      reason: string;
      expectedDuration: number;
    }
  > = new Map();

  // 策略配置
  private strategyConfig = {
    // 性能阈值
    performanceThresholds: {
      maxLatency: 30000, // 30秒
      maxErrorRate: 0.15, // 15%
      minAvailability: 0.95, // 95%
      minQualityScore: 70, // 70分
    },

    // 降级决策权重
    decisionWeights: {
      latency: 0.3,
      reliability: 0.4,
      cost: 0.1,
      capacity: 0.2,
    },

    // 恢复策略
    recoveryStrategy: {
      gradualRollback: true,
      testTrafficPercentage: 10, // 10%的测试流量
      successThresholdForRollback: 0.9, // 90%成功率
      rollbackEvaluationPeriod: 300000, // 5分钟评估期
    },
  };

  constructor() {
    this.initializeDefaultRules();
    this.startPerformanceMonitoring();

    secureLogger.info('🔄 跨Provider降级策略管理器已初始化');
  }

  /**
   * 初始化默认降级规则
   */
  private initializeDefaultRules(): void {
    // 默认类别降级规则
    this.addFallbackRule({
      category: 'default',
      primaryChain: [
        { provider: 'modelscope-qwen', model: 'Qwen/Qwen3-Coder-480B-A35B-Instruct', maxLatency: 15000, priority: 1 },
        { provider: 'shuaihong-horizon', model: 'horizon', maxLatency: 25000, priority: 2 },
        { provider: 'google-gemini', model: 'gemini-2.5-flash', maxLatency: 20000, priority: 3 },
      ],
      emergencyChain: [
        { provider: 'shuaihong-horizon', model: 'gpt-4o-mini', maxLatency: 30000, priority: 1 },
        { provider: 'google-gemini', model: 'gemini-2.0-flash-exp', maxLatency: 25000, priority: 2 },
      ],
      conditions: {
        triggerOnLatency: 20000,
        triggerOnErrorRate: 0.2,
        triggerOnConsecutiveFailures: 3,
        recoverySuccessThreshold: 0.85,
        recoveryTimeoutMs: 600000,
      },
    });

    // 长上下文类别
    this.addFallbackRule({
      category: 'longcontext',
      primaryChain: [
        { provider: 'google-gemini', model: 'gemini-2.5-pro', maxLatency: 25000, priority: 1 },
        { provider: 'google-gemini', model: 'gemini-2.5-flash', maxLatency: 20000, priority: 2 },
        { provider: 'modelscope-qwen', model: 'Qwen/Qwen3-235B-A22B-Instruct-2507', maxLatency: 30000, priority: 3 },
      ],
      emergencyChain: [
        { provider: 'shuaihong-horizon', model: 'horizon', maxLatency: 35000, priority: 1 },
        { provider: 'google-gemini', model: 'gemini-2.0-flash-exp', maxLatency: 25000, priority: 2 },
      ],
      conditions: {
        triggerOnLatency: 30000,
        triggerOnErrorRate: 0.15,
        triggerOnConsecutiveFailures: 2,
        recoverySuccessThreshold: 0.9,
        recoveryTimeoutMs: 900000,
      },
    });

    // 编码类别
    this.addFallbackRule({
      category: 'coding',
      primaryChain: [
        { provider: 'modelscope-qwen', model: 'Qwen/Qwen3-Coder-480B-A35B-Instruct', maxLatency: 15000, priority: 1 },
        { provider: 'modelscope-qwen', model: 'Qwen/Qwen3-Coder-30B-A3B-Instruct', maxLatency: 12000, priority: 2 },
        { provider: 'shuaihong-horizon', model: 'horizon', maxLatency: 25000, priority: 3 },
      ],
      emergencyChain: [
        { provider: 'google-gemini', model: 'gemini-2.5-flash', maxLatency: 20000, priority: 1 },
        { provider: 'shuaihong-horizon', model: 'gpt-4o-mini', maxLatency: 30000, priority: 2 },
      ],
      conditions: {
        triggerOnLatency: 18000,
        triggerOnErrorRate: 0.25,
        triggerOnConsecutiveFailures: 4,
        recoverySuccessThreshold: 0.8,
        recoveryTimeoutMs: 300000,
      },
    });

    // 后台和搜索类别
    ['background', 'search'].forEach(category => {
      this.addFallbackRule({
        category,
        primaryChain: [
          { provider: 'modelscope-qwen', model: 'Qwen/Qwen3-Coder-480B-A35B-Instruct', maxLatency: 20000, priority: 1 },
          { provider: 'shuaihong-horizon', model: 'horizon', maxLatency: 30000, priority: 2 },
          { provider: 'google-gemini', model: 'gemini-2.5-flash-lite', maxLatency: 15000, priority: 3 },
        ],
        emergencyChain: [
          { provider: 'google-gemini', model: 'gemini-2.0-flash-exp', maxLatency: 20000, priority: 1 },
          { provider: 'shuaihong-horizon', model: 'gpt-4o-mini', maxLatency: 25000, priority: 2 },
        ],
        conditions: {
          triggerOnLatency: 25000,
          triggerOnErrorRate: 0.3,
          triggerOnConsecutiveFailures: 5,
          recoverySuccessThreshold: 0.75,
          recoveryTimeoutMs: 180000,
        },
      });
    });
  }

  /**
   * 添加降级规则
   */
  addFallbackRule(rule: CrossProviderFallbackRule): void {
    this.fallbackRules.set(rule.category, rule);
    secureLogger.debug('➕ 添加跨Provider降级规则', { category: rule.category });
  }

  /**
   * 评估是否需要降级
   */
  async evaluateFallbackNeed(
    category: string,
    currentProvider: string,
    currentModel: string,
    recentMetrics: {
      latency: number;
      errorRate: number;
      consecutiveFailures: number;
    }
  ): Promise<FallbackDecision> {
    const rule = this.fallbackRules.get(category);
    if (!rule) {
      return this.createFallbackDecision('continue', currentProvider, currentModel, '没有找到对应的降级规则');
    }

    const currentMetrics = this.providerMetrics.get(currentProvider);
    if (!currentMetrics) {
      return this.createFallbackDecision('continue', currentProvider, currentModel, 'Provider性能指标缺失');
    }

    // 检查是否触发降级条件
    const shouldFallback = this.shouldTriggerFallback(rule, recentMetrics, currentMetrics);

    if (!shouldFallback.triggered) {
      return this.createFallbackDecision('continue', currentProvider, currentModel, shouldFallback.reason);
    }

    // 选择最佳降级目标
    const fallbackTarget = await this.selectBestFallbackTarget(rule, currentProvider, shouldFallback.severity);

    if (!fallbackTarget) {
      return this.createFallbackDecision('continue', currentProvider, currentModel, '没有可用的降级目标');
    }

    // 计算预期改善
    const expectedImprovement = this.calculateExpectedImprovement(currentMetrics, fallbackTarget);

    // 创建降级决策
    const action = shouldFallback.severity === 'emergency' ? 'emergency_fallback' : 'switch_provider';
    const decision = this.createFallbackDecision(
      action,
      fallbackTarget.provider,
      fallbackTarget.model,
      `${shouldFallback.reason}，切换到${fallbackTarget.provider}`,
      expectedImprovement
    );

    // 记录降级转换
    this.recordProviderTransition(currentProvider, fallbackTarget.provider, shouldFallback.reason);

    secureLogger.info('🔄 触发跨Provider降级', {
      category,
      from: `${currentProvider}/${currentModel}`,
      to: `${fallbackTarget.provider}/${fallbackTarget.model}`,
      reason: shouldFallback.reason,
      severity: shouldFallback.severity,
    });

    return decision;
  }

  /**
   * 检查是否应该触发降级
   */
  private shouldTriggerFallback(
    rule: CrossProviderFallbackRule,
    recentMetrics: any,
    currentMetrics: ProviderPerformanceMetrics
  ): { triggered: boolean; reason: string; severity: 'normal' | 'emergency' } {
    // 检查紧急条件
    if (recentMetrics.consecutiveFailures >= rule.conditions.triggerOnConsecutiveFailures * 2) {
      return { triggered: true, reason: '连续失败次数达到紧急阈值', severity: 'emergency' };
    }

    if (recentMetrics.latency >= this.strategyConfig.performanceThresholds.maxLatency) {
      return { triggered: true, reason: '延迟超过紧急阈值', severity: 'emergency' };
    }

    if (recentMetrics.errorRate >= 0.5) {
      return { triggered: true, reason: '错误率超过50%', severity: 'emergency' };
    }

    // 检查普通降级条件
    if (recentMetrics.consecutiveFailures >= rule.conditions.triggerOnConsecutiveFailures) {
      return { triggered: true, reason: '连续失败次数过多', severity: 'normal' };
    }

    if (recentMetrics.latency >= rule.conditions.triggerOnLatency) {
      return { triggered: true, reason: '延迟超过阈值', severity: 'normal' };
    }

    if (recentMetrics.errorRate >= rule.conditions.triggerOnErrorRate) {
      return { triggered: true, reason: '错误率过高', severity: 'normal' };
    }

    // 检查综合性能指标
    if (currentMetrics.qualityScore < this.strategyConfig.performanceThresholds.minQualityScore) {
      return { triggered: true, reason: '综合质量评分过低', severity: 'normal' };
    }

    if (currentMetrics.availability < this.strategyConfig.performanceThresholds.minAvailability) {
      return { triggered: true, reason: '可用性过低', severity: 'normal' };
    }

    return { triggered: false, reason: '性能指标正常', severity: 'normal' };
  }

  /**
   * 选择最佳降级目标
   */
  private async selectBestFallbackTarget(
    rule: CrossProviderFallbackRule,
    currentProvider: string,
    severity: 'normal' | 'emergency'
  ): Promise<{ provider: string; model: string; score: number } | null> {
    // 根据严重程度选择候选链
    const candidateChain = severity === 'emergency' ? rule.emergencyChain : rule.primaryChain;

    // 过滤掉当前Provider
    const availableCandidates = candidateChain.filter(candidate => candidate.provider !== currentProvider);

    if (availableCandidates.length === 0) {
      // 如果主链没有可用选项，尝试紧急链
      if (severity === 'normal') {
        return this.selectBestFallbackTarget(rule, currentProvider, 'emergency');
      }
      return null;
    }

    // 评估每个候选者的适合度
    const scoredCandidates = await Promise.all(
      availableCandidates.map(async candidate => {
        const score = await this.scoreFallbackCandidate(candidate, severity);
        return { ...candidate, score };
      })
    );

    // 过滤掉不可用的候选者
    const viableCandidates = scoredCandidates.filter(candidate => candidate.score > 0);

    if (viableCandidates.length === 0) return null;

    // 按评分排序，选择最佳候选者
    viableCandidates.sort((a, b) => b.score - a.score);
    const best = viableCandidates[0];

    return {
      provider: best.provider,
      model: best.model,
      score: best.score,
    };
  }

  /**
   * 评估降级候选者的适合度
   */
  private async scoreFallbackCandidate(
    candidate: { provider: string; model: string; maxLatency: number; priority: number },
    severity: 'normal' | 'emergency'
  ): Promise<number> {
    const metrics = this.providerMetrics.get(candidate.provider);
    if (!metrics) return 0; // 没有指标数据

    let score = 100;

    // 可用性检查
    if (metrics.availability < 0.9) score -= 50;
    if (metrics.availability < 0.8) return 0; // 不可用

    // 性能评估
    if (metrics.avgLatency > candidate.maxLatency) score -= 30;
    if (metrics.errorRate > 0.1) score -= 20;
    if (metrics.qualityScore < 70) score -= 25;

    // 容量检查
    const capacityRatio = metrics.currentCapacity / metrics.maxCapacity;
    if (capacityRatio > 0.9) score -= 15; // 容量紧张
    if (capacityRatio > 0.95) score -= 25; // 容量严重不足

    // 优先级奖励
    score += (5 - candidate.priority) * 10; // 优先级越高奖励越多

    // 紧急情况下更注重可用性
    if (severity === 'emergency') {
      score = score * (metrics.availability * 1.5); // 放大可用性权重
    }

    return Math.max(0, score);
  }

  /**
   * 计算预期改善
   */
  private calculateExpectedImprovement(
    currentMetrics: ProviderPerformanceMetrics,
    fallbackTarget: { provider: string; model: string; score: number }
  ): { latencyReduction: number; reliabilityIncrease: number; costImpact: number } {
    const targetMetrics = this.providerMetrics.get(fallbackTarget.provider);
    if (!targetMetrics) {
      return { latencyReduction: 0, reliabilityIncrease: 0, costImpact: 0 };
    }

    const latencyReduction = Math.max(0, currentMetrics.avgLatency - targetMetrics.avgLatency);
    const reliabilityIncrease = Math.max(0, targetMetrics.availability - currentMetrics.availability);
    const costImpact = targetMetrics.costPerRequest - currentMetrics.costPerRequest;

    return {
      latencyReduction: Math.round(latencyReduction),
      reliabilityIncrease: Math.round(reliabilityIncrease * 100), // 转换为百分比
      costImpact: Math.round(costImpact * 100) / 100, // 保留两位小数
    };
  }

  /**
   * 创建降级决策
   */
  private createFallbackDecision(
    action: 'continue' | 'switch_model' | 'switch_provider' | 'emergency_fallback',
    provider: string,
    model: string,
    reasoning: string,
    expectedImprovement?: any
  ): FallbackDecision {
    return {
      action,
      targetProvider: provider,
      targetModel: model,
      reasoning,
      expectedImprovement: expectedImprovement || {
        latencyReduction: 0,
        reliabilityIncrease: 0,
        costImpact: 0,
      },
      rollbackPlan: {
        enabled: action !== 'continue',
        conditions: ['目标Provider性能恢复', '新Provider表现不佳', '超过最大降级时间'],
        timeoutMs: 600000, // 10分钟
      },
    };
  }

  /**
   * 记录Provider转换
   */
  private recordProviderTransition(fromProvider: string, toProvider: string, reason: string): void {
    const transitionId = `${fromProvider}->${toProvider}`;

    this.activeTransitions.set(transitionId, {
      fromProvider,
      toProvider,
      startTime: new Date(),
      reason,
      expectedDuration: 600000, // 10分钟
    });

    // 清理过期的转换记录
    setTimeout(() => {
      this.activeTransitions.delete(transitionId);
    }, 3600000); // 1小时后清理
  }

  /**
   * 更新Provider性能指标
   */
  updateProviderMetrics(providerId: string, metrics: Partial<ProviderPerformanceMetrics>): void {
    const existing = this.providerMetrics.get(providerId) || {
      providerId,
      avgLatency: 0,
      p95Latency: 0,
      errorRate: 0,
      throughput: 0,
      availability: 1,
      costPerRequest: 0,
      currentCapacity: 0,
      maxCapacity: 100,
      qualityScore: 100,
    };

    const updated = { ...existing, ...metrics };

    // 重新计算综合质量评分
    updated.qualityScore = this.calculateQualityScore(updated);

    this.providerMetrics.set(providerId, updated);
  }

  /**
   * 计算综合质量评分
   */
  private calculateQualityScore(metrics: ProviderPerformanceMetrics): number {
    const weights = this.strategyConfig.decisionWeights;

    // 延迟评分 (越低越好)
    const latencyScore = Math.max(0, 100 - (metrics.avgLatency / 1000) * 2); // 每秒-2分

    // 可靠性评分
    const reliabilityScore = (1 - metrics.errorRate) * metrics.availability * 100;

    // 成本评分 (这里简化处理，实际应根据预算和性价比)
    const costScore = Math.max(0, 100 - metrics.costPerRequest * 1000);

    // 容量评分
    const capacityRatio = metrics.currentCapacity / metrics.maxCapacity;
    const capacityScore = Math.max(0, 100 - capacityRatio * 100);

    const totalScore =
      latencyScore * weights.latency +
      reliabilityScore * weights.reliability +
      costScore * weights.cost +
      capacityScore * weights.capacity;

    return Math.round(Math.max(0, Math.min(100, totalScore)));
  }

  /**
   * 启动性能监控
   */
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.evaluateRecoveryOpportunities();
      this.cleanupExpiredTransitions();
    }, 60000); // 每分钟检查一次

    secureLogger.info('📊 跨Provider性能监控已启动');
  }

  /**
   * 评估恢复机会
   */
  private async evaluateRecoveryOpportunities(): Promise<void> {
    for (const [transitionId, transition] of this.activeTransitions) {
      const originalMetrics = this.providerMetrics.get(transition.fromProvider);
      const currentMetrics = this.providerMetrics.get(transition.toProvider);

      if (!originalMetrics || !currentMetrics) continue;

      // 检查原Provider是否已恢复
      if (this.hasProviderRecovered(originalMetrics, transition.reason)) {
        secureLogger.info('🔄 检测到Provider恢复机会', {
          provider: transition.fromProvider,
          qualityScore: originalMetrics.qualityScore,
          availability: originalMetrics.availability,
        });

        // 这里可以触发回滚测试流量
        // 实际实现中需要协调路由器进行逐步回滚
      }
    }
  }

  /**
   * 检查Provider是否已恢复
   */
  private hasProviderRecovered(metrics: ProviderPerformanceMetrics, originalFailureReason: string): boolean {
    // 基本健康检查
    if (metrics.availability < 0.95) return false;
    if (metrics.errorRate > 0.05) return false;
    if (metrics.qualityScore < 80) return false;

    // 根据原始失败原因进行特定检查
    if (originalFailureReason.includes('延迟') && metrics.avgLatency > 15000) return false;
    if (originalFailureReason.includes('错误率') && metrics.errorRate > 0.02) return false;
    if (originalFailureReason.includes('连续失败') && metrics.qualityScore < 85) return false;

    return true;
  }

  /**
   * 清理过期的转换记录
   */
  private cleanupExpiredTransitions(): void {
    const now = Date.now();

    for (const [transitionId, transition] of this.activeTransitions) {
      const elapsed = now - transition.startTime.getTime();

      if (elapsed > transition.expectedDuration) {
        this.activeTransitions.delete(transitionId);
        secureLogger.debug('🧹 清理过期的Provider转换记录', { transitionId });
      }
    }
  }

  /**
   * 获取降级策略状态
   */
  getStrategyStatus(): {
    activeRules: string[];
    activeTransitions: Array<{
      from: string;
      to: string;
      duration: number;
      reason: string;
    }>;
    providerMetrics: ProviderPerformanceMetrics[];
    recommendations: string[];
  } {
    const activeRules = Array.from(this.fallbackRules.keys());

    const activeTransitions = Array.from(this.activeTransitions.entries()).map(([id, transition]) => ({
      from: transition.fromProvider,
      to: transition.toProvider,
      duration: Date.now() - transition.startTime.getTime(),
      reason: transition.reason,
    }));

    const providerMetrics = Array.from(this.providerMetrics.values());

    // 生成建议
    const recommendations = this.generateRecommendations();

    return {
      activeRules,
      activeTransitions,
      providerMetrics,
      recommendations,
    };
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    for (const [providerId, metrics] of this.providerMetrics) {
      if (metrics.qualityScore < 70) {
        recommendations.push(`Provider ${providerId} 质量评分过低 (${metrics.qualityScore}分)，建议检查配置`);
      }

      if (metrics.availability < 0.9) {
        recommendations.push(
          `Provider ${providerId} 可用性过低 (${(metrics.availability * 100).toFixed(1)}%)，建议增加监控`
        );
      }

      const capacityRatio = metrics.currentCapacity / metrics.maxCapacity;
      if (capacityRatio > 0.8) {
        recommendations.push(`Provider ${providerId} 容量使用率过高 (${(capacityRatio * 100).toFixed(1)}%)，建议扩容`);
      }
    }

    if (this.activeTransitions.size > 2) {
      recommendations.push('当前活跃的Provider转换过多，建议检查系统稳定性');
    }

    return recommendations;
  }
}
