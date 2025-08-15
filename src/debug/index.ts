/**
 * RCC v4.0 Debug系统
 * 
 * 处理数据记录、回放测试和调试支持
 * 
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import {
  IDebugModule,
  IDebugRecorder,
  IReplaySystem,
  IPerformanceAnalyzer,
  IDebugManager,
  DebugConfig,
  DebugLevel,
  DebugSession,
  DebugEvents
} from '../interfaces/core/debug-interface';
import { DebugRecorder } from './debug-recorder';
import { ReplaySystem } from './replay-system';
import { PerformanceAnalyzer } from './performance-analyzer';
import { DebugManager } from './debug-manager';

export const DEBUG_MODULE_VERSION = '4.0.0-alpha.1';

/**
 * 默认调试配置
 */
const DEFAULT_DEBUG_CONFIG: DebugConfig = {
  id: 'debug-module',
  name: 'debug-module',
  type: 'server' as any, // 临时解决方案
  version: DEBUG_MODULE_VERSION,
  enabled: true,
  level: DebugLevel.INFO,
  recordTypes: [],
  maxRecords: 10000,
  storageDir: './debug-data',
  autoCleanup: true,
  cleanupDays: 7,
  enableReplay: true,
  enablePerformanceTracking: true
};

/**
 * Debug系统主模块实现
 */
export class DebugModule extends EventEmitter implements IDebugModule {
  public readonly config: DebugConfig;
  public readonly recorder: IDebugRecorder;
  public readonly replaySystem: IReplaySystem;
  public readonly performanceAnalyzer: IPerformanceAnalyzer;
  public readonly debugManager: IDebugManager;
  public readonly status: any; // Module status

  private isInitialized: boolean = false;
  private activeSessions: Set<string> = new Set();

  constructor(config?: Partial<DebugConfig>) {
    super();
    
    this.config = {
      ...DEFAULT_DEBUG_CONFIG,
      ...config
    };

    // 初始化子组件
    this.recorder = new DebugRecorder(this.config);
    this.replaySystem = new ReplaySystem();
    this.performanceAnalyzer = new PerformanceAnalyzer(this.config);
    this.debugManager = new DebugManager(this.config);
    
    // 初始化status
    (this as any).status = {
      id: this.config.id,
      name: this.config.name,
      type: this.config.type,
      status: 'stopped',
      health: 'healthy'
    };

    this.setupEventHandlers();
  }

  /**
   * 获取模块名称
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * 获取模块版本
   */
  getVersion(): string {
    return this.config.version;
  }

  /**
   * 初始化Debug模块
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // 初始化Debug记录器
      if (typeof (this.recorder as any).initialize === 'function') {
        await (this.recorder as any).initialize();
      }

      this.isInitialized = true;
      this.emit('initialized');
      
      console.log(`🔍 Debug Module v${this.config.version} initialized`);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 启动Debug模块
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.emit('started');
    console.log(`🔍 Debug Module started`);
  }

  /**
   * 停止Debug模块
   */
  async stop(): Promise<void> {
    // 停止所有活跃会话
    const sessionIds = Array.from(this.activeSessions);
    for (const sessionId of sessionIds) {
      await this.disableDebugging(sessionId);
    }

    // 销毁管理器
    if (typeof (this.debugManager as any).destroy === 'function') {
      (this.debugManager as any).destroy();
    }

    this.isInitialized = false;
    this.emit('stopped');
    console.log(`🔍 Debug Module stopped`);
  }

  /**
   * 获取模块状态
   */
  getStatus(): {
    name: string;
    version: string;
    initialized: boolean;
    enabled: boolean;
    activeSessions: number;
    totalSessions: number;
  } {
    return {
      name: this.config.name,
      version: this.config.version,
      initialized: this.isInitialized,
      enabled: this.config.enabled,
      activeSessions: this.activeSessions.size,
      totalSessions: (this.debugManager as any).getAllSessions?.()?.length || 0
    };
  }

  /**
   * 重启模块
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /**
   * 获取健康状态
   */
  getHealth(): any {
    return {
      status: this.isInitialized ? 'healthy' : 'unhealthy',
      uptime: Date.now(),
      activeSessions: this.activeSessions.size,
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * 获取指标
   */
  getMetrics(): any {
    return {
      activeSessions: this.activeSessions.size,
      totalSessions: (this.debugManager as any).getAllSessions?.()?.length || 0,
      enabled: this.config.enabled,
      level: this.config.level
    };
  }

  /**
   * 更新配置
   */
  async updateConfig(config: Partial<DebugConfig>): Promise<void> {
    Object.assign(this.config, config);
    this.emit('config-updated', this.config);
  }

  /**
   * 启用调试模式
   */
  async enableDebugging(sessionId: string): Promise<void> {
    if (this.activeSessions.has(sessionId)) {
      return;
    }

    // 创建调试会话
    const port = Math.floor(Math.random() * 10000) + 30000; // 随机端口
    const session = await this.debugManager.createSession(port);
    
    // 开始性能分析
    if (this.config.enablePerformanceTracking) {
      await this.performanceAnalyzer.startProfiling(sessionId);
    }

    this.activeSessions.add(sessionId);
    this.emit('debugging-enabled', sessionId, session);
  }

  /**
   * 禁用调试模式
   */
  async disableDebugging(sessionId: string): Promise<void> {
    if (!this.activeSessions.has(sessionId)) {
      return;
    }

    // 停止性能分析
    if (this.config.enablePerformanceTracking) {
      try {
        await this.performanceAnalyzer.stopProfiling(sessionId);
      } catch (error) {
        // 性能分析停止失败不应阻止调试禁用
        console.warn(`Failed to stop profiling for session ${sessionId}:`, error);
      }
    }

    // 关闭调试会话
    await this.debugManager.closeSession(sessionId);

    this.activeSessions.delete(sessionId);
    this.emit('debugging-disabled', sessionId);
  }

  /**
   * 设置调试级别
   */
  async setDebugLevel(level: DebugLevel): Promise<void> {
    (this.config as any).level = level;
    this.emit('debug-level-changed', level);
  }

  /**
   * 获取调试统计信息
   */
  async getDebugStats(sessionId: string): Promise<any> {
    const session = this.debugManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const stats = await (this.debugManager as any).getSessionStatistics?.(sessionId) || {
      session,
      recordsByType: {},
      performanceMetrics: {},
      errorsByType: {},
      recordsByHour: []
    };
    const moduleStatus = this.getStatus();

    return {
      module: moduleStatus,
      session: stats.session,
      records: stats.recordsByType,
      performance: stats.performanceMetrics,
      errors: stats.errorsByType,
      timeline: stats.recordsByHour
    };
  }

  /**
   * 快速开始调试会话
   */
  async startDebugSession(): Promise<{
    sessionId: string;
    session: DebugSession;
    recorder: IDebugRecorder;
    replaySystem: IReplaySystem;
    performanceAnalyzer: IPerformanceAnalyzer;
  }> {
    const sessionId = `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.enableDebugging(sessionId);
    const session = this.debugManager.getSession(sessionId);
    
    if (!session) {
      throw new Error('Failed to create debug session');
    }

    return {
      sessionId,
      session,
      recorder: this.recorder,
      replaySystem: this.replaySystem,
      performanceAnalyzer: this.performanceAnalyzer
    };
  }

  /**
   * 停止调试会话
   */
  async stopDebugSession(sessionId: string): Promise<void> {
    await this.disableDebugging(sessionId);
  }

  /**
   * 获取所有调试工具
   */
  getDebugTools(): {
    recorder: IDebugRecorder;
    replaySystem: IReplaySystem;
    performanceAnalyzer: IPerformanceAnalyzer;
    debugManager: IDebugManager;
  } {
    return {
      recorder: this.recorder,
      replaySystem: this.replaySystem,
      performanceAnalyzer: this.performanceAnalyzer,
      debugManager: this.debugManager
    };
  }

  /**
   * 运行完整的调试测试
   */
  async runDebugTest(): Promise<{
    success: boolean;
    results: {
      recorder: boolean;
      replaySystem: boolean;
      performanceAnalyzer: boolean;
      debugManager: boolean;
    };
    errors: Error[];
  }> {
    const results = {
      recorder: false,
      replaySystem: false,
      performanceAnalyzer: false,
      debugManager: false
    };
    const errors: Error[] = [];

    // 测试Debug记录器
    try {
      const testSessionId = 'test_session_' + Date.now();
      await this.enableDebugging(testSessionId);
      
      // 模拟一些调试记录
      const mockRequest: any = {
        id: 'test_request',
        model: 'test-model',
        messages: [{ role: 'user', content: 'Test message' }],
        metadata: {
          originalFormat: 'openai',
          targetFormat: 'anthropic',
          provider: 'test-provider',
          category: 'test'
        },
        timestamp: new Date()
      };

      const traceId = this.recorder.startRequestTrace(mockRequest);
      await this.recorder.endRequestTrace(traceId);
      
      results.recorder = true;
      
      await this.disableDebugging(testSessionId);
    } catch (error) {
      errors.push(error as Error);
    }

    // 测试回放系统
    try {
      const replayConfig: any = {
        sessionId: 'test_replay',
        speedMultiplier: 2,
        skipErrors: true,
        validateOutputs: true
      };

      const replayResult = await this.replaySystem.startReplay(replayConfig);
      results.replaySystem = replayResult.success;
    } catch (error) {
      errors.push(error as Error);
    }

    // 测试性能分析器
    try {
      const testSessionId = 'perf_test_session';
      await this.performanceAnalyzer.startProfiling(testSessionId);
      
      // 等待一小段时间收集数据
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const traces = await this.performanceAnalyzer.stopProfiling(testSessionId);
      results.performanceAnalyzer = true;
    } catch (error) {
      errors.push(error as Error);
    }

    // 测试Debug管理器
    try {
      const testPort = 39999;
      const session = await this.debugManager.createSession(testPort);
      await this.debugManager.closeSession(session.id);
      results.debugManager = true;
    } catch (error) {
      errors.push(error as Error);
    }

    const success = Object.values(results).every(result => result);

    return {
      success,
      results,
      errors
    };
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 转发Debug记录器事件
    (this.recorder as any).on?.('record-created', (record: any) => {
      this.emit('record-created', record);
    });

    (this.recorder as any).on?.('trace-started', (traceId: any, request: any) => {
      this.emit('trace-started', traceId, request);
    });

    (this.recorder as any).on?.('trace-completed', (trace: any) => {
      this.emit('trace-completed', trace);
    });

    // 转发回放系统事件
    (this.replaySystem as any).on?.('replay-started', (config: any) => {
      this.emit('replay-started', config);
    });

    (this.replaySystem as any).on?.('replay-completed', (result: any) => {
      this.emit('replay-completed', result);
    });

    // 转发性能分析器事件
    (this.performanceAnalyzer as any).on?.('analysis-completed', (analysis: any) => {
      this.emit('performance-analysis-completed', 'unknown', analysis);
    });

    // 转发Debug管理器事件
    (this.debugManager as any).on?.('session-created', (session: any) => {
      this.emit('session-created', session);
    });

    (this.debugManager as any).on?.('session-closed', (sessionId: any) => {
      this.emit('session-closed', sessionId);
    });

    (this.debugManager as any).on?.('cleanup-completed', (recordsRemoved: any) => {
      this.emit('cleanup-completed', recordsRemoved);
    });

    // 错误处理
    [this.recorder, this.replaySystem, this.performanceAnalyzer, this.debugManager]
      .forEach(component => {
        (component as any).on?.('error', (error: any) => {
          this.emit('error', error);
        });
      });
  }
}

// 导出所有组件和接口
export * from './debug-recorder';
export * from './replay-system';
export * from './performance-analyzer';
export * from './debug-manager';
export * from '../interfaces/core/debug-interface';