// 错误处理和重试机制
import { testLogger } from './test-logger';

export interface RetryOptions {
  maxAttempts: number;
  delay: number; // milliseconds
  backoffMultiplier?: number; // 指数退避乘数
  maxDelay?: number; // 最大延迟时间
  retryableErrors?: Array<new (...args: any[]) => Error>; // 可重试的错误类型
}

export interface RetryContext {
  attempt: number;
  error: Error;
  delay: number;
}

export class ErrorHandler {
  // 重试执行函数
  static async retry<T>(
    fn: () => Promise<T>,
    options: RetryOptions,
    onRetry?: (context: RetryContext) => void | Promise<void>
  ): Promise<T> {
    const {
      maxAttempts,
      delay,
      backoffMultiplier = 1,
      maxDelay = 30000,
      retryableErrors = []
    } = options;
    
    let lastError: Error;
    let currentDelay = delay;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        // 检查是否应该重试
        if (attempt === maxAttempts || !this.shouldRetry(error as Error, retryableErrors)) {
          testLogger.error(`Operation failed after ${attempt} attempts`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });
          throw error;
        }
        
        // 计算下一次延迟时间
        if (attempt > 1 && backoffMultiplier > 1) {
          currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelay);
        }
        
        // 执行重试回调
        if (onRetry) {
          await onRetry({
            attempt,
            error: error as Error,
            delay: currentDelay
          });
        }
        
        testLogger.warn(`Attempt ${attempt} failed, retrying in ${currentDelay}ms`, {
          error: error instanceof Error ? error.message : String(error)
        });
        
        // 等待后重试
        await this.sleep(currentDelay);
      }
    }
    
    throw lastError;
  }
  
  // 检查错误是否可重试
  private static shouldRetry(error: Error, retryableErrors: Array<new (...args: any[]) => Error>): boolean {
    // 如果没有指定可重试的错误类型，则默认都可重试
    if (retryableErrors.length === 0) {
      return true;
    }
    
    // 检查错误是否在可重试列表中
    return retryableErrors.some(ErrorClass => error instanceof ErrorClass);
  }
  
  // 延迟函数
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // 创建带超时的 Promise
  static async withTimeout<T>(promise: Promise<T>, timeout: number, timeoutMessage?: string): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(timeoutMessage || `Operation timed out after ${timeout}ms`));
      }, timeout);
    });
    
    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  
  // 错误分类
  static categorizeError(error: Error): 'network' | 'validation' | 'system' | 'timeout' | 'unknown' {
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      return 'timeout';
    }
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED') || 
        error.message.includes('network') || error.message.includes('connect')) {
      return 'network';
    }
    
    if (error.message.includes('validation') || error.message.includes('invalid') || 
        error instanceof TypeError) {
      return 'validation';
    }
    
    if (error.message.includes('system') || error.message.includes('internal') || 
        error instanceof ReferenceError || error instanceof SyntaxError) {
      return 'system';
    }
    
    return 'unknown';
  }
  
  // 格式化错误信息
  static formatError(error: Error): string {
    const category = this.categorizeError(error);
    return `[${category.toUpperCase()}] ${error.message}`;
  }
}

// 自定义错误类型
export class TestFrameworkError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'TestFrameworkError';
  }
}

export class RetryableError extends TestFrameworkError {
  constructor(message: string) {
    super(message, 'RETRYABLE_ERROR');
    this.name = 'RetryableError';
  }
}

export class TimeoutError extends TestFrameworkError {
  constructor(message: string) {
    super(message, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
  }
}

export class NetworkError extends TestFrameworkError {
  constructor(message: string) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}