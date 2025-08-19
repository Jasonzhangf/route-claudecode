/**
 * 监控系统类型定义
 *
 * @author Jason Zhang
 */

/**
 * 指标收集器接口
 */
export interface MetricsCollector {
  recordMetric(name: string, value: number, labels?: Record<string, string>): void;
  getMetrics(): Record<string, any>;
  reset(): void;
}

/**
 * 告警管理器接口
 */
export interface AlertManager {
  addAlert(alert: Alert): void;
  getAlerts(): Alert[];
  clearAlerts(): void;
}

/**
 * 健康监控器接口
 */
export interface HealthMonitor {
  checkHealth(): Promise<HealthStatus>;
  getHealthHistory(): HealthStatus[];
}

/**
 * 监控仪表板接口
 */
export interface MonitoringDashboard {
  start(): Promise<void>;
  stop(): Promise<void>;
  getUrl(): string;
}

/**
 * 告警接口
 */
export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  timestamp: Date;
  metadata?: any;
}

/**
 * 健康状态接口
 */
export interface HealthStatus {
  healthy: boolean;
  timestamp: Date;
  details: Record<string, any>;
}

/**
 * 仪表板配置接口
 */
export interface DashboardConfig {
  port: number;
  host: string;
  enabled: boolean;
  auth?: {
    username: string;
    password: string;
  };
}
