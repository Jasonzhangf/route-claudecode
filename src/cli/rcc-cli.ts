/**
 * RCC主CLI类
 *
 * 统一的CLI入口，集成命令解析、验证、配置加载和执行
 *
 * @author Jason Zhang
 */

import {
  CLICommands,
  ParsedCommand,
  StartOptions,
  StopOptions,
  CodeOptions,
  StatusOptions,
  ConfigOptions,
  ServerStatus,
} from '../interfaces/client/cli-interface';
import { CommandParser } from './command-parser';
import { ArgumentValidator } from './argument-validator';
import { ConfigReader } from '../config/config-reader';
import { PipelineLifecycleManager } from '../pipeline/pipeline-lifecycle-manager';
import { secureLogger } from '../utils/secure-logger';
import { JQJsonHandler } from '../utils/jq-json-handler';
import { QwenAuthManager } from './auth/qwen-auth-manager';
import * as path from 'path';
import * as os from 'os';

/**
 * CLI执行选项
 */
export interface CLIOptions {
  exitOnError?: boolean;
  suppressOutput?: boolean;
  configPath?: string;
  envPrefix?: string;
}

/**
 * RCC主CLI类
 */
export class RCCCli implements CLICommands {
  private parser: CommandParser;
  private validator: ArgumentValidator;
  private configReader: ConfigReader;
  private options: CLIOptions;
  private pipelineManager?: PipelineLifecycleManager;
  private qwenAuthManager: QwenAuthManager;

  constructor(options: CLIOptions = {}) {
    this.parser = new CommandParser();
    this.validator = new ArgumentValidator();
    this.configReader = new ConfigReader();
    this.qwenAuthManager = new QwenAuthManager();
    this.options = {
      exitOnError: true,
      suppressOutput: false,
      envPrefix: 'RCC',
      ...options,
    };
  }

  /**
   * 执行CLI命令
   */
  async run(args: string[] = process.argv.slice(2)): Promise<void> {
    try {
      // 1. 解析命令行参数
      const command = this.parser.parseArguments(args);

      // 2. 验证参数
      const validation = this.validator.validate(command);
      if (!validation.valid) {
        this.handleValidationErrors(validation.errors);
        return;
      }

      // 显示警告（如果有）
      if (validation.warnings.length > 0 && !this.options.suppressOutput) {
        for (const warning of validation.warnings) {
          console.warn(`Warning: ${warning.message}`);
          if (warning.suggestion) {
            console.warn(`  Suggestion: ${warning.suggestion}`);
          }
        }
      }

      // 3. 加载配置
      const systemConfigPath = this.getSystemConfigPath();
      const config = ConfigReader.loadConfig(
        this.options.configPath || 'config/default.json',
        systemConfigPath
      );

      // 4. 合并配置到命令选项
      const mergedCommand: ParsedCommand = {
        ...command,
        options: { ...config, ...validation.normalizedOptions },
      };

      // 5. 执行命令
      await this.parser.executeCommand(mergedCommand);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * 启动服务器模式
   */
  async start(options: StartOptions): Promise<void> {
    try {
      // 验证必需参数
      if (!options.config) {
        throw new Error('Configuration file is required. Please specify --config <path>');
      }

      // 读取配置文件获取端口（如果命令行没有提供）
      let effectivePort = options.port;
      if (!effectivePort) {
        try {
          const systemConfigPath = this.getSystemConfigPath();
          const config = ConfigReader.loadConfig(options.config, systemConfigPath);
          effectivePort = config.server?.port;
          if (!effectivePort) {
            throw new Error('Port not found in configuration file and not specified via --port <number>');
          }
        } catch (error) {
          throw new Error('Port is required. Please specify --port <number> or ensure port is configured in the configuration file');
        }
      }
      
      // 更新options对象以包含有效端口
      options.port = effectivePort;

      if (!this.options.suppressOutput) {
        console.log('🚀 Starting RCC Server...');
        console.log(`   Port: ${options.port}`);
        console.log(`   Host: ${options.host || 'localhost'}`);
        if (options.debug) {
          console.log('   Debug: enabled');
        }
        console.log(`   Config: ${options.config}`);
      }

      // TODO: 实现实际的服务器启动逻辑
      await this.startServer(options);

      if (!this.options.suppressOutput) {
        console.log('✅ RCC Server started successfully');
        console.log(`🌐 Server running at http://${options.host || 'localhost'}:${options.port}`);
      }
    } catch (error) {
      throw new Error(`Failed to start server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 停止服务器
   */
  async stop(options: StopOptions): Promise<void> {
    try {
      if (!this.options.suppressOutput) {
        console.log('🛑 Stopping RCC Server...');
        if (options.port) {
          console.log(`   Port: ${options.port}`);
        }
        if (options.force) {
          console.log('   Force: enabled');
        }
      }

      await this.stopServer(options);

      if (!this.options.suppressOutput) {
        console.log('✅ RCC Server stopped successfully');
      }
    } catch (error) {
      throw new Error(`Failed to stop server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 启动客户端模式
   */
  async code(options: CodeOptions): Promise<void> {
    try {
      if (!this.options.suppressOutput) {
        console.log('🔧 Starting Claude Code Client Mode...');
        console.log(`   Target Port: ${options.port || 5506}`);
        if (options.autoStart) {
          console.log('   Auto Start: enabled');
        }
        if (options.export) {
          console.log('   Export Config: enabled');
        }
      }

      await this.startClientMode(options);

      if (options.export) {
        await this.exportClientConfig(options);
      }

      if (!this.options.suppressOutput) {
        console.log('✅ Claude Code Client Mode activated');
        console.log('🔗 Transparent proxy established');
      }
    } catch (error) {
      throw new Error(`Failed to start client mode: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 查看服务器状态
   */
  async status(options: StatusOptions): Promise<ServerStatus> {
    try {
      if (!this.options.suppressOutput) {
        console.log('📊 Checking RCC Server Status...');
      }

      const status = await this.getServerStatus(options);

      if (!this.options.suppressOutput) {
        this.displayServerStatus(status, options.detailed || false);
      }

      return status;
    } catch (error) {
      throw new Error(`Failed to get server status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 配置管理
   */
  async config(options: ConfigOptions): Promise<void> {
    try {
      if (options.list) {
        await this.listConfigurations();
      } else if (options.validate) {
        await this.validateConfiguration(options.path);
      } else if (options.reset) {
        await this.resetConfiguration();
      } else {
        throw new Error('No config operation specified. Use --list, --validate, or --reset.');
      }
    } catch (error) {
      throw new Error(`Configuration operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 处理验证错误
   */
  private handleValidationErrors(errors: any[]): void {
    if (!this.options.suppressOutput) {
      console.error('❌ Validation Errors:');
      for (const error of errors) {
        console.error(`   ${error.field}: ${error.message}`);
      }
      console.error('\nUse --help for usage information.');
    }

    if (this.options.exitOnError) {
      process.exit(1);
    }
  }

  /**
   * 处理认证命令
   */
  async auth(provider: string, index?: number, options?: any): Promise<void> {
    try {
      // 参数验证
      if (!provider) {
        throw new Error('Provider is required. Usage: rcc4 auth <provider> <index>');
      }

      // 支持的provider检查
      const supportedProviders = ['qwen', 'gemini', 'claude'];
      if (!supportedProviders.includes(provider.toLowerCase())) {
        throw new Error(`Unsupported provider: ${provider}. Supported: ${supportedProviders.join(', ')}`);
      }

      // 处理不同的选项
      if (options?.list) {
        await this.listAuthFiles(provider);
        return;
      }

      if (options?.remove && index) {
        await this.removeAuthFile(provider, index);
        return;
      }

      if (options?.refresh && index) {
        await this.refreshAuthFile(provider, index);
        return;
      }

      // 默认认证流程
      if (!index) {
        // 提供更智能的提示
        const availableIndexes = await this.qwenAuthManager.getAvailableAuthIndexes();
        const nextIndex = await this.qwenAuthManager.getNextAvailableIndex();
        
        if (availableIndexes.length === 0) {
          throw new Error(`序号是必需的。建议使用: rcc4 auth ${provider} ${nextIndex}`);
        } else {
          throw new Error(`序号是必需的。现有序号: [${availableIndexes.join(', ')}]，建议新序号: ${nextIndex}`);
        }
      }

      if (index < 1 || index > 99) {
        throw new Error('Index must be between 1 and 99');
      }

      await this.authenticateProvider(provider, index);

    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * 执行provider认证
   */
  private async authenticateProvider(provider: string, index: number): Promise<void> {
    switch (provider.toLowerCase()) {
      case 'qwen':
        // 检查文件是否已存在
        const validation = await this.qwenAuthManager.validateAuthIndex(index);
        if (validation.exists) {
          if (validation.isExpired) {
            console.log(`⚠️ 认证文件 qwen-auth-${index}.json 已存在但已过期`);
            console.log(`💡 使用 "rcc4 auth qwen ${index} --refresh" 刷新，或选择其他序号`);
            return;
          } else {
            console.log(`⚠️ 认证文件 qwen-auth-${index}.json 已存在且仍然有效`);
            console.log(`💡 如需重新认证，请先删除: "rcc4 auth qwen ${index} --remove"`);
            return;
          }
        }
        
        await this.qwenAuthManager.authenticate(index);
        break;
      case 'gemini':
        throw new Error('Gemini authentication not yet implemented');
      case 'claude':
        throw new Error('Claude authentication not yet implemented');
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * 列出认证文件
   */
  private async listAuthFiles(provider: string): Promise<void> {
    switch (provider.toLowerCase()) {
      case 'qwen':
        await this.qwenAuthManager.listAuthFiles();
        break;
      default:
        console.log(`📝 ${provider} authentication files listing not yet implemented`);
    }
  }

  /**
   * 删除认证文件
   */
  private async removeAuthFile(provider: string, index: number): Promise<void> {
    switch (provider.toLowerCase()) {
      case 'qwen':
        await this.qwenAuthManager.removeAuthFile(index);
        break;
      default:
        console.log(`🗑️ ${provider} authentication file removal not yet implemented`);
    }
  }

  /**
   * 刷新认证文件
   */
  private async refreshAuthFile(provider: string, index: number): Promise<void> {
    switch (provider.toLowerCase()) {
      case 'qwen':
        await this.qwenAuthManager.refreshAuthFile(index);
        break;
      default:
        console.log(`🔄 ${provider} authentication file refresh not yet implemented`);
    }
  }

  /**
   * 处理错误
   */
  private handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';

    if (!this.options.suppressOutput) {
      console.error(`❌ Error: ${message}`);
    }

    if (this.options.exitOnError) {
      process.exit(1);
    } else {
      throw error;
    }
  }

  /**
   * 启动服务器（实际实现）
   */
  private async startServer(options: StartOptions): Promise<void> {
    try {
      // 🎯 自动检测并清理端口占用
      if (options.port) {
        await this.cleanupPortIfOccupied(options.port);
      }

      // 初始化流水线生命周期管理器
      // 需要系统配置路径，使用正确的绝对路径，并传递debug选项
      const systemConfigPath = this.getSystemConfigPath();
      this.pipelineManager = new PipelineLifecycleManager(options.config, systemConfigPath, options.debug);
      
      // 将实例保存到全局变量，以便信号处理程序能够访问
      (global as any).pipelineLifecycleManager = this.pipelineManager;

      // 启动RCC v4.0流水线系统
      const success = await this.pipelineManager.start();
      if (!success) {
        throw new Error('Pipeline system failed to start');
      }

      // 监听流水线事件
      this.setupPipelineEventListeners();

      secureLogger.info('RCC Server started with pipeline system', {
        port: options.port,
        host: options.host || '0.0.0.0',
        config: options.config,
        debug: options.debug,
      });
    } catch (error) {
      secureLogger.error('Failed to start RCC server', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * 停止服务器（实际实现）
   */
  private async stopServer(options: StopOptions): Promise<void> {
    let effectivePort = options.port;
    
    // 如果没有指定端口，尝试使用默认的常用端口
    if (!effectivePort) {
      // 对于stop操作，我们可以尝试一些常用端口
      // 或者要求用户明确指定端口以避免误操作
      throw new Error('Port is required for stop operation. Please specify --port <number>');
    }
    
    const port = effectivePort;
    
    try {
      // 首先尝试通过HTTP端点优雅停止
      await this.attemptGracefulStop(port);
      
      // 等待一段时间让服务器优雅关闭
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 检查是否还有进程占用端口
      const pid = await this.findProcessOnPort(port);
      
      if (pid) {
        if (options.force) {
          // 强制终止进程
          await this.forceKillProcess(pid);
          secureLogger.info('RCC Server force killed', { port, pid });
        } else {
          // 发送TERM信号尝试优雅关闭
          await this.sendTermSignal(pid);
          
          // 等待进程关闭
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // 再次检查，如果还在运行则强制终止
          const stillRunning = await this.findProcessOnPort(port);
          if (stillRunning) {
            await this.forceKillProcess(stillRunning);
            secureLogger.info('RCC Server force killed after TERM timeout', { port, pid: stillRunning });
          }
        }
      }
      
      // 清理本地实例
      if (this.pipelineManager) {
        await this.pipelineManager.stop();
        this.pipelineManager = undefined;
      }
      
      // 清理全局实例
      (global as any).pipelineLifecycleManager = undefined;

      secureLogger.info('RCC Server stopped successfully', {
        port,
        force: options.force,
      });
    } catch (error) {
      secureLogger.error('Failed to stop RCC server', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * 尝试通过HTTP端点优雅停止服务器
   */
  private async attemptGracefulStop(port: number): Promise<void> {
    try {
      const http = require('http');
      const postData = JQJsonHandler.stringifyJson({ action: 'shutdown' });
      
      const options = {
        hostname: 'localhost',
        port: port,
        path: '/shutdown',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 3000
      };

      await new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
          res.on('data', () => {});
          res.on('end', () => resolve(undefined));
        });

        req.on('error', (err) => {
          // 如果HTTP请求失败，继续其他停止方法
          resolve(undefined);
        });

        req.on('timeout', () => {
          req.destroy();
          resolve(undefined);
        });

        req.write(postData);
        req.end();
      });
    } catch (error) {
      // 忽略HTTP停止失败，继续其他方法
    }
  }

  /**
   * 查找占用指定端口的进程ID
   */
  private async findProcessOnPort(port: number): Promise<number | null> {
    try {
      const { execSync } = require('child_process');
      const result = execSync(`lsof -ti :${port}`, { encoding: 'utf8', timeout: 5000 });
      const pid = parseInt(result.trim());
      return isNaN(pid) ? null : pid;
    } catch (error) {
      return null;
    }
  }

  /**
   * 发送TERM信号给进程
   */
  private async sendTermSignal(pid: number): Promise<void> {
    try {
      const { execSync } = require('child_process');
      execSync(`kill -TERM ${pid}`, { timeout: 5000 });
    } catch (error) {
      // 忽略错误，后续会强制终止
    }
  }

  /**
   * 强制终止进程
   */
  private async forceKillProcess(pid: number): Promise<void> {
    try {
      const { execSync } = require('child_process');
      execSync(`kill -9 ${pid}`, { timeout: 5000 });
    } catch (error) {
      throw new Error(`Failed to force kill process ${pid}: ${error.message}`);
    }
  }

  /**
   * 自动检测并清理端口占用
   */
  private async cleanupPortIfOccupied(port: number): Promise<void> {
    try {
      const pid = await this.findProcessOnPort(port);
      
      if (pid) {
        if (!this.options.suppressOutput) {
          console.log(`⚠️  Port ${port} is occupied by process ${pid}, attempting cleanup...`);
        }
        
        secureLogger.info('Auto-cleaning occupied port', { port, pid });
        
        // 先尝试优雅关闭
        await this.sendTermSignal(pid);
        
        // 等待进程优雅关闭
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 检查进程是否仍在运行
        const stillRunning = await this.findProcessOnPort(port);
        
        if (stillRunning) {
          // 强制终止进程
          await this.forceKillProcess(stillRunning);
          
          if (!this.options.suppressOutput) {
            console.log(`🔥 Forcefully terminated process ${stillRunning} on port ${port}`);
          }
          
          secureLogger.info('Port cleanup: force killed process', { port, pid: stillRunning });
        } else {
          if (!this.options.suppressOutput) {
            console.log(`✅ Process ${pid} gracefully stopped, port ${port} is now available`);
          }
          
          secureLogger.info('Port cleanup: graceful shutdown successful', { port, pid });
        }
        
        // 再等待一小段时间确保端口完全释放
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } else {
        secureLogger.debug('Port is available', { port });
      }
    } catch (error) {
      secureLogger.warn('Port cleanup failed', { 
        port, 
        error: error.message 
      });
      
      if (!this.options.suppressOutput) {
        console.warn(`⚠️  Warning: Failed to cleanup port ${port}: ${error.message}`);
      }
      
      // 不抛出错误，让服务器启动继续尝试
      // 如果端口真的被占用，后续的服务器启动会失败并报告具体错误
    }
  }

  /**
   * 启动客户端模式（实际实现）
   */
  private async startClientMode(options: CodeOptions): Promise<void> {
    const port = options.port || 5506;
    const baseUrl = `http://localhost:${port}`;
    const apiKey = 'rcc4-proxy-key';

    // 设置环境变量
    process.env.ANTHROPIC_BASE_URL = baseUrl;
    process.env.ANTHROPIC_API_KEY = apiKey;

    secureLogger.info('启动Claude Code客户端模式', {
      baseUrl,
      port,
      apiKey: 'rcc4-proxy-key'
    });

    // 启动 claude 子进程
    const spawn = require('child_process').spawn;
    
    try {
      // 传递所有命令行参数给 claude，除了 rcc4 特定的参数
      const originalArgs = process.argv.slice(2);
      const claudeArgs: string[] = [];
      
      // 跳过 rcc4 特定参数和它们的值
      for (let i = 0; i < originalArgs.length; i++) {
        const arg = originalArgs[i];
        const nextArg = originalArgs[i + 1];
        
        if (arg === 'code') {
          // 跳过code命令
          continue;
        } else if (arg === '--port' && nextArg) {
          // 跳过--port及其值
          i++; // 跳过下一个参数（端口号）
          continue;
        } else if (arg === '--auto-start' || arg === '--export') {
          // 跳过这些标志
          continue;
        } else if (arg.startsWith('--port=')) {
          // 跳过--port=5506格式
          continue;
        } else {
          // 保留其他所有参数
          claudeArgs.push(arg);
        }
      }

      // 如果没有参数，让 claude 使用默认行为
      // 不需要添加 --interactive，claude 会自动进入交互模式

      secureLogger.info('启动claude命令', {
        claudeArgs,
        env: {
          ANTHROPIC_BASE_URL: baseUrl,
          ANTHROPIC_API_KEY: apiKey
        }
      });

      const claude = spawn('claude', claudeArgs, {
        stdio: 'inherit',  // 继承stdio，让claude直接与终端交互
        env: {
          ...process.env,
          ANTHROPIC_BASE_URL: baseUrl,
          ANTHROPIC_API_KEY: apiKey
        }
      });

      claude.on('close', (code) => {
        secureLogger.info('Claude进程退出', { exitCode: code });
        process.exit(code || 0);
      });

      claude.on('error', (error) => {
        secureLogger.error('Claude进程错误', { error: error.message });
        console.error(`❌ Failed to start claude: ${error.message}`);
        process.exit(1);
      });

      // 等待一小段时间确保claude启动
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      secureLogger.error('启动claude客户端失败', { error: error.message });
      throw new Error(`Failed to start claude client: ${error.message}`);
    }
  }

  /**
   * 导出客户端配置
   */
  private async exportClientConfig(options: CodeOptions): Promise<void> {
    const envVars = [
      `export ANTHROPIC_BASE_URL=http://localhost:${options.port || 5506}`,
      'export ANTHROPIC_API_KEY=rcc-proxy-key',
    ];

    if (!this.options.suppressOutput) {
      console.log('\n📋 Environment Variables:');
      for (const envVar of envVars) {
        console.log(`   ${envVar}`);
      }
    }
  }

  /**
   * 获取服务器状态（实际实现）
   */
  private async getServerStatus(options: StatusOptions): Promise<ServerStatus> {
    if (!this.pipelineManager) {
      return {
        isRunning: false,
        port: options.port || 0,
        host: 'localhost',
        startTime: undefined,
        version: '4.0.0-dev',
        activePipelines: 0,
        totalRequests: 0,
        uptime: '0s',
        health: {
          status: 'unhealthy',
          checks: [{ name: 'Pipeline Manager', status: 'fail', responseTime: 0 }],
        },
      };
    }

    const stats = this.pipelineManager.getStats();
    const isRunning = this.pipelineManager.isSystemRunning();
    const systemInfo = this.pipelineManager.getSystemInfo();

    return {
      isRunning,
      port: options.port || 0,
      host: 'localhost',
      startTime: new Date(Date.now() - stats.uptime),
      version: '4.0.0-dev',
      activePipelines: stats.routingTableStats.virtualModels.length,
      totalRequests: stats.totalRequests,
      uptime: this.formatUptime(stats.uptime),
      health: {
        status: isRunning ? 'healthy' : 'unhealthy',
        checks: [
          {
            name: 'Pipeline Manager',
            status: isRunning ? 'pass' : 'fail',
            responseTime: Math.round(stats.averageResponseTime || 0),
          },
          {
            name: 'Router System',
            status: stats.serverMetrics.routerStats ? 'pass' : 'fail',
            responseTime: 1,
          },
          {
            name: 'Layer Health',
            status:
              stats.requestProcessorStats.layerHealth && Object.keys(stats.requestProcessorStats.layerHealth).length > 0
                ? 'pass'
                : 'warn',
            responseTime: 2,
          },
        ],
      },
      pipeline: {
        stats,
        activeRequests: 0, // No longer tracking active requests in new structure
        layerHealth: stats.requestProcessorStats.layerHealth,
      },
    };
  }

  /**
   * 显示服务器状态
   */
  private displayServerStatus(status: ServerStatus, detailed: boolean): void {
    console.log('\n📊 RCC Server Status:');
    console.log(`   Status: ${status.isRunning ? '🟢 Running' : '🔴 Stopped'}`);
    console.log(`   Address: http://${status.host}:${status.port}`);
    console.log(`   Version: ${status.version}`);

    if (detailed && status.isRunning) {
      console.log(`   Uptime: ${status.uptime}`);
      console.log(`   Active Pipelines: ${status.activePipelines}`);
      console.log(`   Total Requests: ${status.totalRequests}`);

      if (status.startTime) {
        console.log(`   Started: ${status.startTime.toISOString()}`);
      }

      console.log(`\n🏥 Health Status: ${this.getHealthStatusIcon(status.health.status)} ${status.health.status}`);
      for (const check of status.health.checks) {
        const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
        console.log(`   ${icon} ${check.name}: ${check.status} (${check.responseTime}ms)`);
      }
    }
  }

  /**
   * 获取健康状态图标
   */
  private getHealthStatusIcon(status: string): string {
    switch (status) {
      case 'healthy':
        return '🟢';
      case 'degraded':
        return '🟡';
      case 'unhealthy':
        return '🔴';
      default:
        return '⚪';
    }
  }

  /**
   * 列出配置文件
   */
  private async listConfigurations(): Promise<void> {
    if (!this.options.suppressOutput) {
      console.log('📁 Available Configurations:');
      console.log('   ~/.rcc/config.json (default)');
      console.log('   ./rcc.config.json (project)');
      console.log('   Environment variables (RCC_*)');
    }
  }

  /**
   * 验证配置文件
   */
  private async validateConfiguration(path?: string): Promise<void> {
    if (!this.options.suppressOutput) {
      console.log(`✅ Configuration ${path || 'default'} is valid`);
    }
  }

  /**
   * 获取系统配置文件路径
   */
  private getSystemConfigPath(): string {
    // 优先级：环境变量 > ~/.route-claudecode/config > 开发环境路径
    if (process.env.RCC_SYSTEM_CONFIG_PATH) {
      return process.env.RCC_SYSTEM_CONFIG_PATH;
    }
    
    // 用户级系统配置路径
    const userConfigPath = path.join(os.homedir(), '.route-claudecode', 'config', 'system-config.json');
    
    // 检查文件是否存在，如果存在则使用
    try {
      require('fs').accessSync(userConfigPath);
      return userConfigPath;
    } catch (error) {
      // 文件不存在，使用开发环境路径作为fallback
      secureLogger.warn('User system config not found, using development path', { 
        attempted: userConfigPath,
        fallback: 'config/system-config.json'
      });
      return 'config/system-config.json';
    }
  }

  /**
   * 重置配置
   */
  private async resetConfiguration(): Promise<void> {
    if (!this.options.suppressOutput) {
      console.log('🔄 Configuration reset to defaults');
    }
  }

  /**
   * 设置流水线事件监听器
   */
  private setupPipelineEventListeners(): void {
    if (!this.pipelineManager) {
      return;
    }

    this.pipelineManager.on('pipeline-started', () => {
      secureLogger.info('Pipeline system started successfully');
    });

    this.pipelineManager.on('layers-ready', () => {
      secureLogger.info('All pipeline layers are ready');
    });

    this.pipelineManager.on('layers-error', error => {
      secureLogger.error('Pipeline layer error', { error: error.message });
    });

    this.pipelineManager.on('request-completed', data => {
      secureLogger.debug('Request completed successfully', {
        requestId: data.requestId,
        success: data.success,
      });
    });

    this.pipelineManager.on('request-failed', data => {
      secureLogger.warn('Request failed', {
        requestId: data.requestId,
        error: data.error.message,
      });
    });

    this.pipelineManager.on('pipeline-stopped', () => {
      secureLogger.info('Pipeline system stopped');
    });
  }

  /**
   * 格式化运行时间
   */
  private formatUptime(uptimeMs: number): string {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}
