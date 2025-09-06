/**
 * 安全日志记录器
 * 
 * 提供结构化日志记录功能，支持不同日志级别和安全敏感信息过滤
 * 
 * @author Claude Code Router v4.0
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'audit';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  stack?: string;
}

import { JQJsonHandler } from '../../../utils/jq-json-handler';

/**
 * 安全日志记录器类
 */
export class SecureLogger {
  private static instance: SecureLogger;
  private logLevel: LogLevel = 'info';
  private redactedFields: Set<string> = new Set([
    'apiKey', 'api_key', 'secret', 'password', 'token', 'auth', 'authorization',
    'access_token', 'refresh_token', 'client_secret', 'private_key'
  ]);

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): SecureLogger {
    if (!SecureLogger.instance) {
      SecureLogger.instance = new SecureLogger();
    }
    return SecureLogger.instance;
  }

  /**
   * 设置日志级别
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * 添加需要脱敏的字段
   */
  addRedactedField(field: string): void {
    this.redactedFields.add(field.toLowerCase());
  }

  /**
   * 记录debug级别日志
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata);
  }

  /**
   * 记录info级别日志
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  /**
   * 记录warn级别日志
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  /**
   * 记录error级别日志
   */
  error(message: string, metadata?: Record<string, any>, error?: Error): void {
    const extendedMetadata = { ...metadata };
    if (error) {
      extendedMetadata.error = error.message;
      extendedMetadata.stack = error.stack;
    }
    this.log('error', message, extendedMetadata);
  }

  /**
   * 记录audit级别日志（审计日志）
   */
  audit(event: string, metadata?: Record<string, any>): void {
    this.log('audit', event, metadata);
  }

  /**
   * 记录日志的核心方法
   */
  private log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    // 检查日志级别
    if (!this.shouldLog(level)) {
      return;
    }

    // 脱敏敏感信息
    const sanitizedMetadata = metadata ? this.sanitizeMetadata(metadata) : undefined;

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      metadata: sanitizedMetadata,
    };

    // 输出到控制台
    this.outputToConsole(logEntry);
  }

  /**
   * 判断是否应该记录指定级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'audit'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * 脱敏元数据中的敏感信息
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      if (this.redactedFields.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * 输出日志到控制台
   */
  private outputToConsole(logEntry: LogEntry): void {
    const timestamp = logEntry.timestamp.toISOString();
    const level = logEntry.level.toUpperCase().padEnd(7);
    const message = logEntry.message;
    
    let output = `[${timestamp}] ${level} ${message}`;
    
    if (logEntry.metadata) {
      output += ` ${JQJsonHandler.stringifyJson(logEntry.metadata)}`;
    }
    
    switch (logEntry.level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'debug':
        console.debug(output);
        break;
      case 'audit':
        // 审计日志使用info级别输出
        console.info(`[AUDIT] ${output}`);
        break;
      default:
        console.log(output);
    }
  }
}

/**
 * 导出全局安全日志记录器实例
 */
export const secureLogger = SecureLogger.getInstance();

/**
 * 导出日志级别类型
 */
// export { LogLevel }; // Already exported at the top