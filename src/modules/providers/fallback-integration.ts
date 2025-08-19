/**
 * Fallback Integration Module
 *
 * 整合条件性Fallback解析器与现有的Provider Manager
 * 提供统一的fallback策略执行接口
 *
 * @deprecated DEPRECATED: 根据RCC v4.0零fallback策略，此模块已被完全废弃
 * @deprecated 违反 Zero Fallback Policy Rule ZF-001 - 禁止任何形式的fallback集成
 * @deprecated 替代方案: 直接使用Provider Manager，失败时立即抛出错误
 * @author Jason Zhang
 * @version 4.0.0
 * @see .claude/rules/zero-fallback-policy.md
 */

import { EventEmitter } from 'events';
import { secureLogger } from '../../utils/secure-logger';
import {
  ConditionalFallbackResolver,
  FallbackResolverConfig,
  FallbackResolutionResult,
} from './conditional-fallback-resolver';
import { RoutingConfiguration } from '../../config/v4-config-loader';

export interface FallbackIntegrationConfig {
  routing: RoutingConfiguration;
  providerCategories: Record<string, string[]>;
  debugMode?: boolean;
}

export interface ProviderExecutionContext {
  requestId: string;
  category: string;
  provider: string;
  model: string;
  attempt: number;
  startTime: Date;
  metadata?: Record<string, any>;
}

export interface ProviderExecutionResult {
  success: boolean;
  result?: any;
  error?: Error;
  metrics: {
    latency: number;
    errorRate: number;
    consecutiveFailures: number;
  };
  fallbackResolution?: FallbackResolutionResult;
}

/**
 * Fallback集成管理器
 *
 * 协调各种fallback策略并提供统一的执行接口
 */
export class FallbackIntegrationManager extends EventEmitter {
  private fallbackResolver: ConditionalFallbackResolver;
  private config: FallbackIntegrationConfig;
  private providerMetrics: Map<
    string,
    {
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      consecutiveFailures: number;
      lastFailureTime?: Date;
      averageLatency: number;
    }
  > = new Map();

  constructor(config: FallbackIntegrationConfig) {
    super();
    this.config = config;

    // 从routing配置创建fallback resolver配置
    const resolverConfig: FallbackResolverConfig = {
      zeroFallbackPolicy: config.routing.zeroFallbackPolicy,
      strictErrorReporting: config.routing.strictErrorReporting,
      allowEmergencyFallback: (config.routing as any).allowEmergencyFallback || false,
      emergencyThresholds: (config.routing as any).emergencyThresholds || {
        consecutiveFailures: 5,
        errorRateThreshold: 0.8,
        criticalLatencyMs: 60000,
      },
      debugMode: config.debugMode || false,
    };

    this.fallbackResolver = new ConditionalFallbackResolver(resolverConfig);

    // 监听fallback resolver事件
    this.setupFallbackResolverEventHandlers();

    secureLogger.info('🔗 Fallback集成管理器已初始化', {
      zeroFallbackPolicy: resolverConfig.zeroFallbackPolicy,
      allowEmergencyFallback: resolverConfig.allowEmergencyFallback,
      providerCategoriesCount: Object.keys(config.providerCategories).length,
    });
  }

  /**
   * 执行Provider请求（带fallback处理）
   */
  async executeWithFallbackHandling(
    context: ProviderExecutionContext,
    executeFunction: () => Promise<any>
  ): Promise<ProviderExecutionResult> {
    const startTime = Date.now();

    try {
      // 1. 执行主要请求
      const result = await executeFunction();

      // 2. 记录成功指标
      this.recordProviderSuccess(context.provider, Date.now() - startTime);

      // 3. 发送成功事件
      this.emit('provider-execution-success', {
        context,
        result,
        latency: Date.now() - startTime,
      });

      return {
        success: true,
        result,
        metrics: this.getProviderMetrics(context.provider),
      };
    } catch (error) {
      // 4. 记录失败指标
      const metrics = this.recordProviderFailure(context.provider, Date.now() - startTime);

      // 5. 评估fallback需求
      const fallbackResolution = await this.fallbackResolver.resolveFallbackNeed(
        context.category,
        context.provider,
        context.model,
        metrics,
        error as Error
      );

      // 6. 处理fallback决策
      const executionResult = await this.handleFallbackResolution(context, fallbackResolution, error as Error);

      // 7. 发送失败事件
      this.emit('provider-execution-failure', {
        context,
        error: error as Error,
        metrics,
        fallbackResolution,
        finalResult: executionResult,
      });

      return executionResult;
    }
  }

  /**
   * 处理fallback解析结果
   */
  private async handleFallbackResolution(
    context: ProviderExecutionContext,
    resolution: FallbackResolutionResult,
    originalError: Error
  ): Promise<ProviderExecutionResult> {
    const metrics = this.getProviderMetrics(context.provider);

    switch (resolution.action) {
      case 'error_propagation':
      case 'no_fallback':
        // 直接传播错误，不执行fallback
        return {
          success: false,
          error: resolution.errorToPropagate || originalError,
          metrics,
          fallbackResolution: resolution,
        };

      case 'emergency_fallback':
        if (resolution.decision) {
          return await this.executeEmergencyFallback(context, resolution, metrics);
        }
        break;

      case 'conditional_fallback':
        if (resolution.decision) {
          return await this.executeConditionalFallback(context, resolution, metrics);
        }
        break;
    }

    // 默认：传播原始错误
    return {
      success: false,
      error: originalError,
      metrics,
      fallbackResolution: resolution,
    };
  }

  /**
   * 执行紧急fallback
   */
  private async executeEmergencyFallback(
    context: ProviderExecutionContext,
    resolution: FallbackResolutionResult,
    metrics: any
  ): Promise<ProviderExecutionResult> {
    if (!resolution.decision) {
      throw new Error('Emergency fallback decision is missing');
    }

    secureLogger.warn('🚨 执行紧急fallback', {
      from: `${context.provider}/${context.model}`,
      to: `${resolution.decision.targetProvider}/${resolution.decision.targetModel}`,
      reasoning: resolution.decision.reasoning,
    });

    this.emit('emergency-fallback-execution', {
      originalContext: context,
      fallbackTarget: {
        provider: resolution.decision.targetProvider,
        model: resolution.decision.targetModel,
      },
      reasoning: resolution.decision.reasoning,
    });

    // 这里实际应该调用新的provider，但目前只返回fallback信息
    return {
      success: false,
      error: new Error(`Emergency fallback triggered: ${resolution.decision.reasoning}`),
      metrics,
      fallbackResolution: resolution,
    };
  }

  /**
   * 执行条件性fallback
   */
  private async executeConditionalFallback(
    context: ProviderExecutionContext,
    resolution: FallbackResolutionResult,
    metrics: any
  ): Promise<ProviderExecutionResult> {
    if (!resolution.decision) {
      throw new Error('Conditional fallback decision is missing');
    }

    secureLogger.info('🔄 执行条件性fallback', {
      from: `${context.provider}/${context.model}`,
      to: `${resolution.decision.targetProvider}/${resolution.decision.targetModel}`,
      reasoning: resolution.decision.reasoning,
    });

    this.emit('conditional-fallback-execution', {
      originalContext: context,
      fallbackTarget: {
        provider: resolution.decision.targetProvider,
        model: resolution.decision.targetModel,
      },
      reasoning: resolution.decision.reasoning,
    });

    // 这里实际应该调用新的provider，但目前只返回fallback信息
    return {
      success: false,
      error: new Error(`Conditional fallback triggered: ${resolution.decision.reasoning}`),
      metrics,
      fallbackResolution: resolution,
    };
  }

  /**
   * 记录Provider成功
   */
  private recordProviderSuccess(provider: string, latency: number): void {
    const metrics = this.providerMetrics.get(provider) || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      consecutiveFailures: 0,
      averageLatency: 0,
    };

    metrics.totalRequests++;
    metrics.successfulRequests++;
    metrics.consecutiveFailures = 0; // 重置连续失败计数
    metrics.lastFailureTime = undefined;

    // 更新平均延迟
    metrics.averageLatency = (metrics.averageLatency * (metrics.totalRequests - 1) + latency) / metrics.totalRequests;

    this.providerMetrics.set(provider, metrics);
  }

  /**
   * 记录Provider失败
   */
  private recordProviderFailure(
    provider: string,
    latency: number
  ): {
    latency: number;
    errorRate: number;
    consecutiveFailures: number;
  } {
    const metrics = this.providerMetrics.get(provider) || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      consecutiveFailures: 0,
      averageLatency: 0,
    };

    metrics.totalRequests++;
    metrics.failedRequests++;
    metrics.consecutiveFailures++;
    metrics.lastFailureTime = new Date();

    // 更新平均延迟
    metrics.averageLatency = (metrics.averageLatency * (metrics.totalRequests - 1) + latency) / metrics.totalRequests;

    this.providerMetrics.set(provider, metrics);

    const errorRate = metrics.failedRequests / metrics.totalRequests;

    return {
      latency,
      errorRate,
      consecutiveFailures: metrics.consecutiveFailures,
    };
  }

  /**
   * 获取Provider指标
   */
  private getProviderMetrics(provider: string): {
    latency: number;
    errorRate: number;
    consecutiveFailures: number;
  } {
    const metrics = this.providerMetrics.get(provider);

    if (!metrics) {
      return {
        latency: 0,
        errorRate: 0,
        consecutiveFailures: 0,
      };
    }

    return {
      latency: metrics.averageLatency,
      errorRate: metrics.failedRequests / metrics.totalRequests,
      consecutiveFailures: metrics.consecutiveFailures,
    };
  }

  /**
   * 设置fallback resolver事件处理器
   */
  private setupFallbackResolverEventHandlers(): void {
    this.fallbackResolver.on('fallback-blocked', data => {
      this.emit('fallback-blocked', data);
      secureLogger.info('🚫 Fallback被策略阻止', data);
    });

    this.fallbackResolver.on('emergency-mode-activated', data => {
      this.emit('emergency-mode-activated', data);
      secureLogger.warn('🚨 紧急模式已激活', data);
    });

    this.fallbackResolver.on('emergency-mode-deactivated', data => {
      this.emit('emergency-mode-deactivated', data);
      secureLogger.info('🔕 紧急模式已停用', data);
    });

    this.fallbackResolver.on('config-updated', data => {
      this.emit('resolver-config-updated', data);
    });
  }

  /**
   * 获取整体状态
   */
  getIntegrationStatus(): {
    resolverStatus: any;
    providerMetrics: Record<string, any>;
    config: FallbackIntegrationConfig;
    recommendations: string[];
  } {
    const resolverStatus = this.fallbackResolver.getStatus();

    const providerMetricsObj: Record<string, any> = {};
    for (const [provider, metrics] of this.providerMetrics.entries()) {
      providerMetricsObj[provider] = {
        ...metrics,
        errorRate: metrics.failedRequests / Math.max(1, metrics.totalRequests),
      };
    }

    const recommendations = this.generateRecommendations();

    return {
      resolverStatus,
      providerMetrics: providerMetricsObj,
      config: this.config,
      recommendations,
    };
  }

  /**
   * 生成配置建议
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // 检查高失败率的provider
    for (const [provider, metrics] of this.providerMetrics.entries()) {
      const errorRate = metrics.failedRequests / Math.max(1, metrics.totalRequests);

      if (errorRate > 0.3) {
        recommendations.push(`Provider ${provider} 错误率过高 (${(errorRate * 100).toFixed(1)}%)，建议检查配置`);
      }

      if (metrics.consecutiveFailures >= 3) {
        recommendations.push(`Provider ${provider} 连续失败 ${metrics.consecutiveFailures} 次，可能需要重启或检修`);
      }

      if (metrics.averageLatency > 30000) {
        recommendations.push(`Provider ${provider} 平均延迟过高 (${metrics.averageLatency}ms)，建议优化网络或配置`);
      }
    }

    // 检查零fallback策略的影响
    if (this.config.routing.zeroFallbackPolicy && !(this.config.routing as any).allowEmergencyFallback) {
      const highFailureProviders = Array.from(this.providerMetrics.entries()).filter(
        ([, metrics]) => metrics.failedRequests / Math.max(1, metrics.totalRequests) > 0.2
      ).length;

      if (highFailureProviders > 0) {
        recommendations.push('零fallback策略下存在高失败率Provider，考虑启用allowEmergencyFallback以提高可用性');
      }
    }

    return recommendations;
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<FallbackIntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (newConfig.routing) {
      const resolverConfig: Partial<FallbackResolverConfig> = {
        zeroFallbackPolicy: newConfig.routing.zeroFallbackPolicy,
        strictErrorReporting: newConfig.routing.strictErrorReporting,
        allowEmergencyFallback: (newConfig.routing as any).allowEmergencyFallback,
        emergencyThresholds: (newConfig.routing as any).emergencyThresholds,
      };

      this.fallbackResolver.updateConfig(resolverConfig);
    }

    this.emit('integration-config-updated', {
      newConfig: this.config,
      timestamp: Date.now(),
    });
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    await this.fallbackResolver.cleanup();
    this.removeAllListeners();
    this.providerMetrics.clear();

    secureLogger.info('🧹 Fallback集成管理器已清理');
  }
}

/**
 * 工厂函数
 */
export function createFallbackIntegration(config: FallbackIntegrationConfig): FallbackIntegrationManager {
  return new FallbackIntegrationManager(config);
}
