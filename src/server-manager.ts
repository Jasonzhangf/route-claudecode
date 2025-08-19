/**
 * Server Manager - 处理RCC服务器的启动、停止、状态管理
 */

import { CLIConfig } from './cli-config-manager';
import { ProviderRouter } from './provider-router';
import { getServerPort, getServerHost } from './constants';

export interface ServerOptions {
  port: string;
  host: string;
  config?: string;
  debug?: boolean;
}

export interface ServerInfo {
  port: number;
  host: string;
  portSource: string;
}

export class ServerManager {
  private static readonly VERSION = '4.0.0-alpha.2';

  /**
   * 启动RCC服务器
   */
  static async startServer(config: CLIConfig, serverInfo: ServerInfo, options: ServerOptions): Promise<void> {
    console.log('🚀 Starting RCC v4.0 Server...');
    console.log('📋 Startup Options:', {
      port: options.port || 'auto-detect',
      host: options.host || 'auto-detect',
      config: options.config || 'auto-detect',
      debug: options.debug || false,
    });

    const { port, host, portSource } = serverInfo;
    console.log(`🌐 Server will start on ${host}:${port} (port from: ${portSource})`);

    try {
      // 初始化Fastify服务器
      const fastify = require('fastify')({ logger: false });

      // 注册路由
      this.registerRoutes(fastify, config);

      // 启动服务器
      await fastify.listen({ port, host });

      console.log(`✅ RCC v4.0 Server启动成功!`);
      console.log(`🌐 服务地址: http://${host}:${port}`);
      console.log('📋 按 Ctrl+C 停止服务器');

      // 设置优雅退出处理
      this.setupGracefulShutdown(fastify);
    } catch (error) {
      const err = error as Error;
      console.error('❌ 服务器启动失败:', err.message);
      if (options.debug) {
        console.error(err.stack);
      }
      process.exit(1);
    }
  }

  /**
   * 注册服务器路由
   */
  private static registerRoutes(fastify: any, config: CLIConfig): void {
    // 健康检查路由
    fastify.get('/health', async () => {
      return { status: 'healthy', timestamp: new Date().toISOString() };
    });

    // 状态查询路由
    fastify.get('/status', async () => {
      return {
        status: 'running',
        version: this.VERSION,
        timestamp: new Date().toISOString(),
      };
    });

    // Anthropic API兼容路由 - 真实Provider路由
    fastify.post('/v1/messages', async (request: any, reply: any) => {
      const requestId = `req_${Date.now()}`;
      console.log(`📨 [${requestId}] Received Claude Code request:`, {
        method: request.method,
        url: request.url,
        headers: request.headers,
        bodySize: request.body ? JSON.stringify(request.body).length : 0,
      });

      try {
        // 路由到真实Provider
        const result = await ProviderRouter.routeToRealProvider(request.body, config, requestId);
        if (result.success) {
          console.log(`✅ [${requestId}] Successfully routed to provider`);
          return result.response;
        } else {
          console.error(`❌ [${requestId}] Provider routing failed:`, result.error);
          return {
            id: requestId,
            type: 'error',
            error: {
              type: 'provider_error',
              message: `Provider routing failed: ${result.error}`,
            },
          };
        }
      } catch (error) {
        console.error(`❌ [${requestId}] Request processing error:`, error);
        return {
          id: requestId,
          type: 'error',
          error: {
            type: 'api_error',
            message: `RCC v4.0 request processing error: ${(error as Error).message}`,
          },
        };
      }
    });
  }

  /**
   * 设置优雅退出处理
   */
  private static setupGracefulShutdown(fastify: any): void {
    const shutdown = async () => {
      console.log('\n🛑 正在停止RCC服务器...');
      await fastify.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  /**
   * 停止RCC服务器
   */
  static async stopServer(options: { port?: string; force?: boolean }): Promise<void> {
    console.log('🛑 Stopping RCC v4.0 Server...');

    try {
      const { spawn } = require('child_process');

      if (options.port) {
        // 停止指定端口的服务器
        console.log(`🎯 Targeting port: ${options.port}`);

        const lsof = spawn('lsof', ['-ti', `:${options.port}`]);
        let pids = '';

        lsof.stdout.on('data', (data: Buffer) => {
          pids += data.toString();
        });

        lsof.on('close', (code: number) => {
          if (code === 0 && pids.trim()) {
            const pidList = pids.trim().split('\n');
            console.log(`🔍 Found ${pidList.length} process(es) on port ${options.port}`);

            pidList.forEach((pid: string) => {
              try {
                process.kill(parseInt(pid), options.force ? 'SIGKILL' : 'SIGTERM');
                console.log(`✅ Stopped process ${pid}`);
              } catch (error) {
                console.log(`❌ Failed to stop process ${pid}: ${(error as Error).message}`);
              }
            });
          } else {
            console.log(`ℹ️  No processes found on port ${options.port}`);
          }
        });

        lsof.on('error', () => {
          console.log('❌ Could not check port usage (lsof not available)');
          process.exit(1);
        });
      } else {
        // 停止所有RCC进程
        console.log('🔍 Looking for all RCC processes...');

        const pkill = spawn('pkill', [options.force ? '-9' : '-15', '-f', 'rcc4 start']);

        pkill.on('close', (code: number) => {
          if (code === 0) {
            console.log('✅ All RCC processes stopped');
          } else {
            console.log('ℹ️  No RCC processes found');
          }
        });

        pkill.on('error', () => {
          console.log('❌ Could not stop processes (pkill not available)');
          process.exit(1);
        });
      }

      setTimeout(() => {
        console.log('🎉 Stop command completed');
        process.exit(0);
      }, 2000);
    } catch (error) {
      console.error('❌ Stop command failed:', (error as Error).message);
      process.exit(1);
    }
  }

  /**
   * 检查服务器状态
   */
  static async checkServerStatus(port: number = getServerPort()): Promise<void> {
    console.log('📊 Checking RCC v4.0 Status...');

    try {
      const http = require('http');

      const req = http.request(
        {
          hostname: getServerHost(),
          port,
          path: '/status',
          method: 'GET',
          timeout: 5000,
        },
        (res: any) => {
          let data = '';
          res.on('data', (chunk: any) => (data += chunk));
          res.on('end', () => {
            try {
              const status = JSON.parse(data);
              console.log('✅ Server Status:', status);
            } catch {
              console.log('✅ Server is running but response format unknown');
            }
          });
        }
      );

      req.on('error', () => {
        console.log('❌ Server is not running');
      });

      req.on('timeout', () => {
        console.log('⏰ Server status check timeout');
        req.destroy();
      });

      req.end();
    } catch (error) {
      console.error('❌ Status check failed:', (error as Error).message);
    }

    setTimeout(() => process.exit(0), 6000);
  }
}
