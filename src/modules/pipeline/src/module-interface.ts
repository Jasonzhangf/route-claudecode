/**
 * Pipeline Module Interface
 * 
 * 统一的模块接口定义，用于Pipeline组装器的动态模块注册
 * 
 * @author Claude Code Router v4.0
 */

/**
 * 模块类型枚举
 */
export enum ModuleType {
  TRANSFORMER = 'transformer',
  PROTOCOL = 'protocol',
  SERVER_COMPATIBILITY = 'server-compatibility', 
  SERVER = 'server'
}

/**
 * 模块状态
 */
export interface ModuleStatus {
  id: string;
  name: string;
  type: ModuleType;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
  health: 'healthy' | 'degraded' | 'unhealthy';
  lastActivity?: Date;
  error?: Error;
}

/**
 * 模块性能指标
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
 * 统一模块接口
 * 
 * 所有Pipeline模块必须实现此接口
 */
export interface ModuleInterface {
  // 基础信息
  getId(): string;
  getName(): string;
  getType(): ModuleType;
  getVersion(): string;
  
  // 状态管理
  getStatus(): ModuleStatus;
  getMetrics(): ModuleMetrics;
  
  // 生命周期管理
  configure(config: any): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  reset(): Promise<void>;
  cleanup(): Promise<void>;
  
  // 健康检查
  healthCheck(): Promise<{ healthy: boolean; details: any }>;
  
  // 核心处理方法
  process(input: any): Promise<any>;
  
  // 模块连接管理 
  addConnection(module: ModuleInterface): void;
  removeConnection(moduleId: string): void;
  getConnection(moduleId: string): ModuleInterface | undefined;
  getConnections(): ModuleInterface[];
  hasConnection(moduleId: string): boolean;
  clearConnections(): void;
  getConnectionCount(): number;
  
  // 模块间通信
  sendToModule(targetModuleId: string, message: any, type?: string): Promise<any>;
  broadcastToModules(message: any, type?: string): Promise<void>;
  onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void): void;
  
  // 连接状态和验证
  getConnectionStatus(targetModuleId: string): 'connected' | 'disconnected' | 'connecting' | 'error';
  validateConnection(targetModule: ModuleInterface): boolean;
}

/**
 * 模块注册信息
 */
export interface ModuleRegistration {
  id: string;
  name: string;
  type: ModuleType;
  version: string;
  filePath: string;
  className: string;
  module: ModuleInterface;
  isActive: boolean;
  registeredAt: Date;
  // 可选的工厂信息（用于延迟实例化）
  _factoryInfo?: any;
}

/**
 * 模块工厂接口
 */
export interface ModuleFactory {
  createModule(type: ModuleType, config?: any): Promise<ModuleInterface>;
  getSupportedTypes(): ModuleType[];
}