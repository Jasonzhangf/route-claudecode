#!/usr/bin/env node

/**
 * RCC v4.0 CLI入口 - 统一CLI系统
 *
 * 遵循.claude/rules/unified-cli-config-template.md永久模板规则
 * 使用UnifiedCLI和UnifiedConfigLoader实现配置统一化
 *
 * @author Jason Zhang
 */

import { UnifiedCLI } from './cli/unified-cli';
import {
  ParsedCommand,
  CLIHandler,
  StartOptions,
  StopOptions,
  CodeOptions,
  StatusOptions,
} from './interfaces/client/cli-interface';
import { secureLogger } from './utils/secure-logger';

/**
 * 参数解析器
 */
class ArgumentParser {
  /**
   * 解析命令行参数
   */
  parseArguments(args: string[]): ParsedCommand {
    const command = args[0] || 'help';
    const options: Record<string, any> = {};
    const remainingArgs: string[] = [];

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg.startsWith('--')) {
        const key = arg.slice(2);

        if (nextArg && !nextArg.startsWith('--')) {
          // 参数有值
          const value = this.parseValue(nextArg);
          options[key] = value;
          i++; // 跳过下一个参数
        } else {
          // 布尔标志
          options[key] = true;
        }
      } else if (arg.startsWith('-')) {
        // 短参数
        const key = arg.slice(1);
        options[key] = true;
      } else {
        remainingArgs.push(arg);
      }
    }

    return {
      command,
      options,
      args: remainingArgs,
    };
  }

  /**
   * 解析参数值
   */
  private parseValue(value: string): any {
    // 数字
    if (/^\d+$/.test(value)) {
      return parseInt(value, 10);
    }

    // 布尔值
    if (value === 'true') return true;
    if (value === 'false') return false;

    // 字符串
    return value;
  }
}

/**
 * CLI处理器实现
 */
class RCCv4CLIHandler implements CLIHandler {
  private unifiedCLI: UnifiedCLI;
  private argumentParser: ArgumentParser;

  constructor() {
    this.unifiedCLI = new UnifiedCLI();
    this.argumentParser = new ArgumentParser();
  }

  /**
   * 解析命令行参数
   */
  parseArguments(args: string[]): ParsedCommand {
    return this.argumentParser.parseArguments(args);
  }

  /**
   * 执行命令
   */
  async executeCommand(parsedCommand: ParsedCommand): Promise<void> {
    const { command, options } = parsedCommand;

    try {
      switch (command) {
        case 'start':
          await this.handleStart(options);
          break;

        case 'stop':
          await this.handleStop(options);
          break;

        case 'status':
          await this.handleStatus(options);
          break;

        case 'code':
          await this.handleCode(options);
          break;

        case 'config':
          await this.handleConfig(options);
          break;

        case 'help':
        case '--help':
        case '-h':
          this.showHelp();
          break;

        case 'version':
        case '--version':
        case '-v':
          this.showVersion();
          break;

        default:
          secureLogger.warn('Unknown command', { command });
          this.showHelp();
          process.exit(1);
      }
    } catch (error) {
      secureLogger.error('Command execution failed', {
        command,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 处理start命令
   */
  private async handleStart(options: Record<string, any>): Promise<void> {
    const startOptions: StartOptions = {
      port: options.port,
      host: options.host,
      config: options.config,
      debug: options.debug,
    };

    await this.unifiedCLI.start(startOptions);
  }

  /**
   * 处理stop命令
   */
  private async handleStop(options: Record<string, any>): Promise<void> {
    const stopOptions: StopOptions = {
      port: options.port,
      force: options.force,
    };

    await this.unifiedCLI.stop(stopOptions);
  }

  /**
   * 处理status命令
   */
  private async handleStatus(options: Record<string, any>): Promise<void> {
    const statusOptions: StatusOptions = {
      port: options.port,
      detailed: options.detailed,
    };

    const status = await this.unifiedCLI.status(statusOptions);

    // 输出状态信息
    process.stdout.write('RCC v4.0 Server Status:\n');
    process.stdout.write(`  Running: ${status.isRunning}\n`);
    process.stdout.write(`  Host: ${status.host}\n`);
    process.stdout.write(`  Port: ${status.port}\n`);
    process.stdout.write(`  Version: ${status.version}\n`);

    if (status.isRunning) {
      process.stdout.write(`  Uptime: ${status.uptime}\n`);
      process.stdout.write(`  Health: ${status.health.status}\n`);
      process.stdout.write(`  Active Pipelines: ${status.activePipelines}\n`);
      process.stdout.write(`  Total Requests: ${status.totalRequests}\n`);

      if (statusOptions.detailed && status.pipeline) {
        process.stdout.write(`  Active Requests: ${status.pipeline.activeRequests}\n`);
      }
    }
  }

  /**
   * 处理code命令
   */
  private async handleCode(options: Record<string, any>): Promise<void> {
    const codeOptions: CodeOptions = {
      port: options.port,
      autoStart: options.autoStart || options['auto-start'],
      export: options.export,
    };

    await this.unifiedCLI.code(codeOptions);
  }

  /**
   * 处理config命令
   */
  private async handleConfig(options: Record<string, any>): Promise<void> {
    await this.unifiedCLI.config(options);
  }

  /**
   * 显示帮助信息
   */
  showHelp(command?: string): void {
    if (command) {
      this.showCommandHelp(command);
      return;
    }

    process.stdout.write(`
RCC v4.0 - Route Claude Code Server

Usage:
  rcc4 <command> [options]

Commands:
  start                    Start RCC v4.0 server
  stop                     Stop RCC v4.0 server  
  status                   Show server status
  code                     Start Claude Code proxy mode
  config                   Configuration management
  help [command]           Show help information
  version                  Show version information

Options:
  --config <path>          Configuration file path
  --port <number>          Server port (default: 5506)
  --host <host>            Server host (default: 0.0.0.0)
  --debug                  Enable debug mode
  --force                  Force operation (for stop command)
  --detailed               Show detailed information (for status command)
  --auto-start             Auto-start server if needed (for code command)
  --export                 Export environment variables (for code command)

Examples:
  rcc4 start --config ./config.json --port 5506 --debug
  rcc4 stop --port 5506 --force
  rcc4 status --port 5506 --detailed
  rcc4 code --port 5506 --auto-start
  rcc4 code --export

For more information about each command, use:
  rcc4 help <command>
`);
  }

  /**
   * 显示特定命令的帮助
   */
  private showCommandHelp(command: string): void {
    switch (command) {
      case 'start':
        process.stdout.write(`
rcc4 start - Start RCC v4.0 server

Usage:
  rcc4 start [options]

Options:
  --config <path>     Configuration file path (default: ./config.json)
  --port <number>     Server port (default: 5506)
  --host <host>       Server host (default: 0.0.0.0)
  --debug             Enable debug mode with detailed logging

Examples:
  rcc4 start
  rcc4 start --config ~/.route-claudecode/config.json
  rcc4 start --port 8080 --debug
`);
        break;

      case 'stop':
        process.stdout.write(`
rcc4 stop - Stop RCC v4.0 server

Usage:
  rcc4 stop [options]

Options:
  --port <number>     Server port (default: 5506)
  --force             Force stop even if graceful shutdown fails

Examples:
  rcc4 stop
  rcc4 stop --port 8080
  rcc4 stop --force
`);
        break;

      case 'status':
        process.stdout.write(`
rcc4 status - Show server status

Usage:
  rcc4 status [options]

Options:
  --port <number>     Server port (default: 5506)
  --detailed          Show detailed pipeline information

Examples:
  rcc4 status
  rcc4 status --port 8080
  rcc4 status --detailed
`);
        break;

      case 'code':
        process.stdout.write(`
rcc4 code - Start Claude Code proxy mode

Usage:
  rcc4 code [options]

Options:
  --port <number>     RCC proxy server port (default: 5506)
  --auto-start        Auto-start RCC server if not running
  --export            Export environment variables instead of starting Claude Code

Examples:
  rcc4 code
  rcc4 code --port 8080
  rcc4 code --auto-start
  rcc4 code --export
`);
        break;

      default:
        process.stdout.write(`Unknown command: ${command}\n`);
        this.showHelp();
    }
  }

  /**
   * 显示版本信息
   */
  showVersion(): void {
    process.stdout.write('RCC v4.0.0\n');
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const cliHandler = new RCCv4CLIHandler();

  try {
    const args = process.argv.slice(2);
    const parsedCommand = cliHandler.parseArguments(args);

    secureLogger.info('CLI command executed', {
      command: parsedCommand.command,
      hasOptions: Object.keys(parsedCommand.options).length > 0,
    });

    await cliHandler.executeCommand(parsedCommand);
  } catch (error) {
    secureLogger.error('CLI execution failed', { error: error.message });
    process.exit(1);
  }
}

// 优雅关闭处理
process.on('SIGTERM', () => {
  secureLogger.info('Received SIGTERM, exiting gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  secureLogger.info('Received SIGINT, exiting gracefully');
  process.exit(0);
});

// 未捕获异常处理
process.on('uncaughtException', error => {
  secureLogger.error('Uncaught exception', { error: error.message });
  process.exit(1);
});

process.on('unhandledRejection', reason => {
  secureLogger.error('Unhandled rejection', { reason });
  process.exit(1);
});

// 执行主函数
if (require.main === module) {
  main().catch(error => {
    secureLogger.error('Fatal error in main', { error: error.message });
    process.exit(1);
  });
}

export { RCCv4CLIHandler };
