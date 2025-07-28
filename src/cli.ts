/**
 * CLI for Claude Code Router
 * Command-line interface for starting and managing the router
 */

import { Command } from 'commander';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
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