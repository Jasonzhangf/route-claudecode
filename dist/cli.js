#!/usr/bin/env node
"use strict";
/**
 * RCC4 CLI Entry Point
 * Claude Code Router v4.0 Command Line Interface
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const src_1 = require("./modules/bootstrap/src");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * 端口管理工具类
 * 提供端口占用检测和进程清理功能
 */
class PortManager {
    /**
     * 检查端口是否被占用
     * @param port 端口号
     * @returns 是否被占用
     */
    static async isPortInUse(port) {
        try {
            const result = await execAsync(`lsof -i :${port}`);
            return result.stdout.trim().length > 0;
        }
        catch (error) {
            // 命令执行失败通常表示端口未被占用
            return false;
        }
    }
    /**
     * 获取占用端口的进程信息
     * @param port 端口号
     * @returns 进程信息数组
     */
    static async getPortProcesses(port) {
        try {
            const result = await execAsync(`lsof -i :${port}`);
            const lines = result.stdout.trim().split('\n');
            // 跳过标题行，处理数据行
            const processes = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line) {
                    const parts = line.split(/\s+/);
                    if (parts.length >= 2) {
                        const command = parts[0];
                        const pid = parts[1];
                        processes.push({ pid, command });
                    }
                }
            }
            return processes;
        }
        catch (error) {
            return [];
        }
    }
    /**
     * 杀掉占用指定端口的进程
     * @param port 端口号
     * @returns 是否成功杀掉进程
     */
    static async killProcessesOnPort(port) {
        try {
            const processes = await this.getPortProcesses(port);
            if (processes.length === 0) {
                return false; // 没有找到进程
            }
            // 杀掉所有占用该端口的进程
            for (const process of processes) {
                try {
                    await execAsync(`kill -9 ${process.pid}`);
                }
                catch (killError) {
                    // 忽略单个进程杀失败的错误
                }
            }
            // 等待一秒钟让进程完全退出
            await new Promise(resolve => setTimeout(resolve, 1000));
            // 再次检查端口是否还被占用
            const stillInUse = await this.isPortInUse(port);
            return !stillInUse;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * 检查并清理端口
     * @param port 端口号
     * @returns 是否成功清理端口
     */
    static async checkAndClearPort(port) {
        const isUsed = await this.isPortInUse(port);
        if (!isUsed) {
            return true; // 端口未被占用，无需清理
        }
        // 获取占用进程信息
        const processes = await this.getPortProcesses(port);
        // 杀掉占用进程
        const cleared = await this.killProcessesOnPort(port);
        return cleared;
    }
}
const program = new commander_1.Command();
// Version information
const packagePath = path.join(__dirname, '../package.json');
let version = '4.2.0';
if (fs.existsSync(packagePath)) {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    version = packageJson.version || '4.2.0';
}
// CLI Configuration
program
    .name('rcc4')
    .description('Claude Code Router v4.0 - Multi-AI Provider Routing System')
    .version(version);
// Basic Commands
program
    .command('start')
    .description('Start the RCC4 server')
    .option('-p, --port <port>', 'Server port')
    .option('-c, --config <config>', 'Configuration file path')
    .option('-d, --debug', 'Enable debug mode')
    .action(async (options) => {
    try {
        // 检测是否显式提供了端口参数
        const portExplicitlyProvided = options.port !== undefined;
        const port = portExplicitlyProvided ? parseInt(options.port, 10) : undefined;
        if (portExplicitlyProvided) {
            console.log(`🚀 Starting RCC4 server on explicit port ${port}`);
            // 检查并清理端口（仅当显式指定端口时）
            console.log(`🔍 Checking port ${port} availability...`);
            const portCleared = await PortManager.checkAndClearPort(port);
            if (!portCleared) {
                console.error(`❌ Failed to clear port ${port}. Please check manually and try again.`);
                process.exit(1);
            }
            if (await PortManager.isPortInUse(port)) {
                // 如果端口仍然被占用，显示详细信息
                const processes = await PortManager.getPortProcesses(port);
                console.error(`❌ Port ${port} is still in use by the following processes:`);
                processes.forEach(proc => {
                    console.error(`   - ${proc.command} (PID: ${proc.pid})`);
                });
                process.exit(1);
            }
            console.log(`✅ Port ${port} is now available`);
        }
        else {
            console.log(`🚀 Starting RCC4 server (port will be determined from config file or default to 5506)`);
        }
        // 检查配置文件
        let configPath = options.config;
        if (!configPath) {
            // 默认配置文件路径
            const defaultConfigPath = path.join(process.env.HOME || '~', '.route-claudecode', 'config.json');
            if (fs.existsSync(defaultConfigPath)) {
                configPath = defaultConfigPath;
                console.log(`📋 Using default config: ${configPath}`);
            }
            else {
                console.log('⚠️ No config file specified and default config not found');
                console.log(`   Expected default location: ${defaultConfigPath}`);
                console.log('   Starting server without configuration...');
            }
        }
        else if (!fs.existsSync(configPath)) {
            console.error(`❌ Configuration file not found: ${configPath}`);
            process.exit(1);
        }
        // 创建启动配置 - 只传递显式提供的端口
        const startupConfig = {
            configPath: configPath,
            port: port, // undefined if not explicitly provided
            host: '0.0.0.0',
            debug: !!options.debug
        };
        console.log(`🔧 Startup configuration:`);
        console.log(`   Port: ${startupConfig.port || 'auto (from config file)'}`);
        console.log(`   Host: ${startupConfig.host}`);
        console.log(`   Debug: ${startupConfig.debug}`);
        if (startupConfig.configPath) {
            console.log(`   Config file: ${startupConfig.configPath}`);
        }
        // 使用统一启动服务启动整个系统
        console.log('🔧 Starting RCC v4.0 unified startup process...');
        const startupResult = await src_1.startupService.start(startupConfig);
        if (!startupResult.success) {
            console.error('❌ Failed to start RCC v4.0 services:');
            if (startupResult.errors) {
                startupResult.errors.forEach(error => console.error(`   - ${error}`));
            }
            process.exit(1);
        }
        const httpServer = startupResult.server;
        const serverStatus = httpServer.getStatus();
        console.log(`🎉 RCC4 server successfully started!`);
        console.log(`🌐 Server URL: http://${serverStatus.host}:${serverStatus.port}`);
        console.log(`📡 Health check: http://${serverStatus.host}:${serverStatus.port}/health`);
        console.log(`📊 Status endpoint: http://${serverStatus.host}:${serverStatus.port}/status`);
        console.log(`🔗 Chat endpoint: http://${serverStatus.host}:${serverStatus.port}/v1/chat/completions`);
        // 🆕 流水线组装摘要
        if (startupResult.pipelines) {
            const pipelineSummary = startupResult.pipelines;
            const totalPipelines = pipelineSummary.stats?.totalPipelines || 0;
            const assembledPipelines = pipelineSummary.stats?.successfulAssemblies || 0;
            const assemblyTime = pipelineSummary.stats?.assemblyTimeMs || 0;
            const successRate = totalPipelines > 0 ? ((assembledPipelines / totalPipelines) * 100).toFixed(1) : 0;
            console.log('\n🏭 Pipeline Assembly Summary:');
            console.log(`   📊 Total Pipelines: ${totalPipelines}`);
            console.log(`   ✅ Assembled Successfully: ${assembledPipelines}`);
            console.log(`   ❌ Failed Assembly: ${totalPipelines - assembledPipelines}`);
            console.log(`   📈 Success Rate: ${successRate}%`);
            console.log(`   ⏱️  Assembly Time: ${assemblyTime}ms`);
            // 显示Provider信息
            const providers = new Set();
            const models = new Set();
            if (pipelineSummary.allPipelines) {
                pipelineSummary.allPipelines.forEach((pipeline) => {
                    if (pipeline.provider)
                        providers.add(pipeline.provider);
                    if (pipeline.model)
                        models.add(pipeline.model);
                });
            }
            if (providers.size > 0) {
                console.log(`   🌐 Active Providers: ${Array.from(providers).join(', ')}`);
            }
            if (models.size > 0) {
                console.log(`   🤖 Available Models: ${Array.from(models).join(', ')}`);
            }
        }
        console.log('\n👉 Press Ctrl+C to stop the server');
        // 优雅关闭处理
        const gracefulShutdown = async () => {
            console.log('\n🛑 Shutting down RCC v4.0 services gracefully...');
            try {
                // 停止启动服务（会停止所有相关服务）
                await src_1.startupService.stop();
                console.log('✅ All RCC v4.0 services stopped successfully');
                process.exit(0);
            }
            catch (error) {
                console.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        };
        process.on('SIGINT', gracefulShutdown);
        process.on('SIGTERM', gracefulShutdown);
    }
    catch (error) {
        console.error('❌ Failed to start RCC4 server:', error instanceof Error ? error.message : error);
        if (options.debug && error instanceof Error) {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    }
});
program
    .command('stop')
    .description('Stop the RCC4 server')
    .action(async () => {
    process.stdout.write('RCC4 server stopped\n');
});
program
    .command('status')
    .description('Check RCC4 server status')
    .action(async () => {
    process.stdout.write('RCC4 Server Status: Ready\n');
});
program
    .command('config')
    .description('Configuration management')
    .option('-l, --list', 'List available configurations')
    .option('-v, --validate <file>', 'Validate configuration file')
    .action(async (options) => {
    if (options.list) {
        process.stdout.write('Available configurations listed\n');
    }
    if (options.validate) {
        process.stdout.write(`Configuration ${options.validate} validated\n`);
    }
});
// Code command - Execute Claude Code command with RCC4 as proxy
program
    .command('code')
    .description('Execute Claude Code command with RCC4 as proxy')
    .option('-p, --port <port>', 'Server port', '5506')
    .option('--claude-path <path>', 'Path to Claude Code executable', 'claude')
    .action(async (options) => {
    try {
        const port = parseInt(options.port, 10);
        // Set environment variables for Claude Code to use RCC4 as proxy
        const env = {
            ...process.env,
            ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`,
            ANTHROPIC_API_KEY: 'rcc4-proxy-key', // Default key for RCC4
        };
        // Get command arguments (everything after 'code' but filter out RCC4 options)
        const codeIndex = process.argv.indexOf('code');
        const rawArgs = process.argv.slice(codeIndex + 1);
        // Filter out RCC4-specific options (like --port, --claude-path)
        const rcc4Options = ['--port', '-p', '--claude-path'];
        const commandArgs = [];
        let skipNext = false;
        for (const arg of rawArgs) {
            if (skipNext) {
                skipNext = false;
                continue;
            }
            if (rcc4Options.includes(arg)) {
                skipNext = true; // Skip the next argument (the option value)
                continue;
            }
            // Add the argument if it's not an RCC4 option
            commandArgs.push(arg);
        }
        console.log(`🤖 Executing Claude Code command through RCC4 proxy on port ${port}`);
        console.log(`📝 Environment: ANTHROPIC_BASE_URL=http://127.0.0.1:${port}, ANTHROPIC_API_KEY='rcc4-proxy-key'`);
        console.log(`📝 Command: ${options.claudePath} ${commandArgs.length > 0 ? commandArgs.join(' ') : '[interactive mode]'}`);
        // Execute Claude Code command
        const claudeProcess = (0, child_process_1.spawn)(options.claudePath, commandArgs, {
            env,
            stdio: 'inherit',
            shell: false, // Disable shell to avoid security issues
        });
        claudeProcess.on('error', (error) => {
            console.error('❌ Failed to start Claude Code command:', error.message);
            console.log('Make sure Claude Code is installed: npm install -g @anthropic-ai/claude-code');
            process.exit(1);
        });
        claudeProcess.on('close', (code) => {
            process.exit(code || 0);
        });
    }
    catch (error) {
        console.error('❌ Failed to execute Claude Code command:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
// Error handling
program.on('command:*', () => {
    process.stderr.write(`Invalid command: ${program.args.join(' ')}\n`);
    process.stderr.write('See --help for available commands\n');
    process.exit(1);
});
// Parse command line arguments
if (process.argv.length <= 2) {
    program.help();
}
program.parse(process.argv);
//# sourceMappingURL=cli.js.map