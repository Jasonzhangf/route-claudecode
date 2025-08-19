/**
 * 错误处理接口定义
 *
 * 定义统一的错误处理接口，确保零静默失败
 *
 * @author Jason Zhang
 */

/**
 * RCC错误基类
 */
export class RCCError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message);
    this.name = 'RCCError';
    this.code = code;
    this.details = details;
  }
}

/**
 * 错误处理器接口
 */
export interface ErrorHandler {
  /**
   * 处理错误
   */
  handleError(error: RCCError | Error, context?: ErrorContext): void;

  /**
   * 格式化错误信息
   */
  formatError(error: RCCError | Error): string;

  /**
   * 记录错误日志
   */
  logError(error: RCCError | Error, context?: ErrorContext): void;

  /**
   * 向用户报告错误
   */
  reportToUser(error: RCCError | Error): void;

  /**
   * 创建RCC错误
   */
  createError(message: string, code: string, details?: Record<string, any>): RCCError;
}

/**
 * 错误上下文
 */
export interface ErrorContext {
  module?: string;
  operation?: string;
  requestId?: string;
  userId?: string;
  timestamp?: Date;
  additionalData?: Record<string, any>;
}

/**
 * 错误级别
 */
export type ErrorLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * 错误分类
 */
export type ErrorCategory =
  | 'validation'
  | 'configuration'
  | 'network'
  | 'authentication'
  | 'authorization'
  | 'provider'
  | 'pipeline'
  | 'system'
  | 'unknown';

/**
 * 扩展的RCC错误接口
 */
export interface ExtendedRCCError extends RCCError {
  level: ErrorLevel;
  category: ErrorCategory;
  context?: ErrorContext;
  stack?: string;
  cause?: Error;
}

/**
 * 错误恢复策略接口
 */
export interface ErrorRecoveryStrategy {
  /**
   * 检查是否可以恢复
   */
  canRecover(error: RCCError): boolean;

  /**
   * 执行恢复操作
   */
  recover(error: RCCError, context?: ErrorContext): Promise<boolean>;

  /**
   * 获取恢复建议
   */
  getSuggestions(error: RCCError): string[];
}

/**
 * 错误报告器接口
 */
export interface ErrorReporter {
  /**
   * 报告错误到外部系统
   */
  reportError(error: ExtendedRCCError): Promise<void>;

  /**
   * 获取错误统计
   */
  getErrorStats(): ErrorStats;

  /**
   * 清理旧的错误记录
   */
  cleanup(maxAge?: number): Promise<void>;
}

/**
 * 错误统计信息
 */
export interface ErrorStats {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsByLevel: Record<ErrorLevel, number>;
  recentErrors: ExtendedRCCError[];
  topErrors: Array<{
    message: string;
    count: number;
    lastOccurred: Date;
  }>;
}

/**
 * 全局错误处理器配置
 */
export interface ErrorHandlerConfig {
  logLevel: ErrorLevel;
  enableConsoleOutput: boolean;
  enableFileLogging: boolean;
  enableExternalReporting: boolean;
  maxErrorHistorySize: number;
  errorReportingUrl?: string;
}
