/**
 * CLI Commands - 定义所有Commander.js命令和参数解析
 */

import { Command } from 'commander';
import { CLIConfigManager } from './cli-config-manager';
import { ServerManager } from './server-manager';
import { ConnectionManager } from './connection-manager';
import { getServerPort, getServerHost } from './constants';

export class CLICommands {
  private static readonly VERSION = '4.0.0-alpha.2';

  /**
   * 设置CLI程序和所有命令
   */
  static setupProgram(): Command {
    const program = new Command();

    program.name('rcc4').description('Route Claude Code v4.0 - 高性能多AI提供商路由系统').version(this.VERSION);

    // 注册所有命令
    this.registerStartCommand(program);
    this.registerCodeCommand(program);
    this.registerTestCommand(program);
    this.registerStopCommand(program);
    this.registerStatusCommand(program);

    return program;
  }

  /**
   * 注册start命令 - 启动服务器模式
   */
  private static registerStartCommand(program: Command): void {
    program
      .command('start')
      .description('启动RCC服务器 (阻塞式运行)')
      .option('-p, --port <port>', '服务器端口 (覆盖配置文件)')
      .option('-h, --host <host>', '服务器主机 (覆盖配置文件)')
      .option('-c, --config <path>', '配置文件路径')
      .option('-d, --debug', '启用调试模式')
      .action(async options => {
        try {
          // 加载配置
          const { config } = await CLIConfigManager.loadConfig(options.config);

          // 解析服务器设置
          const serverInfo = CLIConfigManager.resolveServerSettings(config, options.port, options.host);

          // 启动服务器
          await ServerManager.startServer(config, serverInfo, options);
        } catch (error) {
          this.handleConfigError(error as Error);
        }
      });
  }

  /**
   * 注册code命令 - 连接Claude Code
   */
  private static registerCodeCommand(program: Command): void {
    program
      .command('code')
      .description('连接Claude Code到RCC服务器')
      .option('-p, --port <port>', '服务器端口', getServerPort().toString())
      .option('-h, --host <host>', '服务器主机', getServerHost())
      .action(async options => {
        await ConnectionManager.connectClaudeCode(options);
      });
  }

  /**
   * 注册test命令 - 测试Provider连接
   */
  private static registerTestCommand(program: Command): void {
    program
      .command('test')
      .description('测试Provider连接性')
      .option('-c, --config <path>', '配置文件路径')
      .action(async options => {
        await ConnectionManager.testProviderConnectivity(options.config);
      });
  }

  /**
   * 注册stop命令 - 停止服务器
   */
  private static registerStopCommand(program: Command): void {
    program
      .command('stop')
      .description('停止RCC服务器')
      .option('-p, --port <port>', '服务器端口 (可选，默认停止所有)', '')
      .option('-f, --force', '强制停止')
      .action(async options => {
        await ServerManager.stopServer({
          port: options.port,
          force: options.force,
        });
      });
  }

  /**
   * 注册status命令 - 查看状态
   */
  private static registerStatusCommand(program: Command): void {
    program
      .command('status')
      .description('查看RCC服务器状态')
      .option('-p, --port <port>', '服务器端口', getServerPort().toString())
      .action(async options => {
        const port = getServerPort(parseInt(options.port) || undefined);
        await ServerManager.checkServerStatus(port);
      });
  }

  /**
   * 处理配置错误
   */
  private static handleConfigError(error: Error): void {
    if (error.message === 'CONFIG_NOT_FOUND') {
      CLIConfigManager.displayConfigHelp();
      process.exit(1);
    } else if (error.message.startsWith('CONFIG_FILE_NOT_EXISTS:')) {
      const configPath = error.message.replace('CONFIG_FILE_NOT_EXISTS: ', '');
      console.error(`❌ Config file not found: ${configPath}`);
      process.exit(1);
    } else if (error.message.startsWith('CONFIG_PARSE_ERROR:')) {
      const parseError = error.message.replace('CONFIG_PARSE_ERROR: ', '');
      console.error(`❌ Config file error: ${parseError}`);
      process.exit(1);
    } else {
      console.error(`❌ Unexpected error: ${error.message}`);
      process.exit(1);
    }
  }
}
