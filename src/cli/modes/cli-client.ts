import { spawn, ChildProcess } from 'child_process';
import {
  CLIModeInterface,
  ClientModeOptions,
  ModeStatus,
  HealthStatus,
  ProxyManager,
  ProxyStatus,
  ProxyTarget,
  LifecycleManager,
  ProxyHealth,
} from './mode-interface';
import { ConfigManager } from '../../config/config-manager';
import { ErrorHandler } from '../../middleware/error-handler';

export class ClientMode implements CLIModeInterface {
  public readonly name = 'client';
  public readonly description = 'Run RCC as Claude Code proxy';

  private claudeCodeProcess?: ChildProcess;
  private proxyManager?: ProxyManager;
  private lifecycleManager?: LifecycleManager;
  private configManager?: ConfigManager;
  private isRunning = false;
  private startTime?: Date;
  private currentOptions?: ClientModeOptions;

  async start(options: ClientModeOptions): Promise<void> {
    try {
      this.currentOptions = options;
      this.startTime = new Date();

      console.log('Starting RCC Client mode...');

      // 1. 初始化配置管理器
      console.log('Loading client configuration...');
      this.configManager = new ConfigManager();
      await this.configManager.loadConfig();

      // 2. 启动Claude Code进程
      console.log('Starting Claude Code process...');
      await this.startClaudeCodeProcess(options);

      // 3. 设置透明代理
      console.log('Setting up transparent proxy...');
      this.proxyManager = new ClientProxyManager({
        processName: 'claude',
        targetUrl: 'http://localhost:3456',
        proxyUrl: 'http://localhost:5506',
        targetProcess: 'claude',
        proxyPort: options.proxyPort || 3456,
        rccServerUrl: await this.getRCCServerUrl(options),
      });
      await this.proxyManager.start();

      // 4. 初始化生命周期管理器
      this.lifecycleManager = new ClientLifecycleManager({
        claudeCodeProcess: this.claudeCodeProcess!,
        proxyManager: this.proxyManager,
        configManager: this.configManager,
      });
      await this.lifecycleManager.start();

      this.isRunning = true;

      console.log('✅ RCC Client started successfully');
      console.log(`   Claude Code process: PID ${this.claudeCodeProcess?.pid}`);
      console.log(`   Proxy listening on: http://localhost:${options.proxyPort || 3456}`);
      console.log('   Press Ctrl+C to stop');

      // 5. 监控进程健康状态
      this.startHealthMonitoring();

      // 6. 等待进程结束
      await this.waitForProcesses();
    } catch (error) {
      console.error('Failed to start client mode:', error);
      await this.cleanup();
      throw error;
    }
  }

  async stop(): Promise<void> {
    console.log('Stopping RCC Client...');
    await this.cleanup();
    console.log('✅ RCC Client stopped successfully');
  }

  getStatus(): ModeStatus {
    return {
      mode: this.name,
      isRunning: this.isRunning,
      pid: process.pid,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      port: this.currentOptions?.proxyPort,
      lastError: undefined,
    };
  }

  async healthCheck(): Promise<HealthStatus> {
    const timestamp = new Date();

    if (!this.isRunning || !this.claudeCodeProcess || !this.proxyManager) {
      return {
        healthy: false,
        timestamp,
        details: {},
      };
    }

    try {
      // 检查Claude Code进程状态
      const processHealthy = !this.claudeCodeProcess.killed && this.claudeCodeProcess.pid !== undefined;

      // 检查代理状态
      const proxyStatus = this.proxyManager.getStatus();
      const proxyHealthy = proxyStatus.active;

      // 检查生命周期管理器状态
      const lifecycleHealth = this.lifecycleManager
        ? await this.lifecycleManager.monitorHealth()
        : { healthy: false, timestamp, details: {} };

      const overall = processHealthy && proxyHealthy && lifecycleHealth.healthy;

      return {
        healthy: overall,
        timestamp,
        details: {
          proxy: {
            connected: proxyHealthy,
            targetProcess: this.claudeCodeProcess.pid?.toString(),
            proxyPort: this.currentOptions?.proxyPort,
          },
        },
      };
    } catch (error) {
      console.error('Client health check failed:', error);
      return {
        healthy: false,
        timestamp,
        details: {},
      };
    }
  }

  private async startClaudeCodeProcess(options: ClientModeOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      // 启动真实的Claude Code进程，不使用mockup
      const claudeCommand = this.findClaudeCodeCommand();
      const args = this.buildClaudeCodeArgs(options);

      console.log(`Executing: ${claudeCommand} ${args.join(' ')}`);

      this.claudeCodeProcess = spawn(claudeCommand, args, {
        stdio: ['inherit', 'pipe', 'pipe'],
        env: {
          ...process.env,
          RCC_PROXY_MODE: 'true',
          RCC_PROXY_PORT: (options.proxyPort || 3456).toString(),
        },
      });

      this.claudeCodeProcess.stdout?.on('data', data => {
        const output = data.toString();
        console.log('[Claude Code]:', output.trim());

        // 检查启动成功标志
        if (output.includes('Claude Code started') || output.includes('Ready')) {
          resolve();
        }
      });

      this.claudeCodeProcess.stderr?.on('data', data => {
        const error = data.toString();
        console.error('[Claude Code Error]:', error.trim());
      });

      this.claudeCodeProcess.on('error', error => {
        console.error('Failed to start Claude Code:', error);
        reject(error);
      });

      this.claudeCodeProcess.on('exit', (code, signal) => {
        console.log(`Claude Code process exited with code ${code}, signal ${signal}`);
        this.isRunning = false;
      });

      // 超时处理
      setTimeout(() => {
        if (this.claudeCodeProcess && !this.claudeCodeProcess.killed) {
          resolve(); // 假设启动成功
        }
      }, 5000);
    });
  }

  private findClaudeCodeCommand(): string {
    // 查找系统中的Claude Code命令
    // 优先级：claude -> claude-code -> npx claude
    const possibleCommands = ['claude', 'claude-code', 'npx claude'];

    for (const cmd of possibleCommands) {
      try {
        // 检查命令是否存在
        require('child_process').execSync(`which ${cmd.split(' ')[0]}`, { stdio: 'ignore' });
        return cmd;
      } catch (error) {
        continue;
      }
    }

    // 如果都找不到，抛出错误
    throw new Error('Claude Code command not found. Please install Claude Code CLI first.');
  }

  private buildClaudeCodeArgs(options: ClientModeOptions): string[] {
    const args: string[] = [];

    if (options.provider) {
      args.push('--provider', options.provider);
    }

    if (options.model) {
      args.push('--model', options.model);
    }

    // 添加代理配置
    args.push('--proxy', `http://localhost:${options.proxyPort || 3456}`);

    return args;
  }

  private async getRCCServerUrl(options: ClientModeOptions): Promise<string> {
    if (!this.configManager) {
      throw new Error('Config manager not initialized');
    }

    // 从配置中获取RCC服务器URL，或使用默认值
    const config = await this.configManager.getClientConfig();
    return config.serverUrl || 'http://localhost:3456';
  }

  private startHealthMonitoring(): void {
    // 每30秒检查一次进程健康状态
    setInterval(async () => {
      try {
        const health = await this.healthCheck();
        if (!health.healthy) {
          console.warn('Client health check failed, attempting restart...');
          await this.handleUnhealthyState();
        }
      } catch (error) {
        console.error('Health monitoring error:', error);
      }
    }, 30000);
  }

  private async handleUnhealthyState(): Promise<void> {
    try {
      // 尝试重启不健康的组件
      if (this.lifecycleManager) {
        await this.lifecycleManager.restart();
      }
    } catch (error) {
      console.error('Failed to recover from unhealthy state:', error);
    }
  }

  private async waitForProcesses(): Promise<void> {
    return new Promise(resolve => {
      if (!this.claudeCodeProcess) {
        resolve();
        return;
      }

      this.claudeCodeProcess.on('exit', () => {
        console.log('Claude Code process terminated');
        this.isRunning = false;
        resolve();
      });
    });
  }

  private async cleanup(): Promise<void> {
    this.isRunning = false;

    try {
      // 停止生命周期管理器
      if (this.lifecycleManager) {
        await this.lifecycleManager.stop();
        this.lifecycleManager = undefined;
      }

      // 停止代理管理器
      if (this.proxyManager) {
        await this.proxyManager.stop();
        this.proxyManager = undefined;
      }

      // 终止Claude Code进程
      if (this.claudeCodeProcess && !this.claudeCodeProcess.killed) {
        console.log('Terminating Claude Code process...');
        this.claudeCodeProcess.kill('SIGTERM');

        // 等待进程优雅退出
        await new Promise(resolve => {
          const timeout = setTimeout(() => {
            if (this.claudeCodeProcess && !this.claudeCodeProcess.killed) {
              console.log('Force killing Claude Code process...');
              this.claudeCodeProcess.kill('SIGKILL');
            }
            resolve(undefined);
          }, 5000);

          this.claudeCodeProcess?.on('exit', () => {
            clearTimeout(timeout);
            resolve(undefined);
          });
        });

        this.claudeCodeProcess = undefined;
      }

      this.configManager = undefined;
      this.currentOptions = undefined;
      this.startTime = undefined;
    } catch (error) {
      console.error('Error during client cleanup:', error);
    }
  }
}

// 实现代理管理器
class ClientProxyManager implements ProxyManager {
  private config: ProxyTarget;
  private server?: any;
  private isActive = false;
  private interceptedCount = 0;

  constructor(config: ProxyTarget) {
    this.config = config;
  }

  async start(): Promise<void> {
    // 启动真实的HTTP代理服务器，不使用mockup
    const http = require('http');
    const httpProxy = require('http-proxy-middleware');

    const proxyMiddleware = httpProxy({
      target: this.config.targetUrl,
      changeOrigin: true,
      pathRewrite: {
        '^/': '/', // 保持路径不变
      },
      onProxyReq: (proxyReq, req, res) => {
        this.interceptedCount++;
        console.log(`[Proxy] Intercepted ${req.method} ${req.url}`);
      },
      onError: (err, req, res) => {
        console.error('[Proxy] Error:', err);
      },
    });

    this.server = http.createServer(proxyMiddleware);

    await new Promise<void>((resolve, reject) => {
      this.server.listen(this.config.proxyPort, (error: any) => {
        if (error) {
          reject(error);
        } else {
          this.isActive = true;
          console.log(`Proxy server listening on port ${this.config.proxyPort}`);
          resolve();
        }
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>(resolve => {
        this.server.close(() => {
          this.isActive = false;
          console.log('Proxy server stopped');
          resolve();
        });
      });
      this.server = undefined;
    }
  }

  getStatus(): ProxyStatus {
    return {
      active: this.isActive,
      proxyPort: this.config.proxyPort,
      interceptedRequests: this.interceptedCount,
    };
  }

  async configureTarget(target: ProxyTarget): Promise<void> {
    this.config = target;
    if (this.isActive) {
      await this.stop();
      await this.start();
    }
  }
}

// 实现生命周期管理器
class ClientLifecycleManager implements LifecycleManager {
  private claudeCodeProcess: ChildProcess;
  private proxyManager: ProxyManager;
  private configManager: ConfigManager;
  private isRunning = false;

  constructor(config: { claudeCodeProcess: ChildProcess; proxyManager: ProxyManager; configManager: ConfigManager }) {
    this.claudeCodeProcess = config.claudeCodeProcess;
    this.proxyManager = config.proxyManager;
    this.configManager = config.configManager;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    console.log('Lifecycle manager started');
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    console.log('Lifecycle manager stopped');
  }

  async restart(): Promise<void> {
    console.log('Restarting client components...');
    await this.stop();
    await this.start();
  }

  async monitorHealth(): Promise<HealthStatus> {
    const timestamp = new Date();

    try {
      const processHealthy = !this.claudeCodeProcess.killed;
      const proxyStatus = this.proxyManager.getStatus();
      const overall = processHealthy && proxyStatus.active && this.isRunning;

      return {
        healthy: overall,
        timestamp,
        details: {},
      };
    } catch (error) {
      return {
        healthy: false,
        timestamp,
        details: {},
      };
    }
  }

  async handleShutdown(): Promise<void> {
    console.log('Handling graceful shutdown...');
    await this.stop();
  }
}
