/**
 * 配置热重载主模块
 * 
 * 集成配置热重载器、版本管理器和通知管理器，提供完整的配置管理解决方案
 * 
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import * as express from 'express';
import {
  IConfigHotReloadModule,
  IConfigHotReloader,
  IConfigVersionManager,
  IConfigNotificationManager,
  ConfigHotReloadConfig,
  ConfigWatchOptions,
  ConfigUpdateOptions,
  ConfigUpdateResult,
  ConfigStatusOverview,
  ConfigHealthCheckResult,
  ConfigHotReloadEvents
} from '../interfaces/core/config-hot-reload-interface';
import { IModule, ModuleConfig } from '../interfaces/core/module-interface';
import { ConfigHotReloader } from './config-hot-reloader';
import { ConfigVersionManager } from './config-version-manager';
import { ConfigNotificationManager } from './config-notification-manager';

/**
 * 配置热重载模块配置的默认值
 */
const DEFAULT_CONFIG: ConfigHotReloadConfig = {
  id: 'config-hot-reload',
  name: 'Configuration Hot Reload Module',
  version: '1.0.0',
  enabled: true,
  watchPaths: [],
  autoReload: true,
  validationLevel: 'basic' as any,
  backupEnabled: true,
  maxVersions: 100,
  cleanupInterval: 24 * 60 * 60 * 1000, // 24小时
  notificationTimeout: 5000,
  debounceDelay: 300,
  maxRetries: 3,
  enableRollback: true
};

/**
 * 配置热重载主模块实现
 */
export class ConfigHotReloadModule extends EventEmitter implements IConfigHotReloadModule {
  public readonly config: ConfigHotReloadConfig;
  public readonly hotReloader: IConfigHotReloader;
  public readonly versionManager: IConfigVersionManager;
  public readonly notificationManager: IConfigNotificationManager;

  private isInitialized = false;
  private isStarted = false;
  private webServer?: express.Application;
  private monitoringActive = false;

  constructor(config: Partial<ConfigHotReloadConfig> = {}) {
    super();
    
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // 初始化子组件
    this.hotReloader = new ConfigHotReloader();
    this.versionManager = new ConfigVersionManager(this.config.maxVersions, true);
    this.notificationManager = new ConfigNotificationManager();

    this.setupEventHandling();
    this.setupErrorHandling();
  }

  /**
   * 模块ID
   */
  get id(): string {
    return this.config.id;
  }

  /**
   * 模块名称
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * 模块版本
   */
  get version(): string {
    return this.config.version;
  }

  /**
   * 模块是否启用
   */
  get enabled(): boolean {
    return this.config.enabled;
  }

  /**
   * 初始化模块
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn(`Module ${this.id} is already initialized`);
      return;
    }

    console.log(`Initializing ConfigHotReloadModule ${this.version}...`);

    try {
      // 初始化Web服务器
      this.setupWebServer();

      this.isInitialized = true;
      this.emit('initialized', {
        moduleId: this.id,
        timestamp: new Date()
      });

      console.log(`ConfigHotReloadModule initialized successfully`);

    } catch (error) {
      console.error(`Failed to initialize ConfigHotReloadModule:`, error);
      throw error;
    }
  }

  /**
   * 启动模块
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isStarted) {
      console.warn(`Module ${this.id} is already started`);
      return;
    }

    console.log(`Starting ConfigHotReloadModule...`);

    try {
      // 自动开始监控（如果启用且有路径）
      if (this.config.autoReload && this.config.watchPaths.length > 0) {
        await this.startConfigMonitoring(this.config.watchPaths);
      }

      this.isStarted = true;
      this.emit('started', {
        moduleId: this.id,
        timestamp: new Date()
      });

      console.log(`ConfigHotReloadModule started successfully`);

    } catch (error) {
      console.error(`Failed to start ConfigHotReloadModule:`, error);
      throw error;
    }
  }

  /**
   * 停止模块
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      console.warn(`Module ${this.id} is not started`);
      return;
    }

    console.log(`Stopping ConfigHotReloadModule...`);

    try {
      // 停止配置监控
      if (this.monitoringActive) {
        await this.stopConfigMonitoring();
      }

      this.isStarted = false;
      this.emit('stopped', {
        moduleId: this.id,
        timestamp: new Date()
      });

      console.log(`ConfigHotReloadModule stopped successfully`);

    } catch (error) {
      console.error(`Failed to stop ConfigHotReloadModule:`, error);
      throw error;
    }
  }

  /**
   * 销毁模块
   */
  async destroy(): Promise<void> {
    console.log(`Destroying ConfigHotReloadModule...`);

    try {
      // 停止模块
      if (this.isStarted) {
        await this.stop();
      }

      // 销毁子组件
      if (this.versionManager && typeof (this.versionManager as any).destroy === 'function') {
        (this.versionManager as any).destroy();
      }

      if (this.notificationManager && typeof (this.notificationManager as any).destroy === 'function') {
        (this.notificationManager as any).destroy();
      }

      // 清理事件监听器
      this.removeAllListeners();

      this.isInitialized = false;
      this.emit('destroyed', {
        moduleId: this.id,
        timestamp: new Date()
      });

      console.log(`ConfigHotReloadModule destroyed successfully`);

    } catch (error) {
      console.error(`Failed to destroy ConfigHotReloadModule:`, error);
      throw error;
    }
  }

  /**
   * 开始配置监控
   */
  async startConfigMonitoring(configPaths: string[]): Promise<void> {
    if (this.monitoringActive) {
      await this.stopConfigMonitoring();
    }

    const watchOptions: ConfigWatchOptions = {
      paths: configPaths,
      recursive: true,
      ignorePaths: ['node_modules', '.git', 'dist', 'build'],
      debounceDelay: this.config.debounceDelay,
      fileExtensions: ['.json', '.yaml', '.yml', '.toml'],
      followSymlinks: false
    };

    await this.hotReloader.startWatching(watchOptions);
    this.monitoringActive = true;

    this.emit('watching-started', configPaths);
    console.log(`Config monitoring started for paths:`, configPaths);
  }

  /**
   * 停止配置监控
   */
  async stopConfigMonitoring(): Promise<void> {
    if (!this.monitoringActive) {
      return;
    }

    await this.hotReloader.stopWatching();
    this.monitoringActive = false;

    this.emit('watching-stopped');
    console.log(`Config monitoring stopped`);
  }

  /**
   * 手动触发配置重新加载
   */
  async triggerReload(configPath: string, options?: Partial<ConfigUpdateOptions>): Promise<ConfigUpdateResult> {
    console.log(`Manually triggering config reload for: ${configPath}`);

    const defaultOptions: Partial<ConfigUpdateOptions> = {
      createBackup: this.config.backupEnabled,
      notifyServices: true,
      validationLevel: this.config.validationLevel,
      retryCount: this.config.maxRetries
    };

    const mergedOptions = { ...defaultOptions, ...options };
    
    const result = await this.hotReloader.reloadConfig(configPath, mergedOptions);

    // 如果重载成功，创建新版本
    if (result.success && result.changesApplied.length > 0) {
      try {
        const versionInfo = await this.versionManager.createVersion(
          result.changesApplied,
          `Manual reload of ${configPath} at ${new Date().toISOString()}`
        );
        
        console.log(`Created version ${versionInfo.version} for manual reload`);
      } catch (error) {
        console.warn('Failed to create version after manual reload:', error);
      }
    }

    this.emit('config-updated', result);
    return result;
  }

  /**
   * 获取配置状态概览
   */
  async getConfigStatus(): Promise<ConfigStatusOverview> {
    try {
      const versionStats = (this.versionManager as any).getVersionStats?.() || {};
      const notificationStats = this.notificationManager.getNotificationStats();
      const updateHistory = await this.hotReloader.getUpdateHistory(10);

      // 模拟验证状态
      const lastValidation = {
        timestamp: new Date(),
        isValid: true,
        errorCount: 0,
        warningCount: 0
      };

      const status: ConfigStatusOverview = {
        currentVersion: versionStats.activeVersion || 'none',
        lastUpdate: versionStats.newestVersion?.timestamp || new Date(),
        totalVersions: versionStats.totalVersions || 0,
        watchedPaths: this.config.watchPaths,
        isWatching: this.hotReloader.isWatching(),
        pendingUpdates: 0, // TODO: 实现待处理更新统计
        lastValidation,
        recentChanges: updateHistory
      };

      return status;

    } catch (error) {
      console.error('Failed to get config status:', error);
      throw error;
    }
  }

  /**
   * 执行配置健康检查
   */
  async runConfigHealthCheck(): Promise<ConfigHealthCheckResult[]> {
    const results: ConfigHealthCheckResult[] = [];
    const timestamp = new Date();

    try {
      // 检查监听路径
      for (const path of this.config.watchPaths) {
        results.push(await this.checkConfigPath(path, timestamp));
      }

      // 检查版本管理器状态
      results.push(await this.checkVersionManager(timestamp));

      // 检查通知管理器状态
      results.push(await this.checkNotificationManager(timestamp));

      // 检查热重载器状态
      results.push(await this.checkHotReloader(timestamp));

      this.emit('health-check-completed', results);
      return results;

    } catch (error) {
      console.error('Config health check failed:', error);
      
      results.push({
        path: 'health-check',
        isHealthy: false,
        checkType: 'existence',
        message: error instanceof Error ? error.message : 'Health check failed',
        timestamp,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      return results;
    }
  }

  /**
   * 获取Web服务器实例
   */
  getWebServer(): express.Application | undefined {
    return this.webServer;
  }

  /**
   * 获取详细状态报告
   */
  getDetailedStatus(): {
    module: {
      id: string;
      name: string;
      version: string;
      enabled: boolean;
      initialized: boolean;
      started: boolean;
    };
    monitoring: {
      active: boolean;
      watchedPaths: string[];
      isWatching: boolean;
    };
    versions: any;
    notifications: any;
    config: ConfigHotReloadConfig;
  } {
    const versionStats = (this.versionManager as any).getVersionStats?.() || {};
    const notificationStats = this.notificationManager.getNotificationStats();

    return {
      module: {
        id: this.id,
        name: this.name,
        version: this.version,
        enabled: this.enabled,
        initialized: this.isInitialized,
        started: this.isStarted
      },
      monitoring: {
        active: this.monitoringActive,
        watchedPaths: this.config.watchPaths,
        isWatching: this.hotReloader.isWatching()
      },
      versions: versionStats,
      notifications: notificationStats,
      config: this.config
    };
  }

  // ============ 私有方法 ============

  /**
   * 设置事件处理
   */
  private setupEventHandling(): void {
    // 热重载器事件
    this.hotReloader.on('watching-started', (paths) => {
      this.emit('watching-started', paths);
    });

    this.hotReloader.on('watching-stopped', () => {
      this.emit('watching-stopped');
    });

    this.hotReloader.on('config-updated', (event) => {
      this.emit('config-updated', event);
    });

    this.hotReloader.on('config-validation-failed', (results) => {
      this.emit('config-validation-failed', results);
    });

    // 版本管理器事件
    this.versionManager.on('version-created', (version) => {
      this.emit('version-created', version);
    });

    // 通知管理器事件
    this.notificationManager.on('service-notification-completed', (result) => {
      this.emit('update-notification-sent', result.serviceId, result);
    });
  }

  /**
   * 设置错误处理
   */
  private setupErrorHandling(): void {
    this.on('error', (error) => {
      console.error('ConfigHotReloadModule error:', error);
    });

    // 传播子组件错误
    this.hotReloader.on('error', (error) => {
      this.emit('error', new Error(`HotReloader error: ${error.message}`));
    });

    this.versionManager.on('error', (error) => {
      this.emit('error', new Error(`VersionManager error: ${error.message}`));
    });

    this.notificationManager.on('error', (error) => {
      this.emit('error', new Error(`NotificationManager error: ${error.message}`));
    });
  }

  /**
   * 设置Web服务器
   */
  private setupWebServer(): void {
    this.webServer = express();

    // 设置中间件
    this.webServer.use(express.json());

    // 设置API路由
    this.setupApiRoutes();

    // 设置Web界面路由
    this.setupWebRoutes();
  }

  /**
   * 设置API路由
   */
  private setupApiRoutes(): void {
    if (!this.webServer) return;

    const router = express.Router();

    // 获取状态概览
    router.get('/status', async (req, res) => {
      try {
        const status = await this.getConfigStatus();
        res.json(status);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 获取详细状态
    router.get('/status/detailed', (req, res) => {
      try {
        const status = this.getDetailedStatus();
        res.json(status);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 手动触发重载
    router.post('/reload/:configPath(*)', async (req, res) => {
      try {
        const configPath = req.params.configPath;
        const options = req.body;
        
        const result = await this.triggerReload(configPath, options);
        res.json(result);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 健康检查
    router.get('/health', async (req, res) => {
      try {
        const results = await this.runConfigHealthCheck();
        const isHealthy = results.every(r => r.isHealthy);
        
        res.status(isHealthy ? 200 : 503).json({
          healthy: isHealthy,
          checks: results
        });
      } catch (error) {
        res.status(500).json({
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 版本管理
    router.get('/versions', async (req, res) => {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        const versions = await this.versionManager.getAllVersions(limit);
        res.json(versions);
      } catch (error) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    this.webServer.use('/api/config', router);
  }

  /**
   * 设置Web界面路由
   */
  private setupWebRoutes(): void {
    if (!this.webServer) return;

    // 主仪表板页面
    this.webServer.get('/', (req, res) => {
      res.send(this.generateDashboardHTML());
    });
  }

  /**
   * 生成仪表板HTML
   */
  private generateDashboardHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Config Hot Reload Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .card { background: white; border-radius: 8px; padding: 20px; margin: 10px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .status { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
        .status.active { background-color: #d4edda; color: #155724; }
        .status.inactive { background-color: #f8d7da; color: #721c24; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .metric { text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; color: #007bff; }
        .metric-label { font-size: 14px; color: #666; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; }
        .btn { background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
        .btn:hover { background: #0056b3; }
        .actions { margin-top: 20px; }
        .actions button { margin-right: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Config Hot Reload Dashboard</h1>
        
        <div class="card">
            <h2>Module Status</h2>
            <div class="metrics">
                <div class="metric">
                    <div class="metric-value">${this.isStarted ? 'Running' : 'Stopped'}</div>
                    <div class="metric-label">Module Status</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${this.hotReloader.isWatching() ? 'Active' : 'Inactive'}</div>
                    <div class="metric-label">File Watching</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${this.config.watchPaths.length}</div>
                    <div class="metric-label">Watched Paths</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${this.notificationManager.getNotificationStats().totalListeners}</div>
                    <div class="metric-label">Listeners</div>
                </div>
            </div>
            
            <div class="actions">
                <button class="btn" onclick="refreshStatus()">Refresh Status</button>
                <button class="btn" onclick="runHealthCheck()">Health Check</button>
            </div>
        </div>
        
        <div class="card">
            <h2>Configuration Paths</h2>
            <ul>
                ${this.config.watchPaths.map(path => `<li>${path}</li>`).join('')}
            </ul>
        </div>
        
        <div class="card">
            <h2>API Endpoints</h2>
            <ul>
                <li><a href="/api/config/status" target="_blank">GET /api/config/status</a> - Configuration status</li>
                <li><a href="/api/config/status/detailed" target="_blank">GET /api/config/status/detailed</a> - Detailed status</li>
                <li><a href="/api/config/health" target="_blank">GET /api/config/health</a> - Health check</li>
                <li><a href="/api/config/versions" target="_blank">GET /api/config/versions</a> - Version history</li>
            </ul>
        </div>
    </div>
    
    <script>
        function refreshStatus() {
            window.location.reload();
        }
        
        async function runHealthCheck() {
            try {
                const response = await fetch('/api/config/health');
                const result = await response.json();
                alert(result.healthy ? 'Health check passed!' : 'Health check failed!');
                console.log('Health check result:', result);
            } catch (error) {
                alert('Failed to run health check');
                console.error('Health check error:', error);
            }
        }
    </script>
</body>
</html>
    `;
  }

  /**
   * 检查配置路径
   */
  private async checkConfigPath(path: string, timestamp: Date): Promise<ConfigHealthCheckResult> {
    try {
      // TODO: 实现实际的路径检查逻辑
      return {
        path,
        isHealthy: true,
        checkType: 'existence',
        message: 'Configuration path is accessible',
        timestamp,
        details: { path }
      };
    } catch (error) {
      return {
        path,
        isHealthy: false,
        checkType: 'existence',
        message: error instanceof Error ? error.message : 'Path check failed',
        timestamp,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * 检查版本管理器状态
   */
  private async checkVersionManager(timestamp: Date): Promise<ConfigHealthCheckResult> {
    try {
      const stats = (this.versionManager as any).getVersionStats?.() || {};
      
      return {
        path: 'version-manager',
        isHealthy: true,
        checkType: 'existence',
        message: `Version manager operational with ${stats.totalVersions || 0} versions`,
        timestamp,
        details: stats
      };
    } catch (error) {
      return {
        path: 'version-manager',
        isHealthy: false,
        checkType: 'existence',
        message: error instanceof Error ? error.message : 'Version manager check failed',
        timestamp,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * 检查通知管理器状态
   */
  private async checkNotificationManager(timestamp: Date): Promise<ConfigHealthCheckResult> {
    try {
      const stats = this.notificationManager.getNotificationStats();
      
      return {
        path: 'notification-manager',
        isHealthy: true,
        checkType: 'existence',
        message: `Notification manager operational with ${stats.totalListeners} listeners`,
        timestamp,
        details: stats
      };
    } catch (error) {
      return {
        path: 'notification-manager',
        isHealthy: false,
        checkType: 'existence',
        message: error instanceof Error ? error.message : 'Notification manager check failed',
        timestamp,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * 检查热重载器状态
   */
  private async checkHotReloader(timestamp: Date): Promise<ConfigHealthCheckResult> {
    try {
      const isWatching = this.hotReloader.isWatching();
      
      return {
        path: 'hot-reloader',
        isHealthy: true,
        checkType: 'existence',
        message: `Hot reloader operational, watching: ${isWatching}`,
        timestamp,
        details: { isWatching }
      };
    } catch (error) {
      return {
        path: 'hot-reloader',
        isHealthy: false,
        checkType: 'existence',
        message: error instanceof Error ? error.message : 'Hot reloader check failed',
        timestamp,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}

// 导出所有组件
export * from './config-hot-reloader';
export * from './config-version-manager';
export * from './config-notification-manager';
export { ConfigHotReloadModule as default };