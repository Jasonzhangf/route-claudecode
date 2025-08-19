/**
 * Provider熔断器
 *
 * 实现熔断器模式，防止级联故障
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { ICircuitBreaker, CircuitBreakerState, LoadBalancerConfig } from './types';

/**
 * 熔断器实现
 */
export class CircuitBreaker extends EventEmitter implements ICircuitBreaker {
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private config: LoadBalancerConfig;

  constructor(config: LoadBalancerConfig) {
    super();
    this.config = config;
  }

  /**
   * 检查熔断器是否关闭（可用）
   */
  isClosed(providerId: string): boolean {
    if (!this.config.circuitBreaker.enabled) {
      return true;
    }

    const breaker = this.circuitBreakers.get(providerId);
    if (!breaker) {
      // 如果没有熔断器记录，初始化为关闭状态
      this.initializeBreaker(providerId);
      return true;
    }

    const now = Date.now();

    switch (breaker.state) {
      case 'CLOSED':
        return true;
      case 'OPEN':
        // 检查是否可以进入半开状态
        if (now - breaker.lastFailureTime > this.config.circuitBreaker.recoveryTimeout) {
          breaker.state = 'HALF_OPEN';
          breaker.halfOpenCallCount = 0;
          this.log('info', `Circuit breaker for ${providerId} switched to HALF_OPEN`);
          this.emit('stateChanged', { providerId, state: 'HALF_OPEN' });
        }
        return breaker.state !== 'OPEN';
      case 'HALF_OPEN':
        return breaker.halfOpenCallCount < this.config.circuitBreaker.halfOpenMaxCalls;
      default:
        return true;
    }
  }

  /**
   * 记录请求结果
   */
  recordResult(providerId: string, success: boolean): void {
    if (!this.config.circuitBreaker.enabled) {
      return;
    }

    let breaker = this.circuitBreakers.get(providerId);
    if (!breaker) {
      breaker = this.initializeBreaker(providerId);
    }

    if (success) {
      this.handleSuccess(providerId, breaker);
    } else {
      this.handleFailure(providerId, breaker);
    }
  }

  /**
   * 重置熔断器
   */
  reset(providerId: string): void {
    const breaker = this.circuitBreakers.get(providerId);
    if (breaker) {
      breaker.state = 'CLOSED';
      breaker.failureCount = 0;
      breaker.lastFailureTime = 0;
      breaker.halfOpenCallCount = 0;

      this.log('info', `Circuit breaker for ${providerId} has been reset`);
      this.emit('reset', { providerId });
    }
  }

  /**
   * 获取熔断器状态
   */
  getState(providerId: string): CircuitBreakerState | null {
    return this.circuitBreakers.get(providerId) || null;
  }

  /**
   * 获取所有熔断器状态
   */
  getAllStates(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }

  /**
   * 获取熔断器统计信息
   */
  getStatistics(): CircuitBreakerStatistics {
    const states = Array.from(this.circuitBreakers.values());

    return {
      total: states.length,
      closed: states.filter(s => s.state === 'CLOSED').length,
      open: states.filter(s => s.state === 'OPEN').length,
      halfOpen: states.filter(s => s.state === 'HALF_OPEN').length,
      totalFailures: states.reduce((sum, s) => sum + s.failureCount, 0),
    };
  }

  /**
   * 初始化熔断器
   */
  private initializeBreaker(providerId: string): CircuitBreakerState {
    const breaker: CircuitBreakerState = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      halfOpenCallCount: 0,
    };

    this.circuitBreakers.set(providerId, breaker);
    this.log('debug', `Initialized circuit breaker for provider ${providerId}`);

    return breaker;
  }

  /**
   * 处理成功请求
   */
  private handleSuccess(providerId: string, breaker: CircuitBreakerState): void {
    if (breaker.state === 'HALF_OPEN') {
      breaker.halfOpenCallCount++;
      if (breaker.halfOpenCallCount >= this.config.circuitBreaker.halfOpenMaxCalls) {
        breaker.state = 'CLOSED';
        breaker.failureCount = 0;
        this.log('info', `Circuit breaker for ${providerId} switched to CLOSED`);
        this.emit('stateChanged', { providerId, state: 'CLOSED' });
      }
    } else if (breaker.state === 'CLOSED') {
      // 成功时减少失败计数（渐进式恢复）
      breaker.failureCount = Math.max(0, breaker.failureCount - 1);
    }
  }

  /**
   * 处理失败请求
   */
  private handleFailure(providerId: string, breaker: CircuitBreakerState): void {
    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();

    if (breaker.failureCount >= this.config.circuitBreaker.failureThreshold) {
      breaker.state = 'OPEN';
      this.log('warn', `Circuit breaker for ${providerId} switched to OPEN (failures: ${breaker.failureCount})`);
      this.emit('stateChanged', { providerId, state: 'OPEN' });
      this.emit('circuitBreakerOpened', { providerId, failureCount: breaker.failureCount });
    }
  }

  /**
   * 清理所有熔断器
   */
  cleanup(): void {
    this.circuitBreakers.clear();
    this.log('info', 'Circuit breaker cleanup completed');
  }

  private log(level: string, message: string): void {
    if (!this.config.logging.enabled) {
      return;
    }

    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevel = levels.indexOf(this.config.logging.logLevel);
    const messageLevel = levels.indexOf(level);

    if (messageLevel >= configLevel) {
      console.log(`[CircuitBreaker] ${level.toUpperCase()}: ${message}`);
    }
  }
}

/**
 * 熔断器统计信息
 */
export interface CircuitBreakerStatistics {
  total: number;
  closed: number;
  open: number;
  halfOpen: number;
  totalFailures: number;
}
