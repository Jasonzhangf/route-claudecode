/**
 * HTTP请求处理器
 * 
 * 负责处理内置路由请求（健康检查、状态、版本等）
 * 
 * @author RCC v4.0
 */

import { 
  RequestContext, 
  ResponseContext, 
  HTTPRequestHandlers,
  ServerStatus 
} from './http-types';
import { AssembledPipeline } from './http-types';

/**
 * HTTP请求处理器实现
 */
export class HTTPRequestHandlersImpl implements HTTPRequestHandlers {
  private assembledPipelines: AssembledPipeline[];
  private initialized: boolean;

  constructor(assembledPipelines: AssembledPipeline[] = [], initialized: boolean = false) {
    this.assembledPipelines = assembledPipelines;
    this.initialized = initialized;
  }

  /**
   * 处理健康检查请求
   */
  async handleHealthCheck(req: RequestContext, res: ResponseContext): Promise<void> {
    const health = this.performHealthChecks();
    const overallStatus = health.every(check => check.status === 'pass') ? 'healthy' : 'degraded';

    res.body = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: health,
    };
  }

  /**
   * 处理状态请求
   */
  async handleStatus(req: RequestContext, res: ResponseContext): Promise<void> {
    const serverStatus = this.getServerStatus();

    res.body = {
      server: {
        status: serverStatus.isRunning ? 'running' : 'stopped',
        host: serverStatus.host,
        port: serverStatus.port,
        uptime: serverStatus.uptime,
        totalRequests: serverStatus.totalRequests,
        startTime: serverStatus.startTime,
        version: serverStatus.version,
      },
      health: {
        overall: serverStatus.health.status,
        checks: serverStatus.health.checks,
      },
      pipelines: {
        total: this.assembledPipelines.length,
        initialized: this.initialized
      },
      performance: {
        memoryUsage: process.memoryUsage().heapUsed,
        cpuUsage: process.cpuUsage(),
        averageResponseTime: 0,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 处理版本信息请求
   */
  async handleVersion(req: RequestContext, res: ResponseContext): Promise<void> {
    res.body = {
      name: 'RCC (Route Claude Code)',
      version: '4.0.0-alpha.1',
      description: 'Modular AI routing proxy system',
      author: 'Jason Zhang',
    };
  }

  /**
   * 设置流水线状态
   */
  setPipelines(pipelines: AssembledPipeline[], initialized: boolean): void {
    this.assembledPipelines = pipelines;
    this.initialized = initialized;
  }

  /**
   * 获取服务器状态（供外部使用）
   */
  getServerStatus(): ServerStatus {
    return {
      isRunning: true, // 由外部服务器状态决定
      port: 0, // 由外部服务器配置决定
      host: 'localhost', // 由外部服务器配置决定
      startTime: new Date(), // 由外部服务器设置
      version: '4.0.0-alpha.1-clean',
      activePipelines: this.getActivePipelineCount(),
      totalRequests: 0, // 由外部服务器统计
      uptime: '0s', // 由外部服务器计算
      health: {
        status: 'healthy', // 由外部服务器检查
        checks: this.performHealthChecks(),
      },
    };
  }

  /**
   * 获取活跃Pipeline数量
   */
  private getActivePipelineCount(): number {
    return this.assembledPipelines.length;
  }

  /**
   * 计算运行时间（供外部使用）
   */
  calculateUptime(startTime?: Date): string {
    if (!startTime) {
      return '0s';
    }

    const uptimeMs = Date.now() - startTime.getTime();
    const uptimeSeconds = Math.floor(uptimeMs / 1000);

    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * 执行健康检查
   */
  private performHealthChecks(): Array<{ name: string; status: 'pass' | 'warn' | 'fail'; responseTime: number }> {
    const checks: Array<{ name: string; status: 'pass' | 'warn' | 'fail'; responseTime: number }> = [];

    // 内存检查
    const memStart = Date.now();
    const memUsage = process.memoryUsage();
    const maxMemory = 512 * 1024 * 1024; // 512MB
    checks.push({
      name: 'Memory Usage',
      status: memUsage.heapUsed < maxMemory ? 'pass' : 'warn',
      responseTime: Date.now() - memStart,
    });

    // CPU检查
    const cpuStart = Date.now();
    const cpuUsage = process.cpuUsage();
    checks.push({
      name: 'CPU Usage',
      status: 'pass', // 简化的CPU状态检查
      responseTime: Date.now() - cpuStart,
    });

    return checks;
  }
}