/**
 * 模块实现接口
 * 
 * 定义模块具体实现应该遵循的接口标准
 * 避免模块间直接依赖具体实现类
 * 
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';

/**
 * 模块类型枚举
 */
export enum ModuleType {
  VALIDATOR = 'validator',
  TRANSFORMER = 'transformer', 
  PROTOCOL = 'protocol',
  COMPATIBILITY = 'compatibility',
  SERVER = 'server'
}

/**
 * 模块状态接口
 */
export interface IModuleStatus {
  id: string;
  name: string;
  type: ModuleType;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
  health: 'healthy' | 'degraded' | 'unhealthy';
  lastActivity?: Date;
  error?: Error;
}

/**
 * 模块性能指标接口
 */
export interface IModuleMetrics {
  requestsProcessed: number;
  averageProcessingTime: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
  lastProcessedAt?: Date;
}

/**
 * 标准模块接口
 * 所有模块实现都应该遵循此接口
 */
export interface IModuleInterface extends EventEmitter {
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
  getStatus(): IModuleStatus;
  
  /**
   * 获取模块性能指标
   */
  getMetrics(): IModuleMetrics;
  
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
   * 处理数据
   */
  process(input: any): Promise<any>;
  
  /**
   * 重置模块状态
   */
  reset(): Promise<void>;
  
  /**
   * 清理模块资源
   */
  cleanup(): Promise<void>;
  
  /**
   * 健康检查
   */
  healthCheck(): Promise<{ healthy: boolean; details: any }>;
}

/**
 * 标准请求接口（简化版）
 */
export interface IStandardRequest {
  readonly id: string;
  readonly model: string;
  readonly messages: any[];
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly stream?: boolean;
  readonly tools?: any[];
  readonly metadata: any;
  readonly timestamp: Date;
}

/**
 * 验证结果接口
 */
export interface IValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
  details?: any;
}

/**
 * 模块工厂接口
 */
export interface IModuleFactory {
  /**
   * 创建模块实例
   * @param type 模块类型
   * @param config 模块配置
   */
  createModule(type: ModuleType, config: any): Promise<IModuleInterface>;
  
  /**
   * 获取支持的模块类型
   */
  getSupportedTypes(): ModuleType[];
  
  /**
   * 验证模块配置
   */
  validateConfig(type: ModuleType, config: any): boolean;
}