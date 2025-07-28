/**
 * Code command implementation (demo1 style)
 * Stable process management with reference counting
 */

import chalk from 'chalk';
import { resolve, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { RouterConfig } from './types';

/**
 * Load configuration from file
 */
function loadConfig(configPath: string): RouterConfig {
  try {
    if (!existsSync(configPath)) {
      console.log(chalk.yellow(`⚠️  Config file not found at ${configPath}`));
      process.exit(1);
    }

    const configData = readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData) as RouterConfig;
    
    // No defaults - user must provide complete configuration
    return config;
  } catch (error) {
    console.error(chalk.red('❌ Failed to load configuration:'), error instanceof Error ? error.message : error);
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

    const port = config.server.port;
    const host = config.server.host;

    // Reference counting for service management
    const refCountFile = path.join(os.tmpdir(), 'ccr-reference-count.txt');
    const pidFile = path.join(os.homedir(), '.claude-code-router', '.ccr.pid');

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

    function startBackgroundService(): void {
      console.log(chalk.blue('🚀 Starting Claude Code Router service...'));
      
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

    async function executeClaudeCode(claudeArgs: string[] = []): Promise<void> {
      incrementReferenceCount();

      // Set environment variables for claude subprocess
      const env = {
        ...process.env,
        ANTHROPIC_BASE_URL: `http://${host}:${port}`,
        ANTHROPIC_API_KEY: 'any-string-is-ok',
        API_TIMEOUT_MS: '600000' // 10 minutes
      };

      console.log(chalk.green('🔧 Environment configured for Claude Code routing'));
      console.log(chalk.blue(`🤖 Launching Claude Code${claudeArgs.length ? ` with args: ${Array.isArray(claudeArgs) ? claudeArgs.join(' ') : claudeArgs}` : ''}...`));
      console.log(chalk.cyan('===============================================\n'));

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
        console.log(chalk.cyan(`\n🏁 Claude Code session ended (exit code: ${code})`));
        const refCount = decrementReferenceCount();
        
        if (refCount === 0) {
          console.log(chalk.green('✅ No more Claude Code instances, router will stay running'));
        }
        
        process.exit(code || 0);
      });

      // Handle errors
      claudeProcess.on('error', (error: Error) => {
        decrementReferenceCount();
        
        if (error.message.includes('ENOENT')) {
          console.error(chalk.red('❌ Claude Code not found'));
          console.log(chalk.yellow('💡 Install Claude Code: npm install -g @anthropic-ai/claude-code'));
        } else {
          console.error(chalk.red('❌ Failed to launch Claude Code:'), error.message);
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

    // Main logic: Check if service is running, start if needed, then launch Claude Code
    if (!isServiceRunning()) {
      startBackgroundService();
      
      if (await waitForService()) {
        console.log(chalk.green('✅ Router service is ready!'));
        await executeClaudeCode(args);
      } else {
        console.error(chalk.red('❌ Failed to start router service'));
        process.exit(1);
      }
    } else {
      console.log(chalk.green('✅ Router service already running'));
      await executeClaudeCode(args);
    }

  } catch (error) {
    console.error(chalk.red('❌ Failed to execute code command:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}