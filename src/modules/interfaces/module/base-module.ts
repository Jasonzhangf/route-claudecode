/**
 * 模块类型枚举
 */
export enum ModuleType {
  CLIENT = 'client',
  ROUTER = 'router',
  TRANSFORMER = 'transformer',
  PROTOCOL = 'protocol',
  SERVER_COMPATIBILITY = 'server-compatibility',
  SERVER = 'server',
  RESPONSE_TRANSFORMER = 'response-transformer',
  CONFIG = 'config',
  PIPELINE = 'pipeline',
  DEBUG = 'debug',
  ERROR_HANDLER = 'error-handler',
  AUTH = 'auth',
  VALIDATION = 'validation',
  MONITORING = 'monitoring',
  SERVICE = 'service'
}

/**
 * 模块状态接口
 */
export interface ModuleStatus {
  id: string;
  name: string;
  type: ModuleType;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error' | 'busy';
  health: 'healthy' | 'degraded' | 'unhealthy';
  lastActivity?: Date;
  error?: Error;
}

/**
 * 模块指标接口
 */
export interface ModuleMetrics {
  requestsProcessed: number;
  averageProcessingTime: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
  lastProcessedAt?: Date;
}

/**
 * 模块连接接口
 */
export interface ModuleConnection {
  moduleId: string;
  connectionTime: Date;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
}

/**
 * 模块接口
 */
export interface ModuleInterface {
  /**
   * 获取模块ID
   */
  getId(): string;

  /**
   * 获取模块名称
   */
  getName(): string;

  /**
   * 获取模块类型
   */
  getType(): ModuleType;

  /**
   * 获取模块版本
   */
  getVersion(): string;

  /**
   * 获取模块状态
   */
  getStatus(): ModuleStatus;

  /**
   * 获取模块指标
   */
  getMetrics(): ModuleMetrics;

  /**
   * 配置模块
   */
  configure(config: any): Promise<void>;

  /**
   * 启动模块
   */
  start(): Promise<void>;

  /**
   * 停止模块
   */
  stop(): Promise<void>;

  /**
   * 处理输入
   */
  process(input: any): Promise<any>;

  /**
   * 重置模块
   */
  reset(): Promise<void>;

  /**
   * 清理资源
   */
  cleanup(): Promise<void>;

  /**
   * 健康检查
   */
  healthCheck(): Promise<{ healthy: boolean; details: any }>;

  /**
   * 添加模块连接
   */
  addConnection(module: ModuleInterface): void;

  /**
   * 移除模块连接
   */
  removeConnection(moduleId: string): void;

  /**
   * 获取指定模块连接
   */
  getConnection(moduleId: string): ModuleInterface | undefined;

  /**
   * 获取所有连接
   */
  getConnections(): ModuleInterface[];

  /**
   * 获取连接状态
   */
  getConnectionStatus(targetModuleId: string): 'connected' | 'disconnected' | 'connecting' | 'error';

  /**
   * 发送消息到目标模块
   */
  sendToModule(targetModuleId: string, message: any, type?: string): Promise<any>;

  /**
   * 广播消息到所有连接的模块
   */
  broadcastToModules(message: any, type?: string): Promise<void>;

  /**
   * 监听来自其他模块的消息
   */
  onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void): void;

  /**
   * 验证连接
   */
  validateConnection(targetModule: ModuleInterface): boolean;
}