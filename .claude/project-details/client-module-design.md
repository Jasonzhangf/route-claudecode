# 客户端模块详细设计

## 模块概述

客户端模块是RCC v4.0系统的入口点，负责CLI命令处理、HTTP服务器管理和统一错误处理。

## 目录结构

```
src/client/
├── README.md                    # 客户端模块说明
├── index.ts                     # 模块入口
├── cli.ts                       # CLI命令管理
├── server-manager.ts            # HTTP服务器管理
├── error-handler.ts             # 错误处理器
└── types/                       # 客户端相关类型
    ├── cli-types.ts             # CLI相关类型
    ├── server-types.ts          # 服务器相关类型
    └── error-types.ts           # 错误相关类型
```

## 核心组件设计

### 1. CLI管理器 (cli.ts)

```typescript
interface CLIManager {
  setupCommands(): Command;
  handleError(error: RCCError): void;
}

// 支持的命令
class CLICommands {
  // rcc start [--port 3456] [--config path] [--debug]
  async startCommand(options: StartOptions): Promise<void> {
    try {
      console.log(chalk.blue('🚀 启动RCC路由服务器...'));
      await this.serverManager.startServer(parseInt(options.port));
      console.log(chalk.green(`✅ 服务器已启动，端口: ${options.port}`));
    } catch (error) {
      this.handleError(this.createError('CLIENT_ERROR', '启动服务器失败', error));
    }
  }

  // rcc stop
  async stopCommand(): Promise<void> {
    try {
      console.log(chalk.yellow('🛑 停止RCC路由服务器...'));
      await this.serverManager.stopServer();
      console.log(chalk.green('✅ 服务器已停止'));
    } catch (error) {
      this.handleError(this.createError('CLIENT_ERROR', '停止服务器失败', error));
    }
  }

  // rcc code [--port 3456]
  async codeCommand(options: CodeOptions): Promise<void> {
    try {
      const baseUrl = `http://localhost:${options.port}`;
      console.log(chalk.blue('📝 设置Claude Code环境变量:'));
      console.log(chalk.cyan(`export ANTHROPIC_BASE_URL=${baseUrl}`));
      console.log(chalk.cyan(`export ANTHROPIC_API_KEY="rcc-proxy-key"`));
      console.log(chalk.green('✅ 请复制上述命令到终端执行'));
    } catch (error) {
      this.handleError(this.createError('CLIENT_ERROR', '导出环境变量失败', error));
    }
  }

  // rcc status
  async statusCommand(): Promise<void> {
    try {
      const status = await this.serverManager.getServerStatus();
      console.log(chalk.blue('📊 RCC服务器状态:'));
      console.log(`状态: ${status.isRunning ? chalk.green('运行中') : chalk.red('已停止')}`);
      if (status.isRunning) {
        console.log(`端口: ${chalk.cyan(status.port)}`);
        console.log(`启动时间: ${chalk.cyan(new Date(status.startTime).toLocaleString())}`);
        console.log(`活跃流水线: ${chalk.cyan(status.activePipelines)}`);
      }
    } catch (error) {
      this.handleError(this.createError('CLIENT_ERROR', '获取服务器状态失败', error));
    }
  }
}

interface StartOptions {
  port?: string;
  config?: string;
  debug?: boolean;
}

interface CodeOptions {
  port?: string;
}
```

### 2. 服务器管理器 (server-manager.ts)

```typescript
interface ServerManager {
  startServer(port: number): Promise<void>;
  stopServer(): Promise<void>;
  getServerStatus(): Promise<ServerStatus>;
  setupRoutes(): void;
}

class ServerManagerImpl implements ServerManager {
  private server: FastifyInstance | null = null;
  private routerManager: RouterManager;
  private errorHandler: ErrorHandler;
  private startTime: number = 0;

  constructor() {
    this.routerManager = new RouterManager();
    this.errorHandler = new ErrorHandler();
  }

  public async startServer(port: number): Promise<void> {
    if (this.server) {
      throw new Error('服务器已在运行中');
    }

    try {
      this.server = fastify({ logger: false });
      this.setupRoutes();
      
      await this.server.listen({ port, host: '127.0.0.1' });
      this.startTime = Date.now();
      
      // 初始化路由器管理器
      await this.routerManager.initialize();
      
    } catch (error) {
      throw new Error(`启动服务器失败: ${error}`);
    }
  }

  private setupRoutes(): void {
    if (!this.server) return;

    // 健康检查端点
    this.server.get('/health', async (request, reply) => {
      return { status: 'ok', timestamp: Date.now() };
    });

    // 主要的聊天完成端点 - 兼容Anthropic API
    this.server.post('/v1/messages', async (request, reply) => {
      const requestId = this.generateRequestId();
      
      try {
        const rccRequest: RCCRequest = {
          id: requestId,
          timestamp: Date.now(),
          body: request.body,
          headers: request.headers as Record<string, string>,
          method: 'POST',
          url: '/v1/messages'
        };

        // 通过路由器处理请求
        const response = await this.routerManager.processRequest(rccRequest);
        
        reply.status(response.status);
        Object.entries(response.headers).forEach(([key, value]) => {
          reply.header(key, value);
        });
        
        return response.body;
        
      } catch (error) {
        const rccError: RCCError = {
          id: requestId,
          type: ErrorType.CLIENT_ERROR,
          module: 'server-manager',
          message: '处理请求失败',
          details: error,
          timestamp: Date.now(),
          requestId
        };
        
        this.errorHandler.handleError(rccError);
        
        reply.status(500);
        return {
          error: {
            type: 'internal_error',
            message: '内部服务器错误'
          }
        };
      }
    });

    // Web管理界面路由
    this.setupManagementRoutes();
  }

  private setupManagementRoutes(): void {
    // 静态文件服务
    this.server.register(require('@fastify/static'), {
      root: path.join(__dirname, 'web-ui'),
      prefix: '/ui/'
    });

    // 管理API路由
    this.server.register(async (fastify) => {
      fastify.get('/api/status', async () => {
        return await this.getServerStatus();
      });

      fastify.get('/api/config/providers', async () => {
        return await this.routerManager.getProviderConfigs();
      });

      fastify.post('/api/config/providers', async (request) => {
        const { provider, config } = request.body as any;
        await this.routerManager.updateProviderConfig(provider, config);
        return { success: true };
      });
    });
  }
}

interface ServerStatus {
  isRunning: boolean;
  port: number;
  startTime: number;
  activePipelines: number;
}
```

### 3. 错误处理器 (error-handler.ts)

```typescript
interface ErrorHandler {
  handleError(error: RCCError): void;
  formatError(error: RCCError): string;
  logError(error: RCCError): void;
  reportToUser(error: RCCError): void;
}

class ErrorHandlerImpl implements ErrorHandler {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ 
          filename: `${process.env.HOME}/.route-claudecode/logs/client.log` 
        })
      ]
    });
  }

  public handleError(error: RCCError): void {
    // 记录错误日志
    this.logError(error);
    
    // 向用户报告错误
    this.reportToUser(error);
  }

  public formatError(error: RCCError): string {
    const timestamp = new Date(error.timestamp).toLocaleString();
    const module = error.module.toUpperCase();
    
    let formatted = `[${timestamp}] ${module} ERROR: ${error.message}`;
    
    if (error.requestId) {
      formatted += ` (Request: ${error.requestId})`;
    }
    
    if (error.details) {
      formatted += `\nDetails: ${JSON.stringify(error.details, null, 2)}`;
    }
    
    if (error.stack) {
      formatted += `\nStack: ${error.stack}`;
    }
    
    return formatted;
  }

  private reportToUser(error: RCCError): void {
    console.error(chalk.red('❌ 错误发生:'));
    console.error(chalk.red(`模块: ${error.module}`));
    console.error(chalk.red(`消息: ${error.message}`));
    
    if (error.requestId) {
      console.error(chalk.yellow(`请求ID: ${error.requestId}`));
    }
    
    // 根据错误类型提供不同的用户提示
    switch (error.type) {
      case ErrorType.CONFIG_ERROR:
        console.error(chalk.yellow('💡 提示: 请检查配置文件 ~/.route-claudecode/config/'));
        break;
      case ErrorType.NETWORK_ERROR:
        console.error(chalk.yellow('💡 提示: 请检查网络连接和API密钥'));
        break;
      case ErrorType.VALIDATION_ERROR:
        console.error(chalk.yellow('💡 提示: 请检查请求格式是否正确'));
        break;
      default:
        console.error(chalk.yellow('💡 提示: 查看日志文件获取更多详细信息'));
    }
    
    console.error(chalk.gray(`日志位置: ~/.route-claudecode/logs/client.log`));
  }
}
```

## 接口定义

### 客户端模块接口

```typescript
export interface ClientModule {
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<ServerStatus>;
  handleError(error: RCCError): void;
}

export interface CLIOptions {
  port?: number;
  config?: string;
  debug?: boolean;
}

export interface ServerConfig {
  port: number;
  host: string;
  enableManagement: boolean;
  managementPort?: number;
}
```

## 错误处理策略

### 错误分类和处理

```typescript
enum ClientErrorType {
  CLI_ERROR = 'CLI_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR'
}

class ClientErrorHandler {
  handleCLIError(error: Error, command: string): void {
    console.error(chalk.red(`❌ 命令 '${command}' 执行失败:`));
    console.error(chalk.red(error.message));
    process.exit(1);
  }

  handleServerError(error: Error, context: string): void {
    console.error(chalk.red(`❌ 服务器错误 (${context}):`));
    console.error(chalk.red(error.message));
    // 不退出进程，允许服务器继续运行
  }

  handleConfigError(error: Error, configPath: string): void {
    console.error(chalk.red(`❌ 配置错误 (${configPath}):`));
    console.error(chalk.red(error.message));
    console.error(chalk.yellow('💡 请检查配置文件格式和内容'));
  }
}
```

## 配置管理

### 客户端配置

```typescript
interface ClientConfig {
  server: {
    defaultPort: number;
    host: string;
    timeout: number;
  };
  logging: {
    level: string;
    file: string;
    maxSize: string;
    maxFiles: number;
  };
  management: {
    enabled: boolean;
    port: number;
    auth: boolean;
  };
}

const defaultClientConfig: ClientConfig = {
  server: {
    defaultPort: 3456,
    host: '127.0.0.1',
    timeout: 60000
  },
  logging: {
    level: 'info',
    file: '~/.route-claudecode/logs/client.log',
    maxSize: '10m',
    maxFiles: 5
  },
  management: {
    enabled: true,
    port: 8080,
    auth: false
  }
};
```

## 测试策略

### 单元测试

```typescript
describe('ClientModule', () => {
  describe('CLIManager', () => {
    test('should handle start command correctly', async () => {
      const cliManager = new CLIManager();
      const mockServerManager = jest.fn();
      
      await expect(cliManager.startCommand({ port: '3456' }))
        .resolves.not.toThrow();
    });

    test('should handle invalid port gracefully', async () => {
      const cliManager = new CLIManager();
      
      await expect(cliManager.startCommand({ port: 'invalid' }))
        .rejects.toThrow('Invalid port number');
    });
  });

  describe('ServerManager', () => {
    test('should start server on specified port', async () => {
      const serverManager = new ServerManager();
      
      await serverManager.startServer(3456);
      const status = await serverManager.getServerStatus();
      
      expect(status.isRunning).toBe(true);
      expect(status.port).toBe(3456);
    });
  });
});
```

## 部署和运维

### 日志管理

```typescript
class LogManager {
  private logger: winston.Logger;

  constructor(config: LogConfig) {
    this.logger = winston.createLogger({
      level: config.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({
          filename: config.file,
          maxsize: config.maxSize,
          maxFiles: config.maxFiles
        }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }

  logRequest(request: RCCRequest): void {
    this.logger.info('Request received', {
      requestId: request.id,
      method: request.method,
      url: request.url,
      timestamp: request.timestamp
    });
  }

  logResponse(response: RCCResponse): void {
    this.logger.info('Response sent', {
      requestId: response.id,
      status: response.status,
      timestamp: response.timestamp
    });
  }

  logError(error: RCCError): void {
    this.logger.error('Error occurred', {
      errorId: error.id,
      type: error.type,
      module: error.module,
      message: error.message,
      requestId: error.requestId,
      timestamp: error.timestamp
    });
  }
}
```

这个客户端模块设计确保了：
- 清晰的CLI命令接口
- 健壮的HTTP服务器管理
- 完整的错误处理和日志记录
- 用户友好的交互体验
- 可扩展的管理界面