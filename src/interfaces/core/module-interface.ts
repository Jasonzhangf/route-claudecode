/**
 * 核心模块接口定义
 * 
 * 定义RCC v4.0所有模块必须遵循的标准接口
 * 确保模块间只能通过接口通信，严禁直接调用具体实现
 * 
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';

/**
 * 模块状态枚举
 */
export enum ModuleStatus {
  IDLE = 'idle',
  STARTING = 'starting', 
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error'
}

/**
 * 模块类型枚举
 */
export enum ModuleType {
  CLIENT = 'client',
  ROUTER = 'router', 
  PIPELINE = 'pipeline',
  DEBUG = 'debug',
  SERVER = 'server'
}

/**
 * 模块配置基础接口
 */
export interface ModuleConfig {
  readonly id: string;
  readonly type: ModuleType;
  readonly name: string;
  readonly version: string;
  readonly debug?: boolean;
  readonly metadata?: Record<string, any>;
}

/**
 * 模块健康检查结果
 */
export interface HealthCheck {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly timestamp: Date;
  readonly checks: Array<{
    name: string;
    status: 'pass' | 'warn' | 'fail';
    responseTime: number;
    message?: string;
  }>;
}

/**
 * 模块性能指标
 */
export interface PerformanceMetrics {
  readonly uptime: number;
  readonly requestCount: number;
  readonly errorCount: number;
  readonly averageResponseTime: number;
  readonly memoryUsage: number;
}

/**
 * 标准模块接口
 * 所有RCC模块必须实现此接口
 */
export interface IModule extends EventEmitter {
  /**
   * 模块配置（只读）
   */
  readonly config: ModuleConfig;
  
  /**
   * 模块当前状态
   */
  readonly status: ModuleStatus;
  
  /**
   * 启动模块
   * @returns Promise<void>
   */
  start(): Promise<void>;
  
  /**
   * 停止模块
   * @returns Promise<void>
   */
  stop(): Promise<void>;
  
  /**
   * 重启模块
   * @returns Promise<void>
   */
  restart(): Promise<void>;
  
  /**
   * 获取模块健康状态
   * @returns Promise<HealthCheck>
   */
  getHealth(): Promise<HealthCheck>;
  
  /**
   * 获取性能指标
   * @returns Promise<PerformanceMetrics>
   */
  getMetrics(): Promise<PerformanceMetrics>;
  
  /**
   * 更新模块配置
   * @param config 部分配置更新
   * @returns Promise<void>
   */
  updateConfig(config: Partial<ModuleConfig>): Promise<void>;
}

/**
 * 模块管理器接口
 * 负责管理所有模块的生命周期
 */
export interface IModuleManager extends EventEmitter {
  /**
   * 注册模块
   * @param module 模块实例
   */
  register(module: IModule): Promise<void>;
  
  /**
   * 注销模块
   * @param moduleId 模块ID
   */
  unregister(moduleId: string): Promise<void>;
  
  /**
   * 获取模块实例
   * @param moduleId 模块ID
   * @returns 模块实例或null
   */
  getModule(moduleId: string): IModule | null;
  
  /**
   * 获取所有模块
   * @returns 模块映射表
   */
  getAllModules(): Map<string, IModule>;
  
  /**
   * 按类型获取模块
   * @param type 模块类型
   * @returns 模块数组
   */
  getModulesByType(type: ModuleType): IModule[];
  
  /**
   * 启动所有模块
   */
  startAll(): Promise<void>;
  
  /**
   * 停止所有模块
   */
  stopAll(): Promise<void>;
  
  /**
   * 获取全局健康状态
   */
  getGlobalHealth(): Promise<HealthCheck>;
}

/**
 * 模块间通信接口
 */
export interface IModuleCommunication {
  /**
   * 发送消息给目标模块
   * @param targetModuleId 目标模块ID
   * @param message 消息内容
   * @param timeout 超时时间(毫秒)
   * @returns Promise<any> 响应数据
   */
  sendMessage(targetModuleId: string, message: any, timeout?: number): Promise<any>;
  
  /**
   * 广播消息给所有模块
   * @param message 消息内容
   * @param excludeModules 排除的模块ID列表
   */
  broadcast(message: any, excludeModules?: string[]): Promise<void>;
  
  /**
   * 监听来自其他模块的消息
   * @param handler 消息处理函数
   */
  onMessage(handler: (sourceModuleId: string, message: any) => Promise<any>): void;
}

/**
 * 模块事件类型
 */
export interface ModuleEvents {
  'status-changed': (moduleId: string, oldStatus: ModuleStatus, newStatus: ModuleStatus) => void;
  'error': (moduleId: string, error: Error) => void;
  'health-changed': (moduleId: string, health: HealthCheck) => void;
  'metrics-updated': (moduleId: string, metrics: PerformanceMetrics) => void;
}

/**
 * 模块工厂接口
 */
export interface IModuleFactory {
  /**
   * 创建模块实例
   * @param config 模块配置
   * @returns 模块实例
   */
  createModule(config: ModuleConfig): Promise<IModule>;
  
  /**
   * 获取支持的模块类型
   * @returns 支持的模块类型数组
   */
  getSupportedTypes(): ModuleType[];
  
  /**
   * 验证模块配置
   * @param config 模块配置
   * @returns 是否有效
   */
  validateConfig(config: ModuleConfig): boolean;
}