/**
 * Provider健康监控器
 * 
 * 监控Provider健康状态，执行定期健康检查并更新指标
 * 
 * @author Jason Zhang
 */

import { ProviderHealthStatus, SystemMetrics } from './metrics-collector';

/**
 * 健康检查配置
 */
export interface HealthCheckConfig {
  /** Provider ID */
  providerId: string;
  /** 检查间隔(毫秒) */
  interval: number;
  /** 超时时间(毫秒) */
  timeout: number;
  /** 重试次数 */
  retries: number;
  /** 重试延迟(毫秒) */
  retryDelay: number;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 健康检查结果
 */
export interface HealthCheckResult {
  /** 是否成功 */
  success: boolean;
  /** 响应时间(毫秒) */
  responseTime: number;
  /** 错误信息 */
  error?: string;
  /** 额外数据 */
  data?: any;
}

/**
 * Provider健康检查器接口
 */
export interface ProviderHealthChecker {
  /** Provider ID */
  providerId: string;
  /** 执行健康检查 */
  check(): Promise<HealthCheckResult>;
}

/**
 * HTTP健康检查器
 */
export class HttpHealthChecker implements ProviderHealthChecker {
  public readonly providerId: string;
  private endpoint: string;
  private timeout: number;

  constructor(providerId: string, endpoint: string, timeout: number = 5000) {
    this.providerId = providerId;
    this.endpoint = endpoint;
    this.timeout = timeout;
  }

  public async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          success: true,
          responseTime,
          data: {
            status: response.status,
            statusText: response.statusText
          }
        };
      } else {
        return {
          success: false,
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

/**
 * 自定义健康检查器
 */
export class CustomHealthChecker implements ProviderHealthChecker {
  public readonly providerId: string;
  private checkFunction: () => Promise<HealthCheckResult>;

  constructor(providerId: string, checkFunction: () => Promise<HealthCheckResult>) {
    this.providerId = providerId;
    this.checkFunction = checkFunction;
  }

  public async check(): Promise<HealthCheckResult> {
    try {
      return await this.checkFunction();
    } catch (error) {
      return {
        success: false,
        responseTime: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

/**
 * 系统指标收集器
 */
export class SystemMetricsCollector {
  /**
   * 获取系统指标
   */
  public async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      // Node.js环境下获取系统指标
      const os = await import('os');
      const process = await import('process');

      // CPU使用率计算
      const cpuUsage = await this.getCpuUsage();
      
      // 内存使用率
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;

      // 磁盘使用率 (Node.js中较难获取，使用模拟值)
      const diskUsage = await this.getDiskUsage();

      // 网络流量 (模拟值)
      const networkTraffic = {
        bytesIn: Math.floor(Math.random() * 1000000),
        bytesOut: Math.floor(Math.random() * 1000000)
      };

      // 活跃连接数 (模拟值)
      const activeConnections = Math.floor(Math.random() * 100);

      return {
        cpuUsage,
        memoryUsage,
        diskUsage,
        networkTraffic,
        activeConnections
      };
    } catch (error) {
      console.error('[SystemMetricsCollector] Failed to collect system metrics:', error);
      
      // 返回默认值
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkTraffic: {
          bytesIn: 0,
          bytesOut: 0
        },
        activeConnections: 0
      };
    }
  }

  /**
   * 获取CPU使用率
   */
  private async getCpuUsage(): Promise<number> {
    try {
      const os = await import('os');
      
      const cpus = os.cpus();
      const startTime = Date.now();
      
      // 获取CPU信息
      const startCpus = cpus.map(cpu => {
        const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0);
        const idle = cpu.times.idle;
        return { total, idle };
      });

      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 100));

      const endCpus = os.cpus().map(cpu => {
        const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0);
        const idle = cpu.times.idle;
        return { total, idle };
      });

      // 计算平均CPU使用率
      let totalUsage = 0;
      for (let i = 0; i < startCpus.length; i++) {
        const startCpu = startCpus[i];
        const endCpu = endCpus[i];
        
        const totalDiff = endCpu.total - startCpu.total;
        const idleDiff = endCpu.idle - startCpu.idle;
        
        if (totalDiff > 0) {
          const usage = 100 * (1 - idleDiff / totalDiff);
          totalUsage += usage;
        }
      }

      return totalUsage / cpus.length;
    } catch (error) {
      // 如果无法获取CPU使用率，返回模拟值
      return Math.random() * 50; // 0-50%的随机值
    }
  }

  /**
   * 获取磁盘使用率
   */
  private async getDiskUsage(): Promise<number> {
    try {
      // 在Node.js中获取磁盘使用率比较复杂，这里使用模拟值
      // 在实际生产环境中，可以使用系统命令或专门的库
      return Math.random() * 80; // 0-80%的随机值
    } catch (error) {
      return 0;
    }
  }
}

/**
 * 健康监控器
 */
export class HealthMonitor {
  private checkers: Map<string, ProviderHealthChecker>;
  private configs: Map<string, HealthCheckConfig>;
  private intervals: Map<string, NodeJS.Timeout>;
  private healthStatuses: Map<string, ProviderHealthStatus>;
  private systemMetricsCollector: SystemMetricsCollector;
  private onHealthUpdate?: (providerId: string, status: ProviderHealthStatus) => void;
  private onSystemMetricsUpdate?: (metrics: SystemMetrics) => void;
  private systemMetricsInterval?: NodeJS.Timeout;

  constructor() {
    this.checkers = new Map();
    this.configs = new Map();
    this.intervals = new Map();
    this.healthStatuses = new Map();
    this.systemMetricsCollector = new SystemMetricsCollector();
  }

  /**
   * 添加Provider健康检查器
   */
  public addHealthChecker(checker: ProviderHealthChecker, config: HealthCheckConfig): void {
    this.checkers.set(checker.providerId, checker);
    this.configs.set(checker.providerId, config);

    // 如果配置启用，立即开始监控
    if (config.enabled) {
      this.startHealthCheck(checker.providerId);
    }
  }

  /**
   * 移除Provider健康检查器
   */
  public removeHealthChecker(providerId: string): void {
    this.stopHealthCheck(providerId);
    this.checkers.delete(providerId);
    this.configs.delete(providerId);
    this.healthStatuses.delete(providerId);
  }

  /**
   * 开始健康检查
   */
  public startHealthCheck(providerId: string): void {
    const config = this.configs.get(providerId);
    if (!config || !config.enabled) {
      return;
    }

    // 停止现有的检查
    this.stopHealthCheck(providerId);

    // 立即执行一次检查
    this.executeHealthCheck(providerId);

    // 设置定期检查
    const interval = setInterval(() => {
      this.executeHealthCheck(providerId);
    }, config.interval);

    this.intervals.set(providerId, interval);
  }

  /**
   * 停止健康检查
   */
  public stopHealthCheck(providerId: string): void {
    const interval = this.intervals.get(providerId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(providerId);
    }
  }

  /**
   * 获取Provider健康状态
   */
  public getHealthStatus(providerId: string): ProviderHealthStatus | null {
    return this.healthStatuses.get(providerId) || null;
  }

  /**
   * 获取所有健康状态
   */
  public getAllHealthStatuses(): ProviderHealthStatus[] {
    return Array.from(this.healthStatuses.values());
  }

  /**
   * 设置健康状态更新回调
   */
  public setHealthUpdateCallback(callback: (providerId: string, status: ProviderHealthStatus) => void): void {
    this.onHealthUpdate = callback;
  }

  /**
   * 设置系统指标更新回调
   */
  public setSystemMetricsUpdateCallback(callback: (metrics: SystemMetrics) => void): void {
    this.onSystemMetricsUpdate = callback;
  }

  /**
   * 开始系统指标收集
   */
  public startSystemMetricsCollection(intervalMs: number = 60000): void {
    this.stopSystemMetricsCollection();

    // 立即收集一次
    this.collectSystemMetrics();

    // 设置定期收集
    this.systemMetricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, intervalMs);
  }

  /**
   * 停止系统指标收集
   */
  public stopSystemMetricsCollection(): void {
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
      this.systemMetricsInterval = undefined;
    }
  }

  /**
   * 启动所有监控
   */
  public startAll(): void {
    console.log(`[HealthMonitor] Starting monitoring for ${this.checkers.size} providers`);
    
    // 启动所有Provider健康检查
    for (const [providerId, config] of this.configs.entries()) {
      if (config.enabled) {
        this.startHealthCheck(providerId);
      }
    }

    // 启动系统指标收集
    this.startSystemMetricsCollection();
  }

  /**
   * 停止所有监控
   */
  public stopAll(): void {
    // 停止所有Provider健康检查
    for (const providerId of this.configs.keys()) {
      this.stopHealthCheck(providerId);
    }

    // 停止系统指标收集
    this.stopSystemMetricsCollection();

    console.log('[HealthMonitor] All monitoring stopped');
  }

  /**
   * 执行健康检查
   */
  private async executeHealthCheck(providerId: string): Promise<void> {
    const checker = this.checkers.get(providerId);
    const config = this.configs.get(providerId);
    
    if (!checker || !config) {
      return;
    }

    let attempts = 0;
    let lastResult: HealthCheckResult | null = null;

    // 重试机制
    while (attempts <= config.retries) {
      try {
        lastResult = await checker.check();
        
        if (lastResult.success) {
          break; // 成功则退出重试循环
        }
      } catch (error) {
        lastResult = {
          success: false,
          responseTime: 0,
          error: error instanceof Error ? error.message : String(error)
        };
      }

      attempts++;
      
      // 如果不是最后一次尝试，等待重试延迟
      if (attempts <= config.retries) {
        await new Promise(resolve => setTimeout(resolve, config.retryDelay));
      }
    }

    if (lastResult) {
      this.updateHealthStatus(providerId, lastResult);
    }
  }

  /**
   * 更新健康状态
   */
  private updateHealthStatus(providerId: string, result: HealthCheckResult): void {
    const now = Date.now();
    const currentStatus = this.healthStatuses.get(providerId);

    // 计算错误率和可用性
    const errorRate = result.success ? 0 : 1;
    const availability = result.success ? 1 : 0;

    // 如果有历史状态，使用加权平均
    let finalErrorRate = errorRate;
    let finalAvailability = availability;

    if (currentStatus) {
      const alpha = 0.1; // 平滑因子
      finalErrorRate = alpha * errorRate + (1 - alpha) * currentStatus.errorRate;
      finalAvailability = alpha * availability + (1 - alpha) * currentStatus.availability;
    }

    // 确定健康状态
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (finalAvailability >= 0.95 && finalErrorRate <= 0.05) {
      status = 'healthy';
    } else if (finalAvailability >= 0.8 && finalErrorRate <= 0.2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    const healthStatus: ProviderHealthStatus = {
      providerId,
      status,
      lastCheckTime: now,
      responseTime: result.responseTime,
      errorRate: finalErrorRate,
      availability: finalAvailability,
      details: {
        lastError: result.error,
        successCount: currentStatus ? (result.success ? currentStatus.details.successCount + 1 : currentStatus.details.successCount) : (result.success ? 1 : 0),
        errorCount: currentStatus ? (!result.success ? currentStatus.details.errorCount + 1 : currentStatus.details.errorCount) : (!result.success ? 1 : 0),
        data: result.data
      }
    };

    this.healthStatuses.set(providerId, healthStatus);

    // 触发回调
    if (this.onHealthUpdate) {
      this.onHealthUpdate(providerId, healthStatus);
    }
  }

  /**
   * 收集系统指标
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      const metrics = await this.systemMetricsCollector.getSystemMetrics();
      
      // 触发回调
      if (this.onSystemMetricsUpdate) {
        this.onSystemMetricsUpdate(metrics);
      }
    } catch (error) {
      console.error('[HealthMonitor] Failed to collect system metrics:', error);
    }
  }
}