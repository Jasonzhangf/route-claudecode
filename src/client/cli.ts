#!/usr/bin/env node

/**
 * CLI客户端模块
 *
 * 提供命令行接口功能，集成服务器管理、配置管理和代理功能
 *
 * @author Jason Zhang
 */

import { program } from 'commander';
import chalk from 'chalk';
import {
  ICommandExecutor,
  IServerController,
  IConfigManager,
  ServerStartConfig,
  ServerStopConfig,
  ServerStatusConfig,
  ClientProxyConfig,
  ConfigAction,
} from '../interfaces/core/cli-abstraction';
import { ValidateInput } from '../middleware/data-validator';
import { RCCError, ErrorHandler } from '../interfaces/client/error-handler';
import { getServerPort, getServerHost } from '../constants/server-defaults';

/**
 * CLI错误类
 */
export class CLIError extends RCCError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CLI_ERROR', details);
    this.name = 'CLIError';
  }
}

/**
 * CLI命令执行器实现
 */
export class CommandExecutor implements ICommandExecutor {
  constructor(
    private serverController: IServerController,
    private configManager: IConfigManager,
    private errorHandler: ErrorHandler
  ) {}

  /**
   * 执行启动命令
   */
  @ValidateInput({
    port: { type: 'number', required: false },
    host: { type: 'string', required: false },
    configPath: { type: 'string', required: false },
    debug: { type: 'boolean', required: false },
  })
  async executeStart(config: ServerStartConfig): Promise<void> {
    try {
      console.log(chalk.blue('🚀 Starting RCC Server...'));

      // 检查服务器是否已经运行
      const isRunning = await this.serverController.isRunning(config.port);
      if (isRunning) {
        throw new CLIError('Server is already running on the specified port', {
          port: config.port || getServerPort(),
        });
      }

      // 加载和验证配置
      if (config.configPath) {
        const configData = await this.configManager.loadConfig(config.configPath);
        const validation = this.configManager.validateConfig(configData);
        if (!validation.valid) {
          throw new CLIError('Configuration validation failed', {
            errors: validation.errors,
            warnings: validation.warnings,
          });
        }
      }

      // 启动服务器
      const result = await this.serverController.start(config);

      if (result.success) {
        console.log(chalk.green(`✅ Server started successfully`));
        console.log(chalk.gray(`   Host: ${result.host}`));
        console.log(chalk.gray(`   Port: ${result.port}`));
        console.log(chalk.gray(`   PID: ${result.pid || 'N/A'}`));
        console.log(chalk.gray(`   Start Time: ${result.startTime.toISOString()}`));

        if (config.debug) {
          console.log(chalk.yellow('🔧 Debug mode enabled'));
        }
      } else {
        throw new CLIError('Server startup failed', {
          message: result.message,
        });
      }
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        module: 'cli',
        operation: 'start',
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * 执行停止命令
   */
  @ValidateInput({
    port: { type: 'number', required: false },
    force: { type: 'boolean', required: false },
    timeout: { type: 'number', required: false },
  })
  async executeStop(config: ServerStopConfig): Promise<void> {
    try {
      console.log(chalk.blue('🛑 Stopping RCC Server...'));

      // 检查服务器是否在运行
      const isRunning = await this.serverController.isRunning(config.port);
      if (!isRunning) {
        console.log(chalk.yellow('⚠️  Server is not running'));
        return;
      }

      // 停止服务器
      const result = await this.serverController.stop(config);

      if (result.success) {
        console.log(chalk.green('✅ Server stopped successfully'));
        console.log(chalk.gray(`   Stop Time: ${result.stopTime.toISOString()}`));
      } else {
        throw new CLIError('Server stop failed', {
          message: result.message,
        });
      }
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        module: 'cli',
        operation: 'stop',
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * 执行状态查询命令
   */
  @ValidateInput({
    port: { type: 'number', required: false },
    detailed: { type: 'boolean', required: false },
  })
  async executeStatus(config: ServerStatusConfig): Promise<void> {
    try {
      console.log(chalk.blue('📊 Checking RCC Server Status...'));

      const result = await this.serverController.getStatus(config);

      if (result.running) {
        console.log(chalk.green('✅ Server is running'));
        console.log(chalk.gray(`   Host: ${result.host}`));
        console.log(chalk.gray(`   Port: ${result.port}`));
        console.log(chalk.gray(`   PID: ${result.pid || 'N/A'}`));

        if (result.uptime) {
          console.log(chalk.gray(`   Uptime: ${Math.floor(result.uptime / 1000)}s`));
        }

        if (config.detailed && result.health) {
          console.log(chalk.cyan('\n🩺 Health Status:'));
          console.log(chalk.gray(`   Healthy: ${result.health.healthy ? 'Yes' : 'No'}`));
          console.log(chalk.gray(`   Last Check: ${result.health.lastCheck.toISOString()}`));

          result.health.checks.forEach(check => {
            const statusColor =
              check.status === 'pass' ? chalk.green : check.status === 'warn' ? chalk.yellow : chalk.red;
            console.log(chalk.gray(`   ${check.name}: ${statusColor(check.status)} (${check.duration}ms)`));
          });
        }

        if (config.detailed && result.memory) {
          console.log(chalk.cyan('\n💾 Memory Usage:'));
          console.log(chalk.gray(`   RSS: ${Math.round(result.memory.rss / 1024 / 1024)}MB`));
          console.log(chalk.gray(`   Heap Used: ${Math.round(result.memory.heapUsed / 1024 / 1024)}MB`));
          console.log(chalk.gray(`   Heap Total: ${Math.round(result.memory.heapTotal / 1024 / 1024)}MB`));
        }

        if (config.detailed && result.requests) {
          console.log(chalk.cyan('\n📈 Request Statistics:'));
          console.log(chalk.gray(`   Total: ${result.requests.total}`));
          console.log(chalk.gray(`   Successful: ${result.requests.successful}`));
          console.log(chalk.gray(`   Failed: ${result.requests.failed}`));
          console.log(chalk.gray(`   Avg Response Time: ${result.requests.averageResponseTime}ms`));
          console.log(chalk.gray(`   Requests/sec: ${result.requests.requestsPerSecond}`));
        }
      } else {
        console.log(chalk.red('❌ Server is not running'));
      }
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        module: 'cli',
        operation: 'status',
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * 执行代理配置命令
   */
  @ValidateInput({
    serverPort: { type: 'number', required: false },
    serverHost: { type: 'string', required: false },
    autoStart: { type: 'boolean', required: false },
    transparent: { type: 'boolean', required: false },
    exportEnv: { type: 'boolean', required: false },
  })
  async executeCode(config: ClientProxyConfig): Promise<void> {
    try {
      console.log(chalk.blue('🔌 Setting up client proxy...'));

      // 导入ClientProxy
      const { ClientProxy, EnvironmentExporter } = await import('./client-manager');

      const proxy = new ClientProxy();
      const envExporter = new EnvironmentExporter();

      // 启动代理
      await proxy.start(config);

      console.log(chalk.green('✅ Client proxy started'));

      if (config.exportEnv) {
        const shellCommands = envExporter.getShellCommands();
        console.log(chalk.cyan('\n🔧 Environment Setup Commands:'));
        shellCommands.forEach(cmd => {
          console.log(chalk.gray(`   ${cmd}`));
        });
      }

      // 设置优雅退出
      process.on('SIGINT', async () => {
        console.log(chalk.yellow('\n🛑 Shutting down proxy...'));
        await proxy.stop();
        process.exit(0);
      });

      console.log(chalk.gray('\nPress Ctrl+C to stop the proxy'));
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        module: 'cli',
        operation: 'code',
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * 执行配置管理命令
   */
  async executeConfig(action: ConfigAction, options: any): Promise<void> {
    try {
      switch (action) {
        case 'list':
          console.log(chalk.blue('📋 Available configurations:'));
          const configs = await this.configManager.listConfigs();
          configs.forEach(config => {
            console.log(chalk.gray(`   - ${config}`));
          });
          break;

        case 'validate':
          console.log(chalk.blue('🔍 Validating configuration...'));
          const configPath = options.path || this.configManager.getDefaultConfigPath();
          const configData = await this.configManager.loadConfig(configPath);
          const validation = this.configManager.validateConfig(configData);

          if (validation.valid) {
            console.log(chalk.green('✅ Configuration is valid'));
          } else {
            console.log(chalk.red('❌ Configuration validation failed'));
            validation.errors.forEach(error => {
              console.log(chalk.red(`   Error: ${error}`));
            });
            validation.warnings.forEach(warning => {
              console.log(chalk.yellow(`   Warning: ${warning}`));
            });
          }
          break;

        case 'reset':
          console.log(chalk.blue('🔄 Resetting configuration...'));
          await this.configManager.resetConfig();
          console.log(chalk.green('✅ Configuration reset successfully'));
          break;

        case 'show':
          console.log(chalk.blue('📄 Current configuration:'));
          const currentConfig = await this.configManager.loadConfig(options.path);
          console.log(JSON.stringify(currentConfig, null, 2));
          break;

        default:
          throw new CLIError(`Unknown config action: ${action}`);
      }
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        module: 'cli',
        operation: 'config',
        additionalData: { action, options },
        timestamp: new Date(),
      });
      throw error;
    }
  }
}

/**
 * CLI主程序
 */
export class CLI {
  constructor(
    private commandExecutor: ICommandExecutor,
    private errorHandler: ErrorHandler
  ) {
    this.setupCommands();
  }

  /**
   * 设置CLI命令
   */
  private setupCommands(): void {
    program.name('rcc4').description('Claude Code Router v4.0 - AI Provider Routing System').version('4.0.0-alpha.2');

    // 启动命令
    program
      .command('start')
      .description('Start the RCC server')
      .option('-p, --port <number>', 'Server port', parseInt)
      .option('-h, --host <string>', 'Server host', 'localhost')
      .option('-c, --config <path>', 'Configuration file path')
      .option('-d, --debug', 'Enable debug mode', false)
      .action(async options => {
        await this.executeWithErrorHandling(async () => {
          await this.commandExecutor.executeStart(options);
        });
      });

    // 停止命令
    program
      .command('stop')
      .description('Stop the RCC server')
      .option('-p, --port <number>', 'Server port', parseInt)
      .option('-f, --force', 'Force stop', false)
      .option('-t, --timeout <number>', 'Stop timeout in seconds', parseInt)
      .action(async options => {
        await this.executeWithErrorHandling(async () => {
          await this.commandExecutor.executeStop(options);
        });
      });

    // 状态命令
    program
      .command('status')
      .description('Check RCC server status')
      .option('-p, --port <number>', 'Server port', parseInt)
      .option('-d, --detailed', 'Show detailed status', false)
      .action(async options => {
        await this.executeWithErrorHandling(async () => {
          await this.commandExecutor.executeStatus(options);
        });
      });

    // 代理命令
    program
      .command('code')
      .description('Start client proxy for IDE integration')
      .option('-p, --server-port <number>', 'RCC server port', parseInt)
      .option('-h, --server-host <string>', 'RCC server host', 'localhost')
      .option('-a, --auto-start', 'Auto start server if not running', false)
      .option('-t, --transparent', 'Enable transparent proxy mode', false)
      .option('-e, --export-env', 'Export environment variables', true)
      .action(async options => {
        await this.executeWithErrorHandling(async () => {
          await this.commandExecutor.executeCode(options);
        });
      });

    // 配置命令
    const configCmd = program.command('config').description('Manage RCC configuration');

    configCmd
      .command('list')
      .description('List available configurations')
      .action(async () => {
        await this.executeWithErrorHandling(async () => {
          await this.commandExecutor.executeConfig('list', {});
        });
      });

    configCmd
      .command('validate')
      .description('Validate configuration')
      .option('-p, --path <path>', 'Configuration file path')
      .action(async options => {
        await this.executeWithErrorHandling(async () => {
          await this.commandExecutor.executeConfig('validate', options);
        });
      });

    configCmd
      .command('reset')
      .description('Reset configuration to defaults')
      .action(async () => {
        await this.executeWithErrorHandling(async () => {
          await this.commandExecutor.executeConfig('reset', {});
        });
      });

    configCmd
      .command('show')
      .description('Show current configuration')
      .option('-p, --path <path>', 'Configuration file path')
      .action(async options => {
        await this.executeWithErrorHandling(async () => {
          await this.commandExecutor.executeConfig('show', options);
        });
      });
  }

  /**
   * 执行命令并处理错误
   */
  private async executeWithErrorHandling(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      if (error instanceof CLIError || error instanceof RCCError) {
        console.error(chalk.red(`\n❌ ${error.message}`));
        if (error.details) {
          console.error(chalk.gray(`Details: ${JSON.stringify(error.details, null, 2)}`));
        }
      } else {
        console.error(chalk.red(`\n❌ Unexpected error: ${(error as Error).message}`));
      }
      process.exit(1);
    }
  }

  /**
   * 运行CLI
   */
  async run(argv?: string[]): Promise<void> {
    await program.parseAsync(argv);
  }
}

// 导出CLI相关类型和函数
export * from '../interfaces/core/cli-abstraction';
export { ClientProxy, EnvironmentExporter } from './client-manager';
export { ServerController } from './server-controller';
export { ConfigManager } from './config-manager';
