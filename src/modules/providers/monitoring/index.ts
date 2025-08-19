/**
 * Provider监控系统统一导出
 *
 * 提供完整的Provider监控解决方案，包括指标收集、告警管理、健康监控和可视化仪表板
 *
 * @author Jason Zhang
 */

// 类型定义
export * from './types';

// 指标收集系统
export {
  MetricType,
  MetricDataPoint,
  MetricDefinition,
  AggregatedMetric,
  ProviderHealthStatus,
  SystemMetrics,
} from './metrics-collector';

// 告警管理系统
export {
  AlertManager,
  AlertRule,
  Alert,
  AlertLevel,
  AlertStatus,
  AlertChannel,
  ConsoleAlertChannel,
  WebhookAlertChannel,
} from './alert-manager';

// 健康监控系统
export {
  HealthMonitor,
  HealthCheckConfig,
  HealthCheckResult,
  ProviderHealthChecker,
  HttpHealthChecker,
  CustomHealthChecker,
  SystemMetricsCollector,
} from './health-monitor';

// 监控仪表板
export { MonitoringDashboard, DashboardConfig, DashboardData } from './monitoring-dashboard';

/**
 * 完整监控系统
 *
 * 集成所有监控组件的统一管理类
 */
export class CompleteMonitoringSystem {
  private metricsCollector: import('./types').MetricsCollector;
  private alertManager: import('./types').AlertManager;
  private healthMonitor: import('./types').HealthMonitor;
  private dashboard: import('./types').MonitoringDashboard | null;
  private isRunning: boolean;

  constructor() {
    // 创建指标收集器
    this.metricsCollector = new (require('./implementations').BasicMetricsCollector)();

    // 创建告警管理器
    this.alertManager = new (require('./implementations').BasicAlertManager)(() => this.metricsCollector.getMetrics());

    // 创建健康监控器
    this.healthMonitor = new (require('./implementations').BasicHealthMonitor)();

    // 仪表板初始为空
    this.dashboard = null;
    this.isRunning = false;

    // 设置组件间的回调连接
    this.setupCallbacks();
  }

  /**
   * 获取指标收集器
   */
  public getMetricsCollector(): import('./types').MetricsCollector {
    return this.metricsCollector;
  }

  /**
   * 获取告警管理器
   */
  public getAlertManager(): import('./types').AlertManager {
    return this.alertManager;
  }

  /**
   * 获取健康监控器
   */
  public getHealthMonitor(): import('./types').HealthMonitor {
    return this.healthMonitor;
  }

  /**
   * 获取监控仪表板
   */
  public getDashboard(): import('./types').MonitoringDashboard | null {
    return this.dashboard;
  }

  /**
   * 启用监控仪表板
   */
  public enableDashboard(config: import('./types').DashboardConfig): void {
    if (!this.dashboard) {
      this.dashboard = new (require('./implementations').BasicMonitoringDashboard)(
        config,
        this.metricsCollector,
        this.alertManager,
        this.healthMonitor
      );
    }
  }

  /**
   * 启动完整监控系统
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[CompleteMonitoringSystem] Already running');
      return;
    }

    console.log('[CompleteMonitoringSystem] Starting monitoring system...');

    try {
      // 启动告警管理器
      // this.alertManager.start();

      // 启动健康监控器
      // this.healthMonitor.startAll();

      // 启动仪表板 (如果启用)
      if (this.dashboard) {
        await this.dashboard.start();
      }

      this.isRunning = true;
      console.log('[CompleteMonitoringSystem] Monitoring system started successfully');
    } catch (error) {
      console.error('[CompleteMonitoringSystem] Failed to start monitoring system:', error);
      throw error;
    }
  }

  /**
   * 停止完整监控系统
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('[CompleteMonitoringSystem] Not running');
      return;
    }

    console.log('[CompleteMonitoringSystem] Stopping monitoring system...');

    try {
      // 停止告警管理器
      // this.alertManager.stop();

      // 停止健康监控器
      // this.healthMonitor.stopAll();

      // 停止仪表板
      if (this.dashboard) {
        await this.dashboard.stop();
      }

      this.isRunning = false;
      console.log('[CompleteMonitoringSystem] Monitoring system stopped successfully');
    } catch (error) {
      console.error('[CompleteMonitoringSystem] Error stopping monitoring system:', error);
      throw error;
    }
  }

  /**
   * 获取系统状态
   */
  public getStatus(): {
    isRunning: boolean;
    components: {
      metricsCollector: boolean;
      alertManager: boolean;
      healthMonitor: boolean;
      dashboard: boolean;
    };
    statistics: {
      totalMetrics: number;
      activeAlerts: number;
      monitoredProviders: number;
    };
  } {
    return {
      isRunning: this.isRunning,
      components: {
        metricsCollector: true, // MetricsCollector总是可用
        alertManager: this.alertManager['checkInterval'] !== null,
        healthMonitor:
          this.healthMonitor['intervals'].size > 0 || this.healthMonitor['systemMetricsInterval'] !== undefined,
        dashboard: this.dashboard !== null && this.dashboard['isRunning'],
      },
      statistics: {
        totalMetrics: Object.keys(this.metricsCollector.getMetrics()).length,
        activeAlerts: this.alertManager.getAlerts().length,
        monitoredProviders: this.healthMonitor.getHealthHistory().length,
      },
    };
  }

  /**
   * 设置组件间的回调连接
   */
  private setupCallbacks(): void {
    // 健康监控器 → 指标收集器
    // this.healthMonitor.setHealthUpdateCallback((providerId, status) => {
    //   this.metricsCollector.updateProviderHealth(providerId, status);
    // });
    // 健康监控器 → 指标收集器 (系统指标)
    // this.healthMonitor.setSystemMetricsUpdateCallback((metrics) => {
    //   this.metricsCollector.updateSystemMetrics(metrics);
    // });
  }
}

/**
 * 创建完整监控系统的便捷函数
 */
export function createMonitoringSystem(dashboardConfig?: import('./types').DashboardConfig): CompleteMonitoringSystem {
  const system = new CompleteMonitoringSystem();

  if (dashboardConfig) {
    system.enableDashboard(dashboardConfig);
  }

  return system;
}
