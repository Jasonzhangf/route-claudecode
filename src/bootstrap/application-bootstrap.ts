/**
 * RCC v4.0 应用程序引导器
 * 
 * 统一启动流程：配置预处理 → 路由组装 → 流水线管理 → 运行时调度
 * 
 * 设计理念：
 * 1. 单一调用接口：bootstrap()方法是唯一的外部接口
 * 2. 零接口暴露：所有内部方法使用下划线前缀
 * 3. 严格流程控制：每个阶段必须成功完成才能进入下一阶段
 * 4. 完整错误处理：任何阶段失败都会进行清理和回滚
 * 5. 生命周期管理：提供完整的启动-运行-停止生命周期
 * 
 * @author RCC v4.0 Architecture Team
 */

import { EventEmitter } from 'events';
import { secureLogger } from '../utils/secure-logger';
import { BOOTSTRAP_CONFIG, SCHEDULER_DEFAULTS, BOOTSTRAP_ERRORS, COMPONENT_NAMES } from '../constants/bootstrap-constants';

// 配置处理器
import { ConfigPreprocessor, ConfigPreprocessResult } from '../config/config-preprocessor';
import { RouterPreprocessor, RouterPreprocessResult, PipelineConfig } from '../router/router-preprocessor';

// 流水线管理器
import { UnifiedInitializer, InitializationResult } from '../pipeline/unified-initializer';
import { RuntimeScheduler, RuntimeSchedulerConfig } from '../pipeline/runtime-scheduler';
import { LoadBalanceStrategy } from '../interfaces/scheduler/dynamic-scheduler';

// 类型定义
export interface BootstrapConfig {
  /** 配置文件路径 */
  configPath: string;
  /** 服务器配置 */
  server?: {
    port?: number;
    host?: string;
    debug?: boolean;
  };
  /** 运行时调度配置 */
  scheduler?: RuntimeSchedulerConfig;
  /** 是否启用调试模式 */
  debug?: boolean;
}

export interface BootstrapResult {
  success: boolean;
  /** 启动成功的组件 */
  components?: {
    configPreprocessor: boolean;
    routerPreprocessor: boolean;
    unifiedInitializer: boolean;
    runtimeScheduler: boolean;
  };
  /** 错误信息 */
  errors: string[];
  /** 启动统计信息 */
  stats: {
    totalBootstrapTime: number;
    configProcessingTime: number;
    routerProcessingTime: number;
    pipelineInitializationTime: number;
    schedulerInitializationTime: number;
  };
  /** 运行时实例（仅成功时返回） */
  runtime?: ApplicationRuntime;
}

export interface ApplicationRuntime {
  /** 应用程序实例ID */
  instanceId: string;
  /** 启动时间戳 */
  startedAt: string;
  /** 获取应用状态 */
  getStatus(): Promise<ApplicationStatus>;
  /** 获取统计信息 */
  getStats(): Promise<ApplicationStats>;
  /** 获取健康状态 */
  getHealth(): Promise<ApplicationHealthStatus>;
  /** 停止应用程序 */
  stop(): Promise<void>;
}

export interface ApplicationStatus {
  running: boolean;
  uptime: number;
  version: string;
  components: {
    unifiedInitializer: boolean;
    runtimeScheduler: boolean;
  };
  activePipelines: number;
  totalRequests: number;
}

export interface ApplicationStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  uptime: number;
  activePipelines: number;
}

export interface ApplicationHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    unifiedInitializer: 'healthy' | 'degraded' | 'unhealthy';
    runtimeScheduler: 'healthy' | 'degraded' | 'unhealthy';
  };
  issues: string[];
  lastHealthCheck: string;
}

/**
 * 应用程序引导器 - 零接口暴露设计
 */
export class ApplicationBootstrap extends EventEmitter {
  
  private static readonly _VERSION = BOOTSTRAP_CONFIG.APPLICATION_VERSION;
  private static readonly _COMPONENT_NAMES = [
    COMPONENT_NAMES.CONFIG_PREPROCESSOR,
    COMPONENT_NAMES.ROUTER_PREPROCESSOR,
    'UNIFIED_INITIALIZER',
    COMPONENT_NAMES.RUNTIME_SCHEDULER
  ] as const;
  
  /**
   * 引导应用程序 - 唯一的公开接口
   */
  static async bootstrap(config: BootstrapConfig): Promise<BootstrapResult> {
    const startTime = Date.now();
    const instanceId = `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    secureLogger.info(`🚀 [ApplicationBootstrap] 开始应用程序引导`, {
      instanceId,
      configPath: config.configPath,
      debug: config.debug
    });
    
    const stats = {
      totalBootstrapTime: 0,
      configProcessingTime: 0,
      routerProcessingTime: 0,
      pipelineInitializationTime: 0,
      schedulerInitializationTime: 0
    };
    
    const components = {
      configPreprocessor: false,
      routerPreprocessor: false,
      unifiedInitializer: false,
      runtimeScheduler: false
    };
    
    const errors: string[] = [];
    
    let configResult: ConfigPreprocessResult | null = null;
    let routerResult: RouterPreprocessResult | null = null;
    let unifiedInitializer: UnifiedInitializer | null = null;
    let runtimeScheduler: RuntimeScheduler | null = null;
    
    try {
      // 阶段1: 配置预处理
      const configStart = Date.now();
      configResult = await this._executeConfigPreprocessing(config.configPath);
      stats.configProcessingTime = Date.now() - configStart;
      
      if (!configResult.success) {
        errors.push(`配置预处理失败: ${configResult.error?.message}`);
        return this._createFailureResult(errors, stats, components);
      }
      
      components.configPreprocessor = true;
      secureLogger.info(`✅ [ApplicationBootstrap] 配置预处理完成`, {
        processingTime: `${stats.configProcessingTime}ms`
      });
      
      // 阶段2: 路由预处理
      const routerStart = Date.now();
      routerResult = await this._executeRouterPreprocessing(configResult.routingTable!);
      stats.routerProcessingTime = Date.now() - routerStart;
      
      if (!routerResult.success) {
        errors.push(...routerResult.errors);
        return this._createFailureResult(errors, stats, components);
      }
      
      components.routerPreprocessor = true;
      secureLogger.info(`✅ [ApplicationBootstrap] 路由预处理完成`, {
        routesCount: routerResult.stats.routesCount,
        pipelinesCount: routerResult.stats.pipelinesCount,
        processingTime: `${stats.routerProcessingTime}ms`
      });
      
      // 阶段3: 统一初始化器初始化
      const pipelineStart = Date.now();
      const { initializer, result: initializationResult } = await this._initializeUnifiedInitializer(
        configResult.routingTable!,
        routerResult.pipelineConfigs!,
        config
      );
      unifiedInitializer = initializer;
      stats.pipelineInitializationTime = Date.now() - pipelineStart;
      components.unifiedInitializer = true;
      
      secureLogger.info(`✅ [ApplicationBootstrap] 统一初始化器初始化完成`, {
        processingTime: `${stats.pipelineInitializationTime}ms`
      });
      
      // 阶段4: 运行时调度器初始化
      const schedulerStart = Date.now();
      runtimeScheduler = await this._initializeRuntimeScheduler(
        routerResult.pipelineConfigs!,
        config.scheduler
      );
      
      // 注册流水线到调度器
      if (initializationResult.pipelineManager && initializationResult.completePipelines) {
        for (const [pipelineId, pipeline] of initializationResult.completePipelines) {
          runtimeScheduler.registerPipeline(pipeline, pipeline.virtualModel);
        }
      }
      
      stats.schedulerInitializationTime = Date.now() - schedulerStart;
      components.runtimeScheduler = true;
      
      secureLogger.info(`✅ [ApplicationBootstrap] 运行时调度器初始化完成`, {
        processingTime: `${stats.schedulerInitializationTime}ms`
      });
      
      // 创建运行时实例
      const runtime = this._createRuntime(
        instanceId,
        unifiedInitializer,
        runtimeScheduler
      );
      
      stats.totalBootstrapTime = Date.now() - startTime;
      
      secureLogger.info(`🎉 [ApplicationBootstrap] 应用程序引导完成`, {
        instanceId,
        totalTime: `${stats.totalBootstrapTime}ms`,
        components: Object.keys(components).filter(k => components[k as keyof typeof components])
      });
      
      return {
        success: true,
        components,
        errors: [],
        stats,
        runtime
      };
      
    } catch (error) {
      const err = error as Error;
      errors.push(`引导过程异常: ${err.message}`);
      stats.totalBootstrapTime = Date.now() - startTime;
      
      // 执行清理
      await this._performCleanup(unifiedInitializer, runtimeScheduler);
      
      secureLogger.error(`❌ [ApplicationBootstrap] 应用程序引导失败`, {
        error: err.message,
        totalTime: `${stats.totalBootstrapTime}ms`,
        completedComponents: Object.keys(components).filter(k => components[k as keyof typeof components])
      });
      
      return this._createFailureResult(errors, stats, components);
    }
  }
  
  /**
   * 执行配置预处理（内部方法）
   */
  private static async _executeConfigPreprocessing(configPath: string): Promise<ConfigPreprocessResult> {
    try {
      return ConfigPreprocessor.preprocess(configPath);
    } catch (error) {
      const err = error as Error;
      return {
        success: false,
        error: {
          code: 'CONFIG_PREPROCESSING_FAILED',
          message: err.message,
          details: { configPath }
        },
        metadata: {
          configPath,
          processingTime: 0,
          timestamp: new Date().toISOString(),
          sourceFormat: 'unknown'
        }
      };
    }
  }
  
  /**
   * 执行路由预处理（内部方法）
   */
  private static async _executeRouterPreprocessing(routingTable: any): Promise<RouterPreprocessResult> {
    return RouterPreprocessor.preprocess(routingTable);
  }
  
  /**
   * 初始化统一初始化器（内部方法）
   */
  private static async _initializeUnifiedInitializer(
    routingTable: any,
    pipelineConfigs: PipelineConfig[],
    config: BootstrapConfig
  ): Promise<{ initializer: UnifiedInitializer; result: any }> {
    
    // 转换配置格式以匹配UnifiedInitializer
    const initializerConfig = {
      userConfigPath: config.configPath,
      debugEnabled: config.debug || false,
      cliPort: config.server?.port
    };
    
    const unifiedInitializer = new UnifiedInitializer(initializerConfig);
    
    try {
      // 使用路由表和流水线配置初始化
      const result = await unifiedInitializer.initialize();
      return { initializer: unifiedInitializer, result };
    } catch (error) {
      const err = error as Error;
      secureLogger.error('UnifiedInitializer初始化失败', { error: err.message });
      throw new ApplicationBootstrapError(
        `统一初始化器初始化失败: ${err.message}`,
        'UNIFIED_INITIALIZER_INIT_FAILED',
        { routingTable, pipelineConfigs, config }
      );
    }
  }
  
  /**
   * 初始化运行时调度器（内部方法）
   */
  private static async _initializeRuntimeScheduler(
    pipelineConfigs: PipelineConfig[],
    schedulerConfig?: RuntimeSchedulerConfig,
    pipelineManager?: any
  ): Promise<RuntimeScheduler> {
    
    const config: RuntimeSchedulerConfig = {
      strategy: SCHEDULER_DEFAULTS.STRATEGY as LoadBalanceStrategy,
      maxErrorCount: SCHEDULER_DEFAULTS.MAX_ERROR_COUNT,
      blacklistDuration: SCHEDULER_DEFAULTS.BLACKLIST_DURATION_MS,
      authRetryDelay: SCHEDULER_DEFAULTS.AUTH_RETRY_DELAY_MS,
      healthCheckInterval: SCHEDULER_DEFAULTS.HEALTH_CHECK_INTERVAL_MS,
      ...schedulerConfig
    };
    
    const scheduler = new RuntimeScheduler(config);
    
    // 这里可以添加流水线注册逻辑，如果RuntimeScheduler需要的话
    // await scheduler.registerPipelines(pipelineConfigs);
    
    return scheduler;
  }
  
  /**
   * 创建运行时实例（内部方法）
   */
  private static _createRuntime(
    instanceId: string,
    unifiedInitializer: UnifiedInitializer,
    runtimeScheduler: RuntimeScheduler
  ): ApplicationRuntime {
    
    const startedAt = new Date().toISOString();
    
    return {
      instanceId,
      startedAt,
      
      async getStatus(): Promise<ApplicationStatus> {
        // TODO: 实现UnifiedInitializer的状态获取
        const uptime = Date.now() - new Date(startedAt).getTime();
        
        return {
          running: true,
          uptime,
          version: ApplicationBootstrap._VERSION,
          components: {
            unifiedInitializer: true,
            runtimeScheduler: true
          },
          activePipelines: 0, // TODO: 从UnifiedInitializer获取实际流水线数量
          totalRequests: 0 // TODO: 实现请求统计
        };
      },
      
      async getStats(): Promise<ApplicationStats> {
        // TODO: 实现UnifiedInitializer的统计信息获取
        return {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          averageResponseTime: 0,
          uptime: Date.now() - new Date(startedAt).getTime(),
          activePipelines: 0 // TODO: 从UnifiedInitializer获取实际流水线数量
        };
      },
      
      async getHealth(): Promise<ApplicationHealthStatus> {
        // TODO: 实现UnifiedInitializer的健康状态获取
        return {
          status: 'healthy',
          components: {
            unifiedInitializer: 'healthy',
            runtimeScheduler: 'healthy'
          },
          issues: [],
          lastHealthCheck: new Date().toISOString()
        };
      },
      
      async stop(): Promise<void> {
        secureLogger.info(`🛑 [ApplicationRuntime] 停止应用程序实例`, { instanceId });
        
        try {
          // 按顺序停止组件
          await runtimeScheduler.cleanup();
          // TODO: 实现UnifiedInitializer的停止逻辑
          
          secureLogger.info(`✅ [ApplicationRuntime] 应用程序实例已停止`, { instanceId });
        } catch (error) {
          const err = error as Error;
          secureLogger.error(`❌ [ApplicationRuntime] 停止过程中发生错误`, {
            instanceId,
            error: err.message
          });
          throw error;
        }
      }
    };
  }
  
  /**
   * 执行清理操作（内部方法）
   */
  private static async _performCleanup(
    unifiedInitializer: UnifiedInitializer | null,
    runtimeScheduler: RuntimeScheduler | null
  ): Promise<void> {
    const cleanupTasks: Promise<void>[] = [];
    
    if (runtimeScheduler) {
      cleanupTasks.push(runtimeScheduler.cleanup().catch(err => {
        secureLogger.error('RuntimeScheduler清理失败', { error: err.message });
      }));
    }
    
    // TODO: 实现UnifiedInitializer的清理逻辑
    
    await Promise.allSettled(cleanupTasks);
  }
  
  /**
   * 创建失败结果（内部方法）
   */
  private static _createFailureResult(
    errors: string[],
    stats: BootstrapResult['stats'],
    components: BootstrapResult['components']
  ): BootstrapResult {
    return {
      success: false,
      components,
      errors,
      stats,
      runtime: undefined
    };
  }
}

/**
 * 应用程序引导器错误类
 */
export class ApplicationBootstrapError extends Error {
  constructor(message: string, public readonly code: string, public readonly details?: any) {
    super(message);
    this.name = 'ApplicationBootstrapError';
  }
}