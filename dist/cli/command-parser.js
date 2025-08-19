"use strict";
/**
 * CLI命令解析器
 *
 * 负责解析命令行参数并转换为标准化的命令对象
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandParser = void 0;
/**
 * CLI命令解析器实现
 */
class CommandParser {
    constructor(commandExecutor) {
        this.commands = new Map();
        this.commandExecutor = commandExecutor;
        this.initializeCommands();
    }
    /**
     * 解析命令行参数
     */
    parseArguments(args) {
        if (args.length === 0) {
            throw new Error('No command provided. Use --help for usage information.');
        }
        // 处理全局选项
        if (args.includes('--help') || args.includes('-h')) {
            return { command: 'help', options: {}, args: args.slice(1) };
        }
        if (args.includes('--version') || args.includes('-V')) {
            return { command: 'version', options: {}, args: [] };
        }
        const [command, ...remainingArgs] = args;
        if (!command) {
            throw new Error('No command provided. Use --help for usage information.');
        }
        const commandDef = this.commands.get(command);
        if (!commandDef) {
            throw new Error(`Unknown command: ${command}. Use --help for available commands.`);
        }
        const { options, args: parsedArgs, subcommand } = this.parseOptions(commandDef, remainingArgs);
        return {
            command,
            subcommand,
            options,
            args: parsedArgs,
        };
    }
    /**
     * 执行命令
     */
    async executeCommand(command) {
        // 处理不需要命令执行器的命令
        switch (command.command) {
            case 'help':
                this.showHelp(command.args[0]);
                return;
            case 'version':
                this.showVersion();
                return;
        }
        // 其他命令需要命令执行器
        if (!this.commandExecutor) {
            throw new Error('Command executor not available. CLI is in parse-only mode.');
        }
        switch (command.command) {
            case 'start':
                await this.commandExecutor.executeStart(command.options);
                break;
            case 'stop':
                await this.commandExecutor.executeStop(command.options);
                break;
            case 'code':
                await this.commandExecutor.executeCode(command.options);
                break;
            case 'status':
                await this.commandExecutor.executeStatus(command.options);
                break;
            case 'config':
                await this.executeConfigCommand(command);
                break;
            default:
                throw new Error(`Command execution not implemented: ${command.command}`);
        }
    }
    /**
     * 显示帮助信息
     */
    showHelp(command) {
        if (command && this.commands.has(command)) {
            this.showCommandHelp(this.commands.get(command));
        }
        else {
            this.showGeneralHelp();
        }
    }
    /**
     * 显示版本信息
     */
    showVersion() {
        console.log('RCC (Route Claude Code) v4.0.0-alpha.1');
        console.log('Copyright (c) 2025 Jason Zhang');
        console.log('Licensed under MIT License');
    }
    /**
     * 初始化命令定义
     */
    initializeCommands() {
        this.commands.set('start', {
            name: 'start',
            description: 'Start the RCC proxy server',
            options: [
                { name: 'port', alias: 'p', type: 'number', description: 'Server port (default: 3456)' },
                { name: 'host', alias: 'H', type: 'string', description: 'Server host (default: localhost)' },
                { name: 'config', alias: 'c', type: 'string', description: 'Configuration file path' },
                { name: 'debug', alias: 'd', type: 'boolean', description: 'Enable debug mode' },
            ],
            examples: ['rcc start', 'rcc start --port 3457 --debug', 'rcc start --config /path/to/config.json'],
        });
        this.commands.set('stop', {
            name: 'stop',
            description: 'Stop the RCC proxy server',
            options: [
                { name: 'port', alias: 'p', type: 'number', description: 'Server port to stop' },
                { name: 'force', alias: 'f', type: 'boolean', description: 'Force stop without graceful shutdown' },
            ],
            examples: ['rcc stop', 'rcc stop --port 3457', 'rcc stop --force'],
        });
        this.commands.set('code', {
            name: 'code',
            description: 'Start Claude Code client mode (transparent proxy)',
            options: [
                { name: 'port', alias: 'p', type: 'number', description: 'Connect to server port (default: 3456)' },
                { name: 'auto-start', alias: 'a', type: 'boolean', description: 'Auto start server if not running' },
                { name: 'export', alias: 'e', type: 'boolean', description: 'Export configuration for environment variables' },
            ],
            examples: ['rcc code', 'rcc code --port 3457', 'rcc code --auto-start'],
        });
        this.commands.set('status', {
            name: 'status',
            description: 'Show server status and health information',
            options: [
                { name: 'port', alias: 'p', type: 'number', description: 'Server port to check' },
                { name: 'detailed', alias: 'd', type: 'boolean', description: 'Show detailed status information' },
            ],
            examples: ['rcc status', 'rcc status --detailed', 'rcc status --port 3457'],
        });
        this.commands.set('config', {
            name: 'config',
            description: 'Manage RCC configuration',
            options: [
                { name: 'list', alias: 'l', type: 'boolean', description: 'List all configuration files' },
                { name: 'validate', alias: 'v', type: 'boolean', description: 'Validate configuration file' },
                { name: 'reset', alias: 'r', type: 'boolean', description: 'Reset to default configuration' },
                { name: 'path', alias: 'p', type: 'string', description: 'Configuration file path' },
            ],
            examples: ['rcc config --list', 'rcc config --validate --path config.json', 'rcc config --reset'],
        });
    }
    /**
     * 解析选项和参数
     */
    parseOptions(commandDef, args) {
        const options = {};
        const remainingArgs = [];
        let subcommand;
        // 设置默认值
        for (const option of commandDef.options) {
            if (option.default !== undefined) {
                options[this.camelCase(option.name)] = option.default;
            }
        }
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (!arg) {
                continue;
            }
            if (arg.startsWith('--')) {
                // 长选项
                const [name, value] = arg.substring(2).split('=', 2);
                const optionDef = commandDef.options.find(o => o.name === name);
                if (!optionDef) {
                    throw new Error(`Unknown option: --${name}`);
                }
                const optionValue = this.parseOptionValue(optionDef, value, args, i);
                options[this.camelCase(name)] = optionValue.value;
                i = optionValue.nextIndex;
            }
            else if (arg.startsWith('-') && arg.length > 1) {
                // 短选项
                const alias = arg.substring(1);
                const optionDef = commandDef.options.find(o => o.alias === alias);
                if (!optionDef) {
                    throw new Error(`Unknown option: -${alias}`);
                }
                const optionValue = this.parseOptionValue(optionDef, undefined, args, i);
                options[this.camelCase(optionDef.name)] = optionValue.value;
                i = optionValue.nextIndex;
            }
            else {
                // 位置参数或子命令
                if (!subcommand && commandDef.subcommands?.some(s => s.name === arg)) {
                    subcommand = arg;
                }
                else {
                    remainingArgs.push(arg);
                }
            }
        }
        // 验证必需选项
        for (const option of commandDef.options) {
            if (option.required && !(this.camelCase(option.name) in options)) {
                throw new Error(`Missing required option: --${option.name}`);
            }
        }
        return { options, args: remainingArgs, subcommand };
    }
    /**
     * 解析选项值
     */
    parseOptionValue(optionDef, value, args, currentIndex) {
        let nextIndex = currentIndex;
        if (optionDef.type === 'boolean') {
            return { value: true, nextIndex };
        }
        if (value === undefined) {
            if (currentIndex + 1 >= args.length) {
                throw new Error(`Option --${optionDef.name} requires a value`);
            }
            const nextValue = args[currentIndex + 1];
            if (!nextValue) {
                throw new Error(`Option --${optionDef.name} requires a value`);
            }
            value = nextValue;
            nextIndex = currentIndex + 1;
        }
        switch (optionDef.type) {
            case 'string':
                return { value, nextIndex };
            case 'number':
                const numValue = parseInt(value, 10);
                if (isNaN(numValue)) {
                    throw new Error(`Option --${optionDef.name} must be a number`);
                }
                return { value: numValue, nextIndex };
            default:
                throw new Error(`Unknown option type: ${optionDef.type}`);
        }
    }
    /**
     * 转换为驼峰命名
     */
    camelCase(str) {
        return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    }
    /**
     * 显示通用帮助信息
     */
    showGeneralHelp() {
        console.log('RCC (Route Claude Code) v4.0.0-alpha.1');
        console.log('');
        console.log('USAGE:');
        console.log('  rcc <command> [options]');
        console.log('');
        console.log('COMMANDS:');
        for (const [name, def] of this.commands.entries()) {
            console.log(`  ${name.padEnd(12)} ${def.description}`);
        }
        console.log('');
        console.log('GLOBAL OPTIONS:');
        console.log('  -h, --help       Show help information');
        console.log('  -V, --version    Show version information');
        console.log('');
        console.log('Use "rcc <command> --help" for more information about a command.');
    }
    /**
     * 显示具体命令帮助
     */
    showCommandHelp(commandDef) {
        console.log(`RCC ${commandDef.name}`);
        console.log('');
        console.log('DESCRIPTION:');
        console.log(`  ${commandDef.description}`);
        console.log('');
        console.log('USAGE:');
        console.log(`  rcc ${commandDef.name} [options]`);
        console.log('');
        if (commandDef.options.length > 0) {
            console.log('OPTIONS:');
            for (const option of commandDef.options) {
                const short = option.alias ? `-${option.alias}, ` : '    ';
                const long = `--${option.name}`;
                const name = `${short}${long}`;
                console.log(`  ${name.padEnd(20)} ${option.description}`);
            }
            console.log('');
        }
        if (commandDef.examples && commandDef.examples.length > 0) {
            console.log('EXAMPLES:');
            for (const example of commandDef.examples) {
                console.log(`  ${example}`);
            }
            console.log('');
        }
    }
    /**
     * 执行配置命令
     */
    async executeConfigCommand(command) {
        if (!this.commandExecutor) {
            throw new Error('Command executor not available');
        }
        const options = command.options;
        // 确定配置操作类型
        let action = 'show';
        if (options.list) {
            action = 'list';
        }
        else if (options.validate) {
            action = 'validate';
        }
        else if (options.reset) {
            action = 'reset';
        }
        await this.commandExecutor.executeConfig(action, options);
    }
}
exports.CommandParser = CommandParser;
//# sourceMappingURL=command-parser.js.map