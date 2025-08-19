/**
 * 日志中间件
 *
 * 记录HTTP请求和响应信息
 *
 * @author Jason Zhang
 */

// import { IMiddlewareFunction } from '../interfaces/core/middleware-interface';

/**
 * 日志级别
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

/**
 * 日志配置选项
 */
export interface LoggerOptions {
  level?: LogLevel;
  format?: 'simple' | 'detailed' | 'json';
  includeHeaders?: boolean;
  includeBody?: boolean;
  excludePaths?: string[];
}

/**
 * 创建日志中间件
 */
export function logger(options: LoggerOptions = {}): any {
  const {
    level = LogLevel.INFO,
    format = 'simple',
    includeHeaders = false,
    includeBody = false,
    excludePaths = ['/health', '/status'],
  } = options;

  return (req, res, next) => {
    // 检查是否应该排除此路径
    if (excludePaths.some(path => req.url.startsWith(path))) {
      return next();
    }

    const startTime = Date.now();

    // 保存原始next函数，以便在响应时记录
    const originalNext = next;
    const enhancedNext = (error?: Error) => {
      if (error) {
        logError(req, error, startTime);
      } else {
        logRequest(req, res, startTime);
      }
      originalNext(error);
    };

    enhancedNext();
  };

  function logRequest(req: any, res: any, startTime: number): void {
    if (level < LogLevel.INFO) return;

    const duration = Date.now() - startTime;
    const statusCode = res.statusCode || 200;

    switch (format) {
      case 'simple':
        console.log(`${req.method} ${req.url} ${statusCode} ${duration}ms`);
        break;

      case 'detailed':
        console.log(`[${new Date().toISOString()}] ${req.id} ${req.method} ${req.url} ${statusCode} ${duration}ms`);
        if (includeHeaders) {
          console.log(`  Headers: ${JSON.stringify(req.headers, null, 2)}`);
        }
        if (includeBody && req.body) {
          console.log(`  Body: ${JSON.stringify(req.body, null, 2)}`);
        }
        break;

      case 'json':
        const logEntry = {
          timestamp: new Date().toISOString(),
          requestId: req.id,
          method: req.method,
          url: req.url,
          statusCode,
          duration,
          userAgent: req.headers['user-agent'],
          ...(includeHeaders && { headers: req.headers }),
          ...(includeBody && req.body && { body: req.body }),
        };
        console.log(JSON.stringify(logEntry));
        break;
    }
  }

  function logError(req: any, error: Error, startTime: number): void {
    if (level < LogLevel.ERROR) return;

    const duration = Date.now() - startTime;

    switch (format) {
      case 'simple':
        console.error(`ERROR ${req.method} ${req.url} ${duration}ms - ${error.message}`);
        break;

      case 'detailed':
      case 'json':
        const errorEntry = {
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          requestId: req.id,
          method: req.method,
          url: req.url,
          duration,
          error: {
            message: error.message,
            stack: error.stack,
          },
        };
        console.error(JSON.stringify(errorEntry, null, 2));
        break;
    }
  }
}
