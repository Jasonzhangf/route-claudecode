#!/usr/bin/env node

/**
 * RCC v4.0 CLI入口 - 使用完整的PipelineServer架构
 *
 * 这个文件使用真正的RCC v4.0流水线系统，支持完整的四层流水线debug记录
 *
 * @author Jason Zhang
 */

import { PipelineServer, PipelineServerConfig } from './server/pipeline-server';
import { PipelineService } from './server/pipeline-service';
import { MiddlewareFactory } from './middleware/middleware-factory';
import { DebugManager, DebugManagerImpl } from './debug/debug-manager';
import { ConfigManager } from './config/config-manager';
import { RCCv4Config } from './config/config-types';
import { PipelineManager } from './pipeline/pipeline-manager';
import { StandardPipelineFactoryImpl } from './pipeline/pipeline-factory';
import { ModuleRegistry } from './pipeline/module-registry';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

interface CLIArguments {
  command: string;
  configPath?: string;
  port?: number;
  debug?: boolean;
  host?: string;
  proxyPort?: number;
}

class RCCv4CLI {
  private server?: PipelineServer;
  private debugManager?: DebugManager;
  private configManager?: ConfigManager;

  constructor() {}

  /**
   * 解析CLI参数
   */
  private parseArguments(args: string[]): CLIArguments {
    const result: CLIArguments = {
      command: args[0] || 'help',
    };

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      switch (arg) {
        case '--config':
          if (nextArg && !nextArg.startsWith('--')) {
            result.configPath = nextArg;
            i++;
          }
          break;
        case '--port':
          if (nextArg && !nextArg.startsWith('--')) {
            result.port = parseInt(nextArg, 10);
            i++;
          }
          break;
        case '--host':
          if (nextArg && !nextArg.startsWith('--')) {
            result.host = nextArg;
            i++;
          }
          break;
        case '--debug':
          result.debug = true;
          break;
        case '--proxy-port':
          if (nextArg && !nextArg.startsWith('--')) {
            result.proxyPort = parseInt(nextArg, 10);
            i++;
          }
          break;
      }
    }

    return result;
  }

  /**
   * 加载并验证配置文件
   */
  private async loadConfig(configPath: string): Promise<RCCv4Config> {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent) as RCCv4Config;

    // 基础验证
    if (!config.serverCompatibilityProviders && !config.standardProviders) {
      throw new Error('Configuration must define at least one provider');
    }

    if (!config.routing || !config.routing.routes) {
      throw new Error('Configuration must define routing rules');
    }

    return config;
  }

  /**
   * 初始化Debug管理器
   */
  private async initializeDebugManager(port: number, config: RCCv4Config): Promise<DebugManager> {
    // 从配置获取debug设置
    const debugConfig = config.debug || {
      enabled: true,
      logLevel: 'info',
      traceRequests: true,
      saveRequests: true,
      enableRecording: true,
      enableAuditTrail: true,
      enableReplay: true,
      enablePerformanceMetrics: true,
      modules: {
        client: { enabled: true, logLevel: 'info' },
        router: { enabled: true, logLevel: 'info' },
        pipeline: { enabled: true, logLevel: 'debug' },
        transformer: { enabled: true, logLevel: 'debug' },
        protocol: { enabled: true, logLevel: 'debug' },
        'server-compatibility': { enabled: true, logLevel: 'debug' },
        server: { enabled: true, logLevel: 'info' },
      },
    };

    const debugManager = new DebugManagerImpl({
      enabled: debugConfig.enabled,
      maxRecordSize: 10 * 1024 * 1024,
      maxSessionDuration: 24 * 60 * 60 * 1000,
      retentionDays: 7,
      compressionEnabled: true,
      storageBasePath: path.join(process.env.HOME || process.cwd(), '.route-claudecode', 'debug-logs'),
      modules: debugConfig.modules,
    });

    return debugManager;
  }

  /**
   * 初始化ConfigManager
   */
  private async initializeConfigManager(config: RCCv4Config): Promise<ConfigManager> {
    const configManager = new ConfigManager();
    // 设置配置对象（先不实现复杂的加载逻辑）
    (configManager as any).config = config;
    return configManager;
  }

  /**
   * 创建PipelineServer配置
   */
  private createPipelineServerConfig(config: RCCv4Config, args: CLIArguments): PipelineServerConfig {
    const serverConfig = config.server || {
      port: args.port || 5506,
      host: args.host || 'localhost',
    };

    // 从配置提取Pipeline配置
    const pipelineConfigs = config.routing.routes.map((route: any) => ({
      id: route.id,
      name: route.name || route.id,
      description: route.description || `Pipeline for ${route.id}`,
      provider: 'lmstudio-compatibility', // 从第一个可用provider提取
      model: 'gpt-oss-20b-mlx', // 默认模型
      modules: (route.pipeline.layers || []).map((layer: any, index: number) => ({
        id: `${layer.layer}-${index}`,
        moduleId: layer.moduleId,
        order: index,
        enabled: true,
        config: layer.config || {},
      })),
      settings: {
        parallel: false,
        failFast: true,
        timeout: config.routing.configuration?.requestTimeout || 120000,
        retryPolicy: {
          enabled: true,
          maxRetries: config.routing.configuration?.maxRetries || 3,
          backoffMultiplier: 1.5,
          initialDelay: 1000,
          maxDelay: 30000,
          retryableErrors: ['TIMEOUT', 'CONNECTION_ERROR', 'SERVER_ERROR'],
        },
        errorHandling: {
          stopOnFirstError: true,
          allowPartialSuccess: false,
          errorRecovery: false,
          fallbackStrategies: [],
        },
        logging: {
          enabled: true,
          level: 'info' as 'info',
          includeInput: true,
          includeOutput: true,
          maskSensitiveData: true,
          maxLogSize: 1024 * 1024, // 1MB
        },
        monitoring: {
          enabled: true,
          collectMetrics: true,
          performanceTracking: true,
          alerting: {
            enabled: false,
            channels: [],
            thresholds: {
              errorRate: 0.1,
              responseTime: 1000,
              throughput: 100,
            },
          },
        },
      },
      metadata: {
        enabled: route.enabled !== false,
        priority: route.priority || 100,
        conditions: route.conditions || {},
        healthCheck: route.healthCheck || { enabled: true, interval: 30000 },
      },
    }));

    return {
      port: serverConfig.port,
      host: serverConfig.host,
      pipelines: pipelineConfigs,
      enableAuth: config.security?.authentication?.enabled || false,
      enableValidation: config.validation?.enforceLayerOrder !== false,
      enableCors: config.security?.cors?.enabled !== false,
      logLevel: args.debug ? 'debug' : 'info',
      debug: args.debug || false,
      maxRequestSize: 10 * 1024 * 1024, // 10MB
      timeout: config.routing.configuration?.requestTimeout || 120000,
    };
  }

  /**
   * 启动服务器
   */
  async start(args: CLIArguments): Promise<void> {
    const configPath = args.configPath || './config.json';
    const port = args.port || 5506;

    console.log(`🚀 Starting RCC v4.0 Server...`);
    console.log(`📝 Config: ${configPath}`);
    console.log(`🔧 Debug mode: ${args.debug ? 'enabled' : 'disabled'}`);

    // 检查端口冲突并强制清理
    await this.forceKillPortProcesses(port);

    try {
      // 1. 加载配置
      console.log('📋 Loading configuration...');
      const config = await this.loadConfig(configPath);

      // 2. 初始化ConfigManager
      console.log('⚙️  Initializing configuration manager...');
      this.configManager = await this.initializeConfigManager(config);

      // 3. 初始化Debug管理器（如果启用）
      if (args.debug) {
        console.log('🔍 Initializing debug system...');
        this.debugManager = await this.initializeDebugManager(port, config);
      }

      // 4. 创建PipelineServer配置
      const serverConfig = this.createPipelineServerConfig(config, args);

      // 5. 创建中间件管理器（简化版）
      console.log('🔧 Creating middleware stack...');
      const middlewareManager: any = {
        createStandardMiddlewareStack: () => [],
        addMiddleware: () => {},
        removeMiddleware: () => {},
      };

      // 6. 创建Pipeline服务（使用真实的RCC v4.0组件）
      console.log('⚡ Initializing pipeline service...');

      // 创建真实的组件
      const moduleRegistry = new ModuleRegistry();

      // 注册必需的模块
      console.log('📦 Registering pipeline modules...');

      // 导入并注册模块
      const { AnthropicToOpenAITransformer } = await import(
        './modules/pipeline-modules/transformer/anthropic-to-openai'
      );
      const { OpenAIProtocolModule } = await import('./modules/pipeline-modules/protocol/openai-protocol');
      const { LMStudioCompatibilityModule } = await import(
        './modules/pipeline-modules/server-compatibility/lmstudio-compatibility'
      );
      const { OpenAIServerModule } = await import('./modules/pipeline-modules/server/openai-server');

      // 注册 Anthropic-to-OpenAI 转换器
      moduleRegistry.registerModuleWithConfig({
        id: 'anthropic-to-openai-transformer',
        name: 'Anthropic to OpenAI Transformer',
        type: 'transformer' as any,
        factory: async config => new AnthropicToOpenAITransformer(), // 不传递配置，只负责格式转换
        version: '1.0.0',
      });
      console.log('✅ Anthropic-to-OpenAI Transformer 注册完成');

      // 注册 OpenAI 协议模块
      moduleRegistry.registerModuleWithConfig({
        id: 'openai-protocol-module',
        name: 'OpenAI Protocol Module',
        type: 'protocol' as any,
        factory: async config => new OpenAIProtocolModule(),
        version: '1.0.0',
      });
      console.log('✅ OpenAI Protocol Module 注册完成');

      // 注册 LM Studio 兼容性模块
      moduleRegistry.registerModuleWithConfig({
        id: 'lmstudio-compatibility',
        name: 'LM Studio Compatibility Module',
        type: 'server-compatibility' as any,
        factory: async config => {
          // 从配置文件获取LM Studio Provider的配置
          const lmstudioProvider = Object.values(config.serverCompatibilityProviders || {}).find(
            (provider: any) => provider.id === 'lmstudio-compatibility'
          ) as any;

          // 为LM Studio提供完整的默认配置
          const lmstudioConfig = {
            baseUrl: 'http://localhost:1234/v1',
            timeout: 30000,
            maxRetries: 3,
            retryDelay: 1000,
            models: ['gpt-oss-20b-mlx', 'qwen3-30b-a3b-instruct-2507-mlx', 'qwen3-4b-thinking-2507-mlx'],
            maxTokens: lmstudioProvider?.models?.maxTokens || {}, // 从配置文件获取maxTokens
            ...config,
          };
          return new LMStudioCompatibilityModule(lmstudioConfig);
        },
        version: '1.0.0',
      });
      console.log('✅ LM Studio Compatibility Module 注册完成');

      // 注册 OpenAI 服务器模块 (为LM Studio配置)
      moduleRegistry.registerModuleWithConfig({
        id: 'openai-server-module',
        name: 'OpenAI Server Module',
        type: 'server' as any,
        factory: async config => {
          // 为LM Studio路由配置，使用LM Studio的端点和设置
          const serverConfig = {
            baseURL: 'http://localhost:1234/v1',
            apiKey: 'lm-studio', // LM Studio通常使用此占位符
            timeout: 30000,
            maxRetries: 3,
            retryDelay: 1000,
            ...config,
          };
          return new OpenAIServerModule(serverConfig);
        },
        version: '1.0.0',
      });
      console.log('✅ OpenAI Server Module 注册完成');

      const pipelineFactory = new StandardPipelineFactoryImpl(moduleRegistry);
      const pipelineManager = new PipelineManager(pipelineFactory);

      const pipelineService = new PipelineService(
        pipelineManager as any,
        pipelineFactory as any,
        moduleRegistry as any,
        {
          pipelines: serverConfig.pipelines,
          debug: args.debug || false,
          enableHealthChecks: true,
          healthCheckInterval: 30000,
        }
      );

      // 7. 创建并启动PipelineServer
      console.log('🌐 Starting pipeline server...');
      this.server = new PipelineServer(serverConfig, middlewareManager, pipelineService);

      // 8. 设置事件监听器
      this.setupEventListeners();

      // 9. 启动服务器
      await this.server.start();

      console.log(`✅ RCC v4.0 Server started on http://${args.host || 'localhost'}:${port}`);
      console.log(`🔧 Debug mode: ${args.debug ? 'enabled' : 'disabled'}`);

      if (args.debug && this.debugManager) {
        const debugDir = path.join(
          process.env.HOME || process.cwd(),
          '.route-claudecode',
          'debug-logs',
          `port-${port}`
        );
        console.log(`📂 Debug logs: ${debugDir}`);
      }

      console.log('📋 Available endpoints:');
      console.log(`   POST /v1/messages - Anthropic-compatible API`);
      console.log(`   POST /v1/chat/completions - OpenAI-compatible API`);
      console.log(`   GET /health - Health check`);
      console.log(`   GET /status - Server status`);

      console.log('Press Ctrl+C to gracefully shutdown');

      // 10. 优雅关闭处理
      this.setupGracefulShutdown();
    } catch (error) {
      const err = error as Error;
      console.error(`❌ Failed to start RCC v4.0 Server: ${err.message}`);

      if (args.debug) {
        console.error('Stack trace:', err.stack);
      }

      await this.cleanup();
      process.exit(1);
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.server) return;

    // Pipeline执行事件
    this.server.on('executionStarted', data => {
      console.log(`🔄 [${data.requestId}] Pipeline execution started: ${data.pipelineId}`);
    });

    this.server.on('executionCompleted', data => {
      const totalTime = data.performance?.totalTime || data.totalTime || 'unknown';
      console.log(`✅ [${data.requestId}] Pipeline execution completed: ${data.pipelineId} (${totalTime}ms)`);
    });

    this.server.on('executionFailed', data => {
      console.log(`❌ [${data.requestId}] Pipeline execution failed: ${data.pipelineId} - ${data.error}`);
    });

    // 服务器状态事件
    this.server.on('error', error => {
      console.error('❌ Server error:', error);
    });

    this.server.on('started', data => {
      console.log(`🌐 HTTP Server listening on ${data.host}:${data.port}`);
    });
  }

  /**
   * 设置优雅关闭
   */
  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      console.log(`\\n🛑 Received ${signal}, shutting down gracefully...`);
      await this.cleanup();
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.server) {
        console.log('🛑 Stopping pipeline server...');
        await this.server.stop();
      }

      if (this.debugManager) {
        console.log('🔍 Cleaning up debug system...');
        await this.debugManager.cleanup();
      }

      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }

  /**
   * 强制清理端口进程（用于启动前的清理）
   */
  private async forceKillPortProcesses(port: number): Promise<void> {
    try {
      console.log(`🔍 检查端口 ${port} 是否被占用...`);

      const { spawn } = await import('child_process');
      const lsofProcess = spawn('lsof', ['-ti', `:${port}`], { stdio: 'pipe' });

      let lsofOutput = '';
      lsofProcess.stdout.on('data', data => {
        lsofOutput += data.toString();
      });

      await new Promise(resolve => {
        lsofProcess.on('close', () => resolve(void 0));
      });

      const pids = lsofOutput
        .trim()
        .split('\n')
        .filter(pid => pid && /^\d+$/.test(pid));

      if (pids.length > 0) {
        console.log(`⚠️  端口 ${port} 被占用，强制清理 ${pids.length} 个进程...`);

        for (const pid of pids) {
          try {
            process.kill(parseInt(pid), 'SIGKILL');
            console.log(`🔪 强制终止进程 ${pid}`);
          } catch (error) {
            console.log(`⚠️  进程 ${pid} 已不存在`);
          }
        }

        // 等待500ms确保进程被完全清理
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(`✅ 端口 ${port} 清理完成`);
      } else {
        console.log(`✅ 端口 ${port} 空闲，可以启动`);
      }
    } catch (error) {
      console.log(`⚠️  检查端口时出错: ${error.message}`);
    }
  }

  /**
   * 停止RCC4服务器
   */
  async stop(args: CLIArguments): Promise<void> {
    const port = args.port || 5506;
    const host = args.host || 'localhost';

    console.log(`🛑 停止RCC4服务器 (端口: ${port})`);

    try {
      // 方法1: 尝试通过HTTP API优雅停止
      console.log('📡 尝试通过API优雅停止服务器...');

      const stopResponse = await fetch(`http://${host}:${port}/admin/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-key',
        },
      }).catch(() => null);

      if (stopResponse && stopResponse.ok) {
        console.log('✅ 服务器已优雅停止');
        return;
      }

      // 方法2: 优雅停止 + 3秒超时强制杀死
      console.log('🔍 查找占用端口的进程...');

      const { spawn } = await import('child_process');
      const lsofProcess = spawn('lsof', ['-ti', `:${port}`], { stdio: 'pipe' });

      let lsofOutput = '';
      lsofProcess.stdout.on('data', data => {
        lsofOutput += data.toString();
      });

      await new Promise(resolve => {
        lsofProcess.on('close', () => resolve(void 0));
      });

      const portPids = lsofOutput
        .trim()
        .split('\n')
        .filter(pid => pid && /^\d+$/.test(pid));

      if (portPids.length === 0) {
        console.log(`⚠️  未找到端口 ${port} 上的进程`);
        return;
      }

      console.log(`🎯 找到 ${portPids.length} 个占用端口的进程`);

      for (const pid of portPids) {
        console.log(`📤 向进程 ${pid} 发送SIGTERM信号 (优雅退出)`);

        try {
          // 先发送SIGTERM信号
          process.kill(parseInt(pid), 'SIGTERM');

          // 等待3秒
          const waitStartTime = Date.now();
          let processStillRunning = true;

          while (Date.now() - waitStartTime < 3000 && processStillRunning) {
            try {
              process.kill(parseInt(pid), 0); // 测试进程是否存在
              await new Promise(resolve => setTimeout(resolve, 100)); // 等待100ms
            } catch (e) {
              processStillRunning = false;
              console.log(`✅ 进程 ${pid} 已优雅退出`);
              break;
            }
          }

          // 3秒后仍在运行，强制杀死
          if (processStillRunning) {
            console.log(`⚠️  进程 ${pid} 3秒内未退出，强制杀死 (SIGKILL)`);
            process.kill(parseInt(pid), 'SIGKILL');
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log(`🔪 进程 ${pid} 已强制终止`);
          }
        } catch (error) {
          console.log(`⚠️  无法停止进程 ${pid}: ${error.message}`);
        }
      }

      console.log('✅ RCC4服务器停止操作完成');
    } catch (error) {
      console.error(`❌ 停止服务器时出错: ${error.message}`);

      // 最后尝试: 使用pkill
      console.log('🔄 使用pkill尝试强制停止...');
      try {
        const pkillProcess = spawn('pkill', ['-f', `rcc4.*${port}`], { stdio: 'inherit' });
        await new Promise(resolve => {
          pkillProcess.on('close', resolve);
        });
        console.log('✅ pkill命令执行完成');
      } catch (pkillError) {
        console.error(`❌ pkill也失败了: ${pkillError.message}`);
        console.log('💡 您可能需要手动停止进程：');
        console.log(`   ps aux | grep rcc4`);
        console.log(`   kill -9 <PID>`);
      }
    }
  }

  /**
   * 启动Claude Code代理模式
   */
  async code(args: CLIArguments): Promise<void> {
    const proxyPort = args.proxyPort || args.port || 5506;
    const host = args.host || 'localhost';

    console.log(`🚀 启动Claude Code代理模式`);
    console.log(`📡 连接到RCC4服务器: http://${host}:${proxyPort}`);

    // 设置环境变量
    process.env.ANTHROPIC_BASE_URL = `http://${host}:${proxyPort}`;
    process.env.ANTHROPIC_API_KEY = 'rcc4-proxy-key';

    console.log(`🔗 环境变量已设置:`);
    console.log(`   ANTHROPIC_BASE_URL=${process.env.ANTHROPIC_BASE_URL}`);
    console.log(`   ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY}`);

    // 启动Claude Code
    console.log(`🌟 启动Claude Code...`);

    const claudeProcess = spawn('claude', [], {
      stdio: 'inherit',
      env: {
        ...process.env,
        ANTHROPIC_BASE_URL: `http://${host}:${proxyPort}`,
        ANTHROPIC_API_KEY: 'rcc4-proxy-key',
      },
    });

    claudeProcess.on('error', error => {
      console.error(`❌ 启动Claude Code失败: ${error.message}`);
      console.log(`💡 请确保Claude Code已安装: npm install -g @anthropic-ai/claude-code`);
      process.exit(1);
    });

    claudeProcess.on('exit', code => {
      console.log(`🔚 Claude Code退出，代码: ${code}`);
      process.exit(code || 0);
    });

    // 优雅关闭处理
    const gracefulShutdown = (signal: string) => {
      console.log(`\n🛑 收到${signal}信号，关闭Claude Code...`);
      claudeProcess.kill();
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  /**
   * 显示帮助信息
   */
  private showHelp(): void {
    console.log(`
RCC v4.0 - Route Claude Code Server

Usage:
  rcc4 start [options]     Start RCC4 server
  rcc4 stop [options]      Stop RCC4 server
  rcc4 code [options]      Start Claude Code with RCC4 proxy

Options:
  --config <path>      Configuration file path (default: ./config.json)
  --port <number>      Server port (default: 5506)
  --proxy-port <port>  RCC4 proxy server port (for code command, default: 5506)
  --host <host>        Server host (default: localhost)
  --debug              Enable debug mode with detailed logging

Examples:
  # Start RCC4 server
  rcc4 start --config ~/.route-claudecode/config/v4/single-provider/lmstudio-v4-5506.json --debug
  
  # Stop RCC4 server
  rcc4 stop --port 5506
  rcc4 stop --port 5506 --host localhost
  
  # Start Claude Code with RCC4 proxy
  rcc4 code --proxy-port 5506
  rcc4 code --proxy-port 5506 --host localhost
  
  # Complete workflow
  rcc4 start --port 5506 --debug    # Start server
  rcc4 code --proxy-port 5506       # Connect Claude Code
  rcc4 stop --port 5506              # Stop server when done

For more information, visit: https://github.com/anthropics/route-claudecode
`);
  }

  /**
   * 主执行函数
   */
  async run(): Promise<void> {
    const args = this.parseArguments(process.argv.slice(2));

    switch (args.command) {
      case 'start':
        await this.start(args);
        break;
      case 'stop':
        await this.stop(args);
        break;
      case 'code':
        await this.code(args);
        break;
      case 'help':
      case '--help':
      case '-h':
      default:
        this.showHelp();
        break;
    }
  }
}

// CLI执行
async function main() {
  const cli = new RCCv4CLI();
  await cli.run();
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { RCCv4CLI };
