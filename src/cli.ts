/**
 * CLI for Claude Code Router
 * Command-line interface for starting and managing the router
 */

import { Command } from 'commander';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { RouterServer } from './server';
import { RouterConfig, ProviderConfig } from './types';
import { logger } from './utils/logger';
import { executeCodeCommand } from './code-command';

// Read version from package.json
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const VERSION = packageJson.version;

const program = new Command();
const DEFAULT_CONFIG_PATH = join(homedir(), '.claude-code-router', 'config.json');

/**
 * Default configuration
 */
// No default configuration - user must provide complete config.json

/**
 * Load configuration from file
 */
function loadConfig(configPath: string): RouterConfig {
  try {
    if (!existsSync(configPath)) {
      console.error(chalk.red(`❌ Config file not found at ${configPath}`));
      console.error(chalk.red(`❌ Please create a valid configuration file.`));
      console.error(chalk.blue(`📝 No default configuration will be used.`));
      process.exit(1);
    }

    const configData = readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData) as RouterConfig;
    
    // Direct configuration usage - no defaults, no fallbacks
    return config;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`❌ Failed to load config from ${configPath}:`), errorMessage);
    console.error(chalk.red(`❌ Please fix your configuration file.`));
    process.exit(1);
  }
}

/**
 * Ensure config directory exists
 */
function ensureConfigDir(): void {
  const configDir = join(homedir(), '.claude-code-router');
  if (!existsSync(configDir)) {
    require('fs').mkdirSync(configDir, { recursive: true });
  }

  const logsDir = join(configDir, 'logs');
  if (!existsSync(logsDir)) {
    require('fs').mkdirSync(logsDir, { recursive: true });
  }
}

/**
 * Print environment setup instructions
 */
function printEnvironmentSetup(port: number, host: string): void {
  console.log(chalk.cyan('\n🔧 Environment Setup:'));
  console.log(chalk.gray('To redirect Claude Code to this router, set these environment variables:\n'));
  
  const baseUrl = `http://${host}:${port}`;
  
  if (process.platform === 'win32') {
    console.log(chalk.green('# Windows CMD'));
    console.log(`set ANTHROPIC_BASE_URL=${baseUrl}`);
    console.log(`set ANTHROPIC_API_KEY=any-string-is-ok\n`);
    
    console.log(chalk.green('# Windows PowerShell'));
    console.log(`$env:ANTHROPIC_BASE_URL="${baseUrl}"`);
    console.log(`$env:ANTHROPIC_API_KEY="any-string-is-ok"\n`);
  } else {
    console.log(chalk.green('# Bash/Zsh'));
    console.log(`export ANTHROPIC_BASE_URL="${baseUrl}"`);
    console.log(`export ANTHROPIC_API_KEY="any-string-is-ok"\n`);
  }
  
  console.log(chalk.gray('After setting these variables, Claude Code will automatically use this router.'));
}

/**
 * Start command
 */
program
  .command('start')
  .description('Start the Claude Code Router server')
  .option('-c, --config <path>', 'Configuration file path', DEFAULT_CONFIG_PATH)
  .option('-p, --port <number>', 'Server port', parseInt)
  .option('-h, --host <string>', 'Server host')
  .option('-d, --debug', 'Enable debug mode')
  .option('--log-level <level>', 'Log level (error, warn, info, debug)', 'info')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🚀 Starting Claude Code Router...\n'));

      // Load configuration
      const configPath = resolve(options.config);
      const config = loadConfig(configPath);

      // Override with CLI options
      if (options.port) config.server.port = options.port;
      if (options.host) config.server.host = options.host;
      if (options.debug) {
        config.debug.enabled = true;
        config.debug.traceRequests = true;
      }
      if (options.logLevel) config.debug.logLevel = options.logLevel;

      // Configure logger
      logger.setConfig({
        logLevel: config.debug.logLevel,
        debugMode: config.debug.enabled,
        logDir: config.debug.logDir,
        traceRequests: config.debug.traceRequests
      });

      // Create and start server
      const server = new RouterServer(config);
      
      // Handle graceful shutdown
      const shutdown = async () => {
        console.log(chalk.yellow('\n🛑 Shutting down server...'));
        await server.stop();
        console.log(chalk.green('✅ Server stopped gracefully'));
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      await server.start();
      
      printEnvironmentSetup(config.server.port, config.server.host);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red('❌ Failed to start server:'), errorMessage);
      process.exit(1);
    }
  });

/**
 * Status command
 */
program
  .command('status')
  .description('Check router status')
  .option('-p, --port <number>', 'Server port (overrides config)')
  .option('-h, --host <string>', 'Server host (overrides config)')
  .action(async (options) => {
    const config = loadConfig(options.config);
    const host = options.host || config.server?.host || 'localhost';
    const port = options.port || config.server?.port || 3000;
    
    try {
      const response = await fetch(`http://${host}:${port}/status`);
      
      if (response.ok) {
        const status = await response.json() as any;
        console.log(chalk.green('✅ Router is running'));
        console.log(chalk.cyan('📊 Status:'));
        console.log(`   Server: ${status.server} v${status.version}`);
        console.log(`   Uptime: ${Math.floor(status.uptime)}s`);
        console.log(`   Providers: ${status.providers.join(', ')}`);
        console.log(`   Debug: ${status.debug ? 'enabled' : 'disabled'}`);
        console.log(`   Routing rules: ${status.routing.rulesCount}`);
      } else {
        console.log(chalk.red('❌ Router is not responding'));
        process.exit(1);
      }
    } catch (error) {
      console.log(chalk.red('❌ Router is not running'));
      console.log(chalk.gray(`   Make sure the server is started on ${host}:${port}`));
      process.exit(1);
    }
  });

/**
 * Health command
 */
program
  .command('health')
  .description('Check router and provider health')
  .option('-p, --port <number>', 'Server port (overrides config)')
  .option('-h, --host <string>', 'Server host (overrides config)')
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);
      const host = options.host || config.server?.host || 'localhost';
      const port = options.port || config.server?.port || 3000;
      const response = await fetch(`http://${host}:${port}/health`);
      const health = await response.json() as any;
      
      if (health.overall === 'healthy') {
        console.log(chalk.green('✅ All systems healthy'));
      } else if (health.overall === 'degraded') {
        console.log(chalk.yellow('⚠️  System degraded'));
      } else {
        console.log(chalk.red('❌ System unhealthy'));
      }
      
      console.log(chalk.cyan('🏥 Provider Health:'));
      for (const [provider, status] of Object.entries(health.providers)) {
        const icon = status ? '✅' : '❌';
        const color = status ? chalk.green : chalk.red;
        console.log(`   ${icon} ${color(provider)}`);
      }
      
      console.log(`\n📈 ${health.healthy}/${health.total} providers healthy`);
      
      if (health.overall !== 'healthy') {
        process.exit(1);
      }
    } catch (error) {
      console.log(chalk.red('❌ Health check failed'));
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(chalk.gray(`   Error: ${errorMessage}`));
      process.exit(1);
    }
  });

/**
 * Code command - Start router and launch Claude Code (demo1 style)
 */
program
  .command('code')
  .description('Start router and launch Claude Code with routing')
  .option('-c, --config <path>', 'Configuration file path', DEFAULT_CONFIG_PATH)
  .option('-p, --port <number>', 'Server port', parseInt)
  .option('-h, --host <string>', 'Server host')
  .option('-d, --debug', 'Enable debug mode')
  .option('--log-level <level>', 'Log level (error, warn, info, debug)', 'info')
  .argument('[...args]', 'Arguments to pass to Claude Code')
  .action(async (args, options) => {
    await executeCodeCommand(args, options);
  });

/**
 * Config command
 */
program
  .command('config')
  .description('Show or edit configuration')
  .option('-c, --config <path>', 'Configuration file path', DEFAULT_CONFIG_PATH)
  .option('--show', 'Show current configuration')
  .option('--edit', 'Open configuration in default editor')
  .action(async (options) => {
    try {
      const configPath = resolve(options.config);
      
      if (options.show) {
        if (existsSync(configPath)) {
          const config = readFileSync(configPath, 'utf8');
          console.log(chalk.cyan('📄 Current configuration:'));
          console.log(config);
        } else {
          console.log(chalk.yellow('⚠️  No configuration file found'));
          console.log(chalk.gray(`   Expected at: ${configPath}`));
        }
      } else if (options.edit) {
        ensureConfigDir();
        if (!existsSync(configPath)) {
          console.error(chalk.red(`❌ Config file not found at ${configPath}`));
          console.error(chalk.red(`❌ Please create a configuration file first.`));
          console.error(chalk.blue(`📝 No default template available - you must create your own config.json`));
          process.exit(1);
        }
        
        const { spawn } = require('child_process');
        const editor = process.env.EDITOR || (process.platform === 'win32' ? 'notepad' : 'nano');
        
        console.log(chalk.blue(`📝 Opening ${configPath} in ${editor}...`));
        spawn(editor, [configPath], { stdio: 'inherit' });
      } else {
        console.log(chalk.cyan('📄 Configuration file location:'));
        console.log(`   ${configPath}`);
        console.log(chalk.gray('\nUse --show to display current config or --edit to modify it'));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red('❌ Config operation failed:'), errorMessage);
      process.exit(1);
    }
  });

/**
 * Stop command
 */
program
  .command('stop')
  .description('Stop the Claude Code Router server')
  .option('-p, --port <number>', 'Server port to stop', parseInt)
  .option('-h, --host <string>', 'Server host', '127.0.0.1')
  .option('-c, --config <path>', 'Configuration file path', DEFAULT_CONFIG_PATH)
  .option('-f, --force', 'Force stop using kill signal if graceful shutdown fails')
  .action(async (options) => {
    try {
      // Load configuration to get default port if not specified
      let config;
      try {
        const configPath = resolve(options.config);
        config = loadConfig(configPath);
      } catch (error) {
        // If config loading fails, use defaults
        config = { server: { port: 3456, host: '127.0.0.1' } };
      }
      
      const port = options.port || config.server.port;
      const host = options.host || config.server.host;
      
      console.log(chalk.blue(`🛑 Stopping Claude Code Router on ${host}:${port}...`));
      
      // First try to stop gracefully via API
      try {
        const axios = require('axios');
        const shutdownUrl = `http://${host}:${port}/shutdown`;
        
        await axios.post(shutdownUrl, {}, { timeout: 5000 });
        console.log(chalk.green('✅ Server stopped gracefully via API'));
        return;
        
      } catch (apiError) {
        console.log(chalk.yellow('⚠️  API shutdown failed, trying process-based shutdown...'));
      }
      
      // Fallback: Find process by port and stop it
      try {
        // Use lsof to find process using the port
        const { spawn } = require('child_process');
        const lsofProcess = spawn('lsof', ['-t', `-i:${port}`], { stdio: ['ignore', 'pipe', 'ignore'] });
        
        let pids = '';
        lsofProcess.stdout.on('data', (data: Buffer) => {
          pids += data.toString();
        });
        
        await new Promise((resolve, reject) => {
          lsofProcess.on('close', (code: number) => {
            if (code === 0 && pids.trim()) {
              resolve(pids.trim());
            } else {
              reject(new Error(`No process found on port ${port}`));
            }
          });
          
          lsofProcess.on('error', reject);
        });
        
        const pidList = pids.trim().split('\\n').filter(pid => pid.trim());
        
        if (pidList.length === 0) {
          console.log(chalk.yellow(`⚠️  No process found running on port ${port}`));
          return;
        }
        
        // Stop each process
        for (const pidStr of pidList) {
          const pid = parseInt(pidStr.trim());
          if (isNaN(pid)) continue;
          
          try {
            // Check if process exists and is running
            process.kill(pid, 0);
            console.log(chalk.blue(`📤 Sending SIGTERM to process ${pid}...`));
            
            // Try graceful shutdown first
            process.kill(pid, 'SIGTERM');
            
            // Wait for graceful shutdown
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds
            
            while (attempts < maxAttempts) {
              try {
                process.kill(pid, 0);
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
              } catch {
                // Process has stopped
                break;
              }
            }
            
            // Check if process still exists
            try {
              process.kill(pid, 0);
              
              if (options.force) {
                console.log(chalk.yellow(`⚠️  Process ${pid} did not stop gracefully, forcing...`));
                process.kill(pid, 'SIGKILL');
                console.log(chalk.green(`✅ Process ${pid} forcefully stopped`));
              } else {
                console.log(chalk.yellow(`⚠️  Process ${pid} did not stop gracefully`));
                console.log(chalk.gray('   Use --force to forcefully stop remaining processes'));
              }
            } catch {
              console.log(chalk.green(`✅ Process ${pid} stopped gracefully`));
            }
            
          } catch (killError) {
            console.log(chalk.yellow(`⚠️  Process ${pid} not found or already stopped`));
          }
        }
        
      } catch (processError) {
        if (process.platform === 'win32') {
          console.log(chalk.yellow('⚠️  Process-based shutdown not available on Windows'));
          console.log(chalk.gray('   Please stop the server manually or add shutdown API support'));
        } else {
          console.log(chalk.yellow(`⚠️  Could not find process on port ${port}`));
          console.log(chalk.gray(`   Server may already be stopped or running on a different port`));
        }
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red('❌ Stop command failed:'), errorMessage);
      process.exit(1);
    }
  });

/**
 * Version command
 */
program
  .version(VERSION, '-v, --version', 'Display version number');

/**
 * Setup program
 */
program
  .name('ccr')
  .description('Claude Code Router - Route Claude Code requests to multiple AI providers')
  .configureOutput({
    outputError: (str, write) => write(chalk.red(str))
  });

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red('❌ Invalid command: %s'), program.args.join(' '));
  console.log(chalk.gray('Use --help to see available commands'));
  process.exit(1);
});

// Parse CLI arguments
if (require.main === module) {
  program.parse(process.argv);
  
  // Show help if no command provided
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
}