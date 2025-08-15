/**
 * Provider监控仪表板
 * 
 * 提供Web界面展示Provider监控数据、告警信息和系统状态
 * 
 * @author Jason Zhang
 */

import { MetricsCollector, ProviderHealthStatus, SystemMetrics, AggregatedMetric } from './metrics-collector';
import { AlertManager, Alert } from './alert-manager';
import { HealthMonitor } from './health-monitor';

/**
 * 仪表板配置
 */
export interface DashboardConfig {
  /** 端口 */
  port: number;
  /** 主机地址 */
  host: string;
  /** 是否启用认证 */
  enableAuth: boolean;
  /** API密钥 */
  apiKey?: string;
  /** 刷新间隔(秒) */
  refreshInterval: number;
}

/**
 * 仪表板数据
 */
export interface DashboardData {
  /** 时间戳 */
  timestamp: number;
  /** Provider健康状态 */
  providers: ProviderHealthStatus[];
  /** 系统指标 */
  systemMetrics: SystemMetrics | null;
  /** 活跃告警 */
  activeAlerts: Alert[];
  /** 关键指标 */
  keyMetrics: {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    healthyProviders: number;
    totalProviders: number;
  };
  /** 指标图表数据 */
  charts: {
    responseTimeChart: AggregatedMetric | null;
    errorRateChart: AggregatedMetric | null;
    throughputChart: AggregatedMetric | null;
  };
}

/**
 * 监控仪表板
 */
export class MonitoringDashboard {
  private config: DashboardConfig;
  private metricsCollector: MetricsCollector;
  private alertManager: AlertManager;
  private healthMonitor: HealthMonitor;
  private server: any; // HTTP服务器实例
  private isRunning: boolean;

  constructor(
    config: DashboardConfig,
    metricsCollector: MetricsCollector,
    alertManager: AlertManager,
    healthMonitor: HealthMonitor
  ) {
    this.config = config;
    this.metricsCollector = metricsCollector;
    this.alertManager = alertManager;
    this.healthMonitor = healthMonitor;
    this.isRunning = false;
  }

  /**
   * 启动仪表板服务器
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      // 动态导入http模块
      const http = await import('http');
      const url = await import('url');

      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res, url);
      });

      await new Promise<void>((resolve, reject) => {
        this.server.listen(this.config.port, this.config.host, () => {
          this.isRunning = true;
          console.log(`[MonitoringDashboard] Started on http://${this.config.host}:${this.config.port}`);
          resolve();
        });
        
        this.server.on('error', (error: Error) => {
          reject(error);
        });
      });
    } catch (error) {
      throw new Error(`Failed to start monitoring dashboard: ${error}`);
    }
  }

  /**
   * 停止仪表板服务器
   */
  public async stop(): Promise<void> {
    if (!this.isRunning || !this.server) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.server.close(() => {
        this.isRunning = false;
        console.log('[MonitoringDashboard] Stopped');
        resolve();
      });
    });
  }

  /**
   * 获取仪表板数据
   */
  public getDashboardData(): DashboardData {
    const providers = this.healthMonitor.getAllHealthStatuses();
    const systemMetrics = this.metricsCollector.getSystemMetrics();
    const activeAlerts = this.alertManager.getActiveAlerts();

    // 计算关键指标
    const keyMetrics = this.calculateKeyMetrics(providers);

    // 获取图表数据
    const charts = this.getChartData();

    return {
      timestamp: Date.now(),
      providers,
      systemMetrics,
      activeAlerts,
      keyMetrics,
      charts
    };
  }

  /**
   * 处理HTTP请求
   */
  private handleRequest(req: any, res: any, url: any): void {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;

    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 处理预检请求
    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // 认证检查
    if (this.config.enableAuth && !this.authenticate(req)) {
      this.sendResponse(res, 401, { error: 'Unauthorized' });
      return;
    }

    try {
      switch (path) {
        case '/':
          this.handleDashboard(req, res);
          break;
        case '/api/data':
          this.handleApiData(req, res);
          break;
        case '/api/metrics':
          this.handleApiMetrics(req, res, parsedUrl.query);
          break;
        case '/api/alerts':
          this.handleApiAlerts(req, res, method);
          break;
        case '/api/health':
          this.handleApiHealth(req, res);
          break;
        default:
          this.sendResponse(res, 404, { error: 'Not Found' });
      }
    } catch (error) {
      console.error('[MonitoringDashboard] Request handling error:', error);
      this.sendResponse(res, 500, { error: 'Internal Server Error' });
    }
  }

  /**
   * 认证检查
   */
  private authenticate(req: any): boolean {
    if (!this.config.apiKey) {
      return true; // 没有设置API密钥时跳过认证
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return false;
    }

    const token = authHeader.replace('Bearer ', '');
    return token === this.config.apiKey;
  }

  /**
   * 处理仪表板请求
   */
  private handleDashboard(req: any, res: any): void {
    const html = this.generateDashboardHTML();
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  /**
   * 处理API数据请求
   */
  private handleApiData(req: any, res: any): void {
    const data = this.getDashboardData();
    this.sendResponse(res, 200, data);
  }

  /**
   * 处理API指标请求
   */
  private handleApiMetrics(req: any, res: any, query: any): void {
    const metricName = query.metric;
    const timeRange = query.range ? JSON.parse(query.range) : undefined;
    const format = query.format || 'json';

    if (metricName) {
      // 获取特定指标
      const metric = this.metricsCollector.getAggregatedMetric(metricName, timeRange);
      this.sendResponse(res, 200, metric);
    } else if (format === 'prometheus') {
      // 导出Prometheus格式
      const prometheusData = this.metricsCollector.exportMetrics('prometheus');
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(prometheusData);
    } else {
      // 导出JSON格式
      const jsonData = this.metricsCollector.exportMetrics('json');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(jsonData);
    }
  }

  /**
   * 处理API告警请求
   */
  private handleApiAlerts(req: any, res: any, method: string): void {
    switch (method) {
      case 'GET':
        const alerts = this.alertManager.getAllAlerts();
        this.sendResponse(res, 200, alerts);
        break;
      case 'POST':
        // 处理告警操作 (静默、解决等)
        this.handleAlertAction(req, res);
        break;
      default:
        this.sendResponse(res, 405, { error: 'Method Not Allowed' });
    }
  }

  /**
   * 处理API健康检查请求
   */
  private handleApiHealth(req: any, res: any): void {
    const health = {
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime(),
      version: '1.0.0'
    };
    this.sendResponse(res, 200, health);
  }

  /**
   * 处理告警操作
   */
  private handleAlertAction(req: any, res: any): void {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { action, alertId, duration } = data;

        switch (action) {
          case 'silence':
            this.alertManager.silenceAlert(alertId, duration || 3600000); // 默认1小时
            this.sendResponse(res, 200, { message: 'Alert silenced' });
            break;
          case 'resolve':
            this.alertManager.resolveAlert(alertId);
            this.sendResponse(res, 200, { message: 'Alert resolved' });
            break;
          default:
            this.sendResponse(res, 400, { error: 'Invalid action' });
        }
      } catch (error) {
        this.sendResponse(res, 400, { error: 'Invalid JSON' });
      }
    });
  }

  /**
   * 发送响应
   */
  private sendResponse(res: any, statusCode: number, data: any): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }

  /**
   * 计算关键指标
   */
  private calculateKeyMetrics(providers: ProviderHealthStatus[]): DashboardData['keyMetrics'] {
    const totalRequests = this.getMetricValue('provider_requests_total') || 0;
    const averageResponseTime = this.getMetricValue('provider_health_response_time') || 0;
    const errorRate = this.getMetricValue('provider_health_error_rate') || 0;
    const healthyProviders = providers.filter(p => p.status === 'healthy').length;
    const totalProviders = providers.length;

    return {
      totalRequests,
      averageResponseTime,
      errorRate,
      healthyProviders,
      totalProviders
    };
  }

  /**
   * 获取图表数据
   */
  private getChartData(): DashboardData['charts'] {
    const timeRange = {
      start: Date.now() - 24 * 60 * 60 * 1000, // 24小时前
      end: Date.now()
    };

    const responseTimeChart = this.metricsCollector.getAggregatedMetric('provider_request_duration_seconds', timeRange);
    const errorRateChart = this.metricsCollector.getAggregatedMetric('provider_health_error_rate', timeRange);
    const throughputChart = this.metricsCollector.getAggregatedMetric('provider_requests_total', timeRange);

    return {
      responseTimeChart,
      errorRateChart,
      throughputChart
    };
  }

  /**
   * 获取指标值
   */
  private getMetricValue(metricName: string): number | null {
    const metric = this.metricsCollector.getAggregatedMetric(metricName);
    return metric ? metric.average : null;
  }

  /**
   * 生成仪表板HTML
   */
  private generateDashboardHTML(): string {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RCC Provider Monitoring Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #f5f5f7;
            color: #333;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header h1 {
            font-size: 28px;
            margin-bottom: 5px;
        }
        .header p {
            opacity: 0.9;
        }
        .container {
            max-width: 1200px;
            margin: 20px auto;
            padding: 0 20px;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 2px 15px rgba(0,0,0,0.08);
            transition: transform 0.2s;
        }
        .metric-card:hover {
            transform: translateY(-2px);
        }
        .metric-title {
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }
        .metric-value {
            font-size: 32px;
            font-weight: bold;
            color: #333;
        }
        .status-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }
        .status-section {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 2px 15px rgba(0,0,0,0.08);
        }
        .section-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #f0f0f0;
        }
        .provider-item, .alert-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        .provider-item:last-child, .alert-item:last-child {
            border-bottom: none;
        }
        .status-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .status-healthy { background: #d4edda; color: #155724; }
        .status-degraded { background: #fff3cd; color: #856404; }
        .status-unhealthy { background: #f8d7da; color: #721c24; }
        .alert-info { background: #d1ecf1; color: #0c5460; }
        .alert-warning { background: #fff3cd; color: #856404; }
        .alert-error { background: #f8d7da; color: #721c24; }
        .alert-critical { background: #f5c6cb; color: #721c24; }
        .refresh-info {
            text-align: center;
            color: #666;
            margin-top: 20px;
            font-size: 14px;
        }
        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }
        @media (max-width: 768px) {
            .status-grid {
                grid-template-columns: 1fr;
            }
            .metrics-grid {
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎯 RCC Provider Monitoring Dashboard</h1>
        <p>实时监控Provider状态、系统指标和告警信息</p>
    </div>

    <div class="container">
        <div id="loading" class="loading">
            <p>⏳ 加载监控数据中...</p>
        </div>

        <div id="dashboard" style="display: none;">
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-title">总请求数</div>
                    <div class="metric-value" id="total-requests">0</div>
                </div>
                <div class="metric-card">
                    <div class="metric-title">平均响应时间</div>
                    <div class="metric-value" id="avg-response-time">0ms</div>
                </div>
                <div class="metric-card">
                    <div class="metric-title">错误率</div>
                    <div class="metric-value" id="error-rate">0%</div>
                </div>
                <div class="metric-card">
                    <div class="metric-title">健康Provider</div>
                    <div class="metric-value" id="healthy-providers">0/0</div>
                </div>
            </div>

            <div class="status-grid">
                <div class="status-section">
                    <div class="section-title">🏥 Provider状态</div>
                    <div id="providers-list">
                        <p class="loading">暂无Provider数据</p>
                    </div>
                </div>

                <div class="status-section">
                    <div class="section-title">🚨 活跃告警</div>
                    <div id="alerts-list">
                        <p class="loading">暂无活跃告警</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="refresh-info">
            <p>⏰ 数据每 ${this.config.refreshInterval} 秒自动刷新 | 最后更新: <span id="last-update">未知</span></p>
        </div>
    </div>

    <script>
        let refreshInterval;
        
        async function fetchDashboardData() {
            try {
                const response = await fetch('/api/data');
                const data = await response.json();
                updateDashboard(data);
            } catch (error) {
                console.error('Failed to fetch dashboard data:', error);
            }
        }
        
        function updateDashboard(data) {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('dashboard').style.display = 'block';
            
            // 更新关键指标
            document.getElementById('total-requests').textContent = data.keyMetrics.totalRequests.toLocaleString();
            document.getElementById('avg-response-time').textContent = Math.round(data.keyMetrics.averageResponseTime) + 'ms';
            document.getElementById('error-rate').textContent = (data.keyMetrics.errorRate * 100).toFixed(1) + '%';
            document.getElementById('healthy-providers').textContent = \`\${data.keyMetrics.healthyProviders}/\${data.keyMetrics.totalProviders}\`;
            
            // 更新Provider状态
            updateProvidersList(data.providers);
            
            // 更新告警列表
            updateAlertsList(data.activeAlerts);
            
            // 更新时间
            document.getElementById('last-update').textContent = new Date(data.timestamp).toLocaleTimeString();
        }
        
        function updateProvidersList(providers) {
            const container = document.getElementById('providers-list');
            if (providers.length === 0) {
                container.innerHTML = '<p class="loading">暂无Provider数据</p>';
                return;
            }
            
            const html = providers.map(provider => \`
                <div class="provider-item">
                    <div>
                        <strong>\${provider.providerId}</strong><br>
                        <small>响应时间: \${Math.round(provider.responseTime)}ms | 可用性: \${(provider.availability * 100).toFixed(1)}%</small>
                    </div>
                    <span class="status-badge status-\${provider.status}">\${provider.status}</span>
                </div>
            \`).join('');
            
            container.innerHTML = html;
        }
        
        function updateAlertsList(alerts) {
            const container = document.getElementById('alerts-list');
            if (alerts.length === 0) {
                container.innerHTML = '<p class="loading">🎉 无活跃告警</p>';
                return;
            }
            
            const html = alerts.map(alert => \`
                <div class="alert-item">
                    <div>
                        <strong>\${alert.title}</strong><br>
                        <small>\${alert.description}</small>
                    </div>
                    <span class="status-badge alert-\${alert.level}">\${alert.level}</span>
                </div>
            \`).join('');
            
            container.innerHTML = html;
        }
        
        // 初始加载
        fetchDashboardData();
        
        // 设置自动刷新
        refreshInterval = setInterval(fetchDashboardData, ${this.config.refreshInterval * 1000});
        
        // 页面隐藏时停止刷新，显示时恢复
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                if (refreshInterval) {
                    clearInterval(refreshInterval);
                    refreshInterval = null;
                }
            } else {
                if (!refreshInterval) {
                    refreshInterval = setInterval(fetchDashboardData, ${this.config.refreshInterval * 1000});
                    fetchDashboardData(); // 立即刷新一次
                }
            }
        });
    </script>
</body>
</html>
    `;
  }
}