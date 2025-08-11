#!/usr/bin/env node

/**
 * Claude Code Router v3.0 CLI - rcc3 Command
 * [架构修复] 集成Dashboard启动的完整CLI
 * 
 * Features:
 * - rcc3 start: 启动V3应用 + 自动启动Dashboard
 * - rcc3 dashboard: 单独启动Dashboard
 * - rcc3 status: V3系统状态检查
 * - V3数据捕获集成支持
 * 
 * @author Jason Zhang
 * @version 3.0.0
 */

import { v3App, V3Application } from './index.js';
import { ConfigurationDashboard } from './v3/runtime-management/dashboard/configuration-dashboard.js';
import path from 'path';
import os from 'os';

/**
 * V3.0 CLI Handler
 */
class V3CLI {
    private app: V3Application;
    private standaloneDashboard: ConfigurationDashboard | null = null;

    constructor() {
        this.app = v3App;
        console.log('🚀 Claude Code Router v3.0 CLI (rcc3)');
        console.log('✅ Six-Layer Architecture with Real Implementation');
    }

    async run(): Promise<void> {
        const args = process.argv.slice(2);
        const command = args[0] || 'help';

        try {
            switch (command) {
                case 'start':
                    await this.startCommand(args.slice(1));
                    break;
                case 'stop':
                    await this.stopCommand(args.slice(1));
                    break;
                case 'restart':
                    await this.restartCommand(args.slice(1));
                    break;
                case 'dashboard':
                    await this.dashboardCommand(args.slice(1));
                    break;
                case 'status':
                    await this.statusCommand(args.slice(1));
                    break;
                case 'health':
                    await this.healthCommand(args.slice(1));
                    break;
                case 'version':
                    await this.versionCommand();
                    break;
                case 'config':
                    await this.configCommand(args.slice(1));
                    break;
                case 'debug':
                    await this.debugCommand(args.slice(1));
                    break;
                case 'migrate':
                    await this.migrateCommand(args.slice(1));
                    break;
                case 'help':
                default:
                    this.showHelp();
                    break;
            }
        } catch (error) {
            console.error('❌ rcc3 command failed:', (error as Error).message);
            process.exit(1);
        }
    }

    /**
     * Start V3 application with integrated dashboard
     */
    async startCommand(args: string[]): Promise<void> {
        const options = this.parseOptions(args);
        
        console.log('🚀 Starting Claude Code Router v3.0...');
        console.log('📊 Dashboard integration: ✅ Enabled');
        console.log('🔍 Data capture: ✅ Enabled');
        
        try {
            // Parse configuration file if provided
            if (options.config) {
                console.log(`⚙️ Using V3 configuration: ${options.config}`);
                
                // Convert V3 config to RouterServer format
                const { convertV3ToRouterConfig } = await import('./v3/config/v3-to-router-config.js');
                const routerConfig = convertV3ToRouterConfig(options.config);
                
                // Update app configuration
                (this.app as any).setRouterConfig(routerConfig);
            }

            // Enable debug mode if requested
            if (options.debug) {
                console.log('🔍 Debug mode: ✅ Enabled');
            }

            // Start V3 application (includes dashboard)
            await this.app.start();

            // Handle graceful shutdown
            this.setupGracefulShutdown();

            console.log('');
            console.log('🎉 V3.0 Application Started Successfully!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📊 Configuration Dashboard: http://localhost:3458');
            console.log('🎭 Router Server API: http://localhost:3456');
            console.log('📡 API Status Endpoint: http://localhost:3458/api/status');
            console.log('🔍 Debug System: ✅ Active');
            console.log('📈 Data Capture: ✅ V3 Format');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('');
            console.log('Press Ctrl+C to stop gracefully');

            // Keep process alive
            process.stdin.resume();

        } catch (error) {
            console.error('❌ Failed to start V3.0 application:', (error as Error).message);
            process.exit(1);
        }
    }

    /**
     * Stop V3 application
     */
    async stopCommand(args: string[]): Promise<void> {
        console.log('🛑 Stopping Claude Code Router v3.0...');
        
        try {
            await this.app.stop();
            
            if (this.standaloneDashboard) {
                await this.standaloneDashboard.stop();
                this.standaloneDashboard = null;
            }

            console.log('✅ V3.0 Application stopped successfully');
            
        } catch (error) {
            console.error('❌ Error stopping application:', (error as Error).message);
            process.exit(1);
        }
    }

    /**
     * Restart V3 application
     */
    async restartCommand(args: string[]): Promise<void> {
        console.log('🔄 Restarting Claude Code Router v3.0...');
        
        await this.stopCommand([]);
        
        // Wait a moment before restart
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await this.startCommand(args);
    }

    /**
     * Start standalone dashboard
     */
    async dashboardCommand(args: string[]): Promise<void> {
        const options = this.parseOptions(args);
        const port = options.port ? parseInt(options.port) : 3458;

        console.log(`📊 Starting Configuration Dashboard on port ${port}...`);

        try {
            this.standaloneDashboard = new ConfigurationDashboard({
                port: port,
                refreshInterval: 1000
            });

            await this.standaloneDashboard.start();

            // Handle graceful shutdown
            this.setupGracefulShutdown();

            console.log('');
            console.log('🎉 Configuration Dashboard Started!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`📊 Dashboard URL: http://localhost:${port}`);
            console.log(`📡 API Status: http://localhost:${port}/api/status`);
            console.log(`🔍 Provider Status: http://localhost:${port}/api/providers`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('Press Ctrl+C to stop');

            // Keep process alive
            process.stdin.resume();

        } catch (error) {
            console.error('❌ Failed to start dashboard:', (error as Error).message);
            process.exit(1);
        }
    }

    /**
     * Show V3 system status
     */
    async statusCommand(args: string[]): Promise<void> {
        console.log('📊 V3.0 System Status Check...');
        
        try {
            const health = await this.app.getHealthStatus();
            const summary = this.app.getV3SystemSummary();

            console.log('');
            console.log('🎯 Claude Code Router v3.0 Status');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`📈 Overall Status: ${health.overall === 'healthy' ? '✅ Healthy' : '❌ Unhealthy'}`);
            console.log(`🏗️ Architecture: ${summary.architecture}`);
            console.log(`🔢 Version: ${summary.version}`);
            console.log(`⚡ Initialized: ${summary.initialized ? '✅ Yes' : '❌ No'}`);
            console.log('');
            
            console.log('🧩 V3 Components:');
            Object.entries(health.v3Components).forEach(([name, status]) => {
                const statusIcon = (typeof status === 'object' ? status.healthy !== false : status === 'healthy') ? '✅' : '❌';
                console.log(`  ${statusIcon} ${name}: ${typeof status === 'object' ? JSON.stringify(status, null, 2) : status}`);
            });
            
            console.log('');
            console.log('🌐 Endpoints:');
            console.log(`  📊 Dashboard: ${summary.endpoints.dashboard}`);
            console.log(`  📡 API: ${summary.endpoints.dashboardApi}`);
            console.log(`  🎭 Router Server: ${summary.endpoints.routerServerApi}`);
            console.log('');
            
            if (health.legacyModules.total > 0) {
                console.log('🔧 Legacy Modules:');
                console.log(`  📊 Total: ${health.legacyModules.total}`);
                console.log(`  ✅ Healthy: ${health.legacyModules.healthy}`);
                console.log(`  ❌ Unhealthy: ${health.legacyModules.unhealthy}`);
                console.log('');
            }

            console.log(`⏰ Checked at: ${health.timestamp}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        } catch (error) {
            console.error('❌ Failed to get status:', (error as Error).message);
            process.exit(1);
        }
    }

    /**
     * Health check command
     */
    async healthCommand(args: string[]): Promise<void> {
        try {
            const health = await this.app.getHealthStatus();
            
            if (health.overall === 'healthy') {
                console.log('✅ V3.0 System is healthy');
                process.exit(0);
            } else {
                console.log('❌ V3.0 System has health issues');
                console.log(JSON.stringify(health, null, 2));
                process.exit(1);
            }
        } catch (error) {
            console.error('❌ Health check failed:', (error as Error).message);
            process.exit(1);
        }
    }

    /**
     * Version command
     */
    async versionCommand(): Promise<void> {
        const version = this.app.getVersion();
        const summary = this.app.getV3SystemSummary();
        
        console.log(`Claude Code Router v${version}`);
        console.log(`Architecture: ${summary.architecture}`);
        console.log('🚀 Real Implementation Active');
    }

    /**
     * Configuration command
     */
    async configCommand(args: string[]): Promise<void> {
        const subCommand = args[0] || 'show';
        
        try {
            const configManager = this.app.getConfigurationManager();
            
            switch (subCommand) {
                case 'show':
                    const config = await configManager.getCurrentConfiguration();
                    console.log('📋 Current V3 Configuration:');
                    console.log(JSON.stringify(config, null, 2));
                    break;
                    
                case 'validate':
                    const isValid = await configManager.validateCurrentConfiguration();
                    console.log(`📋 Configuration Validation: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
                    break;
                    
                case 'status':
                    const status = await configManager.getHealthStatus();
                    console.log('📋 Configuration Manager Status:');
                    console.log(JSON.stringify(status, null, 2));
                    break;
                    
                default:
                    console.log('❌ Unknown config subcommand. Available: show, validate, status');
                    break;
            }
        } catch (error) {
            console.error('❌ Config command failed:', (error as Error).message);
            process.exit(1);
        }
    }

    /**
     * Debug command
     */
    async debugCommand(args: string[]): Promise<void> {
        const subCommand = args[0] || 'status';
        
        try {
            const debugSystem = this.app.getDebugSystem();
            
            switch (subCommand) {
                case 'status':
                    const status = debugSystem.getDebugStatus();
                    console.log('🔍 Debug System Status:');
                    console.log(JSON.stringify(status, null, 2));
                    break;
                    
                case 'enable':
                    debugSystem.enableDebug();
                    console.log('✅ Debug system enabled');
                    break;
                    
                case 'disable':
                    debugSystem.disableDebug();
                    console.log('✅ Debug system disabled');
                    break;
                    
                case 'report':
                    const report = debugSystem.generateDebugReport();
                    console.log('📊 Debug Report Generated:');
                    console.log(JSON.stringify(report, null, 2));
                    break;
                    
                default:
                    console.log('❌ Unknown debug subcommand. Available: status, enable, disable, report');
                    break;
            }
        } catch (error) {
            console.error('❌ Debug command failed:', (error as Error).message);
            process.exit(1);
        }
    }

    /**
     * Migrate command for V3 database
     */
    async migrateCommand(args: string[]): Promise<void> {
        console.log('🔄 V3 Database Migration...');
        
        try {
            const v3DatabasePath = path.join(os.homedir(), '.route-claude-code', 'database', 'v3');
            
            console.log(`📁 V3 Database Path: ${v3DatabasePath}`);
            console.log('');
            console.log('📋 Migration Steps:');
            console.log('1. cd ~/.route-claude-code/database/v3');
            console.log('2. ./migrate-v2-to-v3.sh');
            console.log('3. ./validate-migration.sh --verbose');
            console.log('');
            console.log('📘 For detailed instructions, see:');
            console.log(`   ${v3DatabasePath}/QUICK_START.md`);
            
        } catch (error) {
            console.error('❌ Migration command failed:', (error as Error).message);
            process.exit(1);
        }
    }

    /**
     * Parse command line options
     */
    private parseOptions(args: string[]): Record<string, string> {
        const options: Record<string, string> = {};
        
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            
            if (arg.startsWith('--')) {
                const [key, value] = arg.substring(2).split('=');
                if (value) {
                    options[key] = value;
                } else if (key === 'config' && i + 1 < args.length && !args[i + 1].startsWith('-')) {
                    options[key] = args[++i];
                } else {
                    options[key] = 'true';
                }
            } else if (arg.startsWith('-')) {
                const key = arg.substring(1);
                if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
                    options[key] = args[++i];
                } else {
                    options[key] = 'true';
                }
            }
        }
        
        return options;
    }

    /**
     * Setup graceful shutdown
     */
    private setupGracefulShutdown(): void {
        process.on('SIGINT', async () => {
            console.log('\n🛑 Graceful shutdown initiated...');
            
            try {
                await this.app.stop();
                
                if (this.standaloneDashboard) {
                    await this.standaloneDashboard.stop();
                }
                
                console.log('✅ Shutdown completed');
                process.exit(0);
                
            } catch (error) {
                console.error('❌ Error during shutdown:', (error as Error).message);
                process.exit(1);
            }
        });

        process.on('SIGTERM', async () => {
            console.log('\n🛑 SIGTERM received, shutting down...');
            await this.app.stop();
            process.exit(0);
        });
    }

    /**
     * Show help information
     */
    private showHelp(): void {
        console.log('');
        console.log('🚀 Claude Code Router v3.0 - rcc3 Command');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('📋 Commands:');
        console.log('  start [options]     Start V3 application with dashboard');
        console.log('  stop               Stop V3 application');
        console.log('  restart [options]  Restart V3 application'); 
        console.log('  dashboard [options] Start standalone dashboard');
        console.log('  status             Show system status');
        console.log('  health             Health check (exit 0/1)');
        console.log('  version            Show version information');
        console.log('  config <cmd>       Configuration management');
        console.log('  debug <cmd>        Debug system control');
        console.log('  migrate            V3 database migration guide');
        console.log('  help               Show this help');
        console.log('');
        console.log('⚙️ Options:');
        console.log('  --config=<file>    Configuration file path');
        console.log('  --port=<port>      Dashboard port (default: 3458)');
        console.log('  --debug            Enable debug mode');
        console.log('');
        console.log('🌐 URLs (when running):');
        console.log('  📊 Dashboard: http://localhost:3458');
        console.log('  📡 API: http://localhost:3458/api/status');
        console.log('  🎭 Router Server: http://localhost:3456');
        console.log('');
        console.log('📖 Examples:');
        console.log('  rcc3 start --debug');
        console.log('  rcc3 dashboard --port=3459');
        console.log('  rcc3 status');
        console.log('  rcc3 config show');
        console.log('  rcc3 debug status');
        console.log('');
    }
}

// Main execution
async function main() {
    const cli = new V3CLI();
    await cli.run();
}

// Run CLI if this file is executed directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { V3CLI };