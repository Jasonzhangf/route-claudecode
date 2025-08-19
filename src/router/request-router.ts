/**
 * DEPRECATED: This file has been replaced by src/modules/routing/core-router.ts
 *
 * ❌ DO NOT USE: This request router is deprecated
 * ✅ USE INSTEAD: src/modules/routing/core-router.ts - CoreRouter
 *
 * The new CoreRouter provides pure routing decisions with zero fallback policy.
 *
 * @deprecated Use CoreRouter from src/modules/routing/core-router.ts instead
 * @see src/modules/routing/core-router.ts
 */

import { EventEmitter } from 'events';
import { IPipelineProtocolMatcher, ExecutionResult, ExecutionContext } from '../interfaces/core/pipeline-abstraction';

/**
 * 路由策略接口
 */
export interface IRoutingStrategy {
  route(request: RoutingRequest): Promise<RoutingDecision>;
  getName(): string;
  getPriority(): number;
}

/**
 * 路由请求
 */
export interface RoutingRequest {
  protocol: string;
  model?: string;
  content: any;
  context: ExecutionContext;
  metadata?: Record<string, any>;
}

/**
 * 路由决策
 */
export interface RoutingDecision {
  target: RoutingTarget;
  confidence: number;
  reason: string;
  transformations?: RequestTransformation[];
}

/**
 * 路由目标
 */
export interface RoutingTarget {
  type: 'pipeline' | 'provider';
  id: string;
  name: string;
  weight: number;
  healthScore: number;
}

/**
 * 请求转换
 */
export interface RequestTransformation {
  type: 'format' | 'model' | 'parameters';
  description: string;
  apply(request: any): any;
}

/**
 * 路由统计
 */
export interface RoutingStats {
  totalRequests: number;
  successfulRoutes: number;
  failedRoutes: number;
  averageResponseTime: number;
  routingByStrategy: Record<string, number>;
  routingByTarget: Record<string, number>;
}

/**
 * 智能请求路由器
 */
export class RequestRouter extends EventEmitter {
  private strategies: Map<string, IRoutingStrategy> = new Map();
  private protocolMatcher: IPipelineProtocolMatcher;
  private stats: RoutingStats;
  private routingCache: Map<string, RoutingDecision> = new Map();
  private cacheEnabled = true;
  private cacheTTL = 60000; // 1分钟缓存

  constructor(protocolMatcher: IPipelineProtocolMatcher) {
    super();
    this.protocolMatcher = protocolMatcher;
    this.stats = {
      totalRequests: 0,
      successfulRoutes: 0,
      failedRoutes: 0,
      averageResponseTime: 0,
      routingByStrategy: {},
      routingByTarget: {},
    };

    this.registerDefaultStrategies();
  }

  /**
   * 路由请求
   */
  async route(request: RoutingRequest): Promise<RoutingDecision> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      // 检查缓存
      const cacheKey = this.generateCacheKey(request);
      if (this.cacheEnabled && this.routingCache.has(cacheKey)) {
        const cached = this.routingCache.get(cacheKey)!;
        this.emit('routeCached', { request, decision: cached });
        return cached;
      }

      // 获取可用策略
      const strategies = Array.from(this.strategies.values()).sort((a, b) => b.getPriority() - a.getPriority());

      let bestDecision: RoutingDecision | null = null;
      let bestConfidence = 0;

      // 尝试每个策略
      for (const strategy of strategies) {
        try {
          const decision = await strategy.route(request);

          if (decision.confidence > bestConfidence) {
            bestDecision = decision;
            bestConfidence = decision.confidence;
          }

          // 如果找到高置信度的决策，立即使用
          if (decision.confidence >= 0.9) {
            break;
          }
        } catch (error) {
          console.warn(`Routing strategy ${strategy.getName()} failed:`, error);
        }
      }

      if (!bestDecision) {
        throw new Error('No routing strategy could handle the request');
      }

      // 缓存决策
      if (this.cacheEnabled) {
        this.routingCache.set(cacheKey, bestDecision);
        setTimeout(() => {
          this.routingCache.delete(cacheKey);
        }, this.cacheTTL);
      }

      // 更新统计
      this.stats.successfulRoutes++;
      this.updateStats(bestDecision, Date.now() - startTime);

      this.emit('routeDecision', { request, decision: bestDecision });
      return bestDecision;
    } catch (error) {
      this.stats.failedRoutes++;
      this.emit('routeError', { request, error });
      throw error;
    }
  }

  /**
   * 注册路由策略
   */
  registerStrategy(strategy: IRoutingStrategy): void {
    this.strategies.set(strategy.getName(), strategy);
    this.emit('strategyRegistered', { strategy: strategy.getName() });
  }

  /**
   * 移除路由策略
   */
  unregisterStrategy(name: string): void {
    this.strategies.delete(name);
    this.emit('strategyUnregistered', { strategy: name });
  }

  /**
   * 获取路由统计
   */
  getStats(): RoutingStats {
    return { ...this.stats };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRoutes: 0,
      failedRoutes: 0,
      averageResponseTime: 0,
      routingByStrategy: {},
      routingByTarget: {},
    };
  }

  /**
   * 设置缓存配置
   */
  setCacheConfig(enabled: boolean, ttl?: number): void {
    this.cacheEnabled = enabled;
    if (ttl) {
      this.cacheTTL = ttl;
    }

    if (!enabled) {
      this.routingCache.clear();
    }
  }

  /**
   * 注册默认路由策略
   */
  private registerDefaultStrategies(): void {
    // 协议匹配策略
    this.registerStrategy(new ProtocolMatchingStrategy(this.protocolMatcher));

    // 负载均衡策略
    this.registerStrategy(new LoadBalancingStrategy(this.protocolMatcher));

    // 健康状态策略
    this.registerStrategy(new HealthBasedStrategy(this.protocolMatcher));
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(request: RoutingRequest): string {
    return `${request.protocol}:${request.model}:${request.context.priority}`;
  }

  /**
   * 更新统计
   */
  private updateStats(decision: RoutingDecision, responseTime: number): void {
    // 更新平均响应时间
    const total = this.stats.totalRequests;
    this.stats.averageResponseTime = (this.stats.averageResponseTime * (total - 1) + responseTime) / total;

    // 更新目标统计
    const targetKey = `${decision.target.type}:${decision.target.id}`;
    this.stats.routingByTarget[targetKey] = (this.stats.routingByTarget[targetKey] || 0) + 1;
  }
}

/**
 * 协议匹配策略
 */
export class ProtocolMatchingStrategy implements IRoutingStrategy {
  private protocolMatcher: IPipelineProtocolMatcher;

  constructor(protocolMatcher: IPipelineProtocolMatcher) {
    this.protocolMatcher = protocolMatcher;
  }

  getName(): string {
    return 'protocol-matching';
  }

  getPriority(): number {
    return 100; // 高优先级
  }

  async route(request: RoutingRequest): Promise<RoutingDecision> {
    const pipeline = this.protocolMatcher.findPipelineByProtocol(request.protocol, request.model);

    if (!pipeline) {
      throw new Error(`No pipeline found for protocol ${request.protocol}`);
    }

    const status = pipeline.getStatus();
    const confidence = status.health.healthy ? 0.8 : 0.3;

    return {
      target: {
        type: 'pipeline',
        id: pipeline.getId(),
        name: pipeline.getName(),
        weight: 1.0,
        healthScore: confidence,
      },
      confidence,
      reason: `Protocol ${request.protocol} matched to pipeline ${pipeline.getName()}`,
    };
  }
}

/**
 * 负载均衡策略
 */
export class LoadBalancingStrategy implements IRoutingStrategy {
  private protocolMatcher: IPipelineProtocolMatcher;

  constructor(protocolMatcher: IPipelineProtocolMatcher) {
    this.protocolMatcher = protocolMatcher;
  }

  getName(): string {
    return 'load-balancing';
  }

  getPriority(): number {
    return 80;
  }

  async route(request: RoutingRequest): Promise<RoutingDecision> {
    // 简化的负载均衡实现
    const pipeline = this.protocolMatcher.findPipelineByProtocol(request.protocol, request.model);

    if (!pipeline) {
      throw new Error(`No pipeline found for protocol ${request.protocol}`);
    }

    return {
      target: {
        type: 'pipeline',
        id: pipeline.getId(),
        name: pipeline.getName(),
        weight: 0.8,
        healthScore: 0.8,
      },
      confidence: 0.7,
      reason: 'Load balancing strategy',
    };
  }
}

/**
 * 基于健康状态的策略
 */
export class HealthBasedStrategy implements IRoutingStrategy {
  private protocolMatcher: IPipelineProtocolMatcher;

  constructor(protocolMatcher: IPipelineProtocolMatcher) {
    this.protocolMatcher = protocolMatcher;
  }

  getName(): string {
    return 'health-based';
  }

  getPriority(): number {
    return 90;
  }

  async route(request: RoutingRequest): Promise<RoutingDecision> {
    const pipeline = this.protocolMatcher.findPipelineByProtocol(request.protocol, request.model);

    if (!pipeline) {
      throw new Error(`No pipeline found for protocol ${request.protocol}`);
    }

    const status = pipeline.getStatus();
    const healthScore = status.health.healthy
      ? Math.min(1.0, status.metrics.successfulExecutions / Math.max(1, status.metrics.totalExecutions))
      : 0.1;

    return {
      target: {
        type: 'pipeline',
        id: pipeline.getId(),
        name: pipeline.getName(),
        weight: healthScore,
        healthScore,
      },
      confidence: healthScore,
      reason: `Health-based routing, health score: ${healthScore.toFixed(2)}`,
    };
  }
}
