/**
 * 客户端模块入口文件
 *
 * 提供完整的客户端功能，包括CLI、会话管理、HTTP处理和代理功能
 *
 * @author Jason Zhang
 */

// 导出客户端功能
export * from './session';
export * from './http';
export * from './client-manager';

// 模块版本信息
export const CLIENT_MODULE_VERSION = '4.0.0-alpha.2';

// 导入核心类
import { ClientSession, SessionManager, SessionError } from './session';
import { HttpClient, StreamProcessor, HttpError } from './http';
import { ClientProxy, EnvironmentExporter } from './client-manager';
import { ErrorHandler, RCCError } from '../interfaces/client/error-handler';

/**
 * 客户端模块接口
 */
export interface ClientModuleInterface {
  version: string;
  initialize(): Promise<void>;
  executeCommand(command: string, options: any): Promise<void>;
  createSession(config?: any): ClientSession;
  getHttpClient(): HttpClient;
  getProxy(): ClientProxy;
}

/**
 * 客户端模块配置
 */
export interface ClientModuleConfig {
  serverHost?: string;
  serverPort?: number;
  enableCache?: boolean;
  enableDebug?: boolean;
  sessionConfig?: any;
  httpConfig?: any;
  proxyConfig?: any;
  errorHandler?: ErrorHandler;
}

/**
 * 客户端模块主类
 */
export class ClientModule {
  public readonly version = CLIENT_MODULE_VERSION;

  private sessionManager: SessionManager;
  private httpClient: HttpClient;
  private proxy: ClientProxy;
  private envExporter: EnvironmentExporter;
  private initialized = false;

  constructor(
    private config: any,
    private errorHandler: ErrorHandler
  ) {
    // 初始化组件
    this.sessionManager = new SessionManager(this.errorHandler);
    this.httpClient = new HttpClient(this.sessionManager, this.errorHandler);
    this.proxy = new ClientProxy();
    this.envExporter = new EnvironmentExporter();
  }

  /**
   * 初始化模块
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('Client module is already initialized');
    }

    try {
      // 初始化子模块
      await this.initializeSubModules();

      this.initialized = true;
      console.log(`🚀 Client Module ${this.version} initialized successfully`);
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        module: 'client',
        operation: 'initialize',
        timestamp: new Date(),
      });
      throw error;
    }
  }

  /**
   * 初始化子模块
   */
  private async initializeSubModules(): Promise<void> {
    // 设置事件监听
    this.sessionManager.on('session_created', sessionId => {
      console.log(`📱 Session created: ${sessionId}`);
    });

    this.httpClient.on('request', data => {
      if (this.config.enableDebug) {
        console.log(`🌐 HTTP Request: ${data.method} ${data.url} - ${data.success ? 'Success' : 'Failed'}`);
      }
    });

    this.proxy.on('started', data => {
      console.log(`🔌 Proxy started: ${JSON.stringify(data.config)}`);
    });

    this.proxy.on('error', error => {
      this.errorHandler.handleError(error, {
        module: 'proxy',
        operation: 'proxy_operation',
        timestamp: new Date(),
      });
    });
  }

  /**
   * 执行CLI命令
   */
  async executeCommand(command: string, options: any = {}): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // 构建命令行参数
    const argv = [process.argv[0], process.argv[1], command];

    // 添加选项
    for (const [key, value] of Object.entries(options)) {
      if (typeof value === 'boolean' && value) {
        argv.push(`--${key}`);
      } else if (value !== undefined && value !== null) {
        argv.push(`--${key}`, String(value));
      }
    }

    // CLI功能已迁移到主CLI模块，这里暂时简化实现
    console.log('CLI command execution:', argv);
  }

  /**
   * 创建新会话
   */
  createSession(config: any = {}): ClientSession {
    if (!this.initialized) {
      throw new Error('Client module must be initialized before creating sessions');
    }

    const sessionConfig = {
      ...this.config.sessionConfig,
      ...config,
      serverHost: config.serverHost || this.config.serverHost,
      serverPort: config.serverPort || this.config.serverPort,
    };

    return this.sessionManager.createSession(sessionConfig);
  }

  /**
   * 获取HTTP客户端
   */
  getHttpClient(): HttpClient {
    if (!this.initialized) {
      throw new Error('Client module must be initialized before accessing HTTP client');
    }
    return this.httpClient;
  }

  /**
   * 获取代理实例
   */
  getProxy(): ClientProxy {
    if (!this.initialized) {
      throw new Error('Client module must be initialized before accessing proxy');
    }
    return this.proxy;
  }

  /**
   * 获取会话管理器
   */
  getSessionManager(): SessionManager {
    if (!this.initialized) {
      throw new Error('Client module must be initialized before accessing session manager');
    }
    return this.sessionManager;
  }

  /**
   * 获取环境导出器
   */
  getEnvironmentExporter(): EnvironmentExporter {
    return this.envExporter;
  }

  /**
   * 获取模块统计信息
   */
  getStats() {
    if (!this.initialized) {
      throw new Error('Client module must be initialized before accessing stats');
    }

    return {
      sessions: this.sessionManager.getStats(),
      http: this.httpClient.getStats(),
      proxy: this.proxy.getProxyStatus(),
    };
  }

  /**
   * 清理模块资源
   */
  async cleanup(): Promise<void> {
    if (!this.initialized) return;

    try {
      // 清理会话
      await this.sessionManager.cleanup();

      // 清理HTTP缓存
      await this.httpClient.clearCache();

      // 停止代理
      if (this.proxy.isConnected()) {
        await this.proxy.stop();
      }

      this.initialized = false;
      console.log('🧹 Client module cleaned up successfully');
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        module: 'client',
        operation: 'cleanup',
        timestamp: new Date(),
      });
      throw error;
    }
  }
}

/**
 * 客户端工厂函数
 */
export function createClientModule(config: ClientModuleConfig = {}, errorHandler: ErrorHandler): ClientModule {
  return new ClientModule(config, errorHandler);
}

/**
 * 快速创建客户端实例的工厂函数
 */
export async function createClient(config: ClientModuleConfig = {}): Promise<ClientModule> {
  // 创建默认错误处理器
  const defaultErrorHandler: ErrorHandler = {
    handleError: (error, context) => {
      console.error(`[${context?.module || 'unknown'}] ${error.message}`);
      if (context?.additionalData) {
        console.error('Context:', context.additionalData);
      }
    },
    formatError: error => error.message,
    logError: (error, context) => {
      console.error(`Error logged: ${error.message}`, context);
    },
    reportToUser: error => {
      console.error(`User Error: ${error.message}`);
    },
    createError: (message, code, details) => {
      return new RCCError(message, code, details);
    },
  };

  const client = createClientModule(config, config.errorHandler || defaultErrorHandler);
  await client.initialize();
  return client;
}

// 导出错误类型 - 避免重复导出
export { SessionError, HttpError };
// 导出CLI错误类
export { CLIError } from '../types/error';
