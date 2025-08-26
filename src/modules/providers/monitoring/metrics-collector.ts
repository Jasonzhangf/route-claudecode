/**
 * Provider指标收集器
 *
 * 收集和聚合Provider性能指标，支持实时监控和历史数据分析
 *
 * @author Jason Zhang
 */

import { JQJsonHandler } from '../../../utils/jq-json-handler';

/**
 * 指标类型枚举
 */
export type MetricType =
  | 'counter' // 计数器
  | 'gauge' // 瞬时值
  | 'histogram' // 直方图
  | 'summary'; // 摘要

/**
 * 指标数据点
 */
export interface MetricDataPoint {
  /** 时间戳 */
  timestamp: number;
  /** 指标值 */
  value: number;
  /** 标签 */
  labels: Record<string, string>;
}

/**
 * 指标定义
 */
export interface MetricDefinition {
  /** 指标名称 */
  name: string;
  /** 指标类型 */
  type: MetricType;
  /** 指标描述 */
  description: string;
  /** 指标单位 */
  unit?: string;
  /** 标签键名 */
  labelNames: string[];
}

/**
 * 聚合指标
 */
export interface AggregatedMetric {
  /** 指标名称 */
  name: string;
  /** 总计 */
  total: number;
  /** 平均值 */
  average: number;
  /** 最小值 */
  min: number;
  /** 最大值 */
  max: number;
  /** 计数 */
  count: number;
  /** 分位数 */
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  /** 时间范围 */
  timeRange: {
    start: number;
    end: number;
  };
}

/**
 * Provider健康状态
 */
export interface ProviderHealthStatus {
  /** Provider ID */
  providerId: string;
  /** 健康状态 */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** 上次检查时间 */
  lastCheckTime: number;
  /** 响应时间 */
  responseTime: number;
  /** 错误率 */
  errorRate: number;
  /** 可用性 */
  availability: number;
  /** 详细信息 */
  details: Record<string, any>;
}

/**
 * 系统指标
 */
export interface SystemMetrics {
  /** CPU使用率 */
  cpuUsage: number;
  /** 内存使用率 */
  memoryUsage: number;
  /** 磁盘使用率 */
  diskUsage: number;
  /** 网络流量 */
  networkTraffic: {
    bytesIn: number;
    bytesOut: number;
  };
  /** 活跃连接数 */
  activeConnections: number;
}

/**
 * 指标收集器
 */
export class MetricsCollector {
  private metrics: Map<string, MetricDataPoint[]>;
  private definitions: Map<string, MetricDefinition>;
  private maxDataPoints: number;
  private retentionPeriod: number;
  private healthStatuses: Map<string, ProviderHealthStatus>;
  private systemMetrics: SystemMetrics | null;

  constructor(maxDataPoints: number = 10000, retentionPeriod: number = 24 * 60 * 60 * 1000) {
    this.metrics = new Map();
    this.definitions = new Map();
    this.healthStatuses = new Map();
    this.maxDataPoints = maxDataPoints;
    this.retentionPeriod = retentionPeriod;
    this.systemMetrics = null;

    // 注册默认指标
    this.registerDefaultMetrics();

    // 启动清理任务
    this.startCleanupTask();
  }

  /**
   * 注册指标定义
   */
  public registerMetric(definition: MetricDefinition): void {
    this.definitions.set(definition.name, definition);

    if (!this.metrics.has(definition.name)) {
      this.metrics.set(definition.name, []);
    }
  }

  /**
   * 记录指标数据点
   */
  public recordMetric(metricName: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.definitions.has(metricName)) {
      console.warn(`[MetricsCollector] Unknown metric: ${metricName}`);
      return;
    }

    const dataPoint: MetricDataPoint = {
      timestamp: Date.now(),
      value,
      labels,
    };

    const dataPoints = this.metrics.get(metricName)!;
    dataPoints.push(dataPoint);

    // 限制数据点数量
    if (dataPoints.length > this.maxDataPoints) {
      dataPoints.splice(0, dataPoints.length - this.maxDataPoints);
    }
  }

  /**
   * 增加计数器
   */
  public incrementCounter(metricName: string, labels: Record<string, string> = {}): void {
    const current = this.getLatestValue(metricName, labels) || 0;
    this.recordMetric(metricName, current + 1, labels);
  }

  /**
   * 设置仪表值
   */
  public setGauge(metricName: string, value: number, labels: Record<string, string> = {}): void {
    this.recordMetric(metricName, value, labels);
  }

  /**
   * 记录直方图数据
   */
  public recordHistogram(metricName: string, value: number, labels: Record<string, string> = {}): void {
    this.recordMetric(metricName, value, labels);
  }

  /**
   * 获取聚合指标
   */
  public getAggregatedMetric(metricName: string, timeRange?: { start: number; end: number }): AggregatedMetric | null {
    const dataPoints = this.metrics.get(metricName);
    if (!dataPoints || dataPoints.length === 0) {
      return null;
    }

    // 过滤时间范围
    let filteredPoints = dataPoints;
    if (timeRange) {
      filteredPoints = dataPoints.filter(
        point => point.timestamp >= timeRange.start && point.timestamp <= timeRange.end
      );
    }

    if (filteredPoints.length === 0) {
      return null;
    }

    // 计算聚合值
    const values = filteredPoints.map(point => point.value);
    const total = values.reduce((sum, val) => sum + val, 0);
    const average = total / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // 计算分位数
    const sortedValues = [...values].sort((a, b) => a - b);
    const percentiles = {
      p50: this.calculatePercentile(sortedValues, 0.5),
      p90: this.calculatePercentile(sortedValues, 0.9),
      p95: this.calculatePercentile(sortedValues, 0.95),
      p99: this.calculatePercentile(sortedValues, 0.99),
    };

    return {
      name: metricName,
      total,
      average,
      min,
      max,
      count: filteredPoints.length,
      percentiles,
      timeRange: timeRange || {
        start: Math.min(...filteredPoints.map(p => p.timestamp)),
        end: Math.max(...filteredPoints.map(p => p.timestamp)),
      },
    };
  }

  /**
   * 更新Provider健康状态
   */
  public updateProviderHealth(providerId: string, healthStatus: Omit<ProviderHealthStatus, 'providerId'>): void {
    this.healthStatuses.set(providerId, {
      providerId,
      ...healthStatus,
    });

    // 记录健康指标
    this.recordMetric('provider_health_response_time', healthStatus.responseTime, { provider: providerId });
    this.recordMetric('provider_health_error_rate', healthStatus.errorRate, { provider: providerId });
    this.recordMetric('provider_health_availability', healthStatus.availability, { provider: providerId });

    // 记录状态指标
    const statusValue = healthStatus.status === 'healthy' ? 1 : healthStatus.status === 'degraded' ? 0.5 : 0;
    this.recordMetric('provider_health_status', statusValue, { provider: providerId });
  }

  /**
   * 获取Provider健康状态
   */
  public getProviderHealth(providerId: string): ProviderHealthStatus | null {
    return this.healthStatuses.get(providerId) || null;
  }

  /**
   * 获取所有Provider健康状态
   */
  public getAllProviderHealth(): ProviderHealthStatus[] {
    return Array.from(this.healthStatuses.values());
  }

  /**
   * 更新系统指标
   */
  public updateSystemMetrics(metrics: SystemMetrics): void {
    this.systemMetrics = metrics;

    // 记录系统指标
    this.recordMetric('system_cpu_usage', metrics.cpuUsage);
    this.recordMetric('system_memory_usage', metrics.memoryUsage);
    this.recordMetric('system_disk_usage', metrics.diskUsage);
    this.recordMetric('system_network_bytes_in', metrics.networkTraffic.bytesIn);
    this.recordMetric('system_network_bytes_out', metrics.networkTraffic.bytesOut);
    this.recordMetric('system_active_connections', metrics.activeConnections);
  }

  /**
   * 获取系统指标
   */
  public getSystemMetrics(): SystemMetrics | null {
    return this.systemMetrics;
  }

  /**
   * 获取指标时间序列
   */
  public getMetricTimeSeries(
    metricName: string,
    timeRange?: { start: number; end: number },
    labels?: Record<string, string>
  ): MetricDataPoint[] {
    const dataPoints = this.metrics.get(metricName) || [];

    let filtered = dataPoints;

    // 过滤时间范围
    if (timeRange) {
      filtered = filtered.filter(point => point.timestamp >= timeRange.start && point.timestamp <= timeRange.end);
    }

    // 过滤标签
    if (labels) {
      filtered = filtered.filter(point => {
        return Object.entries(labels).every(([key, value]) => point.labels[key] === value);
      });
    }

    return filtered.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * 获取所有指标名称
   */
  public getMetricNames(): string[] {
    return Array.from(this.definitions.keys());
  }

  /**
   * 获取指标定义
   */
  public getMetricDefinition(metricName: string): MetricDefinition | null {
    return this.definitions.get(metricName) || null;
  }

  /**
   * 清理过期数据
   */
  public cleanup(): void {
    const cutoffTime = Date.now() - this.retentionPeriod;

    for (const [metricName, dataPoints] of this.metrics.entries()) {
      const validPoints = dataPoints.filter(point => point.timestamp >= cutoffTime);
      this.metrics.set(metricName, validPoints);
    }

    // 清理过期的健康状态
    for (const [providerId, healthStatus] of this.healthStatuses.entries()) {
      if (healthStatus.lastCheckTime < cutoffTime) {
        this.healthStatuses.delete(providerId);
      }
    }
  }

  /**
   * 导出指标数据
   */
  public exportMetrics(format: 'json' | 'prometheus' = 'json'): string {
    if (format === 'prometheus') {
      return this.exportPrometheusFormat();
    }

    const exportData = {
      timestamp: Date.now(),
      metrics: {},
      healthStatuses: Array.from(this.healthStatuses.values()),
      systemMetrics: this.systemMetrics,
    };

    for (const [name, dataPoints] of this.metrics.entries()) {
      exportData.metrics[name] = {
        definition: this.definitions.get(name),
        dataPoints: dataPoints.slice(-100), // 最近100个数据点
      };
    }

    return JQJsonHandler.stringifyJson(exportData, false);
  }

  /**
   * 获取最新指标值
   */
  private getLatestValue(metricName: string, labels: Record<string, string>): number | null {
    const dataPoints = this.metrics.get(metricName) || [];

    // 从后往前查找匹配标签的最新数据点
    for (let i = dataPoints.length - 1; i >= 0; i--) {
      const point = dataPoints[i];
      const labelsMatch = Object.entries(labels).every(([key, value]) => point.labels[key] === value);

      if (labelsMatch) {
        return point.value;
      }
    }

    return null;
  }

  /**
   * 计算分位数
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;

    const index = percentile * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (upper >= sortedValues.length) return sortedValues[sortedValues.length - 1];
    if (lower === upper) return sortedValues[lower];

    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * 注册默认指标
   */
  private registerDefaultMetrics(): void {
    const defaultMetrics: MetricDefinition[] = [
      {
        name: 'provider_requests_total',
        type: 'counter',
        description: 'Total number of requests processed by provider',
        unit: 'requests',
        labelNames: ['provider', 'status'],
      },
      {
        name: 'provider_request_duration_seconds',
        type: 'histogram',
        description: 'Request duration in seconds',
        unit: 'seconds',
        labelNames: ['provider'],
      },
      {
        name: 'provider_health_status',
        type: 'gauge',
        description: 'Provider health status (1=healthy, 0.5=degraded, 0=unhealthy)',
        labelNames: ['provider'],
      },
      {
        name: 'provider_health_response_time',
        type: 'gauge',
        description: 'Provider health check response time in milliseconds',
        unit: 'milliseconds',
        labelNames: ['provider'],
      },
      {
        name: 'provider_health_error_rate',
        type: 'gauge',
        description: 'Provider error rate (0-1)',
        labelNames: ['provider'],
      },
      {
        name: 'provider_health_availability',
        type: 'gauge',
        description: 'Provider availability (0-1)',
        labelNames: ['provider'],
      },
      {
        name: 'system_cpu_usage',
        type: 'gauge',
        description: 'System CPU usage percentage',
        unit: 'percent',
        labelNames: [],
      },
      {
        name: 'system_memory_usage',
        type: 'gauge',
        description: 'System memory usage percentage',
        unit: 'percent',
        labelNames: [],
      },
    ];

    defaultMetrics.forEach(metric => this.registerMetric(metric));
  }

  /**
   * 导出Prometheus格式
   */
  private exportPrometheusFormat(): string {
    const lines: string[] = [];

    for (const [name, definition] of this.definitions.entries()) {
      lines.push(`# HELP ${name} ${definition.description}`);
      lines.push(`# TYPE ${name} ${definition.type}`);

      const dataPoints = this.metrics.get(name) || [];
      const latestPoints = dataPoints.slice(-1); // 只导出最新值

      for (const point of latestPoints) {
        const labelPairs = Object.entries(point.labels)
          .map(([key, value]) => `${key}="${value}"`)
          .join(',');

        const labelString = labelPairs ? `{${labelPairs}}` : '';
        lines.push(`${name}${labelString} ${point.value} ${point.timestamp}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 启动清理任务
   */
  private startCleanupTask(): void {
    setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    ); // 每5分钟清理一次
  }
}
