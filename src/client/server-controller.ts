/**
 * 服务器控制器实现
 *
 * 提供服务器启动、停止、状态查询等功能
 *
 * @author Jason Zhang
 */

import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import {
  IServerController,
  ServerStartConfig,
  ServerStartResult,
  ServerStopConfig,
  ServerStopResult,
  ServerStatusConfig,
  ServerStatusResult,
  HealthStatus,
  PipelineStatusSummary,
  MemoryUsage,
  RequestStats,
} from '../interfaces/core/cli-abstraction';
import { RCCError, ErrorHandler } from '../interfaces/client/error-handler';
import { getServerPort, getServerHost } from '../constants/server-defaults';

const execAsync = promisify(exec);

/**
 * 服务器控制器错误类
 */
export class ServerControllerError extends RCCError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'SERVER_CONTROLLER_ERROR', details);
    this.name = 'ServerControllerError';
  }
}

/**
 * 进程信息
 */
interface ProcessInfo {
  pid: number;
  port: number;
  startTime: Date;
  process?: ChildProcess;
}

/**
 * 服务器控制器实现
 */
export class ServerController implements IServerController {
  private processes = new Map<number, ProcessInfo>();

  constructor(private errorHandler: ErrorHandler) {}

  /**
   * 启动服务器
   */
  async start(config: ServerStartConfig): Promise<ServerStartResult> {
    const port = getServerPort(config.port);
    const host = getServerHost(config.host);

    try {
      // 检查端口是否已被占用
      const isRunning = await this.isRunning(port);
      if (isRunning) {
        throw new ServerControllerError('Server is already running on this port', { port });
      }

      // 构建启动命令
      const args = this.buildStartArgs(config);

      // 启动服务器进程
      const serverProcess = spawn('node', ['dist/index.js', 'start', ...args], {
        stdio: config.debug ? 'inherit' : 'pipe',
        detached: false,
        cwd: process.cwd(),
      });

      // 等待服务器启动
      await this.waitForServerStart(port, 30000);

      // 记录进程信息
      const processInfo: ProcessInfo = {
        pid: serverProcess.pid!,
        port,
        startTime: new Date(),
        process: serverProcess,
      };
      this.processes.set(port, processInfo);

      // 设置进程事件监听
      this.setupProcessHandlers(serverProcess, port);

      return {
        success: true,
        port,
        host,
        pid: serverProcess.pid,
        startTime: processInfo.startTime,
        message: 'Server started successfully',
      };
    } catch (error) {
      const serverError = new ServerControllerError(`Failed to start server: ${(error as Error).message}`, {
        port,
        host,
        config,
      });
      this.errorHandler.handleError(serverError);
      throw serverError;
    }
  }

  /**
   * 停止服务器
   */
  async stop(config: ServerStopConfig): Promise<ServerStopResult> {
    const port = getServerPort(config.port);

    try {
      const processInfo = this.processes.get(port);

      if (!processInfo) {
        // 尝试通过API停止
        await this.stopViaAPI(port);
      } else {
        // 停止已知进程
        await this.stopProcess(processInfo, config.force, config.timeout);
        this.processes.delete(port);
      }

      return {
        success: true,
        message: 'Server stopped successfully',
        stopTime: new Date(),
      };
    } catch (error) {
      const serverError = new ServerControllerError(`Failed to stop server: ${(error as Error).message}`, {
        port,
        config,
      });
      this.errorHandler.handleError(serverError);
      throw serverError;
    }
  }

  /**
   * 获取服务器状态
   */
  async getStatus(config: ServerStatusConfig): Promise<ServerStatusResult> {
    const port = getServerPort(config.port);

    try {
      const isRunning = await this.isRunning(port);

      if (!isRunning) {
        return {
          running: false,
        };
      }

      const processInfo = this.processes.get(port);
      const basicStatus: ServerStatusResult = {
        running: true,
        port,
        host: getServerHost(),
        pid: processInfo?.pid,
        uptime: processInfo ? Date.now() - processInfo.startTime.getTime() : undefined,
        startTime: processInfo?.startTime,
      };

      if (config.detailed) {
        // 获取详细状态信息
        const detailedStatus = await this.getDetailedStatus(port);
        return { ...basicStatus, ...detailedStatus };
      }

      return basicStatus;
    } catch (error) {
      const serverError = new ServerControllerError(`Failed to get server status: ${(error as Error).message}`, {
        port,
        config,
      });
      this.errorHandler.handleError(serverError);
      throw serverError;
    }
  }

  /**
   * 检查服务器是否运行
   */
  async isRunning(port?: number): Promise<boolean> {
    const serverPort = getServerPort(port);
    const host = getServerHost();

    try {
      const response = await fetch(`http://${host}:${serverPort}/v1/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 构建启动参数
   */
  private buildStartArgs(config: ServerStartConfig): string[] {
    const args: string[] = [];

    if (config.port) {
      args.push('--port', config.port.toString());
    }

    if (config.host) {
      args.push('--host', config.host);
    }

    if (config.configPath) {
      args.push('--config', config.configPath);
    }

    if (config.debug) {
      args.push('--debug');
    }

    return args;
  }

  /**
   * 等待服务器启动
   */
  private async waitForServerStart(port: number, timeout: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await this.isRunning(port)) {
        return;
      }
      await this.delay(500);
    }

    throw new Error(`Server failed to start within ${timeout}ms`);
  }

  /**
   * 设置进程事件处理器
   */
  private setupProcessHandlers(process: ChildProcess, port: number): void {
    process.on('exit', (code, signal) => {
      this.processes.delete(port);
      if (code !== 0) {
        this.errorHandler.handleError(
          new ServerControllerError(`Server process exited with code ${code}`, { port, signal }),
          {
            module: 'server_controller',
            operation: 'process_exit',
            additionalData: { port, code, signal },
          }
        );
      }
    });

    process.on('error', error => {
      this.processes.delete(port);
      this.errorHandler.handleError(new ServerControllerError(`Server process error: ${error.message}`, { port }), {
        module: 'server_controller',
        operation: 'process_error',
        additionalData: { port, error: error.message },
      });
    });
  }

  /**
   * 通过API停止服务器
   */
  private async stopViaAPI(port: number): Promise<void> {
    const host = getServerHost();

    try {
      const response = await fetch(`http://${host}:${port}/v1/admin/shutdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`API stop failed with status ${response.status}`);
      }

      // 等待服务器完全停止
      let retries = 10;
      while (retries > 0) {
        if (!(await this.isRunning(port))) {
          return;
        }
        await this.delay(500);
        retries--;
      }

      throw new Error('Server did not stop after API shutdown request');
    } catch (error) {
      throw new Error(`Failed to stop server via API: ${(error as Error).message}`);
    }
  }

  /**
   * 停止进程
   */
  private async stopProcess(processInfo: ProcessInfo, force?: boolean, timeout?: number): Promise<void> {
    const { process: serverProcess, pid } = processInfo;
    const stopTimeout = timeout || 10000;

    if (!serverProcess) {
      // 通过PID停止进程
      await this.killProcessByPid(pid, force);
      return;
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (force) {
          serverProcess.kill('SIGKILL');
        } else {
          reject(new Error(`Process did not stop within ${stopTimeout}ms`));
        }
      }, stopTimeout);

      serverProcess.once('exit', () => {
        clearTimeout(timeoutId);
        resolve();
      });

      // 发送停止信号
      serverProcess.kill(force ? 'SIGKILL' : 'SIGTERM');
    });
  }

  /**
   * 通过PID停止进程
   */
  private async killProcessByPid(pid: number, force?: boolean): Promise<void> {
    try {
      const signal = force ? 'SIGKILL' : 'SIGTERM';
      process.kill(pid, signal);

      // 等待进程停止
      let retries = 20;
      while (retries > 0) {
        try {
          process.kill(pid, 0); // 检查进程是否存在
          await this.delay(250);
          retries--;
        } catch {
          return; // 进程已停止
        }
      }

      if (retries === 0 && !force) {
        // 强制停止
        process.kill(pid, 'SIGKILL');
      }
    } catch (error) {
      if ((error as any).code !== 'ESRCH') {
        throw error;
      }
      // ESRCH表示进程不存在，这是期望的结果
    }
  }

  /**
   * 获取详细状态
   */
  private async getDetailedStatus(port: number): Promise<Partial<ServerStatusResult>> {
    const host = getServerHost();

    try {
      const response = await fetch(`http://${host}:${port}/v1/status/detailed`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return {};
      }

      const data = await response.json();

      return {
        health: this.parseHealthStatus(data.health),
        pipelines: this.parsePipelineStatus(data.pipelines),
        memory: this.parseMemoryUsage(data.memory),
        requests: this.parseRequestStats(data.requests),
      };
    } catch {
      return {};
    }
  }

  /**
   * 解析健康状态
   */
  private parseHealthStatus(data: any): HealthStatus | undefined {
    if (!data) return undefined;

    return {
      healthy: data.healthy || false,
      checks: data.checks || [],
      lastCheck: new Date(data.lastCheck || Date.now()),
    };
  }

  /**
   * 解析Pipeline状态
   */
  private parsePipelineStatus(data: any): PipelineStatusSummary | undefined {
    if (!data) return undefined;

    return {
      total: data.total || 0,
      running: data.running || 0,
      stopped: data.stopped || 0,
      error: data.error || 0,
      healthy: data.healthy || 0,
    };
  }

  /**
   * 解析内存使用情况
   */
  private parseMemoryUsage(data: any): MemoryUsage | undefined {
    if (!data) return undefined;

    return {
      rss: data.rss || 0,
      heapTotal: data.heapTotal || 0,
      heapUsed: data.heapUsed || 0,
      external: data.external || 0,
    };
  }

  /**
   * 解析请求统计
   */
  private parseRequestStats(data: any): RequestStats | undefined {
    if (!data) return undefined;

    return {
      total: data.total || 0,
      successful: data.successful || 0,
      failed: data.failed || 0,
      averageResponseTime: data.averageResponseTime || 0,
      requestsPerSecond: data.requestsPerSecond || 0,
    };
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 清理所有进程
   */
  async cleanup(): Promise<void> {
    const ports = Array.from(this.processes.keys());

    await Promise.all(ports.map(port => this.stop({ port, force: true, timeout: 5000 }).catch(() => {})));

    this.processes.clear();
  }
}

// ServerController已通过export class导出
