/**
 * 日志管理器 - 全局日志实例管理
 * 提供单例模式的日志器管理
 */

import { UnifiedLogger } from './unified-logger';

class LoggerManager {
  private loggers: Map<number, UnifiedLogger> = new Map();
  private defaultPort: number = 3456;

  getLogger(port?: number): UnifiedLogger {
    const targetPort = port || this.defaultPort;
    
    if (!this.loggers.has(targetPort)) {
      // 环境变量和命令行参数控制的调试配置
      const isDebugMode = process.env.RCC_DEBUG === 'true' || 
                         process.env.DEBUG === 'true' || 
                         process.argv.includes('--debug');
      const isVerboseMode = process.env.RCC_VERBOSE === 'true' || 
                           process.argv.includes('--verbose');
      
      // 调试信息：记录logger创建
      if (isDebugMode) {
        console.log(`[LoggerManager] Creating logger for port ${targetPort} (requested: ${port}, default: ${this.defaultPort})`);
      }
      
      const logger = new UnifiedLogger({ 
        port: targetPort,
        logLevel: isVerboseMode ? 'debug' : (isDebugMode ? 'debug' : 'info'), // debug模式使用debug级别
        enableConsole: isDebugMode || isVerboseMode,
        enableFile: true
      });
      this.loggers.set(targetPort, logger);
    }
    
    return this.loggers.get(targetPort)!;
  }

  setDefaultPort(port: number): void {
    this.defaultPort = port;
  }

  hasLogger(port: number): boolean {
    return this.loggers.has(port);
  }

  async removeLogger(port: number): Promise<void> {
    const logger = this.loggers.get(port);
    if (logger) {
      await logger.shutdown();
      this.loggers.delete(port);
    }
  }

  getActivePorts(): number[] {
    return Array.from(this.loggers.keys());
  }

  async cleanupAll(): Promise<void> {
    const promises = Array.from(this.loggers.values()).map(logger => logger.cleanup());
    await Promise.all(promises);
  }

  async shutdownAll(): Promise<void> {
    const promises = Array.from(this.loggers.values()).map(logger => logger.shutdown());
    await Promise.all(promises);
    this.loggers.clear();
  }
}

// 全局单例
const loggerManager = new LoggerManager();

// 导出便捷函数
export function getLogger(port?: number): UnifiedLogger {
  return loggerManager.getLogger(port);
}

export function setDefaultPort(port: number): void {
  loggerManager.setDefaultPort(port);
}

export { loggerManager, UnifiedLogger };