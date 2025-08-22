/**
 * 流水线生命周期管理器 - 重构版本使用分拆模块
 *
 * 设计原则：
 * 1. 严格分层：Client → Router → Transformer → Protocol → Server-Compatibility → Server
 * 2. 零fallback：失败时立即停止，不进行降级或备用处理
 * 3. 配置驱动：完全基于用户配置和系统配置运行
 * 4. 模块化：使用分拆的专门模块处理不同职责
 * 5. 生命周期管理：统一处理启动、运行、监控和关闭
 *
 * @author RCC v4.0 - Refactored
 */

import { EventEmitter } from 'events';
import { ConfigReader, MergedConfig } from '../config/config-reader';
import { secureLogger } from '../utils/secure-logger';

// 导入新的分拆模块
import { PipelineRequestProcessor, RequestContext, PipelineStats } from './pipeline-request-processor';
import { PipelineCompatibilityManager } from './pipeline-compatibility-manager';
import { PipelineTableManager, RoutingTable } from './pipeline-table-manager';
import { PipelineServerManager, ServerInitializationResult, ServerHealthStatus, ServerMetrics } from './pipeline-server-manager';

// 导入constants
import {
  DEFAULT_SERVER_CONFIG,
  SERVER_STATUS,
  HEALTH_CHECK_CONFIG,
  METRICS_CONFIG,
  CACHE_CONFIG,
  SERVER_LIFECYCLE_DELAYS,
  ERROR_MESSAGES,
  LOG_MESSAGES,
  SERVER_METHODS
} from '../constants/server-constants';

export interface PipelineLifecycleStats {
  uptime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  serverMetrics: ServerMetrics;
  requestProcessorStats: PipelineStats;
  routingTableStats: {
    totalPipelines: number;
    virtualModels: string[];
    lastReload: string;
  };
}

export interface LifecycleHealthStatus {
  healthy: boolean;
  components: {
    requestProcessor: boolean;
    compatibilityManager: boolean;
    tableManager: boolean;
    serverManager: boolean;
  };
  serverHealth: ServerHealthStatus;
  errors: string[];
  lastCheck: string;
}

/**
 * 重构后的流水线生命周期管理器
 * 使用分拆的专门模块处理不同职责
 */
export class PipelineLifecycleManager extends EventEmitter {
  private config: MergedConfig;
  private isRunning = false;
  private startTime?: Date;
  private isInitialized = false;

  // 分拆的专门模块
  private requestProcessor: PipelineRequestProcessor;
  private compatibilityManager: PipelineCompatibilityManager;
  private tableManager: PipelineTableManager;
  private serverManager: PipelineServerManager;

  // 状态追踪
  private activeRequests = new Map<string, RequestContext>();
  private stats: PipelineLifecycleStats;

  private debugEnabled: boolean = false;

  constructor(userConfigPath?: string, systemConfigPath?: string, debugEnabled?: boolean) {
    super();

    // 设置debug选项
    this.debugEnabled = debugEnabled || false;

    // 加载配置
    this.config = ConfigReader.loadConfig(userConfigPath, systemConfigPath);
    
    secureLogger.info('PipelineLifecycleManager初始化开始', {
      userConfigPath: userConfigPath || 'default',
      systemConfigPath: systemConfigPath || 'default',
      hasProviders: !!(this.config.providers && this.config.providers.length > 0),
      debugEnabled: this.debugEnabled,
    });

    // 初始化分拆模块
    this.initializeModules();

    // 初始化统计信息
    this.initializeStats();

    // 设置事件监听
    this.setupEventListeners();

    secureLogger.info('PipelineLifecycleManager初始化完成', {
      totalProviders: this.config.providers?.length || 0,
      serverPort: this.config.server?.port || DEFAULT_SERVER_CONFIG.PORT,
      modulesInitialized: true,
    });
  }

  /**
   * 初始化所有分拆模块
   */
  private initializeModules(): void {
    secureLogger.debug('初始化分拆模块');

    // 1. 初始化流水线表管理器
    this.tableManager = new PipelineTableManager(this.config);

    // 2. 初始化兼容性管理器
    this.compatibilityManager = new PipelineCompatibilityManager(this.config);

    // 3. 初始化请求处理器 (传递debug选项)
    this.requestProcessor = new PipelineRequestProcessor(this.config, this.debugEnabled);

    // 4. 初始化服务器管理器
    this.serverManager = new PipelineServerManager(this.config);

    secureLogger.debug('所有分拆模块初始化完成');
  }

  /**
   * 初始化统计信息
   */
  private initializeStats(): void {
    this.stats = {
      uptime: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      serverMetrics: {
        uptime: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        routerStats: {},
        memoryUsage: 0,
      },
      requestProcessorStats: {
        uptime: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        layerHealth: {},
        routerStats: {},
      },
      routingTableStats: {
        totalPipelines: 0,
        virtualModels: [],
        lastReload: new Date().toISOString(),
      },
    };
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听请求处理器事件
    this.requestProcessor.on('requestCompleted', (data) => {
      this.updateRequestStats(data.responseTime, data.success);
    });

    // 监听服务器管理器事件
    this.serverManager.on('serverStarted', () => {
      this.emit('serverStarted');
    });

    this.serverManager.on('serverStopped', () => {
      this.emit('serverStopped');
    });

    // 监听兼容性管理器事件
    this.compatibilityManager.on('moduleLoaded', (data) => {
      secureLogger.debug('兼容性模块加载', data);
    });
  }

  /**
   * 启动完整的RCC v4.0流水线系统
   */
  async start(): Promise<boolean> {
    if (this.isRunning) {
      secureLogger.warn(ERROR_MESSAGES.SERVER_ALREADY_RUNNING);
      return true;
    }

    try {
      secureLogger.info(LOG_MESSAGES.SERVER_INIT_START);
      this.startTime = new Date();

      // Step 1: 初始化服务器
      const serverResult = await this.serverManager.initializeServer();
      if (!serverResult.success) {
        throw new Error(`Server initialization failed: ${serverResult.error}`);
      }

      // Step 2: 启动服务器
      const port = this.config.server?.port || DEFAULT_SERVER_CONFIG.PORT;
      const startSuccess = await this.serverManager.startServer(port);
      if (!startSuccess) {
        throw new Error('Server start failed');
      }

      // 标记为已初始化和运行中
      this.isInitialized = true;
      this.isRunning = true;

      // 开始监控
      this.startMonitoring();

      secureLogger.info(LOG_MESSAGES.SERVER_START_SUCCESS, {
        port,
        initializationTime: serverResult.initializationTime,
        uptime: 0,
      });

      this.emit('systemStarted', {
        port,
        initializationTime: serverResult.initializationTime,
      });

      return true;

    } catch (error) {
      secureLogger.error(LOG_MESSAGES.SERVER_START_FAILED, {
        error: error.message,
        stack: error.stack,
      });

      // 清理部分初始化的资源
      await this.cleanup();
      return false;
    }
  }

  /**
   * 停止流水线系统
   */
  async stop(): Promise<boolean> {
    if (!this.isRunning) {
      secureLogger.warn(ERROR_MESSAGES.SERVER_NOT_RUNNING);
      return true;
    }

    try {
      secureLogger.info('停止Pipeline系统');

      // 停止服务器
      const stopSuccess = await this.serverManager.stopServer();
      if (!stopSuccess) {
        secureLogger.warn('服务器停止失败，但继续清理其他资源');
      }

      // 等待活跃请求完成
      await this.waitForActiveRequests();

      // 清理资源
      await this.cleanup();

      this.isRunning = false;
      
      secureLogger.info(LOG_MESSAGES.SERVER_STOP_SUCCESS);
      this.emit('systemStopped');

      return true;

    } catch (error) {
      secureLogger.error(LOG_MESSAGES.SERVER_STOP_FAILED, {
        error: error.message,
        stack: error.stack,
      });
      return false;
    }
  }

  /**
   * 重启流水线系统
   */
  async restart(): Promise<boolean> {
    secureLogger.info(LOG_MESSAGES.SERVER_RESTART_SUCCESS);
    
    const stopSuccess = await this.stop();
    if (!stopSuccess) {
      secureLogger.error(LOG_MESSAGES.SERVER_RESTART_FAILED);
      return false;
    }

    // 等待资源释放
    await new Promise(resolve => setTimeout(resolve, SERVER_LIFECYCLE_DELAYS.RESTART_DELAY_MS));

    const startSuccess = await this.start();
    if (!startSuccess) {
      secureLogger.error(LOG_MESSAGES.SERVER_RESTART_FAILED);
      return false;
    }

    secureLogger.info(LOG_MESSAGES.SERVER_RESTART_SUCCESS);
    return true;
  }

  /**
   * 处理请求 - 使用分拆的请求处理器
   */
  async processRequest(protocol: string, input: any): Promise<any> {
    if (!this.isRunning) {
      throw new Error(ERROR_MESSAGES.SERVER_NOT_RUNNING);
    }

    if (!this.isInitialized) {
      throw new Error(ERROR_MESSAGES.SERVER_NOT_INITIALIZED);
    }

    const requestId = this.generateRequestId();
    const executionContext = {
      requestId,
      metadata: {
        protocol,
        timestamp: new Date().toISOString(),
      },
    };

    secureLogger.debug('处理请求开始', {
      requestId,
      protocol,
      hasInput: !!input,
    });

    const startTime = Date.now();

    try {
      // 使用请求处理器处理完整的6层流水线
      const result = await this.requestProcessor.processRequest(protocol, input, executionContext);
      
      const responseTime = Date.now() - startTime;
      this.updateRequestStats(responseTime, true);

      secureLogger.info('请求处理成功', {
        requestId,
        responseTime,
        totalRequests: this.stats.totalRequests,
      });

      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateRequestStats(responseTime, false);

      secureLogger.error('请求处理失败', {
        requestId,
        error: error.message,
        responseTime,
      });

      throw error;
    }
  }

  /**
   * 获取系统健康状态
   */
  async getHealthStatus(): Promise<LifecycleHealthStatus> {
    const errors: string[] = [];

    // 检查服务器健康状态
    const serverHealth = await this.serverManager.getHealthStatus();
    if (!serverHealth.healthy) {
      errors.push(...serverHealth.errors);
    }

    // 检查各组件状态
    const components = {
      requestProcessor: !!this.requestProcessor,
      compatibilityManager: !!this.compatibilityManager,
      tableManager: !!this.tableManager,
      serverManager: !!this.serverManager,
    };

    // 检查各组件是否存在问题
    if (!components.requestProcessor) {
      errors.push('Request processor not initialized');
    }
    if (!components.compatibilityManager) {
      errors.push('Compatibility manager not initialized');
    }
    if (!components.tableManager) {
      errors.push('Table manager not initialized');
    }
    if (!components.serverManager) {
      errors.push('Server manager not initialized');
    }

    const healthy = this.isRunning && 
                   serverHealth.healthy && 
                   Object.values(components).every(status => status);

    return {
      healthy,
      components,
      serverHealth,
      errors,
      lastCheck: new Date().toISOString(),
    };
  }

  /**
   * 获取系统统计信息
   */
  getStats(): PipelineLifecycleStats {
    const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;

    // 获取各模块的统计信息
    const serverMetrics = this.serverManager.getServerMetrics();
    const requestProcessorStats = this.requestProcessor.getStats();

    // 获取路由表统计
    const routingTableStats = this.getRoutingTableStats();

    return {
      ...this.stats,
      uptime,
      serverMetrics,
      requestProcessorStats,
      routingTableStats,
    };
  }

  /**
   * 重新加载路由表
   */
  async reloadRoutingTable(): Promise<boolean> {
    secureLogger.info('重新加载路由表');

    try {
      // 使用服务器管理器重新加载路由表
      const reloadSuccess = await this.serverManager.reloadRoutingTable();
      
      if (reloadSuccess) {
        this.stats.routingTableStats.lastReload = new Date().toISOString();
        secureLogger.info(LOG_MESSAGES.ROUTING_TABLE_RELOAD_SUCCESS);
      } else {
        secureLogger.error(LOG_MESSAGES.ROUTING_TABLE_RELOAD_FAILED);
      }

      return reloadSuccess;

    } catch (error) {
      secureLogger.error(LOG_MESSAGES.ROUTING_TABLE_RELOAD_FAILED, {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * 获取配置信息
   */
  getConfig(): MergedConfig {
    return this.config;
  }

  /**
   * 获取运行状态
   */
  isSystemRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 获取系统信息
   */
  getSystemInfo(): {
    running: boolean;
    initialized: boolean;
    uptime: number;
    modules: Record<string, boolean>;
    serverInfo: any;
  } {
    return {
      running: this.isRunning,
      initialized: this.isInitialized,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      modules: {
        requestProcessor: !!this.requestProcessor,
        compatibilityManager: !!this.compatibilityManager,
        tableManager: !!this.tableManager,
        serverManager: !!this.serverManager,
      },
      serverInfo: this.serverManager.getServerInfo(),
    };
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 更新请求统计
   */
  private updateRequestStats(responseTime: number, success: boolean): void {
    this.stats.totalRequests++;
    
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }

    // 更新平均响应时间（简单移动平均）
    const totalResponseTime = this.stats.averageResponseTime * (this.stats.totalRequests - 1) + responseTime;
    this.stats.averageResponseTime = totalResponseTime / this.stats.totalRequests;

    // 更新服务器管理器的统计
    this.serverManager.updateRequestMetrics(responseTime, success);
  }

  /**
   * 获取路由表统计信息
   */
  private getRoutingTableStats(): {
    totalPipelines: number;
    virtualModels: string[];
    lastReload: string;
  } {
    try {
      const serverInfo = this.serverManager.getServerInfo();
      const routingTable = serverInfo.routingTable;
      
      if (routingTable) {
        return {
          totalPipelines: routingTable.totalPipelines,
          virtualModels: Object.keys(routingTable.pipelinesGroupedByVirtualModel),
          lastReload: this.stats.routingTableStats.lastReload,
        };
      }
    } catch (error) {
      secureLogger.warn('获取路由表统计失败', { error: error.message });
    }

    return this.stats.routingTableStats;
  }

  /**
   * 开始监控
   */
  private startMonitoring(): void {
    // 定期更新统计信息
    setInterval(() => {
      this.updateSystemStats();
    }, METRICS_CONFIG.UPDATE_INTERVAL_MS);

    secureLogger.debug('系统监控已启动');
  }

  /**
   * 更新系统统计信息
   */
  private updateSystemStats(): void {
    if (!this.isRunning) return;

    try {
      // 更新内存使用情况
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage();
        this.stats.serverMetrics.memoryUsage = memUsage.heapUsed / METRICS_CONFIG.MEMORY_UNIT_MB;
      }

      // 发出统计更新事件
      this.emit('statsUpdated', this.stats);

    } catch (error) {
      secureLogger.warn('更新系统统计失败', { error: error.message });
    }
  }

  /**
   * 等待活跃请求完成
   */
  private async waitForActiveRequests(): Promise<void> {
    if (this.activeRequests.size === 0) {
      return;
    }

    secureLogger.info('等待活跃请求完成', {
      activeRequests: this.activeRequests.size,
    });

    // 等待最多30秒
    const maxWaitTime = 30000;
    const startWait = Date.now();

    while (this.activeRequests.size > 0 && (Date.now() - startWait) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.activeRequests.size > 0) {
      secureLogger.warn('仍有活跃请求未完成，强制继续', {
        remainingRequests: this.activeRequests.size,
      });
    }
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    secureLogger.info(LOG_MESSAGES.RESOURCE_CLEANUP_START);

    try {
      // 清理服务器管理器
      if (this.serverManager) {
        await this.serverManager.cleanup();
      }

      // 清理兼容性管理器
      if (this.compatibilityManager) {
        await this.compatibilityManager.cleanup();
      }

      // 清理表管理器缓存
      if (this.tableManager) {
        this.tableManager.clearCache();
      }

      // 清理活跃请求
      this.activeRequests.clear();

      // 重置状态
      this.isInitialized = false;

      secureLogger.info(LOG_MESSAGES.RESOURCE_CLEANUP_SUCCESS);

    } catch (error) {
      secureLogger.error(LOG_MESSAGES.RESOURCE_CLEANUP_ERROR, {
        error: error.message,
        stack: error.stack,
      });
    }
  }
}