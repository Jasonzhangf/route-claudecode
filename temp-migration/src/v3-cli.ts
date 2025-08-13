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
import { RouterServer } from './v3/server/router-server.js';
import { RouterConfig } from './v3/types/index.js';
import { loadUserConfig } from './v3/config/config-merger.js';

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
  .action(async (configPath: string, options: { debug?: boolean; port?: string }) => {
    try {
      console.log('🚀 Starting Claude Code Router V3.0...');
      
      if (!fs.existsSync(configPath)) {
        console.error(`❌ Configuration file not found: ${configPath}`);
        process.exit(1);
      }
      
      // Load and merge user configuration with system defaults
      const config: RouterConfig = loadUserConfig(configPath);
      
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
      
      // Graceful shutdown handling
      process.on('SIGINT', async () => {
        console.log('\\n🛑 Shutting down V3 Router Server...');
        await server.stop();
        process.exit(0);
      });
      
      process.on('SIGTERM', async () => {
        console.log('\\n🛑 Shutting down V3 Router Server...');
        await server.stop();
        process.exit(0);
      });
      
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
      
      // 添加服务器状态监控
      const monitorInterval = setInterval(async () => {
        try {
          const response = await fetch(`http://localhost:${config.server.port}/health`, {
            signal: AbortSignal.timeout(5000) // 5秒超时
          });
          if (!response.ok) {
            console.log('\n❌ Server health check failed, shutting down CLI...');
            clearInterval(monitorInterval);
            process.exit(1);
          }
        } catch (error) {
          console.log('\n❌ Server connection lost, shutting down CLI...');
          clearInterval(monitorInterval);
          process.exit(1);
        }
      }, 10000); // 每10秒检查一次
      
      // 清理监控器
      process.on('SIGINT', () => {
        clearInterval(monitorInterval);
      });
      process.on('SIGTERM', () => {
        clearInterval(monitorInterval);
      });
      
    } catch (error) {
      console.error('❌ Failed to start V3 Router Server:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Status command - 检查服务器状态
program
  .command('status')
  .option('--port <port>', 'Server port to check', '3456')
  .description('Check V3 router server status')
  .action(async (options: { port: string }) => {
    try {
      const response = await fetch(`http://localhost:${options.port}/status`);
      if (response.ok) {
        const status: any = await response.json();
        console.log('📊 V3 Router Server Status:');
        console.log(`   Server: ${status.server || 'unknown'}`);
        console.log(`   Version: ${status.version || 'unknown'}`);
        console.log(`   Architecture: ${status.architecture || 'v3.0'}`);
        console.log(`   Uptime: ${status.uptime || 0}s`);
        console.log(`   Providers: ${status.providers?.length || 0}`);
        console.log(`   Debug: ${status.debug ? 'enabled' : 'disabled'}`);
        
        if (status.providers && status.providers.length > 0) {
          console.log('   Active Providers:');
          status.providers.forEach((provider: string) => {
            console.log(`     - ${provider}`);
          });
        }
      } else {
        console.log(`❌ Server not responding (port ${options.port})`);
        process.exit(1);
      }
    } catch (error) {
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
  .action(async (options: { port: string }) => {
    try {
      const response = await fetch(`http://localhost:${options.port}/health`);
      const health: any = await response.json();
      
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
      } else {
        console.log(`⚠️ V3 Router Server health: ${health.overall || 'unknown'}`);
        console.log(`   Healthy providers: ${health.healthy || 0}/${health.total || 0}`);
        process.exit(1);
      }
    } catch (error) {
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
  .action(async (options: { port: string }) => {
    try {
      const response = await fetch(`http://localhost:${options.port}/shutdown`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const result: any = await response.json();
        console.log('✅ V3 Router Server shutdown initiated');
        console.log(`   Message: ${result.message}`);
      } else {
        console.log(`❌ Failed to stop server (port ${options.port})`);
        process.exit(1);
      }
    } catch (error) {
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
  .action(async (configPath: string, options: { model: string; message: string }) => {
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
        const result: any = await response.json();
        console.log('✅ V3 Router Test Successful');
        console.log(`   Model: ${result.model}`);
        console.log(`   Response: ${result.content?.[0]?.text || 'No text content'}`);
        console.log(`   Tokens: ${result.usage?.input_tokens}/${result.usage?.output_tokens}`);
      } else {
        const error: any = await response.json();
        console.log('❌ V3 Router Test Failed');
        console.log(`   Error: ${error.error?.message || 'Unknown error'}`);
        process.exit(1);
      }
      
    } catch (error) {
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
      
      // 检查服务器是否运行
      const healthResponse = await fetch(`http://${options.host}:${options.port}/health`);
      if (!healthResponse.ok) {
        console.log('❌ V3 Router Server is not responding');
        console.log('   Please start the server first:');
        console.log(`   rcc3 start <config> --port ${options.port}`);
        process.exit(1);
      }
      
      const health: any = await healthResponse.json();
      console.log(`✅ V3 Router Server is healthy (${health.healthy || '?'}/${health.total || '?'} providers)`);
      
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
      
      // 添加服务器健康监控 (for code command)
      const codeMonitorInterval = setInterval(async () => {
        try {
          const response = await fetch(`http://${options.host}:${options.port}/health`, {
            signal: AbortSignal.timeout(5000) // 5秒超时
          });
          if (!response.ok) {
            console.log('\n❌ Router server health check failed, disconnecting Claude Code...');
            clearInterval(codeMonitorInterval);
            claudeProcess.kill('SIGTERM');
            process.exit(1);
          }
        } catch (error) {
          console.log('\n❌ Router server connection lost, disconnecting Claude Code...');
          clearInterval(codeMonitorInterval);
          claudeProcess.kill('SIGTERM');
          process.exit(1);
        }
      }, 10000); // 每10秒检查一次

      // 处理 Claude Code 进程
      claudeProcess.on('error', (error) => {
        clearInterval(codeMonitorInterval);
        if (error.message.includes('ENOENT')) {
          console.log('❌ Claude Code not found');
          console.log('   Please install Claude Code first:');
          console.log('   npm install -g @anthropics/claude-code');
          process.exit(1);
        } else {
          console.error('❌ Failed to start Claude Code:', error.message);
          process.exit(1);
        }
      });
      
      claudeProcess.on('close', (code) => {
        clearInterval(codeMonitorInterval);
        console.log(`\n🔌 Claude Code disconnected (exit code: ${code})`);
        process.exit(code || 0);
      });
      
      // 优雅关闭处理
      process.on('SIGINT', () => {
        console.log('\n🛑 Disconnecting Claude Code...');
        clearInterval(codeMonitorInterval);
        claudeProcess.kill('SIGINT');
      });
      
      process.on('SIGTERM', () => {
        console.log('\n🛑 Disconnecting Claude Code...');
        clearInterval(codeMonitorInterval);
        claudeProcess.kill('SIGTERM');
      });
      
    } catch (error) {
      console.error('❌ Failed to connect Claude Code:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();