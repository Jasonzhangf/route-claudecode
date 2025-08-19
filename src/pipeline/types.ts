/**
 * 管道类型定义
 *
 * 为RCC管道系统提供核心类型支持
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { RCCError } from '../types/error';

/**
 * 管道状态枚举
 */
export enum PipelineStatus {
  IDLE = 'idle',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
}

/**
 * 模块状态枚举
 */
export enum ModuleStatus {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  READY = 'ready',
  PROCESSING = 'processing',
  ERROR = 'error',
  SHUTDOWN = 'shutdown',
}

/**
 * 管道配置接口
 */
export interface PipelineConfig {
  id: string;
  name: string;
  provider: string;
  model: string;
  timeout: number;
  retryCount: number;
  modules: ModuleConfig[];
  metadata?: Record<string, any>;
}

/**
 * 模块配置接口
 */
export interface ModuleConfig {
  name: string;
  type: string;
  config: Record<string, any>;
  dependencies?: string[];
  timeout?: number;
  retryCount?: number;
}

/**
 * 管道性能指标
 */
export interface PipelinePerformance {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  throughput: number;
  errorRate: number;
  lastUpdated: number;
}

/**
 * 模块性能指标
 */
export interface ModulePerformance {
  name: string;
  processedRequests: number;
  averageProcessingTime: number;
  minProcessingTime: number;
  maxProcessingTime: number;
  errorCount: number;
  lastProcessedAt: number;
}

/**
 * 管道执行上下文
 */
export interface PipelineContext {
  requestId: string;
  startTime: number;
  metadata: Record<string, any>;
  modules: Record<string, any>;
  performance: {
    moduleTimings: Record<string, number>;
    totalLatency: number;
  };
}

/**
 * 管道执行结果
 */
export interface PipelineResult {
  success: boolean;
  output?: any;
  error?: RCCError;
  context: PipelineContext;
  performance: {
    totalLatency: number;
    moduleLatencies: Record<string, number>;
  };
}

/**
 * 管道接口
 */
export interface Pipeline extends EventEmitter {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly model: string;
  readonly status: PipelineStatus;
  readonly modules: string[];
  readonly uptime: number;
  readonly performance: PipelinePerformance;

  /**
   * 初始化管道
   */
  initialize(): Promise<void>;

  /**
   * 执行管道
   */
  execute(input: any, context?: Partial<PipelineContext>): Promise<PipelineResult>;

  /**
   * 启动管道
   */
  start(): Promise<void>;

  /**
   * 停止管道
   */
  stop(): Promise<void>;

  /**
   * 获取管道状态
   */
  getStatus(): PipelineStatus;

  /**
   * 获取性能指标
   */
  getPerformance(): PipelinePerformance;

  /**
   * 清理资源
   */
  cleanup(): Promise<void>;

  /**
   * 获取管道ID
   */
  getId(): string;

  /**
   * 获取管道名称
   */
  getName(): string;

  /**
   * 获取提供商
   */
  getProvider(): string;

  /**
   * 获取模型
   */
  getModel(): string;
}

/**
 * 模块接口
 */
export interface Module extends EventEmitter {
  readonly name: string;
  readonly type: string;
  readonly status: ModuleStatus;
  readonly dependencies: string[];

  /**
   * 初始化模块
   */
  initialize(config: ModuleConfig): Promise<void>;

  /**
   * 处理数据
   */
  process(input: any, context: PipelineContext): Promise<any>;

  /**
   * 清理资源
   */
  cleanup(): Promise<void>;

  /**
   * 获取模块状态
   */
  getStatus(): ModuleStatus;

  /**
   * 获取性能指标
   */
  getPerformance(): ModulePerformance;
}

/**
 * 管道工厂接口
 */
export interface PipelineFactory {
  /**
   * 创建管道
   */
  createPipeline(config: PipelineConfig): Promise<Pipeline>;

  /**
   * 获取支持的管道类型
   */
  getSupportedTypes(): string[];

  /**
   * 验证管道配置
   */
  validateConfig(config: PipelineConfig): boolean;
}

/**
 * 模块工厂接口
 */
export interface ModuleFactory {
  /**
   * 创建模块
   */
  createModule(config: ModuleConfig): Promise<Module>;

  /**
   * 获取支持的模块类型
   */
  getSupportedTypes(): string[];

  /**
   * 验证模块配置
   */
  validateConfig(config: ModuleConfig): boolean;
}

/**
 * 管道管理器接口
 */
export interface PipelineManager {
  /**
   * 注册管道
   */
  registerPipeline(pipeline: Pipeline): void;

  /**
   * 取消注册管道
   */
  unregisterPipeline(id: string): void;

  /**
   * 获取管道
   */
  getPipeline(id: string): Pipeline | undefined;

  /**
   * 获取所有管道
   */
  getAllPipelines(): Pipeline[];

  /**
   * 启动所有管道
   */
  startAll(): Promise<void>;

  /**
   * 停止所有管道
   */
  stopAll(): Promise<void>;

  /**
   * 清理所有资源
   */
  cleanup(): Promise<void>;
}

/**
 * 管道事件类型
 */
export interface PipelineEvents {
  'pipeline-started': (id: string) => void;
  'pipeline-stopped': (id: string) => void;
  'pipeline-error': (id: string, error: RCCError) => void;
  'request-received': (id: string, requestId: string) => void;
  'request-completed': (id: string, requestId: string, result: PipelineResult) => void;
  'module-processed': (id: string, moduleName: string, duration: number) => void;
}

/**
 * 模块事件类型
 */
export interface ModuleEvents {
  'module-initialized': (name: string) => void;
  'module-processing': (name: string, requestId: string) => void;
  'module-processed': (name: string, requestId: string, duration: number) => void;
  'module-error': (name: string, error: RCCError) => void;
}

/**
 * 管道统计信息
 */
export interface PipelineStatistics {
  totalPipelines: number;
  activePipelines: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  throughput: number;
  errorRate: number;
  moduleStatistics: Record<string, ModulePerformance>;
}

/**
 * 管道监控配置
 */
export interface PipelineMonitoringConfig {
  enabled: boolean;
  metricsInterval: number;
  performanceThresholds: {
    maxLatency: number;
    maxErrorRate: number;
    minThroughput: number;
  };
  alerting: {
    enabled: boolean;
    channels: string[];
  };
}
