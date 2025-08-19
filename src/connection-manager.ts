/**
 * Connection Manager - 处理Claude Code连接和健康检查
 */

import { getServerPort, getServerHost, buildServerUrl } from './constants';

export interface ConnectionOptions {
  port: string;
  host: string;
}

export class ConnectionManager {
  /**
   * 连接Claude Code到RCC服务器
   */
  static async connectClaudeCode(options: ConnectionOptions): Promise<void> {
    const port = getServerPort(parseInt(options.port) || undefined);
    const host = getServerHost(options.host);
    const baseUrl = buildServerUrl(host, port);

    // 设置环境变量
    process.env.ANTHROPIC_BASE_URL = baseUrl;
    process.env.ANTHROPIC_API_KEY = 'any-string-is-ok';

    console.log(`🔗 Attempting to connect to RCC server at ${baseUrl}`);

    // 验证服务器是否运行
    const isServerRunning = await this.checkServerHealth(host, port);

    if (!isServerRunning) {
      console.error(`❌ RCC server is not running at ${baseUrl}`);
      console.error(`💡 Start the server first: rcc4 start --port ${port}`);
      process.exit(1);
    }

    // 启动Claude Code
    this.launchClaudeCode(baseUrl);
  }

  /**
   * 检查服务器健康状态
   */
  private static async checkServerHealth(host: string, port: number): Promise<boolean> {
    return new Promise(resolve => {
      try {
        const http = require('http');

        const req = http.request(
          {
            hostname: host,
            port,
            path: '/health',
            method: 'GET',
            timeout: 5000,
          },
          (res: any) => {
            if (res.statusCode === 200) {
              console.log(`✅ RCC server is healthy at http://${host}:${port}`);
              resolve(true);
            } else {
              console.error(`❌ RCC server at http://${host}:${port} returned status ${res.statusCode}`);
              resolve(false);
            }
          }
        );

        req.on('error', (error: Error) => {
          console.error(`❌ Connection failed: ${error.message}`);
          resolve(false);
        });

        req.on('timeout', () => {
          console.error(`⏰ Connection to RCC server at http://${host}:${port} timed out`);
          req.destroy();
          resolve(false);
        });

        req.end();
      } catch (error) {
        console.error(`❌ Health check failed: ${(error as Error).message}`);
        resolve(false);
      }
    });
  }

  /**
   * 启动Claude Code进程
   */
  private static launchClaudeCode(baseUrl: string): void {
    try {
      console.log(`🚀 Launching Claude Code with RCC server: ${baseUrl}`);

      const { spawn } = require('child_process');
      const claude = spawn('claude', [], {
        stdio: 'inherit',
        env: {
          ...process.env,
          ANTHROPIC_BASE_URL: baseUrl,
          ANTHROPIC_API_KEY: 'any-string-is-ok',
        },
      });

      claude.on('close', (code: number) => {
        console.log(`\n📋 Claude Code exited with code ${code}`);
        process.exit(code);
      });

      claude.on('error', (error: Error) => {
        console.error('❌ Failed to start Claude Code:', error.message);
        console.error('💡 Make sure Claude Code is installed and available in PATH');
        console.error('   Installation: https://claude.ai/cli');
        process.exit(1);
      });

      // 设置信号处理
      process.on('SIGINT', () => {
        console.log('\n🛑 Stopping Claude Code...');
        claude.kill('SIGINT');
      });

      process.on('SIGTERM', () => {
        console.log('\n🛑 Stopping Claude Code...');
        claude.kill('SIGTERM');
      });
    } catch (error) {
      console.error('❌ Failed to launch Claude Code:', (error as Error).message);
      process.exit(1);
    }
  }

  /**
   * 测试Provider连接性
   */
  static async testProviderConnectivity(configPath: string): Promise<void> {
    console.log('🧪 Testing Provider Connectivity...');

    if (!configPath) {
      console.log('❌ Config file required for testing. Use --config <path>');
      process.exit(1);
    }

    try {
      const fs = require('fs');
      if (!fs.existsSync(configPath)) {
        console.log(`❌ Config file not found: ${configPath}`);
        process.exit(1);
      }

      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log(`📄 Loaded config: ${configPath}`);

      const providers = config.standardProviders || config.serverCompatibilityProviders || {};
      const providerKeys = Object.keys(providers);

      if (providerKeys.length === 0) {
        console.log('❌ No providers found in config');
        process.exit(1);
      }

      console.log(`🔍 Found ${providerKeys.length} providers to test:`);

      // 动态导入ProviderRouter以避免循环依赖
      const { ProviderRouter } = await import('./provider-router');

      // 测试每个Provider
      for (const providerKey of providerKeys) {
        const provider = providers[providerKey];
        console.log(`\n🧪 Testing ${provider.name} (${provider.protocol})...`);

        const testRequest = {
          messages: [{ role: 'user', content: 'Hello, this is a test message from RCC v4.0' }],
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 100,
        };

        const result = await ProviderRouter.routeToRealProvider(
          testRequest,
          { standardProviders: { [providerKey]: provider } },
          `test_${Date.now()}`
        );

        if (result.success && result.response) {
          console.log(`✅ ${provider.name}: Connection successful`);
          const responseText = result.response.content?.[0]?.text || 'No response text';
          console.log(`   Response: ${responseText.substring(0, 100)}...`);
        } else {
          console.log(`❌ ${provider.name}: Connection failed`);
          console.log(`   Error: ${result.error}`);
        }
      }

      console.log('\n🎉 Provider connectivity test completed!');
    } catch (error) {
      console.error('❌ Test failed:', (error as Error).message);
      process.exit(1);
    }

    process.exit(0);
  }
}
