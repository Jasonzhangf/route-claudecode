/**
 * 监控系统实现类
 *
 * @author Jason Zhang
 */

import {
  MetricsCollector,
  AlertManager,
  HealthMonitor,
  MonitoringDashboard,
  DashboardConfig,
  Alert,
  HealthStatus,
} from './types';

/**
 * 基础指标收集器实现
 */
export class BasicMetricsCollector implements MetricsCollector {
  private metrics: Record<string, any> = {};

  recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    this.metrics[name] = { value, labels, timestamp: new Date() };
  }

  getMetrics(): Record<string, any> {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {};
  }
}

/**
 * 基础告警管理器实现
 */
export class BasicAlertManager implements AlertManager {
  private alerts: Alert[] = [];

  constructor(private metricsProvider: () => Record<string, any>) {}

  addAlert(alert: Alert): void {
    this.alerts.push(alert);
  }

  getAlerts(): Alert[] {
    return [...this.alerts];
  }

  clearAlerts(): void {
    this.alerts = [];
  }
}

/**
 * 基础健康监控器实现
 */
export class BasicHealthMonitor implements HealthMonitor {
  private healthHistory: HealthStatus[] = [];

  async checkHealth(): Promise<HealthStatus> {
    const status: HealthStatus = {
      healthy: true,
      timestamp: new Date(),
      details: { status: 'ok' },
    };

    this.healthHistory.push(status);
    if (this.healthHistory.length > 100) {
      this.healthHistory = this.healthHistory.slice(-100);
    }

    return status;
  }

  getHealthHistory(): HealthStatus[] {
    return [...this.healthHistory];
  }
}

/**
 * 基础监控仪表板实现
 */
export class BasicMonitoringDashboard implements MonitoringDashboard {
  private isRunning = false;

  constructor(
    private metricsCollector: MetricsCollector,
    private alertManager: AlertManager,
    private healthMonitor: HealthMonitor,
    private config: DashboardConfig
  ) {}

  async start(): Promise<void> {
    this.isRunning = true;
  }

  async stop(): Promise<void> {
    this.isRunning = false;
  }

  getUrl(): string {
    return `http://${this.config.host}:${this.config.port}`;
  }
}
