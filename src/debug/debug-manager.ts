/**
 * Debug管理器
 * 
 * 负责Debug系统的核心管理功能，包括模块注册、开关控制和记录管理
 * 
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { DebugRecord, DebugSession, ModuleDebugInfo, DebugConfig, DebugStatistics } from './types/debug-types';
import { RCCError } from '../types/error';
import { DebugRecorder, DebugRecorderImpl } from './debug-recorder';
import { ReplaySystem, ReplaySystemImpl } from './replay-system';

/**
 * Debug管理器接口
 */
export interface DebugManager {
  registerModule(moduleName: string, port: number): void;
  enableDebug(moduleName: string): void;
  disableDebug(moduleName: string): void;
  recordInput(moduleName: string, requestId: string, input: any): void;
  recordOutput(moduleName: string, requestId: string, output: any): void;
  recordError(moduleName: string, requestId: string, error: RCCError): void;
  createSession(port: number): DebugSession;
  endSession(sessionId: string): Promise<void>;
  getStatistics(): DebugStatistics;
  cleanup(): Promise<void>;
}

/**
 * Debug管理器实现
 */
export class DebugManagerImpl extends EventEmitter implements DebugManager {
  private registeredModules: Map<string, ModuleDebugInfo> = new Map();
  private debugEnabled: Map<string, boolean> = new Map();
  private activeSessions: Map<string, DebugSession> = new Map();
  private recorder: DebugRecorder;
  private replaySystem: ReplaySystem;
  private config: DebugConfig;
  private startTime: number;

  constructor(config?: Partial<DebugConfig>) {
    super();
    this.startTime = Date.now();
    
    // 默认配置
    this.config = {
      enabled: true,
      maxRecordSize: 10 * 1024 * 1024, // 10MB
      maxSessionDuration: 24 * 60 * 60 * 1000, // 24小时
      retentionDays: 7,
      compressionEnabled: true,
      storageBasePath: '~/.route-claudecode/debug',
      modules: {
        'client': { enabled: true, logLevel: 'info' },
        'router': { enabled: true, logLevel: 'info' },
        'pipeline': { enabled: true, logLevel: 'debug' },
        'transformer': { enabled: true, logLevel: 'debug' },
        'protocol': { enabled: true, logLevel: 'debug' },
        'server-compatibility': { enabled: true, logLevel: 'debug' },
        'server': { enabled: true, logLevel: 'info' }
      },
      ...config
    };

    this.recorder = new DebugRecorderImpl(this.config);
    this.replaySystem = new ReplaySystemImpl(this.recorder);

    // 启动清理任务
    this.startCleanupScheduler();

    this.emit('debug-manager-initialized', {
      config: this.config,
      timestamp: Date.now()
    });
  }

  /**
   * 注册模块到Debug系统
   */
  registerModule(moduleName: string, port: number): void {
    if (this.registeredModules.has(moduleName)) {
      console.warn(`Module ${moduleName} is already registered`);
      return;
    }

    const moduleInfo: ModuleDebugInfo = {
      name: moduleName,
      port,
      registeredAt: Date.now()
    };

    this.registeredModules.set(moduleName, moduleInfo);
    
    // 应用配置中的默认启用状态
    const moduleConfig = this.config.modules[moduleName];
    this.debugEnabled.set(moduleName, moduleConfig?.enabled ?? true);

    this.emit('module-registered', {
      moduleName,
      port,
      enabled: this.debugEnabled.get(moduleName),
      timestamp: Date.now()
    });

    console.log(`📦 Debug模块已注册: ${moduleName} (端口: ${port})`);
  }

  /**
   * 启用模块Debug
   */
  enableDebug(moduleName: string): void {
    if (!this.registeredModules.has(moduleName)) {
      throw new Error(`Module ${moduleName} not registered`);
    }
    
    this.debugEnabled.set(moduleName, true);
    
    this.emit('debug-enabled', {
      moduleName,
      timestamp: Date.now()
    });

    console.log(`🔍 Debug已启用: ${moduleName}`);
  }

  /**
   * 禁用模块Debug
   */
  disableDebug(moduleName: string): void {
    this.debugEnabled.set(moduleName, false);
    
    this.emit('debug-disabled', {
      moduleName,
      timestamp: Date.now()
    });

    console.log(`🔕 Debug已禁用: ${moduleName}`);
  }

  /**
   * 记录模块输入
   */
  recordInput(moduleName: string, requestId: string, input: any): void {
    if (!this.isDebugEnabled(moduleName)) return;

    try {
      this.recorder.recordModuleInput(moduleName, requestId, input);
      
      this.emit('input-recorded', {
        moduleName,
        requestId,
        timestamp: Date.now(),
        dataSize: JSON.stringify(input).length
      });
    } catch (error) {
      console.error(`记录输入失败 [${moduleName}]:`, error);
    }
  }

  /**
   * 记录模块输出
   */
  recordOutput(moduleName: string, requestId: string, output: any): void {
    if (!this.isDebugEnabled(moduleName)) return;

    try {
      this.recorder.recordModuleOutput(moduleName, requestId, output);
      
      this.emit('output-recorded', {
        moduleName,
        requestId,
        timestamp: Date.now(),
        dataSize: JSON.stringify(output).length
      });
    } catch (error) {
      console.error(`记录输出失败 [${moduleName}]:`, error);
    }
  }

  /**
   * 记录模块错误（错误总是记录，不受debug开关影响）
   */
  recordError(moduleName: string, requestId: string, error: RCCError): void {
    try {
      this.recorder.recordModuleError(moduleName, requestId, error);
      
      this.emit('error-recorded', {
        moduleName,
        requestId,
        error: error.message,
        timestamp: Date.now()
      });

      console.error(`❌ Debug错误记录 [${moduleName}]: ${error.message}`);
    } catch (recordError) {
      console.error(`记录错误失败 [${moduleName}]:`, recordError);
    }
  }

  /**
   * 创建Debug会话
   */
  createSession(port: number): DebugSession {
    const now = Date.now();
    const sessionId = `session-${this.formatReadableTime(now).replace(/[:\s]/g, '-')}`;
    
    const session: DebugSession = {
      sessionId,
      port,
      startTime: now,
      startTimeReadable: this.formatReadableTime(now),
      requestCount: 0,
      errorCount: 0,
      activePipelines: [],
      metadata: {
        version: '4.0.0',
        config: this.config,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };

    this.activeSessions.set(sessionId, session);
    this.recorder.createSession(port, sessionId);

    this.emit('session-created', {
      sessionId,
      port,
      timestamp: now
    });

    console.log(`🎯 Debug会话已创建: ${sessionId} (端口: ${port})`);
    return session;
  }

  /**
   * 结束Debug会话
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const now = Date.now();
    session.endTime = now;
    session.endTimeReadable = this.formatReadableTime(now);
    session.duration = now - session.startTime;

    try {
      await this.recorder.endSession(sessionId);
      this.activeSessions.delete(sessionId);

      this.emit('session-ended', {
        sessionId,
        duration: session.duration,
        requestCount: session.requestCount,
        errorCount: session.errorCount,
        timestamp: now
      });

      console.log(`🏁 Debug会话已结束: ${sessionId} (持续: ${session.duration}ms)`);
    } catch (error) {
      console.error(`结束会话失败 [${sessionId}]:`, error);
      throw error;
    }
  }

  /**
   * 获取Debug统计信息
   */
  getStatistics(): DebugStatistics {
    const moduleStats = new Map<string, {
      recordCount: number;
      errorCount: number;
      averageDuration: number;
    }>();

    // 收集模块统计信息
    for (const [moduleName] of this.registeredModules) {
      moduleStats.set(moduleName, {
        recordCount: 0,
        errorCount: 0,
        averageDuration: 0
      });
    }

    return {
      totalSessions: this.activeSessions.size,
      activeSessions: this.activeSessions.size,
      totalRecords: 0, // 由recorder提供
      totalErrors: 0, // 由recorder提供  
      averageResponseTime: 0, // 由recorder提供
      diskUsage: 0, // 由recorder提供
      moduleStatistics: moduleStats
    };
  }

  /**
   * 获取回放系统
   */
  getReplaySystem(): ReplaySystem {
    return this.replaySystem;
  }

  /**
   * 获取记录器
   */
  getRecorder(): DebugRecorder {
    return this.recorder;
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    console.log('🧹 开始清理Debug系统...');

    // 结束所有活跃会话
    for (const sessionId of this.activeSessions.keys()) {
      try {
        await this.endSession(sessionId);
      } catch (error) {
        console.error(`清理会话失败 [${sessionId}]:`, error);
      }
    }

    // 清理记录器
    if (this.recorder) {
      await this.recorder.cleanup();
    }

    this.emit('debug-manager-cleanup', {
      timestamp: Date.now(),
      duration: Date.now() - this.startTime
    });

    console.log('✅ Debug系统清理完成');
  }

  /**
   * 检查模块是否启用Debug
   */
  private isDebugEnabled(moduleName: string): boolean {
    if (!this.config.enabled) return false;
    return this.debugEnabled.get(moduleName) ?? false;
  }

  /**
   * 格式化可读时间
   */
  private formatReadableTime(timestamp: number): string {
    const date = new Date(timestamp);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return `${date.toLocaleString('zh-CN', { timeZone: timezone })} ${timezone}`;
  }

  /**
   * 启动清理调度器
   */
  private startCleanupScheduler(): void {
    // 每小时检查一次过期记录
    const cleanupInterval = setInterval(async () => {
      try {
        await this.recorder.cleanupExpiredRecords();
      } catch (error) {
        console.error('定期清理失败:', error);
      }
    }, 60 * 60 * 1000); // 1小时

    // 清理器在进程退出时停止
    process.once('exit', () => {
      clearInterval(cleanupInterval);
    });
  }
}

/**
 * Debug错误类
 */
export class DebugError extends Error {
  constructor(operation: string, message: string) {
    super(`Debug operation failed (${operation}): ${message}`);
    this.name = 'DebugError';
  }
}