/**
 * RCC v4.0 健康监控系统
 * 
 * 处理系统健康检查、自动恢复和服务依赖监控
 * 
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import express = require('express');
import * as http from 'http';
import {
  IHealthMonitor,
  IHealthChecker,
  IAutoRecoverySystem,
  IDependencyMonitor,
  HealthMonitorConfig,
  ServiceDependency,
  SystemHealthOverview,
  HealthMonitoringStats,
  HealthCheckResult,
  RecoveryResult,
  HealthStatus,
  HealthMonitorEvents
} from '../interfaces/core/health-interface';
import { IModule, ModuleConfig } from '../interfaces/core/module-interface';
import { HealthChecker } from './health-checker';
import { AutoRecoverySystem } from './auto-recovery-system';
import { DependencyMonitor } from './dependency-monitor';

export const HEALTH_MODULE_VERSION = '4.0.0-alpha.1';

/**
 * 默认健康监控配置
 */
const DEFAULT_HEALTH_CONFIG: HealthMonitorConfig = {
  id: 'health-monitor',
  name: 'health-monitor',
  type: 'server' as any, // 临时解决方案
  version: HEALTH_MODULE_VERSION,
  enabled: true,
  globalCheckInterval: 30000, // 30秒
  enableAutoRecovery: true,
  maxConcurrentChecks: 10,
  healthCheckTimeout: 10000, // 10秒
  retryAttempts: 3,
  enableNotifications: true,
  persistHealthHistory: true,
  historyRetentionDays: 30,
  dashboardPort: 8080
};

/**
 * 监控会话
 */
interface MonitoringSession {
  readonly id: string;
  readonly services: ServiceDependency[];
  readonly startTime: Date;
  isActive: boolean;
  checkIntervals: Map<string, NodeJS.Timeout>;
}

/**
 * 健康监控主模块实现
 */
export class HealthMonitor extends EventEmitter implements IHealthMonitor, IModule {
  public readonly config: HealthMonitorConfig;
  public readonly checker: IHealthChecker;
  public readonly autoRecovery: IAutoRecoverySystem;
  public readonly dependencyMonitor: IDependencyMonitor;
  public readonly status: any;

  private isInitialized: boolean = false;
  private currentSession?: MonitoringSession;
  private dashboardServer?: http.Server;
  private systemStartTime: Date = new Date();
  private healthHistory: HealthCheckResult[] = [];
  private maxHistorySize: number = 10000;

  constructor(config?: Partial<HealthMonitorConfig>) {
    super();
    
    this.config = {
      ...DEFAULT_HEALTH_CONFIG,
      ...config
    };

    // 初始化组件
    this.checker = new HealthChecker();
    this.autoRecovery = new AutoRecoverySystem();
    this.dependencyMonitor = new DependencyMonitor(this.checker);
    
    // 初始化status
    this.status = {
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
   * 初始化健康监控模块
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // 初始化依赖监控
      await this.dependencyMonitor.startMonitoring();

      // 启动仪表板服务器
      if (this.config.dashboardPort) {
        await this.startDashboardServer();
      }

      this.isInitialized = true;
      this.status.status = 'initialized';
      this.emit('initialized');
      
      console.log(`💚 Health Monitor v${this.config.version} initialized`);
    } catch (error) {
      this.status.status = 'error';
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 启动健康监控模块
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.status.status = 'running';
    this.emit('started');
    console.log(`💚 Health Monitor started`);
  }

  /**
   * 停止健康监控模块
   */
  async stop(): Promise<void> {
    // 停止监控
    await this.stopMonitoring();

    // 停止依赖监控
    await this.dependencyMonitor.stopMonitoring();

    // 停止仪表板服务器
    if (this.dashboardServer) {
      this.dashboardServer.close();
      this.dashboardServer = undefined;
    }

    this.isInitialized = false;
    this.status.status = 'stopped';
    this.emit('stopped');
    console.log(`💚 Health Monitor stopped`);
  }

  /**
   * 获取模块状态
   */
  getStatus(): any {
    return {
      ...this.status,
      initialized: this.isInitialized,
      enabled: this.config.enabled,
      monitoring: this.currentSession?.isActive || false,
      servicesCount: this.currentSession?.services.length || 0,
      uptime: Date.now() - this.systemStartTime.getTime()
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
      uptime: Date.now() - this.systemStartTime.getTime(),
      monitoring: this.currentSession?.isActive || false,
      memoryUsage: process.memoryUsage(),
      components: {
        checker: 'healthy',
        autoRecovery: 'healthy',
        dependencyMonitor: 'healthy'
      }
    };
  }

  /**
   * 获取指标
   */
  getMetrics(): any {
    const recoveryStats = this.autoRecovery.getRecoveryStats();
    const dependencyStats = this.dependencyMonitor.getMonitoringStats();
    
    return {
      monitoring: this.currentSession?.isActive || false,
      servicesCount: this.currentSession?.services.length || 0,
      healthChecks: {
        total: this.healthHistory.length,
        healthy: this.healthHistory.filter(h => h.status === HealthStatus.HEALTHY).length,
        degraded: this.healthHistory.filter(h => h.status === HealthStatus.DEGRADED).length,
        unhealthy: this.healthHistory.filter(h => h.status === HealthStatus.UNHEALTHY).length
      },
      recovery: recoveryStats,
      dependencies: dependencyStats
    };
  }

  /**
   * 更新配置
   */
  async updateConfig(config: Partial<HealthMonitorConfig>): Promise<void> {
    Object.assign(this.config, config);
    this.emit('config-updated', this.config);
  }

  /**
   * 开始监控服务
   */
  async startMonitoring(services: ServiceDependency[]): Promise<void> {
    // 停止当前监控会话
    if (this.currentSession) {
      await this.stopMonitoring();
    }

    // 注册所有服务依赖
    for (const service of services) {
      await this.dependencyMonitor.registerDependency(service);
    }

    // 创建新的监控会话
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentSession = {
      id: sessionId,
      services,
      startTime: new Date(),
      isActive: true,
      checkIntervals: new Map()
    };

    // 启动全局健康检查
    this.startGlobalHealthChecks(services);

    this.emit('monitoring-started', services);
    console.log(`💚 Health monitoring started for ${services.length} services`);
  }

  /**
   * 停止监控服务
   */
  async stopMonitoring(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    // 停止所有检查定时器
    this.currentSession.checkIntervals.forEach(interval => {
      clearInterval(interval);
    });

    this.currentSession.isActive = false;
    this.currentSession = undefined;

    this.emit('monitoring-stopped');
    console.log(`💚 Health monitoring stopped`);
  }

  /**
   * 获取系统健康概览
   */
  async getSystemOverview(): Promise<SystemHealthOverview> {
    const services = this.currentSession?.services || [];
    const allStatus = await this.dependencyMonitor.getAllDependencyStatus();
    
    let healthyServices = 0;
    let degradedServices = 0;
    let unhealthyServices = 0;
    let criticalIssues = 0;

    Object.values(allStatus).forEach(result => {
      switch (result.status) {
        case HealthStatus.HEALTHY:
          healthyServices++;
          break;
        case HealthStatus.DEGRADED:
          degradedServices++;
          break;
        case HealthStatus.UNHEALTHY:
          unhealthyServices++;
          if (services.find(s => s.id === result.serviceId)?.critical) {
            criticalIssues++;
          }
          break;
      }
    });

    // 确定总体状态
    let overallStatus = HealthStatus.HEALTHY;
    if (criticalIssues > 0 || unhealthyServices > services.length * 0.5) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else if (degradedServices > 0 || unhealthyServices > 0) {
      overallStatus = HealthStatus.DEGRADED;
    }

    const activeRecoveries = await this.autoRecovery.getActiveRecoveries();

    return {
      overallStatus,
      timestamp: new Date(),
      totalServices: services.length,
      healthyServices,
      degradedServices,
      unhealthyServices,
      criticalIssues,
      activeRecoveries: activeRecoveries.length,
      uptime: Date.now() - this.systemStartTime.getTime(),
      services: allStatus
    };
  }

  /**
   * 获取监控统计信息
   */
  async getMonitoringStats(period: { start: Date; end: Date }): Promise<HealthMonitoringStats> {
    const relevantHistory = this.healthHistory.filter(h => 
      h.checkTime >= period.start && h.checkTime <= period.end
    );

    const totalChecks = relevantHistory.length;
    const successfulChecks = relevantHistory.filter(h => h.status === HealthStatus.HEALTHY).length;
    const failedChecks = totalChecks - successfulChecks;

    const averageResponseTime = totalChecks > 0 
      ? relevantHistory.reduce((sum, h) => sum + h.responseTime, 0) / totalChecks
      : 0;

    const availabilityPercentage = totalChecks > 0 
      ? (successfulChecks / totalChecks) * 100
      : 100;

    const recoveryStats = this.autoRecovery.getRecoveryStats();

    // 生成趋势数据
    const trends = this.generateTrends(relevantHistory, period);

    return {
      period: {
        start: period.start,
        end: period.end,
        duration: period.end.getTime() - period.start.getTime()
      },
      totalChecks,
      successfulChecks,
      failedChecks,
      averageResponseTime,
      availabilityPercentage,
      recoveryAttempts: recoveryStats.totalRecoveries,
      successfulRecoveries: recoveryStats.successfulRecoveries,
      trends
    };
  }

  /**
   * 触发手动健康检查
   */
  async triggerHealthCheck(serviceId?: string): Promise<HealthCheckResult[]> {
    const services = this.currentSession?.services || [];
    const results: HealthCheckResult[] = [];

    if (serviceId) {
      // 检查特定服务
      const service = services.find(s => s.id === serviceId);
      if (service) {
        for (const healthCheck of service.healthChecks) {
          const result = await this.checker.performCheck(healthCheck);
          results.push(result);
          this.addToHealthHistory(result);
        }
      }
    } else {
      // 检查所有服务
      for (const service of services) {
        for (const healthCheck of service.healthChecks) {
          const result = await this.checker.performCheck(healthCheck);
          results.push(result);
          this.addToHealthHistory(result);
        }
      }
    }

    return results;
  }

  /**
   * 触发手动恢复
   */
  async triggerRecovery(serviceId: string, strategyId?: string): Promise<RecoveryResult> {
    const services = this.currentSession?.services || [];
    const service = services.find(s => s.id === serviceId);
    
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    // 找到恢复策略
    let strategy = service.recoveryStrategies[0]; // 默认使用第一个策略
    if (strategyId) {
      const foundStrategy = service.recoveryStrategies.find(s => s.id === strategyId);
      if (foundStrategy) {
        strategy = foundStrategy;
      }
    }

    if (!strategy) {
      throw new Error(`No recovery strategy found for service ${serviceId}`);
    }

    return await this.autoRecovery.executeRecovery(serviceId, strategy);
  }

  /**
   * 获取健康状态API端点
   */
  getHealthApiEndpoint(): string {
    const port = this.config.dashboardPort || 8080;
    return `http://localhost:${port}/api/health`;
  }

  /**
   * 启动全局健康检查
   */
  private startGlobalHealthChecks(services: ServiceDependency[]): void {
    if (!this.currentSession) {
      return;
    }

    for (const service of services) {
      for (const healthCheck of service.healthChecks) {
        const intervalId = setInterval(async () => {
          try {
            const result = await this.checker.performCheck(healthCheck);
            this.addToHealthHistory(result);
            
            // 检查是否需要触发恢复
            for (const strategy of service.recoveryStrategies) {
              if (this.autoRecovery.shouldTriggerRecovery(service.id, result, strategy)) {
                await this.autoRecovery.executeRecovery(service.id, strategy);
                break; // 只执行第一个匹配的策略
              }
            }
          } catch (error) {
            this.emit('error', error);
          }
        }, this.config.globalCheckInterval);

        this.currentSession.checkIntervals.set(`${service.id}_${healthCheck.id}`, intervalId);
      }
    }
  }

  /**
   * 启动仪表板服务器
   */
  private async startDashboardServer(): Promise<void> {
    const app = express();
    
    // API路由
    app.get('/api/health', async (req, res) => {
      try {
        const overview = await this.getSystemOverview();
        res.json(overview);
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    app.get('/api/health/stats', async (req, res) => {
      try {
        const end = new Date();
        const start = new Date(end.getTime() - 24 * 60 * 60 * 1000); // 过去24小时
        const stats = await this.getMonitoringStats({ start, end });
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    app.get('/api/health/services/:serviceId', async (req, res) => {
      try {
        const results = await this.triggerHealthCheck(req.params.serviceId);
        res.json(results);
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // 简单的HTML仪表板
    app.get('/', (req, res) => {
      res.send(this.generateDashboardHTML());
    });

    this.dashboardServer = app.listen(this.config.dashboardPort, () => {
      console.log(`💚 Health Monitor dashboard started on port ${this.config.dashboardPort}`);
    });
  }

  /**
   * 生成仪表板HTML
   */
  private generateDashboardHTML(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>RCC Health Monitor Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .status-healthy { color: green; }
        .status-degraded { color: orange; }
        .status-unhealthy { color: red; }
        .card { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>RCC Health Monitor Dashboard</h1>
    <div id="overview" class="card">
        <h2>System Overview</h2>
        <p>Loading...</p>
    </div>
    <div id="services" class="card">
        <h2>Service Status</h2>
        <p>Loading...</p>
    </div>
    
    <script>
        async function loadData() {
            try {
                const response = await fetch('/api/health');
                const data = await response.json();
                
                const overviewDiv = document.getElementById('overview');
                overviewDiv.innerHTML = \`
                    <h2>System Overview</h2>
                    <p><strong>Overall Status:</strong> <span class="status-\${data.overallStatus}">\${data.overallStatus}</span></p>
                    <p><strong>Total Services:</strong> \${data.totalServices}</p>
                    <p><strong>Healthy:</strong> \${data.healthyServices}</p>
                    <p><strong>Degraded:</strong> \${data.degradedServices}</p>
                    <p><strong>Unhealthy:</strong> \${data.unhealthyServices}</p>
                    <p><strong>Critical Issues:</strong> \${data.criticalIssues}</p>
                    <p><strong>Active Recoveries:</strong> \${data.activeRecoveries}</p>
                    <p><strong>Uptime:</strong> \${Math.floor(data.uptime / 1000)}s</p>
                \`;
                
                const servicesDiv = document.getElementById('services');
                let servicesHTML = '<h2>Service Status</h2>';
                Object.entries(data.services).forEach(([serviceId, result]) => {
                    servicesHTML += \`
                        <div>
                            <strong>\${result.serviceName} (\${serviceId}):</strong> 
                            <span class="status-\${result.status}">\${result.status}</span>
                            - Response: \${result.responseTime}ms
                            - Error Rate: \${result.errorRate}%
                        </div>
                    \`;
                });
                servicesDiv.innerHTML = servicesHTML;
                
            } catch (error) {
                console.error('Failed to load data:', error);
            }
        }
        
        // 加载初始数据
        loadData();
        
        // 每30秒刷新一次
        setInterval(loadData, 30000);
    </script>
</body>
</html>
    `;
  }

  /**
   * 添加到健康历史记录
   */
  private addToHealthHistory(result: HealthCheckResult): void {
    this.healthHistory.push(result);
    
    // 限制历史记录大小
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory = this.healthHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * 生成趋势数据
   */
  private generateTrends(history: HealthCheckResult[], period: { start: Date; end: Date }): Array<{
    timestamp: Date;
    status: HealthStatus;
    responseTime: number;
    errorRate: number;
  }> {
    const trends: Array<{
      timestamp: Date;
      status: HealthStatus;
      responseTime: number;
      errorRate: number;
    }> = [];

    // 按小时分组数据
    const hourlyData = new Map<string, HealthCheckResult[]>();
    
    history.forEach(result => {
      const hour = new Date(result.checkTime);
      hour.setMinutes(0, 0, 0);
      const key = hour.toISOString();
      
      if (!hourlyData.has(key)) {
        hourlyData.set(key, []);
      }
      hourlyData.get(key)!.push(result);
    });

    // 为每小时计算平均值
    hourlyData.forEach((results, hourKey) => {
      if (results.length === 0) return;
      
      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      const avgErrorRate = results.reduce((sum, r) => sum + r.errorRate, 0) / results.length;
      
      // 确定该小时的主要状态
      const statusCounts = {
        [HealthStatus.HEALTHY]: results.filter(r => r.status === HealthStatus.HEALTHY).length,
        [HealthStatus.DEGRADED]: results.filter(r => r.status === HealthStatus.DEGRADED).length,
        [HealthStatus.UNHEALTHY]: results.filter(r => r.status === HealthStatus.UNHEALTHY).length,
        [HealthStatus.UNKNOWN]: results.filter(r => r.status === HealthStatus.UNKNOWN).length
      };
      
      const dominantStatus = Object.entries(statusCounts).reduce((a, b) => 
        statusCounts[a[0] as HealthStatus] > statusCounts[b[0] as HealthStatus] ? a : b
      )[0] as HealthStatus;

      trends.push({
        timestamp: new Date(hourKey),
        status: dominantStatus,
        responseTime: avgResponseTime,
        errorRate: avgErrorRate
      });
    });

    return trends.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 转发健康检查器事件（使用类型断言处理EventEmitter）
    (this.checker as any).on?.('check-completed', (result: HealthCheckResult) => {
      this.emit('health-check-completed', result);
    });

    (this.checker as any).on?.('check-failed', (result: HealthCheckResult) => {
      this.emit('health-check-completed', result);
    });

    // 转发自动恢复系统事件
    (this.autoRecovery as any).on?.('recovery-started', (serviceId: string, strategy: any) => {
      this.emit('recovery-started', serviceId, strategy);
    });

    (this.autoRecovery as any).on?.('recovery-completed', (result: RecoveryResult) => {
      this.emit('recovery-completed', result);
    });

    // 转发依赖监控器事件
    (this.dependencyMonitor as any).on?.('dependency-check-completed', (serviceId: string, result: HealthCheckResult) => {
      this.emit('health-check-completed', result);
    });

    (this.dependencyMonitor as any).on?.('critical-dependency-unhealthy', (dependency: ServiceDependency, result: HealthCheckResult) => {
      this.emit('dependency-failure', dependency, result);
    });

    // 系统级事件处理
    this.on('health-check-completed', async (result: HealthCheckResult) => {
      // 检查状态变化
      const previousResults = this.healthHistory.filter(h => h.serviceId === result.serviceId);
      if (previousResults.length > 0) {
        const previousResult = previousResults[previousResults.length - 1];
        if (previousResult && previousResult.status !== result.status) {
          this.emit('health-status-changed', result.serviceId, previousResult.status, result.status);
        }
      }

      // 检查系统级状态
      const overview = await this.getSystemOverview();
      if (overview.overallStatus === HealthStatus.DEGRADED) {
        this.emit('system-degraded', overview);
      } else if (overview.overallStatus === HealthStatus.UNHEALTHY) {
        this.emit('system-unhealthy', overview);
      }
    });
  }
}

// 导出所有组件和接口
export * from './health-checker';
export * from './auto-recovery-system';
export * from './dependency-monitor';
export * from '../interfaces/core/health-interface';