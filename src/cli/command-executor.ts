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
  ConfigAction,
} from '../interfaces/core/cli-abstraction';
import { ERROR_MESSAGES } from '../constants/error-messages';
import { JQJsonHandler } from '../utils/jq-json-handler';
import { getProviderRequestTimeout } from '../constants/timeout-defaults';

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
          throw new Error(ERROR_MESSAGES.CONFIG_VALIDATION_FAILED);
        }

        if (validation.warnings.length > 0) {
          console.warn('⚠️  Configuration warnings:');
          validation.warnings.forEach(warning => console.warn(`   ${warning}`));
        }

        // 合并配置 - 正确提取server配置
        serverConfig = { 
          ...config, // CLI参数优先
          port: config.port || loadedConfig.server?.port || 3456,
          host: config.host || loadedConfig.server?.host || 'localhost',
          debug: config.debug || loadedConfig.server?.debug || false,
          configPath: config.configPath
        };
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
            host: serverHost,
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
   * 执行认证命令
   */
  async executeAuth(provider: string, index?: number, options?: any): Promise<void> {
    console.log(`🔐 Managing authentication for ${provider}...`);

    try {
      // 动态导入认证管理器
      const authManagerClass = await this.loadAuthManager(provider);
      const authManager = new authManagerClass();

      // 处理不同的认证操作
      if (options?.list) {
        await authManager.listAuthFiles();
        return;
      }

      if (options?.remove && index) {
        await authManager.removeAuthFile(index);
        return;
      }

      if (options?.refresh && index) {
        await authManager.refreshAuthFile(index);
        return;
      }

      // 默认认证流程
      if (!index) {
        throw new Error('Index is required for authentication. Usage: rcc4 auth <provider> <index>');
      }

      await authManager.authenticate(index);

    } catch (error) {
      console.error('❌ Authentication failed:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  /**
   * 动态加载认证管理器
   */
  private async loadAuthManager(provider: string): Promise<any> {
    switch (provider.toLowerCase()) {
      case 'qwen':
        const { QwenAuthManager } = await import('../cli/auth/qwen-auth-manager');
        return QwenAuthManager;
      case 'gemini':
        throw new Error('Gemini authentication not yet implemented');
      case 'claude':
        throw new Error('Claude authentication not yet implemented');
      default:
        throw new Error(`Unsupported provider: ${provider}`);
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
    console.log(JQJsonHandler.stringifyJson(config, true));
  }

  /**
   * 执行Provider更新命令
   */
  async executeProviderUpdate(options: any): Promise<void> {
    console.log('🔄 Updating provider models and capabilities...');

    try {
      // 检查是否提供了配置文件路径
      if (!options.config) {
        console.error('❌ Configuration file path is required. Use --config <path>');
        process.exit(1);
      }

      // 加载配置文件
      console.log(`📋 Loading configuration from ${options.config}...`);
      const config = await this.configManager.loadConfig(options.config);
      
      // 验证配置
      const validation = this.configManager.validateConfig(config);
      if (!validation.valid) {
        console.error('❌ Configuration validation failed:');
        validation.errors.forEach(error => console.error(`   ${error}`));
        process.exit(1);
      }

      // 获取启用的Providers
      const enabledProviders = this.getEnabledProviders(config);
      if (enabledProviders.length === 0) {
        console.log('⚠️  No enabled providers found in configuration');
        return;
      }

      console.log(`🔍 Found ${enabledProviders.length} enabled provider(s)`);

      // 处理每个Provider
      let successCount = 0;
      let failureCount = 0;
      for (const provider of enabledProviders) {
        try {
          await this.updateProviderModels(provider, options, config, options.config);
          successCount++;
        } catch (error) {
          console.error(`❌ Failed to update provider ${provider.name}:`, error instanceof Error ? error.message : 'Unknown error');
          failureCount++;
        }
      }

      console.log(`\n📊 Provider Update Summary:`);
      console.log(`   ✅ Successful: ${successCount}`);
      console.log(`   ❌ Failed: ${failureCount}`);
      console.log(`   📊 Total: ${enabledProviders.length}`);

      if (failureCount > 0) {
        console.warn('⚠️  Some providers failed to update. Check the errors above for details.');
      } else {
        console.log('✅ All providers updated successfully');
      }
    } catch (error) {
      console.error('❌ Provider update failed:', error instanceof Error ? error.message : 'Unknown error');
      if (options.verbose) {
        console.error('   Stack trace:', (error as Error).stack);
      }
      process.exit(1);
    }
  }

  /**
   * 获取启用的Providers
   */
  private getEnabledProviders(config: any): any[] {
    const providers: any[] = [];

    // 新配置格式：Providers数组
    if (config.Providers && Array.isArray(config.Providers)) {
      for (const provider of config.Providers) {
        // 所有在Providers数组中的provider都被认为是启用的
        providers.push({
          ...provider,
          name: provider.name,
          type: provider.protocol || 'openai', // 默认使用openai协议
          api_base_url: provider.api_base_url,
          api_key: provider.api_key,
          models: provider.models || [],
          serverCompatibility: provider.serverCompatibility,
          priority: provider.priority || 999
        });
      }
    } else {
      // 旧配置格式兼容性支持
      // 添加Server-Compatibility Providers
      if (config.serverCompatibilityProviders) {
        for (const [name, provider] of Object.entries(config.serverCompatibilityProviders)) {
          if ((provider as any).enabled) {
            providers.push({
              ...(provider as any),
              name,
              type: 'server-compatibility'
            });
          }
        }
      }

      // 添加Standard Providers
      if (config.standardProviders) {
        for (const [name, provider] of Object.entries(config.standardProviders)) {
          if ((provider as any).enabled) {
            providers.push({
              ...(provider as any),
              name,
              type: 'standard'
            });
          }
        }
      }
    }

    // 按优先级排序
    providers.sort((a, b) => (a.priority || 999) - (b.priority || 999));

    return providers;
  }

  /**
   * 更新Provider模型
   */
  private async updateProviderModels(provider: any, options: any, config: any, configPath: string): Promise<void> {
    console.log(`\n🔄 Updating models for provider: ${provider.name} (${provider.type})`);

    try {
      // 根据Provider类型和名称处理
      const providerType = provider.type || 'openai';
      
      if (providerType === 'openai' || provider.protocol === 'openai') {
        // 根据provider名称选择不同的处理方式
        switch (provider.name.toLowerCase()) {
          case 'qwen':
            await this.updateQwenModels(provider, options, config, configPath);
            break;
          case 'shuaihong':
            await this.updateShuaihongModels(provider, options, config, configPath);
            break;
          case 'modelscope':
            await this.updateModelScopeModels(provider, options, config, configPath);
            break;
          case 'lmstudio':
            await this.updateLMStudioModels(provider, options, config, configPath);
            break;
          default:
            await this.updateGenericOpenAIModels(provider, options, config, configPath);
            break;
        }
      } else if (providerType === 'gemini') {
        await this.updateGeminiModels(provider, options, config, configPath);
      } else {
        console.log(`⚠️  Unsupported provider type: ${providerType}`);
        throw new Error(`Unsupported provider type: ${providerType}`);
      }
    } catch (error) {
      console.error(`❌ Failed to update models for provider ${provider.name}:`, error instanceof Error ? error.message : 'Unknown error');
      if (options.verbose) {
        console.error('   Stack trace:', (error as Error).stack);
      }
      throw error; // 重新抛出错误以便上层处理
    }
  }

  /**
   * 更新Qwen模型
   */
  private async updateQwenModels(provider: any, options: any, config: any, configPath: string): Promise<void> {
    console.log(`🔍 Updating Qwen models for provider: ${provider.name}`);
    
    const qwenModels = [
      'qwen3-coder-plus',
      'qwen3-coder-flash',
      'qwen-max',
      'qwen-plus',
      'qwen-turbo',
      'qwen-long',
      'qwen2.5-72b-instruct',
      'qwen2.5-32b-instruct',
      'qwen2.5-14b-instruct',
      'qwen2.5-7b-instruct',
      'qwen2.5-coder-32b-instruct',
      'qwen2.5-coder-14b-instruct',
      'qwen2.5-coder-7b-instruct',
      'qwq-32b-preview'
    ];

    const modelInfo = qwenModels.map(model => ({
      id: model,
      // 🔧 架构修复：移除CLI层maxTokens硬编码，由ServerCompatibility层处理
      supported: true
    }));

    await this.updateProviderConfigModels(config, configPath, provider.name, modelInfo, options);
  }

  /**
   * 更新Shuaihong模型
   */
  private async updateShuaihongModels(provider: any, options: any, config: any, configPath: string): Promise<void> {
    console.log(`🔍 Updating Shuaihong models for provider: ${provider.name}`);
    
    // 如果选择API获取模式，尝试从Shuaihong API获取模型列表
    if (options.apiFetch) {
      try {
        console.log('📡 Fetching model list from Shuaihong API...');
        const response = await fetch(`${provider.api_base_url}/models`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${provider.api_key}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const models = data.data || [];
          console.log(`✅ Found ${models.length} models from Shuaihong API`);
          
          // 过滤聊天模型
          const chatModels = models.filter((model: any) => 
            this.isChatModel(model.id) && !this.isEmbeddingModel(model.id)
          );
          
          console.log(`💬 Found ${chatModels.length} chat models after filtering`);
          
          const modelInfo = chatModels.map((model: any) => ({
            id: model.id,
            // 🔧 架构修复：移除CLI层maxTokens处理，由ServerCompatibility层负责
            supported: true
          }));
          
          await this.updateProviderConfigModels(config, configPath, provider.name, modelInfo, options);
          return;
        } else {
          console.warn(`⚠️ Shuaihong API returned status ${response.status}, falling back to static list`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to fetch from Shuaihong API: ${error instanceof Error ? error.message : 'Unknown error'}, falling back to static list`);
      }
    }
    
    // 静态模型列表作为fallback - 基于实际支持的模型
    const shuaihongModels = [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4',
      'gpt-3.5-turbo',
      'claude-3.5-sonnet',
      'claude-3-haiku',
      'gemini-pro',
      'gemini-2.5-flash',
      'deepseek-v3.1',
      'deepseek-r1'
    ];

    const modelInfo = shuaihongModels.map(model => ({
      id: model,
      // 🔧 架构修复：移除CLI层maxTokens处理，由ServerCompatibility层负责
      supported: true
    }));

    await this.updateProviderConfigModels(config, configPath, provider.name, modelInfo, options);
  }

  /**
   * 更新ModelScope模型
   */
  private async updateModelScopeModels(provider: any, options: any, config: any, configPath: string): Promise<void> {
    console.log(`🔍 Updating ModelScope models for provider: ${provider.name}`);
    
    const modelscopeModels = [
      'qwen3-480b',
      'qwen2.5-72b-instruct',
      'qwen2.5-32b-instruct', 
      'llama3.1-405b-instruct',
      'llama3.1-70b-instruct',
      'deepseek-v2.5-chat'
    ];

    const modelInfo = modelscopeModels.map(model => ({
      id: model,
      // 🔧 架构修复：移除CLI层maxTokens硬编码，由ServerCompatibility层处理
      supported: true
    }));

    await this.updateProviderConfigModels(config, configPath, provider.name, modelInfo, options);
  }

  /**
   * 更新LM Studio模型
   */
  private async updateLMStudioModels(provider: any, options: any, config: any, configPath: string): Promise<void> {
    console.log(`🔍 Updating LM Studio models for provider: ${provider.name}`);
    
    // 如果选择API获取模式，尝试从LM Studio API获取模型列表
    if (options.apiFetch) {
      try {
        console.log('📡 Fetching model list from LM Studio API...');
        const response = await fetch(`${provider.api_base_url}/models`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${provider.api_key}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const models = data.data || [];
          console.log(`✅ Found ${models.length} models from LM Studio API`);
          
          // 过滤聊天模型，排除embedding和其他非聊天模型
          const chatModels = models.filter((model: any) => 
            this.isChatModel(model.id) && !this.isEmbeddingModel(model.id)
          );
          
          console.log(`💬 Found ${chatModels.length} chat models after filtering`);
          
          const modelInfo = chatModels.map((model: any) => ({
            id: model.id,
            // 🔧 架构修复：移除CLI层maxTokens硬编码，由ServerCompatibility层处理
            supported: true
          }));
          
          await this.updateProviderConfigModels(config, configPath, provider.name, modelInfo, options);
          return;
        } else {
          console.warn(`⚠️ LM Studio API returned status ${response.status}, falling back to static list`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to fetch from LM Studio API: ${error instanceof Error ? error.message : 'Unknown error'}, falling back to static list`);
      }
    }
    
    // 静态模型列表作为fallback
    const lmstudioChatModels = [
      'gpt-oss-20b-mlx',
      'qwen3-30b-a3b-instruct-2507-mlx',
      'nextcoder-32b-mlx',
      'seed-oss-36b-instruct',
      'glm-4.5v',
      'qwen3-4b-thinking-2507-mlx',
      'gemma-3n-e2b-it-mlx'
    ];

    const modelInfo = lmstudioChatModels.map(model => ({
      id: model,
      // 🔧 架构修复：移除CLI层maxTokens硬编码，由ServerCompatibility层处理
      supported: true
    }));

    await this.updateProviderConfigModels(config, configPath, provider.name, modelInfo, options);
  }

  /**
   * 更新通用OpenAI模型
   */
  private async updateGenericOpenAIModels(provider: any, options: any, config: any, configPath: string): Promise<void> {
    console.log(`🔍 Detecting OpenAI models for provider: ${provider.name}`);
    
    try {
      // 检查API密钥
      const apiKey = provider.auth?.apiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key is required but not provided');
      }
      
      // 创建OpenAI客户端
      const OpenAI = require('openai');
      const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: provider.endpoint,
        timeout: getProviderRequestTimeout(provider.connection?.timeout),
        maxRetries: provider.connection?.retries || 3,
      });

      // 获取模型列表
      console.log('📡 Fetching model list from OpenAI API...');
      const modelsResponse = await openai.models.list();
      const models = modelsResponse.data || [];
      
      console.log(`✅ Found ${models.length} models`);
      
      // 过滤聊天模型
      const chatModels = models.filter((model: any) => 
        model.id.includes('gpt') || model.id.includes('chat')
      );
      
      console.log(`💬 Found ${chatModels.length} chat models`);
      
      // 测试每个模型的max_tokens
      const modelInfo: any[] = [];
      let testedCount = 0;
      let supportedCount = 0;
      for (const model of chatModels) {
        try {
          console.log(`🧪 Testing model: ${model.id}`);
          testedCount++;
          const maxTokens = await this.testModelMaxTokens(openai, model.id, options);
          
          // 只有支持的模型才添加到列表中
          if (maxTokens > 0) {
            modelInfo.push({
              id: model.id,
              maxTokens,
              supported: true
            });
            supportedCount++;
            console.log(`   ✅ Model ${model.id} supports ${maxTokens} tokens`);
          } else {
            console.log(`   ❌ Model ${model.id} does not support any tested token limits`);
          }
        } catch (error) {
          console.warn(`⚠���  Failed to test model ${model.id}:`, error instanceof Error ? error.message : 'Unknown error');
          if (options.verbose) {
            console.warn('   Stack trace:', (error as Error).stack);
          }
        }
      }
      
      // 显示结果
      console.log('\n📊 Model Test Results:');
      console.log(`   🧪 Tested: ${testedCount}`);
      console.log(`   ✅ Supported: ${supportedCount}`);
      console.log(`   ❌ Unsupported: ${testedCount - supportedCount}`);
      
      for (const model of modelInfo) {
        console.log(`   ✅ ${model.id}: max_tokens=${model.maxTokens}`);
      }
      
      // 保存到配置（如果需要）
      if (!options.dryRun && modelInfo.length > 0) {
        console.log('💾 Updating configuration with model information...');
        await this.updateProviderConfig(config, configPath, provider.name, modelInfo);
      } else if (options.dryRun) {
        console.log('📝 Dry run mode - configuration not updated');
      } else if (modelInfo.length === 0) {
        console.log('⚠️  No supported models found - configuration not updated');
      }
      
    } catch (error) {
      console.error(`❌ Failed to detect OpenAI models:`, error instanceof Error ? error.message : 'Unknown error');
      if (options.verbose) {
        console.error('   Stack trace:', (error as Error).stack);
      }
      throw error; // 重新抛出错误以便上层处理
    }
  }
  
  /**
   * 测试模型的max_tokens限制
   */
  private async testModelMaxTokens(openai: any, modelId: string, options: any): Promise<number> {
    // 从大往小测试，成功就中止
    const testTokensList = [524288, 262144, 131072, 65536]; // 512k, 256k, 128k, 64k
    
    console.log(`   🔍 Testing max_tokens values: ${testTokensList.join(', ')}`);
    
    for (const testTokens of testTokensList) {
      try {
        await openai.chat.completions.create({
          model: modelId,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: testTokens
        });
        
        console.log(`   ✅ Model supports ${testTokens} tokens`);
        return testTokens;
      } catch (error) {
        // 检查错误类型，如果是API限制错误则继续测试，否则抛出错误
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('token') || errorMessage.includes('limit') || errorMessage.includes('429')) {
          console.log(`   ❌ Model does not support ${testTokens} tokens (API limit or token error)`);
        } else {
          console.log(`   ❌ Model does not support ${testTokens} tokens (${errorMessage})`);
          // 对于非API限制错误，我们可能需要重新抛出
          if (options.verbose) {
            console.warn(`   Detailed error for ${modelId}:`, errorMessage);
          }
        }
      }
      
      // 添加延迟避免API限制
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return 0; // 不支持任何测试的值
  }

  /**
   * 更新Gemini模型
   */
  private async updateGeminiModels(provider: any, options: any, config: any, configPath: string): Promise<void> {
    console.log(`🔍 Detecting Gemini models for provider: ${provider.name}`);
    
    try {
      // 检查API密钥
      const apiKey = provider.auth?.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key is required but not provided');
      }
      
      // 创建Google Generative AI客户端
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // 注意：Google Generative AI SDK没有直接列出模型的方法
      // 我们需要测试常见的Gemini模型
      const commonModels = [
        'gemini-pro',
        'gemini-pro-vision',
        'gemini-1.0-pro',
        'gemini-1.0-pro-vision',
        'gemini-1.5-pro',
        'gemini-1.5-flash'
      ];
      
      console.log('📡 Testing common Gemini models...');
      
      const modelInfo: any[] = [];
      let testedCount = 0;
      let supportedCount = 0;
      for (const modelId of commonModels) {
        try {
          console.log(`🧪 Testing model: ${modelId}`);
          testedCount++;
          const maxTokens = await this.testGeminiModelMaxTokens(genAI, modelId, options);
          
          // 只有支持的模型才添加到列表中
          if (maxTokens > 0) {
            modelInfo.push({
              id: modelId,
              maxTokens,
              supported: true
            });
            supportedCount++;
            console.log(`   ✅ Model ${modelId} supports ${maxTokens} tokens`);
          } else {
            console.log(`   ❌ Model ${modelId} does not support any tested token limits`);
          }
        } catch (error) {
          console.warn(`⚠️  Failed to test model ${modelId}:`, error instanceof Error ? error.message : 'Unknown error');
          if (options.verbose) {
            console.warn('   Stack trace:', (error as Error).stack);
          }
        }
      }
      
      // 显示结果
      console.log('\n📊 Model Test Results:');
      console.log(`   🧪 Tested: ${testedCount}`);
      console.log(`   ✅ Supported: ${supportedCount}`);
      console.log(`   ❌ Unsupported: ${testedCount - supportedCount}`);
      
      for (const model of modelInfo) {
        console.log(`   ✅ ${model.id}: max_tokens=${model.maxTokens}`);
      }
      
      // 保存到配置（如果需要）
      if (!options.dryRun && modelInfo.length > 0) {
        console.log('💾 Updating configuration with model information...');
        await this.updateProviderConfig(config, configPath, provider.name, modelInfo);
      } else if (options.dryRun) {
        console.log('📝 Dry run mode - configuration not updated');
      } else if (modelInfo.length === 0) {
        console.log('⚠️  No supported models found - configuration not updated');
      }
      
    } catch (error) {
      console.error(`❌ Failed to detect Gemini models:`, error instanceof Error ? error.message : 'Unknown error');
      if (options.verbose) {
        console.error('   Stack trace:', (error as Error).stack);
      }
      throw error; // 重新抛出错误以便上层处理
    }
  }
  
  /**
   * 更新Provider配置中的模型列表（新配置格式）
   */
  private async updateProviderConfigModels(config: any, configPath: string, providerName: string, modelInfo: any[], options: any): Promise<void> {
    try {
      console.log(`💾 Updating models for provider ${providerName}...`);
      
      if (options.dryRun) {
        console.log('📝 Dry run mode - showing what would be updated:');
        console.log(`   Provider: ${providerName}`);
        console.log(`   Models: ${modelInfo.map(m => m.id).join(', ')}`);
        console.log(`   Max tokens: ${modelInfo[0]?.maxTokens || 'N/A'}`);
        return;
      }

      // 读取原始配置文件内容
      const fs = require('fs');
      const rawConfig = fs.readFileSync(configPath, 'utf8');
      
      // 解析配置文件
      const parsedConfig = JQJsonHandler.parseJsonString(rawConfig);
      
      // 更新Providers数组中对应provider的models列表
      let providerUpdated = false;
      if (parsedConfig.Providers && Array.isArray(parsedConfig.Providers)) {
        for (const provider of parsedConfig.Providers) {
          if (provider.name === providerName) {
            provider.models = modelInfo.map(m => m.id);
            providerUpdated = true;
            console.log(`✅ Updated ${modelInfo.length} models for provider ${providerName}`);
            break;
          }
        }
      }
      
      // 检查是否找到了Provider
      if (!providerUpdated) {
        throw new Error(`Provider '${providerName}' not found in configuration`);
      }
      
      // 写回配置文件（使用用户友好的格式化输出）
      const updatedConfig = JQJsonHandler.stringifyJson(parsedConfig, false);
      fs.writeFileSync(configPath, updatedConfig, 'utf8');
      
      console.log(`✅ Configuration file updated: ${configPath}`);
      
      if (options.verbose) {
        console.log(`📋 Updated models: ${modelInfo.map(m => `${m.id}(${m.maxTokens})`).join(', ')}`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to update configuration file:`, error instanceof Error ? error.message : 'Unknown error');
      if (error instanceof Error && error.message.includes('ENOENT')) {
        console.error('   Please check if the configuration file exists and is accessible');
      } else if (error instanceof Error && error.message.includes('EACCES')) {
        console.error('   Please check if you have write permissions for the configuration file');
      }
      throw error;
    }
  }

  /**
   * 更新Provider配置（旧格式兼容）
   */
  private async updateProviderConfig(config: any, configPath: string, providerName: string, modelInfo: any[]): Promise<void> {
    try {
      // 读取原始配置文件内容
      const fs = require('fs');
      const rawConfig = fs.readFileSync(configPath, 'utf8');
      
      // 解析配置文件
      let parsedConfig: any;
      if (configPath.endsWith('.json')) {
        parsedConfig = JQJsonHandler.parseJsonString(rawConfig);
      } else {
        // 支持JSON5格式
        const JSON5 = require('json5');
        parsedConfig = JSON5.parse(rawConfig);
      }
      
      // 更新Provider的模型信息
      let providerUpdated = false;
      if (parsedConfig.standardProviders && parsedConfig.standardProviders[providerName]) {
        // 更新标准Provider
        const provider = parsedConfig.standardProviders[providerName];
        if (!provider.models) {
          provider.models = {};
        }
        
        // 添加或更新模型信息
        for (const model of modelInfo) {
          provider.models[model.id] = {
            maxTokens: model.maxTokens,
            enabled: true
          };
        }
        providerUpdated = true;
      } else if (parsedConfig.serverCompatibilityProviders && parsedConfig.serverCompatibilityProviders[providerName]) {
        // 更新Server-Compatibility Provider
        const provider = parsedConfig.serverCompatibilityProviders[providerName];
        if (!provider.models) {
          provider.models = {};
        }
        
        // 添加或更新模型信息
        for (const model of modelInfo) {
          provider.models[model.id] = {
            maxTokens: model.maxTokens,
            enabled: true
          };
        }
        providerUpdated = true;
      }
      
      // 检查是否找到了Provider
      if (!providerUpdated) {
        throw new Error(`Provider '${providerName}' not found in configuration`);
      }
      
      // 写回配置文件
      let updatedConfig: string;
      if (configPath.endsWith('.json')) {
        updatedConfig = JQJsonHandler.stringifyJson(parsedConfig, false);
      } else {
        const JSON5 = require('json5');
        updatedConfig = JSON5.stringify(parsedConfig, null, 2);
      }
      
      fs.writeFileSync(configPath, updatedConfig, 'utf8');
      
      console.log(`✅ Configuration updated successfully for provider: ${providerName}`);
      console.log(`   Added/updated ${modelInfo.length} models`);
      
    } catch (error) {
      console.error(`❌ Failed to update configuration file:`, error instanceof Error ? error.message : 'Unknown error');
      if (error instanceof Error && error.message.includes('ENOENT')) {
        console.error('   Please check if the configuration file exists and is accessible');
      } else if (error instanceof Error && error.message.includes('EACCES')) {
        console.error('   Please check if you have write permissions for the configuration file');
      }
      throw error; // 重新抛出错误以便上层处理
    }
  }
  private async testGeminiModelMaxTokens(genAI: any, modelId: string, options: any): Promise<number> {
    // 从大往小测试，成功就中止
    const testTokensList = [524288, 262144, 131072, 65536]; // 512k, 256k, 128k, 64k
    
    console.log(`   🔍 Testing max_tokens values: ${testTokensList.join(', ')}`);
    
    for (const testTokens of testTokensList) {
      try {
        const model = genAI.getGenerativeModel({ model: modelId });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: 'test' }] }],
          generationConfig: {
            maxOutputTokens: testTokens
          }
        });
        
        console.log(`   ✅ Model supports ${testTokens} tokens`);
        return testTokens;
      } catch (error) {
        // 检查错误类型，如果是API限制错误则继续测试，否则抛出错误
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('token') || errorMessage.includes('limit') || errorMessage.includes('429')) {
          console.log(`   ❌ Model does not support ${testTokens} tokens (API limit or token error)`);
        } else {
          console.log(`   ❌ Model does not support ${testTokens} tokens (${errorMessage})`);
          // 对于非API限制错误，我们可能需要重新抛出
          if (options.verbose) {
            console.warn(`   Detailed error for ${modelId}:`, errorMessage);
          }
        }
      }
      
      // 添加延迟避免API限制
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return 0; // 不支持任何测试的值
  }

  /**
   * 判断是否为聊天模型
   */
  private isChatModel(modelId: string): boolean {
    // 🔧 修复：改为排除明确不是聊天模型的，而不是匹配聊天模型关键词
    // 只排除明确知道的非聊天模型类型
    const modelLower = modelId.toLowerCase();
    
    // 首先排除embedding模型
    if (this.isEmbeddingModel(modelId)) {
      return false;
    }
    
    // 排除其他明确的非聊天模型类型
    const nonChatKeywords = [
      'reranker',          // 重排序模型
      'image-generation',  // 图片生成模型
      'tts',              // 语音合成
      'stt',              // 语音转文字
      'whisper'           // 语音模型
    ];
    
    // 如果包含非聊天关键词，则不是聊天模型
    if (nonChatKeywords.some(keyword => modelLower.includes(keyword))) {
      return false;
    }
    
    // 其他所有模型默认认为是聊天模型
    return true;
  }

  /**
   * 判断是否为embedding模型
   */
  private isEmbeddingModel(modelId: string): boolean {
    const embeddingKeywords = [
      'bge', 'e5', 'embed', 'sentence', 'retrieval', 'similarity',
      'vector', 'semantic', 'text-embedding'
    ];
    
    const modelLower = modelId.toLowerCase();
    return embeddingKeywords.some(keyword => modelLower.includes(keyword));
  }

  /**
   * 🔧 架构修复：移除CLI层maxTokens处理函数
   * maxTokens应该在ServerCompatibility层处理，而不是CLI层
   * CLI层只负责模型发现和配置管理，不应该包含模型能力的硬编码逻辑
   */
}
