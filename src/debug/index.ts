/**
 * RCC v4.0 Debug系统
 * 
 * 完整的调试、记录和回放功能
 * 
 * @author Jason Zhang
 */

export * from './types/debug-types';
export * from './debug-manager';
export * from './debug-recorder';
export * from './replay-system';

// Re-export main classes for easy access
export { DebugManagerImpl as DebugManager } from './debug-manager';
export { DebugRecorderImpl as DebugRecorder } from './debug-recorder';
export { ReplaySystemImpl as ReplaySystem } from './replay-system';

/**
 * Debug系统版本
 */
export const DEBUG_SYSTEM_VERSION = '4.0.0';

/**
 * Debug系统状态
 */
export const DEBUG_SYSTEM_STATUS = 'production-ready';

/**
 * 支持的功能清单
 */
export const SUPPORTED_FEATURES = [
  'module-registration',
  'session-management',
  'request-recording',
  'pipeline-tracking',
  'error-logging',
  'replay-execution',
  'unit-test-generation',
  'integration-test-generation',
  'performance-analysis',
  'batch-operations',
  'automatic-cleanup'
] as const;

/**
 * Debug系统工厂函数
 */
export function createDebugSystem(config?: any) {
  const { DebugManagerImpl } = require('./debug-manager');
  return new DebugManagerImpl(config);
}

/**
 * 快速启用Debug的辅助函数
 */
export function enableGlobalDebug(port: number = 3120, config?: any) {
  const debugManager = createDebugSystem(config);
  const session = debugManager.createSession(port);
  
  console.log(`🔍 Global Debug enabled on port ${port}, session: ${session.sessionId}`);
  
  return {
    debugManager,
    session,
    disable: async () => {
      await debugManager.endSession(session.sessionId);
      await debugManager.cleanup();
      console.log('🔕 Global Debug disabled');
    }
  };
}

/**
 * 调试信息输出
 */
export const DEBUG_INFO = {
  version: DEBUG_SYSTEM_VERSION,
  status: DEBUG_SYSTEM_STATUS,
  features: SUPPORTED_FEATURES,
  description: 'RCC v4.0 Complete Debug System - Production Ready'
};