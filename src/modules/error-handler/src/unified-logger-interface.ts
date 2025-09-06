/**
 * 统一日志接口
 * 
 * 提供简化的日志接口，最多包含3个核心方法
 * 支持安全日志记录和敏感信息脱敏
 * 
 * @author Claude Code Router v4.0
 */

import { ModuleInterface } from '../../interfaces/module/base-module';
import { ErrorStatistics, ErrorSummaryReport } from '../../interfaces/core/error-coordination-center';

/**
 * 日志级别枚举
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'audit';

/**
 * 日志条目接口
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  stack?: string;
}

/**
 * 统一日志记录器接口
 * 
 * 简化为3个核心方法：
 * 1. log - 记录日志
 * 2. setLogLevel - 设置日志级别
 * 3. addRedactedField - 添加需要脱敏的字段
 */
export interface UnifiedLoggerInterface extends ModuleInterface {
  /**
   * 记录日志
   * 
   * @param level 日志级别
   * @param message 日志消息
   * @param metadata 元数据
   * @param error 错误对象（可选）
   */
  log(level: LogLevel, message: string, metadata?: Record<string, any>, error?: Error): void;

  /**
   * 设置日志级别
   * 
   * @param level 日志级别
   */
  setLogLevel(level: LogLevel): void;

  /**
   * 添加需要脱敏的字段
   * 
   * @param field 字段名
   */
  addRedactedField(field: string): void;
}

/**
 * 日志管理器接口
 */
export interface LogManagerInterface extends ModuleInterface {
  /**
   * 记录错误日志
   * 
   * @param errorEntry 错误日志条目
   */
  logError(errorEntry: Omit<LogEntry, 'id' | 'timestamp'> & { 
    requestId: string; 
    errorType: string;
    pipelineId?: string;
  }): Promise<void>;

  /**
   * 获取错误统计信息
   * 
   * @param timeRangeHours 时间范围（小时）
   * @returns ErrorStatistics 错误统计信息
   */
  getErrorStatistics(timeRangeHours?: number): ErrorStatistics | null;

  /**
   * 生成错误摘要报告
   * 
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @returns Promise<ErrorSummaryReport> 错误摘要报告
   */
  generateErrorSummary(startTime: number, endTime: number): Promise<ErrorSummaryReport>;

  /**
   * 清理过期日志
   * 
   * @param retentionDays 保留天数
   * @returns Promise<number> 清理的日志数量
   */
  cleanupLogs(retentionDays: number): Promise<number>;
}

/**
 * 日志工厂接口
 */
export interface LoggerFactory {
  /**
   * 创建统一日志记录器实例
   * 
   * @returns UnifiedLoggerInterface 日志记录器实例
   */
  createLogger(): UnifiedLoggerInterface;

  /**
   * 创建日志管理器实例
   * 
   * @param basePath 基础路径
   * @param serverPort 服务器端口
   * @returns LogManagerInterface 日志管理器实例
   */
  createLogManager(basePath?: string, serverPort?: number): LogManagerInterface;
}