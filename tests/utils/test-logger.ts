// 结构化日志记录器
import * as fs from 'fs';
import * as path from 'path';

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
  traceId?: string;
  spanId?: string;
}

export class TestLogger {
  private logFilePath: string;
  private logToConsole: boolean;
  
  constructor(options?: { logFilePath?: string; logToConsole?: boolean }) {
    this.logFilePath = options?.logFilePath || path.join(process.cwd(), 'test-debug-logs', 'test.log');
    this.logToConsole = options?.logToConsole ?? true;
    
    // 确保日志目录存在
    const logDir = path.dirname(this.logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }
  
  // 记录调试日志
  debug(message: string, context?: Record<string, any>, traceId?: string): void {
    this.log('debug', message, context, traceId);
  }
  
  // 记录信息日志
  info(message: string, context?: Record<string, any>, traceId?: string): void {
    this.log('info', message, context, traceId);
  }
  
  // 记录警告日志
  warn(message: string, context?: Record<string, any>, traceId?: string): void {
    this.log('warn', message, context, traceId);
  }
  
  // 记录错误日志
  error(message: string, context?: Record<string, any>, traceId?: string): void {
    this.log('error', message, context, traceId);
  }
  
  // 通用日志记录方法
  private log(level: LogEntry['level'], message: string, context?: Record<string, any>, traceId?: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      traceId
    };
    
    const logLine = JSON.stringify(entry);
    
    // 写入文件
    try {
      fs.appendFileSync(this.logFilePath, logLine + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
    
    // 输出到控制台
    if (this.logToConsole) {
      const consoleMessage = `[${entry.timestamp}] ${level.toUpperCase()}: ${message}`;
      switch (level) {
        case 'debug':
          console.debug(consoleMessage);
          break;
        case 'info':
          console.info(consoleMessage);
          break;
        case 'warn':
          console.warn(consoleMessage);
          break;
        case 'error':
          console.error(consoleMessage);
          break;
      }
    }
  }
  
  // 获取日志文件路径
  getLogFilePath(): string {
    return this.logFilePath;
  }
  
  // 清空日志文件
  clearLogs(): void {
    try {
      fs.writeFileSync(this.logFilePath, '');
    } catch (error) {
      console.error('Failed to clear log file:', error);
    }
  }
}

// 全局日志记录器实例
export const testLogger = new TestLogger();