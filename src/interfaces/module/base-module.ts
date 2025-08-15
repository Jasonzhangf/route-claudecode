/**
 * 基础模块接口定义
 * 
 * 所有模块必须实现的基础接口，确保模块间的一致性
 * 
 * @author Jason Zhang
 */

import { ValidationResult, ModuleMetrics } from '../../types';

/**
 * 模块类型枚举
 */
export type ModuleType = 
  | 'router'
  | 'input-transformer'
  | 'format-normalizer'
  | 'preprocessor'
  | 'protocol'
  | 'response-interceptor'
  | 'postprocessor'
  | 'output-transformer'
  | 'debug'
  | 'error-capture'
  | 'unit-test';

/**
 * 模块接口定义
 */
export interface ModuleInterface {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly type: ModuleType;
  readonly interfaces: {
    input: DataInterface;
    output: DataInterface;
  };
  
  /**
   * 处理数据
   */
  process(input: any): Promise<any>;
  
  /**
   * 验证输入数据
   */
  validate(input: any): Promise<ValidationResult>;
  
  /**
   * 获取模块性能指标
   */
  getMetrics(): ModuleMetrics;
  
  /**
   * 模块初始化
   */
  initialize?(): Promise<void>;
  
  /**
   * 模块销毁
   */
  destroy?(): Promise<void>;
}

/**
 * 数据接口定义
 */
export interface DataInterface {
  type: string;
  schema: Record<string, any>;
  description: string;
}

/**
 * 模块配置接口
 */
export interface ModuleConfig {
  id: string;
  moduleId: string;
  enabled: boolean;
  config: Record<string, any>;
}

/**
 * 流水线规范接口
 */
export interface PipelineSpec {
  id: string;
  name: string;
  description: string;
  version: string;
  modules: ModuleConfig[];
  configuration: PipelineConfiguration;
  metadata: PipelineMetadata;
}

/**
 * 流水线配置
 */
export interface PipelineConfiguration {
  parallel: boolean;
  failFast: boolean;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
  };
}

/**
 * 流水线元数据
 */
export interface PipelineMetadata {
  author: string;
  created: number;
  tags: string[];
}

/**
 * 基础模块抽象类
 */
export abstract class BaseModule implements ModuleInterface {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly version: string;
  public abstract readonly type: ModuleType;
  public abstract readonly interfaces: {
    input: DataInterface;
    output: DataInterface;
  };
  
  private metrics: ModuleMetrics = {
    processedRequests: 0,
    averageProcessingTime: 0,
    errorCount: 0
  };
  
  /**
   * 处理数据 - 子类必须实现
   */
  public abstract process(input: any): Promise<any>;
  
  /**
   * 验证输入数据 - 子类必须实现
   */
  public abstract validate(input: any): Promise<ValidationResult>;
  
  /**
   * 获取性能指标
   */
  public getMetrics(): ModuleMetrics {
    return { ...this.metrics };
  }
  
  /**
   * 更新性能指标
   */
  protected updateMetrics(processingTime: number, hasError: boolean = false): void {
    this.metrics.processedRequests++;
    
    // 计算平均处理时间
    const totalTime = this.metrics.averageProcessingTime * (this.metrics.processedRequests - 1);
    this.metrics.averageProcessingTime = (totalTime + processingTime) / this.metrics.processedRequests;
    
    if (hasError) {
      this.metrics.errorCount++;
    }
    
    this.metrics.lastProcessedAt = new Date();
  }
  
  /**
   * 模块初始化 - 可选实现
   */
  public async initialize(): Promise<void> {
    // 默认空实现
  }
  
  /**
   * 模块销毁 - 可选实现
   */
  public async destroy(): Promise<void> {
    // 默认空实现
  }
}