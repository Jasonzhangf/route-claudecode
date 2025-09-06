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
/**
 * 安全日志记录器类
 */
export declare class SecureLogger {
    private static instance;
    private logLevel;
    private redactedFields;
    private constructor();
    /**
     * 获取单例实例
     */
    static getInstance(): SecureLogger;
    /**
     * 设置日志级别
     */
    setLogLevel(level: LogLevel): void;
    /**
     * 添加需要脱敏的字段
     */
    addRedactedField(field: string): void;
    /**
     * 记录debug级别日志
     */
    debug(message: string, metadata?: Record<string, any>): void;
    /**
     * 记录info级别日志
     */
    info(message: string, metadata?: Record<string, any>): void;
    /**
     * 记录warn级别日志
     */
    warn(message: string, metadata?: Record<string, any>): void;
    /**
     * 记录error级别日志
     */
    error(message: string, metadata?: Record<string, any>, error?: Error): void;
    /**
     * 记录audit级别日志（审计日志）
     */
    audit(event: string, metadata?: Record<string, any>): void;
    /**
     * 记录日志的核心方法
     */
    private log;
    /**
     * 判断是否应该记录指定级别的日志
     */
    private shouldLog;
    /**
     * 脱敏元数据中的敏感信息
     */
    private sanitizeMetadata;
    /**
     * 输出日志到控制台
     */
    private outputToConsole;
}
/**
 * 导出全局安全日志记录器实例
 */
export declare const secureLogger: SecureLogger;
/**
 * 导出日志级别类型
 */
export { LogLevel };
//# sourceMappingURL=secure-logger.d.ts.map