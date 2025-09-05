/**
 * 客户端模块入口文件
 *
 * 提供完整的客户端功能，包括CLI、会话管理、HTTP处理和代理功能
 *
 * @author Jason Zhang
 */

// 零接口暴露设计 - 只导出必要的公共接口
export type { ClientSession } from './session';
export type { HttpClient } from './http';

// 模块版本信息
export const CLIENT_MODULE_VERSION = '4.0.0-alpha.2';

// 导入核心类
import { ClientSession, SessionManager, SessionError } from './session';
import { HttpClient, StreamProcessor, HttpError } from './http';
import { ClientProxy, EnvironmentExporter } from './client-manager';
import { ErrorHandler, RCCError } from '../interfaces/client/error-handler';
import { JQJsonHandler } from '../utils/jq-json-handler';

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
export class ClientModule implements ModuleInterface {
  public readonly version = CLIENT_MODULE_VERSION;

  private sessionManager: SessionManager;
  private httpClient: HttpClient;
  private proxy: ClientProxy;
  private envExporter: EnvironmentExporter;
  private initialized = false;

  // ModuleInterface implementation properties
  private moduleId: string = 'client-module';
  private moduleName: string = 'Client Module';
  private moduleStatus: ModuleStatus;
  private moduleMetrics: ModuleMetrics;
  private moduleConnections = new Map<string, ModuleInterface>();
  private moduleMessageListeners = new Set<(sourceModuleId: string, message: any, type: string) => void>();

  constructor(
    private config: any,
    private errorHandler: ErrorHandler
  ) {
    // 初始化组件
    this.sessionManager = new SessionManager(this.errorHandler);
    this.httpClient = new HttpClient(this.sessionManager, this.errorHandler);
    this.proxy = new ClientProxy();
    this.envExporter = new EnvironmentExporter();

    // 初始化ModuleInterface属性
    this.moduleStatus = {
      id: this.moduleId,
      name: this.moduleName,
      type: ModuleType.CLIENT,
      status: 'stopped',
      health: 'healthy'
    };
    this.moduleMetrics = {
      requestsProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };
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
      console.log(`🔌 Proxy started: ${JQJsonHandler.stringifyJson(data.config)}`);
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

      // 清理ModuleInterface资源
      this.moduleConnections.clear();
      this.moduleMessageListeners.clear();

      this.initialized = false;
      this.moduleStatus.status = 'stopped';
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

  // ===== ModuleInterface Implementation =====

  getId(): string { return this.moduleId; }
  getName(): string { return this.moduleName; }
  getType(): ModuleType { return ModuleType.CLIENT; }
  getVersion(): string { return this.version; }
  getStatus(): ModuleStatus { return { ...this.moduleStatus }; }
  getMetrics(): ModuleMetrics { return { ...this.moduleMetrics }; }

  async configure(config: any): Promise<void> {
    this.config = { ...this.config, ...config };
    this.moduleStatus.status = 'idle';
  }

  async start(): Promise<void> {
    await this.initialize();
    this.moduleStatus.status = 'running';
  }

  async stop(): Promise<void> {
    await this.cleanup();
    this.moduleStatus.status = 'stopped';
  }

  async process(input: any): Promise<any> {
    this.moduleMetrics.requestsProcessed++;
    this.moduleStatus.lastActivity = new Date();
    return input;
  }

  async reset(): Promise<void> {
    this.moduleMetrics = {
      requestsProcessed: 0, averageProcessingTime: 0, errorRate: 0, memoryUsage: 0, cpuUsage: 0
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return { healthy: this.initialized, details: { status: this.moduleStatus } };
  }

  addConnection(module: ModuleInterface): void { this.moduleConnections.set(module.getId(), module); }
  removeConnection(moduleId: string): void { this.moduleConnections.delete(moduleId); }
  getConnection(moduleId: string): ModuleInterface | undefined { return this.moduleConnections.get(moduleId); }
  getConnections(): ModuleInterface[] { return Array.from(this.moduleConnections.values()); }

  async sendToModule(targetModuleId: string, message: any, type?: string): Promise<any> { return message; }
  async broadcastToModules(message: any, type?: string): Promise<void> { }
  onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void): void {
    this.moduleMessageListeners.add(listener);
  }

  on(event: string, listener: (...args: any[]) => void): void { }
  removeAllListeners(): void { this.moduleMessageListeners.clear(); }
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

// ModuleInterface实现相关导入
import { 
  ModuleInterface, 
  ModuleType, 
  ModuleStatus, 
  ModuleMetrics,
  SimpleModuleAdapter
} from '../interfaces/module/base-module';

export const clientModuleAdapter = new SimpleModuleAdapter(
  'client-module',
  'Client Module',
  ModuleType.CLIENT,
  CLIENT_MODULE_VERSION
);
