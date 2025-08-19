/**
 * 日志中间件
 *
 * 记录HTTP请求和响应信息
 *
 * @author Jason Zhang
 */
/**
 * 日志级别
 */
export declare enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3
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
export declare function logger(options?: LoggerOptions): any;
//# sourceMappingURL=logger.d.ts.map