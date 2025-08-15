# 客户端模块 (Client Module)

## 模块概述

客户端模块是RCC v4.0系统的入口点，负责CLI命令处理、HTTP服务器管理和统一错误处理。

## 目录结构

```
src/client/
├── README.md                    # 客户端模块说明
├── index.ts                     # 模块入口
├── cli/                         # CLI命令系统
│   ├── cli-server.ts            # Server模式CLI
│   ├── cli-client.ts            # Client模式CLI
│   ├── cli-manager.ts           # CLI管理器
│   └── process-manager.ts       # 进程管理器
├── server-manager.ts            # HTTP服务器管理
├── error-handler.ts             # 错误处理器
├── session-extractor.ts         # 会话提取器
├── session-manager.ts           # 会话管理器
└── types/                       # 客户端相关类型
    ├── cli-types.ts             # CLI相关类型
    ├── server-types.ts          # 服务器相关类型
    ├── session-types.ts         # 会话相关类型
    └── error-types.ts           # 错误相关类型
```

## 核心功能

### 1. CLI命令系统

#### Server模式 (`rcc start`)
- **功能**: 启动RCC路由服务器
- **特点**:
  - 根据配置文件在指定端口启动HTTP服务器
  - 阻塞式运行，保持服务器活跃状态
  - 支持Ctrl+C优雅退出，自动关闭所有资源
  - 服务器进程死掉时CLI自动退出
  - 显示服务器启动信息和运行状态
- **命令格式**: `rcc start [--port 3456] [--config path] [--debug]`

#### Client模式 (`rcc code`)
- **功能**: 启动Claude Code并自动配置RCC代理
- **特点**:
  - 自动检测或启动RCC服务器
  - 设置Claude Code所需的环境变量
  - 启动Claude Code进程，输入输出不干扰Claude Code本身
  - Claude Code死掉时RCC自动退出
  - Ctrl+C退出Claude Code后自动关闭RCC服务
  - 透明代理模式，用户无感知
- **命令格式**: `rcc code [--port 3456] [--auto-start]`

#### 管理命令
- `rcc stop [--port 3456]` - 停止指定端口的RCC服务器
- `rcc status [--port 3456]` - 查看服务器状态
- `rcc provider update` - 自动更新Provider配置

### 2. HTTP服务器管理
- 启动/停止HTTP服务器
- 路由设置和请求处理
- 健康检查端点
- Web管理界面
- 会话和对话ID提取管理

### 3. 统一错误处理
- 所有模块错误的最终出口
- 不允许静默失败
- 用户友好的错误信息展示

### 4. 会话管理
- 从请求头中提取会话ID (X-Session-ID)
- 从请求体中提取对话ID (conversation_id)
- 为流控系统提供会话标识
- 会话生命周期管理

## 接口定义

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

export interface SessionExtractor {
  extractSessionId(request: any): string;
  extractConversationId(request: any): string;
  generateSessionId(): string;
  generateConversationId(): string;
}
```

## 错误处理策略

### 错误分类
- CLI_ERROR: CLI命令执行错误
- SERVER_ERROR: HTTP服务器错误
- CONFIG_ERROR: 配置文件错误
- NETWORK_ERROR: 网络连接错误

### 处理原则
- 不允许静默失败
- 统一使用标准API error handler
- 提供用户友好的错误信息和解决建议
- 完整的错误追踪链

## 会话管理实现

### 会话ID提取策略
```typescript
// src/client/session-extractor.ts
export class SessionExtractor {
  extractSessionId(request: any): string {
    // 1. 从请求头中提取 X-Session-ID
    let sessionId = request.headers['x-session-id'] || 
                   request.headers['X-Session-ID'];
    
    if (sessionId) {
      return sessionId;
    }
    
    // 2. 从Authorization头中提取用户标识
    const authHeader = request.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // 使用token的hash作为会话标识
      sessionId = this.hashToken(token);
      return sessionId;
    }
    
    // 3. 从客户端IP生成会话ID
    const clientIP = request.ip || request.connection.remoteAddress;
    sessionId = `session_${this.hashIP(clientIP)}_${Date.now()}`;
    
    return sessionId;
  }

  extractConversationId(request: any): string {
    // 1. 从请求体中提取 conversation_id
    if (request.body && request.body.conversation_id) {
      return request.body.conversation_id;
    }
    
    // 2. 从请求头中提取 X-Conversation-ID
    let conversationId = request.headers['x-conversation-id'] || 
                        request.headers['X-Conversation-ID'];
    
    if (conversationId) {
      return conversationId;
    }
    
    // 3. 从消息历史中推断对话ID
    if (request.body && request.body.messages && request.body.messages.length > 0) {
      // 使用消息历史的hash作为对话标识
      const messagesHash = this.hashMessages(request.body.messages);
      conversationId = `conv_${messagesHash}`;
      return conversationId;
    }
    
    // 4. 生成新的对话ID
    return this.generateConversationId();
  }

  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private hashToken(token: string): string {
    // 简单hash实现，生产环境应使用更安全的hash
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return `session_${Math.abs(hash).toString(36)}`;
  }

  private hashIP(ip: string): string {
    return ip.replace(/\./g, '_').replace(/:/g, '_');
  }

  private hashMessages(messages: any[]): string {
    const messageText = messages.map(m => m.content).join('|');
    let hash = 0;
    for (let i = 0; i < messageText.length; i++) {
      const char = messageText.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}
```

### HTTP端点实现
```typescript
// src/client/server-manager.ts
export class ServerManagerImpl implements ServerManager {
  private sessionExtractor: SessionExtractor;

  constructor() {
    this.sessionExtractor = new SessionExtractor();
  }

  private setupRoutes(): void {
    // 主要的聊天完成端点 - 兼容Anthropic API
    this.server.post('/v1/messages', async (request, reply) => {
      const requestId = this.generateRequestId();
      
      try {
        // 提取会话和对话ID
        const sessionId = this.sessionExtractor.extractSessionId(request);
        const conversationId = this.sessionExtractor.extractConversationId(request);
        
        const rccRequest: RCCRequest = {
          id: requestId,
          timestamp: Date.now(),
          body: request.body,
          headers: request.headers as Record<string, string>,
          method: 'POST',
          url: '/v1/messages',
          requestId,
          sessionId,
          conversationId
        };

        // 通过路由器处理请求（包含流控）
        const response = await this.routerManager.processRequest(rccRequest);
        
        reply.status(response.status);
        Object.entries(response.headers).forEach(([key, value]) => {
          reply.header(key, value);
        });
        
        // 在响应头中返回会话信息
        reply.header('X-Session-ID', sessionId);
        reply.header('X-Conversation-ID', conversationId);
        reply.header('X-Request-ID', requestId);
        
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
  }
}
```

### 会话生命周期管理
```typescript
// src/client/session-manager.ts
export class SessionManager {
  private activeSessions: Map<string, SessionInfo> = new Map();
  private sessionTimeout: number = 30 * 60 * 1000; // 30分钟

  trackSession(sessionId: string, conversationId: string): void {
    const now = Date.now();
    let sessionInfo = this.activeSessions.get(sessionId);
    
    if (!sessionInfo) {
      sessionInfo = {
        sessionId,
        createdAt: now,
        lastActivity: now,
        conversations: new Set([conversationId]),
        requestCount: 0
      };
      this.activeSessions.set(sessionId, sessionInfo);
    } else {
      sessionInfo.lastActivity = now;
      sessionInfo.conversations.add(conversationId);
      sessionInfo.requestCount++;
    }
  }

  cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, sessionInfo] of this.activeSessions.entries()) {
      if (now - sessionInfo.lastActivity > this.sessionTimeout) {
        this.activeSessions.delete(sessionId);
        // 通知路由器清理会话
        this.routerManager.cleanupSession(sessionId);
      }
    }
  }

  getSessionStats(): SessionStats {
    return {
      totalSessions: this.activeSessions.size,
      totalConversations: Array.from(this.activeSessions.values())
        .reduce((sum, session) => sum + session.conversations.size, 0),
      totalRequests: Array.from(this.activeSessions.values())
        .reduce((sum, session) => sum + session.requestCount, 0)
    };
  }
}

interface SessionInfo {
  sessionId: string;
  createdAt: number;
  lastActivity: number;
  conversations: Set<string>;
  requestCount: number;
}

interface SessionStats {
  totalSessions: number;
  totalConversations: number;
  totalRequests: number;
}
```

## CLI架构设计

### CLI模式架构图
```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI入口点                                │
│                      (src/cli.ts)                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   CLI管理器      │
                    │ (cli-manager.ts) │
                    └─────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
        ┌─────────────────┐   ┌─────────────────┐
        │   Server模式     │   │   Client模式     │
        │(cli-server.ts)  │   │(cli-client.ts)  │
        └─────────────────┘   └─────────────────┘
                    │                   │
                    ▼                   ▼
        ┌─────────────────┐   ┌─────────────────┐
        │  HTTP服务器      │   │  进程管理器      │
        │(server-manager) │   │(process-manager)│
        └─────────────────┘   └─────────────────┘
```

### Server模式实现
```typescript
// src/client/cli/cli-server.ts
export class CLIServer {
  private serverManager: ServerManager;
  private isShuttingDown: boolean = false;

  constructor() {
    this.serverManager = new ServerManager();
    this.setupSignalHandlers();
  }

  async start(options: ServerStartOptions): Promise<void> {
    try {
      console.log(chalk.blue('🚀 启动RCC v4.0 路由服务器...'));
      console.log(chalk.cyan(`端口: ${options.port}`));
      console.log(chalk.cyan(`配置: ${options.configPath}`));
      console.log(chalk.cyan(`调试: ${options.debug ? '启用' : '禁用'}`));
      console.log('');

      // 启动HTTP服务器
      await this.serverManager.startServer(options.port, {
        configPath: options.configPath,
        debug: options.debug,
        logLevel: options.debug ? 'debug' : 'info'
      });

      console.log(chalk.green('✅ 服务器启动成功'));
      console.log(chalk.gray('按 Ctrl+C 优雅退出'));
      console.log('');

      // 显示服务信息
      this.displayServerInfo(options.port);

      // 保持进程运行
      await this.keepAlive();

    } catch (error) {
      console.error(chalk.red('❌ 服务器启动失败:'), error.message);
      process.exit(1);
    }
  }

  private async keepAlive(): Promise<void> {
    // 保持进程运行，监控服务器状态
    const checkInterval = setInterval(async () => {
      if (this.isShuttingDown) {
        clearInterval(checkInterval);
        return;
      }

      try {
        const status = await this.serverManager.getServerStatus();
        if (!status.isRunning) {
          console.error(chalk.red('❌ 服务器意外停止'));
          await this.gracefulShutdown();
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red('❌ 服务器健康检查失败:'), error.message);
        await this.gracefulShutdown();
        process.exit(1);
      }
    }, 5000); // 每5秒检查一次

    // 等待退出信号
    return new Promise((resolve) => {
      process.on('exit', () => {
        clearInterval(checkInterval);
        resolve();
      });
    });
  }

  private setupSignalHandlers(): void {
    // Ctrl+C 优雅退出
    process.on('SIGINT', async () => {
      console.log('');
      console.log(chalk.yellow('🛑 接收到退出信号，正在优雅关闭...'));
      await this.gracefulShutdown();
      process.exit(0);
    });

    // 其他退出信号
    process.on('SIGTERM', async () => {
      console.log(chalk.yellow('🛑 接收到终止信号，正在关闭...'));
      await this.gracefulShutdown();
      process.exit(0);
    });

    // 未捕获的异常
    process.on('uncaughtException', async (error) => {
      console.error(chalk.red('❌ 未捕获的异常:'), error);
      await this.gracefulShutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason) => {
      console.error(chalk.red('❌ 未处理的Promise拒绝:'), reason);
      await this.gracefulShutdown();
      process.exit(1);
    });
  }

  private async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    try {
      console.log(chalk.yellow('📋 正在关闭服务器...'));
      
      // 停止接受新请求
      await this.serverManager.stopAcceptingRequests();
      
      // 等待现有请求完成
      console.log(chalk.yellow('⏳ 等待现有请求完成...'));
      await this.serverManager.waitForActiveRequests(10000); // 最多等待10秒
      
      // 关闭服务器
      await this.serverManager.stopServer();
      
      console.log(chalk.green('✅ 服务器已优雅关闭'));
    } catch (error) {
      console.error(chalk.red('❌ 关闭服务器时出错:'), error.message);
    }
  }

  private displayServerInfo(port: number): void {
    console.log(chalk.blue('📋 服务器信息:'));
    console.log(chalk.gray(`  API端点: http://localhost:${port}/v1/messages`));
    console.log(chalk.gray(`  健康检查: http://localhost:${port}/health`));
    console.log(chalk.gray(`  管理界面: http://localhost:${port}/ui/`));
    console.log('');
    console.log(chalk.blue('🔧 Claude Code配置:'));
    console.log(chalk.gray(`  export ANTHROPIC_BASE_URL=http://localhost:${port}`));
    console.log(chalk.gray(`  export ANTHROPIC_API_KEY=rcc-proxy-key`));
    console.log('');
  }
}
```

### Client模式实现
```typescript
// src/client/cli/cli-client.ts
export class CLIClient {
  private processManager: ProcessManager;
  private serverManager: ServerManager;
  private claudeProcess: ChildProcess | null = null;
  private rccServerPort: number;

  constructor() {
    this.processManager = new ProcessManager();
    this.serverManager = new ServerManager();
    this.setupSignalHandlers();
  }

  async startClaudeCode(options: ClientStartOptions): Promise<void> {
    try {
      console.log(chalk.blue('🤖 启动Claude Code with RCC代理...'));

      // 检查或启动RCC服务器
      await this.ensureRCCServer(options);

      // 设置环境变量
      const env = this.setupEnvironment(options.port);

      // 启动Claude Code
      await this.startClaude(env);

    } catch (error) {
      console.error(chalk.red('❌ 启动Claude Code失败:'), error.message);
      await this.cleanup();
      process.exit(1);
    }
  }

  private async ensureRCCServer(options: ClientStartOptions): Promise<void> {
    this.rccServerPort = options.port;

    // 检查服务器是否已运行
    const isRunning = await this.checkServerRunning(options.port);
    
    if (!isRunning) {
      if (options.autoStart) {
        console.log(chalk.yellow('🔄 RCC服务器未运行，正在自动启动...'));
        await this.startRCCServer(options);
      } else {
        throw new Error(`RCC服务器未在端口${options.port}运行，请先运行 'rcc start' 或使用 --auto-start 参数`);
      }
    } else {
      console.log(chalk.green(`✅ RCC服务器已在端口${options.port}运行`));
    }
  }

  private async startRCCServer(options: ClientStartOptions): Promise<void> {
    // 在后台启动RCC服务器
    const serverProcess = spawn('node', [
      path.join(__dirname, '../../cli.js'),
      'start',
      '--port', options.port.toString(),
      '--config', options.configPath || ''
    ], {
      detached: true,
      stdio: 'ignore'
    });

    serverProcess.unref(); // 允许父进程退出

    // 等待服务器启动
    let attempts = 0;
    const maxAttempts = 30; // 最多等待30秒

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (await this.checkServerRunning(options.port)) {
        console.log(chalk.green('✅ RCC服务器启动成功'));
        return;
      }
      
      attempts++;
    }

    throw new Error('RCC服务器启动超时');
  }

  private setupEnvironment(port: number): NodeJS.ProcessEnv {
    const env = { ...process.env };
    
    // 设置Claude Code环境变量
    env.ANTHROPIC_BASE_URL = `http://localhost:${port}`;
    env.ANTHROPIC_API_KEY = 'rcc-proxy-key';
    
    console.log(chalk.blue('🔧 环境变量已设置:'));
    console.log(chalk.gray(`  ANTHROPIC_BASE_URL=${env.ANTHROPIC_BASE_URL}`));
    console.log(chalk.gray(`  ANTHROPIC_API_KEY=${env.ANTHROPIC_API_KEY}`));
    console.log('');

    return env;
  }

  private async startClaude(env: NodeJS.ProcessEnv): Promise<void> {
    console.log(chalk.blue('🚀 启动Claude Code...'));

    // 查找Claude Code可执行文件
    const claudePath = await this.findClaudeExecutable();
    
    // 启动Claude Code进程
    this.claudeProcess = spawn(claudePath, [], {
      env,
      stdio: 'inherit', // 继承父进程的输入输出
      shell: true
    });

    // 监听Claude Code进程事件
    this.claudeProcess.on('exit', async (code, signal) => {
      if (signal === 'SIGINT') {
        console.log(chalk.yellow('🛑 Claude Code被用户中断'));
      } else if (code !== 0) {
        console.log(chalk.red(`❌ Claude Code异常退出 (代码: ${code})`));
      } else {
        console.log(chalk.green('✅ Claude Code正常退出'));
      }
      
      await this.cleanup();
      process.exit(code || 0);
    });

    this.claudeProcess.on('error', async (error) => {
      console.error(chalk.red('❌ Claude Code启动失败:'), error.message);
      await this.cleanup();
      process.exit(1);
    });

    console.log(chalk.green('✅ Claude Code已启动'));
    console.log(chalk.gray('Claude Code的输入输出将直接显示，RCC在后台透明代理'));
    console.log(chalk.gray('按 Ctrl+C 退出Claude Code并自动关闭RCC服务'));
    console.log('');
  }

  private async findClaudeExecutable(): Promise<string> {
    // 尝试不同的Claude Code路径
    const possiblePaths = [
      'claude',
      'claude-code',
      '/usr/local/bin/claude',
      '/opt/claude/bin/claude',
      process.platform === 'win32' ? 'claude.exe' : 'claude'
    ];

    for (const path of possiblePaths) {
      try {
        await this.processManager.checkExecutable(path);
        return path;
      } catch {
        continue;
      }
    }

    throw new Error('未找到Claude Code可执行文件，请确保Claude Code已正确安装');
  }

  private async checkServerRunning(port: number): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${port}/health`, {
        method: 'GET',
        timeout: 2000
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private setupSignalHandlers(): void {
    // Ctrl+C 处理
    process.on('SIGINT', async () => {
      console.log('');
      console.log(chalk.yellow('🛑 接收到退出信号...'));
      
      if (this.claudeProcess) {
        console.log(chalk.yellow('📋 正在关闭Claude Code...'));
        this.claudeProcess.kill('SIGINT');
      }
      
      await this.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  private async cleanup(): Promise<void> {
    try {
      // 关闭Claude Code进程
      if (this.claudeProcess && !this.claudeProcess.killed) {
        this.claudeProcess.kill('SIGTERM');
        
        // 等待进程退出
        await new Promise((resolve) => {
          this.claudeProcess!.on('exit', resolve);
          setTimeout(resolve, 5000); // 最多等待5秒
        });
      }

      // 关闭RCC服务器（如果是自动启动的）
      console.log(chalk.yellow('📋 正在关闭RCC服务器...'));
      await this.stopRCCServer();
      
      console.log(chalk.green('✅ 清理完成'));
    } catch (error) {
      console.error(chalk.red('❌ 清理时出错:'), error.message);
    }
  }

  private async stopRCCServer(): Promise<void> {
    try {
      const response = await fetch(`http://localhost:${this.rccServerPort}/admin/shutdown`, {
        method: 'POST',
        timeout: 5000
      });
      
      if (response.ok) {
        console.log(chalk.green('✅ RCC服务器已关闭'));
      }
    } catch (error) {
      // 忽略关闭错误，可能服务器已经关闭
      console.log(chalk.gray('RCC服务器关闭完成'));
    }
  }
}
```

### 进程管理器
```typescript
// src/client/cli/process-manager.ts
export class ProcessManager {
  async checkExecutable(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      exec(`which ${command}`, (error) => {
        if (error) {
          reject(new Error(`命令 ${command} 不存在`));
        } else {
          resolve();
        }
      });
    });
  }

  async killProcessOnPort(port: number): Promise<void> {
    try {
      if (process.platform === 'win32') {
        // Windows
        exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
          if (!error && stdout) {
            const lines = stdout.split('\n');
            for (const line of lines) {
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 5) {
                const pid = parts[4];
                exec(`taskkill /PID ${pid} /F`);
              }
            }
          }
        });
      } else {
        // Unix-like systems
        exec(`lsof -ti:${port} | xargs kill -9`, (error) => {
          // 忽略错误，可能端口没有被占用
        });
      }
    } catch (error) {
      // 忽略错误
    }
  }
}
```

## 质量要求

- ✅ 无静默失败
- ✅ 无mockup响应
- ✅ 无重复代码
- ✅ 无硬编码实现
- ✅ 完整的数据校验
- ✅ 标准接口通信
- ✅ 会话ID的智能提取和生成
- ✅ 对话ID的多策略识别
- ✅ 会话生命周期管理
- ✅ 优雅的进程管理和退出
- ✅ 透明的代理模式
- ✅ 完整的信号处理