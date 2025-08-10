/**
 * CLI for Claude Code Router
 * Command-line interface for starting and managing the router
 */

import { Command } from 'commander';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { promisify } from 'util';
import { spawn, exec } from 'child_process';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { RouterServer } from './server';
import { RouterConfig, ProviderConfig } from './types';
import { logger } from './utils/logger';
import { executeCodeCommand } from './code-command';
import { getConfigPaths, needsMigration, resolvePath } from './utils';
import { migrateConfiguration } from './utils/migration';
import { setupAutoStart } from './utils/autostart';

// Read version from package.json
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const VERSION = packageJson.version;

const program = new Command();
const configPaths = getConfigPaths();
const DEFAULT_CONFIG_PATH = configPaths.configFile;
const execAsync = promisify(exec);


/**
 * Intelligent configuration detection
 * 智能配置检测：根据配置文件存在情况自动选择模式
 */
function detectConfigurationMode(): { mode: 'single' | 'dual', configs: string[] } {
  const baseConfigDir = join(homedir(), '.route-claude-code');
  const devConfigPath = join(baseConfigDir, 'config.json');
  const releaseConfigPath = join(baseConfigDir, 'config.release.json');
  
  const hasDevConfig = existsSync(devConfigPath);
  const hasReleaseConfig = existsSync(releaseConfigPath);
  
  console.log(chalk.gray(`🔍 Configuration detection:`));
  console.log(chalk.gray(`   Development config: ${hasDevConfig ? '✅ Found' : '❌ Missing'} (${devConfigPath})`));
  console.log(chalk.gray(`   Release config: ${hasReleaseConfig ? '✅ Found' : '❌ Missing'} (${releaseConfigPath})`));
  
  if (hasDevConfig && hasReleaseConfig) {
    console.log(chalk.blue('🎯 Detected: Dual-config mode (both configurations found)'));
    return { mode: 'dual', configs: [devConfigPath, releaseConfigPath] };
  } else if (hasDevConfig) {
    console.log(chalk.blue('🎯 Detected: Single-config mode (development only)'));
    return { mode: 'single', configs: [devConfigPath] };
  } else if (hasReleaseConfig) {
    console.log(chalk.blue('🎯 Detected: Single-config mode (release only)'));
    return { mode: 'single', configs: [releaseConfigPath] };
  } else {
    console.log(chalk.red('❌ No configuration files found'));
    console.log(chalk.gray('   Please create at least one configuration file:'));
    console.log(chalk.gray(`   - ${devConfigPath}`));
    console.log(chalk.gray(`   - ${releaseConfigPath}`));
    throw new Error('No configuration files found');
  }
}

/**
 * Start daemon mode - using rcc-daemon.sh script with intelligent config detection
 */
async function startDaemonMode(options: any): Promise<void> {
  // Detect configuration mode intelligently
  let configMode: { mode: 'single' | 'dual', configs: string[] };
  try {
    configMode = detectConfigurationMode();
  } catch (error) {
    console.error(chalk.red('❌ Configuration detection failed:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  
  // For daemon mode, we use the appropriate daemon script based on platform
  const projectRoot = resolve(__dirname, '..');
  const isWindows = process.platform === 'win32';
  const daemonScript = isWindows 
    ? join(projectRoot, 'rcc-daemon.ps1')
    : join(projectRoot, 'rcc-daemon.sh');
  
  // Check if daemon script exists
  if (!existsSync(daemonScript)) {
    const scriptType = isWindows ? 'PowerShell' : 'shell';
    console.error(chalk.red(`❌ Daemon ${scriptType} script not found: ${daemonScript}`));
    console.error(chalk.gray(`   Please ensure ${isWindows ? 'rcc-daemon.ps1' : 'rcc-daemon.sh'} is in the project root`));
    process.exit(1);
  }
  
  try {
    console.log(chalk.blue(`🚀 Starting RCC daemon (${configMode.mode}-config mode)...`));
    
    // Execute daemon start command with detected mode
    const daemonArgs = configMode.mode === 'dual' ? '--dual-config' : '--single-config';
    const command = isWindows 
      ? `powershell -ExecutionPolicy Bypass -File "${daemonScript}" -Command start -ConfigMode ${daemonArgs}`
      : `bash "${daemonScript}" start ${daemonArgs}`;
    
    const { stdout, stderr } = await execAsync(command);
    
    if (stdout) {
      console.log(stdout);
    }
    if (stderr) {
      console.error(chalk.yellow(stderr));
    }
    
    // Handle autostart if requested
    if (options.autostart) {
      console.log(chalk.blue('\n🔧 Setting up automatic startup...'));
      try {
        const autostartResult = await setupAutoStart({
          configPath: join(homedir(), '.route-claude-code', 'config.json'),
          port: 3456, // Primary development port
          host: 'localhost',
          debug: options.debug || false,
          logLevel: options.logLevel || 'info'
        });
        
        if (autostartResult.success) {
          console.log(chalk.green('✅ Automatic startup configured!'));
          console.log(chalk.gray(`   Service: ${autostartResult.serviceName}`));
          console.log(chalk.gray(`   Status: ${autostartResult.message}`));
        } else {
          console.log(chalk.yellow('⚠️  Automatic startup setup failed:'));
          console.log(chalk.red(`   ${autostartResult.error}`));
        }
      } catch (error) {
        console.log(chalk.yellow('⚠️  Could not setup automatic startup:'));
        console.log(chalk.red(`   ${error instanceof Error ? error.message : String(error)}`));
      }
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to start daemon:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Stop daemon mode - using platform-appropriate daemon script
 */
async function stopDaemonMode(): Promise<void> {
  const projectRoot = resolve(__dirname, '..');
  const isWindows = process.platform === 'win32';
  const daemonScript = isWindows 
    ? join(projectRoot, 'rcc-daemon.ps1')
    : join(projectRoot, 'rcc-daemon.sh');
  
  // Check if daemon script exists
  if (!existsSync(daemonScript)) {
    const scriptType = isWindows ? 'PowerShell' : 'shell';
    console.error(chalk.red(`❌ Daemon ${scriptType} script not found: ${daemonScript}`));
    console.error(chalk.gray(`   Please ensure ${isWindows ? 'rcc-daemon.ps1' : 'rcc-daemon.sh'} is in the project root`));
    process.exit(1);
  }
  
  try {
    console.log(chalk.blue('🛑 Stopping RCC daemon...'));
    
    // Execute daemon stop command
    const command = isWindows 
      ? `powershell -ExecutionPolicy Bypass -File "${daemonScript}" -Command stop`
      : `bash "${daemonScript}" stop`;
    
    const { stdout, stderr } = await execAsync(command);
    
    if (stdout) {
      console.log(stdout);
    }
    if (stderr) {
      console.error(chalk.yellow(stderr));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to stop daemon:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Check daemon status - using platform-appropriate daemon script
 */
async function checkDaemonStatus(): Promise<void> {
  const projectRoot = resolve(__dirname, '..');
  const isWindows = process.platform === 'win32';
  const daemonScript = isWindows 
    ? join(projectRoot, 'rcc-daemon.ps1')
    : join(projectRoot, 'rcc-daemon.sh');
  
  // Check if daemon script exists
  if (!existsSync(daemonScript)) {
    const scriptType = isWindows ? 'PowerShell' : 'shell';
    console.error(chalk.red(`❌ Daemon ${scriptType} script not found: ${daemonScript}`));
    console.error(chalk.gray(`   Please ensure ${isWindows ? 'rcc-daemon.ps1' : 'rcc-daemon.sh'} is in the project root`));
    process.exit(1);
  }
  
  try {
    console.log(chalk.blue('📊 Checking RCC daemon status...'));
    
    // Execute daemon status command
    const command = isWindows 
      ? `powershell -ExecutionPolicy Bypass -File "${daemonScript}" -Command status`
      : `bash "${daemonScript}" status`;
    
    const { stdout, stderr } = await execAsync(command);
    
    if (stdout) {
      console.log(stdout);
    }
    if (stderr && stderr.trim()) {
      console.error(chalk.yellow(stderr));
    }
    
  } catch (error) {
    // Status command might exit with non-zero code if daemon is not running
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('not running')) {
      console.log(chalk.red('❌ RCC daemon is not running'));
    } else {
      console.error(chalk.red('❌ Failed to check daemon status:'), errorMessage);
    }
    process.exit(1);
  }
}

/**
 * Default configuration
 */
// No default configuration - user must provide complete config.json

/**
 * Start dual configuration servers (development + release)
 */
async function startDualConfigServers(options: any): Promise<void> {
  console.log(chalk.cyan('🔄 Starting dual configuration servers...\n'));
  
  const baseConfigDir = join(homedir(), '.route-claude-code');
  const devConfigPath = join(baseConfigDir, 'config.json');
  const releaseConfigPath = join(baseConfigDir, 'config.release.json');
  
  // Check if both config files exist
  if (!existsSync(devConfigPath)) {
    console.error(chalk.red(`❌ Development config not found: ${devConfigPath}`));
    process.exit(1);
  }
  
  if (!existsSync(releaseConfigPath)) {
    console.error(chalk.red(`❌ Release config not found: ${releaseConfigPath}`));
    process.exit(1);
  }
  
  // Load both configurations
  const devConfig = loadConfig(devConfigPath);
  const releaseConfig = loadConfig(releaseConfigPath);
  
  console.log(chalk.green(`✅ Development config loaded: ${devConfigPath}`));
  console.log(chalk.green(`✅ Release config loaded: ${releaseConfigPath}\n`));
  
  // Apply CLI overrides to both configs
  const applyOptions = (config: RouterConfig, suffix: string = '') => {
    if (options.host) config.server.host = options.host;
    if (options.debug) {
      config.debug.enabled = true;
      config.debug.traceRequests = true;
    }
    if (options.logLevel) config.debug.logLevel = options.logLevel;
    
    // Ensure different ports for dual mode
    if (!suffix) {
      // Development server uses configured port or default
      config.server.port = (config.server as any).ports?.development || config.server.port || 3456;
    } else {
      // Release server uses release port or default port from config
      config.server.port = (config.server as any).ports?.release || config.server.port || 8888;
    }
    
    return config;
  };
  
  const finalDevConfig = applyOptions(devConfig);
  const finalReleaseConfig = applyOptions(releaseConfig, 'release');
  
  console.log(chalk.blue(`🚀 Development server: http://${finalDevConfig.server.host}:${finalDevConfig.server.port}`));
  console.log(chalk.blue(`🚀 Release server: http://${finalReleaseConfig.server.host}:${finalReleaseConfig.server.port}\n`));
  
  // Configure separate log directories for dual servers
  finalDevConfig.debug.logDir = join(finalDevConfig.debug.logDir, 'dev');
  finalReleaseConfig.debug.logDir = join(finalReleaseConfig.debug.logDir, 'release');
  
  console.log(chalk.gray(`📁 Development logs: ${finalDevConfig.debug.logDir}`));
  console.log(chalk.gray(`📁 Release logs: ${finalReleaseConfig.debug.logDir}`));
  
  // 🔧 修复RCC_PORT问题：在创建RouterServer之前设置环境变量  
  // 对于dual-config模式，使用开发服务器的端口作为默认logger端口
  process.env.RCC_PORT = finalDevConfig.server.port.toString();
  
  // Create both servers with independent loggers
  const devServer = new RouterServer(finalDevConfig, 'dev');
  const releaseServer = new RouterServer(finalReleaseConfig, 'release');
  
  // Start both servers
  const devServerPromise = devServer.start().then(() => {
    console.log(chalk.green(`✅ Development server started on port ${finalDevConfig.server.port}`));
  });
  
  const releaseServerPromise = releaseServer.start().then(() => {
    console.log(chalk.green(`✅ Release server started on port ${finalReleaseConfig.server.port}`));
  });
  
  await Promise.all([devServerPromise, releaseServerPromise]);
  
  console.log(chalk.cyan('\n🎯 Both servers are running!'));
  console.log(chalk.gray('   Press Ctrl+C to stop both servers\n'));
  
  // Handle graceful shutdown for both servers
  let isShuttingDown = false;
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log(chalk.yellow('\n🛑 Shutting down both servers...'));
    
    try {
      await Promise.all([
        devServer.stop(),
        releaseServer.stop()
      ]);
      console.log(chalk.green('✅ Both servers stopped gracefully'));
    } catch (error) {
      console.error(chalk.red('❌ Error during shutdown:'), error);
    }
    
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('uncaughtException', (error) => {
    console.error(chalk.red('❌ Uncaught Exception:'), error);
    shutdown();
  });
  
  // Keep the process alive until shutdown is called
  console.log(chalk.gray('\n📋 Dual servers are running. Press Ctrl+C to stop.'));
  
  // Keep the process alive indefinitely - signal handlers are already set up above
  return new Promise<void>(() => {
    // This promise never resolves, keeping the process alive
    // Signal handlers (already set up) will call shutdown() and process.exit()
  });
}

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
  const configDir = configPaths.configDir;
  if (!existsSync(configDir)) {
    require('fs').mkdirSync(configDir, { recursive: true });
  }

  const logsDir = configPaths.logsDir;
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
 * Start command - enhanced with daemon support
 */
program
  .command('start')
  .description('Start the Claude Code Router server (default: dual-config mode)')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-p, --port <number>', 'Server port', parseInt)
  .option('-h, --host <string>', 'Server host')
  .option('-d, --debug', 'Enable debug mode')
  .option('--log-level <level>', 'Log level (error, warn, info, debug)', 'info')
  .option('--autostart', 'Enable automatic startup on system boot')
  .option('--single-config', 'Start only single server instead of dual-config mode')
  .option('--dual-config', 'Force dual-config mode (start both servers)')
  .option('--daemon', 'Start in daemon mode (background process)')
  .action(async (options) => {
    try {
      // Check for migration before starting
      if (needsMigration()) {
        console.log(chalk.yellow('🔄 Configuration migration needed...'));
        console.log(chalk.gray('   Legacy config found at ~/.claude-code-router'));
        console.log(chalk.gray('   Migrating to ~/.route-claude-code...'));
        
        const migrationResult = await migrateConfiguration();
        
        if (migrationResult.success) {
          console.log(chalk.green(`✅ Migration completed! ${migrationResult.filesTransferred} files transferred`));
          console.log(chalk.gray('   Now using ~/.route-claude-code for configuration'));
        } else {
          console.log(chalk.red('❌ Migration failed:'));
          migrationResult.errors.forEach(error => console.log(chalk.red(`   • ${error}`)));
          console.log(chalk.yellow('\n⚠️  Please run migration manually: node migrate-config.js'));
        }
        console.log('');
      }
      
      console.log(chalk.blue('🚀 Starting Claude Code Router...\n'));

      // Check for daemon mode first
      if (options.daemon) {
        return await startDaemonMode(options);
      }

      // Handle configuration detection based on --config flag
      if (options.config) {
        // User specified a config file, force single-config mode
        console.log(chalk.blue(`🎯 Custom config specified: ${options.config}`));
        console.log(chalk.blue('🎯 Starting single-config server with custom configuration\n'));
        // Skip dual config detection - proceed directly to single server logic
      } else {
        // No --config flag, use intelligent configuration detection
        try {
          const configMode = detectConfigurationMode();
          
          if (configMode.mode === 'dual') {
            console.log(chalk.blue('🎯 Intelligent detection: Starting dual-config servers\n'));
            return await startDualConfigServers(options);
          } else {
            console.log(chalk.blue(`🎯 Intelligent detection: Starting single-config server\n`));
            // Continue to single server logic below with detected config
            options.config = configMode.configs[0];
          }
        } catch (error) {
          console.error(chalk.red('❌ Configuration detection failed:'), error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }

      // Load configuration
      const configPath = resolvePath(options.config);
      const config = loadConfig(configPath);

      // Override with CLI options
      if (options.port) config.server.port = options.port;
      if (options.host) config.server.host = options.host;
      if (options.debug) {
        config.debug.enabled = true;
        config.debug.traceRequests = true;
      }
      if (options.logLevel) config.debug.logLevel = options.logLevel;

      // 🔧 修复RCC_PORT问题：在创建RouterServer之前设置环境变量
      // 确保logger可以正确初始化
      process.env.RCC_PORT = config.server.port.toString();

      // Note: Logger configuration is now handled by the unified logging system
      // in RouterServer constructor, no need for legacy setConfig call

      // Create and start server
      const server = new RouterServer(config);
      
      // Handle graceful shutdown
      let isShuttingDown = false;
      const shutdown = async () => {
        if (isShuttingDown) return;
        isShuttingDown = true;

        console.log(chalk.yellow('\n🛑 Shutting down server...'));

        const timeout = setTimeout(() => {
          console.log(chalk.red('⏰ Graceful shutdown timed out. Forcing exit.'));
          process.exit(1);
        }, 5000); // 5-second timeout

        try {
          await server.stop();
          clearTimeout(timeout);
          console.log(chalk.green('✅ Server stopped gracefully'));
          process.exit(0);
        } catch (error) {
          clearTimeout(timeout);
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(chalk.red('❌ Error during shutdown:'), errorMessage);
          process.exit(1);
        }
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      await server.start();
      
      // Handle autostart setup if requested
      if (options.autostart) {
        console.log(chalk.blue('\n🔧 Setting up automatic startup...'));
        try {
          const autostartResult = await setupAutoStart({
            configPath: configPath,
            port: config.server.port,
            host: config.server.host,
            debug: config.debug.enabled,
            logLevel: config.debug.logLevel
          });
          
          if (autostartResult.success) {
            console.log(chalk.green('✅ Automatic startup configured!'));
            console.log(chalk.gray(`   Service: ${autostartResult.serviceName}`));
            console.log(chalk.gray(`   Status: ${autostartResult.message}`));
          } else {
            console.log(chalk.yellow('⚠️  Automatic startup setup failed:'));
            console.log(chalk.red(`   ${autostartResult.error}`));
          }
        } catch (error) {
          console.log(chalk.yellow('⚠️  Could not setup automatic startup:'));
          console.log(chalk.red(`   ${error instanceof Error ? error.message : String(error)}`));
        }
      }
      
      printEnvironmentSetup(config.server.port, config.server.host);

      // 🔧 FIX: Keep process alive to handle SIGINT/SIGTERM
      console.log(chalk.gray('\n📋 Server is running. Press Ctrl+C to stop.'));
      
      // Keep the process alive indefinitely - signal handlers are already set up above
      return new Promise<void>(() => {
        // This promise never resolves, keeping the process alive
        // Signal handlers (already set up) will call shutdown() and process.exit()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red('❌ Failed to start server:'), errorMessage);
      process.exit(1);
    }
  });

/**
 * Status command - enhanced with daemon support
 */
program
  .command('status')
  .description('Check router status')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-p, --port <number>', 'Server port (overrides config)')
  .option('-h, --host <string>', 'Server host (overrides config)')
  .option('--daemon', 'Check daemon status instead of direct server status')
  .action(async (options) => {
    // Check for daemon mode first
    if (options.daemon) {
      return await checkDaemonStatus();
    }
    let configPath;
    if (options.config) {
      configPath = resolvePath(options.config);
    } else {
      // No --config flag, use intelligent configuration detection
      const configMode = detectConfigurationMode();
      configPath = resolve(configMode.configs[0]);
    }
    const config = loadConfig(configPath);
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
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (options) => {
    try {
      let configPath;
      if (options.config) {
        configPath = resolvePath(options.config);
      } else {
        // No --config flag, use intelligent configuration detection
        const configMode = detectConfigurationMode();
        configPath = resolve(configMode.configs[0]);
      }
      const config = loadConfig(configPath);
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
  .option('-c, --config <path>', 'Configuration file path')
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
  .option('-c, --config <path>', 'Configuration file path')
  .option('--show', 'Show current configuration')
  .option('--edit', 'Open configuration in default editor')
  .action(async (options) => {
    try {
      let configPath;
      if (options.config) {
        configPath = resolvePath(options.config);
      } else {
        // No --config flag, use intelligent configuration detection
        const configMode = detectConfigurationMode();
        configPath = resolve(configMode.configs[0]);
      }
      
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
 * Migrate command
 */
program
  .command('migrate')
  .description('Migrate configuration from ~/.claude-code-router to ~/.route-claude-code')
  .option('--force', 'Force migration even if new config already exists')
  .option('--backup', 'Create backup before migration')
  .action(async (options) => {
    try {
      const { getLegacyConfigPaths, getNewConfigPaths } = require('./utils/config-paths');
      const { migrateConfiguration, backupLegacyConfiguration, removeLegacyConfiguration } = require('./utils/migration');
      
      const legacyPaths = getLegacyConfigPaths();
      const newPaths = getNewConfigPaths();
      
      console.log(chalk.blue('🔄 Configuration Migration Tool'));
      console.log('================================');
      
      // Check if legacy directory exists
      if (!existsSync(legacyPaths.configDir)) {
        console.log(chalk.green('✅ No legacy configuration found - nothing to migrate'));
        return;
      }
      
      // Check if new directory already exists (unless forced)
      if (existsSync(newPaths.configDir) && !options.force) {
        console.log(chalk.yellow('⚠️  New configuration directory already exists'));
        console.log(`   Legacy: ${legacyPaths.configDir}`);
        console.log(`   New:    ${newPaths.configDir}`);
        console.log('');
        console.log('Use --force to overwrite or manually review configurations.');
        return;
      }
      
      // Create backup if requested
      if (options.backup) {
        console.log(chalk.blue('🔍 Creating backup...'));
        const backupPath = await backupLegacyConfiguration();
        if (backupPath) {
          console.log(chalk.green(`✅ Backup created: ${backupPath}`));
        } else {
          console.log(chalk.red('❌ Failed to create backup'));
          return;
        }
      }
      
      // Perform migration
      console.log(chalk.blue('🚀 Starting migration...'));
      const result = await migrateConfiguration();
      
      if (result.success) {
        console.log(chalk.green('✅ Migration completed successfully!'));
        console.log(`   Files transferred: ${result.filesTransferred}`);
        console.log(`   From: ${legacyPaths.configDir}`);
        console.log(`   To:   ${newPaths.configDir}`);
        console.log('');
        console.log(chalk.blue('🎉 Your configuration is now using the new path!'));
        
        // Ask about cleanup
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        rl.question('Remove legacy configuration directory? (y/N): ', async (answer: string) => {
          if (answer.toLowerCase() === 'y') {
            const removed = await removeLegacyConfiguration();
            if (removed) {
              console.log(chalk.green('✅ Legacy configuration removed'));
            } else {
              console.log(chalk.yellow('⚠️  Failed to remove legacy configuration'));
            }
          } else {
            console.log(chalk.gray('Legacy configuration preserved'));
          }
          rl.close();
        });
        
      } else {
        console.log(chalk.red('❌ Migration failed:'));
        result.errors.forEach((error: string) => console.log(chalk.red(`   • ${error}`)));
      }
      
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red('❌ Migration failed:'), errorMessage);
      process.exit(1);
    }
  });

/**
 * Stop command - enhanced with daemon support
 */
program
  .command('stop')
  .description('Stop the Claude Code Router server')
  .option('-p, --port <number>', 'Server port to stop', parseInt)
  .option('-h, --host <string>', 'Server host', '127.0.0.1')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-f, --force', 'Force stop using kill signal if graceful shutdown fails')
  .option('--daemon', 'Stop daemon mode (background process)')
  .action(async (options) => {
    // Check for daemon mode first
    if (options.daemon) {
      return await stopDaemonMode();
    }
    try {
      // Load configuration to get default port if not specified
      let config;
      try {
        const configPath = options.config ? resolvePath(options.config) : (() => {
          // No --config flag, use intelligent configuration detection
          const configMode = detectConfigurationMode();
          return resolve(configMode.configs[0]);
        })();
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
 * Provider management commands
 */
const providerCommand = program
  .command('provider')
  .description('Manage AI providers and their model configurations');

// Provider update command
providerCommand
  .command('update')
  .description('Scan all configurations, discover models, and generate dynamic configs')
  .option('--timeout <number>', 'Request timeout in milliseconds', '30000')
  .option('--max-retries <number>', 'Maximum retries per model test', '3')
  .option('--skip-backup', 'Skip configuration backup')
  .option('--verbose', 'Enable verbose output')
  .action(async (options) => {
    try {
      // 确保RCC_PORT环境变量已设置，用于logger初始化
      if (!process.env.RCC_PORT) {
        process.env.RCC_PORT = '3456';
      }
      
      console.log(chalk.cyan('🚀 Claude Code Router - Provider Update'));
      console.log(chalk.gray(`Version: ${VERSION}\n`));

      const { createProviderManager } = await import('./cli/provider-manager');
      const manager = createProviderManager();

      const summary = await manager.updateAllProviders({
        timeout: parseInt(options.timeout),
        maxRetries: parseInt(options.maxRetries),
        skipBackup: options.skipBackup,
        verbose: options.verbose
      });

      // 设置退出码
      const hasErrors = summary.errors.length > 0;
      const hasFailures = summary.successfulUpdates < summary.totalProviders;
      
      if (hasErrors || hasFailures) {
        console.log(chalk.yellow('\n⚠️ Update completed with issues'));
        process.exit(1);
      } else {
        console.log(chalk.green('\n✅ Update completed successfully'));
        process.exit(0);
      }

    } catch (error) {
      console.error(chalk.red('❌ Provider update failed:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Provider list command
providerCommand
  .command('list')
  .description('List all providers found in configuration files')
  .option('--format <format>', 'Output format (table|json)', 'table')
  .action(async (options) => {
    try {
      // 确保RCC_PORT环境变量已设置，用于logger初始化
      if (!process.env.RCC_PORT) {
        process.env.RCC_PORT = '3456';
      }
      
      const { createProviderManager } = await import('./cli/provider-manager');
      const manager = createProviderManager();

      // 扫描配置并提取providers（简化版）
      console.log(chalk.cyan('📋 Scanning provider configurations...\n'));
      
      // 这里可以添加简单的配置扫描逻辑
      console.log(chalk.gray('Use "rcc provider update" to perform full discovery and testing'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to list providers:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Provider status command
providerCommand
  .command('status')
  .description('Show status of generated dynamic configurations')
  .action(async () => {
    try {
      const { homedir } = require('os');
      const { readdir, stat } = require('fs').promises;
      const { join } = require('path');
      
      const dynamicDir = join(homedir(), '.route-claude-code', 'config', 'dynamic');
      
      console.log(chalk.cyan('📊 Dynamic Configuration Status'));
      console.log(chalk.gray(`Directory: ${dynamicDir}\n`));
      
      try {
        const files = await readdir(dynamicDir);
        const configFiles = files.filter((f: string) => f.endsWith('.json'));
        
        if (configFiles.length === 0) {
          console.log(chalk.yellow('⚠️ No dynamic configurations found'));
          console.log(chalk.gray('Run "rcc provider update" to generate configurations'));
          return;
        }
        
        console.log(chalk.green(`✅ Found ${configFiles.length} dynamic configuration files:`));
        
        for (const file of configFiles) {
          const filePath = join(dynamicDir, file);
          const stats = await stat(filePath);
          const modifiedTime = stats.mtime.toLocaleString();
          const size = (stats.size / 1024).toFixed(1);
          
          console.log(chalk.gray(`   📄 ${file}`));
          console.log(chalk.gray(`      Modified: ${modifiedTime}, Size: ${size}KB`));
        }
        
      } catch (error) {
        console.log(chalk.yellow('⚠️ Dynamic configuration directory not found'));
        console.log(chalk.gray('Run "rcc provider update" to create and populate the directory'));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to check provider status:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * Test command
 */
program
  .command('test')
  .description('Test provider configurations and update config files')
  .argument('[provider]', 'Specific provider to test (optional)')
  .argument('[model]', 'Specific model to test (optional, requires provider)')
  .option('-c, --config <path>', 'Configuration file path (default: config.json and config.release.json)')
  .action(async (provider, model, options) => {
    try {
      const { executeTestCommand } = await import('./commands/test-command');
      await executeTestCommand(provider, model, options);
    } catch (error) {
      console.error(chalk.red('❌ Test command failed:'), error instanceof Error ? error.message : String(error));
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
  .name('rcc')
  .description('Route Claude Code - Route Claude Code requests to multiple AI providers')
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