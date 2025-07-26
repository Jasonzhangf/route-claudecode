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
import { RouterConfig, RoutingConfig, ProviderConfig } from './types';
import { logger } from './utils/logger';
import { createRoutingRules } from './routing';

const program = new Command();
const DEFAULT_CONFIG_PATH = join(homedir(), '.claude-code-router', 'config-router.json');

/**
 * Default configuration
 */
const DEFAULT_CONFIG: RouterConfig = {
  server: {
    port: 3456,
    host: '127.0.0.1'
  },
  routing: {
    rules: [],
    defaultProvider: 'codewhisperer-primary',
    providers: {
      'codewhisperer-primary': {
        type: 'codewhisperer',
        endpoint: 'https://codewhisperer.us-east-1.amazonaws.com',
        authentication: {
          type: 'bearer',
          credentials: {}
        },
        settings: {
          profileArn: 'arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK',
          categoryMappings: {
            default: true,
            background: true,
            thinking: true,
            longcontext: true,
            search: true
          }
        }
      },
      'shuaihong-openai': {
        type: 'openai',
        endpoint: 'https://api.shuaihong.ai',
        authentication: {
          type: 'bearer',
          credentials: {
            apiKey: 'your-shuaihong-api-key'
          }
        },
        settings: {
          categoryMappings: {
            default: false,
            background: false,
            thinking: false,
            longcontext: false,
            search: true
          }
        }
      }
    }
  },
  debug: {
    enabled: false,
    logLevel: 'info',
    traceRequests: false,
    saveRequests: false,
    logDir: join(homedir(), '.claude-code-router', 'logs')
  },
  hooks: []
};

/**
 * Load configuration from file
 */
function loadConfig(configPath: string): RouterConfig {
  try {
    if (!existsSync(configPath)) {
      console.log(chalk.yellow(`⚠️  Config file not found at ${configPath}`));
      console.log(chalk.blue(`📝 Creating default configuration...`));
      
      // Create default config
      ensureConfigDir();
      writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
      console.log(chalk.green(`✅ Default configuration created at ${configPath}`));
      
      return DEFAULT_CONFIG;
    }

    const configData = readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData) as RouterConfig;
    
    // Merge with defaults
    const mergedConfig: RouterConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      server: { ...DEFAULT_CONFIG.server, ...config.server },
      debug: { ...DEFAULT_CONFIG.debug, ...config.debug },
      routing: {
        ...DEFAULT_CONFIG.routing,
        ...config.routing,
        providers: { ...DEFAULT_CONFIG.routing.providers, ...config.routing?.providers }
      }
    };

    // Initialize routing rules (skip for object-based config)
    if (Array.isArray(config.routing?.rules)) {
      mergedConfig.routing.rules = createRoutingRules(config);
    }

    return mergedConfig;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`❌ Failed to load config from ${configPath}:`), errorMessage);
    console.log(chalk.blue(`📝 Using default configuration...`));
    return DEFAULT_CONFIG;
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
  .option('-p, --port <number>', 'Server port', '3456')
  .option('-h, --host <string>', 'Server host', '127.0.0.1')
  .action(async (options) => {
    try {
      const response = await fetch(`http://${options.host}:${options.port}/status`);
      
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
      console.log(chalk.gray(`   Make sure the server is started on ${options.host}:${options.port}`));
      process.exit(1);
    }
  });

/**
 * Health command
 */
program
  .command('health')
  .description('Check router and provider health')
  .option('-p, --port <number>', 'Server port', '3456')
  .option('-h, --host <string>', 'Server host', '127.0.0.1')
  .action(async (options) => {
    try {
      const response = await fetch(`http://${options.host}:${options.port}/health`);
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
 * Code command - Start router and launch Claude Code
 */
program
  .command('code')
  .description('Start router and launch Claude Code with routing')
  .option('-c, --config <path>', 'Configuration file path', DEFAULT_CONFIG_PATH)
  .option('-p, --port <number>', 'Server port', parseInt)
  .option('-h, --host <string>', 'Server host')
  .option('-d, --debug', 'Enable debug mode')
  .option('--log-level <level>', 'Log level (error, warn, info, debug)', 'info')
  .argument('[prompt]', 'Optional prompt to send to Claude Code')
  .action(async (prompt, options) => {
    try {
      console.log(chalk.blue('🚀 Starting Claude Code Router with integrated Claude Code...\n'));

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

      // Check if port is occupied and kill if needed
      const { spawn, exec } = require('child_process');
      const port = config.server.port;
      
      try {
        await new Promise<void>((resolve, reject) => {
          exec(`lsof -i :${port}`, (error: any, stdout: string) => {
            if (stdout) {
              console.log(chalk.yellow(`⚠️  Port ${port} is occupied, killing processes...`));
              exec(`lsof -ti :${port} | xargs kill -9`, (killError: any) => {
                setTimeout(resolve, 2000); // Wait 2s for processes to die
              });
            } else {
              resolve();
            }
          });
        });
      } catch (error) {
        // Ignore port check errors
      }

      // Create and start server
      console.log(chalk.blue(`🌐 Starting Claude Code Router on port ${port}...`));
      const server = new RouterServer(config);
      
      // Start server in background
      await server.start();
      
      // Wait a moment for server to be ready
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify server is running
      try {
        const response = await fetch(`http://${config.server.host}:${port}/status`);
        if (response.ok) {
          console.log(chalk.green('✅ Router started successfully!'));
        } else {
          throw new Error('Router not responding');
        }
      } catch (error) {
        console.error(chalk.red('❌ Failed to verify router status'));
        throw error;
      }

      // Set environment variables for claude-code subprocess
      const env = {
        ...process.env,
        ANTHROPIC_BASE_URL: `http://${config.server.host}:${port}`,
        ANTHROPIC_API_KEY: 'any-string-is-ok'
      };

      console.log(chalk.green('🔧 Environment variables set for Claude Code routing'));
      console.log(chalk.cyan('📊 Router Status:'));
      
      try {
        const statusResponse = await fetch(`http://${config.server.host}:${port}/status`);
        const status = await statusResponse.json() as any;
        console.log(`   Providers: ${status.providers.join(', ')}`);
        console.log(`   Default: ${status.routing.defaultProvider}`);
      } catch (error) {
        // Ignore status display errors
      }

      // Enable quiet mode to reduce logging interference with Claude Code
      logger.setQuietMode(true);

      // Launch Claude Code
      let claude: any = null;
      
      if (prompt) {
        console.log(chalk.blue(`🤖 Launching Claude Code with prompt: "${prompt}"`));
        console.log(chalk.cyan('===============================================\n'));
        
        claude = spawn('claude', [prompt], {
          stdio: 'inherit',
          env
        });

        claude.on('close', (code: number) => {
          console.log(chalk.cyan(`\n🏁 Claude Code session ended (exit code: ${code})`));
          server.stop().then(() => {
            console.log(chalk.green('✅ Router stopped'));
            process.exit(code || 0);
          }).catch((err) => {
            console.error(chalk.red('❌ Error stopping server:'), err.message);
            process.exit(1);
          });
        });

        claude.on('error', (error: Error) => {
          console.error(chalk.red('❌ Failed to launch Claude Code:'), error.message);
          console.log(chalk.yellow('💡 Make sure @anthropic-ai/claude-code is installed: npm install -g @anthropic-ai/claude-code'));
          server.stop().then(() => process.exit(1)).catch(() => process.exit(1));
        });

        // Handle process signals more gracefully
        claude.on('disconnect', () => {
          console.log(chalk.yellow('⚠️  Claude Code process disconnected'));
          server.stop().then(() => process.exit(0)).catch(() => process.exit(0));
        });

      } else {
        // Interactive mode
        console.log(chalk.blue('🤖 Launching Claude Code in interactive mode...'));
        console.log(chalk.cyan('===============================================\n'));
        
        claude = spawn('claude', [], {
          stdio: 'inherit',
          env
        });

        claude.on('close', (code: number) => {
          console.log(chalk.cyan(`\n🏁 Claude Code session ended (exit code: ${code})`));
          server.stop().then(() => {
            console.log(chalk.green('✅ Router stopped'));
            process.exit(code || 0);
          }).catch((err) => {
            console.error(chalk.red('❌ Error stopping server:'), err.message);
            process.exit(1);
          });
        });

        claude.on('error', (error: Error) => {
          console.error(chalk.red('❌ Failed to launch Claude Code:'), error.message);
          console.log(chalk.yellow('💡 Make sure @anthropic-ai/claude-code is installed: npm install -g @anthropic-ai/claude-code'));
          server.stop().then(() => process.exit(1)).catch(() => process.exit(1));
        });

        // Handle process signals more gracefully
        claude.on('disconnect', () => {
          console.log(chalk.yellow('⚠️  Claude Code process disconnected'));
          server.stop().then(() => process.exit(0)).catch(() => process.exit(0));
        });
      }

      // Handle graceful shutdown
      const shutdown = async (signal?: string) => {
        console.log(chalk.yellow(`\n🛑 Shutting down router ${signal ? `(${signal})` : ''}...`));
        
        try {
          // First, try to kill the claude process gracefully
          if (claude && !claude.killed) {
            claude.kill('SIGTERM');
            // Wait a bit for graceful shutdown
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Force kill if still running
            if (!claude.killed) {
              claude.kill('SIGKILL');
            }
          }
          
          await server.stop();
          console.log(chalk.green('✅ Router stopped gracefully'));
          process.exit(0);
        } catch (error) {
          console.error(chalk.red('❌ Error during shutdown:'), error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      };

      // Handle various termination signals
      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGHUP', () => shutdown('SIGHUP'));
      
      // Handle uncaught exceptions to prevent crashes
      process.on('uncaughtException', (error) => {
        console.error(chalk.red('💥 Uncaught exception:'), error.message);
        shutdown('uncaughtException').catch(() => process.exit(1));
      });
      
      process.on('unhandledRejection', (reason) => {
        console.error(chalk.red('💥 Unhandled rejection:'), reason);
        shutdown('unhandledRejection').catch(() => process.exit(1));
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red('❌ Failed to start integrated Claude Code:'), errorMessage);
      process.exit(1);
    }
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
          writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
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
  .version('2.0.0', '-v, --version', 'Display version number');

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