/**
 * 错误协调中心工厂
 * 
 * 提供统一的错误处理协调中心实例管理
 * 
 * @author RCC v4.0
 */

import { RCCError, ErrorContext } from '../../types/src';
import { EnhancedErrorHandler } from './enhanced-error-handler';

// 使用增强错误处理器作为错误协调中心的实现
type ErrorCoordinationCenter = EnhancedErrorHandler;

// 存储不同端口的错误协调中心实例
const errorCoordinationCenterInstances: Map<number, ErrorCoordinationCenter> = new Map();
let defaultErrorCoordinationCenterInstance: ErrorCoordinationCenter | null = null;

/**
 * 获取错误协调中心实例
 * 
 * @param serverPort 服务器端口（可选）
 * @returns 错误协调中心实例
 */
export function getErrorCoordinationCenter(serverPort?: number): ErrorCoordinationCenter {
  if (serverPort) {
    if (!errorCoordinationCenterInstances.has(serverPort)) {
      // 使用增强错误处理器作为实际实现
      const errorHandler = new EnhancedErrorHandler(serverPort);
      errorCoordinationCenterInstances.set(serverPort, errorHandler);
    }
    return errorCoordinationCenterInstances.get(serverPort)!;
  } else {
    if (!defaultErrorCoordinationCenterInstance) {
      // 使用增强错误处理器作为实际实现
      defaultErrorCoordinationCenterInstance = new EnhancedErrorHandler();
    }
    return defaultErrorCoordinationCenterInstance;
  }
}

/**
 * 初始化错误协调中心
 * 
 * @param serverPort 服务器端口（可选）
 */
export async function initializeErrorCoordinationCenter(serverPort?: number): Promise<void> {
  const center = getErrorCoordinationCenter(serverPort);
  await center.initialize();
}

/**
 * 清理错误协调中心实例
 * 
 * @param serverPort 服务器端口（可选）
 */
export function cleanupErrorCoordinationCenter(serverPort?: number): void {
  if (serverPort) {
    errorCoordinationCenterInstances.delete(serverPort);
  } else {
    defaultErrorCoordinationCenterInstance = null;
  }
}

/**
 * 清理所有错误协调中心实例
 */
export function cleanupAllErrorCoordinationCenters(): void {
  errorCoordinationCenterInstances.clear();
  defaultErrorCoordinationCenterInstance = null;
}