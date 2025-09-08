/**
 * Error Handler Module Exports
 *
 * 导出错误处理模块的相关类和接口
 *
 * @author Claude Code Assistant
 * @version 1.0.0
 */

// 导出错误类型定义 - 从types模块导入基础错误类型
export {
  RCCError,
  RCCErrorCode
} from '../types/src/index';

// ERROR_CODES别名，兼容旧代码
export { RCCErrorCode as ERROR_CODES } from '../types/src/index';

// 导出错误处理核心类
export {
  ErrorHandlerModule,
  ErrorHandlerConfig
} from './error-handler-module';

// Export the EnhancedErrorHandler as the main implementation of ErrorCoordinationCenter
export { EnhancedErrorHandler as ErrorCoordinationCenter, EnhancedErrorHandler } from './src/enhanced-error-handler';

// 导出特定错误类型
export {
  ValidationError,
  TransformError,
  AuthError
} from './src/enhanced-error-handler';

// 导出错误严重程度枚举
export { ErrorSeverity } from '../interfaces/core/error-coordination-center';

// 导出错误分类相关类型
export {
  ErrorClassifier,
  ErrorClassification
} from './src/error-classifier';

// 导出错误日志管理相关类型
export {
  ErrorLogManager,
  ErrorType,
  ErrorLogEntry,
  ErrorStatistics,
  ErrorSummaryReport
} from './src/error-log-manager';

// 导出错误记录相关类型
export {
  ErrorLogger,
  ErrorLoggerConfig
} from './src/error-logger';

// Re-export types from the interface
export type {
  ErrorContext,
  ErrorClassification as InterfaceErrorClassification,
  ErrorHandlingResult,
  UnifiedErrorResponse,
  ErrorStatistics as InterfaceErrorStatistics,
  ErrorSummaryReport as InterfaceErrorSummaryReport
} from '../interfaces/core/error-coordination-center';