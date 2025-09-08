/**
 * Debug系统集成器
 * 
 * 为各个模块提供统一的debug集成接口
 */

import { DebugManagerImpl as DebugManager } from './debug-manager';
import { DebugRecorder } from './debug-recorder';
import { RCCError, RCCErrorCode } from '../../error-handler';

export interface DebugIntegrationConfig {
  moduleId: string;
  moduleName: string;
  enabled: boolean;
  captureLevel: 'basic' | 'full';
  serverPort?: number;
}

/**
 * 模块debug集成器
 */
export class ModuleDebugIntegration {
  private debugManager: DebugManager;
  private config: DebugIntegrationConfig;
  private currentSessionId?: string;

  constructor(config: DebugIntegrationConfig) {
    this.config = config;
    this.debugManager = new DebugManager({
      storageBasePath: '~/.route-claudecode/debug-logs'
    });
  }

  /**
   * 初始化debug系统
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // 修复：确保端口信息正确传递，undefined表示未指定
    const port = this.config.serverPort !== undefined ? this.config.serverPort : undefined;
    await this.debugManager.initialize(port);
    
    // 注册模块：如果端口未指定，使用0作为占位符
    this.debugManager.registerModule(this.config.moduleId, port !== undefined ? port : 0);
  }

  /**
   * 开始debug会话
   */
  startSession(sessionId?: string): string {
    if (!this.config.enabled) {
      return '';
    }

    // 修复：使用实际端口，如果未指定则让debugManager自己决定
    const port = this.config.serverPort !== undefined ? this.config.serverPort : undefined;
    const session = this.debugManager.createSession(port, sessionId);
    this.currentSessionId = session.sessionId;
    return session.sessionId;
  }

  /**
   * 记录模块输入
   */
  recordInput(requestId: string, input: any): void {
    if (!this.config.enabled || !this.currentSessionId) {
      return;
    }

    this.debugManager.recordInput(this.config.moduleId, requestId, input);
  }

  /**
   * 记录模块输出
   */
  recordOutput(requestId: string, output: any): void {
    if (!this.config.enabled || !this.currentSessionId) {
      return;
    }

    this.debugManager.recordOutput(this.config.moduleId, requestId, output);
  }

  /**
   * 记录模块错误
   */
  recordError(requestId: string, error: Error | RCCError): void {
    if (!this.config.enabled || !this.currentSessionId) {
      return;
    }

    const rccError = error instanceof RCCError ? error : new RCCError(error.message, RCCErrorCode.UNKNOWN_ERROR);
    this.debugManager.recordError(this.config.moduleId, requestId, rccError);
  }

  /**
   * 记录自定义事件
   */
  recordEvent(eventType: string, requestId: string, data: any): void {
    if (!this.config.enabled || !this.currentSessionId) {
      return;
    }

    // this.debugManager.recordCustomEvent(this.config.moduleId, eventType, requestId, data); // Removed: method doesn't exist
  }

  /**
   * 结束debug会话
   */
  async endSession(): Promise<void> {
    if (!this.config.enabled || !this.currentSessionId) {
      return;
    }

    await this.debugManager.endSession(this.currentSessionId);
    this.currentSessionId = undefined;
  }

  /**
   * 获取debug统计信息
   */
  getStatistics() {
    return this.debugManager.getStatistics();
  }
}

/**
 * Debug系统全局集成管理器
 */
export class GlobalDebugIntegration {
  private static instance: GlobalDebugIntegration;
  private moduleIntegrations: Map<string, ModuleDebugIntegration> = new Map();
  private globalSessionId?: string;

  static getInstance(): GlobalDebugIntegration {
    if (!GlobalDebugIntegration.instance) {
      GlobalDebugIntegration.instance = new GlobalDebugIntegration();
    }
    return GlobalDebugIntegration.instance;
  }

  /**
   * 注册模块debug集成
   */
  registerModule(config: DebugIntegrationConfig): ModuleDebugIntegration {
    const integration = new ModuleDebugIntegration(config);
    this.moduleIntegrations.set(config.moduleId, integration);
    return integration;
  }

  /**
   * 获取模块debug集成
   */
  getModule(moduleId: string): ModuleDebugIntegration | undefined {
    return this.moduleIntegrations.get(moduleId);
  }

  /**
   * 初始化所有模块的debug系统
   */
  async initializeAll(): Promise<void> {
    const promises = Array.from(this.moduleIntegrations.values()).map(
      integration => integration.initialize()
    );
    await Promise.all(promises);
  }

  /**
   * 开始全局debug会话
   */
  startGlobalSession(sessionId?: string): string {
    this.globalSessionId = sessionId || `global-${Date.now()}`;
    
    // 为所有模块启动debug会话
    this.moduleIntegrations.forEach(integration => {
      integration.startSession(this.globalSessionId);
    });

    return this.globalSessionId;
  }

  /**
   * 结束全局debug会话
   */
  async endGlobalSession(): Promise<void> {
    if (!this.globalSessionId) {
      return;
    }

    // 结束所有模块的debug会话
    const promises = Array.from(this.moduleIntegrations.values()).map(
      integration => integration.endSession()
    );
    await Promise.all(promises);

    this.globalSessionId = undefined;
  }

  /**
   * 更新所有模块的服务器端口
   */
  updateServerPort(newPort: number): void {
    this.moduleIntegrations.forEach((integration, moduleId) => {
      // 更新配置中的端口
      (integration as any).config.serverPort = newPort;
      console.log(`📝 Debug集成端口已更新: ${moduleId} -> 端口${newPort}`);
    });
  }

  /**
   * 获取所有模块的统计信息
   */
  getAllStatistics() {
    const stats: Record<string, any> = {};
    this.moduleIntegrations.forEach((integration, moduleId) => {
      stats[moduleId] = integration.getStatistics();
    });
    return stats;
  }
}