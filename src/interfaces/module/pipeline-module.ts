/**
 * 流水线模块接口定义
 * 
 * 流水线特定的模块接口和工厂接口
 * 
 * @author Jason Zhang
 */

import { ModuleInterface, PipelineSpec } from './base-module';

/**
 * 流水线接口
 */
export interface Pipeline {
  readonly id: string;
  readonly provider: string;
  readonly model: string;
  readonly modules: ModuleInterface[];
  readonly spec: PipelineSpec;
  
  /**
   * 处理请求
   */
  process(input: any): Promise<any>;
  
  /**
   * 验证流水线完整性
   */
  validate(): Promise<boolean>;
  
  /**
   * 获取流水线状态
   */
  getStatus(): PipelineStatus;
  
  /**
   * 销毁流水线
   */
  destroy(): Promise<void>;
}

/**
 * 流水线状态
 */
export interface PipelineStatus {
  id: string;
  name: string;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
  modules: Record<string, import('./base-module').ModuleStatus>;
  lastExecution?: any;
  uptime: number;
  performance: {
    requestsProcessed: number;
    averageProcessingTime: number;
    errorRate: number;
    throughput: number;
  };
}

/**
 * 模块工厂接口
 */
export interface ModuleFactory {
  /**
   * 创建模块实例
   */
  create(config?: Record<string, any>): ModuleInterface;
  
  /**
   * 获取模块类型
   */
  getType(): string;
  
  /**
   * 获取默认配置
   */
  getDefaultConfig(): Record<string, any>;
}

/**
 * 模块注册表接口
 */
export interface ModuleRegistry {
  /**
   * 注册模块实例
   */
  register(module: ModuleInterface): Promise<void>;
  
  /**
   * 注册模块工厂
   */
  registerFactory(moduleId: string, factory: ModuleFactory): void;
  
  /**
   * 获取模块
   */
  getModule(moduleId: string): ModuleInterface | null;
  
  /**
   * 创建流水线
   */
  createPipeline(spec: PipelineSpec): Promise<Pipeline>;
  
  /**
   * 列出所有注册的模块
   */
  listModules(): string[];
  
  /**
   * 注销模块
   */
  unregister(moduleId: string): Promise<void>;
}

/**
 * 流水线工厂接口
 */
export interface PipelineFactory {
  /**
   * 创建流水线实例
   */
  createPipeline(provider: string, model: string, spec?: PipelineSpec): Promise<Pipeline>;
  
  /**
   * 销毁流水线
   */
  destroyPipeline(pipelineId: string): Promise<void>;
  
  /**
   * 获取流水线
   */
  getPipeline(pipelineId: string): Pipeline | null;
  
  /**
   * 列出所有活跃流水线
   */
  listActivePipelines(): Pipeline[];
}