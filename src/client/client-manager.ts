/**
 * 客户端管理器
 *
 * 负责管理客户端连接、代理和环境配置
 */

import { EventEmitter } from 'events';
import { getServerPort, getServerHost, buildServerUrl } from '../constants/server-defaults';
import {
  IClientProxy,
  ClientProxyConfig,
  ClientProxyStatus,
  IEnvironmentExporter,
} from '../interfaces/core/cli-abstraction';

/**
 * 客户端代理实现
 */
export class ClientProxy extends EventEmitter implements IClientProxy {
  private config: ClientProxyConfig;
  private isStarted = false;
  private proxyServer?: any; // HTTP代理服务器
  private serverConnection?: any; // 到RCC服务器的连接
  private status: ClientProxyStatus;

  constructor() {
    super();
    this.config = {};
    this.status = {
      connected: false,
    };
  }

  /**
   * 启动客户端代理
   */
  async start(config: ClientProxyConfig): Promise<void> {
    if (this.isStarted) {
      throw new Error('Client proxy is already started');
    }

    this.config = { ...config };

    try {
      // 建立到服务器的连接
      await this.connectToServer();

      // 启动代理服务器
      await this.startProxyServer();

      this.isStarted = true;
      this.status.connected = true;
      this.status.lastPing = new Date();

      this.emit('started', { config: this.config });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 停止客户端代理
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    try {
      // 停止代理服务器
      if (this.proxyServer) {
        await this.stopProxyServer();
      }

      // 断开服务器连接
      if (this.serverConnection) {
        await this.disconnectFromServer();
      }

      this.isStarted = false;
      this.status.connected = false;

      this.emit('stopped');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.status.connected;
  }

  /**
   * 获取代理状态
   */
  getProxyStatus(): ClientProxyStatus {
    return { ...this.status };
  }

  /**
   * 连接到RCC服务器
   */
  private async connectToServer(): Promise<void> {
    const serverHost = getServerHost(this.config.serverHost);
    const serverPort = getServerPort(this.config.serverPort);

    // 检查服务器是否可达
    const serverEndpoint = `http://${serverHost}:${serverPort}`;

    try {
      // 简单的健康检查
      const response = await fetch(`${serverEndpoint}/v1/status`);
      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      this.status.serverEndpoint = serverEndpoint;
      this.status.lastPing = new Date();
    } catch (error) {
      throw new Error(`Failed to connect to RCC server at ${serverEndpoint}: ${(error as Error).message}`);
    }
  }

  /**
   * 断开服务器连接
   */
  private async disconnectFromServer(): Promise<void> {
    this.serverConnection = undefined;
    this.status.serverEndpoint = undefined;
    this.status.lastPing = undefined;
  }

  /**
   * 启动代理服务器
   */
  private async startProxyServer(): Promise<void> {
    if (this.config.transparent) {
      // 透明代理模式：拦截和转发请求
      await this.startTransparentProxy();
    } else {
      // 标准代理模式：设置HTTP代理
      await this.startHttpProxy();
    }
  }

  /**
   * 停止代理服务器
   */
  private async stopProxyServer(): Promise<void> {
    if (this.proxyServer) {
      this.proxyServer.close();
      this.proxyServer = undefined;
    }
    this.status.proxyPort = undefined;
  }

  /**
   * 启动透明代理
   */
  private async startTransparentProxy(): Promise<void> {
    // 透明代理实现 - 这里需要根据系统平台实现
    // 暂时模拟
    console.log('🔍 Transparent proxy mode is experimental');

    // 设置环境变量代理
    process.env.ANTHROPIC_BASE_URL = this.status.serverEndpoint;
    process.env.OPENAI_BASE_URL = this.status.serverEndpoint;
  }

  /**
   * 启动HTTP代理
   */
  private async startHttpProxy(): Promise<void> {
    const http = require('http');

    this.proxyServer = http.createServer((req: any, res: any) => {
      // 转发请求到RCC服务器
      this.forwardRequest(req, res);
    });

    // 监听随机端口
    await new Promise<void>((resolve, reject) => {
      this.proxyServer.listen(0, getServerHost(), () => {
        const address = this.proxyServer.address();
        this.status.proxyPort = address.port;
        resolve();
      });

      this.proxyServer.on('error', reject);
    });
  }

  /**
   * 转发请求
   */
  private forwardRequest(req: any, res: any): void {
    const url = new URL(req.url, this.status.serverEndpoint);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: req.method,
      headers: req.headers,
    };

    const proxyReq = require('http').request(options, (proxyRes: any) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err: Error) => {
      res.writeHead(500);
      res.end('Proxy error: ' + err.message);
    });

    req.pipe(proxyReq);
  }
}

/**
 * 环境变量导出器实现
 */
export class EnvironmentExporter implements IEnvironmentExporter {
  /**
   * 导出代理设置
   */
  exportProxySettings(config: ClientProxyConfig): string {
    const serverHost = getServerHost(config.serverHost);
    const serverPort = getServerPort(config.serverPort);
    const baseUrl = `http://${serverHost}:${serverPort}`;

    const commands = [
      `export ANTHROPIC_BASE_URL="${baseUrl}"`,
      `export OPENAI_BASE_URL="${baseUrl}"`,
      `export RCC_PROXY_ENABLED="true"`,
      `export RCC_SERVER_ENDPOINT="${baseUrl}"`,
    ];

    if (config.transparent) {
      commands.push(`export RCC_TRANSPARENT_PROXY="true"`);
    }

    return commands.join('\n');
  }

  /**
   * 导出服务器设置
   */
  exportServerSettings(config: any): string {
    const commands = [
      `export RCC_SERVER_PORT="${getServerPort(config.port)}"`,
      `export RCC_SERVER_HOST="${getServerHost(config.host)}"`,
    ];

    if (config.debug) {
      commands.push(`export RCC_DEBUG="true"`);
    }

    if (config.configPath) {
      commands.push(`export RCC_CONFIG_PATH="${config.configPath}"`);
    }

    return commands.join('\n');
  }

  /**
   * 获取Shell命令
   */
  getShellCommands(shell: 'bash' | 'zsh' | 'fish' | 'powershell' = 'bash'): string[] {
    const baseCommands = [
      `export ANTHROPIC_BASE_URL="${buildServerUrl()}"`,
      `export OPENAI_BASE_URL="${buildServerUrl()}"`,
    ];

    switch (shell) {
      case 'fish':
        return baseCommands.map(cmd => cmd.replace('export ', 'set -x '));

      case 'powershell':
        return baseCommands.map(cmd => {
          const [, name, value] = cmd.match(/export ([^=]+)=(.+)/) || [];
          return `$env:${name} = ${value}`;
        });

      case 'bash':
      case 'zsh':
      default:
        return baseCommands;
    }
  }
}
