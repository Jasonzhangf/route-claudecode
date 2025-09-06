/**
 * 全局Debug系统初始化器
 * 
 * 负责初始化和协调所有模块的debug系统
 */

import { GlobalDebugIntegration, ModuleDebugIntegration } from './debug-integration';

/**
 * RCC v4.0 全局Debug初始化器
 */
export class RCCDebugInitializer {
  private static instance: RCCDebugInitializer;
  private globalDebug: GlobalDebugIntegration;
  private initialized: boolean = false;

  constructor() {
    this.globalDebug = GlobalDebugIntegration.getInstance();
  }

  static getInstance(): RCCDebugInitializer {
    if (!RCCDebugInitializer.instance) {
      RCCDebugInitializer.instance = new RCCDebugInitializer();
    }
    return RCCDebugInitializer.instance;
  }

  /**
   * 初始化所有RCC模块的debug系统
   */
  async initializeAllModules(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // 注册所有核心模块
    this.registerCoreModules();

    // 初始化所有模块的debug系统
    await this.globalDebug.initializeAll();

    this.initialized = true;
  }

  /**
   * 注册RCC的核心模块
   */
  private registerCoreModules(): void {
    // Config模块
    this.globalDebug.registerModule({
      moduleId: 'config',
      moduleName: 'ConfigPreprocessor',
      enabled: true,
      captureLevel: 'full'
    });

    // Router模块
    this.globalDebug.registerModule({
      moduleId: 'router',
      moduleName: 'RouterPreprocessor',
      enabled: true,
      captureLevel: 'full'
    });

    // Pipeline模块
    this.globalDebug.registerModule({
      moduleId: 'pipeline',
      moduleName: 'PipelineAssembler',
      enabled: true,
      captureLevel: 'full'
    });

    // Pipeline管理器
    this.globalDebug.registerModule({
      moduleId: 'pipeline-manager',
      moduleName: 'PipelineManager',
      enabled: true,
      captureLevel: 'full'
    });

    // 自检模块
    this.globalDebug.registerModule({
      moduleId: 'self-check',
      moduleName: 'SelfCheckService',
      enabled: true,
      captureLevel: 'basic'
    });

    // 错误处理模块
    this.globalDebug.registerModule({
      moduleId: 'error-handler',
      moduleName: 'EnhancedErrorHandler',
      enabled: true,
      captureLevel: 'full'
    });

    // 服务器模块
    this.globalDebug.registerModule({
      moduleId: 'server',
      moduleName: 'HTTPServer',
      enabled: true,
      captureLevel: 'full'
    });

    // Pipeline组装器模块
    this.globalDebug.registerModule({
      moduleId: 'pipeline-assembler',
      moduleName: 'PipelineAssembler',
      enabled: true,
      captureLevel: 'full'
    });

    // Pipeline管理器模块
    this.globalDebug.registerModule({
      moduleId: 'pipeline-manager',
      moduleName: 'PipelineManager',
      enabled: true,
      captureLevel: 'full'
    });

    // Provider管理器模块
    this.globalDebug.registerModule({
      moduleId: 'providers',
      moduleName: 'ProviderManager',
      enabled: true,
      captureLevel: 'full'
    });
  }

  /**
   * 开始全局debug会话
   */
  startGlobalSession(sessionId?: string): string {
    return this.globalDebug.startGlobalSession(sessionId);
  }

  /**
   * 结束全局debug会话
   */
  async endGlobalSession(): Promise<void> {
    await this.globalDebug.endGlobalSession();
  }

  /**
   * 获取指定模块的debug集成实例
   */
  getModuleDebugIntegration(moduleId: string): ModuleDebugIntegration | undefined {
    return this.globalDebug.getModule(moduleId);
  }

  /**
   * 获取所有模块的统计信息
   */
  getAllStatistics() {
    return this.globalDebug.getAllStatistics();
  }

  /**
   * 检查debug系统是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * 全局debug初始化器实例
 */
export const globalDebugInit = RCCDebugInitializer.getInstance();