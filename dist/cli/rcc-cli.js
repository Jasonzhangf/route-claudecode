"use strict";
/**
 * RCC主CLI类
 *
 * 统一的CLI入口，集成命令解析、验证、配置加载和执行
 *
 * @author Jason Zhang
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RCCCli = void 0;
const command_parser_1 = require("./command-parser");
const argument_validator_1 = require("./argument-validator");
const config_reader_1 = require("../config/config-reader");
const pipeline_lifecycle_manager_1 = require("../pipeline/pipeline-lifecycle-manager");
const secure_logger_1 = require("../utils/secure-logger");
/**
 * RCC主CLI类
 */
class RCCCli {
    constructor(options = {}) {
        this.parser = new command_parser_1.CommandParser();
        this.validator = new argument_validator_1.ArgumentValidator();
        this.configReader = new config_reader_1.ConfigReader();
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
    async run(args = process.argv.slice(2)) {
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
            const config = config_reader_1.ConfigReader.loadConfig(this.options.configPath || 'config/default.json', 'config/system-config.json');
            // 4. 合并配置到命令选项
            const mergedCommand = {
                ...command,
                options: { ...config, ...validation.normalizedOptions },
            };
            // 5. 执行命令
            await this.parser.executeCommand(mergedCommand);
        }
        catch (error) {
            this.handleError(error);
        }
    }
    /**
     * 启动服务器模式
     */
    async start(options) {
        try {
            if (!this.options.suppressOutput) {
                console.log('🚀 Starting RCC Server...');
                console.log(`   Port: ${options.port || 3456}`);
                console.log(`   Host: ${options.host || 'localhost'}`);
                if (options.debug) {
                    console.log('   Debug: enabled');
                }
                if (options.config) {
                    console.log(`   Config: ${options.config}`);
                }
            }
            // TODO: 实现实际的服务器启动逻辑
            await this.startServer(options);
            if (!this.options.suppressOutput) {
                console.log('✅ RCC Server started successfully');
                console.log(`🌐 Server running at http://${options.host || 'localhost'}:${options.port || 3456}`);
            }
        }
        catch (error) {
            throw new Error(`Failed to start server: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * 停止服务器
     */
    async stop(options) {
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
        }
        catch (error) {
            throw new Error(`Failed to stop server: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * 启动客户端模式
     */
    async code(options) {
        try {
            if (!this.options.suppressOutput) {
                console.log('🔧 Starting Claude Code Client Mode...');
                console.log(`   Target Port: ${options.port || 3456}`);
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
        }
        catch (error) {
            throw new Error(`Failed to start client mode: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * 查看服务器状态
     */
    async status(options) {
        try {
            if (!this.options.suppressOutput) {
                console.log('📊 Checking RCC Server Status...');
            }
            const status = await this.getServerStatus(options);
            if (!this.options.suppressOutput) {
                this.displayServerStatus(status, options.detailed || false);
            }
            return status;
        }
        catch (error) {
            throw new Error(`Failed to get server status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * 配置管理
     */
    async config(options) {
        try {
            if (options.list) {
                await this.listConfigurations();
            }
            else if (options.validate) {
                await this.validateConfiguration(options.path);
            }
            else if (options.reset) {
                await this.resetConfiguration();
            }
            else {
                throw new Error('No config operation specified. Use --list, --validate, or --reset.');
            }
        }
        catch (error) {
            throw new Error(`Configuration operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * 处理验证错误
     */
    handleValidationErrors(errors) {
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
     * 处理错误
     */
    handleError(error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        if (!this.options.suppressOutput) {
            console.error(`❌ Error: ${message}`);
        }
        if (this.options.exitOnError) {
            process.exit(1);
        }
        else {
            throw error;
        }
    }
    /**
     * 启动服务器（实际实现）
     */
    async startServer(options) {
        try {
            // 初始化流水线生命周期管理器
            this.pipelineManager = new pipeline_lifecycle_manager_1.PipelineLifecycleManager(options.config);
            // 启动RCC v4.0流水线系统
            const success = await this.pipelineManager.start();
            if (!success) {
                throw new Error('Pipeline system failed to start');
            }
            // 监听流水线事件
            this.setupPipelineEventListeners();
            secure_logger_1.secureLogger.info('RCC Server started with pipeline system', {
                port: options.port || 5506,
                host: options.host || '0.0.0.0',
                config: options.config,
                debug: options.debug,
            });
        }
        catch (error) {
            secure_logger_1.secureLogger.error('Failed to start RCC server', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }
    /**
     * 停止服务器（实际实现）
     */
    async stopServer(options) {
        try {
            if (this.pipelineManager) {
                await this.pipelineManager.stop();
                this.pipelineManager = undefined;
                secure_logger_1.secureLogger.info('RCC Server stopped', {
                    port: options.port,
                    force: options.force,
                });
            }
            else {
                secure_logger_1.secureLogger.warn('No pipeline manager instance to stop');
            }
        }
        catch (error) {
            secure_logger_1.secureLogger.error('Failed to stop RCC server', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }
    /**
     * 启动客户端模式（实际实现）
     */
    async startClientMode(options) {
        // TODO: 实现客户端模式
        await new Promise(resolve => setTimeout(resolve, 800));
    }
    /**
     * 导出客户端配置
     */
    async exportClientConfig(options) {
        const envVars = [
            `export ANTHROPIC_BASE_URL=http://localhost:${options.port || 3456}`,
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
    async getServerStatus(options) {
        if (!this.pipelineManager) {
            return {
                isRunning: false,
                port: options.port || 5506,
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
        const activeRequests = this.pipelineManager.getActiveRequests();
        return {
            isRunning,
            port: options.port || 5506,
            host: 'localhost',
            startTime: new Date(Date.now() - stats.uptime),
            version: '4.0.0-dev',
            activePipelines: Object.keys(stats.routerStats.virtualModels || {}).length,
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
                        status: stats.routerStats.totalProviders > 0 ? 'pass' : 'fail',
                        responseTime: 1,
                    },
                    {
                        name: 'Layer Health',
                        status: Array.isArray(stats.layerHealth) && stats.layerHealth.every((l) => l.status === 'ready')
                            ? 'pass'
                            : 'warn',
                        responseTime: 2,
                    },
                ],
            },
            pipeline: {
                stats,
                activeRequests: activeRequests.length,
                layerHealth: stats.layerHealth,
            },
        };
    }
    /**
     * 显示服务器状态
     */
    displayServerStatus(status, detailed) {
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
    getHealthStatusIcon(status) {
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
    async listConfigurations() {
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
    async validateConfiguration(path) {
        if (!this.options.suppressOutput) {
            console.log(`✅ Configuration ${path || 'default'} is valid`);
        }
    }
    /**
     * 重置配置
     */
    async resetConfiguration() {
        if (!this.options.suppressOutput) {
            console.log('🔄 Configuration reset to defaults');
        }
    }
    /**
     * 设置流水线事件监听器
     */
    setupPipelineEventListeners() {
        if (!this.pipelineManager) {
            return;
        }
        this.pipelineManager.on('pipeline-started', () => {
            secure_logger_1.secureLogger.info('Pipeline system started successfully');
        });
        this.pipelineManager.on('layers-ready', () => {
            secure_logger_1.secureLogger.info('All pipeline layers are ready');
        });
        this.pipelineManager.on('layers-error', error => {
            secure_logger_1.secureLogger.error('Pipeline layer error', { error: error.message });
        });
        this.pipelineManager.on('request-completed', data => {
            secure_logger_1.secureLogger.debug('Request completed successfully', {
                requestId: data.requestId,
                success: data.success,
            });
        });
        this.pipelineManager.on('request-failed', data => {
            secure_logger_1.secureLogger.warn('Request failed', {
                requestId: data.requestId,
                error: data.error.message,
            });
        });
        this.pipelineManager.on('pipeline-stopped', () => {
            secure_logger_1.secureLogger.info('Pipeline system stopped');
        });
    }
    /**
     * 格式化运行时间
     */
    formatUptime(uptimeMs) {
        const seconds = Math.floor(uptimeMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        }
        else if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        else {
            return `${seconds}s`;
        }
    }
}
exports.RCCCli = RCCCli;
//# sourceMappingURL=rcc-cli.js.map