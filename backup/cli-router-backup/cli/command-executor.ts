/**
 * CLI命令执行器实现
 * 
 * 实现CLI命令的具体执行逻辑，与服务器模块解耦
 */

import { 
  ICommandExecutor, 
  IServerController, 
  IConfigManager, 
  IClientProxy,
  IProcessManager,
  IEnvironmentExporter,
  ServerStartConfig, 
  ServerStopConfig, 
  ServerStatusConfig,
  ClientProxyConfig,
  ConfigAction 
} from '../interfaces/core/cli-abstraction';

/**
 * CLI命令执行器实现
 */
export class CommandExecutor implements ICommandExecutor {
  private serverController: IServerController;
  private configManager: IConfigManager;
  private clientProxy: IClientProxy;
  private processManager: IProcessManager;
  private envExporter: IEnvironmentExporter;

  constructor(
    serverController: IServerController,
    configManager: IConfigManager,
    clientProxy: IClientProxy,
    processManager: IProcessManager,
    envExporter: IEnvironmentExporter
  ) {
    this.serverController = serverController;
    this.configManager = configManager;
    this.clientProxy = clientProxy;
    this.processManager = processManager;
    this.envExporter = envExporter;
  }

  /**
   * 执行启动命令
   */
  async executeStart(config: ServerStartConfig): Promise<void> {
    console.log('🚀 Starting RCC server...');
    
    try {
      // 检查端口是否已被占用
      const port = config.port || 3456;
      const isRunning = await this.serverController.isRunning(port);
      
      if (isRunning) {
        console.log(`⚠️  Server is already running on port ${port}`);
        console.log('Use "rcc status" to check server status');
        return;
      }

      // 加载配置
      let serverConfig = config;
      if (config.configPath) {
        console.log(`📋 Loading configuration from ${config.configPath}...`);
        const loadedConfig = await this.configManager.loadConfig(config.configPath);
        
        // 验证配置
        const validation = this.configManager.validateConfig(loadedConfig);
        if (!validation.valid) {
          console.error('❌ Configuration validation failed:');
          validation.errors.forEach(error => console.error(`   ${error}`));
          throw new Error('Invalid configuration');
        }
        
        if (validation.warnings.length > 0) {
          console.warn('⚠️  Configuration warnings:');
          validation.warnings.forEach(warning => console.warn(`   ${warning}`));
        }
        
        // 合并配置
        serverConfig = { ...loadedConfig, ...config };
      }

      // 启动服务器
      const result = await this.serverController.start(serverConfig);
      
      if (result.success) {
        console.log(`✅ Server started successfully`);
        console.log(`🌐 Listening on http://${result.host}:${result.port}`);
        if (result.pid) {
          console.log(`🔢 Process ID: ${result.pid}`);
        }
        
        if (config.debug) {
          console.log('🐛 Debug mode enabled - detailed logs will be shown');
        }
        
        // 显示服务端点信息
        this.showServerEndpoints(result.port);
        
      } else {
        console.error('❌ Failed to start server');
        if (result.message) {
          console.error(`   ${result.message}`);
        }
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Server startup failed:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  /**
   * 执行停止命令
   */
  async executeStop(config: ServerStopConfig): Promise<void> {
    console.log('🛑 Stopping RCC server...');
    
    try {
      const port = config.port || 3456;
      
      // 检查服务器是否运行
      const isRunning = await this.serverController.isRunning(port);
      if (!isRunning) {
        console.log(`ℹ️  No server running on port ${port}`);
        return;
      }

      // 尝试优雅停止
      const result = await this.serverController.stop(config);
      
      if (result.success) {
        console.log('✅ Server stopped successfully');
      } else {
        console.warn('⚠️  Graceful shutdown failed, attempting force stop...');
        
        if (config.force) {
          // 强制停止
          const processInfo = await this.processManager.findProcess(port);
          if (processInfo) {
            const killed = await this.processManager.killProcess(processInfo.pid, true);
            if (killed) {
              console.log('✅ Server force stopped');
            } else {
              console.error('❌ Failed to force stop server');
              process.exit(1);
            }
          }
        } else {
          console.error('❌ Failed to stop server. Use --force to force shutdown.');
          process.exit(1);
        }
      }
      
    } catch (error) {
      console.error('❌ Server stop failed:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  /**
   * 执行状态命令
   */
  async executeStatus(config: ServerStatusConfig): Promise<void> {
    console.log('📊 Checking server status...');
    
    try {
      const result = await this.serverController.getStatus(config);
      
      if (result.running) {
        console.log('✅ Server is running');
        console.log(`🌐 Address: http://${result.host}:${result.port}`);
        
        if (result.pid) {
          console.log(`🔢 Process ID: ${result.pid}`);
        }
        
        if (result.uptime) {
          console.log(`⏱️  Uptime: ${this.formatUptime(result.uptime)}`);
        }
        
        if (config.detailed) {
          this.showDetailedStatus(result);
        }
        
      } else {
        console.log('❌ Server is not running');
        
        // 检查端口是否被其他进程占用
        const port = config.port || 3456;
        const isPortInUse = await this.processManager.isPortInUse(port);
        if (isPortInUse) {
          const processInfo = await this.processManager.findProcess(port);
          if (processInfo) {
            console.log(`⚠️  Port ${port} is occupied by process ${processInfo.pid} (${processInfo.name})`);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Status check failed:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  /**
   * 执行客户端代理命令
   */
  async executeCode(config: ClientProxyConfig): Promise<void> {
    console.log('🔗 Starting Claude Code client mode...');
    
    try {
      // 检查服务器是否运行
      const serverPort = config.serverPort || 3456;
      const serverHost = config.serverHost || 'localhost';
      const isRunning = await this.serverController.isRunning(serverPort);
      
      if (!isRunning) {
        if (config.autoStart) {
          console.log('🚀 Server not running, auto-starting...');
          await this.executeStart({ 
            port: serverPort, 
            host: serverHost 
          });
        } else {
          console.error(`❌ Server is not running on ${serverHost}:${serverPort}`);
          console.log('Use "rcc start" to start the server, or use --auto-start flag');
          process.exit(1);
        }
      }

      // 启动客户端代理
      await this.clientProxy.start(config);
      
      const status = this.clientProxy.getProxyStatus();
      console.log('✅ Client proxy started');
      console.log(`🔗 Connected to server: ${status.serverEndpoint}`);
      
      if (config.transparent) {
        console.log('👻 Transparent proxy mode enabled');
      }
      
      if (config.exportEnv) {
        console.log('\n📋 Environment variables to export:');
        const envCommands = this.envExporter.exportProxySettings(config);
        console.log(envCommands);
        
        console.log('\nCopy and run the commands above to configure your shell.');
      }
      
      // 保持运行状态
      console.log('\n📡 Client proxy is running. Press Ctrl+C to stop.');
      
      process.on('SIGINT', async () => {
        console.log('\n🛑 Stopping client proxy...');
        await this.clientProxy.stop();
        console.log('✅ Client proxy stopped');
        process.exit(0);
      });
      
    } catch (error) {
      console.error('❌ Client mode failed:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  /**
   * 执行配置命令
   */
  async executeConfig(action: ConfigAction, options: any): Promise<void> {
    console.log(`⚙️  Managing configuration: ${action}`);
    
    try {
      switch (action) {
        case 'list':
          await this.listConfigurations();
          break;
          
        case 'validate':
          await this.validateConfiguration(options.path);
          break;
          
        case 'reset':
          await this.resetConfiguration();
          break;
          
        case 'show':
          await this.showConfiguration(options.path);
          break;
          
        default:
          throw new Error(`Unknown config action: ${action}`);
      }
      
    } catch (error) {
      console.error('❌ Configuration management failed:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  /**
   * 显示服务器端点信息
   */
  private showServerEndpoints(port: number): void {
    console.log('\n📡 Available endpoints:');
    console.log(`   Anthropic API: http://localhost:${port}/v1/messages`);
    console.log(`   OpenAI API:    http://localhost:${port}/v1/chat/completions`);
    console.log(`   Server Status: http://localhost:${port}/v1/status`);
    console.log(`   Pipeline Mgmt: http://localhost:${port}/v1/pipelines`);
  }

  /**
   * 显示详细状态信息
   */
  private showDetailedStatus(status: any): void {
    console.log('\n📊 Detailed Status:');
    
    if (status.health) {
      console.log(`🏥 Health: ${status.health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
      if (status.health.checks?.length > 0) {
        console.log('   Health checks:');
        status.health.checks.forEach((check: any) => {
          const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
          console.log(`     ${icon} ${check.name}: ${check.message || check.status} (${check.duration}ms)`);
        });
      }
    }
    
    if (status.pipelines) {
      console.log(`🔧 Pipelines: ${status.pipelines.running}/${status.pipelines.total} running`);
      if (status.pipelines.error > 0) {
        console.log(`   ❌ ${status.pipelines.error} pipelines in error state`);
      }
    }
    
    if (status.memory) {
      const memMB = Math.round(status.memory.rss / 1024 / 1024);
      const heapMB = Math.round(status.memory.heapUsed / 1024 / 1024);
      console.log(`💾 Memory: ${memMB}MB RSS, ${heapMB}MB heap`);
    }
    
    if (status.requests) {
      console.log(`📈 Requests: ${status.requests.total} total, ${status.requests.requestsPerSecond.toFixed(1)}/sec`);
      console.log(`   ✅ Success: ${status.requests.successful}, ❌ Failed: ${status.requests.failed}`);
      console.log(`   ⏱️  Avg response: ${status.requests.averageResponseTime.toFixed(0)}ms`);
    }
  }

  /**
   * 格式化运行时间
   */
  private formatUptime(uptime: number): string {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * 列出配置文件
   */
  private async listConfigurations(): Promise<void> {
    const configs = await this.configManager.listConfigs();
    
    console.log('📋 Available configurations:');
    console.log(`   Default: ${this.configManager.getDefaultConfigPath()}`);
    console.log(`   User:    ${this.configManager.getUserConfigPath()}`);
    
    if (configs.length > 0) {
      console.log('\n   Custom configurations:');
      configs.forEach((config, index) => {
        console.log(`   ${index + 1}. ${config}`);
      });
    } else {
      console.log('\n   No custom configurations found');
    }
  }

  /**
   * 验证配置文件
   */
  private async validateConfiguration(path?: string): Promise<void> {
    const configPath = path || this.configManager.getDefaultConfigPath();
    console.log(`🔍 Validating configuration: ${configPath}`);
    
    const config = await this.configManager.loadConfig(configPath);
    const validation = this.configManager.validateConfig(config);
    
    if (validation.valid) {
      console.log('✅ Configuration is valid');
      
      if (validation.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        validation.warnings.forEach(warning => console.log(`   ${warning}`));
      }
      
      if (validation.suggestions && validation.suggestions.length > 0) {
        console.log('\n💡 Suggestions:');
        validation.suggestions.forEach(suggestion => console.log(`   ${suggestion}`));
      }
      
    } else {
      console.log('❌ Configuration is invalid');
      console.log('\nErrors:');
      validation.errors.forEach(error => console.log(`   ${error}`));
      process.exit(1);
    }
  }

  /**
   * 重置配置文件
   */
  private async resetConfiguration(): Promise<void> {
    console.log('🔄 Resetting configuration to defaults...');
    await this.configManager.resetConfig();
    console.log('✅ Configuration reset completed');
    console.log(`📁 Default configuration restored to: ${this.configManager.getDefaultConfigPath()}`);
  }

  /**
   * 显示配置文件内容
   */
  private async showConfiguration(path?: string): Promise<void> {
    const configPath = path || this.configManager.getDefaultConfigPath();
    console.log(`📋 Configuration: ${configPath}`);
    
    const config = await this.configManager.loadConfig(configPath);
    console.log(JSON.stringify(config, null, 2));
  }
}