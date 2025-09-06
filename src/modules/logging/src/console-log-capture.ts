/**
 * Console日志捕获器
 * 
 * 负责捕获console.log等输出并记录到debug-logs目录
 * 支持按端口和日期分组存储console输出
 */

import * as fs from 'fs';
import * as path from 'path';
import { AsyncLocalStorage } from 'async_hooks';
import { secureLogger } from '../../error-handler/src/utils/secure-logger';
import { RCCError, ValidationError, TransformError, AuthError, ERROR_CODES } from '../../error-handler';

export interface ConsoleLogEntry {
  timestamp: string;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
  port?: number;
  requestId?: string;
  args: unknown[];
}

// 用于跟踪当前请求ID的上下文
const requestContext = new AsyncLocalStorage<{ requestId: string; port?: number }>();

export class ConsoleLogCapture {
  private originalConsole: {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
    debug: typeof console.debug;
  };
  
  private captureEnabled: boolean = false;
  private logDir: string;
  private currentPort?: number;
  
  constructor(logDir: string = './debug-logs') {
    this.logDir = logDir;
    
    // 保存原始console方法
    this.originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };
    
    // 确保日志目录存在
    this.ensureLogDirectory();
  }
  
  /**
   * 启用console日志捕获
   */
  public enable(port?: number): void {
    if (this.captureEnabled) {
      return;
    }
    
    this.currentPort = port;
    this.captureEnabled = true;
    
    // 重写console方法
    console.log = (...args: unknown[]) => {
      this.writeLogEntry('log', args);
      this.originalConsole.log(...args);
    };
    
    console.info = (...args: unknown[]) => {
      this.writeLogEntry('info', args);
      this.originalConsole.info(...args);
    };
    
    console.warn = (...args: unknown[]) => {
      this.writeLogEntry('warn', args);
      this.originalConsole.warn(...args);
    };
    
    console.error = (...args: unknown[]) => {
      this.writeLogEntry('error', args);
      this.originalConsole.error(...args);
    };
    
    console.debug = (...args: unknown[]) => {
      this.writeLogEntry('debug', args);
      this.originalConsole.debug(...args);
    };
    
    secureLogger.info('Console日志捕获已启用', { 
      port: port || 'default',
      module: 'console-capture'
    });
  }
  
  /**
   * 禁用console日志捕获
   */
  public disable(): void {
    if (!this.captureEnabled) {
      return;
    }
    
    // 恢复原始console方法
    console.log = this.originalConsole.log;
    console.info = this.originalConsole.info;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    console.debug = this.originalConsole.debug;
    
    this.captureEnabled = false;
    secureLogger.info('Console日志捕获已禁用', { module: 'console-capture' });
  }
  
  /**
   * 设置当前请求ID（用于日志关联）
   */
  public setCurrentRequestId(requestId: string, port?: number): void {
    requestContext.enterWith({ requestId, port });
  }
  
  /**
   * 在请求上下文中执行函数
   */
  public runWithRequestContext<T>(requestId: string, port: number | undefined, fn: () => T): T {
    return requestContext.run({ requestId, port }, fn);
  }
  
  private writeLogEntry(level: ConsoleLogEntry['level'], args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => this.formatArgument(arg)).join(' ');
    const context = requestContext.getStore();
    
    const entry: ConsoleLogEntry = {
      timestamp,
      level,
      message,
      port: context?.port || this.currentPort,
      requestId: context?.requestId,
      args: args.map(arg => this.safeStringify(arg))
    };
    
    // 写入到文件
    this.writeToLogFile(entry);
  }
  
  private writeToLogFile(entry: ConsoleLogEntry): void {
    try {
      const date = new Date().toISOString().split('T')[0];
      const portDir = entry.port ? `port-${entry.port}` : 'default';
      const filename = `${date}.jsonl`;
      const portPath = path.join(this.logDir, portDir);
      const filepath = path.join(portPath, filename);
      
      // 确保端口目录存在
      if (!fs.existsSync(portPath)) {
        fs.mkdirSync(portPath, { recursive: true });
      }
      
      // 使用自定义序列化避免触发JQJsonHandler警告
      const logLine = this.serializeLogEntry(entry) + '\n';
      
      // 确保目录存在
      this.ensureLogDirectory();
      
      if (!fs.existsSync(filepath)) {
        fs.writeFileSync(filepath, logLine);
        // 使用原始console方法避免递归调用
        this.originalConsole.info(`Console日志文件已创建: ${filepath}`);
      } else {
        fs.appendFileSync(filepath, logLine);
      }
    } catch (error) {
      // 使用原始console方法报告错误，避免递归调用
      this.originalConsole.error('写入console日志失败:', error);
      this.originalConsole.error('日志目录:', this.logDir);
      this.originalConsole.error('入口数据:', entry);
    }
  }
  
  private formatArgument(arg: unknown): string {
    if (typeof arg === 'string') {
      return arg;
    } else if (typeof arg === 'object') {
      return this.safeStringify(arg);
    } else {
      return String(arg);
    }
  }
  
  private safeStringify(obj: unknown): string {
    try {
      // 简单的字符串化，避免复杂的JSON操作可能触发JQJsonHandler警告
      if (obj === null) return 'null';
      if (obj === undefined) return 'undefined';
      if (typeof obj === 'string') return obj;
      if (typeof obj === 'number') return obj.toString();
      if (typeof obj === 'boolean') return obj.toString();
      if (typeof obj === 'function') return '[Function]';
      
      // 对于对象，使用简单的toString或返回类型信息
      if (typeof obj === 'object') {
        if (Array.isArray(obj)) {
          return `[Array(${obj.length})]`;
        }
        return `[Object ${obj.constructor?.name || 'Object'}]`;
      }
      
      return String(obj);
    } catch (error) {
      return '[Stringify Error]';
    }
  }

  /**
   * 序列化日志条目为JSONL格式，避免触发JQJsonHandler警告
   */
  private serializeLogEntry(entry: ConsoleLogEntry): string {
    try {
      // 手动构建JSON字符串，避免使用JSON.stringify
      const timestamp = `"${entry.timestamp}"`;
      const level = `"${entry.level}"`;
      const message = `"${entry.message.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
      const port = entry.port ? entry.port.toString() : 'null';
      const requestId = entry.requestId ? `"${entry.requestId}"` : 'null';
      
      // 处理args数组
      const argsStr = entry.args.map(arg => {
        if (typeof arg === 'string') {
          return `"${arg.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
        } else if (typeof arg === 'number') {
          return arg.toString();
        } else if (typeof arg === 'boolean') {
          return arg.toString();
        } else if (arg === null) {
          return 'null';
        } else {
          return `"${this.safeStringify(arg).replace(/"/g, '\\"')}"`;
        }
      }).join(',');
      
      return `{"timestamp":${timestamp},"level":${level},"message":${message},"port":${port},"requestId":${requestId},"args":[${argsStr}]}`;
    } catch (error) {
      // 如果序列化失败，返回一个基本的日志条目
      return `{"timestamp":"${new Date().toISOString()}","level":"error","message":"Log serialization failed","port":null,"requestId":null,"args":[]}`;
    }
  }
  
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
      secureLogger.info('Debug logs目录已创建', { 
        path: this.logDir,
        module: 'console-capture'
      });
    }
  }
}

// 全局实例
export const globalConsoleCapture = new ConsoleLogCapture();