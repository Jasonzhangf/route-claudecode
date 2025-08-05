/**
 * 统一日志系统导出
 * 项目唯一日志入口点
 */

export { UnifiedLogger } from './unified-logger';
export { getLogger, setDefaultPort, loggerManager } from './logger-manager';
export { RequestTracker } from './request-tracker';
export { ErrorTracker, type ToolCallError, type StandardizedError } from './error-tracker';

// 重新导入以供内部使用
import { getLogger } from './logger-manager';
import { RequestTracker } from './request-tracker';
import { ErrorTracker } from './error-tracker';

// 便捷函数 - 获取默认logger实例
export function log() {
  return getLogger();
}

// 便捷函数 - 快速日志记录
export function quickLog(message: string, data?: any, level: 'info' | 'warn' | 'error' | 'debug' = 'info') {
  const logger = getLogger();
  switch (level) {
    case 'error': logger.error(message, data); break;
    case 'warn': logger.warn(message, data); break;
    case 'debug': logger.debug(message, data); break;
    default: logger.info(message, data); break;
  }
}

// 便捷函数 - 创建请求跟踪器
export function createRequestTracker(port?: number) {
  return new RequestTracker(getLogger(port));
}

// 便捷函数 - 创建错误跟踪器
export function createErrorTracker(port?: number) {
  return new ErrorTracker(getLogger(port));
}