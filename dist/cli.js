#!/usr/bin/env node
"use strict";
/**
 * RCC v4.0 CLI入口 - 统一CLI系统
 *
 * 遵循.claude/rules/unified-cli-config-template.md永久模板规则
 * 使用UnifiedCLI和ConfigReader实现配置统一化
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RCCv4CLIHandler = void 0;
const rcc_cli_1 = require("./cli/rcc-cli");
const secure_logger_1 = require("./utils/secure-logger");
const jq_json_handler_1 = require("./utils/jq-json-handler");
/**
 * 参数解析器
 */
class ArgumentParser {
    /**
     * 解析命令行参数
     */
    parseArguments(args) {
        const command = args[0] || 'help';
        const options = {};
        const remainingArgs = [];
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
                }
                else {
                    // 布尔标志
                    options[key] = true;
                }
            }
            else if (arg.startsWith('-')) {
                // 短参数
                const key = arg.slice(1);
                options[key] = true;
            }
            else {
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
    parseValue(value) {
        // 数字
        if (/^\d+$/.test(value)) {
            return parseInt(value, 10);
        }
        // 布尔值
        if (value === 'true')
            return true;
        if (value === 'false')
            return false;
        // 字符串
        return value;
    }
}
/**
 * CLI处理器实现
 */
class RCCv4CLIHandler {
    constructor() {
        this.rccCLI = new rcc_cli_1.RCCCli();
        this.argumentParser = new ArgumentParser();
    }
    /**
     * 解析命令行参数
     */
    parseArguments(args) {
        return this.argumentParser.parseArguments(args);
    }
    /**
     * 执行命令
     */
    async executeCommand(parsedCommand) {
        const { command, options } = parsedCommand;
        process.stdout.write(`🔍 [DEBUG] 执行命令: ${command}\n`);
        try {
            switch (command) {
                case 'start':
                    process.stdout.write('🔍 [DEBUG] 处理start命令\n');
                    await this.handleStart(options);
                    break;
                case 'stop':
                    process.stdout.write('🔍 [DEBUG] 处理stop命令\n');
                    await this.handleStop(options);
                    break;
                case 'status':
                    process.stdout.write('🔍 [DEBUG] 处理status命令\n');
                    await this.handleStatus(options);
                    break;
                case 'code':
                    process.stdout.write('🔍 [DEBUG] 处理code命令\n');
                    await this.handleCode(options);
                    break;
                case 'config':
                    process.stdout.write('🔍 [DEBUG] 处理config命令\n');
                    await this.handleConfig(options);
                    break;
                case 'auth':
                    process.stdout.write('🔍 [DEBUG] 处理auth命令\n');
                    await this.handleAuth(parsedCommand.args, options);
                    break;
                case 'provider':
                    process.stdout.write('🔍 [DEBUG] 处理provider命令\n');
                    await this.handleProvider(parsedCommand.args, options);
                    break;
                case 'help':
                case '--help':
                case '-h':
                    process.stdout.write('🔍 [DEBUG] 处理help命令\n');
                    this.showHelp();
                    break;
                case 'version':
                case '--version':
                case '-v':
                    process.stdout.write('🔍 [DEBUG] 处理version命令\n');
                    this.showVersion();
                    break;
                default:
                    process.stdout.write(`🔍 [DEBUG] 未知命令: ${command}\n`);
                    secure_logger_1.secureLogger.warn('Unknown command', { command });
                    this.showHelp();
                    process.exit(1);
            }
            process.stdout.write(`🔍 [DEBUG] 命令${command}执行完成\n`);
        }
        catch (error) {
            process.stderr.write(`❌ [DEBUG] 命令${command}执行失败: ${error.message}\n`);
            process.stderr.write(`❌ [DEBUG] 错误堆栈: ${error.stack}\n`);
            secure_logger_1.secureLogger.error('Command execution failed', {
                command,
                error: error.message,
            });
            throw error;
        }
    }
    /**
     * 处理start命令
     */
    async handleStart(options) {
        process.stdout.write('🔍 [DEBUG] handleStart开始\n');
        const startOptions = {
            port: options.port,
            host: options.host,
            config: options.config,
            debug: options.debug,
        };
        process.stdout.write(`🔍 [DEBUG] start选项: ${jq_json_handler_1.JQJsonHandler.stringifyJson(startOptions)}\n`);
        process.stdout.write('🔍 [DEBUG] 调用unifiedCLI.start()\n');
        await this.rccCLI.start(startOptions);
        process.stdout.write('🔍 [DEBUG] unifiedCLI.start()完成\n');
    }
    /**
     * 处理stop命令
     */
    async handleStop(options) {
        const stopOptions = {
            port: options.port,
            force: options.force,
        };
        await this.rccCLI.stop(stopOptions);
    }
    /**
     * 处理status命令
     */
    async handleStatus(options) {
        const statusOptions = {
            port: options.port,
            detailed: options.detailed,
        };
        const status = await this.rccCLI.status(statusOptions);
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
    async handleCode(options) {
        const codeOptions = {
            port: options.port,
            autoStart: options.autoStart || options['auto-start'],
            export: options.export,
        };
        await this.rccCLI.code(codeOptions);
    }
    /**
     * 处理config命令
     */
    async handleConfig(options) {
        await this.rccCLI.config(options);
    }
    /**
     * 处理auth命令
     */
    async handleAuth(args, options) {
        const provider = args[0];
        const index = args[1] ? parseInt(args[1], 10) : undefined;
        process.stdout.write(`🔍 [DEBUG] handleAuth: provider=${provider}, index=${index}, options=${jq_json_handler_1.JQJsonHandler.stringifyJson(options)}\n`);
        await this.rccCLI.auth(provider, index, options);
    }
    /**
     * 处理provider命令
     */
    async handleProvider(args, options) {
        const subcommand = args[0];
        if (!subcommand) {
            process.stderr.write('❌ Provider subcommand is required. Usage: rcc4 provider <subcommand>\n');
            process.stderr.write('Available subcommands: update\n');
            process.stderr.write('Use --help for more information.\n');
            process.exit(1);
        }
        process.stdout.write(`🔍 [DEBUG] handleProvider: subcommand=${subcommand}, options=${jq_json_handler_1.JQJsonHandler.stringifyJson(options)}\n`);
        switch (subcommand) {
            case 'update':
                await this.handleProviderUpdate(options);
                break;
            default:
                process.stderr.write(`❌ Unknown provider subcommand: ${subcommand}\n`);
                process.stderr.write('Available subcommands: update\n');
                process.exit(1);
        }
    }
    /**
     * 处理provider update命令
     */
    async handleProviderUpdate(options) {
        // 检查必需的配置文件参数
        if (!options.config) {
            process.stderr.write('❌ Configuration file path is required. Use --config <path>\n');
            process.stderr.write('Example: rcc4 provider update --config ~/.route-claudecode/config/multi-provider-hybrid-v4.json\n');
            process.exit(1);
        }
        process.stdout.write(`🔄 Updating provider models and capabilities...\n`);
        process.stdout.write(`📋 Configuration: ${options.config}\n`);
        try {
            // 使用 RCCCli 的 provider update 功能
            await this.rccCLI.providerUpdate(options);
            process.stdout.write('✅ Provider update completed successfully\n');
        }
        catch (error) {
            process.stderr.write(`❌ Provider update failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
            if (options.verbose) {
                process.stderr.write(`Stack trace: ${error instanceof Error ? error.stack : 'N/A'}\n`);
            }
            process.exit(1);
        }
    }
    /**
     * 显示帮助信息
     */
    showHelp(command) {
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
  auth <provider> <index>  Manage provider authentication (OAuth2, API keys)
  provider <subcommand>    Manage provider configurations and model discovery
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
  rcc4 auth qwen 1
  rcc4 auth qwen --list
  rcc4 auth qwen 2 --remove

For more information about each command, use:
  rcc4 help <command>
`);
    }
    /**
     * 显示特定命令的帮助
     */
    showCommandHelp(command) {
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
            case 'provider':
                process.stdout.write(`
rcc4 provider - Manage provider configurations and model discovery

Usage:
  rcc4 provider <subcommand> [options]

Subcommands:
  update              Update provider models and capabilities

Options:
  --config <path>     Configuration file path (required)
  --all               Update all providers
  --provider <name>   Update specific provider only  
  --dry-run           Show what would be updated without making changes
  --verbose           Show detailed output

Examples:
  rcc4 provider update --config ~/.route-claudecode/config/multi-provider-hybrid-v4.json
  rcc4 provider update --config ./config.json --verbose
  rcc4 provider update --config ./config.json --dry-run
  rcc4 provider update --config ./config.json --provider qwen
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
    showVersion() {
        process.stdout.write('RCC v4.0.0\n');
    }
}
exports.RCCv4CLIHandler = RCCv4CLIHandler;
/**
 * 主函数
 */
async function main() {
    process.stdout.write('🔍 [DEBUG] RCC4 CLI启动\n');
    const cliHandler = new RCCv4CLIHandler();
    process.stdout.write('🔍 [DEBUG] CLI处理器创建成功\n');
    try {
        const args = process.argv.slice(2);
        process.stdout.write(`🔍 [DEBUG] 解析参数: ${args.join(' ')}\n`);
        const parsedCommand = cliHandler.parseArguments(args);
        process.stdout.write(`🔍 [DEBUG] 命令解析成功: ${parsedCommand.command}\n`);
        secure_logger_1.secureLogger.info('CLI command executed', {
            command: parsedCommand.command,
            hasOptions: Object.keys(parsedCommand.options).length > 0,
        });
        process.stdout.write('🔍 [DEBUG] 开始执行命令...\n');
        await cliHandler.executeCommand(parsedCommand);
        process.stdout.write('🔍 [DEBUG] 命令执行完成\n');
    }
    catch (error) {
        process.stderr.write(`❌ [DEBUG] CLI执行失败: ${error.message}\n`);
        process.stderr.write(`❌ [DEBUG] 错误堆栈: ${error.stack}\n`);
        secure_logger_1.secureLogger.error('CLI execution failed', { error: error.message });
        process.exit(1);
    }
}
// 优雅关闭处理
let isShuttingDown = false;
process.on('SIGTERM', async () => {
    if (isShuttingDown)
        return;
    isShuttingDown = true;
    secure_logger_1.secureLogger.info('Received SIGTERM, exiting gracefully');
    try {
        // 尝试优雅关闭任何正在运行的服务器实例
        await gracefulShutdown();
        process.exit(0);
    }
    catch (error) {
        secure_logger_1.secureLogger.error('Error during graceful shutdown', { error: error.message });
        process.exit(1);
    }
});
process.on('SIGINT', async () => {
    if (isShuttingDown)
        return;
    isShuttingDown = true;
    secure_logger_1.secureLogger.info('Received SIGINT, exiting gracefully');
    try {
        // 尝试优雅关闭任何正在运行的服务器实例
        await gracefulShutdown();
        process.exit(0);
    }
    catch (error) {
        secure_logger_1.secureLogger.error('Error during graceful shutdown', { error: error.message });
        process.exit(1);
    }
});
/**
 * 优雅关闭函数
 */
async function gracefulShutdown() {
    secure_logger_1.secureLogger.info('开始优雅关闭流程');
    // 设置超时，防止关闭过程无限期等待
    const shutdownTimeout = setTimeout(() => {
        secure_logger_1.secureLogger.warn('优雅关闭超时，强制退出');
        process.exit(1);
    }, 10000); // 10秒超时
    try {
        // 如果有全局的PipelineLifecycleManager实例，关闭它
        const globalManager = global.pipelineLifecycleManager;
        if (globalManager && typeof globalManager.stop === 'function') {
            secure_logger_1.secureLogger.info('正在停止PipelineLifecycleManager...');
            await globalManager.stop();
        }
        // 等待一小段时间确保资源完全释放
        await new Promise(resolve => setTimeout(resolve, 1000));
        clearTimeout(shutdownTimeout);
        secure_logger_1.secureLogger.info('优雅关闭完成');
    }
    catch (error) {
        clearTimeout(shutdownTimeout);
        secure_logger_1.secureLogger.error('优雅关闭过程中出错', { error: error.message });
        throw error;
    }
}
// 未捕获异常处理
process.on('uncaughtException', error => {
    secure_logger_1.secureLogger.error('Uncaught exception', { error: error.message });
    process.exit(1);
});
process.on('unhandledRejection', reason => {
    secure_logger_1.secureLogger.error('Unhandled rejection', { reason });
    process.exit(1);
});
// 执行主函数
if (require.main === module) {
    main().catch(error => {
        secure_logger_1.secureLogger.error('Fatal error in main', { error: error.message });
        process.exit(1);
    });
}
//# sourceMappingURL=cli.js.map