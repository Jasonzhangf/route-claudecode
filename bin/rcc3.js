#!/usr/bin/env node
/**
 * Claude Code Router V3.0 CLI
 * 真正的V3路由系统入口，支持完整的Provider连接
 *
 * Project owner: Jason Zhang
 */
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { RouterServer } from '../dist/v3/server/router-server.js';
import { loadUserConfig } from '../dist/v3/config/config-merger.js';
const program = new Command();
program
    .name('rcc3')
    .description('Claude Code Router V3.0 - Real Provider Connections')
    .version('3.0.0');
// Start command - 启动V3路由服务器
program
    .command('start')
    .argument('<config>', 'Configuration file path')
    .option('--debug', 'Enable debug mode')
    .option('--port <port>', 'Override port number')
    .description('Start V3 router server with real provider connections')
    .action(async (configPath, options) => {
    try {
        console.log('🚀 Starting Claude Code Router V3.0...');
        if (!fs.existsSync(configPath)) {
            console.error(`❌ Configuration file not found: ${configPath}`);
            process.exit(1);
        }
        // Load and merge user configuration with system defaults
        const config = loadUserConfig(configPath);
        // Override port if specified
        if (options.port) {
            config.server.port = parseInt(options.port);
        }
        // Override debug if specified
        if (options.debug) {
            config.debug = { enabled: true, logLevel: 'debug', logDir: '/tmp' };
        }
        console.log(`📋 User Configuration: ${path.basename(configPath)}`);
        console.log(`🌐 Server port: ${config.server.port}`);
        console.log(`🏗️ Architecture: ${config.server.architecture}`);
        console.log(`📊 Providers: ${Object.keys(config.providers).length}`);
        const routingConfig = typeof config.routing === 'object' && 'categories' in config.routing
            ? config.routing.categories
            : config.routing;
        console.log(`🎯 Categories: ${Object.keys(routingConfig || {}).length}`);
        // Initialize and start router server
        const server = new RouterServer(config);
        await server.start();
        console.log('');
        console.log('✅ V3 Router Server is running with REAL provider connections!');
        console.log('📊 Available endpoints:');
        console.log('   POST /v1/messages - Anthropic API proxy');
        console.log('   GET  /health     - Health check');
        console.log('   GET  /status     - Server status');
        console.log('   GET  /stats      - Statistics dashboard');
        console.log('');
        console.log('Press Ctrl+C to stop');
        // 移除自动监控逻辑 - 避免不必要的CLI退出
        // CLI应该保持运行直到用户手动退出 (Ctrl+C)
        let monitorInterval; // 声明变量以便SIGINT处理器可以引用
        // 全局错误处理 - 防止CLI因为Provider错误而崩溃
        process.on('uncaughtException', (error) => {
            console.error('\n⚠️  Uncaught Exception (CLI continues running):', error.message);
            if (error.stack) {
                console.error('   Stack trace saved to debug logs');
            }
            // 不退出进程，继续运行
        });
        process.on('unhandledRejection', (reason, promise) => {
            console.error('\n⚠️  Unhandled Rejection (CLI continues running):', reason);
            console.error('   Promise:', promise);
            // 不退出进程，继续运行
        });
        // Graceful shutdown handling (after monitorInterval is declared)
        process.on('SIGINT', async () => {
            console.log('\\n🛑 Shutting down V3 Router Server...');
            if (monitorInterval)
                clearInterval(monitorInterval);
            await server.stop();
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            console.log('\\n🛑 Shutting down V3 Router Server...');
            if (monitorInterval)
                clearInterval(monitorInterval);
            await server.stop();
            process.exit(0);
        });
    }
    catch (error) {
        console.error('❌ Failed to start V3 Router Server:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
// Status command - 检查服务器状态
program
    .command('status')
    .option('--port <port>', 'Server port to check', '3456')
    .description('Check V3 router server status')
    .action(async (options) => {
    try {
        const response = await fetch(`http://localhost:${options.port}/status`);
        if (response.ok) {
            const status = await response.json();
            console.log('📊 V3 Router Server Status:');
            console.log(`   Server: ${status.server || 'unknown'}`);
            console.log(`   Version: ${status.version || 'unknown'}`);
            console.log(`   Architecture: ${status.architecture || 'v3.0'}`);
            console.log(`   Uptime: ${status.uptime || 0}s`);
            console.log(`   Providers: ${status.providers?.length || 0}`);
            console.log(`   Debug: ${status.debug ? 'enabled' : 'disabled'}`);
            if (status.providers && status.providers.length > 0) {
                console.log('   Active Providers:');
                status.providers.forEach((provider) => {
                    console.log(`     - ${provider}`);
                });
            }
        }
        else {
            console.log(`❌ Server not responding (port ${options.port})`);
            process.exit(1);
        }
    }
    catch (error) {
        console.log(`❌ Cannot connect to server (port ${options.port})`);
        console.log('   Server may not be running');
        process.exit(1);
    }
});
// Health command - 健康检查
program
    .command('health')
    .option('--port <port>', 'Server port to check', '3456')
    .description('Check V3 router server health')
    .action(async (options) => {
    try {
        const response = await fetch(`http://localhost:${options.port}/health`);
        const health = await response.json();
        if (response.ok && health.overall === 'healthy') {
            console.log('✅ V3 Router Server is healthy');
            console.log(`   Status: ${health.overall}`);
            console.log(`   Healthy providers: ${health.healthy}/${health.total}`);
            console.log(`   Timestamp: ${health.timestamp}`);
            if (health.providers) {
                console.log('   Provider status:');
                Object.entries(health.providers).forEach(([provider, status]) => {
                    console.log(`     ${status ? '✅' : '❌'} ${provider}`);
                });
            }
        }
        else {
            console.log(`⚠️ V3 Router Server health: ${health.overall || 'unknown'}`);
            console.log(`   Healthy providers: ${health.healthy || 0}/${health.total || 0}`);
            process.exit(1);
        }
    }
    catch (error) {
        console.log(`❌ Cannot check server health (port ${options.port})`);
        console.log('   Server may not be running');
        process.exit(1);
    }
});
// Stop command - 停止服务器
program
    .command('stop')
    .option('--port <port>', 'Server port to stop', '3456')
    .description('Stop V3 router server')
    .action(async (options) => {
    try {
        const response = await fetch(`http://localhost:${options.port}/shutdown`, {
            method: 'POST'
        });
        if (response.ok) {
            const result = await response.json();
            console.log('✅ V3 Router Server shutdown initiated');
            console.log(`   Message: ${result.message}`);
        }
        else {
            console.log(`❌ Failed to stop server (port ${options.port})`);
            process.exit(1);
        }
    }
    catch (error) {
        console.log(`❌ Cannot connect to server (port ${options.port})`);
        console.log('   Server may already be stopped');
    }
});
// Test command - 测试V3路由
program
    .command('test')
    .argument('<config>', 'Configuration file path')
    .option('--model <model>', 'Model to test', 'claude-sonnet-4')
    .option('--message <message>', 'Test message', 'Hello from V3 test')
    .description('Test V3 router with a simple message')
    .action(async (configPath, options) => {
    try {
        console.log('🧪 Testing V3 Router...');
        if (!fs.existsSync(configPath)) {
            console.error(`❌ Configuration file not found: ${configPath}`);
            process.exit(1);
        }
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const port = config.server.port || 3456;
        const response = await fetch(`http://localhost:${port}/v1/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: options.model,
                max_tokens: 100,
                messages: [
                    {
                        role: 'user',
                        content: options.message
                    }
                ]
            })
        });
        if (response.ok) {
            const result = await response.json();
            console.log('✅ V3 Router Test Successful');
            console.log(`   Model: ${result.model}`);
            console.log(`   Response: ${result.content?.[0]?.text || 'No text content'}`);
            console.log(`   Tokens: ${result.usage?.input_tokens}/${result.usage?.output_tokens}`);
        }
        else {
            const error = await response.json();
            console.log('❌ V3 Router Test Failed');
            console.log(`   Error: ${error.error?.message || 'Unknown error'}`);
            process.exit(1);
        }
    }
    catch (error) {
        console.error('❌ Test failed:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
// Code command - 连接 Claude Code 客户端
program
    .command('code')
    .option('--port <port>', 'Server port to connect to', '3456')
    .option('--host <host>', 'Server host', 'localhost')
    .description('Connect Claude Code client to V3 router server')
    .action(async (options) => {
    try {
        console.log('🔗 Connecting Claude Code to V3 Router...');
        console.log(`📡 Server: http://${options.host}:${options.port}`);
        // 检查服务器是否运行 (静默检查，不输出健康状态)
        try {
            await fetch(`http://${options.host}:${options.port}/health`);
            console.log(`✅ V3 Router Server is available`);
        }
        catch (error) {
            console.log(`⚠️  V3 Router Server may not be running, but continuing...`);
        }
        // 启动 Claude Code 连接
        const { spawn } = await import('child_process');
        // 设置 Claude Code 环境变量
        const env = {
            ...process.env,
            ANTHROPIC_BASE_URL: `http://${options.host}:${options.port}`,
            ANTHROPIC_API_KEY: 'any-string-is-ok',
            API_TIMEOUT_MS: '600000',
            ANTHROPIC_TIMEOUT_MS: '600000',
            REQUEST_TIMEOUT_MS: '600000'
        };
        console.log('🚀 Starting Claude Code...');
        console.log('🔧 Environment:');
        console.log(`   ANTHROPIC_BASE_URL=${env.ANTHROPIC_BASE_URL}`);
        console.log(`   ANTHROPIC_API_KEY=${env.ANTHROPIC_API_KEY}`);
        console.log(`   API_TIMEOUT_MS=${env.API_TIMEOUT_MS}`);
        console.log('');
        console.log('Press Ctrl+C to disconnect');
        // 启动 Claude Code
        const claudeProcess = spawn('claude', [], {
            env,
            stdio: 'inherit'
        });
        // 添加服务器健康监控 (for code command) - 静默监控
        const codeMonitorInterval = setInterval(async () => {
            try {
                await fetch(`http://${options.host}:${options.port}/health`, {
                    signal: AbortSignal.timeout(5000) // 5秒超时
                });
                // 静默健康检查，不输出任何信息
            }
            catch (error) {
                // 静默处理连接丢失，不输出任何信息
            }
        }, 10000); // 每10秒检查一次
        // 处理 Claude Code 进程
        claudeProcess.on('error', (error) => {
            clearInterval(codeMonitorInterval);
            if (error.message.includes('ENOENT')) {
                console.log('❌ Claude Code not found');
                console.log('   Please install Claude Code first:');
                console.log('   npm install -g @anthropics/claude-code');
                console.log('⚠️  Staying connected for when Claude Code becomes available...');
                // 不退出，继续等待
            }
            else {
                console.error('❌ Failed to start Claude Code:', error.message);
                console.log('⚠️  Staying connected for retry...');
                // 不退出，继续等待
            }
        });
        claudeProcess.on('close', (code) => {
            clearInterval(codeMonitorInterval);
            console.log(`\n🔌 Claude Code disconnected (exit code: ${code})`);
            console.log('⚠️  rcc3 code session ended, but router connection remains active');
            console.log('💡 You can restart Claude Code anytime with the same command');
            // 不退出进程，让用户手动退出 (Ctrl+C)
        });
        // 优雅关闭处理
        const codeExitHandler = () => {
            console.log('\n🛑 Disconnecting Claude Code...');
            clearInterval(codeMonitorInterval);
            claudeProcess.kill('SIGINT');
            // 清理事件监听器
            process.off('uncaughtException', uncaughtHandler);
            process.off('unhandledRejection', rejectionHandler);
            // 给Claude Code时间优雅退出
            setTimeout(() => {
                console.log('✅ rcc3 code disconnected gracefully');
                process.exit(0);
            }, 1000);
        };
        process.on('SIGINT', codeExitHandler);
        process.on('SIGTERM', () => {
            console.log('\n🛑 Disconnecting Claude Code...');
            clearInterval(codeMonitorInterval);
            claudeProcess.kill('SIGTERM');
            // 清理事件监听器
            process.off('uncaughtException', uncaughtHandler);
            process.off('unhandledRejection', rejectionHandler);
            // 给Claude Code时间优雅退出
            setTimeout(() => {
                console.log('✅ rcc3 code disconnected gracefully');
                process.exit(0);
            }, 1000);
        });
        // 防止进程错误导致的崩溃（仅在code命令中）
        const uncaughtHandler = (error) => {
            console.error('⚠️  Uncaught Exception:', error.message);
            // 不退出，继续运行
        };
        const rejectionHandler = (reason, promise) => {
            console.error('⚠️  Unhandled Rejection at:', promise, 'reason:', reason);
            // 不退出，继续运行
        };
        process.on('uncaughtException', uncaughtHandler);
        process.on('unhandledRejection', rejectionHandler);
    }
    catch (error) {
        console.error('❌ Failed to connect Claude Code:', error instanceof Error ? error.message : error);
        console.log('⚠️  Connection failed, but rcc3 code remains running');
        console.log('💡 You can try again or press Ctrl+C to exit');
        // 不退出，让用户决定
    }
});
// Parse command line arguments
program.parse();
