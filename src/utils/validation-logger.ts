/**
 * 验证专用日志记录工具
 * 
 * 为流水线验证提供结构化的日志功能
 * 
 * @author Validation Logger Utility
 */

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, any>;
}

export class ValidationLogger {
  private static formatMessage(level: string, message: string, data?: Record<string, any>): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (data && Object.keys(data).length > 0) {
      return `${prefix} ${message} ${JSON.stringify(data)}`;
    }
    
    return `${prefix} ${message}`;
  }

  static info(message: string, data?: Record<string, any>): void {
    console.log(this.formatMessage('info', message, data));
  }

  static warn(message: string, data?: Record<string, any>): void {
    console.warn(this.formatMessage('warn', message, data));
  }

  static error(message: string, data?: Record<string, any>): void {
    console.error(this.formatMessage('error', message, data));
  }
}

export default ValidationLogger;