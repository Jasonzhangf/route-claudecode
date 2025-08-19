/**
 * 会话管理模块
 *
 * 提供客户端会话管理、状态跟踪和连接池功能
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { ValidateInput, ValidateOutput } from '../middleware/data-validator';
import { RCCError, ErrorHandler, ErrorContext } from '../interfaces/client/error-handler';
import { getServerPort, getServerHost, buildServerUrl } from '../constants/server-defaults';

/**
 * 会话状态
 */
export type SessionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * 会话配置
 */
export interface SessionConfig {
  serverHost?: string;
  serverPort?: number;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  keepAlive?: boolean;
  keepAliveInterval?: number;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  authentication?: {
    apiKey?: string;
    token?: string;
  };
}

/**
 * 会话信息
 */
export interface SessionInfo {
  id: string;
  status: SessionStatus;
  serverEndpoint: string;
  connectedAt?: Date;
  lastActivity?: Date;
  requestCount: number;
  errorCount: number;
  uptime?: number;
  metadata?: Record<string, any>;
}

/**
 * 会话统计
 */
export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  totalRequests: number;
  totalErrors: number;
  averageUptime: number;
  connectionSuccessRate: number;
}

/**
 * 会话错误类
 */
export class SessionError extends RCCError {
  constructor(message: string, sessionId?: string, details?: Record<string, any>) {
    super(message, 'SESSION_ERROR', { sessionId, ...details });
    this.name = 'SessionError';
  }
}

/**
 * 客户端会话类
 */
export class ClientSession extends EventEmitter {
  private _id: string;
  private _status: SessionStatus = 'idle';
  private _config: Required<SessionConfig>;
  private _connectedAt?: Date;
  private _lastActivity?: Date;
  private _requestCount = 0;
  private _errorCount = 0;
  private _keepAliveTimer?: NodeJS.Timeout;
  private _reconnectTimer?: NodeJS.Timeout;
  private _reconnectAttempts = 0;
  private _metadata: Record<string, any> = {};

  constructor(
    config: SessionConfig,
    private errorHandler: ErrorHandler
  ) {
    super();
    this._id = this.generateSessionId();
    this._config = this.mergeDefaultConfig(config);
    this.setupEventHandlers();
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 合并默认配置
   */
  private mergeDefaultConfig(config: SessionConfig): Required<SessionConfig> {
    return {
      serverHost: config.serverHost || getServerHost(),
      serverPort: config.serverPort || getServerPort(),
      timeout: config.timeout || 30000,
      retryCount: config.retryCount || 3,
      retryDelay: config.retryDelay || 1000,
      keepAlive: config.keepAlive ?? true,
      keepAliveInterval: config.keepAliveInterval || 30000,
      autoReconnect: config.autoReconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts || 5,
      authentication: config.authentication || {},
    };
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    this.on('connected', () => {
      this._connectedAt = new Date();
      this._lastActivity = new Date();
      this._reconnectAttempts = 0;
      this.startKeepAlive();
    });

    this.on('disconnected', () => {
      this.stopKeepAlive();
      if (this._config.autoReconnect && this._reconnectAttempts < this._config.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    });

    this.on('error', (error: Error) => {
      this._errorCount++;
      this._status = 'error';
      this.errorHandler.handleError(error, this.createErrorContext());
    });
  }

  /**
   * 创建错误上下文
   */
  private createErrorContext(): ErrorContext {
    return {
      module: 'session',
      operation: 'session_management',
      requestId: this._id,
      timestamp: new Date(),
      additionalData: {
        sessionId: this._id,
        status: this._status,
        requestCount: this._requestCount,
        errorCount: this._errorCount,
      },
    };
  }

  /**
   * 连接到服务器
   */
  @ValidateInput({
    force: { type: 'boolean', required: false },
  })
  async connect(force: boolean = false): Promise<void> {
    if (this._status === 'connected' && !force) {
      return;
    }

    if (this._status === 'connecting') {
      throw new SessionError('Session is already connecting', this._id);
    }

    try {
      this._status = 'connecting';
      this.emit('connecting');

      const serverEndpoint = `http://${this._config.serverHost}:${this._config.serverPort}`;

      // 执行连接检查
      await this.performConnectionCheck(serverEndpoint);

      this._status = 'connected';
      this.emit('connected', { sessionId: this._id, endpoint: serverEndpoint });
    } catch (error) {
      this._status = 'error';
      const sessionError = new SessionError(`Failed to connect to server: ${(error as Error).message}`, this._id, {
        serverEndpoint: this.getServerEndpoint(),
      });
      this.emit('error', sessionError);
      throw sessionError;
    }
  }

  /**
   * 执行连接检查
   */
  private async performConnectionCheck(endpoint: string): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this._config.timeout);

    try {
      const response = await fetch(`${endpoint}/v1/status`, {
        method: 'GET',
        headers: this.buildHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}: ${response.statusText}`);
      }

      const health = await response.json();
      if (!health.healthy) {
        throw new Error('Server health check failed');
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 构建请求头
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': `RCC-Client/${this._id}`,
    };

    if (this._config.authentication.apiKey) {
      headers['X-API-Key'] = this._config.authentication.apiKey;
    }

    if (this._config.authentication.token) {
      headers['Authorization'] = `Bearer ${this._config.authentication.token}`;
    }

    return headers;
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this._status === 'disconnected' || this._status === 'idle') {
      return;
    }

    try {
      this.stopKeepAlive();
      this.stopReconnect();

      this._status = 'disconnected';
      this.emit('disconnected', { sessionId: this._id });
    } catch (error) {
      const sessionError = new SessionError(`Failed to disconnect cleanly: ${(error as Error).message}`, this._id);
      this.emit('error', sessionError);
      throw sessionError;
    }
  }

  /**
   * 发送请求
   */
  @ValidateInput({
    path: { type: 'string', required: true },
    method: { type: 'string', required: false },
    data: { type: 'object', required: false },
    headers: { type: 'object', required: false },
  })
  async sendRequest<T = any>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST',
    data?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    if (this._status !== 'connected') {
      throw new SessionError('Session is not connected', this._id);
    }

    try {
      this._requestCount++;
      this._lastActivity = new Date();

      const endpoint = `${this.getServerEndpoint()}${path}`;
      const requestHeaders = { ...this.buildHeaders(), ...headers };

      const response = await fetch(endpoint, {
        method,
        headers: requestHeaders,
        body: data ? JSON.stringify(data) : undefined,
        signal: AbortSignal.timeout(this._config.timeout),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      this.emit('request', { path, method, success: true, responseTime: Date.now() });

      return result;
    } catch (error) {
      this._errorCount++;
      const sessionError = new SessionError(`Request failed: ${(error as Error).message}`, this._id, { path, method });
      this.emit('request', { path, method, success: false, error: sessionError });
      throw sessionError;
    }
  }

  /**
   * 开始保活机制
   */
  private startKeepAlive(): void {
    if (!this._config.keepAlive) return;

    this.stopKeepAlive();
    this._keepAliveTimer = setInterval(async () => {
      try {
        await this.ping();
      } catch (error) {
        this.emit('error', new SessionError('Keep-alive ping failed', this._id));
      }
    }, this._config.keepAliveInterval);
  }

  /**
   * 停止保活机制
   */
  private stopKeepAlive(): void {
    if (this._keepAliveTimer) {
      clearInterval(this._keepAliveTimer);
      this._keepAliveTimer = undefined;
    }
  }

  /**
   * 执行Ping检查
   */
  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.getServerEndpoint()}/v1/ping`, {
        method: 'GET',
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        this._lastActivity = new Date();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * 调度重连
   */
  private scheduleReconnect(): void {
    if (this._reconnectTimer) return;

    const delay = this._config.retryDelay * Math.pow(2, this._reconnectAttempts);
    this._reconnectTimer = setTimeout(async () => {
      this._reconnectAttempts++;
      this._reconnectTimer = undefined;

      try {
        await this.connect(true);
      } catch (error) {
        if (this._reconnectAttempts >= this._config.maxReconnectAttempts) {
          this.emit('error', new SessionError('Max reconnection attempts reached', this._id));
        }
      }
    }, delay);
  }

  /**
   * 停止重连
   */
  private stopReconnect(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = undefined;
    }
    this._reconnectAttempts = 0;
  }

  /**
   * 获取服务器端点
   */
  private getServerEndpoint(): string {
    return `http://${this._config.serverHost}:${this._config.serverPort}`;
  }

  /**
   * 更新元数据
   */
  @ValidateInput({
    key: { type: 'string', required: true },
    value: { type: 'string', required: true },
  })
  setMetadata(key: string, value: any): void {
    this._metadata[key] = value;
    this.emit('metadata_updated', { key, value });
  }

  /**
   * 获取会话信息
   */
  @ValidateOutput({
    type: 'object',
    properties: {
      id: { type: 'string', required: true },
      status: { type: 'string', required: true },
      serverEndpoint: { type: 'string', required: true },
      requestCount: { type: 'number', required: true },
      errorCount: { type: 'number', required: true },
    },
  })
  getSessionInfo(): SessionInfo {
    return {
      id: this._id,
      status: this._status,
      serverEndpoint: this.getServerEndpoint(),
      connectedAt: this._connectedAt,
      lastActivity: this._lastActivity,
      requestCount: this._requestCount,
      errorCount: this._errorCount,
      uptime: this._connectedAt ? Date.now() - this._connectedAt.getTime() : undefined,
      metadata: { ...this._metadata },
    };
  }

  // Getter methods
  get id(): string {
    return this._id;
  }
  get status(): SessionStatus {
    return this._status;
  }
  get requestCount(): number {
    return this._requestCount;
  }
  get errorCount(): number {
    return this._errorCount;
  }
  get isConnected(): boolean {
    return this._status === 'connected';
  }
}

/**
 * 会话管理器
 */
export class SessionManager extends EventEmitter {
  private sessions = new Map<string, ClientSession>();
  private stats: SessionStats = {
    totalSessions: 0,
    activeSessions: 0,
    totalRequests: 0,
    totalErrors: 0,
    averageUptime: 0,
    connectionSuccessRate: 0,
  };

  constructor(private errorHandler: ErrorHandler) {
    super();
  }

  /**
   * 创建新会话
   */
  @ValidateInput({
    config: {
      type: 'object',
      properties: {
        serverHost: { type: 'string', required: false },
        serverPort: { type: 'number', required: false },
        timeout: { type: 'number', required: false },
      },
      required: false,
    },
  })
  createSession(config: SessionConfig = {}): ClientSession {
    const session = new ClientSession(config, this.errorHandler);

    // 监听会话事件
    session.on('connected', () => {
      this.stats.activeSessions++;
      this.emit('session_connected', session.id);
    });

    session.on('disconnected', () => {
      this.stats.activeSessions--;
      this.emit('session_disconnected', session.id);
    });

    session.on('request', data => {
      this.stats.totalRequests++;
      if (!data.success) {
        this.stats.totalErrors++;
      }
    });

    this.sessions.set(session.id, session);
    this.stats.totalSessions++;

    this.emit('session_created', session.id);
    return session;
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): ClientSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 移除会话
   */
  async removeSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    try {
      if (session.isConnected) {
        await session.disconnect();
      }

      this.sessions.delete(sessionId);
      this.emit('session_removed', sessionId);
      return true;
    } catch (error) {
      this.errorHandler.handleError(error, {
        module: 'session_manager',
        operation: 'remove_session',
        additionalData: { sessionId },
      });
      return false;
    }
  }

  /**
   * 获取所有活跃会话
   */
  getActiveSessions(): ClientSession[] {
    return Array.from(this.sessions.values()).filter(session => session.isConnected);
  }

  /**
   * 获取会话统计
   */
  @ValidateOutput({
    type: 'object',
    properties: {
      totalSessions: { type: 'number', required: true },
      activeSessions: { type: 'number', required: true },
      totalRequests: { type: 'number', required: true },
      totalErrors: { type: 'number', required: true },
    },
  })
  getStats(): SessionStats {
    // 更新统计信息
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    const activeSessions = this.getActiveSessions();
    this.stats.activeSessions = activeSessions.length;

    if (activeSessions.length > 0) {
      const totalUptime = activeSessions.reduce((sum, session) => {
        const info = session.getSessionInfo();
        return sum + (info.uptime || 0);
      }, 0);
      this.stats.averageUptime = totalUptime / activeSessions.length;
    }

    this.stats.connectionSuccessRate =
      this.stats.totalSessions > 0 ? (this.stats.totalSessions - this.stats.totalErrors) / this.stats.totalSessions : 0;
  }

  /**
   * 清理所有会话
   */
  async cleanup(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());

    await Promise.all(sessionIds.map(sessionId => this.removeSession(sessionId)));

    this.sessions.clear();
    this.emit('cleanup_completed');
  }
}

// 所有类型和类已通过export interface/class声明导出
