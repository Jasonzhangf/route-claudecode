/**
 * Secure Logger Utility
 *
 * 安全的日志记录工具，自动过滤敏感信息
 * 符合RCC v4.0安全要求
 *
 * @author Jason Zhang
 */

import { JQJsonHandler } from './jq-json-handler';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * 敏感字段模式
 */
const SENSITIVE_PATTERNS = [
  /apikey/i,
  /api_key/i,
  /password/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /auth/i,
  /credential/i,
  /key/i,
  /privatekey/i,
  /private_key/i,
  /accesstoken/i,
  /access_token/i,
  /refreshtoken/i,
  /refresh_token/i,
];

/**
 * 敏感URL模式
 */
const SENSITIVE_URL_PATTERNS = [/\/api\/.*\/key/i, /\/auth\/.*\/token/i, /\/oauth\/.*\/secret/i];

/**
 * 安全日志配置
 */
export interface SecureLoggerConfig {
  level: LogLevel;
  sensitiveFieldReplacement: string;
  enableSanitization: boolean;
  enableAuditLog: boolean;
  auditLogPath?: string;
  maxLogLength: number;
  includeTimestamp: boolean;
  includeLevel: boolean;
  enableFileLogging?: boolean;
  debugLogsPath?: string;
  serverPort?: number;
}

/**
 * 日志条目接口
 */
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
  source?: string;
  requestId?: string;
}

/**
 * 安全日志记录器
 */
export class SecureLogger {
  private config: SecureLoggerConfig;
  private auditLog: LogEntry[] = [];
  private logFileStream?: fs.WriteStream;

  constructor(config: Partial<SecureLoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      sensitiveFieldReplacement: '[REDACTED]',
      enableSanitization: true,
      enableAuditLog: true,
      maxLogLength: 5000,
      includeTimestamp: true,
      includeLevel: true,
      enableFileLogging: false,
      debugLogsPath: path.join('.', 'test-debug-logs'),
      ...config,
    };

    // 初始化文件日志
    if (this.config.enableFileLogging && this.config.serverPort) {
      this.initFileLogging();
    }
  }

  /**
   * 初始化文件日志
   */
  private initFileLogging(): void {
    try {
      const portDir = path.join(this.config.debugLogsPath!, `port-${this.config.serverPort}`);
      
      // 确保目录存在
      if (!fs.existsSync(portDir)) {
        fs.mkdirSync(portDir, { recursive: true });
      }

      // 创建日志文件（按日期）
      const today = new Date().toISOString().split('T')[0];
      const logFilePath = path.join(portDir, `${today}.jsonl`);

      // 创建写入流
      this.logFileStream = fs.createWriteStream(logFilePath, { flags: 'a' });

      // 处理流错误
      this.logFileStream.on('error', (error) => {
        console.error('日志文件写入错误:', error);
      });
    } catch (error) {
      console.error('初始化文件日志失败:', error);
    }
  }

  /**
   * 写入日志到文件
   */
  private writeToFile(logEntry: LogEntry): void {
    if (this.logFileStream && !this.logFileStream.destroyed) {
      const logLine = JQJsonHandler.stringifyJson(logEntry, true) + '\n';
      this.logFileStream.write(logLine);
    }
  }

  /**
   * Debug级别日志
   */
  debug(message: string, data?: any, source?: string): void {
    this.log(LogLevel.DEBUG, message, data, source);
  }

  /**
   * Info级别日志
   */
  info(message: string, data?: any, source?: string): void {
    this.log(LogLevel.INFO, message, data, source);
  }

  /**
   * Warning级别日志
   */
  warn(message: string, data?: any, source?: string): void {
    this.log(LogLevel.WARN, message, data, source);
  }

  /**
   * Error级别日志
   */
  error(message: string, data?: any, source?: string): void {
    this.log(LogLevel.ERROR, message, data, source);
  }

  /**
   * 安全审计日志
   */
  audit(event: string, details: any, source?: string): void {
    const auditEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'AUDIT',
      message: `Security Event: ${event}`,
      data: this.sanitizeData(details),
      source: source || 'unknown',
    };

    if (this.config.enableAuditLog) {
      this.auditLog.push(auditEntry);

      // 保持审计日志大小
      if (this.auditLog.length > 1000) {
        this.auditLog = this.auditLog.slice(-500);
      }
    }

    // 审计日志始终输出到控制台（已过滤敏感信息）
    console.log(`🔒 AUDIT: ${auditEntry.message}`, auditEntry.data);
  }

  /**
   * 核心日志方法
   */
  private log(level: LogLevel, message: string, data?: any, source?: string): void {
    if (level < this.config.level) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: this.config.includeTimestamp ? new Date().toISOString() : '',
      level: this.config.includeLevel ? LogLevel[level] : '',
      message: this.sanitizeMessage(message),
      data: this.config.enableSanitization ? this.sanitizeData(data) : data,
      source: source,
    };

    // 🔧 FIXED: 移除日志消息截断 - 保留完整日志信息
    // 不再截断日志消息，保持完整的日志记录用于调试

    // 格式化输出
    const formattedMessage = this.formatLogEntry(logEntry);

    // 输出到控制台
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.log(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
    }

    // 同时写入文件（如果启用）
    if (this.config.enableFileLogging) {
      this.writeToFile(logEntry);
    }
  }

  /**
   * 清理资源，关闭文件流
   */
  cleanup(): void {
    if (this.logFileStream && !this.logFileStream.destroyed) {
      this.logFileStream.end();
    }
  }

  /**
   * 配置服务器端口和启用文件日志
   */
  configureFileLogging(serverPort: number, debugLogsPath?: string): void {
    this.config.serverPort = serverPort;
    this.config.enableFileLogging = true;
    if (debugLogsPath) {
      this.config.debugLogsPath = debugLogsPath;
    }
    
    // 如果还没有初始化，现在初始化
    if (!this.logFileStream && serverPort) {
      this.initFileLogging();
    }
  }

  /**
   * 格式化日志条目
   */
  private formatLogEntry(entry: LogEntry): string {
    const parts: string[] = [];

    if (entry.timestamp) {
      parts.push(`[${entry.timestamp}]`);
    }

    if (entry.level) {
      parts.push(`[${entry.level}]`);
    }

    if (entry.source) {
      parts.push(`[${entry.source}]`);
    }

    parts.push(entry.message);

    let formatted = parts.join(' ');

    // 添加数据（如果有）
    if (entry.data !== undefined) {
      if (typeof entry.data === 'object') {
        formatted += ' ' + JQJsonHandler.stringifyJson(entry.data, true);
      } else {
        formatted += ' ' + String(entry.data);
      }
    }

    return formatted;
  }

  /**
   * 清理消息中的敏感信息
   */
  private sanitizeMessage(message: string): string {
    if (!this.config.enableSanitization) {
      return message;
    }

    let sanitized = message;

    // 清理URL中的敏感信息
    SENSITIVE_URL_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED_URL]');
    });

    // 清理可能的API密钥模式
    sanitized = sanitized.replace(/[a-zA-Z0-9]{32,}/g, match => {
      // 如果看起来像API密钥，则替换
      if (match.length >= 32 && /^[a-zA-Z0-9_-]+$/.test(match)) {
        return this.config.sensitiveFieldReplacement;
      }
      return match;
    });

    return sanitized;
  }

  /**
   * 深度清理数据对象中的敏感信息
   */
  private sanitizeData(data: any): any {
    if (!this.config.enableSanitization || data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return this.sanitizeMessage(data);
    }

    if (typeof data === 'number' || typeof data === 'boolean') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    if (typeof data === 'object') {
      const sanitized: any = {};

      for (const [key, value] of Object.entries(data)) {
        // 检查字段名是否敏感
        if (this.isSensitiveField(key)) {
          sanitized[key] = this.config.sensitiveFieldReplacement;
        } else {
          sanitized[key] = this.sanitizeData(value);
        }
      }

      return sanitized;
    }

    return data;
  }

  /**
   * 检查字段名是否敏感
   */
  private isSensitiveField(fieldName: string): boolean {
    return SENSITIVE_PATTERNS.some(pattern => pattern.test(fieldName));
  }

  /**
   * 获取审计日志
   */
  getAuditLog(): LogEntry[] {
    return [...this.auditLog];
  }

  /**
   * 清除审计日志
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  /**
   * 创建请求特定的日志器
   */
  createRequestLogger(requestId: string, source?: string): RequestLogger {
    return new RequestLogger(this, requestId, source);
  }
}

/**
 * 请求特定的日志器
 */
export class RequestLogger {
  private logger: SecureLogger;
  private requestId: string;
  private source?: string;

  constructor(logger: SecureLogger, requestId: string, source?: string) {
    this.logger = logger;
    this.requestId = requestId;
    this.source = source;
  }

  debug(message: string, data?: any): void {
    this.logger.debug(`[${this.requestId}] ${message}`, data, this.source);
  }

  info(message: string, data?: any): void {
    this.logger.info(`[${this.requestId}] ${message}`, data, this.source);
  }

  warn(message: string, data?: any): void {
    this.logger.warn(`[${this.requestId}] ${message}`, data, this.source);
  }

  error(message: string, data?: any): void {
    this.logger.error(`[${this.requestId}] ${message}`, data, this.source);
  }

  audit(event: string, details: any): void {
    this.logger.audit(event, { ...details, requestId: this.requestId }, this.source);
  }
}

/**
 * 全局安全日志实例
 */
export const secureLogger = new SecureLogger({
  level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.WARN,
  enableSanitization: true,
  enableAuditLog: true,
});

/**
 * 便捷的日志函数
 */
export const log = {
  debug: (message: string, data?: any, source?: string) => secureLogger.debug(message, data, source),
  info: (message: string, data?: any, source?: string) => secureLogger.info(message, data, source),
  warn: (message: string, data?: any, source?: string) => secureLogger.warn(message, data, source),
  error: (message: string, data?: any, source?: string) => secureLogger.error(message, data, source),
  audit: (event: string, details: any, source?: string) => secureLogger.audit(event, details, source),
};
