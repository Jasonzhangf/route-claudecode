/**
 * 负载均衡策略实现
 *
 * 实现各种负载均衡算法策略
 *
 * @author Jason Zhang
 */

import { LoadBalancingStrategy, ProviderInstance, LoadBalancingContext, ILoadBalancingStrategy } from './types';

/**
 * 轮询策略
 */
export class RoundRobinStrategy implements ILoadBalancingStrategy {
  readonly strategyName = LoadBalancingStrategy.ROUND_ROBIN;
  private index: number = 0;

  selectProvider(providers: ProviderInstance[], context: LoadBalancingContext): ProviderInstance {
    const provider = providers[this.index % providers.length];
    this.index = (this.index + 1) % providers.length;
    return provider;
  }
}

/**
 * 加权轮询策略
 */
export class WeightedRoundRobinStrategy implements ILoadBalancingStrategy {
  readonly strategyName = LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN;

  selectProvider(providers: ProviderInstance[], context: LoadBalancingContext): ProviderInstance {
    const totalWeight = providers.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;

    for (const provider of providers) {
      random -= provider.weight;
      if (random <= 0) {
        return provider;
      }
    }

    return providers[0]; // 回退
  }
}

/**
 * 最少连接策略
 */
export class LeastConnectionsStrategy implements ILoadBalancingStrategy {
  readonly strategyName = LoadBalancingStrategy.LEAST_CONNECTIONS;

  selectProvider(providers: ProviderInstance[], context: LoadBalancingContext): ProviderInstance {
    return providers.reduce((min, current) => (current.currentConnections < min.currentConnections ? current : min));
  }
}

/**
 * 最短响应时间策略
 */
export class LeastResponseTimeStrategy implements ILoadBalancingStrategy {
  readonly strategyName = LoadBalancingStrategy.LEAST_RESPONSE_TIME;

  selectProvider(providers: ProviderInstance[], context: LoadBalancingContext): ProviderInstance {
    return providers.reduce((min, current) =>
      current.metrics.avgResponseTime < min.metrics.avgResponseTime ? current : min
    );
  }
}

/**
 * 加权最少连接策略
 */
export class WeightedLeastConnectionsStrategy implements ILoadBalancingStrategy {
  readonly strategyName = LoadBalancingStrategy.WEIGHTED_LEAST_CONNECTIONS;

  selectProvider(providers: ProviderInstance[], context: LoadBalancingContext): ProviderInstance {
    return providers.reduce((best, current) => {
      const currentScore = current.currentConnections / current.weight;
      const bestScore = best.currentConnections / best.weight;
      return currentScore < bestScore ? current : best;
    });
  }
}

/**
 * 随机策略
 */
export class RandomStrategy implements ILoadBalancingStrategy {
  readonly strategyName = LoadBalancingStrategy.RANDOM;

  selectProvider(providers: ProviderInstance[], context: LoadBalancingContext): ProviderInstance {
    const index = Math.floor(Math.random() * providers.length);
    return providers[index];
  }
}

/**
 * 加权随机策略
 */
export class WeightedRandomStrategy implements ILoadBalancingStrategy {
  readonly strategyName = LoadBalancingStrategy.WEIGHTED_RANDOM;

  selectProvider(providers: ProviderInstance[], context: LoadBalancingContext): ProviderInstance {
    const totalWeight = providers.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;

    for (const provider of providers) {
      random -= provider.weight;
      if (random <= 0) {
        return provider;
      }
    }

    return providers[0]; // 回退
  }
}

/**
 * 哈希策略
 */
export class HashStrategy implements ILoadBalancingStrategy {
  readonly strategyName = LoadBalancingStrategy.HASH;

  selectProvider(providers: ProviderInstance[], context: LoadBalancingContext): ProviderInstance {
    const hashInput = context.sessionId || context.clientIp || context.requestId;
    const hash = this.simpleHash(hashInput);
    const index = hash % providers.length;
    return providers[index];
  }

  private simpleHash(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

/**
 * 自适应策略
 */
export class AdaptiveStrategy implements ILoadBalancingStrategy {
  readonly strategyName = LoadBalancingStrategy.ADAPTIVE;

  private strategies: Map<LoadBalancingStrategy, ILoadBalancingStrategy> = new Map();
  private adaptiveThreshold: number = 0.8;

  constructor(adaptiveThreshold: number = 0.8) {
    this.adaptiveThreshold = adaptiveThreshold;

    // 初始化所有策略
    this.strategies.set(LoadBalancingStrategy.ROUND_ROBIN, new RoundRobinStrategy());
    this.strategies.set(LoadBalancingStrategy.LEAST_CONNECTIONS, new LeastConnectionsStrategy());
    this.strategies.set(LoadBalancingStrategy.LEAST_RESPONSE_TIME, new LeastResponseTimeStrategy());
    this.strategies.set(LoadBalancingStrategy.WEIGHTED_LEAST_CONNECTIONS, new WeightedLeastConnectionsStrategy());
  }

  selectProvider(providers: ProviderInstance[], context: LoadBalancingContext): ProviderInstance {
    const optimalStrategy = this.determineOptimalStrategy(providers);
    const strategy = this.strategies.get(optimalStrategy);

    if (!strategy) {
      // 回退到轮询策略
      return this.strategies.get(LoadBalancingStrategy.ROUND_ROBIN)!.selectProvider(providers, context);
    }

    return strategy.selectProvider(providers, context);
  }

  private determineOptimalStrategy(providers: ProviderInstance[]): LoadBalancingStrategy {
    // 计算系统整体负载
    const avgResponseTime = providers.reduce((sum, p) => sum + p.metrics.avgResponseTime, 0) / providers.length;
    const avgSuccessRate = providers.reduce((sum, p) => sum + p.metrics.successRate, 0) / providers.length;
    const avgLoad = providers.reduce((sum, p) => sum + p.currentConnections / p.maxConnections, 0) / providers.length;

    // 高负载时使用最少连接
    if (avgLoad > this.adaptiveThreshold) {
      return LoadBalancingStrategy.LEAST_CONNECTIONS;
    }

    // 响应时间差异大时使用最短响应时间
    const responseTimeVariance = this.calculateVariance(providers.map(p => p.metrics.avgResponseTime));
    if (responseTimeVariance > 1000) {
      // 1秒方差
      return LoadBalancingStrategy.LEAST_RESPONSE_TIME;
    }

    // 成功率低时使用加权策略
    if (avgSuccessRate < 0.95) {
      return LoadBalancingStrategy.WEIGHTED_LEAST_CONNECTIONS;
    }

    // 默认使用轮询
    return LoadBalancingStrategy.ROUND_ROBIN;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }
}

/**
 * 策略工厂
 */
export class StrategyFactory {
  private static strategies: Map<LoadBalancingStrategy, () => any> = new Map<LoadBalancingStrategy, () => any>([
    [LoadBalancingStrategy.ROUND_ROBIN, () => new RoundRobinStrategy()],
    [LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN, () => new WeightedRoundRobinStrategy()],
    [LoadBalancingStrategy.LEAST_CONNECTIONS, () => new LeastConnectionsStrategy()],
    [LoadBalancingStrategy.LEAST_RESPONSE_TIME, () => new LeastResponseTimeStrategy()],
    [LoadBalancingStrategy.WEIGHTED_LEAST_CONNECTIONS, () => new WeightedLeastConnectionsStrategy()],
    [LoadBalancingStrategy.RANDOM, () => new RandomStrategy()],
    [LoadBalancingStrategy.WEIGHTED_RANDOM, () => new WeightedRandomStrategy()],
    [LoadBalancingStrategy.HASH, () => new HashStrategy()],
    [LoadBalancingStrategy.ADAPTIVE, () => new AdaptiveStrategy()],
  ]);

  static createStrategy(strategyType: LoadBalancingStrategy, config?: any): ILoadBalancingStrategy {
    const factory = this.strategies.get(strategyType);
    if (!factory) {
      throw new Error(`Unsupported load balancing strategy: ${strategyType}`);
    }

    return factory();
  }

  static getSupportedStrategies(): LoadBalancingStrategy[] {
    return Array.from(this.strategies.keys());
  }
}
