/**
 * 负载均衡路由系统错误类型定义
 * 
 * @author RCC v4.0 Architecture Team
 */

/**
 * 负载均衡路由错误
 */
export class LoadBalancerRouteError extends Error {
  constructor(message: string, public readonly requestId: string, public readonly category: string) {
    super(message);
    this.name = 'LoadBalancerRouteError';
  }
}

/**
 * 流水线执行错误
 */
export class PipelineExecutionError extends Error {
  constructor(message: string, public readonly pipelineId: string, public readonly requestId: string) {
    super(message);
    this.name = 'PipelineExecutionError';
  }
}

/**
 * 认证错误
 */
export class AuthenticationError extends Error {
  constructor(message: string, public readonly pipelineId: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * 限流错误
 */
export class RateLimitError extends Error {
  constructor(message: string, public readonly pipelineId: string, public readonly retryAfter?: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * 网络错误
 */
export class NetworkError extends Error {
  constructor(message: string, public readonly pipelineId: string, public readonly cause?: Error) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * 不可恢复错误
 */
export class UnrecoverableError extends Error {
  constructor(message: string, public readonly pipelineId: string, public readonly cause?: Error) {
    super(message);
    this.name = 'UnrecoverableError';
  }
}