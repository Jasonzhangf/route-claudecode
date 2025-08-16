/**
 * 安全日志管理器
 * 
 * 提供生产环境安全的日志记录，替代console.log的使用
 * 
 * @author Jason Zhang
 */

import { writeFile, appendFile, mkdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { SecurityManager } from '../security/security-manager';

/**
 * 日志级别
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
  OFF = 6
}

/**
 * 日志输出目标
 */
export enum LogTarget {
  CONSOLE = 'console',
  FILE = 'file',
  BOTH = 'both',
  NONE = 'none'
}

/**
 * 日志条目
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  component: string;
  metadata?: Record<string, any>;
  correlationId?: string;
  userId?: string;
}

/**
 * 日志配置
 */
export interface LoggerConfig {
  /** 日志级别 */
  level: LogLevel;
  /** 输出目标 */
  target: LogTarget;
  /** 日志文件路径 */
  filePath?: string;
  /** 最大文件大小(MB) */
  maxFileSize: number;
  /** 文件轮转数量 */
  maxFiles: number;
  /** 是否启用敏感数据过滤 */
  enableSanitization: boolean;
  /** 生产环境配置 */
  production: {
    /** 禁用控制台输出 */
    disableConsole: boolean;
    /** 最小日志级别 */
    minLevel: LogLevel;
    /** 启用审计日志 */
    enableAuditLog: boolean;
  };
}

/**
 * 安全日志管理器实现
 */
export class SecureLogger {
  private config: LoggerConfig;
  private securityManager: SecurityManager;
  private isProduction: boolean;
  private sensitivePatterns: RegExp[];
  private currentFileSize = 0;

  constructor(config: LoggerConfig) {
    this.config = config;
    this.securityManager = new SecurityManager();
    this.isProduction = process.env.NODE_ENV === 'production';
    this.setupSensitivePatterns();
    this.initializeLogFile();
  }

  /**
   * 记录TRACE级别日志
   */
  trace(message: string, component: string, metadata?: Record<string, any>): Promise<void> {
    return this.log(LogLevel.TRACE, message, component, metadata);
  }

  /**
   * 记录DEBUG级别日志
   */
  debug(message: string, component: string, metadata?: Record<string, any>): Promise<void> {
    return this.log(LogLevel.DEBUG, message, component, metadata);
  }

  /**
   * 记录INFO级别日志
   */
  info(message: string, component: string, metadata?: Record<string, any>): Promise<void> {
    return this.log(LogLevel.INFO, message, component, metadata);
  }

  /**
   * 记录WARN级别日志
   */
  warn(message: string, component: string, metadata?: Record<string, any>): Promise<void> {
    return this.log(LogLevel.WARN, message, component, metadata);
  }

  /**
   * 记录ERROR级别日志
   */
  error(message: string, component: string, metadata?: Record<string, any>, error?: Error): Promise<void> {
    const enhancedMetadata = {
      ...metadata,
      ...(error && {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack
      })
    };
    return this.log(LogLevel.ERROR, message, component, enhancedMetadata);
  }

  /**
   * 记录FATAL级别日志
   */
  fatal(message: string, component: string, metadata?: Record<string, any>, error?: Error): Promise<void> {
    const enhancedMetadata = {
      ...metadata,
      ...(error && {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack
      })
    };
    return this.log(LogLevel.FATAL, message, component, enhancedMetadata);
  }

  /**
   * 记录审计日志
   */
  audit(action: string, userId: string, metadata: Record<string, any>): Promise<void> {
    if (this.isProduction && this.config.production.enableAuditLog) {
      return this.log(LogLevel.INFO, `AUDIT: ${action}`, 'security', {
        ...metadata,
        userId,
        auditType: 'security',
        timestamp: new Date().toISOString()
      });
    }
    return Promise.resolve();
  }

  /**
   * 核心日志记录方法
   */
  private async log(
    level: LogLevel, 
    message: string, 
    component: string, 
    metadata?: Record<string, any>
  ): Promise<void> {
    // 检查日志级别
    if (!this.shouldLog(level)) {
      return;
    }

    // 创建日志条目
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message: this.sanitizeMessage(message),
      component,
      metadata: metadata ? this.sanitizeMetadata(metadata) : undefined,
      correlationId: this.generateCorrelationId()
    };

    // 格式化日志
    const formattedLog = this.formatLogEntry(entry);

    // 输出日志
    await this.writeLog(formattedLog, level);

    // 记录安全事件（仅错误和致命级别）
    if (level >= LogLevel.ERROR) {
      await this.securityManager.logSecurityEvent({
        action: 'application_error',
        ipAddress: 'system',
        success: false,
        risk: level >= LogLevel.FATAL ? 'critical' : 'medium',
        details: {
          level: LogLevel[level],
          component,
          message: entry.message,
          metadata: entry.metadata
        }
      });
    }
  }

  /**
   * 检查是否应该记录日志
   */
  private shouldLog(level: LogLevel): boolean {
    // 基础级别检查
    if (level < this.config.level) {
      return false;
    }

    // 生产环境额外检查
    if (this.isProduction && level < this.config.production.minLevel) {
      return false;
    }

    return true;
  }

  /**
   * 敏感数据清理
   */
  private sanitizeMessage(message: string): string {
    if (!this.config.enableSanitization) {
      return message;
    }

    let sanitized = message;
    for (const pattern of this.sensitivePatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    return sanitized;
  }

  /**
   * 敏感元数据清理
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    if (!this.config.enableSanitization) {
      return metadata;
    }

    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      // 检查键名是否敏感
      const isSensitiveKey = this.sensitivePatterns.some(pattern => 
        pattern.test(key.toLowerCase())
      );

      if (isSensitiveKey) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitizeMessage(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * 格式化日志条目
   */
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level].padEnd(5);
    const component = entry.component.padEnd(15);
    
    let formatted = `${timestamp} [${level}] [${component}] ${entry.message}`;
    
    if (entry.correlationId) {
      formatted += ` [${entry.correlationId}]`;
    }
    
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      formatted += ` | ${JSON.stringify(entry.metadata)}`;
    }
    
    return formatted;
  }

  /**
   * 写入日志
   */
  private async writeLog(formattedLog: string, level: LogLevel): Promise<void> {
    const promises: Promise<void>[] = [];

    // 控制台输出
    if (this.shouldWriteToConsole(level)) {
      promises.push(this.writeToConsole(formattedLog, level));
    }

    // 文件输出
    if (this.shouldWriteToFile()) {
      promises.push(this.writeToFile(formattedLog));
    }

    await Promise.all(promises);
  }

  /**
   * 是否应该写入控制台
   */
  private shouldWriteToConsole(level: LogLevel): boolean {
    if (this.config.target === LogTarget.FILE || this.config.target === LogTarget.NONE) {
      return false;
    }

    if (this.isProduction && this.config.production.disableConsole) {
      return false;
    }

    return true;
  }

  /**
   * 是否应该写入文件
   */
  private shouldWriteToFile(): boolean {
    return this.config.target === LogTarget.FILE || 
           this.config.target === LogTarget.BOTH;
  }

  /**
   * 写入控制台
   */
  private async writeToConsole(formattedLog: string, level: LogLevel): Promise<void> {
    switch (level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(formattedLog);
        break;
      case LogLevel.INFO:
        console.info(formattedLog);
        break;
      case LogLevel.WARN:
        console.warn(formattedLog);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formattedLog);
        break;
    }
  }

  /**
   * 写入文件
   */
  private async writeToFile(formattedLog: string): Promise<void> {
    if (!this.config.filePath) {
      return;
    }

    try {
      // 检查文件大小和轮转
      await this.checkFileRotation();

      // 写入日志
      await appendFile(this.config.filePath, formattedLog + '\n');
      this.currentFileSize += Buffer.byteLength(formattedLog + '\n');
    } catch (error) {
      console.error('Failed to write log to file:', error);
    }
  }

  /**
   * 检查文件轮转
   */
  private async checkFileRotation(): Promise<void> {
    if (!this.config.filePath) return;

    try {
      const stats = await stat(this.config.filePath);
      this.currentFileSize = stats.size;

      if (this.currentFileSize > this.config.maxFileSize * 1024 * 1024) {
        await this.rotateLogFile();
      }
    } catch (error) {
      // 文件不存在，不需要轮转
      this.currentFileSize = 0;
    }
  }

  /**
   * 轮转日志文件
   */
  private async rotateLogFile(): Promise<void> {
    if (!this.config.filePath) return;

    const basePath = this.config.filePath;
    const ext = '.log';
    const baseName = basePath.replace(ext, '');

    // 轮转现有文件
    for (let i = this.config.maxFiles - 1; i > 0; i--) {
      const oldFile = `${baseName}.${i}${ext}`;
      const newFile = `${baseName}.${i + 1}${ext}`;
      
      try {
        await stat(oldFile);
        await writeFile(newFile, await require('fs/promises').readFile(oldFile));
      } catch {
        // 文件不存在，跳过
      }
    }

    // 移动当前文件
    try {
      const currentContent = await require('fs/promises').readFile(basePath);
      await writeFile(`${baseName}.1${ext}`, currentContent);
      await writeFile(basePath, ''); // 清空当前文件
      this.currentFileSize = 0;
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  /**
   * 初始化日志文件
   */
  private async initializeLogFile(): Promise<void> {
    if (!this.config.filePath) return;

    try {
      const dir = dirname(this.config.filePath);
      await mkdir(dir, { recursive: true });
    } catch (error) {
      console.error('Failed to initialize log file directory:', error);
    }
  }

  /**
   * 设置敏感数据模式
   */
  private setupSensitivePatterns(): void {
    this.sensitivePatterns = [
      /password\s*[=:]\s*[^\s,}]+/gi,
      /secret\s*[=:]\s*[^\s,}]+/gi,
      /token\s*[=:]\s*[^\s,}]+/gi,
      /key\s*[=:]\s*[^\s,}]+/gi,
      /api[_-]?key\s*[=:]\s*[^\s,}]+/gi,
      /authorization\s*:\s*bearer\s+[^\s,}]+/gi,
      /\b[a-zA-Z0-9]{32,}\b/g, // 长字符串
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, // UUID
      /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, // IP地址
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi // 邮箱
    ];
  }

  /**
   * 生成关联ID
   */
  private generateCorrelationId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}

/**
 * 创建默认的安全日志器
 */
export function createSecureLogger(component: string): SecureLogger {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const config: LoggerConfig = {
    level: isProduction ? LogLevel.INFO : LogLevel.DEBUG,
    target: isProduction ? LogTarget.FILE : LogTarget.BOTH,
    filePath: isProduction ? join(process.cwd(), 'logs', 'app.log') : undefined,
    maxFileSize: 50, // 50MB
    maxFiles: 5,
    enableSanitization: true,
    production: {
      disableConsole: isProduction,
      minLevel: LogLevel.WARN,
      enableAuditLog: true
    }
  };

  return new SecureLogger(config);
}

/**
 * 全局日志器实例
 */
export const logger = createSecureLogger('global');

/**
 * 替换console的安全包装器
 */
export const secureConsole = {
  log: (message: string, ...args: any[]) => logger.info(message, 'console', { args }),
  debug: (message: string, ...args: any[]) => logger.debug(message, 'console', { args }),
  info: (message: string, ...args: any[]) => logger.info(message, 'console', { args }),
  warn: (message: string, ...args: any[]) => logger.warn(message, 'console', { args }),
  error: (message: string, ...args: any[]) => logger.error(message, 'console', { args })
};