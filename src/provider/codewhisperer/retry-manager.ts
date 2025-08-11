/**
 * CodeWhisperer 智能重试管理器
 * 基于 AIClient-2-API 的指数退避和错误分类重试策略
 * 项目所有者: Jason Zhang
 */

import { RetryConfig, DEFAULT_RETRY_CONFIG } from './enhanced-auth-config';

export interface RetryContext {
  attempt: number;
  maxRetries: number;
  lastError?: Error;
  startTime: number;
}

export interface RetryableError extends Error {
  statusCode?: number;
  isRetryable?: boolean;
  retryAfter?: number;
}

export class RetryManager {
  private config: RetryConfig;
  private logger?: any;

  constructor(config: Partial<RetryConfig> = {}, logger?: any) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
    this.logger = logger;
  }

  /**
   * 执行带重试的异步操作
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context?: Partial<RetryContext>
  ): Promise<T> {
    const ctx: RetryContext = {
      attempt: 0,
      maxRetries: this.config.maxRetries,
      startTime: Date.now(),
      ...context
    };

    return this.attemptOperation(operation, ctx);
  }

  /**
   * 尝试执行操作
   */
  private async attemptOperation<T>(
    operation: () => Promise<T>,
    context: RetryContext
  ): Promise<T> {
    try {
      context.attempt++;
      this.log('debug', `Attempt ${context.attempt}/${context.maxRetries + 1} starting`);
      
      const result = await operation();
      
      if (context.attempt > 1) {
        const duration = Date.now() - context.startTime;
        this.log('info', `Operation succeeded after ${context.attempt} attempts (${duration}ms)`);
      }
      
      return result;
    } catch (error) {
      context.lastError = error as Error;
      
      if (!this.shouldRetry(error as RetryableError, context)) {
        this.log('error', `Operation failed after ${context.attempt} attempts: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }

      const delay = this.calculateDelay(context, error as RetryableError);
      
      this.log('warn', 
        `Attempt ${context.attempt} failed (${error instanceof Error ? error.message : String(error)}). ` +
        `Retrying in ${delay}ms... (${context.maxRetries - context.attempt} attempts remaining)`
      );

      await this.sleep(delay);
      return this.attemptOperation(operation, context);
    }
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: RetryableError, context: RetryContext): boolean {
    // 已达到最大重试次数
    if (context.attempt > context.maxRetries) {
      return false;
    }

    // 检查是否为可重试的状态码
    if (error.statusCode && this.config.retryableStatuses.includes(error.statusCode)) {
      return true;
    }

    // 检查是否明确标记为可重试
    if (error.isRetryable === true) {
      return true;
    }

    // 检查是否明确标记为不可重试
    if (error.isRetryable === false) {
      return false;
    }

    // 默认重试网络相关错误
    const retryableMessages = [
      'ECONNRESET',
      'ECONNREFUSED', 
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      'socket hang up',
      'network timeout'
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return retryableMessages.some(msg => errorMessage.includes(msg.toLowerCase()));
  }

  /**
   * 计算延迟时间
   */
  private calculateDelay(context: RetryContext, error: RetryableError): number {
    // 如果服务器指定了重试延迟时间（如 429 响应的 Retry-After 头）
    if (error.retryAfter && error.retryAfter > 0) {
      return Math.min(error.retryAfter * 1000, 60000); // 最大60秒
    }

    // 指数退避算法
    const exponentialDelay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, context.attempt - 1);
    
    // 添加抖动以避免惊群效应
    const jitter = Math.random() * 0.1 * exponentialDelay;
    
    const totalDelay = exponentialDelay + jitter;
    
    // 限制最大延迟时间
    return Math.min(totalDelay, 30000); // 最大30秒
  }

  /**
   * 睡眠指定毫秒数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 创建带重试信息的错误
   */
  static createRetryableError(
    message: string, 
    statusCode?: number, 
    isRetryable?: boolean,
    retryAfter?: number
  ): RetryableError {
    const error = new Error(message) as RetryableError;
    error.statusCode = statusCode;
    error.isRetryable = isRetryable;
    error.retryAfter = retryAfter;
    return error;
  }

  /**
   * 从 HTTP 响应创建重试错误
   */
  static createRetryableErrorFromResponse(
    error: any,
    defaultMessage: string = 'Request failed'
  ): RetryableError {
    const statusCode = error.response?.status || error.status;
    const retryAfter = this.parseRetryAfter(error.response?.headers?.['retry-after']);
    
    let isRetryable: boolean | undefined;
    
    // 根据状态码判断是否可重试
    if (statusCode) {
      if (statusCode === 403) {
        isRetryable = true; // 403 通常需要刷新 token
      } else if (statusCode >= 500) {
        isRetryable = true; // 服务器错误通常可重试
      } else if (statusCode === 429) {
        isRetryable = true; // 限流错误可重试
      } else if (statusCode >= 400 && statusCode < 500) {
        isRetryable = false; // 其他客户端错误通常不可重试
      }
    }

    return this.createRetryableError(
      error.message || defaultMessage,
      statusCode,
      isRetryable,
      retryAfter
    );
  }

  /**
   * 解析 Retry-After 头
   */
  private static parseRetryAfter(retryAfter: string | undefined): number | undefined {
    if (!retryAfter) return undefined;
    
    const seconds = parseInt(retryAfter, 10);
    return isNaN(seconds) ? undefined : seconds;
  }

  /**
   * 日志输出方法
   */
  private log(level: string, message: string): void {
    if (this.logger) {
      this.logger[level]?.(message);
    } else {
      console.log(`[RetryManager] ${level.toUpperCase()}: ${message}`);
    }
  }
}