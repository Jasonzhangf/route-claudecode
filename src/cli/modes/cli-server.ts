import {
  CLIModeInterface,
  ServerModeOptions,
  ModeStatus,
  HealthStatus,
  ServerHealth,
  ConnectionHealth,
  ProviderConnectionStatus,
} from './mode-interface';
import { PipelineServer } from '../../server/pipeline-server';
import { ConfigManager } from '../../config/config-manager';
import { ErrorHandler } from '../../middleware/error-handler';
import { DebugManagerImpl as DebugManager } from '../../debug/debug-manager';
import { FlowControlManager } from '../../router/session-control/flow-control-manager';

export class ServerMode implements CLIModeInterface {
  public readonly name = 'server';
  public readonly description = 'Run RCC as HTTP server';

  private server?: PipelineServer;
  private configManager?: ConfigManager;
  private debugManager?: DebugManager;
  private flowControlManager?: FlowControlManager;
  private startTime?: Date;
  private isRunning = false;
  private currentOptions?: ServerModeOptions;

  async start(options: ServerModeOptions): Promise<void> {
    try {
      this.currentOptions = options;
      this.startTime = new Date();

      console.log(`Starting RCC Server on port ${options.port}...`);

      // 1. 初始化配置管理器
      console.log('Loading configuration...');
      this.configManager = new ConfigManager();
      await this.configManager.loadConfig(options.config);

      // 2. 初始化Debug管理器
      if (options.debug) {
        console.log('Initializing debug system...');
        this.debugManager = new DebugManager();
        await this.debugManager.initialize(options.port);
      }

      // 3. 初始化会话流控管理器
      console.log('Initializing flow control system...');
      this.flowControlManager = new FlowControlManager(await this.configManager.getFlowControlConfig());

      // 4. 初始化HTTP服务器
      console.log('Starting HTTP server...');
      const serverConfig = {
        port: options.port,
        host: options.host || '0.0.0.0',
        pipelines: [], // TODO: 从配置加载pipeline
        enableAuth: false,
        enableValidation: true,
        enableCors: true,
        logLevel: 'info' as 'info',
        debug: options.debug || false,
        maxRequestSize: 10 * 1024 * 1024,
        timeout: 30000,
      };

      // TODO: 实现proper middleware manager
      const middlewareManager = {
        use: () => {},
        getMiddleware: () => null,
      } as any;

      this.server = new PipelineServer(serverConfig, middlewareManager);

      // 5. 启动服务器
      await this.server.start();

      this.isRunning = true;

      console.log(`✅ RCC Server started successfully on http://${options.host || 'localhost'}:${options.port}`);
      console.log('Press Ctrl+C to gracefully shutdown');

      // 6. 启动健康监控
      if (options.debug) {
        this.startHealthMonitoring();
      }

      // 7. 阻塞式运行，等待退出信号
      await this.waitForShutdown();
    } catch (error) {
      console.error('Failed to start server:', error);
      await this.cleanup();
      throw error;
    }
  }

  async stop(): Promise<void> {
    console.log('Stopping RCC Server...');
    await this.cleanup();
    console.log('✅ RCC Server stopped successfully');
  }

  getStatus(): ModeStatus {
    return {
      mode: this.name,
      isRunning: this.isRunning,
      pid: process.pid,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      port: this.currentOptions?.port,
      lastError: undefined,
    };
  }

  async healthCheck(): Promise<HealthStatus> {
    const timestamp = new Date();

    if (!this.isRunning || !this.server || !this.currentOptions) {
      return {
        healthy: false,
        timestamp,
        details: {},
      };
    }

    try {
      // 检查服务器健康状态
      const serverHealth = await this.checkServerHealth();

      // 检查连接健康状态
      const connectionHealth = await this.checkConnectionHealth();

      const healthy = serverHealth.listening && connectionHealth.errorRate < 0.1;

      return {
        healthy,
        timestamp,
        details: {
          server: serverHealth,
          connections: connectionHealth,
        },
      };
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        healthy: false,
        timestamp,
        details: {},
      };
    }
  }

  private async checkServerHealth(): Promise<ServerHealth> {
    if (!this.server || !this.currentOptions) {
      throw new Error('Server not initialized');
    }

    const memoryUsage = process.memoryUsage();
    const activeConnections = 0; // TODO: 实现连接计数

    return {
      listening: true, // TODO: 实现监听状态检查
      port: this.currentOptions.port,
      activeConnections,
      memoryUsage: memoryUsage.heapUsed / 1024 / 1024, // MB
    };
  }

  private async checkConnectionHealth(): Promise<ConnectionHealth> {
    if (!this.configManager) {
      throw new Error('Config manager not initialized');
    }

    // 获取Provider连接状态
    const providers = await this.configManager.getProviderConfigs();
    const providerStatuses: ProviderConnectionStatus[] = [];

    for (const provider of providers) {
      try {
        const startTime = Date.now();
        const isConnected = await this.checkProviderConnection(provider);
        const latency = Date.now() - startTime;

        providerStatuses.push({
          provider: provider.name,
          connected: isConnected,
          latency,
          lastCheck: new Date(),
        });
      } catch (error) {
        providerStatuses.push({
          provider: provider.name,
          connected: false,
          lastCheck: new Date(),
        });
      }
    }

    // 获取请求统计
    const metrics = {
      totalRequests: 0,
      errorCount: 0,
    }; // TODO: 实现实际的metrics收集

    const errorRate = metrics.totalRequests > 0 ? metrics.errorCount / metrics.totalRequests : 0;

    return {
      providers: providerStatuses,
      totalRequests: metrics.totalRequests,
      errorRate,
    };
  }

  private async checkProviderConnection(provider: any): Promise<boolean> {
    // 这里实现真实的Provider连接检查，不使用mockup
    try {
      // 使用实际的健康检查端点
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${provider.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.warn(`Provider ${provider.name} health check failed:`, error);
      return false;
    }
  }

  private startHealthMonitoring(): void {
    // 每30秒执行一次健康检查
    setInterval(async () => {
      try {
        const health = await this.healthCheck();
        if (!health.healthy) {
          console.warn('Health check failed:', health);
        } else if (this.debugManager) {
          console.log('Health check passed');
        }
      } catch (error) {
        console.error('Health monitoring error:', error);
      }
    }, 30000);
  }

  private async waitForShutdown(): Promise<void> {
    return new Promise(resolve => {
      // 等待进程退出信号
      const shutdownHandler = () => {
        resolve();
      };

      process.once('SIGINT', shutdownHandler);
      process.once('SIGTERM', shutdownHandler);
    });
  }

  private async cleanup(): Promise<void> {
    this.isRunning = false;

    try {
      // 停止服务器
      if (this.server) {
        await this.server.stop();
        this.server = undefined;
      }

      // 停止Debug管理器
      if (this.debugManager) {
        // TODO: 实现DebugManager的shutdown方法
        // await this.debugManager.shutdown();
        this.debugManager = undefined;
      }

      // 清理会话流控管理器
      if (this.flowControlManager) {
        await this.flowControlManager.shutdown();
        this.flowControlManager = undefined;
      }

      this.configManager = undefined;
      this.currentOptions = undefined;
      this.startTime = undefined;
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}
