/**
 * Conditional Fallback Resolver
 *
 * 解决zeroFallbackPolicy与CrossProviderFallbackStrategy之间的冲突
 * 根据配置动态启用或禁用fallback功能
 *
 * @deprecated DEPRECATED: 根据RCC v4.0零fallback策略，此类已被完全废弃
 * @deprecated 违反 Zero Fallback Policy Rule ZF-001 - 禁止任何形式的fallback解析器
 * @deprecated 冲突解决方案: 移除所有fallback机制，使用直接错误抛出
 * @author Jason Zhang
 * @version 4.0.0
 * @see .claude/rules/zero-fallback-policy.md
 */

import { EventEmitter } from 'events';
import { secureLogger } from '../../utils/secure-logger';
import { CrossProviderFallbackStrategy, FallbackDecision } from './cross-provider-fallback-strategy';

export interface FallbackResolverConfig {
  zeroFallbackPolicy: boolean;
  strictErrorReporting: boolean;
  allowEmergencyFallback?: boolean;
  emergencyThresholds?: {
    consecutiveFailures: number;
    errorRateThreshold: number;
    criticalLatencyMs: number;
  };
  debugMode?: boolean;
}

export interface FallbackResolutionResult {
  action: 'no_fallback' | 'emergency_fallback' | 'conditional_fallback' | 'error_propagation';
  decision?: FallbackDecision;
  reasoning: string;
  policyEnforced: boolean;
  errorToPropagate?: Error;
}

/**
 * 条件性Fallback解析器
 *
 * 负责协调zeroFallbackPolicy配置与CrossProviderFallbackStrategy的冲突
 * 确保配置策略的强制执行，同时保留紧急情况下的灵活性
 */
export class ConditionalFallbackResolver extends EventEmitter {
  private config: FallbackResolverConfig;
  private fallbackStrategy?: CrossProviderFallbackStrategy;
  private emergencyModeActive = false;
  private emergencyActivationTime?: Date;
  private readonly EMERGENCY_MODE_TIMEOUT = 10 * 60 * 1000; // 10分钟

  constructor(config: FallbackResolverConfig) {
    super();
    this.config = { ...config };
    this.validateConfig();

    // 根据配置决定是否初始化fallback策略
    if (!this.config.zeroFallbackPolicy || this.config.allowEmergencyFallback) {
      this.fallbackStrategy = new CrossProviderFallbackStrategy();
      secureLogger.info('🔄 CrossProviderFallbackStrategy已初始化（条件性启用）');
    }

    secureLogger.info('⚖️ 条件性Fallback解析器已初始化', {
      zeroFallbackPolicy: this.config.zeroFallbackPolicy,
      emergencyFallbackAllowed: this.config.allowEmergencyFallback,
    });
  }

  /**
   * 解析fallback需求
   */
  async resolveFallbackNeed(
    category: string,
    currentProvider: string,
    currentModel: string,
    recentMetrics: {
      latency: number;
      errorRate: number;
      consecutiveFailures: number;
    },
    originalError: Error
  ): Promise<FallbackResolutionResult> {
    // 1. 检查是否处于紧急模式
    this.checkEmergencyModeExpiry();

    // 2. 强制执行零fallback策略
    if (this.config.zeroFallbackPolicy && !this.config.allowEmergencyFallback) {
      return this.enforceZeroFallbackPolicy(originalError);
    }

    // 3. 评估是否需要激活紧急模式
    if (this.config.zeroFallbackPolicy && this.config.allowEmergencyFallback) {
      const emergencyNeeded = this.evaluateEmergencyNeed(recentMetrics);

      if (emergencyNeeded && !this.emergencyModeActive) {
        return await this.activateEmergencyMode(category, currentProvider, currentModel, recentMetrics, originalError);
      } else if (!emergencyNeeded) {
        return this.enforceZeroFallbackPolicy(originalError);
      }
    }

    // 4. 正常fallback逻辑（当zeroFallbackPolicy=false时）
    if (!this.config.zeroFallbackPolicy && this.fallbackStrategy) {
      return await this.executeNormalFallback(category, currentProvider, currentModel, recentMetrics);
    }

    // 5. 默认：错误传播
    return this.enforceZeroFallbackPolicy(originalError);
  }

  /**
   * 强制执行零fallback策略
   */
  private enforceZeroFallbackPolicy(originalError: Error): FallbackResolutionResult {
    const enhancedError = new Error(`[Zero Fallback Policy] ${originalError.message}`);
    enhancedError.stack = originalError.stack;

    this.emit('fallback-blocked', {
      reason: 'zero-fallback-policy',
      originalError: originalError.message,
      timestamp: Date.now(),
    });

    secureLogger.info('🚫 Fallback被零策略阻止', {
      policy: 'zeroFallbackPolicy',
      originalError: originalError.message,
    });

    return {
      action: 'error_propagation',
      reasoning: 'Zero fallback policy enforced - all fallbacks disabled',
      policyEnforced: true,
      errorToPropagate: enhancedError,
    };
  }

  /**
   * 评估是否需要紧急模式
   */
  private evaluateEmergencyNeed(metrics: { latency: number; errorRate: number; consecutiveFailures: number }): boolean {
    const thresholds = this.config.emergencyThresholds || {
      consecutiveFailures: 5,
      errorRateThreshold: 0.8,
      criticalLatencyMs: 60000,
    };

    // 连续失败过多
    if (metrics.consecutiveFailures >= thresholds.consecutiveFailures) {
      return true;
    }

    // 错误率过高
    if (metrics.errorRate >= thresholds.errorRateThreshold) {
      return true;
    }

    // 延迟严重超标
    if (metrics.latency >= thresholds.criticalLatencyMs) {
      return true;
    }

    return false;
  }

  /**
   * 激活紧急模式
   */
  private async activateEmergencyMode(
    category: string,
    currentProvider: string,
    currentModel: string,
    recentMetrics: any,
    originalError: Error
  ): Promise<FallbackResolutionResult> {
    if (!this.fallbackStrategy) {
      return this.enforceZeroFallbackPolicy(originalError);
    }

    this.emergencyModeActive = true;
    this.emergencyActivationTime = new Date();

    this.emit('emergency-mode-activated', {
      category,
      provider: currentProvider,
      model: currentModel,
      metrics: recentMetrics,
      activatedAt: this.emergencyActivationTime,
      timeout: this.EMERGENCY_MODE_TIMEOUT,
    });

    secureLogger.warn('🚨 紧急模式已激活', {
      category,
      provider: currentProvider,
      metrics: recentMetrics,
      reason: '达到紧急阈值，临时启用fallback',
    });

    try {
      const fallbackDecision = await this.fallbackStrategy.evaluateFallbackNeed(
        category,
        currentProvider,
        currentModel,
        recentMetrics
      );

      // 只允许紧急fallback
      if (fallbackDecision.action === 'emergency_fallback') {
        return {
          action: 'emergency_fallback',
          decision: fallbackDecision,
          reasoning: 'Emergency fallback activated due to critical service degradation',
          policyEnforced: false,
        };
      } else {
        // 即使在紧急模式下，如果策略建议继续，则遵守零fallback
        return this.enforceZeroFallbackPolicy(originalError);
      }
    } catch (error) {
      secureLogger.error('紧急模式fallback评估失败', error);
      return this.enforceZeroFallbackPolicy(originalError);
    }
  }

  /**
   * 执行正常fallback逻辑
   */
  private async executeNormalFallback(
    category: string,
    currentProvider: string,
    currentModel: string,
    recentMetrics: any
  ): Promise<FallbackResolutionResult> {
    if (!this.fallbackStrategy) {
      throw new Error('Fallback strategy not initialized');
    }

    try {
      const fallbackDecision = await this.fallbackStrategy.evaluateFallbackNeed(
        category,
        currentProvider,
        currentModel,
        recentMetrics
      );

      this.emit('fallback-evaluated', {
        category,
        provider: currentProvider,
        decision: fallbackDecision.action,
        timestamp: Date.now(),
      });

      return {
        action: 'conditional_fallback',
        decision: fallbackDecision,
        reasoning: 'Normal fallback evaluation completed',
        policyEnforced: false,
      };
    } catch (error) {
      secureLogger.error('正常fallback评估失败', error);

      return {
        action: 'error_propagation',
        reasoning: 'Fallback evaluation failed',
        policyEnforced: false,
        errorToPropagate: error as Error,
      };
    }
  }

  /**
   * 检查紧急模式是否过期
   */
  private checkEmergencyModeExpiry(): void {
    if (!this.emergencyModeActive || !this.emergencyActivationTime) {
      return;
    }

    const now = Date.now();
    const elapsed = now - this.emergencyActivationTime.getTime();

    if (elapsed >= this.EMERGENCY_MODE_TIMEOUT) {
      this.deactivateEmergencyMode();
    }
  }

  /**
   * 停用紧急模式
   */
  private deactivateEmergencyMode(): void {
    if (!this.emergencyModeActive) return;

    this.emergencyModeActive = false;
    const duration = this.emergencyActivationTime ? Date.now() - this.emergencyActivationTime.getTime() : 0;

    this.emit('emergency-mode-deactivated', {
      duration,
      deactivatedAt: new Date(),
    });

    secureLogger.info('🔕 紧急模式已停用', {
      duration,
      reason: '超时或条件恢复',
    });

    this.emergencyActivationTime = undefined;
  }

  /**
   * 手动停用紧急模式
   */
  deactivateEmergencyModeManually(): void {
    if (this.emergencyModeActive) {
      this.deactivateEmergencyMode();
      secureLogger.info('🔕 紧急模式手动停用');
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<FallbackResolverConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    this.validateConfig();

    // 如果zeroFallbackPolicy发生变化，需要重新初始化策略
    if (oldConfig.zeroFallbackPolicy !== this.config.zeroFallbackPolicy) {
      if (!this.config.zeroFallbackPolicy && !this.fallbackStrategy) {
        this.fallbackStrategy = new CrossProviderFallbackStrategy();
        secureLogger.info('🔄 CrossProviderFallbackStrategy已启用');
      } else if (this.config.zeroFallbackPolicy && !this.config.allowEmergencyFallback) {
        this.fallbackStrategy = undefined;
        this.deactivateEmergencyMode();
        secureLogger.info('🚫 CrossProviderFallbackStrategy已禁用');
      }
    }

    this.emit('config-updated', {
      oldConfig,
      newConfig: this.config,
      timestamp: Date.now(),
    });
  }

  /**
   * 获取当前状态
   */
  getStatus(): {
    config: FallbackResolverConfig;
    emergencyModeActive: boolean;
    emergencyActivationTime?: Date;
    fallbackStrategyAvailable: boolean;
    timeUntilEmergencyExpiry?: number;
  } {
    const timeUntilExpiry =
      this.emergencyModeActive && this.emergencyActivationTime
        ? Math.max(0, this.EMERGENCY_MODE_TIMEOUT - (Date.now() - this.emergencyActivationTime.getTime()))
        : undefined;

    return {
      config: { ...this.config },
      emergencyModeActive: this.emergencyModeActive,
      emergencyActivationTime: this.emergencyActivationTime,
      fallbackStrategyAvailable: !!this.fallbackStrategy,
      timeUntilEmergencyExpiry: timeUntilExpiry,
    };
  }

  /**
   * 验证配置
   */
  private validateConfig(): void {
    if (this.config.zeroFallbackPolicy && this.config.allowEmergencyFallback && !this.config.emergencyThresholds) {
      this.config.emergencyThresholds = {
        consecutiveFailures: 5,
        errorRateThreshold: 0.8,
        criticalLatencyMs: 60000,
      };

      secureLogger.info('🔧 应用默认紧急阈值配置');
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.deactivateEmergencyMode();
    this.removeAllListeners();

    secureLogger.info('🧹 条件性Fallback解析器已清理');
  }
}

/**
 * 解析器工厂函数
 */
export function createFallbackResolver(config: FallbackResolverConfig): ConditionalFallbackResolver {
  return new ConditionalFallbackResolver(config);
}

/**
 * 配置验证器
 */
export function validateFallbackResolverConfig(config: any): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof config.zeroFallbackPolicy !== 'boolean') {
    errors.push('zeroFallbackPolicy must be a boolean');
  }

  if (typeof config.strictErrorReporting !== 'boolean') {
    errors.push('strictErrorReporting must be a boolean');
  }

  if (config.allowEmergencyFallback && !config.emergencyThresholds) {
    warnings.push('Emergency fallback enabled but no thresholds specified, will use defaults');
  }

  if (config.zeroFallbackPolicy && config.allowEmergencyFallback) {
    warnings.push('Zero fallback policy with emergency fallback creates hybrid behavior');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
