/**
 * Code command implementation (demo1 style)
 * Stable process management with reference counting
 */

import chalk from 'chalk';
import { quickLog } from './logging';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { RouterConfig } from './types';
import { getConfigPaths, resolvePath } from './utils';

/**
 * Load configuration from file
 */
function loadConfig(configPath: string): RouterConfig {
  try {
    if (!existsSync(configPath)) {
      quickLog(chalk.yellow(`⚠️  Config file not found at ${configPath}`));
      process.exit(1);
    }

    const configData = readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData) as RouterConfig;
    
    // No defaults - user must provide complete configuration
    return config;
  } catch (error) {
    quickLog(chalk.red('❌ Failed to load configuration:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

export async function executeCodeCommand(args: string[], options: any) {
  try {
    // Import required modules
    const { spawn } = require('child_process');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    // Import fetch for Node.js compatibility
    const fetch = globalThis.fetch;

    let config: RouterConfig | null = null;
    let port: number;
    let host: string;

    // If port is specified, skip config loading and use direct connection
    if (options.port) {
      port = options.port;
      host = options.host || '127.0.0.1';
      quickLog(chalk.blue(`🎯 Direct connection mode: targeting ${host}:${port}`));
    } else {
      // Load configuration only when not using --port
      const configPath = resolvePath(options.config);
      config = loadConfig(configPath);
      
      // Override with CLI options
      if (options.host) config.server.host = options.host;
      if (options.debug) {
        config.debug.enabled = true;
        config.debug.traceRequests = true;
      }
      if (options.logLevel) config.debug.logLevel = options.logLevel;

      port = config.server.port;
      host = config.server.host;
    }

    // Reference counting for service management
    const refCountFile = path.join(os.tmpdir(), 'ccr-reference-count.txt');
    const configPaths = getConfigPaths();
    const pidFile = path.join(configPaths.configDir, '.ccr.pid');

    function incrementReferenceCount(): void {
      let count = 0;
      if (fs.existsSync(refCountFile)) {
        try {
          count = parseInt(fs.readFileSync(refCountFile, 'utf8').trim()) || 0;
        } catch {}
      }
      fs.writeFileSync(refCountFile, (count + 1).toString());
    }

    function decrementReferenceCount(): number {
      let count = 0;
      if (fs.existsSync(refCountFile)) {
        try {
          count = parseInt(fs.readFileSync(refCountFile, 'utf8').trim()) || 0;
        } catch {}
      }
      const newCount = Math.max(0, count - 1);
      if (newCount === 0) {
        try {
          fs.unlinkSync(refCountFile);
        } catch {}
      } else {
        fs.writeFileSync(refCountFile, newCount.toString());
      }
      return newCount;
    }

    function isServiceRunning(): boolean {
      if (!fs.existsSync(pidFile)) {
        return false;
      }
      
      try {
        const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
        process.kill(pid, 0); // Check if process exists
        return true;
      } catch {
        // Process doesn't exist, clean up stale PID file
        try {
          fs.unlinkSync(pidFile);
        } catch {}
        return false;
      }
    }

    async function waitForService(timeout = 15000): Promise<boolean> {
      const startTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Initial delay
      
      while (Date.now() - startTime < timeout) {
        try {
          const response = await fetch(`http://${host}:${port}/status`);
          if (response.ok) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Extra stability delay
            return true;
          }
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return false;
    }

    async function checkServiceOnPort(checkPort: number, checkHost: string = host): Promise<{ success: boolean; error?: string }> {
      return new Promise((resolve) => {
        const http = require('http');
        const url = `http://${checkHost}:${checkPort}/status`;
        quickLog(chalk.gray(`   Testing: ${url}`));
        
        const req = http.get(url, (res: any) => {
          const isOk = res.statusCode >= 200 && res.statusCode < 300;
          quickLog(chalk.gray(`   Result: ${isOk ? '✅' : '❌'} (${res.statusCode})`));
          resolve({ success: isOk });
          res.resume(); // Consume response to free up memory
        });
        
        req.on('error', (error: any) => {
          quickLog(chalk.gray(`   Error: ${error.message}`));
          resolve({ success: false, error: error.code || error.message });
        });
        
        req.setTimeout(5000, () => {
          quickLog(chalk.gray(`   Error: Timeout`));
          req.destroy();
          resolve({ success: false, error: 'ETIMEDOUT' });
        });
      });
    }

    function startBackgroundService(): void {
      quickLog(chalk.blue('🚀 Starting Claude Code Router service...'));
      
      // Use the built dist/cli.js for starting service
      const cliPath = path.join(__dirname, 'cli.js');
      const startArgs = ['start'];
      if (options.debug) startArgs.push('--debug');
      if (options.config) startArgs.push('--config', options.config);
      
      const startProcess = spawn('node', [cliPath, ...startArgs], {
        detached: true, // Detach from parent process
        stdio: ['ignore', 'pipe', 'pipe'], // Don't inherit stdio to avoid TTY issues
        env: process.env
      });

      startProcess.unref(); // Allow parent to exit independently
      
      // Don't wait for background process
      startProcess.stdout?.on('data', () => {}); // Consume output to prevent hanging
      startProcess.stderr?.on('data', () => {});
    }

    async function executeClaudeCode(claudeArgs: string[] = [], overrideHost?: string): Promise<void> {
      incrementReferenceCount();

      // Set environment variables for claude subprocess
      const hostForUrl = overrideHost || (host === '0.0.0.0' ? '127.0.0.1' : host);
      const env = {
        ...process.env,
        ANTHROPIC_BASE_URL: `http://${hostForUrl}:${port}`,
        ANTHROPIC_API_KEY: 'any-string-is-ok',
        API_TIMEOUT_MS: '600000' // 10 minutes
      };

      quickLog(chalk.green('🔧 Environment configured for Claude Code routing'));
      quickLog(chalk.blue(`🤖 Launching Claude Code${claudeArgs.length ? ` with args: ${Array.isArray(claudeArgs) ? claudeArgs.join(' ') : claudeArgs}` : ''}...`));
      quickLog(chalk.cyan('===============================================\n'));

      const claudePath = process.env.CLAUDE_PATH || 'claude';
      // Ensure claudeArgs is an array
      const argsArray = Array.isArray(claudeArgs) ? claudeArgs : (claudeArgs ? [claudeArgs] : []);
      const claudeProcess = spawn(claudePath, argsArray, {
        env,
        stdio: 'inherit', // Inherit stdio for interactive Claude Code
        shell: true // Use shell for better compatibility
      });

      // Handle normal exit
      claudeProcess.on('close', (code: number) => {
        quickLog(chalk.cyan(`\n🏁 Claude Code session ended (exit code: ${code})`));
        const refCount = decrementReferenceCount();
        
        if (refCount === 0) {
          quickLog(chalk.green('✅ No more Claude Code instances, router will stay running'));
        }
        
        process.exit(code || 0);
      });

      // Handle errors
      claudeProcess.on('error', (error: Error) => {
        decrementReferenceCount();
        
        if (error.message.includes('ENOENT')) {
          quickLog(chalk.red('❌ Claude Code not found'));
          quickLog(chalk.yellow('💡 Install Claude Code: npm install -g @anthropic-ai/claude-code'));
        } else {
          quickLog(chalk.red('❌ Failed to launch Claude Code:'), error.message);
        }
        
        process.exit(1);
      });

      // Graceful cleanup on signals
      const cleanup = () => {
        decrementReferenceCount();
        if (claudeProcess && !claudeProcess.killed) {
          claudeProcess.kill('SIGTERM');
        }
        process.exit(0);
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
    }

    // Main logic implementation
    if (options.port) {
      // Mode 1: Port specified - only check connection, don't start service
      quickLog(chalk.blue(`🔍 Checking for service on specified port ${port}...`));
      
      const hostsToTry = options.host ? [host] : ['127.0.0.1', '0.0.0.0'];
      let serviceFound = false;
      let workingHost = '';
      const connectionErrors: string[] = [];

      for (const hostToTry of hostsToTry) {
        const result = await checkServiceOnPort(port, hostToTry);
        if (result.success) {
          serviceFound = true;
          workingHost = hostToTry;
          break;
        } else if (result.error) {
            connectionErrors.push(`${hostToTry}: ${result.error}`);
        }
      }

      if (serviceFound) {
        quickLog(chalk.green(`✅ Router service found on ${workingHost}:${port}!`));
        await executeClaudeCode(args, workingHost);
      } else {
        quickLog(chalk.red(`❌ API 500 Connection Error: No service found on port ${port}`));
        quickLog(chalk.gray(`   Tried hosts: ${hostsToTry.join(', ')}`));
        if (connectionErrors.length > 0) {
            quickLog(chalk.red('   Connection attempts failed with the following errors:'));
            connectionErrors.forEach(err => quickLog(chalk.red(`     - ${err}`)));
        }
        quickLog(chalk.yellow('💡 Make sure the service is running on the specified port first. Use ' + chalk.bold('rcc start --config <config_path>') + ' to start it.'));
        process.exit(1);
      }
    } else if (config && options.config && options.config !== configPaths.configFile) {
      // Mode 2: Config specified - start service for this specific config
      quickLog(chalk.blue(`🎯 Starting service with specified config: ${options.config}`));
      
      if (!isServiceRunning()) {
        startBackgroundService();
        
        if (await waitForService()) {
          quickLog(chalk.green('✅ Router service is ready!'));
          await executeClaudeCode(args);
        } else {
          quickLog(chalk.red('❌ Failed to start router service'));
          process.exit(1);
        }
      } else {
        quickLog(chalk.green('✅ Router service already running'));
        await executeClaudeCode(args);
      }
    } else {
      // Mode 3: Default mode - intelligent config detection and service startup
      quickLog(chalk.blue('🎯 Default mode: Intelligent configuration detection'));
      
      if (!isServiceRunning()) {
        startBackgroundService();
        
        if (await waitForService()) {
          quickLog(chalk.green('✅ Router service is ready!'));
          await executeClaudeCode(args);
        } else {
          quickLog(chalk.red('❌ Failed to start router service'));
          process.exit(1);
        }
      } else {
        quickLog(chalk.green('✅ Router service already running'));
        await executeClaudeCode(args);
      }
    }

  } catch (error) {
    quickLog(chalk.red('❌ Failed to execute code command:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}